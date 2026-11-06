import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONFIG } from '../config';
import { t, timeAgo, zoneName } from '../i18n';
import { escapePoint } from '../lib/geo';
import { open, phoneUrl, shelterSearchUrl, walkingRouteUrl } from '../lib/links';
import { messageUrl } from '../lib/telegram';
import { colors } from '../theme';
import type { Coords, ZoneHit } from '../types';
import { Button } from './Button';

interface Props {
  hit: ZoneHit | null;
  coords: Coords | null;
  isTest: boolean;
  onClose: () => void;
  /** Browser preview: sound is still blocked — show a button that unlocks it. */
  onEnableSound?: () => void;
}

const CITY = CONFIG.ZONES.find((z) => z.kind === 'area')?.center;

export function AlertOverlay({ hit, coords, isTest, onClose, onEnableSound }: Props) {
  if (!hit) return null;
  const danger = hit.zone.kind === 'district';
  const bg = danger ? colors.danger : colors.caution;
  const zone = zoneName(hit.zone);
  const km = CONFIG.ESCAPE_DISTANCE_KM;

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.wrap, { backgroundColor: bg }]}>
        <ScrollView contentContainerStyle={styles.content}>
          {isTest && <Text style={styles.test}>TEST</Text>}
          {onEnableSound && (
            <Button title={t('webEnableSound')} color={colors.white} textColor={bg} onPress={onEnableSound} />
          )}
          <Text style={styles.icon}>{danger ? '🚨' : '⚠️'}</Text>
          <Text style={styles.title}>{danger ? t('leaveNow') : t('cautionTitle')}</Text>
          <Text style={styles.zone}>{zone}</Text>
          <Text style={styles.body}>{t(danger ? 'dangerBody' : 'cautionBody', { zone })}</Text>

          <View style={styles.adviceBox}>
            <Text style={styles.advice}>1. {t('advice1', { km })}</Text>
            <Text style={styles.advice}>2. {t('advice2')}</Text>
            <Text style={styles.advice}>3. {t('advice3')}</Text>
          </View>

          {coords && danger && (
            <Button
              title={t('routeAway', { km })}
              color={colors.white}
              textColor={bg}
              onPress={() => open(walkingRouteUrl(escapePoint(coords, hit.zone.center, km, CITY)))}
            />
          )}
          {coords && (
            <Button
              title={t('findShelter')}
              color={colors.white}
              textColor={bg}
              onPress={() => open(shelterSearchUrl(coords))}
            />
          )}
          <Button
            title={t('call', { phone: CONFIG.EMERGENCY_PHONE })}
            color={colors.white}
            outline
            onPress={() => open(phoneUrl(CONFIG.EMERGENCY_PHONE))}
          />

          <View style={styles.msgBox}>
            <Text style={styles.msgMeta}>
              {t('messageFrom')} @{hit.message.channel} · {timeAgo(hit.message.date)}
            </Text>
            <Text style={styles.msgText}>{hit.message.text}</Text>
          </View>
          {!isTest && (
            <Button title={t('openMessage')} color={colors.white} outline onPress={() => open(messageUrl(hit.message))} />
          )}

          <Button title={t('imSafe')} color="rgba(0,0,0,0.35)" onPress={onClose} style={{ marginTop: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: 22, paddingBottom: 40 },
  test: {
    alignSelf: 'center',
    color: colors.white,
    fontWeight: '900',
    borderWidth: 2,
    borderColor: colors.white,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  icon: { fontSize: 72, textAlign: 'center', marginTop: 8 },
  title: { fontSize: 28, fontWeight: '900', color: colors.white, textAlign: 'center', marginTop: 8 },
  zone: { fontSize: 24, fontWeight: '800', color: colors.white, textAlign: 'center', marginTop: 6 },
  body: { fontSize: 17, color: colors.white, textAlign: 'center', marginTop: 10, lineHeight: 24 },
  adviceBox: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: 14, marginVertical: 16 },
  advice: { color: colors.white, fontSize: 16, lineHeight: 23, marginVertical: 3 },
  msgBox: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, marginTop: 20 },
  msgMeta: { color: colors.white, opacity: 0.85, fontSize: 12 },
  msgText: { color: colors.white, fontSize: 15, marginTop: 6, lineHeight: 21 },
});
