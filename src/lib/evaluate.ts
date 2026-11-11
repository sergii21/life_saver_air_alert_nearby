import { CONFIG } from '../config';
import type { AlertLevel, AlertState, ChannelMessage, Coords, Zone, ZoneHit } from '../types';
import { distanceKm } from './geo';
import { containsAny, normalize } from './text';

export interface EvaluateOptions {
  zones?: Zone[];
  now?: number;
  alertTtlMinutes?: number;
  maxMessageAgeMinutes?: number;
  zoneBufferKm?: number;
  /** Zones the user added by hand in Settings: always treated as the user's zones. */
  pinnedZoneIds?: string[];
  /** Zones on the user's course (see motion.ts): a threat there is reported as "danger ahead". */
  aheadZoneIds?: string[];
  requireThreatKeyword?: boolean;
  allClearKeywords?: string[];
  regionKeywords?: string[];
  threatKeywords?: string[];
}

const ts = (m: ChannelMessage) => (m.date ? Date.parse(m.date) : NaN);

/** Zones whose circle (plus buffer) contains the user. Closest first. */
export function zonesForLocation(coords: Coords, zones = CONFIG.ZONES, bufferKm = CONFIG.ZONE_BUFFER_KM): Zone[] {
  return zones
    .map((z) => ({ z, d: distanceKm(coords, z.center) }))
    .filter(({ z, d }) => d <= z.radiusKm + bufferKm)
    .sort((a, b) => a.d - b.d)
    .map(({ z }) => z);
}

/**
 * All zones that count as "the user's": the ones around the current position (closest
 * first) followed by the ones pinned by hand in Settings.
 */
export function userZonesFor(
  coords: Coords | null,
  zones = CONFIG.ZONES,
  bufferKm = CONFIG.ZONE_BUFFER_KM,
  pinnedIds: string[] = [],
): Zone[] {
  const near = coords ? zonesForLocation(coords, zones, bufferKm) : [];
  const seen = new Set(near.map((z) => z.id));
  return [...near, ...zones.filter((z) => pinnedIds.includes(z.id) && !seen.has(z.id))];
}

/** Zones whose keywords appear in the message. */
export function zonesMentioned(message: ChannelMessage, zones = CONFIG.ZONES): Zone[] {
  const text = normalize(message.text);
  return zones.filter((z) => containsAny(text, z.keywords));
}

export const isAllClear = (message: ChannelMessage, keywords = CONFIG.ALL_CLEAR_KEYWORDS) =>
  containsAny(normalize(message.text), keywords);

/** An "ahead" hit has its own key, so entering the zone later still raises the full alarm. */
export const hitKey = (h: ZoneHit) => `${h.ahead ? 'ahead:' : ''}${h.zone.id}|${h.message.channel}/${h.message.id}`;

/** DANGER = a threat in a district the user is in. Ahead and whole-city hits are CAUTION. */
export const isDangerHit = (h: ZoneHit) => !h.ahead && h.zone.kind === 'district';

/**
 * Core decision: given the latest channel messages and the user's location,
 * is the user's district/area currently named in an active threat message?
 *
 * For every zone the user is in, the NEWEST message naming that zone decides:
 *   - all-clear words → zone is clear
 *   - otherwise, if younger than ALERT_TTL_MINUTES → active threat (hit)
 */
export function evaluate(messages: ChannelMessage[], coords: Coords | null, opts: EvaluateOptions = {}): AlertState {
  const zones = opts.zones ?? CONFIG.ZONES;
  const now = opts.now ?? Date.now();
  const ttlMs = (opts.alertTtlMinutes ?? CONFIG.ALERT_TTL_MINUTES) * 60_000;
  const maxAgeMs = (opts.maxMessageAgeMinutes ?? CONFIG.MAX_MESSAGE_AGE_MINUTES) * 60_000;
  const requireThreat = opts.requireThreatKeyword ?? CONFIG.REQUIRE_THREAT_KEYWORD;
  const allClear = opts.allClearKeywords ?? CONFIG.ALL_CLEAR_KEYWORDS;
  const threat = opts.threatKeywords ?? CONFIG.THREAT_KEYWORDS;
  const region = opts.regionKeywords ?? CONFIG.REGION_KEYWORDS;

  const userZones = userZonesFor(coords, zones, opts.zoneBufferKm ?? CONFIG.ZONE_BUFFER_KM, opts.pinnedZoneIds);
  const aheadIds = opts.aheadZoneIds ?? [];
  const aheadZones = zones.filter((z) => aheadIds.includes(z.id) && !userZones.some((u) => u.id === z.id));
  if (userZones.length === 0 && aheadZones.length === 0) return { level: 'safe', hits: [], userZones };

  const recent = messages
    .filter((m) => {
      const t = ts(m);
      return !Number.isNaN(t) && now - t <= maxAgeMs && t - now < 5 * 60_000;
    })
    .sort((a, b) => ts(b) - ts(a));

  // Newest region-wide all-clear ("Чисто на Вінниччині", or "Відбій" naming no zone).
  const regionClear = recent.find((m) => {
    const text = normalize(m.text);
    return containsAny(text, allClear) && (containsAny(text, region) || !zones.some((z) => containsAny(text, z.keywords)));
  });
  const regionClearAt = regionClear ? ts(regionClear) : -Infinity;

  const hits: ZoneHit[] = [];
  for (const zone of [...userZones, ...aheadZones]) {
    const latest = recent.find((m) => containsAny(normalize(m.text), zone.keywords));
    if (!latest) continue;
    if (ts(latest) <= regionClearAt) continue;
    const text = normalize(latest.text);
    if (containsAny(text, allClear)) continue;
    if (now - ts(latest) > ttlMs) continue;
    if (requireThreat && !containsAny(text, threat)) continue;
    hits.push(aheadZones.includes(zone) ? { zone, message: latest, ahead: true } : { zone, message: latest });
  }

  let level: AlertLevel = 'safe';
  if (hits.some(isDangerHit)) level = 'danger';
  else if (hits.length > 0) level = 'caution';

  // Districts first, then newest.
  hits.sort((a, b) =>
    isDangerHit(a) !== isDangerHit(b) ? (isDangerHit(a) ? -1 : 1) : ts(b.message) - ts(a.message),
  );
  return { level, hits, userZones };
}
