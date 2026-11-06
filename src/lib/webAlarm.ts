/**
 * Browser-only alarm: a generated siren sound (Web Audio, no audio file needed) + a
 * desktop notification (Notification API). Browsers only allow sound after the user
 * has clicked something on the page, so `enableWebAlerts()` must be called from a click.
 * All functions are no-ops outside a browser.
 */

type AudioCtx = AudioContext;

let ctx: AudioCtx | null = null;
let sirenTimer: ReturnType<typeof setInterval> | null = null;
let sirenStop: ReturnType<typeof setTimeout> | null = null;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

export const webAlertsEnabled = () => ctx !== null && ctx.state === 'running';

/** Call from a click/tap handler. Unlocks sound and asks for notification permission. */
export async function enableWebAlerts(): Promise<{ sound: boolean; notifications: boolean }> {
  if (!isBrowser()) return { sound: false, notifications: false };
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (Ctor && !ctx) ctx = new Ctor();
  await ctx?.resume().catch(() => {});
  let notifications = false;
  if ('Notification' in window) {
    notifications =
      Notification.permission === 'granted' ||
      (Notification.permission !== 'denied' && (await Notification.requestPermission()) === 'granted');
  }
  // Short confirmation beep so the user knows the sound works.
  beep(880, 0.15);
  return { sound: webAlertsEnabled(), notifications };
}

function beep(freq: number, seconds: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + seconds);
}

/** One 1.2 s up-down siren sweep. */
function sweep() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, t0);
  osc.frequency.linearRampToValueAtTime(1300, t0 + 0.6);
  osc.frequency.linearRampToValueAtTime(600, t0 + 1.2);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.05);
  gain.gain.setValueAtTime(0.3, t0 + 1.1);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 1.2);
}

/** Siren that repeats until stopWebSiren() is called (or maxSeconds pass). */
export function startWebSiren(maxSeconds = 60) {
  if (!ctx) return;
  stopWebSiren();
  ctx.resume().catch(() => {});
  sweep();
  sirenTimer = setInterval(sweep, 1250);
  sirenStop = setTimeout(stopWebSiren, maxSeconds * 1000);
}

export function stopWebSiren() {
  if (sirenTimer) clearInterval(sirenTimer);
  if (sirenStop) clearTimeout(sirenStop);
  sirenTimer = null;
  sirenStop = null;
}

export function webNotify(title: string, body: string, url?: string) {
  if (!isBrowser() || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, requireInteraction: true, tag: 'alert-nearby' });
    n.onclick = () => {
      window.focus();
      if (url) window.open(url, '_blank');
      n.close();
    };
  } catch {
    // some browsers only allow notifications from a service worker — sound still plays
  }
}
