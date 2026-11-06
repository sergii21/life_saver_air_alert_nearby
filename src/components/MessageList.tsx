import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t, timeAgo } from '../i18n';
import { isAllClear, zonesMentioned } from '../lib/evaluate';
import { open } from '../lib/links';
import { messageUrl } from '../lib/telegram';
import { colors } from '../theme';
import type { ChannelMessage, Zone } from '../types';

export function MessageList({ messages, userZones }: { messages: ChannelMessage[]; userZones: Zone[] }) {
  const userIds = new Set(userZones.map((z) => z.id));
  const sorted = [...messages]
    .sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? ''))
    .slice(0, 15);

  return (
    <View>
      <Text style={styles.header}>{t('recentMessages')}</Text>
      {sorted.length === 0 && <Text style={styles.empty}>{t('noMessages')}</Text>}
      {sorted.map((m) => {
        const mentioned = zonesMentioned(m).filter((z) => userIds.has(z.id));
        const clear = mentioned.length > 0 && isAllClear(m);
        const mine = !clear && mentioned.some((z) => z.kind === 'district');
        const city = !clear && !mine && mentioned.length > 0;
        return (
          <Pressable
            key={`${m.channel}/${m.id}`}
            onPress={() => open(messageUrl(m))}
            style={[styles.item, mine && styles.itemMine, city && styles.itemCity, clear && styles.itemClear]}
          >
            <View style={styles.meta}>
              <Text style={styles.channel}>@{m.channel}</Text>
              <Text style={styles.time}>{timeAgo(m.date)}</Text>
            </View>
            {mine && <Text style={styles.tag}>{t('yourZoneTag')}</Text>}
            {city && <Text style={[styles.tag, { color: colors.caution }]}>{t('yourCityTag')}</Text>}
            {clear && <Text style={[styles.tag, { color: colors.safe }]}>{t('allClearTag')}</Text>}
            <Text style={styles.text} numberOfLines={6}>
              {m.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 22, marginBottom: 8 },
  empty: { color: colors.muted, fontSize: 14 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemMine: { borderColor: colors.danger, borderWidth: 2, backgroundColor: colors.dangerBg },
  itemClear: { borderColor: colors.safe, borderWidth: 2, backgroundColor: colors.safeBg },
  itemCity: { borderColor: colors.caution, borderWidth: 2, backgroundColor: colors.cautionBg },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  channel: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  time: { fontSize: 12, color: colors.muted },
  tag: { fontSize: 11, fontWeight: '800', color: colors.danger, marginTop: 4 },
  text: { fontSize: 15, color: colors.text, marginTop: 6, lineHeight: 21 },
});
