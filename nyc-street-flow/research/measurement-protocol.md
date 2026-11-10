# NYC lane-conversion measurement protocol

Prepared November 5, 2026 for NYC Street Flow, by Samuel Webber. This is a proposed collection and analysis plan, with blank templates. No new field survey or traveler panel has been conducted. Existing historical analyses remain observational.

## Two primary outcomes

1. **Realized person flow:** people crossing a fixed geographic boundary per elapsed hour, separately by direction and mode, and combined across all mutually exclusive crossings of that boundary. A higher observed count measures use, not maximum capacity. It does not alone identify newly created journeys.
2. **Comparable journey time:** door-to-door minutes for a stable population and origin–destination–departure-time–purpose mix, across all modes. Include walking, waiting, transfers, parking and docking. Allow mode shares to change after the project; holding mode shares fixed would remove a pathway through which the project could work.

Report the average, median and 95th percentile, and the change in average minutes multiplied by a fixed baseline number of comparable trips. Keep actual total person-minutes, new/suppressed trips and trip completion rates as separate outcomes. More newly enabled trips can raise total travel minutes even while access improves. A canceled journey is not a zero-minute successful journey.

## Define eligibility before looking at the results

Include only projects with source-verified removal of at least one moving motor-traffic lane during the evaluated hours. Record lane direction, hours of operation and geometry before and after. Parking removal alone does not qualify. Keep construction, opening and stabilization dates distinct. Archive plans, installation records and signal changes in `project-registry.csv`.

Estimate the effect of the **whole street redesign** when signals, bus lanes, turn rules or transit service changed simultaneously. Claim a bike-lane-only effect only if the data independently separate those components.

## Count at a shared boundary

Register every crossing in `boundary-registry.csv` before analysis. A street corridor analysis should use a transverse line crossing the treated street and plausible parallel routes. A river analysis should include the relevant bridges, road tunnels, rail tunnels and ferry routes, with any excluded alternatives stated. Measure the same time windows in every mode. Use a separate wider boundary to assess leakage or diversion beyond the local corridor.

Sum parallel alternatives, never serial count points along one trip. A person biking to a subway and then crossing the river by train contributes once at the river boundary. Bicycle approaches, station entries and train loads cannot all be added as independent crossing travelers. Report directional crossings; repeated trips are additional crossings, not additional unique people.

Use 15-minute intervals stored with explicit UTC offsets and an America/New_York calendar. Handle daylight-saving days using actual elapsed seconds. Initially report weekdays 7–10 a.m. and 4–7 p.m., plus full-day results where coverage permits; do not select favorable hours after examining outcomes.

## Measure people in each mode

- **Motor traffic:** count vehicle classes separately. Multiply each class count by a locally sampled, period-specific occupancy including the driver. Keep taxi/for-hire vehicles, private cars, trucks, buses and other vehicles distinct. Never apply a private-car factor to buses. Record unknown occupancy and sampling probability, not only occupants visible through clear windows.
- **Bus, subway and ferry:** obtain passengers on board at the actual boundary, by run/train/sailing and direction. State whether operator/crew are included consistently across periods. Station entries do not identify destination, crossing, route or load. Subway origin–destination estimates require documented route assignment, transfer handling and boundary crossing times, with uncertainty and alternative-route sensitivity. Scheduled capacity is not ridership.
- **Walking and cycling:** count people crossing, with separate bicycle/e-bike/moped classifications. If the source counts vehicles rather than people, document passengers or the one-person assumption. Keep unauthorized or parallel cycling paths in scope when they cross the same boundary.
- **Citi Bike coverage:** simultaneously classify Citi Bike classic, Citi Bike electric, other bicycles and unclassified bicycles at the same place and time. Estimate the share separately before/after and by relevant season/time/direction. The local share is classified Citi Bikes divided by all bicycles; propagate uncertainty from unclassified observations and repeated survey days. Dock pickups/drop-offs cannot establish a crossing or validate a route. Prefer direct all-bike counts when available.

## Timing and field collection

Target at least 12 complete months before construction and 12 after stabilization, preferably 24–36 before for trend assessment. A 12-month span does not guarantee identification or adequate power. Preserve construction and adjustment months as labeled periods, not clean before/after observations.

Use continuous counters where possible. For occupancy, bicycle classification and independent counter validation, start with a stratified pilot covering weekday/weekend, morning/midday/evening, weather, seasons and directions, with simultaneous observations on treated, comparison and diversion routes. Randomize sampling dates within prespecified strata; retain rainy and cold days. Pilot variability and missingness determine the final number of observation days.

Join temperature, precipitation, snow, wind, daylight, holidays, school schedules, road works, major events, transit disruptions and other policy changes. Use common dates and hours. Compare raw and adjusted estimates and report exactly which covariates were obtained. Do not label an estimate weather-adjusted unless weather was actually used.

## Counter and completeness checks

`counter-validation.csv` identifies physical and comprehensive sensors, component channels and replacement dates. Never sum a comprehensive series with its component counters. Confirm direction/channel definitions, units, interval length and timestamp basis. Assess duplicates and impossible values; preserve raw, modified and imputed status.

When a sensor moves or changes technology, overlap old/new devices where possible and compare both with independent manual observations, including congestion and bad weather. If no overlap exists, show a discontinuity sensitivity or exclude that break from causal interpretation. A location change can change which users are counted.

A zero is a completed observation with no travelers. A missing record is unknown. Publish valid/expected interval coverage by month and mode. Primary paired comparisons use jointly observed intervals; show how their time and weather mix differs from the full population. Do not silently scale a partial day into a full day or substitute a different survey month for another mode.

## Credible untreated comparisons

Choose candidate controls using pre-project outcomes, road geometry, transit access, land use, population, employment and existing cycling network. Check for their own interventions. Nearby alternatives that can absorb diverted traffic are spillover outcomes, not automatically untreated controls. Preserve the full candidate list, exclusions and matching choices.

Plot monthly event-time coefficients and pre-period differences. Use difference-in-differences with cohort-specific treatment timing when multiple projects open at different dates; use only genuinely untreated or not-yet-treated comparisons appropriate to each period. Do not use a later-treated corridor as a clean control after its own construction starts. With one treated corridor, a synthetic comparison and placebo locations/dates can be informative, but a small number of projects limits causal certainty.

Check balance, pre-trends, fake opening dates, alternative clean windows, sensor definitions, leave-one-control/project-out estimates and spillover boundaries. A nonsignificant pre-trend test does not prove parallel trends. Adjacent bridge growth differences are descriptive when diversion or pre-trend violations are material.

## Journey panel and mode switching

Recruit travelers by eligible origins and destinations before construction, including car, bus, rail, walking and bicycle users. Follow the same anonymous participants across seasons after opening, asking for repeated comparable trips. Use a travel diary or consented route trace to establish departure/arrival and route; retain purpose, trip cancellations, access/egress, parking and waiting. Report nonresponse and attrition by baseline mode and neighborhood, and compare a refreshed sample to the continuing cohort.

Keep the baseline origin–destination–departure–purpose weights fixed while allowing each group's post-project mode mixture to change. Estimate car→subway and other transitions descriptively and include those travelers in the all-mode time average. Baseline-mode subgroups can reveal who gains or loses. Restricting analysis to people who remain cyclists cannot estimate the all-traveler effect. Citi Bike unlock-to-dock duration is a separate, partial journey outcome.

For the existing dock analysis, match stable station pairs, direction, departure periods, membership and bike type; validate routing where possible. Publish sample inclusion rates, mean/median/tails and sensitivity to long rentals and station moves. Keep genuine long journeys; distinguish data errors or recreational stops from measured commute time using prespecified rules.

## Uncertainty and decision rules

Prespecify a meaningful effect size in people/hour and minutes/journey. Use pilot data to simulate power with seasonal variation, serial correlation, occupancy uncertainty, survey weights and the actual number of independent corridors. Thousands of trips do not create thousands of independent treatment assignments. Cluster at treatment-assignment level; with few corridors, report appropriate small-cluster/randomization/placebo inference and its limitations. Block resampling days or weeks can quantify sampling variation within a corridor but cannot establish causal identification.

Propagate uncertainty in occupancy, inferred transit routes and sampled bicycle shares. Show missing-mode bounds where defensible, rather than assigning zero. State separately whether data support (a) a descriptive change, (b) an adjusted association, or (c) a causal interpretation under stated assumptions. If missing modes or untreated controls prevent identification, retain 'not estimated'.

Publish the frozen protocol, inclusion log, raw source queries, cleaned aggregates, validation results and analysis code. Release only aggregate journey-panel outputs; participant identifiers, exact routes and home/work locations are not required in the public dashboard.

## Template rules

The CSV files contain headers only and no observations. Dates are ISO 8601; interval timestamps include offsets. Missing numeric values are blank, never zero. Use stable IDs to join files. `direct_person_count` is used when people are directly counted; otherwise `vehicle_count` requires an `occupancy_sample_id`. Do not add direct and occupancy-derived counts for the same channel. `observed_seconds` must not exceed `expected_seconds`; retain partial intervals and reasons in notes. The `screenline-counts.csv` long format has one row per crossing, direction/channel, interval and mode/class.

For occupancy samples, the occupancy estimate is total observed occupants divided by vehicles with known occupancy, using sample weights if probabilities differ; assess bias from unknown occupancy rather than assuming it is random. For local shares, classic + electric + other + unclassified must equal all bicycles. Treat unclassified bicycles as unknown membership, with explicit bounds. Journey duration components should sum to the door-to-door duration without overlap. A mode chain records the complete trip; component legs are not separate full journeys.

## Related studies

The accompanying `similar-studies.json` contains primary links, findings and limitations for Toronto's 2017 Bloor pilot, Bhuyan and colleagues' 2021 London congestion analysis, and Moran, Salman and Yabe's 2026 NYC bikeshare analysis. Their methods inform this plan; none substitutes for missing NYC all-mode measurements.
