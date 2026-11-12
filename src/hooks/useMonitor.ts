import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { CONFIG, configuredChannels } from '../config';
import { lang, setLang, t } from '../i18n';
import { registerBackgroundCheck } from '../lib/background';
import { hitKey, isSoftHit, userZonesFor } from '../lib/evaluate';
import { runCheck, type CheckResult } from '../lib/monitor';
import { aheadZones as zonesAhead, cleanMotion, motionMode, NO_MOTION, type Motion } from '../lib/motion';
import { isSirenPlaying, quietMode, startKeepAlive, startNativeSiren, stopKeepAlive, stopNativeSiren } from '../lib/nativeSiren';
import { hitTexts, notifyHit, setupNotifications } from '../lib/notifications';
import { messageUrl } from '../lib/telegram';
import { activeThreats } from '../lib/threat';
import { spokenAlert, spokenWarning } from '../lib/threatText';
import { speak, stopSpeaking } from '../lib/voice';
import {
  enableWebAlerts,
  onAudioUnlocked,
  startWebSiren,
  stopWebSiren,
  webAlertsEnabled,
  webNotificationPermission,
  webNotify,
} from '../lib/webAlarm';
import {
  addAcked,
  defaultSettings,
  loadAcked,
  loadCoords,
  loadSettings,
  saveCoords,
  saveSettings,
  type Settings,
} from '../lib/storage';
import type { Coords, ZoneHit } from '../types';

/** Browser preview only: http://localhost:8081/?lat=49.233&lng=28.5 fakes the location. */
type Fix = Coords & { speed?: number | null; heading?: number | null };

function webLocationOverride(): Fix | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const q = new URLSearchParams(window.location.search);
  const latitude = Number(q.get('lat'));
  const longitude = Number(q.get('lng') ?? q.get('lon'));
  if (!q.has('lat') || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // Optional: &speed=15&heading=90 (m/s, degrees) fakes movement.
  return { latitude, longitude, speed: q.has('speed') ? Number(q.get('speed')) : null, heading: q.has('heading') ? Number(q.get('heading')) : null };
}
const WEB_OVERRIDE = webLocationOverride();

export type LocPermission = 'unknown' | 'granted' | 'denied' | 'blocked';

const ALARM_PATTERN = [0, 800, 400, 800, 400, 800];

const IS_WEB = Platform.OS === 'web';
/** iPhone: the app keeps running (and checking) in the background — see CONFIG.BACKGROUND_KEEP_ALIVE. */
const KEEP_ALIVE = Platform.OS === 'ios' && CONFIG.BACKGROUND_KEEP_ALIVE;

/** A short siren to catch attention; then it stops and the voice says what to do. */
/** siren.wav is one 2.5 s rise-and-fall: exactly one full wail. */
const SIREN_SECONDS = 2.5;
/** With voice advice switched off the siren is the only sound, so it plays longer. */
const SIREN_ONLY_SECONDS = 12;
let announceTimer: ReturnType<typeof setTimeout> | null = null;

function cancelAnnounce() {
  if (announceTimer) clearTimeout(announceTimer);
  announceTimer = null;
  stopSpeaking();
}

function announce(hit: ZoneHit, isTest: boolean, settings: Settings, motion: Motion, delayMs = SIREN_SECONDS * 1000) {
  cancelAnnounce();
  if (!settings.voice) return;
  announceTimer = setTimeout(() => {
    announceTimer = null;
    try {
      if (IS_WEB) stopWebSiren();
      else stopNativeSiren();
      speak(spokenAlert(hit, motionMode(motion.speed), isTest), { lang, voiceId: settings.voiceId });
    } catch {
      // The voice failed: nothing more to do, the siren has already sounded.
    }
  }, delayMs);
}

/** A check that takes longer than this is abandoned, so the next one can start. */
const CHECK_TIMEOUT_MS = 25_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('check timed out')), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * The whole city is named, not a district: no siren. A short buzz and about a second of
 * speech ("Увага, Вінниця."). Spoken even when voice advice is off — it is the warning's sound.
 */
function softWarn(hit: ZoneHit, isTest: boolean, settings: Settings) {
  // Never talk over or cut short a siren that is already sounding for a district.
  if (!IS_WEB && isSirenPlaying()) return;
  cancelAnnounce();
  if (IS_WEB) {
    const { title, body } = hitTexts(hit, isTest);
    webNotify(title, body, isTest ? undefined : messageUrl(hit.message));
  } else {
    Vibration.vibrate(400);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }
  const say = () => speak(spokenWarning(hit, isTest), { lang, voiceId: settings.voiceId });
  // Make sure the voice is heard with the phone's silent switch on.
  if (IS_WEB) say();
  else quietMode().catch(() => {}).then(say);
}

function alarm(hit: ZoneHit, isTest: boolean, settings: Settings, motion: Motion) {
  if (isSoftHit(hit)) {
    softWarn(hit, isTest, settings);
    return;
  }
  announce(hit, isTest, settings, motion);
  if (IS_WEB) {
    // Browser preview: siren sound (repeats until "I'm safe") + desktop notification.
    startWebSiren(settings.voice ? SIREN_SECONDS + 1 : SIREN_ONLY_SECONDS);
    const { title, body } = hitTexts(hit, isTest);
    webNotify(title, body, isTest ? undefined : messageUrl(hit.message));
    return;
  }
  startNativeSiren(settings.voice ? SIREN_SECONDS + 1 : SIREN_ONLY_SECONDS);
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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [motion, setMotion] = useState<Motion>(NO_MOTION);
  // In a browser, keep checking while the tab is hidden (browsers then throttle timers to ~1/min).
  const [active, setActive] = useState(IS_WEB || AppState.currentState === 'active');
  const [webSound, setWebSound] = useState(() => IS_WEB && webAlertsEnabled());
  const [webNotif, setWebNotif] = useState(() => (IS_WEB ? webNotificationPermission() : 'unsupported'));
  useEffect(() => (IS_WEB ? onAudioUnlocked(() => setWebSound(true)) : undefined), []);

  const coordsRef = useRef<Coords | null>(null);
  const motionRef = useRef<Motion>(NO_MOTION);
  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;
  const checkingRef = useRef(false);
  const pendingRef = useRef(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const updateCoords = useCallback((c: Fix) => {
    const next = { latitude: c.latitude, longitude: c.longitude };
    coordsRef.current = next;
    setCoords(next);
    saveCoords(next);
    const m = cleanMotion(c.speed, c.heading);
    motionRef.current = m;
    setMotion((prev) => (prev.speed === m.speed && prev.heading === m.heading ? prev : m));
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
      const stored = await loadSettings();
      setLang(stored.language);
      settingsRef.current = stored;
      setSettings(stored);
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
          // Off screen (keep-alive): also post a notification; the siren supplies the sound.
          const offScreen = !IS_WEB && AppState.currentState !== 'active';
          // Districts on the user's course are checked too ("danger ahead").
          const cfg = settingsRef.current;
          const mine = userZonesFor(coordsRef.current, CONFIG.ZONES, cfg.nearbyKm, cfg.pinned);
          const ahead = zonesAhead(coordsRef.current, motionRef.current, CONFIG.ZONES, mine);
          const r = await withTimeout(
            runCheck(coordsRef.current, {
              notify: offScreen,
              notifySound: false,
              aheadZoneIds: ahead.map((z) => z.id),
            }),
            CHECK_TIMEOUT_MS,
          );
          setResult(r);
          if (r.newHits.length > 0) alarm(r.newHits[0], false, cfg, motionRef.current);
        } catch (e) {
          setResult((prev) => (prev ? { ...prev, errors: [String(e)] } : prev));
        }
      } while (pendingRef.current);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  // Polling. Paused while the app is in the background, unless keep-alive holds it awake.
  const hasCoords = coords !== null;
  useEffect(() => {
    if (!KEEP_ALIVE || permission !== 'granted') return;
    startKeepAlive();
    return stopKeepAlive;
  }, [permission]);
  useEffect(() => {
    if ((!active && !KEEP_ALIVE) || permission !== 'granted') return;
    check();
    const id = setInterval(check, CONFIG.POLL_INTERVAL_SECONDS * 1000);
    return () => clearInterval(id);
  }, [active, permission, hasCoords, check]);

  const userZones = useMemo(
    () => userZonesFor(coords, CONFIG.ZONES, settings.nearbyKm, settings.pinned),
    [coords, settings],
  );

  const aheadZones = useMemo(() => zonesAhead(coords, motion, CONFIG.ZONES, userZones), [coords, motion, userZones]);

  /** What is flying where, read from the latest posts (for the Targets list and the map). */
  const threats = useMemo(
    () => (result ? activeThreats(result.messages, result.checkedAt) : []),
    [result],
  );

  /** Change a setting, save it on the phone, and re-check the channels with it. */
  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      if (patch.language) setLang(next.language);
      settingsRef.current = next;
      setSettings(next);
      await saveSettings(next);
      check();
    },
    [settings, check],
  );

  const overlayHit: ZoneHit | null =
    testHit ?? result?.state.hits.find((h) => !acked.has(hitKey(h))) ?? null;

  const overlayRef = useRef<ZoneHit | null>(null);
  overlayRef.current = overlayHit;

  const acknowledge = useCallback(async () => {
    stopWebSiren();
    cancelAnnounce();
    Vibration.cancel();
    if (!IS_WEB) stopNativeSiren();
    if (testHit) {
      setTestHit(null);
      return;
    }
    const keys = (result?.state.hits ?? []).map(hitKey);
    await addAcked(keys);
    setAcked((prev) => new Set([...prev, ...keys]));
  }, [result, testHit]);

  const runTest = useCallback((kind: 'alarm' | 'warning' = 'alarm'): string | null => {
    const soft = kind === 'warning';
    // Outside known zones (e.g. App Store reviewers abroad) the test uses the first district as a demo.
    const zone = soft
      ? CONFIG.ZONES.find((z) => z.kind === 'area')
      : (userZones.find((z) => z.kind === 'district') ?? userZones[0] ?? CONFIG.ZONES.find((z) => z.kind === 'district'));
    if (!zone) return t('testNeedsZone');
    const hit: ZoneHit = {
      zone,
      message: {
        channel: configuredChannels()[0] ?? 'test',
        id: 0,
        date: new Date().toISOString(),
        text: t(soft ? 'testWarningBody' : 'testAlertBody', { zone: zone.name }),
      },
    };
    setTestHit(hit);
    if (soft) {
      softWarn(hit, true, settingsRef.current);
      return null;
    }
    if (IS_WEB) {
      // This click unlocks sound: start the siren now, then ask for notification permission.
      startWebSiren(settingsRef.current.voice ? SIREN_SECONDS + 1 : SIREN_ONLY_SECONDS);
      enableWebAlerts({ beep: false }).then((r) => {
        setWebSound(r.sound);
        setNotifGranted(r.notifications);
        setWebNotif(webNotificationPermission());
        const { title, body } = hitTexts(hit, true);
        webNotify(title, body);
      });
      announce(hit, true, settingsRef.current, motionRef.current);
      return null;
    }
    alarm(hit, true, settingsRef.current, motionRef.current);
    notifyHit(hit, true).catch(() => {});
    return null;
  }, [userZones]);

  const enableWebSound = useCallback(async () => {
    const r = await enableWebAlerts();
    setWebSound(r.sound);
    setNotifGranted(r.notifications);
    setWebNotif(webNotificationPermission());
    // A threat that arrived before sound was enabled: sound it now.
    if (overlayRef.current) {
      alarm(overlayRef.current, overlayRef.current.message.id === 0, settingsRef.current, motionRef.current);
    }
  }, []);

  /** "Say it again" on the alert screen. */
  const speakAgain = useCallback(() => {
    const hit = overlayRef.current;
    if (hit) announce(hit, hit.message.id === 0, { ...settingsRef.current, voice: true }, motionRef.current, 0);
  }, []);

  /** 2-second siren so the user can check the speakers / volume. */
  const testWebSound = useCallback(() => {
    startWebSiren(2);
    setWebSound(webAlertsEnabled());
  }, []);

  return {
    isWeb: IS_WEB,
    webSound,
    webNotif,
    enableWebSound,
    testWebSound,
    permission,
    requestLocation,
    coords,
    userZones,
    aheadZones,
    motion,
    threats,
    speakAgain,
    settings,
    updateSettings,
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
