/**
 * Reads WHAT is flying and WHERE from a channel post:
 *   "2 Реактивні Шахеди летять в напрямку Вінниччини зі сходу"  → 2 jet drones, region, from the east
 *   "1 Реактив повз Немирів на Рахни-Лісові"                     → 1 jet drone, past Немирів, towards Рахни-Лісові
 *   "▪️1 🛵 на Уланів; ▪️2 🛵 на Липовець"                        → two tracks
 *   "один або два в сектор Оратів - Липовець"                    → 1–2 targets, two places
 *
 * This is informational (the "Targets" list and the map). Whether the user is alerted is
 * still decided by evaluate.ts.
 */
import { CONFIG } from '../config';
import type { ChannelMessage, Coords } from '../types';
import { bearingDeg, destinationPoint, distanceKm } from './geo';
import { containsAny, keywordRegex, normalize } from './text';

/** Anything with a name, a position and keywords: alert zones and the extra oblast towns. */
export interface Place {
  id: string;
  name: string;
  nameEn?: string;
  center: Coords;
  keywords: string[];
}

export type ThreatKind = 'jet' | 'shahed' | 'missile' | 'ballistic' | 'kab' | 'unknown';
export type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface ThreatTrack {
  key: string;
  kind: ThreatKind;
  /** How many targets the post names; null if it does not say. */
  count: { min: number; max: number } | null;
  /** "декілька", "група" — more than one, exact number unknown. */
  several: boolean;
  /** Places the targets are heading to. Empty for a region-wide post. */
  targets: Place[];
  /** Places they pass on the way ("повз Немирів"). */
  via: Place[];
  /** Side they come from ("зі сходу"). */
  from: Compass | null;
  /** The post names the whole oblast as the destination. */
  region: boolean;
  message: ChannelMessage;
  /** The part of the post this track was read from. */
  text: string;
}

const L = "a-zа-яіїєґ'";
export const COMPASS_DEG: Record<Compass, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const COMPASS_ORDER: Compass[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Typical speeds, km/h — only for a rough "minutes of flight" estimate. */
export const SPEED_KMH: Record<ThreatKind, number | null> = {
  jet: 500,
  shahed: 170,
  missile: 800,
  kab: 900,
  ballistic: null,
  unknown: null,
};

/**
 * How long a track stays on the list without a newer post, minutes. Fast targets are far
 * away (or have struck) long before a slow drone is, so they expire sooner.
 */
export const TRACK_TTL_MIN: Record<ThreatKind, number> = {
  jet: 15,
  ballistic: 10,
  missile: 15,
  kab: 15,
  shahed: 30,
  unknown: 30,
};

const KINDS: [ThreatKind, string[]][] = [
  ['jet', ['реактив*']],
  ['ballistic', ['баліст*', 'кинджал*', 'іскандер*']],
  ['missile', ['ракет*', 'крилат*', 'калібр*']],
  ['kab', ['каб', 'каби', 'кабів', 'кабами', 'авіабомб*']],
  ['shahed', ['шахед*', 'шахід*', 'мопед*', 'бпла', 'дрон*', 'герань*', 'гербер*', '🛵']],
];

function detectKind(text: string): ThreatKind | null {
  for (const [kind, words] of KINDS) {
    if (words.some((w) => (w === '🛵' ? text.includes(w) : keywordRegex(w).test(text)))) return kind;
  }
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  один: 1, одна: 1, одного: 1, одну: 1, одне: 1, перший: 1,
  два: 2, дві: 2, двох: 2, двійка: 2, пара: 2, пару: 2,
  три: 3, трьох: 3, трійка: 3,
  чотири: 4, чотирьох: 4,
  "п'ять": 5, "п'яти": 5,
  шість: 6, сім: 7, вісім: 8, "дев'ять": 9, десять: 10,
};
const NUMBER_RE = new RegExp(
  `(?<![${L}\\d:.,]|[${L}]-)\\+?(\\d{1,2})(?!\\d|[:.,]\\d|-?[${L}])|(?<![${L}])(${Object.keys(NUMBER_WORDS).join('|')})(?![${L}])`,
  'gu',
);
const SEVERAL_RE = new RegExp(`(?<![${L}])(декілька|кілька|група|групи|групою|багато)(?![${L}])`, 'u');
const JOINER_RE = /^\s*(або|чи|-|–|—|,)\s*$/u;

/** "2", "один або два", "1-2" → {min,max}. Only the leading run of numbers is used. */
function parseCount(text: string): { min: number; max: number } | null {
  const tokens: { value: number; start: number; end: number }[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const value = m[1] ? Number(m[1]) : NUMBER_WORDS[m[2]];
    if (value > 0) tokens.push({ value, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  if (tokens.length === 0) return null;
  let min = tokens[0].value;
  let max = tokens[0].value;
  for (let i = 1; i < tokens.length; i++) {
    if (!JOINER_RE.test(text.slice(tokens[i - 1].end, tokens[i].start))) break;
    min = Math.min(min, tokens[i].value);
    max = Math.max(max, tokens[i].value);
  }
  return { min, max };
}

const FROM_WORDS: [string, Compass][] = [
  ['північного сходу', 'NE'], ['північного заходу', 'NW'], ['південного сходу', 'SE'], ['південного заходу', 'SW'],
  ['півночі', 'N'], ['півдня', 'S'], ['сходу', 'E'], ['заходу', 'W'],
  // Neighbouring regions, as seen from Vinnytsia oblast.
  ['київщини', 'NE'], ['житомирщини', 'N'], ['черкащини', 'E'], ['кіровоградщини', 'SE'], ['одещини', 'SE'],
  ['хмельниччини', 'W'], ['чернівеччини', 'SW'], ['молдови', 'S'], ["придністров'я", 'S'],
];
const FROM_RE = new RegExp(
  `(?<![${L}])(?:з|зі|із|від|з боку)\\s+(${FROM_WORDS.map(([w]) => w).join('|')})(?![${L}])`,
  'u',
);
const parseFrom = (text: string): Compass | null => {
  const m = FROM_RE.exec(text);
  return m ? (FROM_WORDS.find(([w]) => w === m[1])?.[1] ?? null) : null;
};

const VIA_RE = new RegExp(`(повз|через|біля|мина[${L}]*|оминув[${L}]*|пройш[${L}]*)[^${L}]*$`, 'u');
const MOVING_RE = /напрямк|курс|летить|летять|руха|прямує|заход|залет|загроз/u;
/** "на виліт", "вилітає з області" — leaving, no longer a threat here. */
const LEAVING_RE = /виліт|вилет|покинув|покидає/u;
// "вже не фіксується" — but not "іноді не фіксуються" (a warning that they fly low).
const GONE_RE = /(вже|більше|наразі) не фіксу|зник|збит|знищен|мінус|без загроз/u;
/** "Обстановка по Шахедах …" lists everything in the air, so it replaces older posts. */
/** "Залишився лише 1 Реактивний Шахед на Уланів" also states the whole picture. */
const SNAPSHOT_RE = /обстановк|залиши[вл]/u;
/** "По 1 Шахеду на Бар та Уланів" — that many to EACH place. */
const EACH_RE = new RegExp(`^[^${L}\\d]*по\\s+(\\d|один|одному|одній|два|двох|три)`, 'u');
const ORDINAL_WORDS = ['перш', 'друг', 'трет', 'четверт'];
const ORDINAL_RE = new RegExp(`(?<![${L}])(перш|друг|трет|один|одна|одного)|\\d`, 'u');

const LETTER_RE = new RegExp(`[${L}]`, 'u');

interface Found {
  place: Place;
  start: number;
  end: number;
}

/** Places named in the text, in reading order. A name inside a longer match is dropped. */
function findPlaces(text: string, places: Place[]): Found[] {
  const found: Found[] = [];
  for (const place of places) {
    let best: Found | null = null;
    for (const k of place.keywords) {
      const m = keywordRegex(k).exec(text);
      if (!m) continue;
      // Extend a prefix match to the end of the word.
      let end = m.index + m[0].length;
      while (end < text.length && LETTER_RE.test(text[end])) end++;
      if (!best || m.index < best.start) best = { place, start: m.index, end };
    }
    if (best) found.push(best);
  }
  return found
    .filter((a) => !found.some((b) => b !== a && b.start <= a.start && b.end >= a.end && b.end - b.start > a.end - a.start))
    .sort((a, b) => a.start - b.start);
}

/** Posts already read: a post is parsed once, however often the screen redraws. */
const parsed = new WeakMap<ChannelMessage, ThreatTrack[]>();

/**
 * Every track a post describes (one per line / list item). Never throws: a post that
 * cannot be read gives no tracks, and the alarm logic does not depend on it.
 */
export function parseThreats(message: ChannelMessage, places: Place[] = CONFIG.THREAT_PLACES): ThreatTrack[] {
  const cacheable = places === CONFIG.THREAT_PLACES;
  const hit = cacheable ? parsed.get(message) : undefined;
  if (hit) return hit;
  let tracks: ThreatTrack[] = [];
  try {
    tracks = readTracks(message, places);
  } catch (e) {
    console.warn('Could not read targets from a post', e);
  }
  if (cacheable) parsed.set(message, tracks);
  return tracks;
}

function readTracks(message: ChannelMessage, places: Place[]): ThreatTrack[] {
  const whole = normalize(message.text);
  const kindOfPost = detectKind(whole);
  const tracks: ThreatTrack[] = [];

  for (const raw of message.text.split(/[\n;▪•]+/u)) {
    const seg = normalize(raw);
    if (!seg || containsAny(seg, CONFIG.ALL_CLEAR_KEYWORDS) || GONE_RE.test(seg) || LEAVING_RE.test(seg)) continue;

    const found = findPlaces(seg, places);
    const region = found.length === 0 && containsAny(seg, CONFIG.REGION_KEYWORDS);
    const ownKind = detectKind(seg);
    if (found.length === 0 && !(region && ownKind && MOVING_RE.test(seg))) continue;

    const via: Place[] = [];
    const targets: Place[] = [];
    let prevEnd = 0;
    for (const f of found) {
      (VIA_RE.test(seg.slice(prevEnd, f.start)) ? via : targets).push(f.place);
      prevEnd = f.end;
    }
    // "повз Немирів" with no destination: Немирів is the best position we have.
    if (targets.length === 0 && via.length > 0) targets.push(...via.splice(0));

    const head = found.length > 0 ? seg.slice(0, found[0].start) : seg;
    const count = parseCount(head) ?? (found.length > 0 ? parseCount(seg.slice(found[found.length - 1].end)) : null);
    const kind = ownKind ?? kindOfPost ?? 'unknown';
    // "По 1 … на Бар та Уланів" is one track per place; otherwise the places share a track.
    const groups = EACH_RE.test(seg) && targets.length > 1 ? targets.map((p) => [p]) : [targets];
    for (const group of groups) {
      tracks.push({
        key: `${kind}|${group.map((p) => p.id).join(',')}|${via.map((p) => p.id).join(',')}|${region ? 'r' : ''}`,
        kind,
        count,
        several: !count && SEVERAL_RE.test(seg),
        targets: group,
        via,
        from: parseFrom(seg),
        region,
        message,
        text: raw.trim(),
      });
    }
  }
  return tracks;
}

const ts = (m: ChannelMessage) => (m.date ? Date.parse(m.date) : NaN);

/**
 * Tracks that are still current: newer than the TTL and not cancelled by an all-clear
 * ("Чисто на Вінниччині", "Відбій", "Локаційно вже не фіксується"). Newest first.
 */
export function activeThreats(
  messages: ChannelMessage[],
  now = Date.now(),
  places: Place[] = CONFIG.THREAT_PLACES,
  ttlMinutes = CONFIG.ALERT_TTL_MINUTES,
): ThreatTrack[] {
  const recent = messages
    .filter((m) => {
      const t = ts(m);
      return !Number.isNaN(t) && now - t <= ttlMinutes * 60_000 && t - now < 5 * 60_000;
    })
    .sort((a, b) => ts(b) - ts(a));

  let clearedAt = -Infinity;
  const clearedPlace = new Map<string, number>();
  /** "Перший / другий вже не фіксується": which one (0 = first reported) and when. */
  const goneByOrder: { order: number; at: number }[] = [];
  for (const m of recent) {
    const text = normalize(m.text);
    const clear = containsAny(text, CONFIG.ALL_CLEAR_KEYWORDS);
    const isGone = GONE_RE.test(text);
    if (isGone && !clear && ORDINAL_RE.test(text)) {
      // Cancels one of several, not the whole list. "Мінус один" does not say which: keep all.
      const order = ORDINAL_WORDS.findIndex((w) => text.includes(w));
      if (order >= 0) goneByOrder.push({ order, at: ts(m) });
      continue;
    }
    const gone = isGone;
    if (!clear && !gone) continue;
    const named = findPlaces(text, places);
    if (named.length === 0 || containsAny(text, CONFIG.REGION_KEYWORDS)) clearedAt = Math.max(clearedAt, ts(m));
    else for (const f of named) clearedPlace.set(f.place.id, Math.max(clearedPlace.get(f.place.id) ?? -Infinity, ts(m)));
  }

  const snapshot = recent.find((m) => SNAPSHOT_RE.test(normalize(m.text)) && parseThreats(m, places).length > 0);
  const snapshotAt = snapshot ? ts(snapshot) : -Infinity;

  const seen = new Set<string>();
  /** A place belongs to the newest post that names it: newer news replaces older. */
  const placeTakenAt = new Map<string, number>();
  const out: ThreatTrack[] = [];
  for (const m of recent) {
    if (ts(m) <= clearedAt || ts(m) < snapshotAt) continue;
    const tracks = parseThreats(m, places);
    for (const track of tracks) {
      if (now - ts(m) > TRACK_TTL_MIN[track.kind] * 60_000) continue;
      const targets = track.targets.filter(
        (p) => ts(m) > (clearedPlace.get(p.id) ?? -Infinity) && (placeTakenAt.get(p.id) ?? ts(m)) === ts(m),
      );
      if (!track.region && targets.length === 0) continue;
      if (seen.has(track.key)) continue;
      seen.add(track.key);
      out.push({ ...track, targets });
    }
    for (const track of tracks) for (const p of track.targets) if (!placeTakenAt.has(p.id)) placeTakenAt.set(p.id, ts(m));
  }
  // "Перший вже не фіксується" removes the earliest track reported before that post.
  for (const { order, at } of goneByOrder.sort((a, b) => a.at - b.at)) {
    const earlier = out.filter((t) => ts(t.message) < at).sort((a, b) => ts(a.message) - ts(b.message));
    const gone = earlier[order];
    if (gone) out.splice(out.indexOf(gone), 1);
  }
  return out;
}

/** The track of a post that concerns this place (or the post's first track). */
export function trackFor(message: ChannelMessage, placeId: string, places: Place[] = CONFIG.THREAT_PLACES): ThreatTrack | null {
  const tracks = parseThreats(message, places);
  return tracks.find((t) => [...t.targets, ...t.via].some((p) => p.id === placeId)) ?? tracks[0] ?? null;
}

export const compassOf = (bearing: number): Compass => COMPASS_ORDER[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];

/** Direction of travel in degrees, when the post gives enough to tell. */
export function trackCourse(track: ThreatTrack): number | null {
  const target = track.targets[0];
  const last = track.via[track.via.length - 1];
  if (target && last) return bearingDeg(last.center, target.center);
  return track.from ? (COMPASS_DEG[track.from] + 180) % 360 : null;
}

/** Where to start the arrow on the map: the last place passed, or a point on the "from" side. */
export function trackOrigin(track: ThreatTrack, km = 25): Coords | null {
  const target = track.targets[0];
  if (!target) return null;
  const last = track.via[track.via.length - 1];
  if (last) return last.center;
  return track.from ? destinationPoint(target.center, COMPASS_DEG[track.from], km) : null;
}

export interface TrackRelation {
  /** The named place closest to the user. */
  place: Place;
  km: number;
  /** Side of the user the place is on. */
  side: Compass;
  /** Rough flight time from that place to the user, minutes. */
  minutes: number | null;
  /** The place is next to the user, or the course from it points at the user. */
  towardsUser: boolean;
}

export function relationToUser(track: ThreatTrack, coords: Coords | null): TrackRelation | null {
  if (!coords || track.targets.length === 0) return null;
  const place = track.targets.reduce((a, b) => (distanceKm(coords, a.center) <= distanceKm(coords, b.center) ? a : b));
  const km = distanceKm(coords, place.center);
  const speed = SPEED_KMH[track.kind];
  const course = trackCourse(track);
  let towardsUser = km <= 5;
  if (!towardsUser && course !== null && km <= 80) {
    const diff = Math.abs(((bearingDeg(place.center, coords) - course + 540) % 360) - 180);
    towardsUser = diff <= 25;
  }
  return {
    place,
    km,
    side: compassOf(bearingDeg(coords, place.center)),
    minutes: speed ? Math.max(1, Math.round((km / speed) * 60)) : null,
    towardsUser,
  };
}
