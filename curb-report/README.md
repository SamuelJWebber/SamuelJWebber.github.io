# Curb Report NYC

Point your phone at a car blocking a bike lane, hydrant or crosswalk, tap what it's doing, and Curb Report opens a text to NYC 311 (311-692) with the plate, block and time filled in. You press Send.

- **On the phone only.** Plate reading (PaddleOCR PP-OCRv4 on ONNX Runtime Web) and the address lookup (city street centerline, bundled as map tiles) run in the browser. No server, no account, no API keys.
- **Small and tilted plates.** If the first read only gets part of a plate, the reader widens the box, enlarges it and tries a few rotations; on the review screen it also scans the photo in zoomed tiles.
- **One tap.** The camera reads plates continuously while it is open, and GPS keeps the block current, so tapping a violation opens the finished text right away.
- **Share a photo, tap what's wrong.** Once installed, Curb Report appears in Android's share menu. Share any photo to it, new or old, tap what's wrong, and the text to 311 opens. It uses the time and GPS stored in the photo. Android removes GPS from shared photos, so for one taken in the last 15 minutes it uses where you are now, and for older ones it reads the street signs in the photo. "Choose a photo" opens the Files picker, which keeps the GPS. Anything uncertain (a location read from signs, a missing time or plate) stops on the review screen instead of texting. iPhone: Safari doesn't let web apps into the share menu, so use "Choose a photo".
- **311 website fallback.** "Let me check before texting" shows a review screen that can copy the description and open 311's illegal-parking form.
- **Idling reward (DEP).** Checks a timestamp-camera video against DEP's rules (length, plate, company name, timestamp), reads the plate and company, saves the two stills DEP asks for, and lays out DEP's form fields.
- **Stats.** Live numbers from NYC Open Data on what NYPD did with each complaint type, citywide and near you.
- **Installable.** Works as a home-screen app and offline after the first visit (the plate reader is a one-time ~27 MB download).

## Deploy

It is a static site. Serve the folder over HTTPS (GitHub Pages, Netlify, any static host). Camera and GPS need HTTPS.

## Limits

NYC 311 has no public API for submitting complaints, so the final step is the user's: pressing Send in Messages, or Submit on the 311 website. The plate reader can miss dirty, angled or distant plates; the text shows the plate before sending.

See NOTICE.md for third-party components. Not affiliated with the City of New York.
