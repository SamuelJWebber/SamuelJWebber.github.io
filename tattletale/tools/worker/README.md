# TattleTale's AI (shared)

Lets anyone use AI assist without an AI key of their own. Each step only runs if the one before it couldn't settle the photo:

```
their phone  ──can't tell──▶  this Worker  ──▶  your computer (up to 10 s)  ──no answer──▶  Jev on OpenRouter (your key)
plate, place, time            Cloudflare,        llm2jev + JPT-4B behind                    daily caps, counted
read on the phone             free plan          tools/tattletale_relay.py                  in a Durable Object
```

- The phone reads the plate, the place and the time itself. The app only sends a photo when the person hasn't picked a violation yet, or the plate reading is unsure, and only after they tap "Let AI pick" once (or turn it on in About).
- Your OpenRouter key and your computer's token are Worker secrets. They are never in the app or in this repo.
- Answers from your computer are free and uncapped. Cloud answers are capped per person and in total each day.

## Set it up (free; about 15 minutes)

1. **OpenRouter key.** Make a new key just for this at https://openrouter.ai/settings/keys and give it a credit limit, say $5. That limit is the hard ceiling on what this can ever cost you.
2. **Cloudflare.** Make a free account, then on your computer, in this folder:
   ```
   npx wrangler login
   npx wrangler secret put OPENROUTER_KEY     # paste the key at the prompt
   npx wrangler deploy                        # prints https://tattletale-ai.<you>.workers.dev
   ```
3. **Point the app at it.** Put that address in `config.js` (`window.TT_SHARED_AI = 'https://...'`) and publish the site. The "TattleTale's AI" option and the "Let AI pick" button appear once it's set.
4. **Your computer first (optional).** Start llm2jev and the relay (steps in `../tattletale_relay.py`), then give the relay a fixed HTTPS address with Tailscale Funnel (free):
   ```
   tailscale funnel --bg 8787                 # https://<computer>.<tailnet>.ts.net
   npx wrangler secret put LOCAL_TOKEN        # paste the token the relay printed
   ```
   Put the `ts.net` address in `wrangler.toml` as `LOCAL_URL` and run `npx wrangler deploy` again. When the computer is off, asleep or slower than 10 seconds, the cloud answers instead.
5. **Check.** In the app: About > AI assist > Model: TattleTale's AI > Test.

## Limits and costs

| Setting (wrangler.toml) | Default | What it does |
|---|---|---|
| `PER_IP_DAILY` | 30 | Cloud answers per person per day (a photo uses one or two) |
| `ALL_DAILY` | 500 | Cloud answers per day for everyone |
| `LOCAL_TIMEOUT_MS` | 10000 | How long to wait for your computer |
| `CLOUD_MODEL` | jev | `jev` (Jev 1.14; can box the plate) or `qwen` (Qwen3.5-9B; reads the plate) |
| `ALLOWED_ORIGIN` | the GitHub Pages site | Which site may call it from a browser |

Caps reset at midnight New York time. Cloudflare's free plan covers the Worker (100,000 requests a day) and the counter (SQLite-backed Durable Objects are on the free plan). OpenRouter charges per photo, a fraction of a cent each. If a cap or the credit limit is hit, the app says so and the person picks the violation themselves.

Privacy: photos are passed through, never stored. The counter keeps a scrambled, per-day hash of each IP address, not the address, and clears it every day.

## Test it without deploying

```
npm i -D miniflare
node test.mjs
```

Runs this Worker in Cloudflare's own runtime (workerd) against a fake computer and a fake OpenRouter. It checks: the computer answering; the computer too slow, broken or not set (each falls back to the cloud); plate checks; per-person and total caps, including ten requests at once with five answers left (exactly five get through); bad input; another site calling it; OpenRouter out of credit; Qwen as the cloud model; and the real 10-second wait.
