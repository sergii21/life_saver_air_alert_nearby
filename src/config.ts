/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  APP CONFIGURATION — this is the only file you normally need to edit.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Zone } from './types';
import { VINNYTSIA_ZONES } from './zones/vinnytsia';

export const CONFIG = {
  /**
   * PUBLIC Telegram channels to monitor — just the username, without "@" or "https://t.me/".
   * Example: for https://t.me/my_city_alerts put 'my_city_alerts'.
   *
   * Requirement: the channel must be public and have the web preview enabled, i.e.
   * https://t.me/s/<username> must open in a desktop browser and show the posts.
   */
  CHANNELS: ['REPLACE_WITH_CHANNEL_1', 'REPLACE_WITH_CHANNEL_2'] as string[],

  /** How often the channels are checked while the app is open (seconds). */
  POLL_INTERVAL_SECONDS: 30,

  /**
   * How often the OS should wake the app in the background (minutes). Minimum 15.
   * Android/iOS treat this as a hint — background checks are "best effort".
   */
  BACKGROUND_INTERVAL_MINUTES: 15,

  /** A threat message stays "active" for this many minutes unless an all-clear arrives. */
  ALERT_TTL_MINUTES: 30,

  /** Messages older than this are ignored entirely (minutes). */
  MAX_MESSAGE_AGE_MINUTES: 120,

  /** The user counts as "in" a zone if within (zone radius + this buffer), km. */
  ZONE_BUFFER_KM: 0.3,

  /** "Route away" button builds a walking route to a point this far from the danger zone, km. */
  ESCAPE_DISTANCE_KM: 3,

  /**
   * If true, a message must contain a threat word (see THREAT_KEYWORDS) to trigger an alert.
   * Default false: for safety, ANY message naming your district triggers the alert.
   */
  REQUIRE_THREAT_KEYWORD: false,

  /**
   * Words meaning "all clear". A message naming your zone + one of these clears the alert.
   * Keyword syntax (used everywhere): lowercase; ending with "*" = word prefix (handles
   * Ukrainian case endings), otherwise whole word / phrase.
   */
  ALL_CLEAR_KEYWORDS: ['відбій*', 'отбой*', 'загроза минула', 'загрозу знято', 'чисто', 'all clear'],

  THREAT_KEYWORDS: [
    'загроз*', 'небезпек*', 'тривог*', 'ракет*', 'шахед*', 'шахід*', 'бпла', 'дрон*', 'мопед*',
    'вибух*', 'удар*', 'обстріл*', 'приліт*', 'укритт*', 'курс*', 'рух*', 'летить*', 'летять*',
    'балістик*', 'каб*', 'евакуац*', 'пожеж*',
  ],

  /** Zones (districts / areas) the app knows. Swap or extend for other cities. */
  ZONES: VINNYTSIA_ZONES as Zone[],

  /** Emergency phone number shown on the alert screen. */
  EMERGENCY_PHONE: '112',

  /** Link shown in Settings (host docs/privacy-policy.html, e.g. on GitHub Pages). */
  PRIVACY_POLICY_URL: 'https://REPLACE_WITH_YOUR_GITHUB_USERNAME.github.io/life_saver_air_alert_nearby/privacy-policy.html',
};

/**
 * Channels can also be set at build time without editing code:
 *   EXPO_PUBLIC_TG_CHANNELS="channel_one,channel_two" (e.g. as an EAS environment variable).
 */
const ENV_CHANNELS = process.env.EXPO_PUBLIC_TG_CHANNELS;

export const configuredChannels = (): string[] =>
  (ENV_CHANNELS ? ENV_CHANNELS.split(',') : CONFIG.CHANNELS)
    .map((c: string) => c.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\/(s\/)?/, ''))
    .filter((c: string) => c.length > 0 && !c.startsWith('REPLACE_WITH'));
