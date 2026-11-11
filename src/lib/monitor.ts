import { configuredChannels } from '../config';
import type { AlertState, ChannelMessage, Coords, ZoneHit } from '../types';
import { evaluate, hitKey } from './evaluate';
import { notifyHit } from './notifications';
import { addNotified, loadNotified, loadSettings } from './storage';
import { fetchAll } from './telegram';

export interface CheckResult {
  messages: ChannelMessage[];
  errors: string[];
  state: AlertState;
  /** Hits that were not seen in any previous check (foreground or background). */
  newHits: ZoneHit[];
  checkedAt: number;
}

/**
 * One full check: read channels → match against location → (optionally) notify.
 * Shared by the foreground poller and the background task.
 */
export async function runCheck(coords: Coords | null, opts: { notify: boolean; notifySound?: boolean; aheadZoneIds?: string[] }): Promise<CheckResult> {
  const { messages, errors } = await fetchAll(configuredChannels());
  const settings = await loadSettings();
  const state = evaluate(messages, coords, {
    zoneBufferKm: settings.nearbyKm,
    pinnedZoneIds: settings.pinned,
    aheadZoneIds: opts.aheadZoneIds,
  });

  const notified = await loadNotified();
  const newHits = state.hits.filter((h) => !notified.has(hitKey(h)));
  if (newHits.length > 0) {
    if (opts.notify) {
      // One notification per check is enough — the most severe hit first.
      await notifyHit(newHits[0], false, opts.notifySound ?? true).catch(() => {});
    }
    await addNotified(newHits.map(hitKey));
  }
  return { messages, errors, state, newHits, checkedAt: Date.now() };
}
