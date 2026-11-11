import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';
import type { Coords } from '../types';

const K = {
  coords: 'lastCoords',
  notified: 'notifiedKeys',
  acked: 'ackedKeys',
  settings: 'settings',
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const writeJson = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

export const saveCoords = (c: Coords) => writeJson(K.coords, { latitude: c.latitude, longitude: c.longitude, at: Date.now() });
export const loadCoords = () => readJson<(Coords & { at: number }) | null>(K.coords, null);

async function addKeys(key: string, keys: string[]) {
  if (keys.length === 0) return;
  const cur = await readJson<string[]>(key, []);
  const next = [...keys, ...cur.filter((k) => !keys.includes(k))].slice(0, 300);
  await writeJson(key, next);
}

export const loadNotified = async () => new Set(await readJson<string[]>(K.notified, []));
export const addNotified = (keys: string[]) => addKeys(K.notified, keys);
export const loadAcked = async () => new Set(await readJson<string[]>(K.acked, []));
export const addAcked = (keys: string[]) => addKeys(K.acked, keys);

/** User choices made on the Settings screen. Stored on the phone only. */
export interface Settings {
  /** Also alert for districts within this distance of the user, km. */
  nearbyKm: number;
  /** Zone ids added by hand: alerted wherever the user is. */
  pinned: string[];
  /** UI and voice language; 'auto' follows the phone. */
  language: 'auto' | 'uk' | 'en';
  /** Speak the advice aloud during an alarm. */
  voice: boolean;
  /** Chosen system voice; null = the phone's default for the language. */
  voiceId: string | null;
}

export const defaultSettings = (): Settings => ({
  nearbyKm: CONFIG.ZONE_BUFFER_KM,
  pinned: [],
  language: 'auto',
  voice: true,
  voiceId: null,
});

export async function loadSettings(): Promise<Settings> {
  const s = await readJson<Partial<Settings>>(K.settings, {});
  const d = defaultSettings();
  return {
    nearbyKm: typeof s.nearbyKm === 'number' && s.nearbyKm >= 0 ? s.nearbyKm : d.nearbyKm,
    pinned: Array.isArray(s.pinned) ? s.pinned.filter((x) => typeof x === 'string') : d.pinned,
    language: s.language === 'uk' || s.language === 'en' ? s.language : d.language,
    voice: typeof s.voice === 'boolean' ? s.voice : d.voice,
    voiceId: typeof s.voiceId === 'string' ? s.voiceId : d.voiceId,
  };
}

export const saveSettings = (s: Settings) => writeJson(K.settings, s);
