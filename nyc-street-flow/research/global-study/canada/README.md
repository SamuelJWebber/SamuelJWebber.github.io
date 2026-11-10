# Canada evidence expansion

The best immediate additions are **Burrard Bridge 2009** (a true vehicle-lane conversion with daily directional bike, pedestrian and vehicle data) and **Toronto Bloor 2016** (treatment and parallel-route counts plus observed driving times). They improve measurement, but neither supplies a defensible causal estimate of total person flow or complete journey minutes yet.

Run `python reproduce.py` in this directory. It recreates all CSVs and the download hash manifest from the preserved City API export and explicitly transcribed primary tables. `comparisons.json` contains dashboard-ready comparisons; `candidates.json` contains seven screened cases with source URLs, page provenance, eligibility and gaps.

## New calculations

| Case / quantity | Before | After | Change |
|---|---:|---:|---:|
| Burrard daily bicycles, six matched pairs | 3,713.67 | 5,527.67 | +48.85% |
| Burrard daily pedestrians, same pairs | 2,362.33 | 2,647.83 | +12.09% |
| Burrard daily vehicles, same pairs | 65,127.33 | 65,114.33 | −0.02% |
| Bloor corridor bicycles | 3,309 | 4,925 | +48.84% |
| Sum of three corridor-average bicycle counts | 8,896 | 9,267 | +4.17% |
| Sum of three corridor-average vehicle counts | 58,315 | 56,478 | −3.15% |
| Bloor AM eastbound measured driving time | 10:01 | 12:01 | +2:00 |
| Bloor PM westbound measured driving time | 11:14 | 15:29 | +4:15 |

**Burrard sensitivity must be visible:** the immediate four-weekday comparison gives bicycle growth of **108.58%** and vehicle decline of **5.50%**, substantially different from the six-pair result. A wider 11-pair bicycle/vehicle-only comparison gives +44.22% bicycles and −0.39% vehicles. These are descriptive windows, not causal effect estimates or statistical confidence intervals.

The six-pair rule starts at the first pedestrian observations (June 30, 2009), stops before installation (July 9), and pairs each date with the same weekday 14 days later. Drop a pair if either date has a City event comment or missing data for any of the three modes. Remaining pairs are July 2/16, 3/17, 4/18, 6/20, 7/21 and 9/23. All rejected pairs and reasons are preserved. Totals are used as published; 16 directional-sum inconsistencies across the full series are audited separately. Missing values are never filled with zero.

For Toronto, the three corridors are Bloor, Dupont and Harbord. Each published count is averaged over that corridor's sites. Their sum is a **corridor-average count index**, not an audited common screenline or a count of unique journeys. Parallel roads can receive displaced traffic and must not be labeled untreated controls. Daily totals use Attachment 1 consistently: October Bloor vehicles are 19,918 there versus 19,919 in the main text. Bloor's 49%, 56% and almost 70% cycling increases refer respectively to all four sites, excluding Bay outside the pilot, and dry-day counts; they are not interchangeable.

## What the enlarged pool changes

Burrard supplies all-bike counts, avoiding bikeshare penetration assumptions, and a common bridge boundary for walkers, bicycles and motor vehicles. The City also reports an Ontario Bike Route model of expected bicycle use and observed bus/vehicle running times. The comparison series and fitted model are not included in the API export, so that model has not been independently reproduced. Some approach routes became slower even where general bridge travel times were reported unchanged.

Calgary adds a planned network evaluation, cycling counts, driving times and a possible broader downtown cordon outcome. It mixes moving-space conversions with shared-space treatments, and manual/GPS observations represent one day per wave. The published 12 Avenue PM improvement includes a construction-delayed baseline. Dunsmuir Street is a verified three-to-two moving-lane conversion, whereas Dunsmuir Viaduct's third lane had already been closed. Hornby mostly reallocates parking north of Davie, so whole-corridor effects are not clean evidence about moving-lane removal. Burrard 2017 includes widening and turn-lane changes; it is a package intervention and is outside the acquired 2009–10 panel.

The unfavorable 1996 Burrard trial is retained: City staff reported 7,500 fewer people crossing per day during a one-week northbound-lane pilot and bus delays. Underlying Appendix C was not retrieved, and one transitional week cannot establish mature or citywide effects. It prevents selection solely on successful outcomes.

## Remaining identification work

Acquire original comparison-route series and dated site/GPS observations; add weather and event calendars; measure other crossings and parallel-road displacement; align vehicle occupancy, bus loads and subway/rapid-transit passengers to the same boundary and periods. Separate installation/adjustment from mature operation. A change in bicycles plus vehicles is not a change in total people, and driving a road segment is not a complete commute. Do not pool these heterogeneous before/after percentages into a global causal average.
