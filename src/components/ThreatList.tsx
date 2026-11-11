import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t, timeAgo } from '../i18n';
import { relationToUser, type ThreatTrack } from '../lib/threat';
import { KIND_COLOR, KIND_ICON, kindBadge, relationLine, speedLabel, threatWhere, countLabel } from '../lib/threatText';
import { colors } from '../theme';
import type { Coords } from '../types';
import { Button } from './Button';

interface Props {
  threats: ThreatTrack[];
  coords: Coords | null;
  onOpenMap: () => void;
}

/** "What is flying where" — how many targets, of what kind, towards which place. */
export const ThreatList = memo(function ThreatList({ threats, coords, onOpenMap }: Props) {
  if (threats.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('targetsTitle')}</Text>
      {threats.slice(0, 8).map((track) => {
        const towards = relationToUser(track, coords)?.towardsUser ?? false;
        const meta = [relationLine(track, coords), track.from ? t(`from${track.from}`) : '', timeAgo(track.message.date)]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={`${track.key}-${track.message.id}`} style={[styles.row, towards && styles.rowHot]}>
            <Text style={styles.icon}>{KIND_ICON[track.kind]}</Text>
            <View style={styles.text}>
              <View style={styles.badges}>
                <Text style={[styles.badge, { backgroundColor: KIND_COLOR[track.kind] }]}>{kindBadge(track.kind)}</Text>
                {!!speedLabel(track.kind) && (
                  <Text style={[styles.speed, { color: KIND_COLOR[track.kind] }]}>{speedLabel(track.kind)}</Text>
                )}
              </View>
              <Text style={styles.label}>
                {countLabel(track) ? `${countLabel(track)} × ` : ''}
                <Text style={styles.arrow}>→ {threatWhere(track)}</Text>
              </Text>
              <Text style={styles.meta}>{meta}</Text>
              {towards && <Text style={styles.hot}>{t('targetsTowards')}</Text>}
            </View>
          </View>
        );
      })}
      <Button title={t('targetsMap')} onPress={onOpenMap} outline color={colors.danger} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 6 },
  row: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  rowHot: { backgroundColor: colors.dangerBg, borderRadius: 8, paddingHorizontal: 6 },
  icon: { fontSize: 22, width: 32 },
  text: { flex: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 3 },
  badge: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  speed: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 15, fontWeight: '800', color: colors.text, lineHeight: 21 },
  arrow: { color: colors.danger },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  hot: { fontSize: 12, fontWeight: '900', color: colors.danger, marginTop: 3 },
});
