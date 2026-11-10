# NYC bicycle crossing panel

This is a descriptive extension of the Brooklyn Bridge lane-conversion analysis. It measures bicycle crossings on designated paths. It does not estimate total people moved, travel speed, mode switching, or a causal effect of the lane conversion.

## Sources and reconstruction

`fetch_panel.py` obtains daily channel/status aggregates directly from NYC DOT's Bicycle and Pedestrian Counts dataset (`ct66-47at`), sensor hardware metadata from `6up2-gnw8`, and Central Park daily weather from NOAA station USW00094728. Exact query URLs and source responses accompany the files. Run with Python 3; `analyze_panel.py` additionally requires pandas and NumPy. `check_unique.py` independently checks timestamp uniqueness across status categories.

The primary sensors are Brooklyn 300020904 (comprehensive series), Manhattan 100062893 (comprehensive series), and Williamsburg 100009427. Their distinct flow channels are summed. The Brooklyn former-promenade and new-roadway sensors, and Manhattan physical counter, are checked separately for exact daily reconciliation, and never added again to the comprehensive totals.

The comprehensive Brooklyn series joins the old designated path to the new designated path. Post-opening unauthorized cycling on the pedestrian promenade is outside this definition. Changing the counter and path at the intervention creates a measurement caveat that completeness and reconciliation do not eliminate.

## Complete calendar days

A channel-day must have one nonnull count per expected local quarter-hour, combining its raw/modified status partitions. NYC's floating timestamp series has 92 slots on spring daylight-saving transitions and 96 slots on other days, including autumn transitions. Every active flow must pass. Manhattan and Williamsburg have two flow channels before 2020-11-23 and four thereafter. This changes the measurement regime; the added channels are distinct flows, not duplicate copies of the old counts. On their partial installation day, the whole date is excluded.

If any primary bridge fails completeness, that date is excluded from all three bridges' monthly and annual comparisons. Monthly averages and the all-three total therefore share the same dates. The daily CSV preserves all dates, includes a `valid` flag, and leaves analytical count columns blank on excluded dates. `raw_*` columns retain their incomplete source totals for audit only. Source zeros are retained; completeness cannot prove that an instrument was operating correctly.

## Annual comparisons

The principal descriptive comparison is June 2020–May 2021 versus June 2022–May 2023. Both windows cover the same twelve calendar months. The intervening gap avoids construction (starting June 21, 2021), the September 14 opening day, and the first months of hardware transitions. This is not an immediate treatment-effect window and includes pandemic-era differences.

Sensitivity comparisons use the first complete twelve-month post-opening window (October 2021–September 2022), June 2023–May 2024, the original June 1–20 comparison, a pre-pandemic calendar baseline, and a shorter same-season window wholly after the comparator flow-channel change. They are intentionally shown separately.

A relative change is the ratio of Brooklyn's post/pre growth factor to the other two bridges' combined growth factor, minus one. It is a percentage change in a ratio, not a percentage-point change in bicycle share. The all-three total helps reveal whether gains on Brooklyn are offset by losses on those adjacent routes, but does not include other crossings or non-cycling modes.

## Weather model and falsification

The dependent variable is the daily log ratio of Brooklyn counts to Manhattan plus Williamsburg counts. The main annual-window regression uses a post-period indicator, month-of-year indicators, day-of-week indicators, mean daily temperature, its square, precipitation and snowfall. Temperature is the arithmetic mean of NOAA's daily maximum and minimum, rather than a measured 24-hour temperature average.

The reported interval is conditional regression uncertainty, with Newey–West covariance over 28 actual calendar-day lags. Dates missing from the analysis have zero score contributions to the covariance calculation, so the year-long separation between annual windows is not mistakenly treated as consecutive days. This interval does not cover confounding, route spillovers, calibration changes, modeling choices, or a causal counterfactual.

The sensitivity model adds a linear calendar-time trend. Its broad interval reflects difficulty distinguishing a period change from secular drift with seasonal controls and separated windows. No model selects a specification on significance.

The false opening date of June 1, 2020 compares June 2019–May 2020 with June 2020–May 2021, all before construction. A material relative change at this false date undermines interpreting the primary coefficient as a lane-caused effect. A separate pre-period trend model estimates the same vulnerability. The pandemic and counter-regime changes can drive these failures; neither is evidence of a bike-lane effect before opening.

## Interpretation

Manhattan and Williamsburg can receive or lose diverted trips. They are comparison routes and network outcomes, not demonstrated unaffected controls. The analysis makes no claim that the weather-adjusted relative change, or the aggregate bicycle increase, is caused by converting the lane. Establishing the all-traveler effect still needs synchronized occupancy, transit passenger, pedestrian and complete journey-time observations and a credible untreated comparison.

## Snapshot and recent coverage

Retrieved November 5, 2026, covering January 2019–October 2026. Of 2,861 calendar dates, 2,748 pass the joint completeness rule. Historical 2019–2024 excludes three dates. Coverage falls sharply in June–October 2026; May 2026 is the last month with at least 80% common complete dates. Monthly fields `coveragePct` and `displayEligible` expose this. Use only eligible months for a continuous trend line, and keep incomplete months visible in the coverage table. Missing and partial dates must not be treated as zero-count days.

The cross-status audit fetched every raw record on every mixed-status day: 1,536 Brooklyn rows, 27,456 Manhattan rows, and 384 Williamsburg rows. None duplicate a timestamp/flow pair. Combined with the original per-status distinct-timestamp checks, this validates that raw and modified partitions do not double-count those dates.

The bundled raw responses preserve the analyzed snapshot. Fetching again can return revised official counts. `fetch_panel.py` caches existing responses; delete them deliberately to obtain a fresh snapshot.
