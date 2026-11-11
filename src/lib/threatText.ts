/**
 * Turns a parsed track / alert into words: list rows, map labels, advice and the
 * sentence the voice says.
 */
import { CONFIG } from '../config';
import { t, zoneName, type StringKey } from '../i18n';
import type { Coords, ZoneHit } from '../types';
import { isDangerHit } from './evaluate';
import type { MotionMode } from './motion';
import { relationToUser, trackFor, type ThreatKind, type ThreatTrack } from './threat';

const KIND_KEY: Record<ThreatKind, StringKey> = {
  jet: 'kindJet',
  shahed: 'kindShahed',
  missile: 'kindMissile',
  ballistic: 'kindBallistic',
  kab: 'kindKab',
  unknown: 'kindUnknown',
};

export const KIND_ICON: Record<ThreatKind, string> = {
  jet: '🛵',
  shahed: '🛵',
  missile: '🚀',
  ballistic: '☄️',
  kab: '💣',
  unknown: '⚠️',
};

/** "2", "1–2", "кілька" or "" when the post gives no number. */
export function countLabel(track: ThreatTrack): string {
  if (track.count) return track.count.min === track.count.max ? String(track.count.min) : `${track.count.min}–${track.count.max}`;
  return track.several ? t('several') : '';
}

/** "2 × реактивний Шахед" */
export function threatLabel(track: ThreatTrack): string {
  const n = countLabel(track);
  return (n ? `${n} × ` : '') + t(KIND_KEY[track.kind]);
}

/** "Липовець / Іллінці (повз Немирів)" */
export function threatWhere(track: ThreatTrack): string {
  const to = track.region ? t('targetsRegion') : track.targets.map(zoneName).join(' / ');
  return to + (track.via.length > 0 ? ` (${t('past')} ${track.via.map(zoneName).join(', ')})` : '');
}

/** "2 × реактивний Шахед → Липовець, зі сходу" */
export function threatLine(track: ThreatTrack): string {
  return `${threatLabel(track)} → ${threatWhere(track)}${track.from ? `, ${t(`from${track.from}` as StringKey)}` : ''}`;
}

/** "38 км на схід від вас · ~5 хв льоту" */
export function relationLine(track: ThreatTrack, coords: Coords | null): string {
  const rel = relationToUser(track, coords);
  if (!rel) return '';
  const km = rel.km < 10 ? rel.km.toFixed(1) : String(Math.round(rel.km));
  const where = t('kmSide', { km, side: t(`side${rel.side}` as StringKey) });
  return rel.minutes ? `${where} · ${t('flightMin', { n: rel.minutes })}` : where;
}

/** Three lines of advice: what to do given how you move, what the threat is, and a reminder. */
export function adviceFor(hit: ZoneHit, mode: MotionMode): string[] {
  const kind = trackFor(hit.message, hit.zone.id)?.kind ?? 'unknown';
  const zone = zoneName(hit.zone);
  const first: StringKey = hit.ahead
    ? 'adviceAhead'
    : mode === 'car'
      ? 'adviceCar'
      : mode === 'bike'
        ? 'adviceBike'
        : mode === 'walk'
          ? 'adviceWalk'
          : 'adviceStill';
  const second: StringKey =
    kind === 'ballistic'
      ? 'adviceBallistic'
      : kind === 'jet'
        ? 'adviceJet'
        : kind === 'shahed'
          ? 'adviceShahed'
          : kind === 'missile' || kind === 'kab'
            ? 'adviceMissile'
            : 'advice2';
  return [t(first, { zone, km: CONFIG.ESCAPE_DISTANCE_KM }), t(second), t('advice3')];
}

/** What the voice says: where, how many of what, and the first thing to do. */
export function spokenAlert(hit: ZoneHit, mode: MotionMode, isTest = false): string {
  const zone = zoneName(hit.zone);
  const parts = [t(hit.ahead ? 'spokenAhead' : isDangerHit(hit) ? 'spokenDanger' : 'spokenCaution', { zone })];
  if (isTest) parts.push(t('spokenTest'));
  const track = isTest ? null : trackFor(hit.message, hit.zone.id);
  if (track) {
    if (track.count) {
      const { min, max } = track.count;
      parts.push(min === max ? t('spokenCount', { n: min }) : t('spokenRange', { a: min, b: max }));
    }
    if (track.kind !== 'unknown') parts.push(`${t(KIND_KEY[track.kind])}.`);
  }
  parts.push(adviceFor(hit, mode)[0]);
  return parts.join(' ');
}
