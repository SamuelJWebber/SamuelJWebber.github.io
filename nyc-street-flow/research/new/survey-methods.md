# NYC CMS 2024 linked-journey analysis methods

This is an independent descriptive reconstruction from NYC DOT public microdata, checked 2026-11-05. It is not the official DOT headline or a causal estimate of bike-lane effects.

## Files and reproduction

Run `python reproduce.py` beside the files; Python3, pandas and numpy are required. Missing input files download from their official URLs; `--refresh` redownloads them. `survey-analysis.json` contains SHA-256 input checksums, filters, exact values, subset tables and sensitivity results. `input-manifest.json` separately lists the official URLs and hashes of every raw input and source document. The official-headline reconstruction diagnostic is recomputed from those raw records on every run; only the quoted DOT published percentages are transcribed constants, explicitly bound to the archived report hash and transcription date. `mode-summary.csv` and `subset-mode-summary.csv` are flat exports. `linked-journeys.csv` preserves the reconstructed analytical records. No exact locations or GPS traces are present in these public tables.

## Population and scope

Personal journeys of NYC adult residents18+, including their journeys outside the city. The survey excludes nonresident commuters/visitors, children, commercial travel (including delivery cycling), and group quarters outside the sampling frame. It describes the field period, not all street users or a complete year. The additional both-endpoints-NYC and Manhattan-origin domains use citywide weights; they remain resident-only estimates. Direct home–work journeys use endpoint purposes1 and2 in either direction; this is a narrow commute definition, excluding chained errands, work-related category3 and all other purposes.

The Person file includes household roster members; the travel diary is linked to the adult participant. Join Trip to Person by household+person IDs, Household by household ID, and Day by day ID, validating one-to-many cardinalities. All238 journey records without a Household match have zero citywide weight. They cannot contribute to the population estimate.

## Journey reconstruction and weights

The Trip CSV contains115,920 stage rows. Collapse globally by person_id+linked_trip_id, not day, because53 linked journeys cross days through synthetic endpoints. All80,081 groups have the stated number of legs and unique contiguous leg numbers. Each has exactly one original nonsynthetic row whose trip_id equals linked_trip_id. Use this anchor to identify the eligible complete travel day. Do not require trip_survey_complete=1: valid complete days include synthetic rows and imputed trip responses.

Attrition:80,081 linked IDs →75,210 with complete original-anchor day →74,974 adult participant journeys with a NYC Household record →74,935 with identical positive finite citywide trip weights on every leg. The baseline has3,349 diarists. Forty groups overall,39 on eligible complete days, have inconsistent leg weights. The baseline omits those39 and retains99.571% of potential weighted journeys using maximum leg weight for the excluded groups. Original-anchor, first-leg and maximum-leg weight variants are provided. The guide describes2× home-based adjustments for online/call diaries that plausibly explain purpose-related differences between legs, but does not prescribe a linked-journey collapse rule.

Use one trip_weight_citywide once per linked journey. Do not sum repeated leg weights, multiply by travel party size, or substitute household/person weights. For daily trip rates, the separate Day table supplies18,970 complete positive-weight days from3,512 adults, including2,480 zero-trip days. The denominator is6,423,515 weighted adults; baseline linked journeys per adult per day are3.650. Trip totals include journeys outside NYC.

## Main mode

Use maximum valid supplied mode_type1..14 across all legs; retain unknown995 in the trip denominator. This extends the guide's within-row main-mode hierarchy to linked journeys and is an explicit analyst rule. Use the supplied broad codes because the appendix crosswalk and detailed codes do not perfectly match the data. Do not prioritize transit submodes by numeric code. The optional subway indicator means any leg explicitly states code30 in mode_priority or mode_1..mode_9. It overlaps main Transit and is not another mutually exclusive mode-share category. Bicycle includes conventional and electric bikes. The survey Car group can contain motorcycles/mopeds; it is not a vehicle traffic count.

## Duration and minute-share universes

Recorded/reconstructed journey elapsed minutes equal final arrival minus first departure. Nonmissing leg durations in seconds exactly match their timestamps; use seconds/60 instead of rounded duration_minutes. Elapsed time includes gaps between legs, which summed leg time omits. Departure timestamps may include RSG late-pickup imputation.

All10,256 raw missing durations are synthetic access/egress legs. Their timestamps copy adjacent leg boundaries; they do not measure the omitted access/egress time. Baseline weighted missing-time coverage is11.155% overall and64.439% of Transit journeys. Missing time is not assumed zero. The elapsed estimator is time captured in the public data, not fully measured door-to-door time.

Trip shares use all baseline journeys regardless of missing time. Captured-person-minute shares use their recorded elapsed minutes; they cannot be interpreted as shares of true total travel time. Complete-leg tables use only journeys with every duration present and form a different selected universe. That selection is particularly consequential for Transit. Separate columns report weighted duration coverage, sample counts, summed-known-leg estimates, uncapped means, weighted medians, a0<elapsed<=240minute restriction, and DOT-duration-flag-clear estimates. The240minute cutoff is a sensitivity choice, not a verified boundary between valid and invalid records.

Additional scenarios add0,5,10 or15 minutes once per Transit journey with any missing synthetic access/egress. This is an illustrative total allowance per affected journey, not per leg and not estimated from observations. It changes captured-plus-assumed minute totals, not mode shares or actual travel behavior. Other modes' missing time is unfilled.

## Main descriptive results

| Mode | Sample journeys | Trip share | Recorded mean min | Recorded median min | Weighted journeys missing time |
|---|---:|---:|---:|---:|---:|
| Walk / wheelchair | 29632 | 36.83% | 22.2 | 9.3 | 0.0% |
| Bicycle / e-bike | 2157 | 2.39% | 31.1 | 15.0 | 0.0% |
| Shared scooter | 117 | 0.11% | 45.7 | 16.6 | 0.0% |
| Taxi | 311 | 0.54% | 43.2 | 17.1 | 0.0% |
| App ride-hail | 1213 | 1.48% | 44.6 | 16.0 | 0.0% |
| Other | 358 | 0.64% | 43.4 | 18.7 | 0.2% |
| Car (survey group) | 26512 | 38.80% | 33.8 | 15.0 | 0.0% |
| Car share | 38 | 0.09% | 45.9 | 25.0 | 0.0% |
| School bus | 8 | 0.02% | 74.9 | 29.1 | 0.0% |
| Ferry | 190 | 0.20% | 76.5 | 41.3 | 18.8% |
| Transit | 13152 | 17.24% | 69.9 | 48.1 | 64.4% |
| Long-distance passenger | 123 | 0.19% | 199.2 | 114.9 | 1.3% |
| Unknown main mode | 1124 | 1.47% | 13.4 | 6.9 | 0.0% |

Uncapped means are sensitive to long tails. Restricting recorded elapsed time to0–240minutes gives means of23.50 for Bike,23.81 for Car and55.12 for Transit, retaining99.13%,98.77% and96.92% of each mode's trip weight respectively. These modes travel different distances and purposes, so their averages do not measure comparative speed or the effect of switching modes.

## Descriptive matched sensitivity

Exact common cells combine actual path-distance bins[0,.5,1,2,3,5,10,20,infinity) miles, activity purpose, and origin CMS zone. Homebound trips use origin purpose; others use destination purpose. Require at least5 sampled journeys and3 distinct diarists per mode per cell. Restrict to nonmissing leg distance/duration, positive elapsed<=240minutes, no DOT duration/distance flags, and a NYC origin. Both modes are standardized to the pooled weighted distribution of common cells. JSON reports sample counts, distinct diarists, coverage and means.

This cannot identify the same origin/destination, departure time or traveler. Actual path length is mode-dependent, residual distance differences remain inside bins, and missing transit data select the comparison sample. Do not treat the difference as causal time saved by cycling or a lane conversion. No survey-design confidence intervals are supplied; repeated trips by diarist are correlated.

## Published-headline reconciliation

DOT's printed report page9 specifies trips starting and ending in NYC, with published shares37.6% Walk,20.7% Transit,2.9% Bike/Micromobility,38.5% Car and0.2% Other. Our separately audited city-to-city, known-mode, original-anchor reconstruction gives40.957%,19.284%,2.808%,36.402% and0.549% across65,132 journeys. The public report does not specify the complete filter/recoding recipe. Geography, citywide/zonal weighting, linked/stage counting, completeness and outlier variants did not reproduce it. The discrepancy is unresolved and the baseline is presented as an independently defined estimate, never as an exact reproduction of DOT's headline. See audit-methods.md for variants.

## Primary sources

- [2024 trip table](https://data.cityofnewyork.us/d/wgnh-qwsg), [Day](https://data.cityofnewyork.us/d/naav-ygga), [Person](https://data.cityofnewyork.us/d/i2im-iqtt), [Household](https://data.cityofnewyork.us/d/5mb3-padx).
- [2024 user guide](https://www.nyc.gov/html/dot/downloads/pdf/2024-cms-user-guide.pdf), especially §§3.3 and4.3–4.7.
- [Official data dictionary](https://data.cityofnewyork.us/api/views/wgnh-qwsg/files/c2e15726-bbd7-4057-ade3-cb3712a2ee17?download=true).
- [2024 summary report](https://www.nyc.gov/html/dot/downloads/pdf/2024-cms-report.pdf), printed page9.
