/**
 * Turns a parsed track / alert into words: list rows, map labels, advice and the
 * sentence the voice says.
 */
import { CONFIG } from '../config';
import { t, zoneName, type StringKey } from '../i18n';
import type { Coords, ZoneHit } from '../types';
import { isDangerHit } from './evaluate';
import type { MotionMode } from './motion';
import { relationToUser, SPEED_RANGE_KMH, trackFor, type ThreatKind, type ThreatTrack } from './threat';

const KIND_KEY: Record<ThreatKind, StringKey> = {
  jet: 'kindJet',
  shahed: 'kindShahed',
  missile: 'kindMissile',
  ballistic: 'kindBallistic',
  kab: 'kindKab',
  unknown: 'kindUnknown',
};

/** Each kind has its own colour everywhere: list, map label, line and flying arrow. */
export const KIND_COLOR: Record<ThreatKind, string> = {
  jet: '#6A1B9A', // purple — the fast one
  shahed: '#C5221F', // red
  missile: '#B06000', // amber
  ballistic: '#1B1F24', // black
  kab: '#1B1F24',
  unknown: '#5F6B7A',
};

/** "370–600 км/год", or "" when no speed estimate is given for the kind. */
export function speedLabel(kind: ThreatKind): string {
  const range = SPEED_RANGE_KMH[kind];
  return range ? t('speedRange', { a: range[0], b: range[1] }) : '';
}

/** "РЕАКТИВНИЙ ШАХЕД" — the kind in capitals, for badges. */
export const kindBadge = (kind: ThreatKind) => t(KIND_KEY[kind]).toUpperCase();

export const KIND_ICON: Record<ThreatKind, string> = {
  jet: '⚡',
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
  if (!rel.minutes) return where;
  const { min, max } = rel.minutes;
  return `${where} · ${min === max ? t('flightMin', { n: min }) : t('flightRange', { a: min, b: max })}`;
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

/** The short warning for a whole-city mention: "Увага, Вінниця." — about a second of speech. */
export function spokenWarning(hit: ZoneHit, isTest = false): string {
  return t('spokenShort', { zone: zoneName(hit.zone) }) + (isTest ? ` ${t('spokenShortTest')}` : '');
}
