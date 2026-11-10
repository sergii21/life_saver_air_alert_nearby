import type { Coords, Zone } from '../types';

export interface ZoneMapProps {
  zones: Zone[];
  coords: Coords | null;
  /** Zones the user is alerted for right now (near the position or pinned). */
  activeIds: Set<string>;
  /** Zones added by hand. */
  pinnedIds: Set<string>;
  onToggle: (zoneId: string) => void;
}

/**
 * Browser preview: no map (the map library is phone-only) — the district list on the
 * Settings screen does the same job. Phones use ZoneMap.native.tsx.
 */
export function ZoneMap(_props: ZoneMapProps) {
  return null;
}
