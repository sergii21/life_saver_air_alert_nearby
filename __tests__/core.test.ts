import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluate, userZonesFor, zonesForLocation, zonesMentioned } from '../src/lib/evaluate';
import { bearingDeg, destinationPoint, distanceKm, escapePoint } from '../src/lib/geo';
import { parseChannelHtml, stripRepeatedLines } from '../src/lib/telegram';
import { containsAny, normalize } from '../src/lib/text';
import type { ChannelMessage } from '../src/types';
import { VINNYTSIA_ZONES } from '../src/zones/vinnytsia';

const zone = (id: string) => VINNYTSIA_ZONES.find((z) => z.id === id)!;
const msg = (id: number, text: string, minutesAgo: number, now: number): ChannelMessage => ({
  channel: 'test',
  id,
  text,
  date: new Date(now - minutesAgo * 60_000).toISOString(),
});

describe('telegram parser', () => {
  const html = readFileSync(join(__dirname, 'fixtures/channel.html'), 'utf8');
  const messages = parseChannelHtml(html, 'test_alerts');

  it('extracts text posts newest first, skipping media-only posts', () => {
    expect(messages.map((m) => m.id)).toEqual([102, 101]);
  });

  it('strips html, decodes entities, keeps line breaks', () => {
    expect(messages[1].text).toBe('🔴 Шахед курсом на Замостя!\nВсім в укриття & тримайтеся');
    expect(messages[1].date).toBe('2026-11-06T12:00:00+00:00');
  });

  it('ignores the quoted reply block', () => {
    expect(messages[0].text).toBe('Відбій по Замостю. Загроза минула !');
  });
});

describe('keyword matching', () => {
  it('prefix keywords match Ukrainian case endings', () => {
    for (const s of ['Замостя', 'на Замості', 'по Замостю', 'ЗАМОСТЯНСЬКИЙ район']) {
      expect(containsAny(normalize(s), ['замост*'])).toBe(true);
    }
  });

  it('does not match inside other words', () => {
    expect(containsAny(normalize('перезамостя'), ['замост*'])).toBe(false);
  });

  it('whole-word keywords do not match longer words', () => {
    expect(containsAny(normalize('Вінницька область — тривога'), zone('vinnytsia-city').keywords)).toBe(false);
    expect(containsAny(normalize('Вибухи у Вінниці'), zone('vinnytsia-city').keywords)).toBe(true);
  });

  it('normalises apostrophes', () => {
    expect(containsAny(normalize('Слов’янка'), zone('slovianka').keywords)).toBe(true);
    expect(containsAny(normalize('Словʼянці'), zone('slovianka').keywords)).toBe(true);
  });

  it('phrases tolerate punctuation between words', () => {
    expect(containsAny(normalize('Хутір-Шевченка'), zone('khutir-shevchenka').keywords)).toBe(true);
  });

  it('Pyrohovo does not match Pirogov street', () => {
    expect(containsAny(normalize('вул. Пирогова'), zone('pyrohovo').keywords)).toBe(false);
  });

  it('zonesMentioned finds every named district', () => {
    const ids = zonesMentioned({ channel: 't', id: 1, date: null, text: 'Дрон над Вишенькою, рух на Тяжилів' }).map(
      (z) => z.id,
    );
    expect(ids).toEqual(expect.arrayContaining(['vyshenka', 'tiazhyliv']));
  });
});

describe('geo', () => {
  it('distance Vinnytsia → Kyiv ≈ 200 km', () => {
    expect(distanceKm({ latitude: 49.2331, longitude: 28.4682 }, { latitude: 50.4501, longitude: 30.5234 })).toBeCloseTo(
      199,
      -1,
    );
  });

  it('destinationPoint is consistent with distance and bearing', () => {
    const a = { latitude: 49.23, longitude: 28.47 };
    const b = destinationPoint(a, 75, 3);
    expect(distanceKm(a, b)).toBeCloseTo(3, 3);
    expect(bearingDeg(a, b)).toBeCloseTo(75, 0);
  });

  it('escapePoint moves away from the danger center', () => {
    const center = zone('zamostia').center;
    const user = destinationPoint(center, 90, 0.5);
    const esc = escapePoint(user, center, 3);
    expect(distanceKm(center, esc)).toBeCloseTo(3.5, 1);
  });
});

describe('evaluate', () => {
  const now = Date.parse('2026-11-06T12:30:00Z');
  const inZamostia = zone('zamostia').center;
  const opts = { now, requireThreatKeyword: false };

  it('locates the user in district + city', () => {
    const ids = zonesForLocation(inZamostia).map((z) => z.id);
    expect(ids[0]).toBe('zamostia');
    expect(ids).toContain('vinnytsia-city');
  });

  it('DANGER when the user district is named in a fresh message', () => {
    const s = evaluate([msg(1, 'Шахед курсом на Замостя!', 2, now)], inZamostia, opts);
    expect(s.level).toBe('danger');
    expect(s.hits[0].zone.id).toBe('zamostia');
  });

  it('SAFE when another district is named', () => {
    const s = evaluate([msg(1, 'Шахед курсом на Тяжилів!', 2, now)], inZamostia, opts);
    expect(s.level).toBe('safe');
  });

  it('CAUTION when only the city is named', () => {
    const s = evaluate([msg(1, 'Вибухи у Вінниці', 2, now)], inZamostia, opts);
    expect(s.level).toBe('caution');
  });

  it('all-clear newer than the threat clears the zone', () => {
    const s = evaluate(
      [msg(1, 'Шахед курсом на Замостя!', 10, now), msg(2, 'Відбій по Замостю', 1, now)],
      inZamostia,
      opts,
    );
    expect(s.level).toBe('safe');
  });

  it('threat newer than an all-clear is active again', () => {
    const s = evaluate(
      [msg(1, 'Відбій по Замостю', 10, now), msg(2, 'Знову дрон на Замостя', 1, now)],
      inZamostia,
      opts,
    );
    expect(s.level).toBe('danger');
  });

  it('threat expires after TTL', () => {
    const s = evaluate([msg(1, 'Шахед курсом на Замостя!', 45, now)], inZamostia, { ...opts, alertTtlMinutes: 30 });
    expect(s.level).toBe('safe');
  });

  it('respects REQUIRE_THREAT_KEYWORD', () => {
    const m = [msg(1, 'На Замості відкрили новий сквер', 2, now)];
    expect(evaluate(m, inZamostia, { now, requireThreatKeyword: true }).level).toBe('safe');
    expect(evaluate(m, inZamostia, { now, requireThreatKeyword: false }).level).toBe('danger');
  });

  it('no location → safe', () => {
    expect(evaluate([msg(1, 'Замостя', 1, now)], null, opts).level).toBe('safe');
  });

  it('user far away (Kyiv) is never matched', () => {
    const s = evaluate([msg(1, 'Шахед на Замостя, Вінниця', 1, now)], { latitude: 50.45, longitude: 30.52 }, opts);
    expect(s.userZones).toHaveLength(0);
    expect(s.level).toBe('safe');
  });
});

describe('live channel page (t.me/s/vinnytsiappo, saved 2026-11-06)', () => {
  const html = readFileSync(join(__dirname, 'fixtures/vinnytsiappo-live.html'), 'utf8');
  const messages = parseChannelHtml(html, 'vinnytsiappo');
  const byId = (id: number) => messages.find((m) => m.id === id)!;

  it('parses all 20 posts with dates', () => {
    expect(messages).toHaveLength(20);
    expect(messages.every((m) => m.date && m.text.length > 0)).toBe(true);
  });

  it('strips the channel signature so it does not match "Вінниця" in every post', () => {
    expect(messages.some((m) => m.text.includes('Телеграм канал ППО Вінниця'))).toBe(false);
    expect(zonesMentioned(byId(2947)).map((z) => z.id)).toEqual(['nemyriv']);
  });

  it('city alert names the districts', () => {
    expect(zonesMentioned(byId(2932)).map((z) => z.id).sort()).toEqual(
      ['ahronomichne', 'akademichnyi', 'luka-meleshkivska', 'vinnytsia-city'].sort(),
    );
  });

  it('town alert "❗️ЛАДИЖИН, в укриття" → DANGER for a user in Ladyzhyn', () => {
    const now = Date.parse('2026-11-06T14:13:30Z'); // just after post #2938
    const seen = messages.filter((m) => Date.parse(m.date!) <= now); // what the app had at that moment
    const s = evaluate(seen, zone('ladyzhyn').center, { now });
    expect(s.level).toBe('danger');
    expect(s.hits[0].message.id).toBe(2938);
  });

  it('"📡 Чисто на Вінниччині" clears everything after it', () => {
    const now = Date.parse('2026-11-06T14:37:00Z'); // after #2949
    expect(evaluate(messages, zone('ladyzhyn').center, { now }).level).toBe('safe');
    expect(evaluate(messages, zone('nemyriv').center, { now }).level).toBe('safe');
  });

  it('Vinnytsia city user is not alarmed by posts about other towns', () => {
    const now = Date.parse('2026-11-06T14:33:00Z');
    expect(evaluate(messages, zone('zamostia').center, { now }).level).toBe('safe');
  });
});

describe('signature stripping', () => {
  it('keeps unique lines, removes a footer repeated in most posts', () => {
    const footer = '💪 Мій канал Вінниця';
    const m = [1, 2, 3, 4].map((id) => ({ channel: 'c', id, date: null, text: `post ${id}\n${footer}` }));
    expect(stripRepeatedLines(m).map((x) => x.text)).toEqual(['post 1', 'post 2', 'post 3', 'post 4']);
  });
});

describe('Vinnytsia location table (micro-districts + nearby villages)', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const opts = { now };
  const urozhaiMarket = { latitude: 49.2257, longitude: 28.4483 }; // ринок "Урожай"
  const mentioned = (text: string) => zonesMentioned({ channel: 't', id: 1, date: null, text }).map((z) => z.id);

  it('zone ids are unique and every zone has keywords', () => {
    expect(new Set(VINNYTSIA_ZONES.map((z) => z.id)).size).toBe(VINNYTSIA_ZONES.length);
    expect(VINNYTSIA_ZONES.every((z) => z.keywords.length > 0 && z.radiusKm > 0)).toBe(true);
  });

  it('a user at the Urozhai market is located in Урожай first', () => {
    expect(zonesForLocation(urozhaiMarket)[0].id).toBe('urozhai');
  });

  it('DANGER when the post names the user micro-district (Урожай)', () => {
    const s = evaluate([msg(1, 'Урожай / Центр в укриття!', 1, now)], urozhaiMarket, opts);
    expect(s.level).toBe('danger');
    expect(s.hits[0].zone.id).toBe('urozhai');
  });

  it('SAFE at Урожай when the post names districts on the other side of the city', () => {
    const s = evaluate([msg(1, 'Тяжилів / ГПЗ / Київська , укриття', 1, now)], urozhaiMarket, opts);
    expect(s.level).toBe('safe');
  });

  it('city + districts post: DANGER inside a named district, CAUTION elsewhere in the city', () => {
    const post = [msg(1, '❗️ВІННИЦЯ , укриття\nАгрономічне / Академічне / Поділля / Вишенька', 1, now)];
    expect(evaluate(post, zone('vyshenka').center, opts).level).toBe('danger');
    expect(evaluate(post, zone('tiazhyliv').center, opts).level).toBe('caution');
  });

  it('nearby village: Агрономічне', () => {
    const inVillage = zone('ahronomichne').center;
    expect(zonesForLocation(inVillage)[0].id).toBe('ahronomichne');
    expect(evaluate([msg(1, 'Агрономічне/ електромережа в укриття', 1, now)], inVillage, opts).level).toBe('danger');
    // Outside the city circle: a city-only post does not alarm the village.
    expect(evaluate([msg(1, 'Сабарів / Поділля !', 1, now)], inVillage, opts).level).toBe('safe');
  });

  it("understands the channel's own spellings", () => {
    expect(mentioned('Гпз / тяжилів / стрижавка / київська укриття')).toEqual(
      expect.arrayContaining(['hpz', 'tiazhyliv', 'stryzhavka', 'kyivska']),
    );
    expect(mentioned('Лука Мелешківська / Бучми / Немирівське шосе / Старе місто / Хутори / Масложир , в УКРИТТЯ!')).toEqual(
      expect.arrayContaining(['luka-meleshkivska', 'mali-khutory', 'nemyrivske-shose', 'stare-misto', 'maslozhyr']),
    );
    expect(mentioned('Київська / Пʼятничани / Зарваниці , в укриття !')).toEqual(
      expect.arrayContaining(['kyivska', 'piatnychany', 'zarvantsi']),
    );
    expect(mentioned('Лука / Старе місто / Електромережа укриття')).toEqual(
      expect.arrayContaining(['luka-meleshkivska', 'stare-misto', 'elektromerezha']),
    );
    expect(mentioned('Реактив на Замостя / Вокзал')).toEqual(expect.arrayContaining(['zamostia', 'vokzal']));
  });

  it('a prefix works on any word of a phrase', () => {
    expect(containsAny(normalize('по Немирівському шосе'), ['немирівськ* шосе'])).toBe(true);
    expect(containsAny(normalize('Немирівський район'), ['немирівськ* шосе'])).toBe(false);
    expect(containsAny(normalize('у Вінницькій області'), ['вінницьк* област*'])).toBe(true);
  });

  it('Урожай (district) and Урожайне (village) are not confused', () => {
    expect(mentioned('Шахед на Урожайне')).toEqual(['urozhaine']);
    expect(mentioned('Урожай в укриття')).toEqual(['urozhai']);
  });
});

describe('between districts + settings', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  // A point between Березина and Агрономічне (west edge of the city).
  const between = { latitude: 49.2135, longitude: 28.3585 };
  const post = [msg(1, 'Агрономічне в укриття!', 1, now)];

  it('default distance counts both neighbouring districts', () => {
    expect(zonesForLocation(between).map((z) => z.id)).toEqual(expect.arrayContaining(['berezyna', 'ahronomichne']));
    expect(evaluate(post, between, { now }).level).toBe('danger');
  });

  it('a wider "nearby" distance adds more districts, a narrower one fewer', () => {
    const narrow = userZonesFor(between, VINNYTSIA_ZONES, 0.3).length;
    const wide = userZonesFor(between, VINNYTSIA_ZONES, 3).length;
    expect(wide).toBeGreaterThan(narrow);
  });

  it('a pinned district alerts even when the user is far from it', () => {
    const inZamostia = zone('zamostia').center;
    expect(evaluate(post, inZamostia, { now }).level).toBe('safe');
    const s = evaluate(post, inZamostia, { now, pinnedZoneIds: ['ahronomichne'] });
    expect(s.level).toBe('danger');
    expect(s.userZones.map((z) => z.id)).toContain('ahronomichne');
  });

  it('pinned districts work without a GPS position', () => {
    expect(evaluate(post, null, { now, pinnedZoneIds: ['ahronomichne'] }).level).toBe('danger');
    expect(evaluate(post, null, { now }).level).toBe('safe');
  });
});
