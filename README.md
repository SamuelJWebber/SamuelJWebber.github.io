# SamuelJWebber.github.io

The public home of the dashboards whose source lives in **private** repositories, served by GitHub Pages at
<https://samueljwebber.github.io/>. Claude and ChatGPT can both update it: anything pushed to `main` goes live
within a few minutes.

| Folder | Source (private) | Live |
| --- | --- | --- |
| `citibike-dashboard/` | SamuelJWebber/citibike-dashboard, `dashboard.html` (published as `index.html`) | https://samueljwebber.github.io/citibike-dashboard/ |
| `market-calibration-atlas/` | SamuelJWebber/market-calibration-atlas, `dist/` | https://samueljwebber.github.io/market-calibration-atlas/ |
| `nyc-street-flow/` | SamuelJWebber/nyc-street-flow, `dist/` | https://samueljwebber.github.io/nyc-street-flow/ |
| `senate-coattails/` | SamuelJWebber/senate-coattails, `dist/` | https://samueljwebber.github.io/senate-coattails/ |
| `curb-report/` | None yet. A static app with no build step, so this folder is its source; the scripts that built its map tiles, and its tests, are not on GitHub | https://samueljwebber.github.io/curb-report/ |

The home page also links the dashboards that publish from their own public repositories: credit-card-data,
abs-risk and ski-rentals-2027.

## How to update a dashboard

1. Change it in its **source repository's `dist/` folder** and commit there. That repository stays the source of
   truth; the folder here is a published copy.
2. Publish it:
   - **Claude Code or Codex:** run `python tools/publish_site.py` from the source repository. It mirrors `dist/` into
     this repository's folder (respecting the exclusions below), then commits and pushes.
   - **ChatGPT (GitHub connector):** make the same file change in this repository's folder and commit it, so the
     two stay identical.
3. Check the live page.

**citibike-dashboard is the exception:** it has no `dist/`, only one self-contained `dashboard.html`, which its
`tools/publish_site.py` copies here as `citibike-dashboard/index.html`. Its monthly refresh runs on GitHub Actions
inside the private repository and does **not** publish here, so run that script after each refresh (around the
14th) or the public copy falls a month behind.

## Rules

- **This repository is public.** Publish only dashboard files: no raw private data, no credentials, no local paths,
  no personal details. The source repositories are private because they hold raw third-party data not cleared for
  redistribution.
- **Held back from market-calibration-atlas:** `downloads/forward-kalshi-*.parquet`. Kalshi's reuse terms for new
  raw price files have not been checked (that repo's REVIEW.md, R2-7). Add them only after that check is recorded.
- `.nojekyll` keeps GitHub from running Jekyll, so folders and files are served exactly as committed.
- Pages paths are relative, so each dashboard works under its subfolder.
- These dashboards moved here on 2026-11-10 from ChatGPT Sites (`*.smartgoldfish.chatgpt.site`), which only the
  owner's ChatGPT account could redeploy. Those older copies may be out of date.

## Portfolio freshness check

- `data/portfolio_status.json` records verified public snapshot dates, commit dates, update cadences, and upcoming release deadlines across the portfolio.
- `python tools/check_freshness.py --format markdown` prints the **Portfolio Drift & Upcoming Deadlines** digest (and exits non-zero if any scheduled dashboard is overdue).
- `python tools/check_freshness.py --update-index` refreshes the `Freshness & cadence` table in `index.html` from the manifest.
- `python -m unittest discover -s tests -v` runs the offline freshness and zero-leak checks.
