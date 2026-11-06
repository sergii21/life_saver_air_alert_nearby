import { Linking, Platform } from 'react-native';
import type { Coords } from '../types';

const ll = (c: Coords) => `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`;

export function walkingRouteUrl(to: Coords): string {
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?daddr=${ll(to)}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${ll(to)}&travelmode=walking`;
}

export function shelterSearchUrl(near: Coords): string {
  const q = encodeURIComponent('укриття');
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?q=${q}&sll=${ll(near)}&z=15`
    : `https://www.google.com/maps/search/${q}/@${ll(near)},15z`;
}

export const phoneUrl = (phone: string) => `tel:${phone}`;

export async function open(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (e) {
    console.warn('Cannot open', url, e);
  }
}
