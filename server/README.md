# AI targets service

A small Cloudflare Worker. It reads the channel's public page and, whenever the posts have
changed, asks Claude which targets are still active. The app downloads the answer from
`GET /targets` and shows it in the Targets list and on the map.

- The app's alarm for your own district does **not** use this service.
- If the service is down, slow, or has not yet seen the newest post, the app shows the
  targets found by its own rules instead. The Targets card says which one you are looking at.
- Claude is called once per change in the channel, not once per phone: answers are cached.
- Your API key lives only in Cloudflare as a secret. It is not in the app or in this repo.

## What you need

1. A Cloudflare account (free plan is enough): <https://dash.cloudflare.com/sign-up>
2. An Anthropic API key with some credit: <https://platform.claude.com/settings/keys>

## Deploy

Run these in a terminal, from this `server` folder.

```bash
npm install
```

```bash
npx wrangler login
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Paste the key when asked (it is not shown and not saved on this computer).

```bash
npx wrangler deploy
```

The last command prints the address, like
`https://alert-nearby-ai-targets.<your-account>.workers.dev`.

## Check it

Open `<address>/targets` in a browser. You should see JSON starting with `{"ok":true`.
`{"ok":false,"error":"bad_api_key"}` means the key was pasted wrongly: run the
`secret put` command again.

## Connect the app

Put the address into `AI_TARGETS_URL` in `src/config.ts` (or set
`EXPO_PUBLIC_AI_TARGETS_URL` when building), then rebuild the app.

## Cost and model

`wrangler.toml` sets `CLAUDE_MODEL`:

| Model | Input / output per 1M tokens | Rough cost per new post |
|-------|------------------------------|-------------------------|
| `claude-opus-5-5` (default) | $4 / $20 | about 2–4 cents |
| `claude-haiku-5-5` | $0.10 / $0.50 | well under 0.1 cent |

Each call sends the last hour of posts (at most 30) and gets a short list back. A busy
night with 100 posts costs a few dollars on Opus and a few cents on Haiku. Opus reads
ambiguous posts better; nobody has yet measured how much worse Haiku is on this channel.
Set a monthly spend limit for the key in the Anthropic console either way.

## Limits

- The address is public. Anyone who finds it can read the target list, but cannot make
  extra Claude calls beyond one per change in the channel per Cloudflare location.
- Posts are untrusted text. Claude's answer is forced into a fixed JSON shape and checked
  before it is returned, and the app only shows places it knows.
- The Claude call itself has not been run yet: it needs your key. Everything around it
  (reading the channel, caching, checking the answer, the app's fallback) is tested.
