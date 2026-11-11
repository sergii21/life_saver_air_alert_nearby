import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, type Region } from 'react-native-maps';
import { CONFIG } from '../config';
import { timeAgo, zoneName } from '../i18n';
import { destinationPoint } from '../lib/geo';
import { SPEED_RANGE_KMH, trackCourse, trackOrigin, type ThreatTrack } from '../lib/threat';
import { countLabel, KIND_COLOR, KIND_ICON, kindBadge } from '../lib/threatText';
import { colors } from '../theme';
import type { Coords, Zone } from '../types';
import type { ZoneMapProps } from './ZoneMap';

const CITY = CONFIG.ZONES.find((z) => z.kind === 'area')?.center ?? { latitude: 49.2331, longitude: 28.4682 };

/** District names are drawn only when zoomed in this far, and never more than this many. */
const LABEL_MAX_SPAN = 0.3;
const LABEL_MAX_COUNT = 40;

/** The flying marker moves this often, and takes this long from start to destination. */
const FLY_TICK_MS = 250;
const FLY_LOOP_MS = 6000;

/**
 * A faster kind flies its line in less time, so a jet Shahed visibly outruns a propeller
 * one: the slow Shahed takes the full loop, others proportionally less (never under 1.5 s).
 */
function loopMs(track: ThreatTrack): number {
  const range = SPEED_RANGE_KMH[track.kind];
  const slowest = (SPEED_RANGE_KMH.shahed as [number, number])[0];
  return range ? Math.max(1500, Math.round((FLY_LOOP_MS * slowest) / range[0])) : FLY_LOOP_MS;
}

/** A region that shows the user and every reported target (or just the user's surroundings). */
function regionFor(center: Coords, points: Coords[]): Region {
  if (points.length === 0) return { ...center, latitudeDelta: 0.09, longitudeDelta: 0.09 };
  const lats = [center.latitude, ...points.map((p) => p.latitude)];
  const lons = [center.longitude, ...points.map((p) => p.longitude)];
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.09, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.09, (maxLon - minLon) * 1.5),
  };
}

const inRegion = (c: Coords, r: Region) =>
  Math.abs(c.latitude - r.latitude) <= r.latitudeDelta / 2 && Math.abs(c.longitude - r.longitude) <= r.longitudeDelta / 2;

interface ZoneLayerProps {
  zones: Zone[];
  activeIds: Set<string>;
  pinnedIds: Set<string>;
  region: Region;
}

/** District circles, plus names for the districts on screen (when zoomed in enough). */
const ZoneLayer = memo(function ZoneLayer({ zones, activeIds, pinnedIds, region }: ZoneLayerProps) {
  const districts = zones.filter((z) => z.kind === 'district');
  const labelled =
    region.latitudeDelta <= LABEL_MAX_SPAN
      ? districts.filter((z) => inRegion(z.center, region)).slice(0, LABEL_MAX_COUNT)
      : districts.filter((z) => activeIds.has(z.id) && inRegion(z.center, region));
  return (
    <>
      {districts.map((z) => {
        const active = activeIds.has(z.id);
        return (
          <Circle
            key={`c-${z.id}-${active ? 'a' : 'o'}`}
            center={z.center}
            radius={z.radiusKm * 1000}
            strokeWidth={active ? 2 : 1}
            strokeColor={active ? colors.danger : 'rgba(95,107,122,0.55)'}
            fillColor={active ? 'rgba(197,34,31,0.16)' : 'rgba(95,107,122,0.06)'}
          />
        );
      })}
      {labelled.map((z) => {
        const active = activeIds.has(z.id);
        const pinned = pinnedIds.has(z.id);
        return (
          <Marker
            key={`m-${z.id}-${active ? 'a' : 'o'}${pinned ? 'p' : ''}`}
            coordinate={z.center}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.label, active && styles.labelActive]}>
              <Text style={[styles.labelText, active && styles.labelTextActive]}>
                {pinned ? '📌 ' : ''}
                {zoneName(z)}
              </Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
});

interface Flight {
  id: string;
  track: ThreatTrack;
  origin: Coords | null;
  head: Coords;
  course: number | null;
}

/** Lines and destination labels: "🛵 2 · Липовець · 5 хв тому". Redrawn only when the targets change. */
const TargetLayer = memo(function TargetLayer({ flights }: { flights: Flight[] }) {
  return (
    <>
      {flights.map(({ id, track, origin, head, course }) => {
        const n = countLabel(track);
        const ago = timeAgo(track.message.date);
        const color = KIND_COLOR[track.kind];
        return [
          // Where it came from → where the post says it is heading.
          origin && <Polyline key={`l-${id}`} coordinates={[origin, head]} strokeColor={color} strokeWidth={track.kind === 'jet' ? 5 : 3} />,
          // Dashed: where it goes next if it keeps the same course.
          course !== null && (
            <Polyline
              key={`n-${id}`}
              coordinates={[head, destinationPoint(head, course, 20)]}
              strokeColor={color}
              strokeWidth={2}
              lineDashPattern={[8, 8]}
            />
          ),
          ...track.targets.map((p) => (
            // The time is part of the key: the label is a snapshot, so a new time needs a new marker.
            <Marker key={`t-${id}-${p.id}-${ago}`} coordinate={p.center} anchor={{ x: 0.5, y: 1.15 }} tracksViewChanges={false}>
              <View style={[styles.target, { backgroundColor: color }]}>
                <Text style={styles.targetKind}>
                  {KIND_ICON[track.kind]} {kindBadge(track.kind)}
                </Text>
                <Text style={styles.targetText}>
                  {n ? `${n} × ` : ''}
                  {zoneName(p)}
                </Text>
                <Text style={styles.targetAgo}>{ago}</Text>
              </View>
            </Marker>
          )),
        ];
      })}
    </>
  );
});

/**
 * The moving arrow: flies from where the target came from to where it is heading, again
 * and again. It shows direction, not the real position — the channel does not give one.
 * Only these few markers move; the rest of the map is not redrawn.
 */
function Flyers({ flights }: { flights: Flight[] }) {
  const moving = flights.filter((f) => f.origin && f.course !== null);
  const [elapsed, setElapsed] = useState(0);
  const any = moving.length > 0;
  useEffect(() => {
    if (!any) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), FLY_TICK_MS);
    return () => clearInterval(id);
  }, [any]);

  return (
    <>
      {moving.map((f) => {
        const from = f.origin as Coords;
        const loop = loopMs(f.track);
        const phase = (elapsed % loop) / loop;
        const jet = f.track.kind === 'jet';
        return (
          <Marker
            key={`f-${f.id}`}
            coordinate={{
              latitude: from.latitude + (f.head.latitude - from.latitude) * phase,
              longitude: from.longitude + (f.head.longitude - from.longitude) * phase,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            zIndex={5}
          >
            <View style={[styles.flyer, jet && styles.flyerJet, { backgroundColor: KIND_COLOR[f.track.kind] }]}>
              {/* "➤" points east, so turn it by (course − 90°). */}
              <Text style={[styles.flyerArrow, { transform: [{ rotate: `${(f.course as number) - 90}deg` }] }]}>
                {jet ? '➤➤' : '➤'}
              </Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

/** Map of the districts and of the targets the channel reports. View only. */
export function ZoneMap({ zones, coords, activeIds, pinnedIds, threats }: ZoneMapProps) {
  const flights = useMemo<Flight[]>(
    () =>
      threats
        .filter((tr) => tr.targets.length > 0)
        .slice(0, 12)
        .map((track) => ({
          id: `${track.key}-${track.message.id}`,
          track,
          origin: trackOrigin(track),
          head: track.targets[0].center,
          course: trackCourse(track),
        })),
    [threats],
  );
  // Computed once: the map must not jump while the user is looking at it.
  const [initial] = useState(() =>
    regionFor(coords ?? CITY, flights.flatMap((f) => f.track.targets.map((p) => p.center))),
  );
  const [region, setRegion] = useState(initial);

  return (
    <MapView
      style={styles.map}
      initialRegion={initial}
      onRegionChangeComplete={setRegion}
      showsUserLocation
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <ZoneLayer zones={zones} activeIds={activeIds} pinnedIds={pinnedIds} region={region} />
      <TargetLayer flights={flights} />
      <Flyers flights={flights} />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  label: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  labelActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  labelText: { fontSize: 11, fontWeight: '700', color: colors.text },
  labelTextActive: { color: colors.white },
  target: {
    backgroundColor: colors.danger,
    borderColor: colors.white,
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: 'center',
  },
  targetKind: { fontSize: 9, fontWeight: '900', color: colors.white, letterSpacing: 0.4 },
  targetText: { fontSize: 13, fontWeight: '900', color: colors.white },
  targetAgo: { fontSize: 10, fontWeight: '600', color: colors.white, opacity: 0.85 },
  flyer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.danger,
    borderColor: colors.white,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flyerJet: { width: 42, borderRadius: 15 },
  flyerArrow: { fontSize: 15, color: colors.white, fontWeight: '900' },
});
