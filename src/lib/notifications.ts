import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { t, zoneName } from '../i18n';
import type { ZoneHit } from '../types';
import { messageUrl } from './telegram';

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
  const danger = hit.zone.kind === 'district';
  const zone = zoneName(hit.zone);
  return {
    title: (isTest ? 'TEST · ' : '') + t(danger ? 'notifTitleDanger' : 'notifTitleCaution', { zone }),
    body: t(danger ? 'notifBodyDanger' : 'notifBodyCaution') + '\n\n' + hit.message.text.slice(0, 200),
  };
}

export async function notifyHit(hit: ZoneHit, isTest = false): Promise<void> {
  const { title, body } = hitTexts(hit, isTest);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // iOS: bundled 27 s siren (see app.json). Android uses the channel's sound.
      sound: Platform.OS === 'ios' ? ALERT_SOUND : 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      vibrate: [0, 800, 400, 800, 400, 800],
      data: { url: messageUrl(hit.message) },
    },
    trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL_ID } : null,
  });
}
