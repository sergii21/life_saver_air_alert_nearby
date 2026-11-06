import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { CONFIG, configuredChannels } from '../config';
import { t } from '../i18n';
import { registerBackgroundCheck } from '../lib/background';
import { hitKey, zonesForLocation } from '../lib/evaluate';
import { runCheck, type CheckResult } from '../lib/monitor';
import { hitTexts, notifyHit, setupNotifications } from '../lib/notifications';
import { messageUrl } from '../lib/telegram';
import { enableWebAlerts, onAudioUnlocked, startWebSiren, stopWebSiren, webAlertsEnabled, webNotify } from '../lib/webAlarm';
import { addAcked, loadAcked, loadCoords, saveCoords } from '../lib/storage';
import type { Coords, ZoneHit } from '../types';

/** Browser preview only: http://localhost:8081/?lat=49.233&lng=28.5 fakes the location. */
function webLocationOverride(): Coords | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const q = new URLSearchParams(window.location.search);
  const latitude = Number(q.get('lat'));
  const longitude = Number(q.get('lng') ?? q.get('lon'));
  return q.has('lat') && Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}
const WEB_OVERRIDE = webLocationOverride();

export type LocPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

const ALARM_PATTERN = [0, 800, 400, 800, 400, 800];

const IS_WEB = Platform.OS === 'web';

function alarm(hit: ZoneHit, isTest = false) {
  if (IS_WEB) {
    // Browser preview: siren sound (repeats until "I'm safe") + desktop notification.
    startWebSiren();
    const { title, body } = hitTexts(hit, isTest);
    webNotify(title, body, isTest ? undefined : messageUrl(hit.message));
    return;
  }
  Vibration.vibrate(ALARM_PATTERN);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function useMonitor() {
  const [permission, setPermission] = useState<LocPermission>('unknown');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [notifGranted, setNotifGranted] = useState(true);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [testHit, setTestHit] = useState<ZoneHit | null>(null);
  // In a browser, keep checking while the tab is hidden (browsers then throttle timers to ~1/min).
  const [active, setActive] = useState(IS_WEB || AppState.currentState === 'active');
  const [webSound, setWebSound] = useState(() => IS_WEB && webAlertsEnabled());
  useEffect(() => (IS_WEB ? onAudioUnlocked(() => setWebSound(true)) : undefined), []);

  const coordsRef = useRef<Coords | null>(null);
  const checkingRef = useRef(false);
  const pendingRef = useRef(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const updateCoords = useCallback((c: Coords) => {
    const next = { latitude: c.latitude, longitude: c.longitude };
    coordsRef.current = next;
    setCoords(next);
    saveCoords(next);
  }, []);

  const startLocation = useCallback(async () => {
    if (watchRef.current) return;
    if (WEB_OVERRIDE) {
      updateCoords(WEB_OVERRIDE);
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      updateCoords(pos.coords);
    } catch (e) {
      console.warn('getCurrentPosition failed', e);
    }
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 30_000 },
      (pos) => updateCoords(pos.coords),
    ).catch(() => null);
  }, [updateCoords]);

  const applyPermission = useCallback(
    (p: Location.LocationPermissionResponse) => {
      if (p.granted) {
        setPermission('granted');
        startLocation();
      } else setPermission(p.canAskAgain ? 'denied' : 'blocked');
    },
    [startLocation],
  );

  const requestLocation = useCallback(async () => {
    applyPermission(await Location.requestForegroundPermissionsAsync());
    setNotifGranted(await setupNotifications().catch(() => false));
  }, [applyPermission]);

  // Startup
  useEffect(() => {
    (async () => {
      const saved = await loadCoords();
      if (saved && !coordsRef.current) {
        coordsRef.current = saved;
        setCoords({ latitude: saved.latitude, longitude: saved.longitude });
      }
      setAcked(await loadAcked());
      if (WEB_OVERRIDE) {
        setPermission('granted');
        updateCoords(WEB_OVERRIDE);
        return;
      }
      const p = await Location.getForegroundPermissionsAsync();
      if (p.granted) {
        applyPermission(p);
        setNotifGranted(await setupNotifications().catch(() => false));
      } else setPermission(p.canAskAgain ? 'unknown' : 'blocked');
      registerBackgroundCheck();
    })();
    const sub = AppState.addEventListener('change', (s) => setActive(IS_WEB || s === 'active'));
    return () => {
      sub.remove();
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [applyPermission, updateCoords]);

  const check = useCallback(async () => {
    // If a check is already running (e.g. started before GPS was ready), queue one more run.
    if (checkingRef.current) {
      pendingRef.current = true;
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    try {
      do {
        pendingRef.current = false;
        try {
          const r = await runCheck(coordsRef.current, { notify: false });
          setResult(r);
          if (r.newHits.length > 0) alarm(r.newHits[0]);
        } catch (e) {
          setResult((prev) => (prev ? { ...prev, errors: [String(e)] } : prev));
        }
      } while (pendingRef.current);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  // Foreground polling (paused while the app is in background).
  const hasCoords = coords !== null;
  useEffect(() => {
    if (!active || permission !== 'granted') return;
    check();
    const id = setInterval(check, CONFIG.POLL_INTERVAL_SECONDS * 1000);
    return () => clearInterval(id);
  }, [active, permission, hasCoords, check]);

  const userZones = useMemo(() => (coords ? zonesForLocation(coords) : []), [coords]);

  const overlayHit: ZoneHit | null =
    testHit ?? result?.state.hits.find((h) => !acked.has(hitKey(h))) ?? null;

  const overlayRef = useRef<ZoneHit | null>(null);
  overlayRef.current = overlayHit;

  const acknowledge = useCallback(async () => {
    stopWebSiren();
    if (testHit) {
      setTestHit(null);
      return;
    }
    const keys = (result?.state.hits ?? []).map(hitKey);
    await addAcked(keys);
    setAcked((prev) => new Set([...prev, ...keys]));
  }, [result, testHit]);

  const runTest = useCallback((): string | null => {
    // Outside known zones (e.g. App Store reviewers abroad) the test uses the first district as a demo.
    const zone =
      userZones.find((z) => z.kind === 'district') ?? userZones[0] ?? CONFIG.ZONES.find((z) => z.kind === 'district');
    if (!zone) return t('testNeedsZone');
    const hit: ZoneHit = {
      zone,
      message: {
        channel: configuredChannels()[0] ?? 'test',
        id: 0,
        date: new Date().toISOString(),
        text: t('testAlertBody', { zone: zone.name }),
      },
    };
    setTestHit(hit);
    if (IS_WEB) {
      // This click unlocks sound: start the siren now, then ask for notification permission.
      startWebSiren();
      enableWebAlerts({ beep: false }).then((r) => {
        setWebSound(r.sound);
        setNotifGranted(r.notifications);
        const { title, body } = hitTexts(hit, true);
        webNotify(title, body);
      });
      return null;
    }
    alarm(hit, true);
    notifyHit(hit, true).catch(() => {});
    return null;
  }, [userZones]);

  const enableWebSound = useCallback(async () => {
    const r = await enableWebAlerts();
    setWebSound(r.sound);
    setNotifGranted(r.notifications);
    // A threat that arrived before sound was enabled: sound it now.
    if (overlayRef.current) alarm(overlayRef.current, overlayRef.current.message.id === 0);
  }, []);

  return {
    isWeb: IS_WEB,
    webSound,
    enableWebSound,
    permission,
    requestLocation,
    coords,
    userZones,
    result,
    checking,
    check,
    notifGranted,
    overlayHit,
    isTest: testHit !== null,
    acknowledge,
    runTest,
  };
}
