# Market Calibration Atlas

Public dashboard: <https://market-calibration-atlas.smartgoldfish.chatgpt.site>

Created by [Samuel Webber](https://www.linkedin.com/in/samuelwebber).
This is a versioned research snapshot of prediction-market prices, outcomes,
calibration, market reaction and consumer-finance contracts. It is a static
website; no live trading or account connection is required.

## What the public source download contains

- `dist/*.html`, `*.css`, `*.js`: the complete current browser application,
  including the main dashboard, six research studies and Consumer Finance.
- `scripts/`: current collection, analysis, validation and packaging code.
- `legacy/`: the original venue collectors, builders, maps and instructions,
  recovered unchanged from the earlier reproduction bundle. These cover
  Polymarket, Kalshi, PredictIt, Manifold, IEM and Intrade. The original version12
  PDF and standalone HTML export scripts are in `legacy/exports_v12/`; their
  README documents fixed content, path assumptions and incomplete full-HTML QA.
- `SOURCE_MANIFEST.json`: exact source-file hashes, a content-addressed
  snapshot ID, and an inventory of published result/input files with hashes
  and download URLs. These data files are separate to keep the source compact.
- `CONTRIBUTING.md` and `REPORT_TEMPLATE.md`: how to challenge a finding,
  reproduce it and share a proposed change.

The existing [reproduction bundle](https://market-calibration-atlas.smartgoldfish.chatgpt.site/downloads/reproduce.zip)
also contains selected frozen inputs and compact results, including weather
cache files and sports observations. The two bundles serve different purposes:
this source snapshot provides the complete current code; that research bundle
preserves the earlier input package and its original documentation.

The source is saved in the Site's versioned Git repository and is downloadable
publicly. The hosting repository is not a public GitHub collaboration project.
There is no hosted issue tracker or pull-request endpoint on this website.

## Inspect and run the website

Python 3.11 or later is sufficient to verify files, download published data and
serve the frontend. After extracting the source ZIP:

```sh
python scripts/check_source_bundle.py --directory .
python scripts/restore_public_data.py --prefix dist/data/
python -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. Restoring `dist/data/` downloads the **published
outputs**, allowing the existing charts to run; it does not regenerate research
results. Additional downloads such as the panels are available by exact path:

```sh
python scripts/restore_public_data.py --path dist/downloads/kalshi.parquet
```

The restore command verifies every selected file's SHA-256 before saving it.
If the public website changes, a hash mismatch is reported rather than silently
accepting a different snapshot. It supports `--list` to inspect the inventory,
`--prefix`, repeated `--path`, and `--all`. `--all` includes large files and the
older reproduction bundle. Preserve an extracted snapshot and its inputs when
citing results; a mutable website URL alone does not identify a dataset.

## Recompute research results

Use an isolated Python environment and install the imported analysis libraries:

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.txt
```

`requirements.txt` lists dependencies, not a tested universal lockfile. The
historical analyses were not all run with one frozen software environment.
The historical PDF exporter additionally needs `reportlab` and `matplotlib`;
these are optional and documented in `legacy/exports_v12/README.md`.
Backend/API changes and package-version changes can affect recollection or
recomputation. Record the installed versions in any reproduction report.

| Research area | Entry points and instructions |
| --- | --- |
| Consumer finance | `scripts/consumer_finance.py`; its `--help`, module documentation and result metadata describe the frozen snapshot and historical quote screens. |
| Exact prices and all horizons | `scripts/aggregate.py`, `windows.py`, `intervals.py`, `matched.py`; start from the venue forecast panels. |
| Calendar and volume | `scripts/history_volume.py`, `pool_history.py`, `trade_window_volume.py`; read `scripts/trade_window_volume.md` and `scripts/election_volume_notes.txt`. |
| Bid/ask and fees | `scripts/quote_kalshi.py`, `quote_predictit.py`; frozen rows and source rules are in `dist/data/quotes/`. |
| Reliability checks | `scripts/validation.py`, `refresh_audit.py`; the latter uses the separate PredictDesks benchmark. |
| Hourly forecasts and price moves | `scripts/intraday_notes.txt`, `shock_notes.txt`, `shock_evidence_notes.txt`; these specify inputs, commands and interpretation limits. |
| Weather, sports, crypto, quote diagnostics, recalibration, consensus | `scripts/expansion_README.md`; six individual Python scripts document the frozen inputs and collection options. |
| Original venue construction | `legacy/README-original.txt`, venue-specific notes, and the preserved builders in `legacy/`. |

For a concrete base-aggregation run, restore a venue panel and run:

```sh
python scripts/aggregate.py dist/downloads/kalshi.parquet --output dist/data
python scripts/matched.py dist/downloads/kalshi.parquet --output dist/data
```

This rebuilds that venue's summaries, not every dashboard view. Read the
applicable study instructions before running other stages. Data may be inputs
as well as outputs: for example, recalibration can use frozen label metadata
from its previously published JSON. Work in a copy when comparing versions.

The consumer-finance audit is independently checkable after restoring its data:

```sh
python scripts/audit_consumer_finance.py
```

This verifies hashes, temporal eligibility, score aggregation and exclusions,
then reproduces the result in a temporary copy with network access blocked.

## Known reproduction boundaries

- Original Kalshi, Manifold, IEM/Intrade and some PredictIt scripts preserve
  their historical directory assumptions. Several write under `/tmp/kaldata`,
  `/tmp/manidata` or `/tmp/market_dash`. Read the supplied notes and adapt these
  paths or reproduce that layout in a disposable environment. This is not a
  single-command rebuild of all raw sources.
- Not every original raw archive is redistributed. Some are large, externally
  hosted, restricted, or available only from their original providers. The
  six studies' guide distinguishes bundled inputs, separately published data
  and inputs that must be fetched upstream.
- Historical market close/settlement is often different from the time a
  real-world result became public. A forecast labelled “7 days” can use a
  nominal daily interval, rather than an exact timestamp seven days earlier.
  Each source documents its clock; preserve those distinctions.
- Repeated thresholds on one economic release are not independent events.
  Sparse and untraded consumer-finance contracts cannot establish calibration.
- A source hash proves which bytes were used. It does not prove the source is
  complete, the labels are correct, or the statistical conclusion is causal.

## Build and verify the source release

From the maintained checkout, after all edits and data refreshes are finished:

```sh
python scripts/package_source.py
python scripts/check_source_bundle.py dist/downloads/source-code.zip
```

The packager includes all current Python/text documentation in `scripts/`, all
preserved files in `legacy/`, top-level project docs, and all frontend source
files in `dist/`. It inventories every public file under `dist/data/` and the
separate public downloads. It excludes `.git`, the hosting identity, credentials,
local caches and its own output ZIP. The content-addressed snapshot ID identifies
the included source bytes; `base_commit` is explicitly the checkout's commit
before packaging, not a claim that it identifies the eventual release commit.
The external manifest additionally records the finished ZIP's hash.

## Attribution and reuse

Keep the original source notices and dataset credits. Availability in a public
bundle does not change third-party terms. In particular, the Manifold source
notes restrict its research exports to personal, noncommercial use; its original
market-level archive is not redistributed here. Other providers' licenses and
attribution requirements are recorded in their source notes and manifests. No
new blanket license is assigned to third-party material by this project.
