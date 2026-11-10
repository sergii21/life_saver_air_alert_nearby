import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { CONFIG } from '../config';
import { zoneName } from '../i18n';
import { colors } from '../theme';
import type { ZoneMapProps } from './ZoneMap';

const CITY = CONFIG.ZONES.find((z) => z.kind === 'area')?.center ?? { latitude: 49.2331, longitude: 28.4682 };

/** Map of every district circle with its name. Red = alerted now, tap a name to pin / unpin. */
export function ZoneMap({ zones, coords, activeIds, pinnedIds, onToggle }: ZoneMapProps) {
  const center = coords ?? CITY;
  return (
    <MapView
      style={styles.map}
      initialRegion={{ ...center, latitudeDelta: 0.09, longitudeDelta: 0.09 }}
      showsUserLocation
      showsPointsOfInterests={false}
      toolbarEnabled={false}
    >
      {zones
        .filter((z) => z.kind === 'district')
        .map((z) => {
          const active = activeIds.has(z.id);
          const pinned = pinnedIds.has(z.id);
          const state = active ? (pinned ? 'p' : 'a') : 'o';
          return [
            <Circle
              key={`c-${z.id}-${state}`}
              center={z.center}
              radius={z.radiusKm * 1000}
              strokeWidth={active ? 2 : 1}
              strokeColor={active ? colors.danger : 'rgba(95,107,122,0.55)'}
              fillColor={active ? 'rgba(197,34,31,0.16)' : 'rgba(95,107,122,0.06)'}
            />,
            <Marker
              key={`m-${z.id}-${state}`}
              coordinate={z.center}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => onToggle(z.id)}
            >
              <View style={[styles.label, active && styles.labelActive]}>
                <Text style={[styles.labelText, active && styles.labelTextActive]}>
                  {pinned ? '📌 ' : ''}
                  {zoneName(z)}
                </Text>
              </View>
            </Marker>,
          ];
        })}
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
});
