# Causal-design adversarial review

Prepared 5 November 2026. This is a design audit, not a new causal estimate. The published before/after results have already been inspected, so a locked analysis protocol must be described as retrospective, not as a preregistration made before observing outcomes.

## Main judgment

McGuinness is a useful candidate, but its phases do not supply a natural randomized experiment. The most defensible immediate study is a narrower, explicitly conditional estimate of the 2024 southern redesign's effects on observed vehicle volume, bicycle activity and segment travel time. The 2026 northern redesign is a separate intervention and a useful replication/mechanism test once its actual completion date and data coverage are verified. Neither currently identifies total all-mode person flow or complete journey time.

Measurement completeness and assignment credibility are separate gates. Perfect all-mode counts do not supply a counterfactual. A credible counterfactual can identify a narrow measured outcome without identifying the unmeasured all-mode total.

## Verified treatment facts and consequences

- NYC DOT's November 2, 2024 advisory says southern work had begun that week, with substantial reconfiguration starting November 4. Consequently, an October/November 2024 average mixes pre-construction and construction conditions.
- DOT's April 2026 presentation dates northern installation to October 2023 and southern installation to late 2024. Its source periods are October/November midweek for travel times and two unspecified fall weeks in 2023 and 2025 for vehicle counts. Neither annual label establishes an untreated period.
- The same presentation documents both northern and southern volume changes and increases on Leonard/Humboldt. Those streets are spillover outcomes, not clean controls.
- The 2026 northern treatment includes a pre-existing bicycle lane, changed protection, loading/parking, pedestrian islands and vehicle turns. Its diagram shows bike width increasing from 5 to 7 feet and the flex lane becoming all-day parking/island space. It is a package, not an isolated new bike lane.
- In a contemporaneous primary record, DOT liaison Ronda Messer described northern operations as two vehicle lanes each way 07:00–19:00 and one overnight. This appears on physical PDF page 140 of the October 11, 2023 CB1 packet, in attached September 21 District Service Cabinet minutes. The day-of-week restriction and actual compliance still need historical signs/as-built records.

## Designs that would otherwise overclaim

| Proposed shortcut | What it really requires or identifies | Decision |
|---|---|---|
| South vs north as treated/control | They are serially connected and already affected by different phases; queues, diversions and trips cross both. | Reject as unaffected comparison; retain as joint outcomes. |
| Before/after × daytime/nighttime × treated/donor | Under parallel changes in the day-minus-night gap, identifies the difference between daytime and nighttime policy effects. | Secondary mechanism check; not daytime effect unless night effect is zero, and not the full-day total. |
| 07:00/19:00 regression discontinuity | Clock-time demand, enforcement, anticipation and queue carryover must not create a changing discontinuity. | Diagnostic only absent an unusually strong documented assignment argument. |
| Political reversal, new administration or business opposition as an instrument | Must affect transport only through the lane policy and be independent of potential travel demand. | No credible exclusion/independence argument presently. |
| Weather-related construction delays as an instrument | Weather must not itself affect cycling, traffic or timing of demand. | Exclusion fails without a very specific design. |
| Excellent synthetic-control fit or insignificant pretrend test | Post-treatment untreated trends must remain comparable; historical fit cannot establish this. | Necessary diagnostics can support the argument, never certify it. |
| Count remaining car riders and their average duration | Policy can change who drives, which trips occur and which requests are completed. | Selected-outcome estimate; not a fixed population's commute effect. |

## Minimum executable analysis

1. **Lock definitions first.** Estimate the 2024 southern package separately from the 2026 northern package. Freeze segment geometry, directions, outcomes, donor eligibility, construction/adaptation windows, missing-data rules and substantive decision thresholds before fitting. Preserve unfavorable weeks under the same rules as favorable ones.
2. **Audit the actual observation panel.** For every counter, list exact dates, hours, direction, location, device changes and missingness. Verify NYSDOT site 021284's geometry and coverage; an annual AADT or a short campaign is not a continuous before/after time series. Require contemporaneous matched observation windows before estimating a count effect.
3. **Build the network outcome boundary before matching.** Include likely diversion streets as outcomes. Choose donors outside that plausible influence area with comparable pre-policy trends, commute mix and exposure to citywide changes. Check larger boundaries. North and south must not be each other's sole control.
4. **Fit controlled event studies or a prespecified synthetic comparator.** Use same-calendar comparisons, weather and documented concurrent external disruptions; reserve a pre-period block for forecasting validation. Show event-time coefficients, donor influence, leave-one-donor-out and placebo timing/location checks. Do not control away treatment-mediated changes in traffic, route or mode choice.
5. **Respect the experimental unit.** One treated corridor does not become thousands of independent treated units because there are many days, hours or taxi records. Use uncertainty methods appropriate for time dependence and a small number of corridors; label permutation inference conditional on donor exchangeability. Report effect sizes and sensitivity ranges, not merely a nominal p-value.
6. **Stress the identifying assumption.** Quantify how much differential untreated trend or donor contamination would change the decision. Non-rejection of pretrends is not proof. Report a range under substantively justified departures from parallel trends; do not choose those departures after finding the desired conclusion.
7. **Keep claims at the measurement level.** Vehicle counts, bicycle crossings, Citi Bike endpoint activity and FHV duration must remain separate unless a documented aggregation establishes a common people/time/boundary estimand. A conditional mode-specific estimate is useful even when the all-mode answer remains unidentified.

## Pass/fail rules for each published claim

These are evidence gates, not guarantees that untestable assumptions are true.

| Gate | Pass requirement | Failure means |
|---|---|---|
| Treatment fidelity | Operational date, geometry and time-of-week regime documented; construction isolated; major co-treatments listed. | Descriptive calendar comparison only. |
| Observable support | Comparable treated and donor observations before and after; meaningful seasonal coverage; no policy-correlated measurement change. | No defensible event-study estimate from these observations. |
| Counterfactual plausibility | Donors outside main spillovers; assignment/timing explanation; stable pre-policy relationships and held-out predictions; concurrent shocks assessed. | Association, with explicit unresolved confounding. |
| Robustness | Result's direction and policy-relevant magnitude survive prespecified donor, window, boundary and trend-sensitivity checks. | Report instability/ambiguity rather than a success or failure verdict. |
| All-mode person flow | Same screenline and intervals for all modes, vehicle occupancy and transit passenger loads, or credible bounds on every omitted component that preserve the sign. | Cannot label a sum as total person flow. |
| Journey time | Fixed baseline population or OD/purpose/departure weights; access, waiting, transfers and egress; canceled/foregone travel addressed. | Report selected in-service segment/trip times only. |
| Capacity | Arrivals, discharges and queue/backlog evidence under comparable demand. | Report realized throughput, not maximum capacity. |
| Generalization | Multiple eligible corridor networks or a defensible transportability argument. | Conclusion applies to this package, place, period and exposure only. |

## Particular measurement traps

A screenline must cross parallel alternatives once. Adding counts from serial links double-counts trips; adding nearby subway station entries does not measure subway passengers crossing the same screenline. Occupancy should vary by mode/time where possible and uncertainty must propagate into person counts. Missing-mode bounds must be evidence-based, not a slider whose default happens to produce the desired answer.

For TLC, pre-policy OD × departure-time weighting improves comparability, and request-to-dropoff includes observed waiting. However, completed FHV trips exclude canceled/unmatched requests and walking access; taxi zones do not establish the route taken. It is a useful mode-specific outcome, not a population commute panel. Do not restrict to post-policy observed routes if rerouting is part of the treatment effect.

Total transport minutes can decrease because journeys are abandoned, while a lower mean travel time can arise because slow travelers disappear from the sample. Pair minutes per baseline resident/day with completed and foregone journeys and fixed-OD journey time. Increased subway use is compatible with a beneficial policy effect; aggregate data do not have to link each individual mode switch to estimate a total effect under credible assignment. A specific claim that people moved from cars to subway needs additional evidence.

## Primary sources

- NYC DOT, southern construction advisory, November 2, 2024: https://www.nyc.gov/html/dot/html/pr2024/travel-advisory-mcguinness-boulevard.shtml
- NYC DOT, April 14, 2026 presentation, especially pages 4, 7–12, 19, 21–22: https://www.nyc.gov/html/dot/downloads/pdf/mcguinness-blvd-calyer-st-freeman-st-apr2026.pdf
- Brooklyn CB1 October 11, 2023 packet; attached September 21 District Service Cabinet minutes, physical PDF page 140: https://www.nyc.gov/assets/brooklyncb1/downloads/pdf/meeting-minutes/Combined-Public-Hearing-and-Board-Meeting-Minutes-10-11-2023.pdf
- NYC DOT September 10, 2024 presentation, page 3; useful corroboration of the proposed 07:00–19:00 flex regime, not proof that the later southern design followed it: https://www.nyc.gov/html/dot/downloads/pdf/mcguinness-blvd-update-sept2024.pdf
- NYC Mayor's Office, northern construction starts May 27, 2026, expected early-fall completion; expectation is not verified completion: https://www.nyc.gov/mayors-office/news/2026/05/mayor-mamdani-announces-start-of-construction-to-complete-mcguin
- Roth (2022), Pretest with Caution: https://pubs.aeaweb.org/doi/10.1257/aeri.20210236
- Rambachan and Roth (2023), A More Credible Approach to Parallel Trends: https://academic.oup.com/restud/article-abstract/90/5/2555/7039335
