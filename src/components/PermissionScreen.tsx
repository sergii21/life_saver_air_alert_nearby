import { Linking, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import type { LocPermission } from '../hooks/useMonitor';
import { colors } from '../theme';
import { Button } from './Button';

export function PermissionScreen({ permission, onAllow }: { permission: LocPermission; onAllow: () => void }) {
  const blocked = permission === 'blocked';
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.title}>{t('locTitle')}</Text>
      <Text style={styles.body}>{t('locBody')}</Text>
      {permission !== 'unknown' && <Text style={styles.denied}>{t('locDenied')}</Text>}
      {blocked ? (
        <Button title={t('openSettings')} onPress={() => Linking.openSettings()} style={styles.btn} />
      ) : (
        <Button title={t('allow')} onPress={onAllow} style={styles.btn} />
      )}
      <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 28 },
  icon: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 12, color: colors.text },
  body: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 12, color: colors.muted },
  denied: { fontSize: 15, textAlign: 'center', marginTop: 16, color: colors.danger, fontWeight: '600' },
  btn: { marginTop: 24 },
  disclaimer: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 28 },
});
