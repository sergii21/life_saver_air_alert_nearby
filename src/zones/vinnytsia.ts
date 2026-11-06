import type { Zone } from '../types';

/**
 * Vinnytsia (Ukraine) — districts / neighbourhoods and nearby settlements.
 *
 * ⚠️  Centers and radii are APPROXIMATE (POC). Before release, open each center in
 * Google Maps, adjust lat/lng/radius, and add the exact spellings your Telegram
 * channels use (look at 20–30 real posts). See docs/ZONES.md.
 *
 * Keyword rules: lowercase; "word*" = prefix (catches Ukrainian case endings:
 * Замостя / Замості / Замостю), plain "word" = whole word or phrase only.
 * Apostrophes (' ’ ʼ `) are normalised, so "слов'янк*" also matches "Слов’янка".
 */
export const VINNYTSIA_ZONES: Zone[] = [
  // ── City districts / neighbourhoods (match → DANGER, "leave the area") ──
  {
    id: 'center', name: 'Центр', nameEn: 'City Center', kind: 'district',
    center: { latitude: 49.2335, longitude: 28.468 }, radiusKm: 1.3,
    keywords: ['центр міст*', 'центрі міст*', 'центральн* частин*'],
  },
  {
    id: 'stare-misto', name: 'Старе місто', nameEn: 'Old Town', kind: 'district',
    center: { latitude: 49.238, longitude: 28.49 }, radiusKm: 1.2,
    keywords: ['старе місто', 'старого міста', 'старому місті', 'старим містом'],
  },
  {
    id: 'zamostia', name: 'Замостя', nameEn: 'Zamostia', kind: 'district',
    center: { latitude: 49.233, longitude: 28.5 }, radiusKm: 1.6,
    keywords: ['замост*', 'замостянськ*'],
  },
  {
    id: 'vyshenka', name: 'Вишенька', nameEn: 'Vyshenka', kind: 'district',
    center: { latitude: 49.213, longitude: 28.42 }, radiusKm: 1.8,
    keywords: ['вишеньк*', 'вишеньц*'],
  },
  {
    id: 'tiazhyliv', name: 'Тяжилів', nameEn: 'Tiazhyliv', kind: 'district',
    center: { latitude: 49.26, longitude: 28.46 }, radiusKm: 1.5,
    keywords: ['тяжил*'],
  },
  {
    id: 'slovianka', name: "Слов'янка", nameEn: 'Slovianka', kind: 'district',
    center: { latitude: 49.25, longitude: 28.515 }, radiusKm: 1.2,
    keywords: ["слов'янк*", "слов'янц*", 'словянк*', 'словянц*'],
  },
  {
    id: 'pyrohovo', name: 'Пирогово', nameEn: 'Pyrohovo', kind: 'district',
    center: { latitude: 49.201, longitude: 28.505 }, radiusKm: 1.5,
    // Not "пирогов*" — that would also match "вул. Пирогова" / Pirogov museum.
    keywords: ['пирогово', 'пироговому', 'пироговим', 'пирогове'],
  },
  {
    id: 'sabariv', name: 'Сабарів', nameEn: 'Sabariv', kind: 'district',
    center: { latitude: 49.199, longitude: 28.48 }, radiusKm: 1.2,
    keywords: ['сабар*'],
  },
  {
    id: 'podillia', name: 'Поділля', nameEn: 'Podillia', kind: 'district',
    center: { latitude: 49.233, longitude: 28.425 }, radiusKm: 1.0,
    keywords: ['поділля', 'поділлі', 'мкр поділл*', 'мікрорайон* поділл*'],
  },
  {
    id: 'elektromerezha', name: 'Електромережа', nameEn: 'Elektromerezha', kind: 'district',
    center: { latitude: 49.245, longitude: 28.505 }, radiusKm: 1.0,
    keywords: ['електромереж*'],
  },
  {
    id: 'akademichnyi', name: 'Академічний', nameEn: 'Akademichnyi', kind: 'district',
    center: { latitude: 49.219, longitude: 28.4 }, radiusKm: 1.0,
    keywords: ['академічн*'],
  },
  {
    id: 'khutir-shevchenka', name: 'Хутір Шевченка', nameEn: 'Khutir Shevchenka', kind: 'district',
    center: { latitude: 49.238, longitude: 28.44 }, radiusKm: 0.8,
    keywords: ['хутір шевченк*', 'хуторі шевченк*', 'хутора шевченк*'],
  },
  {
    id: 'tsarske-selo', name: 'Царське село', nameEn: 'Tsarske Selo', kind: 'district',
    center: { latitude: 49.222, longitude: 28.505 }, radiusKm: 0.8,
    keywords: ['царськ* сел*'],
  },
  // ── Suburbs / nearby settlements (match → DANGER) ──
  {
    id: 'havryshivka', name: 'Гавришівка / аеропорт', nameEn: 'Havryshivka / airport', kind: 'district',
    center: { latitude: 49.2425, longitude: 28.6135 }, radiusKm: 2.0,
    keywords: ['гавриш*', 'аеропорт*'],
  },
  {
    id: 'stryzhavka', name: 'Стрижавка', nameEn: 'Stryzhavka', kind: 'district',
    center: { latitude: 49.31, longitude: 28.48 }, radiusKm: 2.5,
    keywords: ['стрижав*'],
  },
  {
    id: 'ahronomichne', name: 'Агрономічне', nameEn: 'Ahronomichne', kind: 'district',
    center: { latitude: 49.207, longitude: 28.38 }, radiusKm: 1.5,
    keywords: ['агрономічн*'],
  },
  {
    id: 'yakushyntsi', name: 'Якушинці', nameEn: 'Yakushyntsi', kind: 'district',
    center: { latitude: 49.27, longitude: 28.37 }, radiusKm: 1.5,
    keywords: ['якушин*'],
  },
  // ── Whole city (match → CAUTION, "be ready / go to shelter") ──
  {
    id: 'vinnytsia-city', name: 'Вінниця', nameEn: 'Vinnytsia', kind: 'area',
    center: { latitude: 49.2331, longitude: 28.4682 }, radiusKm: 9,
    // Whole words only, so "Вінницька область" (oblast-wide alarms) does NOT match.
    keywords: ['вінниця', 'вінниці', 'вінницю', 'вінницею', 'винница', 'виннице', 'винницу', 'vinnytsia'],
  },
];
