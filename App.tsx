import { StatusBar } from 'expo-status-bar';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AlertOverlay } from './src/components/AlertOverlay';
import { Button } from './src/components/Button';
import { MessageList } from './src/components/MessageList';
import { PermissionScreen } from './src/components/PermissionScreen';
import { StatusCard } from './src/components/StatusCard';
import { CONFIG, configuredChannels } from './src/config';
import { useMonitor } from './src/hooks/useMonitor';
import { t } from './src/i18n';
import { colors } from './src/theme';

function Home() {
  const m = useMonitor();

  if (m.permission !== 'granted') {
    return <PermissionScreen permission={m.permission} onAllow={m.requestLocation} />;
  }

  const channels = configuredChannels();
  const level = m.result?.state.level ?? 'safe';

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={m.checking} onRefresh={m.check} />}
      >
        <Text style={styles.appName}>{t('appName')}</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>

        {channels.length === 0 && <Text style={styles.warn}>{t('channelsNotConfigured')}</Text>}
        {m.isWeb ? (
          m.webSound ? (
            <Text style={styles.ok}>{t('webSoundOn')}</Text>
          ) : (
            <View style={styles.webBox}>
              <Text style={styles.webHint}>{t('webNeedsClick')}</Text>
              <Button title={t('webEnableSound')} onPress={m.enableWebSound} color={colors.danger} />
            </View>
          )
        ) : (
          !m.notifGranted && <Text style={styles.warn}>{t('notifDenied')}</Text>
        )}
        {(m.result?.errors.length ?? 0) > 0 && (
          <Text style={styles.warn}>
            {t('fetchErrors')}: {m.result?.errors.join('; ')}
          </Text>
        )}

        <StatusCard
          level={level}
          hits={m.result?.state.hits ?? []}
          coords={m.coords}
          userZones={m.userZones}
          lastCheck={m.result?.checkedAt ?? null}
        />

        <Button title={m.checking ? t('checking') : t('checkNow')} onPress={m.check} disabled={m.checking} />

        <MessageList messages={m.result?.messages ?? []} userZones={m.userZones} />

        <View style={styles.footer}>
          <Button
            title={t('testAlert')}
            outline
            color={colors.muted}
            onPress={() => {
              const err = m.runTest();
              if (err) Alert.alert(t('appName'), err);
            }}
          />
          <Text style={styles.note}>{t('backgroundNote')}</Text>
          <Text style={styles.note}>{t('disclaimer')}</Text>
          <Text style={styles.link} onPress={() => Linking.openURL(CONFIG.PRIVACY_POLICY_URL)}>
            {t('privacy')}
          </Text>
        </View>
      </ScrollView>

      <AlertOverlay
        hit={m.overlayHit}
        coords={m.coords}
        isTest={m.isTest}
        onClose={m.acknowledge}
        onEnableSound={m.isWeb && !m.webSound ? m.enableWebSound : undefined}
      />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <Home />
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 48 },
  appName: { fontSize: 26, fontWeight: '900', color: colors.text },
  tagline: { fontSize: 14, color: colors.muted, marginBottom: 14 },
  warn: {
    backgroundColor: colors.cautionBg,
    color: colors.caution,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  ok: {
    backgroundColor: colors.safeBg,
    color: colors.safe,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  webBox: { backgroundColor: colors.dangerBg, padding: 12, borderRadius: 12, marginBottom: 12 },
  webHint: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  footer: { marginTop: 18 },
  note: { fontSize: 12, color: colors.muted, marginTop: 12, lineHeight: 17 },
  link: { fontSize: 13, color: colors.primary, marginTop: 12, textDecorationLine: 'underline' },
});
