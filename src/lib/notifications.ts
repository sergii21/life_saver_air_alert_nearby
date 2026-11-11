import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { t, zoneName } from '../i18n';
import type { ZoneHit } from '../types';
import { isDangerHit } from './evaluate';
import { messageUrl } from './telegram';
import { trackFor } from './threat';
import { threatLine } from './threatText';

export const ALERT_CHANNEL_ID = 'danger-alerts';
const ALERT_SOUND = 'siren_alert.wav';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    // App on screen: the in-app siren (nativeSiren.ts) is already sounding.
    shouldPlaySound: AppState.currentState !== 'active',
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL_ID, {
      name: 'Danger alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 400, 800, 400, 800],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableVibrate: true,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export function hitTexts(hit: ZoneHit, isTest = false): { title: string; body: string } {
  const danger = isDangerHit(hit);
  const zone = zoneName(hit.zone);
  const track = trackFor(hit.message, hit.zone.id);
  const what = track ? threatLine(track) + '\n' : '';
  const title = hit.ahead ? 'notifTitleAhead' : danger ? 'notifTitleDanger' : 'notifTitleCaution';
  const body = hit.ahead ? 'notifBodyAhead' : danger ? 'notifBodyDanger' : 'notifBodyCaution';
  return {
    title: (isTest ? 'TEST · ' : '') + t(title, { zone }),
    body: what + t(body) + '\n\n' + hit.message.text.slice(0, 200),
  };
}

/** `withSound: false` when the in-app siren is already sounding (avoids two sirens at once). */
export async function notifyHit(hit: ZoneHit, isTest = false, withSound = true): Promise<void> {
  const { title, body } = hitTexts(hit, isTest);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // iOS: bundled 27 s siren (see app.json). Android uses the channel's sound.
      sound: withSound ? (Platform.OS === 'ios' ? ALERT_SOUND : 'default') : false,
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      vibrate: [0, 800, 400, 800, 400, 800],
      data: { url: messageUrl(hit.message) },
    },
    trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL_ID } : null,
  });
}
