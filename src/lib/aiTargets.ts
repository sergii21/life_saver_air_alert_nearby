/**
 * Client of the AI targets service (server/): Claude reads the channel's posts and decides
 * which targets are still active — it understands wording the app's rules do not.
 *
 * It is an extra. The alarm for the user's own district never depends on it, and whenever
 * the service is unreachable, slow, or has not seen the newest post yet, the app shows the
 * targets found by its own rules (threat.ts) instead.
 */
import { CONFIG } from '../config';
import type { ChannelMessage } from '../types';
import { COMPASS_DEG, placeByName, TRACK_TTL_MIN, type Compass, type Place, type ThreatKind, type ThreatTrack } from './threat';

interface AiTarget {
  post_id: number;
  kind: ThreatKind;
  count_min: number;
  count_max: number;
  several: boolean;
  to: string[];
  via: string[];
  from: string;
  region: boolean;
}

export interface AiResponse {
  ok: boolean;
  latestPostId?: number;
  targets?: AiTarget[];
}

export interface AiTargets {
  /** Newest post the service had read. */
  latestPostId: number;
  tracks: ThreatTrack[];
}

const newestId = (messages: ChannelMessage[]) => messages.reduce((max, m) => Math.max(max, m.id), 0);

/**
 * Turns the service's answer into tracks. Null when the answer cannot be used: not ok,
 * malformed, or older than the posts the app already has.
 */
export function tracksFromAi(
  res: AiResponse | null,
  messages: ChannelMessage[],
  places: Place[] = CONFIG.THREAT_PLACES,
): AiTargets | null {
  if (!res || res.ok !== true || !Array.isArray(res.targets) || typeof res.latestPostId !== 'number') return null;
  if (res.latestPostId < newestId(messages)) return null;

  const tracks: ThreatTrack[] = [];
  for (const t of res.targets) {
    const message = messages.find((m) => m.id === t.post_id);
    if (!message || !(t.kind in TRACK_TTL_MIN)) continue;
    const find = (list: unknown) =>
      (Array.isArray(list) ? list : [])
        .map((name) => (typeof name === 'string' ? placeByName(name, places) : null))
        .filter((p): p is Place => p !== null);
    const targets = find(t.to);
    const via = find(t.via);
    // A place the app cannot put on the map is not shown, rather than shown wrongly.
    if (targets.length === 0 && !t.region) continue;
    const min = Number.isInteger(t.count_min) && t.count_min > 0 ? t.count_min : 0;
    const max = Number.isInteger(t.count_max) && t.count_max >= min ? t.count_max : min;
    tracks.push({
      key: `ai|${t.kind}|${targets.map((p) => p.id).join(',')}|${via.map((p) => p.id).join(',')}|${t.region ? 'r' : ''}`,
      kind: t.kind,
      count: max > 0 ? { min: min || max, max } : null,
      several: max === 0 && t.several === true,
      targets,
      via,
      from: t.from in COMPASS_DEG ? (t.from as Compass) : null,
      region: targets.length === 0 && t.region === true,
      message,
      text: message.text,
    });
  }
  return { latestPostId: res.latestPostId, tracks };
}

/** Asks the service. Never throws and never takes longer than `timeoutMs`; null = use the rules. */
export async function fetchAiTargets(baseUrl: string, messages: ChannelMessage[], timeoutMs = 8000): Promise<AiTargets | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/targets`, { signal: controller.signal });
    if (!res.ok) return null;
    return tracksFromAi((await res.json()) as AiResponse, messages);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The AI's tracks if they still describe the current posts: the service has seen the newest
 * post, and each track is younger than the time limit for its kind. Otherwise null.
 */
export function stillFresh(ai: AiTargets | null, messages: ChannelMessage[], now = Date.now()): ThreatTrack[] | null {
  if (!ai || ai.latestPostId < newestId(messages)) return null;
  return ai.tracks.filter((t) => {
    const at = t.message.date ? Date.parse(t.message.date) : NaN;
    return !Number.isNaN(at) && now - at <= TRACK_TTL_MIN[t.kind] * 60_000;
  });
}
