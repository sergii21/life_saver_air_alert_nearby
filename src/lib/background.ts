/**
 * Background check. Must be imported at app start (see index.ts) so the task is
 * defined before the OS tries to run it.
 */
import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { CONFIG } from '../config';
import type { Coords } from '../types';
import { runCheck } from './monitor';
import { loadCoords, saveCoords } from './storage';

export const BACKGROUND_TASK = 'alert-nearby-background-check';

async function backgroundCoords(): Promise<Coords | null> {
  // Uses the last position the OS already knows (no background-location permission
  // needed); falls back to the position saved while the app was open.
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60_000 });
    if (last) {
      await saveCoords(last.coords);
      return last.coords;
    }
  } catch {
    // ignore — permission not available in background on this OS
  }
  return loadCoords();
}

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    await runCheck(await backgroundCoords(), { notify: true });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundCheck(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, {
      minimumInterval: Math.max(15, CONFIG.BACKGROUND_INTERVAL_MINUTES),
    });
  } catch (e) {
    console.warn('Background task registration failed', e);
  }
}
