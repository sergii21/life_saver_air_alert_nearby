/**
 * Phone-only alarm sound: a looping siren that plays even when the phone is in silent
 * mode, until stopNativeSiren() is called (or maxSeconds pass). Once started it keeps
 * playing if the app goes to the background or the screen locks, but the OS does not let
 * a suspended app start it: alerts found by the background task use the notification sound.
 * The browser preview has its own siren in webAlarm.ts.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

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
  try {
    p.pause();
    p.remove();
  } catch {
    // already released
  }
}
