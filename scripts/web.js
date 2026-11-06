#!/usr/bin/env node
/**
 * Local browser preview: `npm run web`
 *
 * Browsers block reading t.me directly (CORS), so this starts a tiny local proxy
 * on http://localhost:8787 (GET /s/<channel> → https://t.me/s/<channel>) and then
 * starts the Expo web dev server. Not needed for the iOS/Android apps.
 */
const http = require('http');
const { spawn } = require('child_process');

const PORT = Number(process.env.TG_PROXY_PORT || 8787);
const UPSTREAM = process.env.TG_UPSTREAM || 'https://t.me';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  const m = /^\/s\/([A-Za-z0-9_]{3,64})\/?(\?.*)?$/.exec(req.url || '');
  if (req.method !== 'GET' || !m) {
    res.writeHead(404, cors);
    return res.end('Use /s/<channel>');
  }
  try {
    const upstream = await fetch(`${UPSTREAM}/s/${m[1]}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'uk,en;q=0.8',
      },
    });
    const body = await upstream.text();
    res.writeHead(upstream.status, { ...cors, 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
    console.log(`[tg-proxy] ${m[1]} → ${upstream.status} (${body.length} bytes)`);
  } catch (e) {
    console.error(`[tg-proxy] ${m[1]} failed:`, e.message);
    res.writeHead(502, cors);
    res.end(String(e.message));
  }
});

server.listen(PORT, () => {
  console.log(`[tg-proxy] Telegram proxy on http://localhost:${PORT}/s/<channel>`);
  if (process.argv.includes('--proxy-only')) return;
  // Show the git commit in the app footer, so it's easy to tell which version is running.
  let build = 'dev';
  try {
    build = require('child_process').execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {}
  const expo = spawn('npx', ['expo', 'start', '--web', '--clear', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, EXPO_PUBLIC_BUILD: process.env.EXPO_PUBLIC_BUILD || build },
  });
  expo.on('exit', (code) => {
    server.close();
    process.exit(code ?? 0);
  });
});
