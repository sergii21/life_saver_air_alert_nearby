import type { Coords } from '../types';

const R = 6371; // Earth radius, km
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in km. */
export function distanceKm(a: Coords, b: Coords): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees 0..360 (0 = north). */
export function bearingDeg(a: Coords, b: Coords): number {
  const φ1 = rad(a.latitude);
  const φ2 = rad(b.latitude);
  const Δλ = rad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Point reached by travelling `km` from `from` on `bearing` degrees. */
export function destinationPoint(from: Coords, bearing: number, km: number): Coords {
  const δ = km / R;
  const θ = rad(bearing);
  const φ1 = rad(from.latitude);
  const λ1 = rad(from.longitude);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { latitude: deg(φ2), longitude: ((deg(λ2) + 540) % 360) - 180 };
}

/**
 * A point `km` away from the danger zone, continuing in the direction user→away-from-center.
 * If the user is right at the center, heads away from the city center instead (fallback north).
 */
export function escapePoint(user: Coords, dangerCenter: Coords, km: number, cityCenter?: Coords): Coords {
  let bearing: number;
  if (distanceKm(dangerCenter, user) > 0.05) bearing = bearingDeg(dangerCenter, user);
  else if (cityCenter && distanceKm(cityCenter, user) > 0.05) bearing = bearingDeg(cityCenter, user);
  else bearing = 0;
  return destinationPoint(user, bearing, km);
}
