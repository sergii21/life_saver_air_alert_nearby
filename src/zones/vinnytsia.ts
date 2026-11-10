import type { Zone, ZoneKind } from '../types';

/**
 * Vinnytsia (Ukraine) — location table: city micro-districts, nearby villages and
 * oblast towns. The app compares the user's GPS position with this table, then looks
 * for the names of the user's zone(s) in the Telegram posts.
 *
 * Coordinates of the city micro-districts and nearby villages come from OpenStreetMap
 * place nodes (© OpenStreetMap contributors, ODbL), fetched 2026-11-10. Radii are
 * estimates: OSM has a point per district, not a boundary. Tune a row if the app
 * places you in the wrong district.
 *
 * Keywords follow the spellings the channel really uses (checked against 1,200 posts
 * of @vinnytsiappo), e.g. "ГПЗ", "Хутори", "Бучми", "Лука М.", "Зарваниці".
 * Rules: lowercase; "word*" = prefix (catches Ukrainian case endings: Замостя /
 * Замості / Замостю), plain "word" = whole word or phrase only. Apostrophes
 * (' ’ ʼ `) are normalised, so "слов'янк*" also matches "Слов’янка".
 *
 * Row: [id, name, English name, latitude, longitude, radius km, keywords]
 */
type Row = [string, string, string, number, number, number, string[]];

// ── City micro-districts (match → DANGER, "leave the area") ──
const CITY_DISTRICTS: Row[] = [
  ['center', 'Центр', 'City Center', 49.2326, 28.4687, 0.9, ['центр міст*', 'центрі міст*', 'центральн* частин*']],
  ['sadky', 'Садки', 'Sadky', 49.2295, 28.4601, 0.6, ['садки', 'садках', 'садків']],
  ['koriatovychiv', 'Масив Коріатовичів', 'Koriatovychiv', 49.2235, 28.4557, 0.7, ['коріатович*', 'свердловськ* масив*']],
  ['urozhai', 'Урожай', 'Urozhai', 49.2269, 28.4477, 0.8, ['урожай', 'урожаї', 'урожаю', 'урожаєм']],
  ['stare-misto', 'Старе місто', 'Old Town', 49.2206, 28.4856, 1.3, ['старе місто', 'старого міста', 'старому місті', 'старим містом']],
  ['piatnychany', "П'ятничани", 'Piatnychany', 49.2497, 28.462, 1.0, ["п'ятничан*", 'пятничан*']],
  ['slovianka', "Слов'янка", 'Slovianka', 49.2265, 28.4395, 1.0, ["слов'янк*", "слов'янц*", 'словянк*', 'словянц*']],
  ['dubovetska-slobidka', 'Дубовецька слобідка', 'Dubovetska Slobidka', 49.2297, 28.4972, 0.7, ['дубовецьк*']],
  ['zamostia', 'Замостя', 'Zamostia', 49.2424, 28.4946, 1.5, ['замост*', 'замостянськ*']],
  ['vokzal', 'Вокзал', 'Railway station', 49.2393, 28.5111, 0.8, ['вокзал*', 'посьол*']],
  ['koreia', 'Корея', 'Koreia', 49.2443, 28.443, 0.8, ['корея', 'кореї', 'корею']],
  ['podillia', 'Поділля', 'Podillia', 49.2191, 28.4448, 0.9, ['поділля', 'поділлі', 'мкр поділл*', 'мікрорайон* поділл*']],
  ['tsaryna', 'Царина', 'Tsaryna', 49.2104, 28.4679, 0.8, ['царин*']],
  ['kyivska', 'Київська', 'Kyivska', 49.2554, 28.4747, 1.2, ['київська', 'київській', 'київську', 'київської', 'водоканал*', 'можайк*']],
  ['kuba', 'Куба', 'Kuba', 49.2368, 28.432, 0.6, ['куба', 'кубі', 'кубу']],
  ['elektromerezha', 'Електромережа', 'Elektromerezha', 49.2132, 28.4307, 0.8, ['електромереж*']],
  ['vyshenka', 'Вишенька', 'Vyshenka', 49.2281, 28.413, 1.5, ['вишеньк*', 'вишеньц*']],
  ['maslozhyr', 'Масложир', 'Maslozhyr', 49.2261, 28.523, 0.9, ['масложир*', 'олієжир*', 'олійножир*']],
  ['viiskove-mistechko', 'Військове містечко', 'Viiskove Mistechko', 49.2338, 28.5252, 0.9, ['військов* містечк*']],
  ['sabariv', 'Сабарів', 'Sabariv', 49.1974, 28.4511, 1.2, ['сабар*']],
  // The channel writes just "Хутори" and "Бучми" for this side of the city.
  ['mali-khutory', 'Малі Хутори', 'Mali Khutory', 49.2131, 28.5178, 1.2, ['малі хутори', 'малих хутор*', 'хутори', 'хуторів', 'хуторах', 'бучм*']],
  ['medhorodok', 'Медгородок', 'Medhorodok', 49.2387, 28.4103, 0.8, ['медгородок', 'медгородк*', 'медмістечк*']],
  ['akademichnyi', 'Академічний', 'Akademichnyi', 49.2057, 28.422, 1.0, ['академічн*']],
  ['khutir-shevchenka', 'Хутір Шевченка', 'Khutir Shevchenka', 49.2586, 28.5204, 0.9, ['хутір шевченк*', 'хуторі шевченк*', 'хутора шевченк*']],
  // OSM calls it "ВПЗ"; the channel writes "ГПЗ".
  ['hpz', 'ГПЗ', 'HPZ', 49.2706, 28.5094, 1.2, ['гпз', 'впз']],
  ['tiazhyliv', 'Тяжилів', 'Tiazhyliv', 49.2498, 28.5384, 1.5, ['тяжил*']],
  ['tsarske-selo', 'Царське село', 'Tsarske Selo', 49.2062, 28.4054, 0.8, ['царськ* сел*']],
  ['barske-shose', 'Барське шосе', 'Barske Shose', 49.2363, 28.3911, 0.9, ['барськ* шосе', 'барському шосе']],
  // Not "пирогов*" — that would also match "вул. Пирогова" / Pirogov museum.
  ['pyrohovo', 'Пирогово', 'Pyrohovo', 49.2169, 28.3931, 1.3, ['пирогово', 'пироговому', 'пироговим', 'пирогове']],
  ['nemyrivske-shose', 'Немирівське шосе', 'Nemyrivske Shose', 49.2213, 28.5486, 1.5, ['немирівськ* шосе', 'немирівському шосе', 'немирівського шосе']],
  ['aeroport', 'Аеропорт', 'Airport', 49.2412, 28.6025, 1.5, ['аеропорт*']],
];

// ── Villages and settlements around the city (match → DANGER) ──
const NEARBY_SETTLEMENTS: Row[] = [
  ['stryzhavka', 'Стрижавка', 'Stryzhavka', 49.3098, 28.4731, 2.5, ['стрижав*']],
  ['desna', 'Десна', 'Desna', 49.2844, 28.54, 1.2, ['десна', 'десну', 'десни', 'десні']],
  ['vinnytski-khutory', 'Вінницькі Хутори', 'Vinnytski Khutory', 49.2047, 28.5507, 2.0, ['вінницьк* хутор*', 'хутори', 'хуторів', 'хуторах']],
  ['zarvantsi', 'Зарванці', 'Zarvantsi', 49.2585, 28.3871, 1.5, ['зарван*']],
  ['yakushyntsi', 'Якушинці', 'Yakushyntsi', 49.2597, 28.3667, 1.5, ['якушин*']],
  ['ahronomichne', 'Агрономічне', 'Ahronomichne', 49.1928, 28.372, 2.5, ['агрономічн*']],
  ['berezyna', 'Березина', 'Berezyna', 49.2228, 28.3508, 1.0, ['березин*']],
  ['lysohora', 'Лисогора', 'Lysohora', 49.2667, 28.3348, 1.0, ['лисогор*']],
  ['ksaverivka', 'Ксаверівка', 'Ksaverivka', 49.2592, 28.3021, 1.0, ['ксаверівк*', 'ксаверівц*']],
  ['lukashivka', 'Лукашівка', 'Lukashivka', 49.2771, 28.2671, 1.0, ['лукашівк*', 'лукашівц*']],
  ['dashkivtsi', 'Дашківці', 'Dashkivtsi', 49.2985, 28.2688, 1.5, ['дашківц*']],
  ['medvezhe-vushko', 'Медвеже Вушко', 'Medvezhe Vushko', 49.1828, 28.3113, 1.5, ['медвеж* вушк*']],
  ['bokhonyky', 'Бохоники', 'Bokhonyky', 49.1659, 28.3688, 1.5, ['бохоник*']],
  ['shkuryntsi', 'Шкуринці', 'Shkuryntsi', 49.18, 28.4143, 1.0, ['шкуринц*']],
  ['prybuzke', 'Прибузьке', 'Prybuzke', 49.1737, 28.4275, 1.0, ['прибузьк*']],
  ['tiutky', 'Тютьки', 'Tiutky', 49.1758, 28.4507, 1.0, ['тютьк*']],
  ['urozhaine', 'Урожайне', 'Urozhaine', 49.1448, 28.3878, 1.0, ['урожайн*']],
  // The channel also writes "Лука" and "Лука М.".
  ['luka-meleshkivska', 'Лука-Мелешківська', 'Luka-Meleshkivska', 49.1739, 28.4956, 1.8, ['лука м*', 'лука-мелешк*', 'луки-мелешк*', 'луці-мелешк*', 'луку-мелешк*', 'лука', 'луку', 'луки', 'луці']],
  ['yaryshivka', 'Яришівка', 'Yaryshivka', 49.116, 28.4652, 1.5, ['яришівк*', 'яришівц*']],
  ['maidan-chapelskyi', 'Майдан-Чапельський', 'Maidan-Chapelskyi', 49.1876, 28.5348, 1.0, ['майдан* чапельськ*']],
  ['parpurivtsi', 'Парпурівці', 'Parpurivtsi', 49.1718, 28.533, 1.0, ['парпурівц*']],
  ['khyzhyntsi', 'Хижинці', 'Khyzhyntsi', 49.1735, 28.5707, 1.5, ['хижин*']],
  ['shchitky', 'Щітки', 'Shchitky', 49.1989, 28.5868, 1.5, ['щітки', 'щітках', 'щіток']],
  ['pysarivka', 'Писарівка', 'Pysarivka', 49.1916, 28.6017, 1.5, ['писарівк*', 'писарівц*']],
  ['sokyryntsi', 'Сокиринці', 'Sokyryntsi', 49.1703, 28.6101, 1.5, ['сокиринц*']],
  ['havryshivka', 'Гавришівка', 'Havryshivka', 49.243, 28.6391, 1.5, ['гавриш*']],
  ['mali-krushlyntsi', 'Малі Крушлинці', 'Mali Krushlyntsi', 49.2494, 28.6719, 1.5, ['крушлинц*']],
  ['humenne', 'Гуменне', 'Humenne', 49.1931, 28.6996, 1.0, ['гуменн*']],
  ['komariv', 'Комарів', 'Komariv', 49.1425, 28.674, 1.5, ['комарів', 'комарова', 'комарові']],
  ['stadnytsia', 'Стадниця', 'Stadnytsia', 49.2866, 28.6036, 1.5, ['стадниц*']],
  ['sosonka', 'Сосонка', 'Sosonka', 49.3334, 28.5768, 1.5, ['сосонк*', 'сосонц*']],
  ['lavrivka', 'Лаврівка', 'Lavrivka', 49.3475, 28.4618, 1.0, ['лаврівк*', 'лаврівц*']],
  ['pereorky', 'Переорки', 'Pereorky', 49.3162, 28.4048, 1.0, ['переорк*']],
  ['tiutiunnyky', 'Тютюнники', 'Tiutiunnyky', 49.3347, 28.4023, 1.0, ['тютюнник*']],
  ['miziakivski-khutory', 'Мізяківські Хутори', 'Miziakivski Khutory', 49.3338, 28.36, 1.5, ['мізяківськ* хутор*']],
  ['turbiv', 'Турбів', 'Turbiv', 49.3399, 28.7261, 2.5, ['турбів', 'турбов*']],
  ['hnivan', 'Гнівань', 'Hnivan', 49.0934, 28.3383, 2.5, ['гніван*']],
  ['sutysky', 'Сутиски', 'Sutysky', 49.0454, 28.4182, 2.0, ['сутиск*']],
  ['tyvriv', 'Тиврів', 'Tyvriv', 49.014, 28.508, 2.5, ['тиврів', 'тивров*']],
  ['lityn', 'Літин', 'Lityn', 49.329, 28.074, 2.5, ['літин*']],
  ['voronovytsia', 'Вороновиця', 'Voronovytsia', 49.1118, 28.6889, 2.5, ['вороновиц*']],
];

// ── Oblast towns — the channel covers the whole oblast ("❗️ЛАДИЖИН, в укриття"). ──
// Whole town = one zone (match → DANGER). Approximate centers, radius ~ town size.
const OBLAST_TOWNS: Row[] = [
  ['ladyzhyn', 'Ладижин', 'Ladyzhyn', 48.684, 29.236, 3, ['ладижин*']],
  ['haisyn', 'Гайсин', 'Haisyn', 48.811, 29.389, 3.5, ['гайсин*']],
  ['nemyriv', 'Немирів', 'Nemyriv', 48.971, 28.838, 3, ['немирів', 'немиров*']],
  ['illintsi', 'Іллінці', 'Illintsi', 49.105, 29.218, 3, ['іллінц*', 'іллінець']],
  ['bratslav', 'Брацлав', 'Bratslav', 48.824, 28.942, 2.5, ['брацлав*']],
  ['zhmerynka', 'Жмеринка', 'Zhmerynka', 49.039, 28.108, 3.5, ['жмеринк*', 'жмеринц*']],
  ['khmilnyk', 'Хмільник', 'Khmilnyk', 49.557, 27.957, 3.5, ['хмільник*']],
  ['koziatyn', 'Козятин', 'Koziatyn', 49.716, 28.833, 3.5, ['козятин*']],
  ['kalynivka', 'Калинівка', 'Kalynivka', 49.448, 28.523, 3, ['калинівк*', 'калинівц*']],
  ['tulchyn', 'Тульчин', 'Tulchyn', 48.675, 28.849, 3, ['тульчин*']],
  ['mohyliv-podilskyi', 'Могилів-Подільський', 'Mohyliv-Podilskyi', 48.446, 27.79, 4, ['могилів*', 'могилев*']],
  ['bar', 'Бар', 'Bar', 49.075, 27.68, 3, ['бар', 'бару', 'бара', 'барі']],
  ['bershad', 'Бершадь', 'Bershad', 48.368, 29.516, 3, ['бершад*']],
  ['lypovets', 'Липовець', 'Lypovets', 49.215, 29.056, 2.5, ['липовець', 'липовц*']],
  ['pohrebyshche', 'Погребище', 'Pohrebyshche', 49.487, 29.265, 2.5, ['погребищ*']],
];

// ── Whole city (match → CAUTION, "be ready / go to shelter") ──
// Whole words only, so "Вінницька область" (oblast-wide alarms) does NOT match.
const WHOLE_CITY: Row[] = [
  ['vinnytsia-city', 'Вінниця', 'Vinnytsia', 49.2331, 28.4682, 9,
    ['вінниця', 'вінниці', 'вінницю', 'вінницею', 'винница', 'виннице', 'винницу', 'vinnytsia']],
];

const toZones = (rows: Row[], kind: ZoneKind): Zone[] =>
  rows.map(([id, name, nameEn, latitude, longitude, radiusKm, keywords]) => ({
    id, name, nameEn, kind, center: { latitude, longitude }, radiusKm, keywords,
  }));

export const VINNYTSIA_ZONES: Zone[] = [
  ...toZones(CITY_DISTRICTS, 'district'),
  ...toZones(NEARBY_SETTLEMENTS, 'district'),
  ...toZones(OBLAST_TOWNS, 'district'),
  ...toZones(WHOLE_CITY, 'area'),
];
