import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coords } from '../types';

const K = {
  coords: 'lastCoords',
  notified: 'notifiedKeys',
  acked: 'ackedKeys',
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
