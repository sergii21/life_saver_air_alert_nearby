import { evaluate, hitKey } from '../src/lib/evaluate';
import { aheadZones, cleanMotion, motionMode } from '../src/lib/motion';
import { activeThreats, parseThreats, relationToUser, trackCourse } from '../src/lib/threat';
import type { ChannelMessage } from '../src/types';

const NOW = Date.parse('2026-11-10T12:00:00Z');
let nextId = 1;
const msg = (text: string, minutesAgo = 1): ChannelMessage => ({
  channel: 'vinnytsiappo',
  id: nextId++,
  date: new Date(NOW - minutesAgo * 60_000).toISOString(),
  text,
});
const one = (text: string) => parseThreats(msg(text));
const ids = (text: string) => one(text).map((t) => t.targets.map((p) => p.id));

describe('targets: number, kind and direction from real channel posts', () => {
  test('"Реактивний Шахед на Теплик" — one jet track, no number', () => {
    const [t] = one('🛵 Реактивний Шахед на Теплик');
    expect(t.kind).toBe('jet');
    expect(t.count).toBeNull();
    expect(t.targets.map((p) => p.name)).toEqual(['Теплик']);
  });

  test('"на Дашів / Іллінці" — two destinations', () => {
    expect(ids('🛵 Реактивний Шахед на Дашів / Іллінці')).toEqual([['dashiv', 'illintsi']]);
  });

  test('number as a digit, with "+", as a word and as a range', () => {
    expect(one('🛵 1 Реактивний Шахед на Погребище')[0].count).toEqual({ min: 1, max: 1 });
    expect(one('🛵 +1 Новий Реактивний Шахед на Гайсинський район зі сходу')[0].count).toEqual({ min: 1, max: 1 });
    expect(one('Два шахеди в напрямку Калинівки')[0].count).toEqual({ min: 2, max: 2 });
    expect(one('Один або два або три Шахеди на Козятин')[0].count).toEqual({ min: 1, max: 3 });
    expect(one('2-3 Реактиви на Немирів')[0].count).toEqual({ min: 2, max: 3 });
    expect(one('Декілька Шахедів курсом на Турбів')[0]).toMatchObject({ count: null, several: true });
  });

  test('"в сектор Оратів - Липовець - Іллінці" — three places, two targets', () => {
    const [t] = one('🛵 2 нових Реактиви в сектор Оратів - Липовець - Іллінці');
    expect(t.count).toEqual({ min: 2, max: 2 });
    expect(t.targets.map((p) => p.id)).toEqual(['orativ', 'lypovets', 'illintsi']);
  });

  test('"повз Немирів на Рахни-Лісові" — passed place and course', () => {
    const [t] = one('🛵 1 Реактив повз Немирів на Рахни-Лісові');
    expect(t.via.map((p) => p.id)).toEqual(['nemyriv']);
    expect(t.targets.map((p) => p.id)).toEqual(['rakhny-lisovi']);
    // Рахни-Лісові lie south-west of Немирів.
    expect(trackCourse(t)).toBeGreaterThan(200);
    expect(trackCourse(t)).toBeLessThan(260);
  });

  test('"зі сходу" gives the side it comes from; the course is the opposite', () => {
    const [t] = one('🛵 +1 Новий Реактивний Шахед на Гайсинський район зі сходу');
    expect(t.from).toBe('E');
    expect(trackCourse(t)).toBe(270);
  });

  test('a list post gives one track per line', () => {
    const tracks = one('❗️Обстановка по Шахедах над Вінниччиною:\n▪️1 🛵 на Уланів;\n▪️2 🛵 на Липовець.');
    expect(tracks.map((t) => [t.count?.min, t.kind, t.targets[0].id])).toEqual([
      [1, 'shahed', 'ulaniv'],
      [2, 'shahed', 'lypovets'],
    ]);
  });

  test('region-wide post: "летять в напрямку Вінниччини зі сходу"', () => {
    const [t] = one('🛵 2 Реактивні Шахеди летять в напрямку Вінниччини зі сходу');
    expect(t).toMatchObject({ region: true, kind: 'jet', from: 'E', count: { min: 2, max: 2 } });
  });

  test('city districts are found too, and news / all-clear posts give no tracks', () => {
    expect(ids('Шахед курсом на Урожай')).toEqual([['urozhai']]);
    expect(one('📡 Чисто на Вінниччині 🫡')).toEqual([]);
    expect(one('🛵 Декілька Реактивних Шахедів в сусідніх областях\nПоки що не до нас')).toEqual([]);
    expect(one('❗️Росія готує удари по підприємствах харчової промисловості України')).toEqual([]);
  });

  test('oblast-wide ballistic threat is a track; a target leaving the oblast is not', () => {
    expect(one('❗️Загроза балістики на Вінниччині\nТривога по всій Вінницькій області.')[0]).toMatchObject({ region: true, kind: 'ballistic' });
    expect(one('▪️1 🛵 повз Уланів на виліт;')).toEqual([]);
    expect(one('❗️Обстановка по Шахедах над Вінниччиною:')).toEqual([]);
  });

  test('balistics and time stamps are not read as a number of targets', () => {
    expect(one('❗️Загроза балістики на Калинівку о 10:45')[0]).toMatchObject({ kind: 'ballistic', count: null });
  });
});

describe('active targets', () => {
  test('an oblast-wide all-clear removes older tracks, newer ones stay', () => {
    const messages = [
      msg('🛵 Реактивний Шахед на Теплик', 20),
      msg('📡 Чисто на Вінниччині 🫡', 10),
      msg('🛵 2 Реактиви на Липовець', 2),
    ];
    expect(activeThreats(messages, NOW).map((t) => t.targets[0].id)).toEqual(['lypovets']);
  });

  test('"Локаційно вже не фіксується" clears the list', () => {
    const track = msg('🛵 Реактивний Шахед на Теплик', 10);
    expect(activeThreats([track, msg('📡 Локаційно вже не фіксується', 5)], NOW)).toEqual([]);
    expect(activeThreats([track], NOW)).toHaveLength(1);
  });

  test('"Перший вже не фіксується" removes the first reported target only', () => {
    const messages = [
      msg('🛵 Шахед на Теплик', 12),
      msg('🛵 Шахед на Бершадь', 9),
      msg('📡 Перший вже не фіксується', 5),
      msg('🛵 Шахед на Гайсин', 2),
    ];
    expect(activeThreats(messages, NOW).map((t) => t.targets[0].id)).toEqual(['haisyn', 'bershad']);
    // "Мінус один" does not say which one: nothing is hidden.
    expect(activeThreats([messages[0], messages[1], msg('Мінус один', 5)], NOW)).toHaveLength(2);
  });

  test('real sequence: "Залишилось лише 2 …", "По 1 … на Бар та Уланів", "Залишився лише 1 …"', () => {
    const older = [
      msg('❗️Обстановка по Шахедах над Вінниччиною:\n▪️1 🛵 на Вороновицю;\n▪️1 🛵 на Бар;\n▪️1 🛵 новий на Погребище.', 16),
      msg('❗️Залишилось лише 2 Реактивні Шахеди на Копайгород та Уланів', 10),
    ];
    const show = (list: ChannelMessage[]) =>
      activeThreats(list, NOW).map((t) => `${t.count?.min} ${t.targets.map((p) => p.id).join('+')}`);
    expect(show(older)).toEqual(['2 kopaihorod+ulaniv']);
    const each = msg('❗️По 1 Реактивному Шахеду на Бар та Уланів', 7);
    // Уланів now belongs to the newer post; Копайгород keeps its older one.
    expect(show([...older, each])).toEqual(['1 bar', '1 ulaniv', '2 kopaihorod']);
    expect(show([...older, each, msg('❗️Залишився лише 1 Реактивний Шахед на Уланів', 4)])).toEqual(['1 ulaniv']);
  });

  test('fast targets expire sooner than slow ones', () => {
    const messages = [msg('🛵 Реактивний Шахед на Теплик', 20), msg('🛵 Шахед на Бершадь', 20), msg('Балістика на Гайсин', 12)];
    expect(activeThreats(messages, NOW).map((t) => t.targets[0].id)).toEqual(['bershad']);
  });

  test('"іноді не фіксуються" is a warning, not an all-clear; a situation post replaces older ones', () => {
    const messages = [
      msg('🛵 Реактивний Шахед на Теплик', 20),
      msg('❗️Обстановка по Шахедах над Вінниччиною:\n▪️1 🛵 на Вороновицю;\n▪️1 🛵 на Бар.', 4),
      msg('Летять низько, тому іноді не фіксуються! Будьте в укриттях до відбою!', 1),
    ];
    expect(activeThreats(messages, NOW).map((t) => t.targets[0].id)).toEqual(['voronovytsia', 'bar']);
  });

  test('repeated posts are listed once and old posts expire', () => {
    const messages = [msg('🛵 Реактивний Шахед на Теплик', 3), msg('🛵 Реактивний Шахед на Теплик', 2), msg('Шахед на Бар', 90)];
    expect(activeThreats(messages, NOW)).toHaveLength(1);
  });

  test('distance, side and "heading your way" for the user', () => {
    const user = { latitude: 49.2331, longitude: 28.4682 }; // Vinnytsia centre
    const [east] = one('2 Реактиви на Липовець зі сходу'); // Липовець is east of the city, flying west
    const rel = relationToUser(east, user);
    expect(rel?.side).toBe('E');
    expect(rel?.km).toBeGreaterThan(35);
    expect(rel?.km).toBeLessThan(50);
    expect(rel?.towardsUser).toBe(true);
    // 40-odd km at 370–600 km/h: the fastest case is the one to plan by.
    expect(rel?.minutes?.min).toBeLessThan(rel?.minutes?.max ?? 0);
    expect(rel?.minutes?.min).toBeGreaterThanOrEqual(4);
    expect(rel?.minutes?.max).toBeLessThanOrEqual(8);
    // A propeller Shahed over the same distance takes clearly longer.
    const [slow] = one('2 Шахеди на Липовець зі сходу');
    expect(relationToUser(slow, user)?.minutes?.min).toBeGreaterThan(rel?.minutes?.max ?? 99);
    expect(relationToUser(one('Балістика на Липовець')[0], user)?.minutes).toBeNull();
    const [away] = one('2 Реактиви на Липовець із заходу'); // flying east, away from the city
    expect(relationToUser(away, user)?.towardsUser).toBe(false);
  });
});

describe('movement and danger ahead', () => {
  test('speed → still / on foot / bicycle / car', () => {
    expect([null, 0.3, 1.4, 5, 15].map(motionMode)).toEqual(['still', 'still', 'walk', 'bike', 'car']);
    expect(cleanMotion(-1, -1)).toEqual({ speed: null, heading: null });
  });

  const start = { latitude: 49.2331, longitude: 28.4682 };
  const drivingWest = cleanMotion(15, 270);

  test('districts on the course are found; none when standing still', () => {
    const ahead = aheadZones(start, drivingWest);
    expect(ahead.length).toBeGreaterThan(0);
    expect(aheadZones(start, cleanMotion(0, 270))).toEqual([]);
    expect(aheadZones(start, cleanMotion(15, null))).toEqual([]);
  });

  test('a threat in a district ahead is a caution with its own key', () => {
    const ahead = aheadZones(start, drivingWest, undefined, evaluate([], start, { now: NOW }).userZones);
    const target = ahead[ahead.length - 1];
    const post = msg(`Шахед на ${target.name}`, 1);
    const off = evaluate([post], start, { now: NOW });
    expect(off.hits.some((h) => h.zone.id === target.id)).toBe(false);
    const on = evaluate([post], start, { now: NOW, aheadZoneIds: [target.id] });
    const hit = on.hits.find((h) => h.zone.id === target.id);
    expect(hit?.ahead).toBe(true);
    expect(on.level).toBe('caution');
    expect(hitKey(hit!)).toMatch(/^ahead:/);
  });
});
