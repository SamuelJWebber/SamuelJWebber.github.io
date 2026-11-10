# Europe expansion: Berlin and Paris

The European expansion adds one strong motor-outcome replication candidate (Berlin), one unusually useful simultaneous multimodal measurement source (Paris), and a pre-COVID treatment alternative (Boulevard Voltaire). It does not yet identify the effect on total person flow or complete journey time.

## What is acquired, rather than merely identified

| Case | Verified treatment | Data actually acquired | Current admissible conclusion |
|---|---|---|---|
| Berlin 2020 popup lanes | Existing motor travel lanes reallocated to cycling; street-specific staggered dates | Four official monthly cross-section files (February and July, 2019 and 2020), official lane detector metadata, provider dictionary, source evaluation | Good candidate to reproduce motor speed/flow effects; no new causal estimate calculated |
| Paris, Rivoli May 2020 | Carriageway reallocation plus ordinary motor-through-traffic restriction | Official full metadata, geometry and camera documentation, earliest/latest date query, one week of all class/trajectory records | Can measure aligned vehicle classes; this camera starts after treatment and fails the before-period requirement |
| Paris, Voltaire 2017–2019 | Motor carriageway reduction with protected cycle tracks, bus-stop and streetscape changes | Official project and schedule reviewed; no aligned raw before/after panel acquired | Pre-COVID alternative, pending geometry and older counter joins |

## Berlin audit and interpretation

Schrauth (2022), CEPA Discussion Paper 48, studies true motor-lane conversions. The main panel has 23 treated stations on six streets and 192 controls. The adjusted reported motor-speed coefficient is −4.123 km/h; the log-speed coefficient is −0.122 (about −11.5% after exponentiation). Adjusted log volume is −0.00540 and statistically inconclusive. These are published estimates, **not our replication**. Speed and volume were averaged across detector lanes. Point speed is not door-to-door journey time. COVID, political selection, staggered timing, diversion and measurement changes require renewed scrutiny. The synthetic-control exercise concerns accidents; it is not the speed estimator.

Primary paper: https://www.uni-potsdam.de/fileadmin/projects/lsfiwi/docs/Publikationen/Philipp_Cycling.pdf

The official archive is publicly downloadable without an account and covers 2015–2025. The provider explicitly warns that historical data were revised in 2025. We used one quality regime, `alte_qualitaetssicherung/Messquerschnitte`, throughout the bounded audit. The source dictionary distinguishes per-lane detectors from direction-specific road cross-sections; cross-section hours are only emitted when all required constituent lane readings are valid.

The downloaded metadata (sheet `Stammdaten_TEU_20220720`) identifies position, direction, lane, coordinates, installation/removal fields and comments. Eleven of our 19 road-name candidate cross-sections have a detector marked `DEINSTALLIERT=X`, `KOMMENTAR=Radspur`. Removal dates are blank. This is evidence that detector coverage needs explicit reconstruction; it does **not** demonstrate that the published estimates are biased. The 2025-reprocessed archive still contains near-complete July 2020 cross-section records at most flagged sites.

Our street-name screen yields 19 candidate directional cross-sections; 18 have observations in all four sampled months, while TE532 has none. This is a coverage test, **not treatment assignment**: candidates include untreated sections, Neue Kantstraße, and Gitschiner Straße's separately monitored bus lane. `berlin-mq-coverage-audit.csv` retains availability and descriptive means, not an estimated intervention effect. Never turn these crude means into a COVID-period before/after causal claim.

Official archive: https://api.viz.berlin.de/daten/verkehrsdetektion

Direct public archive root: https://mdhopendata.blob.core.windows.net/verkehrsdetektion/

The next admissible analysis reconstructs a stable full-width cut for each exact treated segment; separates motor, bicycle and bus counts; documents detector retirement; obtains at least a full pre-year and post-year; matches eligible roads with comparable pretrends; and estimates treated-road plus diversion-screenline outcomes. Modern staggered-treatment event studies, placebo dates, differential COVID recovery tests and missingness sensitivity are essential. Vehicle occupancy and passenger loads remain missing, so person flow must remain unresolved or explicitly bounded by assumptions.

## Paris: useful multimodal data, decisive baseline limitation

The official thermal-camera dataset supplies hourly counts by bicycle, scooter, powered two-wheeler, light vehicle, heavy vehicle and bus/coach, with direction and entry-to-exit trajectory. Its field `nb_usagers` means **vehicles**, not occupants. Sensor classes can change over time. The attached November 2021 documentation, printed page 5, explains the Rivoli/Nicolas Flamel camera's trajectory mapping. These are camera detection zones, not trip origins and destinations.

Our site10004 query finds its first observation at **2020-05-22 22:00 UTC**, after the **11 May 2020** policy change. This feed cannot identify that treatment's before/after effect by itself. Rivoli also bundles bicycle reallocation with motor-access restrictions, so it is not interchangeable with a simple one-lane conversion elsewhere.

The downloaded interval is **6 September 2021 00:00 UTC to 13 September 2021 00:00 UTC**, not a local-midnight Paris week. It contains 2,912 records, 168 distinct hours and zero duplicate `(site, trajectory, timestamp, mode)` keys. Recorded passage sums are 105,585 bicycles; 17,523 scooters; 4,503 powered two-wheelers; 35,475 light vehicles; 1,592 heavy vehicles; and 1,789 buses/coaches. They are descriptive sensor sums, **not unique people**, not a before/after comparison, and not evidence that this many journeys were newly created. Category-hour coverage varies; absent rows cannot automatically be declared observed zeros. Do not sum serial cameras as if they were independent travelers.

Official data: https://opendata.paris.fr/explore/dataset/comptage-multimodal-comptages/

Documentation: https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/comptage-multimodal-comptages/attachments/documentation_v3_1_pdf

Geometry: https://opendata.paris.fr/explore/dataset/comptage-multimodal-sites-et-trajectoires-de-comptage/

Treatment: https://www.paris.fr/pages/la-rue-de-rivoli-reservee-aux-pietons-et-aux-velos-7792

Primary court description of May2020 policy: https://www.legifrance.gouv.fr/ceta/id/CETATEXT000047318155

Voltaire is worth a separate acquisition pass because construction ran July 2017–July 2019, before COVID. The city says the completed road has one moving lane per direction, retaining two lanes near Léon Blum and République. Exact pre-existing lane counts and staged opening dates still need segment-level verification. The April 2017 presentation's 20% motor-capacity reduction is a **forecast**, not an observed traffic effect; bus-island benefits are likewise not measured outcomes in that document.

Official Voltaire project: https://mairie11.paris.fr/pages/l-amenagement-cyclable-du-boulevard-voltaire-9957

2017 design presentation (geometry and forecasts, PDF pages 4, 8, 12, 22): https://cdn.paris.fr/paris/2020/09/15/89f9315e78619441d6678ea8d007905b.pdf

## Reproducibility and dashboard treatment

`reproduce.py` reacquires cached official files, reruns the coverage checks and exports the bounded sensor subsets. `source-download-manifest.json` maps raw names to exact source URLs and hashes. `candidates.json` is the case registry; `comparisons.json` holds the clearly labeled acquisition results. `manifest.json` hashes the overall artifact bundle. No API keys or authentication were used.

Recommended dashboard status: Berlin **published causal motor-speed evidence / replication pending**; Rivoli **aligned multimodal counts / baseline fails**; Voltaire **treatment verified / data join pending**. Keep causal findings, descriptive counts and acquisition candidates visually distinct. None currently establishes all-mode person throughput or average complete journey time.
