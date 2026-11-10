/**
 * Phone-only alarm sound: a looping siren that plays even when the phone is in silent
 * mode, until stopNativeSiren() is called (or maxSeconds pass). Once started it keeps
 * playing if the app goes to the background or the screen locks.
 *
 * Keep-alive (iOS, see CONFIG.BACKGROUND_KEEP_ALIVE): iOS suspends an app a few seconds
 * after it leaves the screen, and a suspended app can neither check the channels nor start
 * a sound. Playing an inaudible loop keeps the app running, so the channel check continues
 * and the siren can start on a locked, silenced phone.
 *
 * The browser preview has its own siren in webAlarm.ts.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
let keepAlive: AudioPlayer | null = null;

const release = (p: AudioPlayer | null) => {
  if (!p) return;
  try {
    p.pause();
    p.remove();
  } catch {
    // already released
  }
};

/** Quiet background session: mixes with the user's music instead of stopping it. */
const quietMode = () =>
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' });

export async function startNativeSiren(maxSeconds = 60): Promise<void> {
  stopNativeSiren();
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
    const p = createAudioPlayer(require('../../assets/siren.wav'));
    p.loop = true;
    p.volume = 1;
    player = p;
    p.play();
    stopTimer = setTimeout(stopNativeSiren, maxSeconds * 1000);
  } catch {
    // No sound is not fatal: vibration and the notification still fire.
  }
}

export function stopNativeSiren(): void {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = null;
  const p = player;
  player = null;
  if (!p) return;
  release(p);
  if (keepAlive) quietMode().catch(() => {});
}

export const isSirenPlaying = () => player !== null;

/** Start the inaudible loop that keeps the app running in the background. Idempotent. */
export async function startKeepAlive(): Promise<void> {
  if (keepAlive) return;
  try {
    if (!player) await quietMode();
    const p = createAudioPlayer(require('../../assets/silence.wav'));
    p.loop = true;
    keepAlive = p;
    p.play();
  } catch {
    // Without it the app still works on screen and through the OS background task.
  }
}

export function stopKeepAlive(): void {
  release(keepAlive);
  keepAlive = null;
}
