import { getLocales } from 'expo-localization';

const uk = {
  appName: 'Тривога Поруч',
  tagline: 'Попередження про загрозу у вашому районі',
  safeTitle: 'Загроз у вашому районі не виявлено',
  safeSub: 'Ми перевіряємо канали кожні {s} с, поки застосунок відкритий.',
  cautionTitle: 'УВАГА: загроза у вашому місті',
  cautionSub: 'Будьте готові пройти в укриття. Слідкуйте за оновленнями.',
  dangerTitle: 'НЕБЕЗПЕКА У ВАШОМУ РАЙОНІ',
  dangerSub: 'Негайно залиште район або пройдіть в укриття.',
  yourLocation: 'Ваше місцезнаходження',
  zonesLabel: 'Зони',
  outsideZones: 'Ви поза відомими зонами (перевірка працює лише в межах налаштованих районів).',
  locating: 'Визначаємо місцезнаходження…',
  lastCheck: 'Остання перевірка',
  never: 'ще не було',
  checkNow: 'Перевірити зараз',
  checking: 'Перевіряємо…',
  recentMessages: 'Останні повідомлення каналів',
  noMessages: 'Повідомлень поки немає.',
  yourZoneTag: 'ВАШ РАЙОН',
  yourCityTag: 'ВАШЕ МІСТО',
  allClearTag: 'ВІДБІЙ',
  channelsNotConfigured: 'Канали Telegram ще не налаштовані. Вкажіть їх у src/config.ts (CHANNELS).',
  fetchErrors: 'Не вдалося прочитати',
  locTitle: 'Потрібен доступ до геолокації',
  locBody:
    'Щоб попередити вас про небезпеку саме у вашому районі, застосунку потрібне ваше місцезнаходження. Воно залишається лише на вашому телефоні і нікуди не передається.',
  allow: 'Дозволити',
  locDenied: 'Доступ до геолокації заборонено. Без нього застосунок не може визначити ваш район.',
  openSettings: 'Відкрити налаштування',
  notifDenied: 'Сповіщення вимкнені — ви не отримаєте попередження у фоні.',
  webEnableSound: '🔊 Увімкнути звук тривоги і сповіщення',
  webSoundOn: '🔊 Звук тривоги увімкнено. Тримайте цю вкладку відкритою (можна у фоні), а комп’ютер — не в режимі сну.',
  webNeedsClick: 'Браузер дозволяє звук лише після натискання кнопки нижче.',
  webTestSound: '🔊 Перевірити звук (2 с)',
  webNotifOn: '🔔 Сповіщення на робочому столі: увімкнені',
  webNotifOff: '🔕 Сповіщення на робочому столі: вимкнені',
  webNotifBlocked: '🔕 Сповіщення заблоковані браузером. Дозвольте їх: значок ліворуч від адреси → Сповіщення → Дозволити.',
  webNotifUnsupported: '🔕 Цей браузер не підтримує сповіщення.',
  webEnableNotif: '🔔 Увімкнути сповіщення',
  leaveNow: 'НЕГАЙНО ЗАЛИШТЕ ЦЕЙ РАЙОН',
  dangerBody: 'У каналі повідомляють про загрозу в районі «{zone}», де ви зараз перебуваєте.',
  cautionBody: 'У каналі повідомляють про загрозу в «{zone}». Будьте готові діяти.',
  advice1: 'Відійдіть щонайменше на {km} км від району або спустіться в найближче укриття.',
  advice2: 'Тримайтеся подалі від вікон. Не знімайте і не поширюйте наслідки ударів.',
  advice3: 'Повідомте рідним, де ви, коли будете в безпеці.',
  routeAway: 'Маршрут геть від небезпеки (~{km} км)',
  findShelter: 'Знайти укриття поруч',
  call: 'Подзвонити {phone}',
  openMessage: 'Відкрити повідомлення в Telegram',
  imSafe: 'Я в безпеці / Закрити',
  messageFrom: 'Повідомлення',
  testAlert: 'Перевірити сигнал тривоги (тест)',
  testAlertBody: 'ТЕСТ: загроза в районі «{zone}». Це перевірка, а не справжня тривога.',
  testNeedsZone: 'Для тесту потрібне місцезнаходження в межах відомої зони.',
  privacy: 'Політика конфіденційності',
  disclaimer:
    'Застосунок не є офіційною системою оповіщення і не замінює сирен та офіційних застосунків. Завжди дійте за сигналом повітряної тривоги.',
  backgroundNote:
    'У фоні перевірка виконується, коли дозволяє система (приблизно раз на 15+ хв). Для найшвидших попереджень тримайте застосунок відкритим.',
  notifTitleDanger: '⚠️ НЕБЕЗПЕКА: {zone}',
  notifTitleCaution: '⚠️ Увага: {zone}',
  notifBodyDanger: 'Загроза у вашому районі. Негайно залиште район або пройдіть в укриття!',
  notifBodyCaution: 'Загроза у вашому місті. Будьте готові пройти в укриття.',
  minutesAgo: '{n} хв тому',
  justNow: 'щойно',
};

type Strings = typeof uk;

const en: Strings = {
  appName: 'Alert Nearby',
  tagline: 'Warnings about threats in your district',
  safeTitle: 'No threats reported in your district',
  safeSub: 'Channels are checked every {s}s while the app is open.',
  cautionTitle: 'CAUTION: threat in your city',
  cautionSub: 'Be ready to go to a shelter. Watch for updates.',
  dangerTitle: 'DANGER IN YOUR DISTRICT',
  dangerSub: 'Leave the area or go to a shelter immediately.',
  yourLocation: 'Your location',
  zonesLabel: 'Zones',
  outsideZones: 'You are outside known zones (checks only work inside configured districts).',
  locating: 'Getting your location…',
  lastCheck: 'Last check',
  never: 'not yet',
  checkNow: 'Check now',
  checking: 'Checking…',
  recentMessages: 'Latest channel messages',
  noMessages: 'No messages yet.',
  yourZoneTag: 'YOUR DISTRICT',
  yourCityTag: 'YOUR CITY',
  allClearTag: 'ALL CLEAR',
  channelsNotConfigured: 'Telegram channels are not configured yet. Set them in src/config.ts (CHANNELS).',
  fetchErrors: 'Could not read',
  locTitle: 'Location access needed',
  locBody:
    'To warn you about danger in your exact district the app needs your location. It stays on your phone and is never sent anywhere.',
  allow: 'Allow',
  locDenied: 'Location access is denied. Without it the app cannot determine your district.',
  openSettings: 'Open Settings',
  notifDenied: 'Notifications are off — you will not get warnings in the background.',
  webEnableSound: '🔊 Enable alarm sound & notifications',
  webSoundOn: '🔊 Alarm sound is on. Keep this tab open (it can be in the background) and the computer awake.',
  webNeedsClick: 'Browsers only allow sound after you click the button below.',
  webTestSound: '🔊 Test sound (2 s)',
  webNotifOn: '🔔 Desktop notifications: on',
  webNotifOff: '🔕 Desktop notifications: off',
  webNotifBlocked: '🔕 Notifications are blocked by the browser. Allow them: icon left of the address → Notifications → Allow.',
  webNotifUnsupported: '🔕 This browser does not support notifications.',
  webEnableNotif: '🔔 Enable notifications',
  leaveNow: 'LEAVE THIS AREA NOW',
  dangerBody: 'The channel reports a threat in "{zone}", where you are right now.',
  cautionBody: 'The channel reports a threat in "{zone}". Be ready to act.',
  advice1: 'Move at least {km} km away from the district or go down to the nearest shelter.',
  advice2: 'Stay away from windows. Do not film or share the aftermath of strikes.',
  advice3: 'Let your family know where you are once you are safe.',
  routeAway: 'Route away from danger (~{km} km)',
  findShelter: 'Find a shelter nearby',
  call: 'Call {phone}',
  openMessage: 'Open message in Telegram',
  imSafe: "I'm safe / Close",
  messageFrom: 'Message',
  testAlert: 'Test the alarm',
  testAlertBody: 'TEST: threat in "{zone}". This is a test, not a real alarm.',
  testNeedsZone: 'The test needs your location inside a known zone.',
  privacy: 'Privacy policy',
  disclaimer:
    'This app is not an official warning system and does not replace sirens or official apps. Always act on the air-raid alarm.',
  backgroundNote:
    'In the background the system decides when to run checks (about every 15+ min). Keep the app open for the fastest warnings.',
  notifTitleDanger: '⚠️ DANGER: {zone}',
  notifTitleCaution: '⚠️ Caution: {zone}',
  notifBodyDanger: 'Threat in your district. Leave the area or go to a shelter now!',
  notifBodyCaution: 'Threat in your city. Be ready to go to a shelter.',
  minutesAgo: '{n} min ago',
  justNow: 'just now',
};

function detectLang(): 'uk' | 'en' {
  try {
    const code = getLocales()[0]?.languageCode ?? 'uk';
    // Ukrainian by default; English only on English-language devices.
    return code === 'en' ? 'en' : 'uk';
  } catch {
    return 'uk';
  }
}

export const lang = detectLang();
const S: Strings = lang === 'en' ? en : uk;

export function t(key: keyof Strings, vars: Record<string, string | number> = {}): string {
  return S[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export const zoneName = (z: { name: string; nameEn?: string }) => (lang === 'en' && z.nameEn ? z.nameEn : z.name);

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const min = Math.floor((now - Date.parse(iso)) / 60_000);
  if (min < 1) return t('justNow');
  if (min < 60) return t('minutesAgo', { n: min });
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
