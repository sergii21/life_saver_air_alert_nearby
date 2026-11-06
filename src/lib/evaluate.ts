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

/** Zones whose keywords appear in the message. */
export function zonesMentioned(message: ChannelMessage, zones = CONFIG.ZONES): Zone[] {
  const text = normalize(message.text);
  return zones.filter((z) => containsAny(text, z.keywords));
}

export const isAllClear = (message: ChannelMessage, keywords = CONFIG.ALL_CLEAR_KEYWORDS) =>
  containsAny(normalize(message.text), keywords);

export const hitKey = (h: ZoneHit) => `${h.zone.id}|${h.message.channel}/${h.message.id}`;

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

  if (!coords) return { level: 'safe', hits: [], userZones: [] };
  const userZones = zonesForLocation(coords, zones, opts.zoneBufferKm ?? CONFIG.ZONE_BUFFER_KM);

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
  for (const zone of userZones) {
    const latest = recent.find((m) => containsAny(normalize(m.text), zone.keywords));
    if (!latest) continue;
    if (ts(latest) <= regionClearAt) continue;
    const text = normalize(latest.text);
    if (containsAny(text, allClear)) continue;
    if (now - ts(latest) > ttlMs) continue;
    if (requireThreat && !containsAny(text, threat)) continue;
    hits.push({ zone, message: latest });
  }

  let level: AlertLevel = 'safe';
  if (hits.some((h) => h.zone.kind === 'district')) level = 'danger';
  else if (hits.length > 0) level = 'caution';

  // Districts first, then newest.
  hits.sort((a, b) =>
    a.zone.kind !== b.zone.kind ? (a.zone.kind === 'district' ? -1 : 1) : ts(b.message) - ts(a.message),
  );
  return { level, hits, userZones };
}
