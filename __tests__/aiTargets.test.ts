import { stillFresh, tracksFromAi } from '../src/lib/aiTargets';
import type { ChannelMessage } from '../src/types';
// The server's pure helpers (plain JS, no network).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const server = require('../server/src/posts.js');

const NOW = Date.parse('2026-11-10T12:00:00Z');
const msg = (id: number, text: string, minutesAgo: number): ChannelMessage => ({
  channel: 'vinnytsiappo',
  id,
  date: new Date(NOW - minutesAgo * 60_000).toISOString(),
  text,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const target = (over: object): any => ({
  post_id: 3, kind: 'jet', count_min: 1, count_max: 1, several: false, to: ['Уланів'], via: [], from: '', region: false, ...over,
});
const messages = [msg(1, '❗️По 1 Реактивному Шахеду на Бар та Уланів', 7), msg(3, '❗️Залишився лише 1 Реактивний Шахед на Уланів', 4)];

describe('AI targets: app side', () => {
  test('an answer becomes tracks on known places', () => {
    const ai = tracksFromAi({ ok: true, latestPostId: 3, targets: [target({ from: 'E', via: ['Козятин'] })] }, messages);
    expect(ai?.tracks).toHaveLength(1);
    expect(ai?.tracks[0]).toMatchObject({ kind: 'jet', count: { min: 1, max: 1 }, from: 'E' });
    expect(ai?.tracks[0].targets[0].id).toBe('ulaniv');
    expect(ai?.tracks[0].via[0].id).toBe('koziatyn');
    expect(ai?.tracks[0].message.id).toBe(3);
  });

  test('the rules are used when the service failed, is malformed, or is behind the app', () => {
    expect(tracksFromAi(null, messages)).toBeNull();
    expect(tracksFromAi({ ok: false }, messages)).toBeNull();
    expect(tracksFromAi({ ok: true, latestPostId: 3 }, messages)).toBeNull();
    expect(tracksFromAi({ ok: true, latestPostId: 2, targets: [] }, messages)).toBeNull();
  });

  test('entries the app cannot place or trace to a post are dropped; an empty list is a valid answer', () => {
    const ai = tracksFromAi(
      { ok: true, latestPostId: 3, targets: [target({ to: ['Невідоме Село'] }), target({ post_id: 99 }), target({ kind: 'ufo' as never })] },
      messages,
    );
    expect(ai?.tracks).toEqual([]);
    expect(stillFresh(ai, messages, NOW)).toEqual([]);
  });

  test('an AI answer stops counting once a newer post arrives or the track gets old', () => {
    const ai = tracksFromAi({ ok: true, latestPostId: 3, targets: [target({})] }, messages);
    expect(stillFresh(ai, messages, NOW)).toHaveLength(1);
    expect(stillFresh(ai, [...messages, msg(4, 'Новий Шахед на Бар', 0)], NOW)).toBeNull();
    expect(stillFresh(ai, messages, NOW + 20 * 60_000)).toEqual([]); // a jet track lives 15 min
  });
});

describe('AI targets: server helpers', () => {
  const html = `
    <div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="vinnytsiappo/41">
      <div class="tgme_widget_message_text js-message_text" dir="auto">🛵 2 Реактиви на <b>Липовець</b><br/>зі сходу &amp; далі</div>
      <time datetime="2026-11-10T11:55:00+00:00" class="time">13:55</time></div></div>
    <div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="vinnytsiappo/40">
      <div class="tgme_widget_message_text js-message_text" dir="auto">Старий пост</div>
      <time datetime="2026-11-10T09:00:00+00:00" class="time">11:00</time></div></div>`;

  test('posts are read from the channel page, oldest first, and only the last hour is sent', () => {
    const posts = server.parsePosts(html);
    expect(posts.map((p: { id: number }) => p.id)).toEqual([40, 41]);
    expect(posts[1].text).toBe('🛵 2 Реактиви на Липовець\nзі сходу & далі');
    const recent = server.recentPosts(posts, NOW);
    expect(recent.map((p: { id: number }) => p.id)).toEqual([41]);
    expect(server.buildUserMessage(recent, NOW)).toContain('<post id="41" minutes_ago="5">');
  });

  test('the answer is cleaned: unknown posts and kinds dropped, counts and names bounded', () => {
    const posts = [{ id: 41, date: '', text: '' }];
    const cleaned = server.cleanTargets(
      {
        targets: [
          { post_id: 41, kind: 'jet', count_min: 2, count_max: 0, several: false, to: [' Липовець ', 7], via: 'x', from: 'EAST', region: false },
          { post_id: 7, kind: 'jet', count_min: 1, count_max: 1, several: false, to: ['Бар'], via: [], from: '', region: false },
          { post_id: 41, kind: 'dragon', count_min: 1, count_max: 1, several: false, to: ['Бар'], via: [], from: '', region: false },
          { post_id: 41, kind: 'shahed', count_min: 0, count_max: 0, several: true, to: [], via: [], from: '', region: false },
        ],
      },
      posts,
    );
    expect(cleaned).toEqual([
      { post_id: 41, kind: 'jet', count_min: 2, count_max: 2, several: false, to: ['Липовець'], via: [], from: '', region: false },
    ]);
    expect(server.cleanTargets(null, posts)).toEqual([]);
  });
});
