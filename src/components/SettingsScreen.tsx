import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONFIG } from '../config';
import { lang, t, zoneName, type LangChoice } from '../i18n';
import { zonesForLocation } from '../lib/evaluate';
import { distanceKm } from '../lib/geo';
import type { Settings } from '../lib/storage';
import type { ThreatTrack } from '../lib/threat';
import { listVoices, speak, type VoiceOption } from '../lib/voice';
import { colors } from '../theme';
import type { Coords, Zone } from '../types';
import { Safe } from './Safe';
import { ZoneMap } from './ZoneMap';

interface Props {
  visible: boolean;
  onClose: () => void;
  coords: Coords | null;
  userZones: Zone[];
  threats: ThreatTrack[];
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const HAS_MAP = Platform.OS !== 'web';

/** District map + the two user settings: "nearby" distance and districts added by hand. */
const LANGS: [LangChoice, string][] = [
  ['auto', ''],
  ['uk', 'Українська'],
  ['en', 'English'],
];

interface ChipProps {
  label: string;
  on: boolean;
  onPress: () => void;
}

function Chip({ label, on, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function SettingsScreen(props: Props) {
  // Nothing is built while the screen is closed.
  return props.visible ? <SettingsContent {...props} /> : null;
}

function SettingsContent({ visible, onClose, coords, userZones, threats, settings, onChange }: Props) {
  // Voices the phone has for the current language.
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  useEffect(() => {
    if (visible) listVoices(lang).then(setVoices);
  }, [visible, settings.language]);
  const voiceLabel = (v: VoiceOption) =>
    v.name + (v.gender ? ` · ${t(v.gender === 'f' ? 'voiceWoman' : 'voiceMan')}` : '');

  const districts = CONFIG.ZONES.filter((z) => z.kind === 'district');
  const activeIds = new Set(userZones.map((z) => z.id));
  const pinnedIds = new Set(settings.pinned);
  // "Near" = alerted because of the position, so the list cannot remove it.
  const nearIds = new Set((coords ? zonesForLocation(coords, CONFIG.ZONES, settings.nearbyKm) : []).map((z) => z.id));

  const toggle = (id: string) => {
    if (nearIds.has(id) && !pinnedIds.has(id)) return;
    onChange({ pinned: pinnedIds.has(id) ? settings.pinned.filter((x) => x !== id) : [...settings.pinned, id] });
  };

  const rows = districts
    .map((z) => ({ z, d: coords ? distanceKm(coords, z.center) : null }))
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0));
  const mine = userZones.filter((z) => z.kind === 'district');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>{t('settingsDone')}</Text>
          </Pressable>
        </View>

        {HAS_MAP && (
          <View style={styles.mapBox}>
            <Safe>
              <ZoneMap
              zones={CONFIG.ZONES}
              coords={coords}
              activeIds={activeIds}
              pinnedIds={pinnedIds}
              threats={threats}
            />
            </Safe>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.content}>
          {HAS_MAP && threats.length > 0 && <Text style={[styles.hint, styles.hintGap]}>{t('mapThreatHint')}</Text>}
          {HAS_MAP && <Text style={styles.hint}>{t('mapHint')}</Text>}

          <Text style={styles.section}>{t('nearbyTitle')}</Text>
          <Text style={styles.hint}>{t('nearbyHint')}</Text>
          <View style={styles.chips}>
            {CONFIG.NEARBY_KM_OPTIONS.map((km) => {
              const on = settings.nearbyKm === km;
              return (
                <Pressable
                  key={km}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onChange({ nearbyKm: km })}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t('km', { n: km })}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.section}>{t('voiceTitle')}</Text>
          <Text style={styles.hint}>{t('voiceHint')}</Text>
          <View style={styles.chips}>
            <Chip label={t('on')} on={settings.voice} onPress={() => onChange({ voice: true })} />
            <Chip label={t('off')} on={!settings.voice} onPress={() => onChange({ voice: false })} />
          </View>
          {settings.voice && (
            <>
              <Text style={[styles.hint, styles.hintTop]}>{t('voiceChoose')}</Text>
              <View style={styles.chips}>
                <Chip label={t('voiceDefault')} on={settings.voiceId === null} onPress={() => onChange({ voiceId: null })} />
                {voices.map((v) => (
                  <Chip key={v.id} label={voiceLabel(v)} on={settings.voiceId === v.id} onPress={() => onChange({ voiceId: v.id })} />
                ))}
              </View>
              {voices.length <= 1 && <Text style={[styles.hint, styles.hintTop]}>{t('voiceNone')}</Text>}
              <Pressable
                accessibilityRole="button"
                onPress={() => speak(t('voiceSample'), { lang, voiceId: settings.voiceId })}
                style={styles.rowBtn}
              >
                <Text style={styles.rowBtnText}>{t('voiceTry')}</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.section}>{t('langTitle')}</Text>
          <View style={styles.chips}>
            {LANGS.map(([code, label]) => (
              <Chip
                key={code}
                label={label || t('langAuto')}
                on={settings.language === code}
                // A voice belongs to one language, so the choice is reset.
                onPress={() => onChange({ language: code, voiceId: null })}
              />
            ))}
          </View>

          <Text style={styles.section}>{t('myZonesTitle')}</Text>
          <Text style={styles.mine}>{mine.length > 0 ? mine.map(zoneName).join(' · ') : t('myZonesNone')}</Text>

          <Text style={styles.section}>{t('listTitle')}</Text>
          {rows.map(({ z, d }) => {
            const pinned = pinnedIds.has(z.id);
            const near = nearIds.has(z.id);
            return (
              <View key={z.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, (near || pinned) && { color: colors.danger }]}>{zoneName(z)}</Text>
                  <Text style={styles.rowMeta}>
                    {d !== null ? `${d.toFixed(1)} km` : ''}
                    {pinned ? ` · ${t('pinnedTag')}` : near ? ` · ${t('nearTag')}` : ''}
                  </Text>
                </View>
                {(!near || pinned) && (
                  <Pressable accessibilityRole="button" onPress={() => toggle(z.id)} style={styles.rowBtn} hitSlop={8}>
                    <Text style={[styles.rowBtnText, pinned && { color: colors.muted }]}>
                      {pinned ? t('remove') : t('add')}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: { fontSize: 22, fontWeight: '900', color: colors.text },
  done: { fontSize: 17, fontWeight: '700', color: colors.primary },
  mapBox: { height: '45%', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  content: { padding: 16, paddingBottom: 48 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  hintGap: { marginBottom: 6, color: colors.danger },
  hintTop: { marginTop: 12 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 18, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.text },
  chipTextOn: { color: colors.white },
  mine: { fontSize: 15, fontWeight: '600', color: colors.danger, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  rowBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
