# TattleTale's AI (shared)

AI assist for everyone who uses the app, with nothing for them to set up: no account, no key. Each step only runs if the one before it couldn't settle the photo:

```
their phone  ──can't tell──▶  this Worker  ──▶  your computer  ──no answer in 10 s──▶  Gemma 4 on Workers AI  ──used up──▶  Jev on OpenRouter
plate, place, time            Cloudflare,       (optional)                           free daily allowance              (optional, your key)
read on the phone             free plan
```

- The phone reads the plate, the place and the time itself. The app only sends a photo when the person hasn't picked a violation yet, or the plate reading is unsure.
- Workers AI comes with every Cloudflare account. On the Workers Free plan it includes 10,000 neurons a day and then stops answering until the next day, so it can't run up a bill.
- A reading model like Gemma only confirms a plate by reading the same characters as the phone on its own. When it reads something else, the app shows both and asks the person to check.
- Your computer and an OpenRouter key are both optional. If your computer misses (off, asleep or slower than 10 seconds), it's skipped for 2 minutes so nobody else waits on it.

## Deploy (free, no keys, works from a phone)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/SamuelJWebber/SamuelJWebber.github.io/tree/main/tattletale/tools/worker)

1. Tap the button, sign in to Cloudflare (or make a free account) and connect GitHub when it asks. It copies this folder into a new repo of yours, sets up the AI and the counter, and deploys.
2. It ends with an address like `https://tattletale-ai.<you>.workers.dev`. Put it in `config.js` (`window.TT_SHARED_AI = 'https://...'`) and publish the site. AI assist is then on for everyone, with an off switch in About.
3. Check it in the app: About > AI assist > Test. It sends a tiny made-up photo through each step and says which ones answered.

From a terminal instead: `npm install && npx wrangler login && npx wrangler deploy` in this folder.

### Optional: your computer first

Start llm2jev and the relay (steps at the top of `../tattletale_relay.py`), then give the relay a fixed address with Tailscale Funnel (free): `tailscale funnel --bg 8787` gives `https://<computer>.<tailnet>.ts.net`. In the Cloudflare dashboard, open the `tattletale-ai` Worker > Settings > Variables and Secrets: set `LOCAL_URL` to that address and add a secret `LOCAL_TOKEN` with the relay's token. (Terminal: `npx wrangler secret put LOCAL_TOKEN`.)

### Optional: a paid backup for when the free allowance runs out

Add a secret `OPENROUTER_KEY` (a key just for this, with a credit limit). Jev 1.14 then answers when Workers AI can't; set `OPENROUTER_MODEL` to `qwen` for Qwen3.5-9B instead.

## Settings

| Variable | Default | What it does |
|---|---|---|
| `WAI_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | The free cloud model. `@cf/meta/llama-4-scout-17b-16e-instruct` also works |
| `PER_IP_DAILY` | 30 | Cloud answers per person per day (a photo uses one) |
| `ALL_DAILY` | 500 | Cloud answers per day for everyone |
| `LOCAL_URL` | empty | Your computer's https address |
| `LOCAL_TIMEOUT_MS` | 10000 | How long to wait for your computer |
| `COMPUTER_REST_MS` | 120000 | How long to skip your computer after it misses |
| `OPENROUTER_MODEL` | jev | The paid backup's model, if `OPENROUTER_KEY` is set |
| `ALLOWED_ORIGIN` | the GitHub Pages site | Which site may call it from a browser |

Caps reset at midnight New York time; Workers AI's allowance resets at midnight UTC. Answers from your computer don't count toward the caps. Cloudflare's free plan covers the Worker (100,000 requests a day) and the counter (SQLite-backed Durable Objects).

Privacy: photos are passed through, never stored. The counter keeps a per-day scrambled hash of each IP address, not the address, and clears it every day.

## Test it without deploying

```
npm install
node test.mjs
```

Runs this Worker in Cloudflare's own runtime (workerd) against a fake computer, a fake Workers AI and a fake OpenRouter. It checks your computer answering, missing (too slow, broken, not set) and resting afterwards; the free model's answers, including the photo arriving as an image and plate confirmation only when it reads the same characters; the free allowance running out (with and without the paid backup); per-person and total caps, including ten requests at once with five answers left (exactly five get through); the status probe; bad input; another site calling it; and the real 10-second wait.
