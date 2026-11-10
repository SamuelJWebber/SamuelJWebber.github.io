NYC STREET FLOW — NETWORK AND PERSON-TIME WORKBENCH
Author: Samuel Webber | Updated November 6, 2026
Public dashboard: https://nyc-street-flow.smartgoldfish.chatgpt.site/

WHAT THIS RELEASE ADDS
1. Five project scorecards separating person throughput, comparable complete
   journey time and total person-minutes. Measured, modeled and missing are explicit.
2. Three geographic study-area schematics with counter locations, project extents,
   comparators, rerouting context and official coordinates where available.
3. A fixed-cohort travel-time calculator with all 20 switches between bike, car,
   bus, subway and walk. Inputs are hypothetical. It never estimates throughput.
4. Directional and hourly McGuinness observations on exactly shared dates/cells.
5. Control/date/window sensitivity, PPW sample distributions, and missing-person
   reversal thresholds. Scenario ranges are not confidence intervals.
6. A concrete measurement contract/prospective protocol and corrected request status.

NEW DESCRIPTIVE FINDINGS
On identical retained dates, McGuinness southbound motor traffic changed -6.4%
all day and -5.9% during 16:00–19:00; northbound changed -7.1% and -15.4%.
The detector is not the Pulaski Bridge boundary. The removed bridge lane was
southbound; the directional pattern is not a causal test by itself.

PPW full-day weekday survey median: 173 to 158 seconds; 90th percentile:
210.8 to 208.3 seconds. Only two days before and two after. These are descriptive
segment traversals, not typical complete journeys or a long-run reliability result.

CAUSAL STATUS
Unresolved. No defensible signed estimate of all-mode person flow or complete
journey time attributable to the conversions. More observations and passing
arithmetic tests do not create a credible counterfactual or aligned passenger counts.

TIMING CORRECTION
The original January–August 2015 Pulaski diagnostic cannot be assumed untreated.
DOT planned an April 2015 start and documented construction by September 2015.
Exact temporary/permanent lane-closure dates remain unverified. The directional
view includes an earlier January–February check, with only 5 of 10 cells.
DOT also documented an existing three-to-two-lane downstream merge; lane removal
alone does not establish lost network bottleneck capacity.

REPRODUCIBILITY
The workbench-reproduction.zip preserves source modules, tests, derived records
and reproduction scripts. Individual source archives are in the directional and
estimate-lab reproduction ZIPs. Run the scripts in dist/research/validation, the calculator test in tests,
and each panel’s reproducibility script with Python (pandas, numpy) and Node.
Modules use no package build.
The release bundle includes the core modules needed for its tests, not the full
historical dashboard. Existing historical source bundles remain separate.

Independent data audit: 1,008 directional/hourly estimates, 64 daily + 32 pooled
PPW distribution groups. Independent calculator audit: all 20 switch types,
500 weighted cohorts, conservation, valid time bounds and reversal thresholds.
See validation/adversarial-review.txt and the machine-readable audit reports.

REQUEST STATUS (checked November 9, 2026; research/request-status.json is current)
NYSDOT acknowledged request C on November 5 as R013587-110526; it will say by about
December 7 whether records exist. NYC DOT did not accept A1 by email (it takes requests
only through NYC OpenRecords), so no A1 request exists yet. MTA B1 is prepared, not
submitted. Follow-ups are unsent drafts. No fees authorized.

CAUSAL DESIGN ADDITION — NOVEMBER 6, 2026
A sixth tab specifies the randomized rollout we would want, then maps public
measurements and assignment gaps: 20 sources, 10 candidate projects, 9 trial
requirements and 8 claim gates. See research/causal-design/protocol.txt.
Actual new checks include 11,904 pre-treatment ride-hail bookings (11,892 valid
timing rows), B62 monthly coverage, a stale NYSDOT inventory/gap diagnosis,
and an audit of DOT's 2026 McGuinness evaluation and its omitted appendix.
No new causal effect is claimed. New acquisition specifications are unsent.
The design bundle includes raw public sample rows, query URLs, hashes and an
offline verification script. The whole-workbench bundle includes this module.

INTERNATIONAL EXPANSION — NOVEMBER 5, 2026
The Other cities tab adds 19 screened cases in 13 cities, 15 observation comparisons
and seven method papers. Download research/global-study/reproduction.zip for raw
samples, extracted tables, source audits and the transportability protocol. The pool
retains adverse results and explicit treatment exclusions. No new all-mode causal
coefficient is asserted. See global-study/README.txt for exact acquisition priorities.

ACQUISITION UPDATE — NOVEMBER 6, 2026
Eight new city download packages and a 36-entry acquisition ledger are linked
from the Other cities tab. See research/acquisition/README.txt (relative to dist)
for exact coverage, withheld Cambridge comparisons, source errors and remaining
gaps. The city ZIPs are separate downloads and are not embedded in this bundle.
The earlier acquisition priorities describe the November 5 state; the new ledger
supersedes those availability statements. No new causal all-mode result is claimed.
