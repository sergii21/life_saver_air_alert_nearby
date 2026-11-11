export type ZoneKind =
  /** A district / neighbourhood. A match means DANGER → "leave now". */
  | 'district'
  /** A wider area (whole city, hromada). A match means CAUTION. */
  | 'area';

export interface Zone {
  id: string;
  /** Display name (Ukrainian). */
  name: string;
  /** Optional English display name. */
  nameEn?: string;
  kind: ZoneKind;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  /** Lowercase keywords. Trailing "*" = prefix match, otherwise whole word/phrase. */
  keywords: string[];
}

export interface ChannelMessage {
  channel: string;
  /** Telegram post id inside the channel. */
  id: number;
  /** ISO date string, or null if unknown. */
  date: string | null;
  text: string;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

export type AlertLevel = 'safe' | 'caution' | 'danger';

export interface ZoneHit {
  zone: Zone;
  message: ChannelMessage;
  /** The user is not in this zone yet but is moving towards it. */
  ahead?: boolean;
}

export interface AlertState {
  level: AlertLevel;
  /** Active threat hits relevant to the user, most recent first. */
  hits: ZoneHit[];
  /** Zones the user is currently in. */
  userZones: Zone[];
}
