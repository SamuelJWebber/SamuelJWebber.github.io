# Data feasibility for a causal NYC lane-conversion study

Checked November 5–6, 2026. The accompanying `data-map.json` distinguishes acquired records, tested metadata, failed requests, and information that still requires a request or new collection.

The most feasible immediate analysis is a set of **component-specific service and demand effects**: taxi request-to-drop-off duration for fixed OD/time cells, bus segment running time, bicycle crossings at actual counters, and local or substitutable transit demand. These components do not yet identify the causal effect on all-person throughput or full journey duration.

## What the ideal experiment needs

Randomize the timing of several already-approved lane conversions, preferably within matched corridor pairs. Record actual opening dates. Fix the evaluation population, network boundary, hours and OD cells before observing outcomes. Measure all modes simultaneously at the treated boundary and parallel routes; count vehicle occupants and onboard bus/train passengers. Recruit the same baseline traveler cohort before and after, including those who switch modes, cancel a journey, or stop traveling. Capture door departure through arrival, including walking, waiting, parking and transfers. Follow comparison corridors over the same dates and account for spillovers.

With observational data, assignment remains nonrandom. The best replacement is a frozen treatment registry and comparison pool, a pre-period holdout for validating matches, an event study with multiple pre/post periods, spillover exclusions, placebo dates and explicit sensitivity to unequal trends. More trips do not create more independent treated corridors.

## New McGuinness motor-count evidence

The old station 021284 / CC0280 lies on McGuinness between Meeker Avenue North and Greenpoint Avenue. That road section is relevant to the 2024 conversion, even though it was an imperfect proxy for the 2016 Pulaski Bridge screenline.

However, the new coverage checks do **not** recover a dense 2024 before/after motor panel:

- The official Region 11 2022 ZIP is downloadable and contains an XLSX, not a CSV. It has 5,055 station-direction-day rows across nine stations. Station 021284 is absent.
- The raw-download web listing ends in 2022. Matching guessed 2023–25 filenames returned HTTP 406. This does not demonstrate that newer underlying agency data do not exist.
- The official 2024–25 AADT geodatabase was downloaded and inspected. Its 2024 row for RCSTA 21284 gives a latest actual observation date of **February 26, 2021**, and no current AADT. There is no exact station row in the 2025 layer. An inventory labeled 2024 is therefore not a 2024 traffic observation.
- The newer public Drakewell viewer lists a same-corridor site named **0280** as a **short-count** site. The point is 40.72364,-73.94768, different from the old inventory coordinate 40.72549,-73.94880. Site continuity must be reviewed.
- The public API reports no quality-approved data types for this site during January 2022 through December 2025. Its latest data timestamp is **March 6, 2026**. Its 2026 summary reports 43,534 vehicles and coverage 0.006. This is evidence of a sparse 2026 count summary, not a year of continuous measurement; it does not establish that all observations occurred in March.
- The calendar export encountered a reCAPTCHA check. Individual 2026 dates and hourly values were **not acquired**.

Sources: [NYSDOT raw archive](https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb), [Traffic Data Viewer](https://www.dot.ny.gov/tdv), [2024–25 AADT geodatabase](https://www.dot.ny.gov/divisions/engineering/technical-services/hds-respository/Tab/GDB_Shapefile_AADT_2024-2025.gdb.zip), [0280 public calendar](https://nysdottrafficdata.drakewell.com/calendar_alt.asp?node=NYSDOT_SC&cosit=028000000000).

The April 2026 DOT evaluation and Community Board appendix are a separate, stronger lead for actual 2021/2023/2025 count sessions, diversion streets and road travel times. Obtain the underlying date-level sessions and count-site coordinates. Graphs of averaged profiles are not an independent observation for every plotted time bin.

## Verified public transit coverage

| Source | Actual test | Credible contribution | Missing for the main outcome |
|---|---|---|---|
| Bus stop ridership, `fvdm-uavx` | B62: January 2024–September 2026; 538,322 rows; 133 distinct stop IDs | Estimated boarding demand by month, weekday, hour, route, direction and stop | Alightings and onboard load at a screenline |
| Bus segment times, `58t6-89vi` and `kufs-yh3x` | B62: every month in 2023–25; January–September 2026 | Running-time changes at fixed timepoint pairs | Passenger weighting, wait, access, transfers and egress |
| Subway OD, `28vm-gjqr` and earlier annual partitions | Live 2026 sample returned origin/destination complex, month, weekday, hour and estimated average ridership | Demand changes for predefined potentially substitutable OD pairs | Observed destination, chosen route, train load and journey duration |

B62 is a **candidate nearby/substitution service**. Temporal coverage has been established; geometry has not established that it travels on the converted McGuinness section. Freeze archived shapes and common timepoint pairs before calling it a direct treatment outcome. The number of reported B62 timepoints changes from 13 in 2023/24 to 15 in 2025 and 12 in 2026.

Nearby station entries cannot simply be added to road crossings: they represent a different location, journey stage and population. Subway OD destinations are inferred from subsequent or prior taps, not measured exits. Bus boardings similarly do not reveal the number of passengers aboard a passing bus.

## Road-time API mapping

| Year | Official EZ Pass dataset |
|---|---|
| 2021 | `s7y8-dkgd` |
| 2022 | `2dzd-mqxq` |
| 2023 | `pi8f-savx` |
| 2024 | `7ank-n7rd` |
| 2025 | `5dxh-vk2s` |
| 2026 | `6a2s-2t65` |

The exact annual titles and schemas were fetched live. Fields include link ID, polyline, length, aggregation interval, sample count, median timestamp, median travel time and median speed. The legacy combined table `erdf-2akx` overlaps these partitions. The portal warns of a May 17–June 30, 2025 gap.

McGuinness-specific queries returned 503 or timed out; coverage at this corridor remains **unverified**, not absent. A small NYC ATR query succeeded but revealed a naming trap: records occur under `NB BRIDGE ENTRANCE ON MCGUINNESS (N/O FREEMAN)`, rather than either simple uppercase road-name spelling. The first returned records were from 2010, segment 145630, Freeman to Eagle. The same name-containing filter with year ≥ 2022 returned no rows. That is absence under this spelling, not proof of no counts under other names or across the corridor geometry. Use geometry and aliases to establish recent coverage.

## Complete journey duration

The parent task acquired a fixed Greenpoint–Long Island City/Hunters Point HVFHV sample for May 1–7, 2023 and 2024. Request, pickup and drop-off timestamps are present. **Request-to-drop-off** is a useful taxi-service outcome: pickup wait plus in-vehicle time. It excludes access/egress and canceled or unmet requests, and it observes only people who still chose a taxi. It cannot stand in for all travelers' door-to-door time.

Citi Bike durations cover the completed bicycle ride; road probes cover selected road segments; bus tables cover timepoint-to-timepoint running time. CMS diaries supply richer journey legs but public waves are predominantly different cross-sections, with coarse geography. The 2024 survey field period ends before the late-2024 McGuinness conversion. A true all-mode complete-journey outcome still needs a same-person panel, a suitable restricted mobility dataset, or new collection.

## Highest-value next acquisition

1. Raw DOT McGuinness evaluation count sessions: exact dates, 15-minute direction/class counts, coordinates, quality flags, diversion streets, bicycle counts and a comparable untreated network.
2. Bus **boardings and alightings/onboard load**, on the same dates and crossing locations. A public boarding estimate alone is insufficient.
3. A simultaneous vehicle occupancy sample or defensible site/time-specific occupancy model with sensitivity ranges. Taxi occupancy is not a private-car occupancy estimate.
4. Stable road probe segments on treated and comparison corridors, plus service-change, construction and weather records.
5. A recruited before/after travel panel with baseline OD exposure and full trip chains; retain switchers and nontravel outcomes.

The priority is not to combine more mismatched datasets into one large total. It is to make the population, boundary, calendar and measurement units agree, then test the counterfactual assumptions.
