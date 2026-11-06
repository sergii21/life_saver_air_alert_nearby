import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { CONFIG, configuredChannels } from '../config';
import { t } from '../i18n';
import { registerBackgroundCheck } from '../lib/background';
import { hitKey, zonesForLocation } from '../lib/evaluate';
import { runCheck, type CheckResult } from '../lib/monitor';
import { notifyHit, setupNotifications } from '../lib/notifications';
import { addAcked, loadAcked, loadCoords, saveCoords } from '../lib/storage';
import type { Coords, ZoneHit } from '../types';

export type LocPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

const ALARM_PATTERN = [0, 800, 400, 800, 400, 800];

function alarm() {
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
  const [active, setActive] = useState(AppState.currentState === 'active');

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
      const p = await Location.getForegroundPermissionsAsync();
      if (p.granted) {
        applyPermission(p);
        setNotifGranted(await setupNotifications().catch(() => false));
      } else setPermission(p.canAskAgain ? 'unknown' : 'blocked');
      registerBackgroundCheck();
    })();
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => {
      sub.remove();
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [applyPermission]);

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
          if (r.newHits.length > 0) alarm();
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

  const acknowledge = useCallback(async () => {
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
    alarm();
    notifyHit(hit, true).catch(() => {});
    return null;
  }, [userZones]);

  return {
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
