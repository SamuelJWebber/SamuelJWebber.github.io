# Third Avenue bus ridership: route-level entries around the 2023 redesign

Started 2026-11-09. This specification was committed **before** any 2022–2024 ridership outcome was fetched. The
only ridership seen beforehand was one March 2023 query used to list Manhattan route names. Changes made after
seeing results are listed at the end, with reasons; the original specification stays above them.

## Question

Did fare-registered bus ridership on the routes that run through the Third Avenue project change differently from
other Upper East Side north–south routes between the same frozen windows the bus travel-time study uses?

This fills part of one named gap on the Third Avenue scorecard: "bus onboard loads remain missing". It does **not**
fill it. Route-level entries are not passengers crossing E60th Street, and nothing here measures time, walking,
cycling, car occupancy or an all-mode total.

## Source

MTA Bus Hourly Ridership: 2020–2024, data.ny.gov dataset `kv7t-n8in`. Fields: hourly `transit_timestamp`,
`bus_route`, payment method, fare class, `ridership`, `transfers`. Per MTA, ridership counts OMNY and MetroCard
entries and already includes transfers, so transfers are never added again. `fetch.py` stores the exact queries,
responses, retrieval time and SHA-256; `analyze.py` reads only the stored responses.

## Fixed design

- **Treated routes:** M101, M102, M103. They run northbound on Third Avenue through the E59–E96 project and
  southbound on Lexington Avenue, which the travel-time study uses as its control. Route entries cannot separate
  the two directions or the project segment from the rest of each route.
- **Primary comparison:** the pooled Upper East Side north–south routes not using Third Avenue: M15 and M15+
  (First/Second Avenue local and Select Bus Service) and M1, M2, M3, M4 (Fifth/Madison).
- **Reported separately, not primary:** First/Second (M15, M15+) and Fifth/Madison (M1–M4) groups; and the travel-time
  study's exact route lists, M15 Local alone and M1/M3/M4.
- **Windows:** before January–June 2023; after January–June 2024; July–December 2023 excluded as implementation,
  matching the travel-time study. Placebo: January–June 2022 against January–June 2023, both before construction
  (spring 2023 transit signal priority on Third Avenue is a known complication of the 2023 window).
- **Days:** Monday–Friday, excluding federal holidays in those windows (New Year's Day observed, Martin Luther King
  Jr. Day, Presidents' Day, Memorial Day, Juneteenth observed).
- **Outcomes:** mean weekday entries per route group, all day and 16:00–18:59 (the hours of the scorecard's
  −211 people/h motor-plus-bus comparison).
- **Statistic:** for each calendar month m, the change in log mean weekday entries, treated minus comparison:
  `d_m = log(T_after,m / T_before,m) − log(C_after,m / C_before,m)`. Six months get equal weight;
  the reported relative change is `exp(mean d_m) − 1`, with the six monthly values and their range. No interval is
  called a confidence interval: six month pairs on one corridor are not independent replications.
- **Reading rule, fixed now:** the main contrast is only interpretable as a ridership shift attributable to the
  package if the 2022→2023 placebo is near zero. If the placebo is as large as the main contrast, report the main
  contrast as descriptive and say the comparison failed its pre-period check.

## Known limitations, stated in advance

- Entries are recorded where a fare is registered, anywhere on each route and in both directions.
- Fare evasion is not measured and changed over these years; entries undercount riders by an unknown, time-varying
  share that may differ by route and by fare-collection method (M15+ collects fares off-board).
- One treated corridor. Concurrent changes elsewhere (service changes, detours, the comparison routes' own
  projects) can move either side.
- This is a route-ridership comparison, not a travel-time, door-to-door or all-traveler result.

## Results (2026-11-09, after the specification above was committed)

Files: `analysis.json`, `contrasts.csv`, `monthly-weekday-means.csv`. Inputs: 72 monthly responses in `raw/`
(hashes in `source-manifest.json`), all nine routes present on all 1,096 days. The January–June windows use 375
weekdays (125 a year; 14 federal holidays excluded); `weekdays_used` in `analysis.json` (768) counts all 36 months,
keeping the July–December holidays (see the note below). Run: `python fetch.py` then `python analyze.py`.

**The comparison fails its pre-period check, so the main contrast is descriptive only.**

| Weekday entries, treated vs pooled comparison | Treated change | Comparison change | Relative change | Months below zero |
| --- | --- | --- | --- | --- |
| Main, Jan–Jun 2023 → 2024, all day | −3.7% | +1.9% | **−5.5%** (monthly −10.9 to −2.9) | 6 of 6 |
| Placebo, Jan–Jun 2022 → 2023, all day | +7.8% | +15.3% | **−6.5%** (monthly −8.2 to −4.9) | 6 of 6 |
| Main, 16:00–18:59 | −4.2% | +3.1% | **−7.1%** | 6 of 6 |
| Placebo, 16:00–18:59 | +7.7% | +16.8% | **−7.8%** | 6 of 6 |

In plain words: entries on M101–M103 were already falling about 6–8% a year relative to the other Upper East
Side routes before construction began, and they kept falling at about the same rate afterwards. The routes' own
relative decline, not the redesign, is the simplest reading. Every separately reported comparison group shows the
same pattern (`contrasts.csv`); the M15-Local-only placebo is the smallest (−3.9%) but is still negative.

What this does and does not show:

- It does **not** show that the redesign reduced bus ridership: the decline predates it.
- It does **not** show a ridership gain either. Subtracting the placebo from the main contrast leaves about +1
  point; that difference-of-differences was not pre-specified and six month pairs give it no precision.
- It adds no passenger count at the E60th Street boundary, so the Third Avenue scorecard's bus-rider figure and
  its "loads missing" gap are unchanged.

Not pre-specified, noted for the next reader: `monthly-weekday-means.csv` covers all 36 months, but July–December
means include holiday weekdays (the holiday list covers only January–June); those months are not used in any
contrast.
