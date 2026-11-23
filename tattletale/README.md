# TattleTale NYC

Point your phone at a car blocking a bike lane, hydrant or crosswalk, tap what it's doing, and TattleTale opens a text to NYC 311 (311-692) with the plate, block and time filled in. You press Send.

- **On the phone only.** Plate reading (PaddleOCR PP-OCRv4 on ONNX Runtime Web) and the address lookup (city street centerline, bundled as map tiles) run in the browser. No server, no account, no API keys.
- **Small and tilted plates.** If the first read only gets part of a plate, the reader widens the box, enlarges it and tries a few rotations; on the review screen it also scans the photo in zoomed tiles.
- **One tap.** The camera reads plates continuously while it is open, and GPS keeps the block current, so tapping a violation opens the finished text right away.
- **Share a photo, tap what's wrong.** Once installed, TattleTale appears in Android's share menu. Share any photo to it, new or old, tap what's wrong, and the text to 311 opens. It uses the time and GPS stored in the photo. Android removes GPS from shared photos, so for one taken in the last 15 minutes it uses where you are now, and for older ones it reads the street signs in the photo. "Choose a photo" opens the Files picker, which keeps the GPS. Anything uncertain (a location read from signs, a missing time or plate) stops on the review screen instead of texting. iPhone: Safari doesn't let web apps into the share menu, so use "Choose a photo".
- **311 website fallback.** "Let me check before texting" shows a review screen that can copy the description and open 311's illegal-parking form.
- **Idling reward (DEP).** Checks a timestamp-camera video against DEP's rules (length, plate, company name, timestamp), reads the plate and company, saves the two stills DEP asks for, and lays out DEP's form fields.
- **Stats.** Live numbers from NYC Open Data on what NYPD did with each complaint type, citywide and near you.
- **Installable.** Works as a home-screen app and offline after the first visit (the plate reader is a one-time ~27 MB download).

## How the models fit

- **Plate reading, on the phone.** PaddleOCR PP-OCRv4 finds every patch of text and reads it (about 15 MB, ONNX Runtime Web). Rules then pick the plate: a known state format (NY, NJ including its older ABC-12D series, PA, CT, CA, FL, MA) counts only when every character is at least 60% confident; any other 5 to 8 character plate counts only when every character is at least 90% confident. When no state name is readable, the format sets the state (A12-BCD means New Jersey).
- **Live camera.** A plate has to be read the same way twice, or once very clearly, before one tap sends it.
- **Second look.** Zoomed-in tiles and rotated re-reads for small or tilted plates, capped at 8 seconds. Plates found only this way are flagged for checking and never sent in one tap.
- **AI assist, four places to run it** (`lib/ai.js`):
  - *TattleTale's AI* (shared; on by default; nobody needs a key): the phone reads first, and a photo only leaves it for what the phone couldn't settle. It goes to a Cloudflare Worker (`tools/worker`, one-tap deploy) that asks the owner's computer (open JPT-4B) for up to 10 seconds, then Gemma 4 on Workers AI inside Cloudflare's free daily allowance, then optionally Jev on the owner's OpenRouter key. A computer that misses is skipped for 2 minutes. A reading model only confirms a plate by reading the same characters as the phone. Daily caps per person and in total are counted exactly in a Durable Object. Tested in Cloudflare's own runtime (Miniflare) against a fake computer, a fake Workers AI and a fake OpenRouter, and end to end from the app. Off until `config.js` has the Worker's address.
  - *Jev 1.14* (TypeSafe, closed) through OpenRouter on the user's own key: picks the violation with calibrated probabilities (used only at 80% or more), draws a box around the plate so the phone's reader can read just that patch, and chooses between the phone's candidate readings.
  - *Qwen3.5-9B* (open weights) through OpenRouter: reads the plate text itself and picks the violation; its confidence is its own estimate, not calibrated.
  - *Your own computer*: any Jev-compatible server, such as `llm2jev` serving the open JPT-4B (non-commercial license), reached through `tools/tattletale_relay.py` and a free Cloudflare tunnel. The relay adds the browser headers and checks a token.
  - "Also ask a second model" saves both models' answers with each report, next to what was actually sent, so the My reports CSV becomes a test set built from real NYC photos.
- **Model lab** (`lab.html`): scores the phone's reader, Jev, Qwen and your computer on OpenALPR's public US plate photos (loaded from GitHub at run time), with a CSV of every answer.

## Plate benchmark

OpenALPR's public US end-to-end set: 222 photos, mostly California plates. Times are from headless Chrome on a 2-core machine.

| Reader | Exactly right | Wrong | Median time |
| --- | --- | --- | --- |
| First release rules | 18.9% | 3.6% | 0.8 s |
| Current rules, first pass | 42.8% | 2.7% | 0.9 s |
| Current rules plus second look | 53.2% | 9.9% | 5.9 s |

The right plate appears somewhere in the reader's raw output for 64% of photos, so better plate picking has a ceiling; the rest needs a better detector or reader. Forcing reads into state formats by swapping lookalike characters (O/0, I/1, Z/2) was tested and dropped: it pushed wrong reads to 27 to 49%.

## Deploy

It is a static site. Serve the folder over HTTPS (GitHub Pages, Netlify, any static host). Camera and GPS need HTTPS.

To offer TattleTale's AI, deploy `tools/worker` (one tap: [Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/SamuelJWebber/SamuelJWebber.github.io/tree/main/tattletale/tools/worker); details in its README) and put its address in `config.js`.

## Limits

NYC 311 has no public API for submitting complaints, so the final step is the user's: pressing Send in Messages, or Submit on the 311 website. The plate reader can miss dirty, angled or distant plates; the text shows the plate before sending.

See NOTICE.md for third-party components. Not affiliated with the City of New York.
