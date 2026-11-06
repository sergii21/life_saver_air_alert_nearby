import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t, zoneName } from '../i18n';
import type { ZoneHit } from '../types';
import { messageUrl } from './telegram';

export const ALERT_CHANNEL_ID = 'danger-alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
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

export async function notifyHit(hit: ZoneHit, isTest = false): Promise<void> {
  const danger = hit.zone.kind === 'district';
  const zone = zoneName(hit.zone);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: (isTest ? 'TEST · ' : '') + t(danger ? 'notifTitleDanger' : 'notifTitleCaution', { zone }),
      body: t(danger ? 'notifBodyDanger' : 'notifBodyCaution') + '\n\n' + hit.message.text.slice(0, 200),
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      interruptionLevel: 'timeSensitive',
      vibrate: [0, 800, 400, 800, 400, 800],
      data: { url: messageUrl(hit.message) },
    },
    trigger: Platform.OS === 'android' ? { channelId: ALERT_CHANNEL_ID } : null,
  });
}
