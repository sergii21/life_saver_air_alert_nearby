/**
 * AI targets service (Cloudflare Worker).
 *
 *   GET /targets  →  { ok, model, generatedAt, latestPostId, targets: [...] }
 *
 * Reads the channel's public page, and when the posts have changed asks Claude which targets
 * are still active. The answer is cached until the posts change again, so Claude is called
 * once per new post — not once per phone. The app falls back to its own rules whenever this
 * service is down, slow or behind.
 *
 * Secret (never in the repo):  npx wrangler secret put ANTHROPIC_API_KEY
 */
import Anthropic from '@anthropic-ai/sdk';
import { buildUserMessage, cleanTargets, parsePosts, postsFingerprint, recentPosts, SCHEMA, SYSTEM } from './posts.js';

const PAGE_TTL_SECONDS = 15;
const ANSWER_TTL_SECONDS = 3600;
const CACHE_ORIGIN = 'https://ai-targets.cache';

const json = (body, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store',
    },
  });

async function channelPosts(channel, ctx) {
  const cache = caches.default;
  const key = new Request(`${CACHE_ORIGIN}/page/${channel}`);
  let res = await cache.match(key);
  if (!res) {
    const page = await fetch(`https://t.me/s/${encodeURIComponent(channel)}`, {
      headers: { 'Accept-Language': 'uk,en;q=0.8', 'User-Agent': 'Mozilla/5.0 (compatible; alert-nearby/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!page.ok) throw new Error(`t.me HTTP ${page.status}`);
    res = new Response(await page.text(), { headers: { 'cache-control': `public, max-age=${PAGE_TTL_SECONDS}` } });
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  return parsePosts(await res.text());
}

/** One Claude call: posts in, validated targets out. Throws on API errors. */
async function askClaude(env, posts) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
  const model = env.CLAUDE_MODEL || 'claude-opus-5-5';
  // If a safety classifier declines the request, let the API retry on a fallback model
  // inside the same call. Haiku has no server-side fallback.
  const withFallback = !model.includes('haiku');
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    // Extraction, and people are waiting: keep the thinking short.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(posts) }],
    ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
  });
  if (response.stop_reason === 'refusal') throw new Error('declined');
  if (response.stop_reason === 'max_tokens') throw new Error('answer cut off');
  const text = response.content.find((block) => block.type === 'text');
  if (!text) throw new Error('empty answer');
  return { model: response.model, targets: cleanTargets(JSON.parse(text.text), posts) };
}

function errorCode(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'bad_api_key';
  if (e instanceof Anthropic.RateLimitError) return 'rate_limited';
  if (e instanceof Anthropic.APIConnectionError) return 'claude_unreachable';
  if (e instanceof Anthropic.APIError) return `claude_error_${e.status ?? 'unknown'}`;
  return e instanceof Error ? e.message : 'error';
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
    if (pathname === '/') return json({ ok: true, service: 'alert-nearby-ai-targets' });
    if (pathname !== '/targets') return json({ ok: false, error: 'not_found' }, 404);
    if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'no_api_key' }, 503);

    try {
      const channel = env.CHANNEL || 'vinnytsiappo';
      const posts = recentPosts(await channelPosts(channel, ctx));
      const latestPostId = posts.length > 0 ? posts[posts.length - 1].id : 0;
      // Nothing posted in the last hour: no targets, and no need to ask.
      if (posts.length === 0) return json({ ok: true, model: null, generatedAt: Date.now(), latestPostId, targets: [] });

      const cache = caches.default;
      const key = new Request(`${CACHE_ORIGIN}/answer/${channel}/${await postsFingerprint(posts)}`);
      const cached = await cache.match(key);
      if (cached) return json(await cached.json());

      const { model, targets } = await askClaude(env, posts);
      const body = { ok: true, model, generatedAt: Date.now(), latestPostId, targets };
      ctx.waitUntil(
        cache.put(key, new Response(JSON.stringify(body), { headers: { 'cache-control': `public, max-age=${ANSWER_TTL_SECONDS}` } })),
      );
      return json(body);
    } catch (e) {
      console.error('targets failed', e);
      return json({ ok: false, error: errorCode(e) }, 503);
    }
  },
};
