# Consumer-finance market audit

This is a frozen, targeted study of ten verified Kalshi series, including current
listings and the exchange's historical catalogue. It is not an exhaustive survey
of all consumer-finance markets or all venues. The registry preserves contracts
without useful prices so that the difference between a listing and a usable
forecast remains visible.

## Reproduce

Use Python 3.11 or later; the collector and analysis use only the standard library.
From the extracted source package root:

```sh
python scripts/consumer_finance.py
```

This is an **offline replay**. It reads the bundled frozen response files,
checks their response hashes, and rebuilds `summary.json`, `manifest.json`,
`markets.csv`, `observations.csv`, `attempts.csv`, and `release-source-notes.json`.
Missing inputs fail explicitly rather than falling back to the internet.

For a deliberately newer independent snapshot, use a new output directory:

```sh
python scripts/consumer_finance.py --collect --output new-consumer-snapshot
```

Do not collect into an existing folder expecting fresh prices: existing frozen
responses are deliberately reused. Publication-date mappings are curated in the
script and must be audited before using newly added periods. Failed requests are
recorded, not silently assigned zero prices. The publisher must explicitly copy
and review a new snapshot before it replaces the website's data.

## Files and provenance

- `summary.json`: market registry, series definitions, historical observations,
  horizon aggregates, matched-horizon comparisons, every exclusion, and methods.
- `markets.csv`: every deduplicated market, full settlement rules, source links,
  observation period, exchange clocks, release gates and current book diagnostics.
- `observations.csv`: every historical observation entering the primary scores.
- `attempts.csv`: all finalized contract/horizon attempts and exclusion reasons.
- `manifest.json`: the exact inputs used in the final computation, with URLs,
  retrieval timestamps, response hashes and frozen-file hashes.
- `raw/`: API responses and seven government source documents. This directory
  also retains responses from the preliminary exchange-close-clock investigation.
  The final manifest identifies the inputs actually used by the published study.
- `release-source-notes.json`: the exposed manual 2026-Q1 date-bound override.

All API responses come from the public Kalshi API. Government release documents
are frozen for auditing; their HTML is data and is never executed by the script.
These files preserve first-collection state, not a guarantee that upstream pages
or exchange metadata will remain unchanged. `asOf` is the last market-catalogue
request timestamp; later history/document retrievals are separately recorded.

## What counts as a forecast

1. Include only finalized binary contracts with an official YES or NO outcome.
   Closed-but-unfinalized markets remain in the registry but are not scored.
2. Exclude the one mortgage contract whose explicit measurement year is after
   its finalized close. Do not silently repair its rules using a ticker guess.
3. Exclude any-month saving-rate first-passage targets from the fixed-period
   horizon study. Retrospectively choosing the first threshold-crossing date
   would make the horizon depend on the outcome. Keep those contracts visible.
4. Anchor each eligible contract to a documented public release timestamp
   (BEA, exact) or a conservative 00:00 UTC bound at the start of its documented
   release date (Fed/FRBNY, intraday time unverified). For the latter, nominal
   lead times are lower bounds relative to that documented release. Earlier
   dissemination not found by the source audit remains possible.
5. Subtract 1, 7, 30, 90, 180 or 365 days. If the contract was not yet open,
   exclude it. Never use a later price to fill an earlier missing observation.
6. Look only at completed hourly candles at or before the cutoff and less than
   24 hours old. Choose the latest candle with interior two-sided quotes,
   bid <= ask, spread <= 20 percentage points, positive hourly volume, and a
   contemporaneous last trade. Quotes and trades inside the hour need not be
   simultaneous. Bid/ask sizes are unavailable for these historical candles.
7. Score the unrounded YES midpoint against the official binary outcome using
   squared error (Brier). Retain the bid, ask and trade for sensitivity analysis.
   The midpoint is a forecast proxy, not a purchase price. Fees are not assumed.

There is no favorite folding or 51% cutoff in these data. Exact-probability
calibration groups identical midpoints, not broad probability bands. A display
may separately fold favorites, but must identify that transformation.

## Dates, outcomes and dependent samples

Economic measurement periods, first releases and exchange closes are different
clocks. Some exchanges closed after the underlying data were already public;
the primary study therefore uses the source publication clock. Many contracts
opened after the quarter or month being measured ended. Those are release
nowcasts, not forecasts before the economic losses or spending took place.

The 2026-Q1 Fed override deserves particular scrutiny. ALFRED lists May 19;
an indexed earlier Fed DDP page reported May 18. The current frozen DDP HTML
instead reports August 25. We conservatively use May 18 but expose its weaker
provenance in `release-source-notes.json`; the current HTML alone does not verify
that earlier date. Revisions to FRED values are never substituted for exchange
settlement outcomes.

Several thresholds on the same release are not independent observations.
`releaseId` clusters the common publication, including card delinquency,
charge-offs and mortgage delinquency released together by the Fed. BEA income
and saving targets associated with the same publication share a release ID.
`underlyingId` separately identifies the series and measurement period.
Contract-weighted and equal-publication-weighted scores are both supplied.
Successive publication dates may still be dependent; no independence claim or
significance test is made.

Each horizon can have different eligible contracts. The raw horizon curve
therefore cannot show that forecasting improves as the event approaches.
`matchedPairs` compares only the same qualifying contracts at both horizons,
and reports the small number of common publication releases.

## Current quotes and interpretation

The current-quote screen requires an active market, interior bid and ask,
spread <= 20 percentage points, positive size on both sides and reported trading
in the preceding 24 hours. This is a transparent quality screen, not proof of
freshness or executable depth: the API snapshot has no quote-update timestamp.
Reported volumes are **contracts**, not dollars or trade counts. A stale last
trade must not be presented as a current probability.

Bank card delinquency is a balance-based bank measure; it is not the same as
credit-bureau 90-day delinquency. Charge-offs are annualized and net of recoveries.
The Carbon Arc Affirm/Klarna/Afterpay contracts measure a transaction-panel
spending index, not those firms' loan originations or credit losses. December
saving-rate contracts and any-month threshold-crossing contracts are distinct.

The screened historical sample is small. No result establishes incremental
predictive value for a particular lender, FICO segment, cash-advance product or
underwriting policy. That would require an out-of-time test on the lender's
actual, mature loss outcomes and data available at each forecast origin.

## How to challenge or extend the study

Start with a precise ticker or source URL, the disputed clock or rule, the
expected result and the frozen input showing the difference. Useful extensions
include independently timestamped publication archives, earlier quotes, verified
additional consumer-finance series, and out-of-time lender-loss benchmarks.
Keep API collection separate from replay, include exclusions, and compare new
methods on identical contracts before claiming an improvement. Do not publish
private borrower or lender records in this public research package.
