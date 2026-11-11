/**
 * How the user is moving (from GPS speed) and which districts lie on their course.
 * Used to warn about danger AHEAD and to pick advice that fits (car / bicycle / on foot).
 */
import { CONFIG } from '../config';
import type { Coords, Zone } from '../types';
import { zonesForLocation } from './evaluate';
import { destinationPoint } from './geo';

export type MotionMode = 'still' | 'walk' | 'bike' | 'car';

export interface Motion {
  /** Metres per second; null if the phone does not know. */
  speed: number | null;
  /** Direction of travel, degrees from north; null if unknown. */
  heading: number | null;
}

export const NO_MOTION: Motion = { speed: null, heading: null };

/** GPS reports -1 for "unknown". */
export const cleanMotion = (speed?: number | null, heading?: number | null): Motion => ({
  speed: typeof speed === 'number' && speed >= 0 ? speed : null,
  heading: typeof heading === 'number' && heading >= 0 ? heading % 360 : null,
});

/**
 * Guess from speed alone: under 2.5 km/h still, under 10 on foot, under 28 bicycle/scooter,
 * faster = car. A car in a traffic jam looks like a bicycle — the advice for both is to
 * stop and take cover, so the mistake is harmless.
 */
export function motionMode(speed: number | null): MotionMode {
  if (speed === null || speed < 0.7) return 'still';
  if (speed < 2.8) return 'walk';
  if (speed < 7.8) return 'bike';
  return 'car';
}

export const kmh = (speed: number | null) => Math.round((speed ?? 0) * 3.6);

/** Points on the user's course over the next `minutes` (at most 15 km). Empty if not moving. */
export function aheadPoints(coords: Coords, motion: Motion, minutes = CONFIG.LOOKAHEAD_MINUTES): Coords[] {
  if (motion.heading === null || motionMode(motion.speed) === 'still') return [];
  const km = Math.min(15, ((motion.speed ?? 0) * minutes * 60) / 1000);
  const steps = Math.max(1, Math.ceil(km / 0.5));
  return Array.from({ length: steps }, (_, i) => destinationPoint(coords, motion.heading as number, (km * (i + 1)) / steps));
}

/** Districts the user will reach on the current course and is not in yet. Nearest first. */
export function aheadZones(
  coords: Coords | null,
  motion: Motion,
  zones: Zone[] = CONFIG.ZONES,
  current: Zone[] = [],
  minutes = CONFIG.LOOKAHEAD_MINUTES,
): Zone[] {
  if (!coords) return [];
  const skip = new Set(current.map((z) => z.id));
  const out: Zone[] = [];
  for (const point of aheadPoints(coords, motion, minutes)) {
    for (const z of zonesForLocation(point, zones, 0)) {
      if (z.kind !== 'district' || skip.has(z.id)) continue;
      skip.add(z.id);
      out.push(z);
    }
  }
  return out;
}
