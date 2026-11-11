import { Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CONFIG } from '../config';
import { t, timeAgo, zoneName } from '../i18n';
import { isDangerHit } from '../lib/evaluate';
import { escapePoint } from '../lib/geo';
import { open, phoneUrl, shelterSearchUrl, walkingRouteUrl } from '../lib/links';
import type { MotionMode } from '../lib/motion';
import { messageUrl } from '../lib/telegram';
import { trackFor } from '../lib/threat';
import { adviceFor, KIND_ICON, relationLine, threatLine } from '../lib/threatText';
import { colors } from '../theme';
import type { Coords, ZoneHit } from '../types';
import { Button } from './Button';

interface Props {
  hit: ZoneHit | null;
  coords: Coords | null;
  isTest: boolean;
  /** How the user is moving — picks the advice that fits. */
  mode: MotionMode;
  /** Say the advice aloud again. */
  onSpeak?: () => void;
  onClose: () => void;
  /** Browser preview: sound is still blocked — show a button that unlocks it. */
  onEnableSound?: () => void;
}

const CITY = CONFIG.ZONES.find((z) => z.kind === 'area')?.center;

export function AlertOverlay({ hit, coords, isTest, mode, onSpeak, onClose, onEnableSound }: Props) {
  // Pin the screen to the window height: on the web it would otherwise grow with its content,
  // pushing the close button off-screen and leaving nothing to scroll inside.
  const { height } = useWindowDimensions();
  if (!hit) return null;
  const danger = isDangerHit(hit);
  const track = isTest ? null : trackFor(hit.message, hit.zone.id);
  const where = track ? relationLine(track, coords) : '';
  const bg = danger ? colors.danger : colors.caution;
  const zone = zoneName(hit.zone);
  const km = CONFIG.ESCAPE_DISTANCE_KM;

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.wrap, { backgroundColor: bg, height }]}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          {isTest && <Text style={styles.test}>TEST</Text>}
          {onEnableSound && (
            <Button title={t('webEnableSound')} color={colors.white} textColor={bg} onPress={onEnableSound} />
          )}
          <Text style={styles.icon}>{danger ? '🚨' : '⚠️'}</Text>
          <Text style={styles.title}>{hit.ahead ? t('aheadTitle') : danger ? t('leaveNow') : t('cautionTitle')}</Text>
          <Text style={styles.zone}>{zone}</Text>
          <Text style={styles.body}>{t(hit.ahead ? 'aheadBody' : danger ? 'dangerBody' : 'cautionBody', { zone })}</Text>
          {track && (
            <View style={styles.trackBox}>
              <Text style={styles.trackText}>
                {KIND_ICON[track.kind]} {threatLine(track)}
              </Text>
              {!!where && <Text style={styles.trackMeta}>{where}</Text>}
            </View>
          )}

          <View style={styles.adviceBox}>
            {adviceFor(hit, mode).map((line, i) => (
              <Text key={i} style={styles.advice}>
                {i + 1}. {line}
              </Text>
            ))}
          </View>
          {onSpeak && <Button title={t('speakAgain')} color={colors.white} outline onPress={onSpeak} />}

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

        </ScrollView>
        {/* Always visible (outside the scroll area): stops the siren and closes the alert. */}
        <View style={styles.footer}>
          <Button title={t('imSafe')} color="rgba(0,0,0,0.45)" onPress={onClose} style={{ marginTop: 0 }} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  footer: { paddingHorizontal: 22, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.25)' },
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
  trackBox: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 12, padding: 12, marginTop: 14 },
  trackText: { color: colors.white, fontSize: 18, fontWeight: '800', textAlign: 'center', lineHeight: 25 },
  trackMeta: { color: colors.white, fontSize: 14, textAlign: 'center', marginTop: 4, opacity: 0.9 },
  adviceBox: { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: 14, marginVertical: 16 },
  advice: { color: colors.white, fontSize: 16, lineHeight: 23, marginVertical: 3 },
  msgBox: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, marginTop: 20 },
  msgMeta: { color: colors.white, opacity: 0.85, fontSize: 12 },
  msgText: { color: colors.white, fontSize: 15, marginTop: 6, lineHeight: 21 },
});
