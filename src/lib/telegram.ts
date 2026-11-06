import type { ChannelMessage } from '../types';

/**
 * Reads PUBLIC Telegram channels through their web preview page https://t.me/s/<channel>.
 * No Telegram account, bot or API key needed. Returns the latest ~20 posts.
 */

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    const lower = e.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return ENTITIES[lower] ?? m;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse the HTML of https://t.me/s/<channel>. Messages without text are skipped. */
export function parseChannelHtml(html: string, channel: string): ChannelMessage[] {
  const out: ChannelMessage[] = [];
  // Each post is <div class="tgme_widget_message ..." data-post="channel/123" ...>
  const chunks = html.split(/data-post="/).slice(1);
  for (const chunk of chunks) {
    const idMatch = /^[^"/]+\/(\d+)"/.exec(chunk);
    if (!idMatch) continue;
    const id = Number(idMatch[1]);

    // Main text block has class "tgme_widget_message_text js-message_text".
    // Replies contain a quoted block with "js-message_reply_text" — skip those.
    const textRe = /<div class="tgme_widget_message_text([^"]*)"[^>]*>([\s\S]*?)<\/div>/g;
    let text: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = textRe.exec(chunk))) {
      if (m[1].includes('reply')) continue;
      text = htmlToText(m[2]);
    }
    if (!text) continue;

    const dateMatch = /<time[^>]*datetime="([^"]+)"/.exec(chunk);
    out.push({ channel, id, date: dateMatch ? dateMatch[1] : null, text });
  }
  // Deduplicate (same id can appear twice in odd markup) and sort newest first.
  const seen = new Set<number>();
  return out
    .filter((msg) => (seen.has(msg.id) ? false : (seen.add(msg.id), true)))
    .sort((a, b) => b.id - a.id);
}

export async function fetchChannel(channel: string, timeoutMs = 15000): Promise<ChannelMessage[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://t.me/s/${encodeURIComponent(channel)}`, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Accept-Language': 'uk,en;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`t.me/s/${channel}: HTTP ${res.status}`);
    const html = await res.text();
    const messages = parseChannelHtml(html, channel);
    if (messages.length === 0 && !html.includes('tgme_channel_info')) {
      throw new Error(`t.me/s/${channel}: no public preview (is the channel public?)`);
    }
    return messages;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch all channels; failures of one channel don't break the others. */
export async function fetchAll(channels: string[]): Promise<{ messages: ChannelMessage[]; errors: string[] }> {
  const results = await Promise.allSettled(channels.map((c) => fetchChannel(c)));
  const messages: ChannelMessage[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') messages.push(...r.value);
    else errors.push(`${channels[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  });
  return { messages, errors };
}

export const messageUrl = (m: Pick<ChannelMessage, 'channel' | 'id'>) => `https://t.me/${m.channel}/${m.id}`;
