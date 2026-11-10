NYC STREET FLOW — INTERNATIONAL EVIDENCE EXPANSION
Samuel Webber | Evidence checked November 5, 2026
Dashboard: https://nyc-street-flow.smartgoldfish.chatgpt.site/?workbench=world

SCOPE AND RESULT
19 screened cases in 13 cities, plus a seven-paper methods registry. This is a
curated primary-source search, not an exhaustive systematic review and not 19
independent eligible causal studies. Some records are treatment exclusions or
acquisition candidates. Fifteen comparisons preserve source units and windows.
No new causal coefficient for all-mode person flow or complete journey time
has been identified. Published model results are labelled as reported, not replicated.

WHAT WAS ACTUALLY ACQUIRED
Vancouver: full 579-date City Burrard 2009–2010 export, directional bicycle,
pedestrian and vehicle fields, missingness/rounding audit, explicit retained and
excluded matched dates, and three comparison windows.
Toronto: original official Bloor report and metric table checked; tidy count and
driving-time transcriptions. Published corridor means, not original site-day video.
Berlin: four official hourly motor-count/speed monthly archives (February and
July 2019/2020), detector metadata, bounded road-name sample and coverage audit.
Paris: official thermal-camera schema, site geometry and 2,912 Rivoli records
covering one 168-hour post-treatment week. No pretreatment baseline in this feed.
London: 1,368 hourly raw count records and annual estimation-quality metadata;
Blackfriars peak person-flow table. The referenced +5% calculation attachment
was unavailable, so that claim was not independently reproduced.
Manchester: original TfGM final evaluation acquired; 82 tables extracted, ten
selected table CSVs, bus times and parallel-road comparisons recalculated.
Cambridge: official evaluation and baseline count reports checked; 32 road-time,
six bus-link and six bike-count comparisons transcribed.
Copenhagen: original COWI trial evaluation checked, 12 bus and eight cycle-time
rows extracted; one arithmetic inconsistency flagged against the source image.

KEY DESCRIPTIVE RESULTS
Toronto: Bloor cycling +48.84%, while the sum of Bloor/Dupont/Harbord corridor
means rose 4.17%. This sum is an INDEX, not a common screenline or unique trips.
The pattern is consistent with rerouting; it cannot identify the share newly cycling.
Bloor peak-direction driving took 120 seconds longer AM and 255 longer PM.
Vancouver: six matched pairs give bicycles +48.85%, walking +12.09%, vehicles
-0.02%. Immediate four-weekday comparison gives bikes +108.58%, vehicles -5.50%.
This sensitivity and the tiny pre-period prevent a causal interpretation.
Cambridge: May 2019/2022 motor all-day NB 5.7→5.0 minutes, SB 4.9→4.7; PM
8.0→8.2 and 5.2→5.4. Near-opening results differ. Bus running times improved
under a combined bus+bike redesign; no bike-only attribution.
Manchester: MRI-to-city local buses +16.2% AM and +15.2% PM; reverse direction
roughly flat. Estimated through-trip benefits remove an assumed transfer penalty.
Berlin: June 2022 working-paper specification reports -4.123 km/h motor speed;
lane-average volume effect statistically inconclusive. Neither is total person flow.
London: post-opening northbound peak 1,938 cyclists/hour versus 1,542 main-
carriageway people/hour. A post-only snapshot, not a causal before/after result.
Adverse historical cases and excluded geometry remain visible to avoid selecting
only favorable results. COVID-era studies are not pooled with pre-COVID trials.

WHAT TO DO NEXT — A SPECIFIC ACQUISITION QUEUE
1. Vancouver City/TransLink: Ontario comparison bike counts and original fitted
   counterfactual, earlier counts, vehicle class/occupancy, bus onboard loads and
   running-time records, Granville/Cambie/other False Creek crossings. Join by
   calendar date, direction and hour. Include weather, events and construction.
2. Toronto Transportation: original dated/directional videos/counts at all 11
   sites and GPS runs for every wave, exact signal changes, independent untreated
   comparison corridors, bus/rail crossing loads and occupancy. Build one actual
   boundary before summing; Dupont/Harbord belong in spillover outcomes.
3. Berlin: download a continuous pre/post hourly panel, certify as-built segments
   and opening dates, reconstruct whole-direction cross-sections from detector
   metadata, and explain post-conversion sensor retirement/reprocessing. Only then
   run staggered-adoption models with pre-trends, placebo dates and donor buffers.
   Add co-located all-bike counts and passenger loads for a person-flow outcome.
4. Cambridge/MBTA and Manchester/TfGM: underlying link-day AVL/APC observations,
   onboard passenger loads, road counts and several independent comparison roads.
   Estimate package effects separately from bike-only effects. Separate temporary
   adjustment, mature operation and pandemic demand changes.
5. London/TfL: recover FOI-1339-2021 before/after methods and bus-occupancy tables;
   fresh cycle-inclusive counts at audited alignments, ANPR runs and control roads.
   Do not fit event studies to years extrapolated from the same historic survey.
6. Paris: recover older loop/manual counts matching Rivoli geometry or use the
   camera prospectively for a later intervention. Its first record on May 22, 2020
   follows the May 11 intervention. Absence of a record is not observed zero.

No agency messages or account registrations were made for this expansion.

REPRODUCTION AND AUDIT
Raw/derived files and local scripts are organized by region. Original large reports
remain at their cited primary URLs; source manifests record local acquisition hashes.
The dashboard global.json preserves the rendered case and comparison data.
Run `python verify.py` from this directory for offline arithmetic, pair-selection,
source-row consistency, eligibility labels and download checks.
Run `python canada/reproduce.py` to recreate Canada tables from preserved raw data
and explicit transcriptions. Run `python uk/assemble.py` for UK arithmetic and
`python other/build_evidence.py` for Cambridge transcriptions. These transcription
scripts are not automated parsers of the PDFs.
Run `python europe/reproduce.py` for acquisition/coverage checks; requires pandas,
openpyxl and network access if a cached input is missing. No causal model is fitted.
Run `python methods/reproduce_access_audit.py` to verify the acquired Zenodo archive.
It contains a 134-byte Git-LFS pointer instead of its advertised 330 MB panel;
archived 2020 output must not be substituted for the final 2021 paper's estimate.
Copenhagen extract.py requires the linked original PDF to recompute its SHA256;
the source transcriptions and audit are preserved for offline inspection.

QUALITY RULES
No conversion of motor vehicles to people without explicit occupancy evidence.
No addition of serial counters or bus boardings as unique journeys.
No summing of camera categories over unobserved category-hours as if zeros.
No conversion of point speed into door-to-door journey time.
No pooling of site studies and multi-city papers that reuse the same intervention.
Report mean time, total minutes and completed trips/access together: fewer completed
trips can mechanically lower minutes while making transport worse.
See methods/transportability-protocol.txt for the proposed estimands, exclusion
rules, identification tests, partial-identification bounds and NYC reweighting.

ATTRIBUTION
Berlin traffic archive: Digitale Plattform Stadtverkehr Berlin / Verkehrsdetektion
Berlin. Further attribution and source URLs are in each regional manifest and memo.
Vancouver: City of Vancouver Open Data. Paris: Ville de Paris Open Data.
Toronto, Cambridge, TfGM, TfL and Copenhagen/COWI retain source-report attribution.

ACQUISITION UPDATE — NOVEMBER 6, 2026
Eight new city download packages and a 36-entry acquisition ledger are linked
from the Other cities tab. See research/acquisition/README.txt (relative to dist)
for exact coverage, withheld Cambridge comparisons, source errors and remaining
gaps. The city ZIPs are separate downloads and are not embedded in this bundle.
The earlier acquisition priorities describe the November 5 state; the new ledger
supersedes those availability statements. No new causal all-mode result is claimed.
