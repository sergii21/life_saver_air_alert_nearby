/**
 * Other towns of Vinnytsia oblast that the channel names as the place a target is heading
 * to ("Реактивний Шахед на Теплик"). They are used for the "Targets" list and the map only;
 * the districts the user is alerted for live in vinnytsia.ts.
 *
 * Coordinates: OpenStreetMap. Keywords follow the same syntax as zones ("*" = prefix).
 */
import type { Place } from '../lib/threat';

type Row = [id: string, name: string, nameEn: string, lat: number, lon: number, keywords: string[]];

const ROWS: Row[] = [
  ['ivaniv', 'Іванів', 'Ivaniv', 49.4853, 28.3424, ['іванів', 'іванов*']],
  ['berezivka', 'Березівка', 'Berezivka', 48.5993, 28.1027, ['березівк*']],
  ['borivka', 'Борівка', 'Borivka', 48.5069, 28.2555, ['борівк*']],
  ['brailiv', 'Браїлів', 'Brailiv', 49.1092, 28.1595, ['браїлів', 'браїлов*']],
  ['brodetske', 'Бродецьке', 'Brodetske', 49.7632, 28.6449, ['бродецьк*']],
  ['vapniarka', 'Вапнярка', 'Vapniarka', 48.5312, 28.7468, ['вапнярк*']],
  ['velyka-kisnytsia', 'Велика Кісниця', 'Velyka Kisnytsia', 48.1342, 28.4408, ['велик* кісниц*']],
  ['vendychany', 'Вендичани', 'Vendychany', 48.6096, 27.7881, ['вендичан*']],
  ['vyshcheolchedaiv', 'Вищеольчедаїв', 'Vyshcheolchedaiv', 48.7271, 27.6801, ['вищеольчедаїв*']],
  ['hlukhivtsi', 'Глухівці', 'Hlukhivtsi', 49.7736, 28.7289, ['глухівц*']],
  ['horodkivka', 'Городківка', 'Horodkivka', 48.3806, 28.687, ['городківк*']],
  ['dashiv', 'Дашів', 'Dashiv', 49.0028, 29.4403, ['дашів', 'дашов*']],
  ['dzhulynka', 'Джулинка', 'Dzhulynka', 48.444, 29.7482, ['джулинк*']],
  ['dzhuryn', 'Джурин', 'Dzhuryn', 48.6813, 28.2921, ['джурин*']],
  ['dzygivka', 'Дзиґівка', 'Dzygivka', 48.354, 28.3163, ['дзиґівк*']],
  ['kyrnasivka', 'Кирнасівка', 'Kyrnasivka', 48.5929, 28.9842, ['кирнасівк*']],
  ['klekotyna', 'Клекотина', 'Klekotyna', 48.7919, 28.216, ['клекотин*']],
  ['klembivka', 'Клембівка', 'Klembivka', 48.3825, 28.4135, ['клембівк*']],
  ['kopaihorod', 'Копайгород', 'Kopaihorod', 48.8565, 27.7985, ['копайгород*']],
  ['kordelivka', 'Корделівка', 'Kordelivka', 49.526, 28.5403, ['корделівк*']],
  ['kryzhopil', 'Крижопіль', 'Kryzhopil', 48.3857, 28.8694, ['крижопіль', 'крижопол*']],
  ['mazurivka', 'Мазурівка', 'Mazurivka', 48.5346, 28.1377, ['мазурівк*']],
  ['murafa', 'Мурафа', 'Murafa', 48.7756, 28.2164, ['мураф*']],
  ['murovani-kurylivtsi', 'Муровані Курилівці', 'Murovani Kurylivtsi', 48.7147, 27.5331, ['мурован* курилівц*']],
  ['novofastiv', 'Новофастів', 'Novofastiv', 49.5759, 29.4539, ['новофастів', 'новофастов*']],
  ['obodivka', 'Ободівка', 'Obodivka', 48.4044, 29.2435, ['ободівк*']],
  ['orativ', 'Оратів', 'Orativ', 49.1947, 29.5306, ['оратів', 'оратов*']],
  ['penkivka', 'Пеньківка', 'Penkivka', 48.8957, 28.2625, ['пеньківк*']],
  ['plyskiv', 'Плисків', 'Plyskiv', 49.371, 29.2824, ['плисків', 'плисков*']],
  ['pishchanka', 'Піщанка', 'Pishchanka', 48.2078, 28.8865, ['піщанк*']],
  ['raihorod', 'Райгород', 'Raihorod', 48.8798, 29.0792, ['райгород*']],
  ['rakhny-lisovi', 'Рахни-Лісові', 'Rakhny-Lisovi', 48.7818, 28.4803, ['рахн* лісов*']],
  ['rudnytsia', 'Рудниця', 'Rudnytsia', 48.2571, 28.9349, ['рудниц*']],
  ['samhorodok', 'Самгородок', 'Samhorodok', 49.5337, 28.8451, ['самгородок', 'самгородк*']],
  ['sytkivtsi', 'Ситківці', 'Sytkivtsi', 48.9096, 29.2023, ['ситківц*']],
  ['spychyntsi', 'Спичинці', 'Spychyntsi', 49.4134, 29.1636, ['спичинц*']],
  ['stanislavchyk', 'Станіславчик', 'Stanislavchyk', 48.969, 28.1059, ['станіславчик*']],
  ['teplyk', 'Теплик', 'Teplyk', 48.6636, 29.7469, ['теплик*']],
  ['tomashpil', 'Томашпіль', 'Tomashpil', 48.5488, 28.5188, ['томашпіль', 'томашпол*']],
  ['trostianets', 'Тростянець', 'Trostianets', 48.5123, 29.2227, ['тростянець', 'тростянц*']],
  ['uladivka', 'Уладівка', 'Uladivka', 49.4999, 28.2276, ['уладівк*']],
  ['ulaniv', 'Уланів', 'Ulaniv', 49.694, 28.1323, ['уланів', 'уланов*']],
  ['cherepashyntsi', 'Черепашинці', 'Cherepashyntsi', 49.5374, 28.5983, ['черепашинц*']],
  ['chernivtsi', 'Чернівці', 'Chernivtsi', 48.5407, 28.1221, ['чернівц*']],
  ['chechelnyk', 'Чечельник', 'Chechelnyk', 48.2127, 29.3599, ['чечельник*']],
  ['sharhorod', 'Шаргород', 'Sharhorod', 48.7498, 28.0832, ['шаргород*']],
  ['shpykiv', 'Шпиків', 'Shpykiv', 48.7861, 28.5648, ['шпиків', 'шпиков*']],
  ['yampil', 'Ямпіль', 'Yampil', 48.2456, 28.2853, ['ямпіль', 'ямпол*']],
  // Raions named as a destination ("на Хмільницький район"): shown at the raion centre.
  ['khmilnyk-raion', 'Хмільницький район', 'Khmilnyk raion', 49.5562, 27.9491, ['хмільницьк* район*']],
  ['zhmerynka-raion', 'Жмеринський район', 'Zhmerynka raion', 49.0355, 28.1147, ['жмеринськ* район*']],
  ['vinnytsia-raion', 'Вінницький район', 'Vinnytsia raion', 49.232, 28.468, ['вінницьк* район*']],
];

export const OBLAST_PLACES: Place[] = ROWS.map(([id, name, nameEn, latitude, longitude, keywords]) => ({
  id, name, nameEn, center: { latitude, longitude }, keywords,
}));
