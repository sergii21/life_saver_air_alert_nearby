import { StyleSheet, Text, View } from 'react-native';
import { CONFIG } from '../config';
import { t, zoneName } from '../i18n';
import { kmh, motionMode, type Motion } from '../lib/motion';
import { colors } from '../theme';
import type { AlertLevel, Coords, Zone, ZoneHit } from '../types';

const LOOK = {
  safe: { fg: colors.safe, bg: colors.safeBg, icon: '✅', title: 'safeTitle', sub: 'safeSub' },
  caution: { fg: colors.caution, bg: colors.cautionBg, icon: '⚠️', title: 'cautionTitle', sub: 'cautionSub' },
  danger: { fg: colors.danger, bg: colors.dangerBg, icon: '🚨', title: 'dangerTitle', sub: 'dangerSub' },
} as const satisfies Record<AlertLevel, object>;

interface Props {
  level: AlertLevel;
  hits: ZoneHit[];
  coords: Coords | null;
  userZones: Zone[];
  motion: Motion;
  /** Districts on the user's course in the next minutes. */
  aheadZones: Zone[];
  lastCheck: number | null;
}

const MODE_KEY = { still: 'modeStill', walk: 'modeWalk', bike: 'modeBike', car: 'modeCar' } as const;

export function StatusCard({ level, hits, coords, userZones, motion, aheadZones, lastCheck }: Props) {
  const look = LOOK[level];
  const mode = motionMode(motion.speed);
  return (
    <View style={[styles.card, { backgroundColor: look.bg, borderColor: look.fg }]}>
      <Text style={styles.icon}>{look.icon}</Text>
      <Text style={[styles.title, { color: look.fg }]}>{t(look.title)}</Text>
      <Text style={styles.sub}>{t(look.sub, { s: CONFIG.POLL_INTERVAL_SECONDS })}</Text>
      {hits.length > 0 && (
        <Text style={[styles.hitZones, { color: look.fg }]}>{hits.map((h) => zoneName(h.zone)).join(', ')}</Text>
      )}

      <View style={styles.divider} />
      <Text style={styles.label}>{t('yourLocation')}</Text>
      {coords ? (
        <>
          <Text style={styles.value}>
            {userZones.length > 0 ? userZones.map(zoneName).join(' · ') : t('outsideZones')}
          </Text>
          <Text style={styles.coords}>
            {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
          </Text>
          <Text style={styles.label}>
            {t('motionLabel')}: {t(MODE_KEY[mode])}
            {mode !== 'still' ? ` · ${t('kmh', { n: kmh(motion.speed) })}` : ''}
          </Text>
          {aheadZones.length > 0 && (
            <Text style={styles.ahead}>
              {t('aheadLabel', { min: CONFIG.LOOKAHEAD_MINUTES })}: {aheadZones.map(zoneName).join(' · ')}
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.value}>{t('locating')}</Text>
      )}
      <Text style={styles.label}>
        {t('lastCheck')}: {lastCheck ? new Date(lastCheck).toLocaleTimeString() : t('never')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 16, padding: 18 },
  icon: { fontSize: 40, textAlign: 'center' },
  title: { fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  sub: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6 },
  hitZones: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  label: { fontSize: 13, color: colors.muted, marginTop: 4 },
  value: { fontSize: 16, color: colors.text, fontWeight: '600', marginTop: 2 },
  ahead: { fontSize: 14, color: colors.text, fontWeight: '600', marginTop: 2, marginBottom: 6 },
  coords: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 8 },
});
