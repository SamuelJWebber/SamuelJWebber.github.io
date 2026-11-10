# Other-city lane conversions: evidence handoff

The most immediately reconstructable case is **Cambridge, Massachusetts, North Mass Ave (2021)**. It offers a verified moving-lane reduction, an explicit comparison corridor, road and bus travel times, bike counts, and a public table appendix. It evaluates a **bike + bus + signal package**. It does not identify a bike-only effect or total person throughput.

The strongest adverse result discovered is **Bogotá (2020 lanes; 2024 paper)**: a spatial-model analysis reports maximum motor-speed reductions of 4.5 km/h (19%) on treated roads. Some parallel roads improved. This is valuable against cherry-picking but cannot establish a total-person or complete-journey result.

The six records in candidates.json are five verified lane-reallocation cases and one explicitly ineligible/unverified geometry case. This is a curated pool, not a globally exhaustive inventory.

## Reproduced Cambridge comparisons

All below are published rounded means, with our arithmetic. They are observations, not causal effects. Source: Toole Design technical memo dated Nov17,2022, Tables6/8 on PDF p9. Motor-time link spans Somerville Ave to Alewife Brook Parkway, longer than the treated0.4mile section.

| Corridor / direction | Period | 2019 minutes | 2022 minutes | Computed change |
|---|---|---:|---:|---:|
| Mass Ave northbound | full day | 5.7 | 5.0 | −0.7 |
| Mass Ave southbound | full day | 4.9 | 4.7 | −0.2 |
| Broadway eastbound, comparison | full day | 3.1 | 3.2 | +0.1 |
| Broadway westbound, comparison | full day | 3.3 | 3.1 | −0.2 |
| Mass Ave northbound | PM16:00–18:00 | 8.0 | 8.2 | +0.2 |
| Mass Ave southbound | PM16:00–18:00 | 5.2 | 5.4 | +0.2 |
| Broadway eastbound, comparison | PM16:00–18:00 | 3.5 | 3.9 | +0.4 |
| Broadway westbound, comparison | PM16:00–18:00 | 3.8 | 3.9 | +0.1 |

2019 observations are Tuesdays–Thursdays Apr30–May9;2022 May3–12. A separate near-opening window (Nov2–4 vsDec14–16,2021) is included in the32-row CSV. Do not pool those windows as independent projects.

Bus tables12/13 (pp14–15) are reproduced separately. For example Cameron→Churchill summary average falls111→35seconds. The report uses time-of-day median runtime series; these are not whole-journey minutes. Published all-day bus-direction summaries are−23%inbound and−40%outbound; **−31%inbound is the AM peak, not full day**. The outgoing all-day average in table11 is not the simple average of its three displayed percentage changes, so do not recompute a network average from it. No confidence interval is furnished by this transcription.

Bike counts on Mass Ave AMpeak243→267,PM216→241; these are bicycles in the peak hour, all bicycles, not bikeshare only. Nearby counts are also preserved. CedarAM5→2 is printed as−2% on city page: arithmetic is−60%; retained source percentage plus quality flag. Do not sum these sites without checking whether they form a nonduplicating screenline.

## Eligibility and limits

- **Cambridge:** two general moving lanes EACH direction become one EACH direction, bus-only/loading lane and separated bikes, lateNov/earlyDec2021. Road comparison uses nonparallel Broadway explicitly to reduce diversion contamination. No pre-trend verification, no aligned post motor count/occupancy, and pandemic recovery prevent a total-flow causal claim. Exact opening should be coded as transition interval; construction startedNov8.
- **Bogotá:** primary paper verified2020 motor-space reallocation on Séptima/Novena, Oct2019/Oct2021 speed comparisons, spatial treatment/control models. Full regression table and raw SIMUR data were not obtained. Maximum−19% is neither average effect nor all-mode welfare. Include as adverse published evidence, not reproduced causal effect.
- **Davis Fifth Street:**4through→2through+centerturn+two bike lanes, August2014. Primary authors abstract reports+243%intersection bicycle counts and significant PMcar-time decrease. Public CARB technical reanalysis documents4before vs2after observation days (May2013/Oct2014). Exact car-time rows, controls and original fulltext not recovered. Do not assert a control group.
- **Seattle Second Avenue:** 2014 cross-section removes drive/left-turn lane while retaining2generalthrough+bus, adds two-way protectedcycling. Short summer baseline188 vsannualpost744 bikes/day is not net induced cycling. Source report also compares bus times against3rd/5th, with mixed results. Direct reportdownload403 but primary report content indexed.
- **Seattle West Marginal:** May2023 moving lane→two-waybike, but single-lane bottlenecks already existed at each end. Agency reports<1secondmotor-delaychange and+144%weekdaybikecounts. WestSeattleBridge reopening inSep2022 is a dominant demand confounder; winter/summer windows and temporaryJan2023lane complicate timing. Use as a capacity-underutilization case, not equivalent to removing a binding Manhattan bottleneck.
- **Sydney George Street:** residentpanel with control neighborhoods and multiple diary waves is a useful measurement template. Actual moving-lane reduction unverified; exclude from strict conversion pool.

## What this adds to the causal project

1. Separate estimands for bike-only versus bike+bus corridor redesign.
2. Include an explicit adverse-speed case; no sign-based case selection.
3. Build corridor-specific donor pools, using nonparallel unaffected corridors for identification and nearby parallel roads for spillover outcomes, not automatically as controls.
4. Collect onboard bus loads crossing the same boundary, motor occupancy, bike/ped counts and network displacement. Ridership boardings are not onboard screenline loads.
5. For journey minutes, follow fixedorigin/destination cohorts through mode changes using traveler diary/panel or matched multimodal journeys. Segment runtime improvements alone do not establish shorter whole commutes.
6. Cambridge is ready for summary-data ingestion now; it is not ready for a causal pooled estimate.

## Files and provenance

- candidates.json and candidates.csv:6case records, source URLs, eligibility, limitations and next data needs.
- cambridge_road_times.csv:32weekday comparisons, source table and PDFpage.
- cambridge_bus_times.csv:6bus-link comparisons, source table and PDFpage.
- cambridge_bike_counts.csv:6peak-hour count comparisons including source percentage mismatch.
- build_evidence.py:deterministic transcription and calculation script;not an automatedPDFparser.
- source_manifest.json:URL,bytes,SHA256 for3downloadedCambridgePDFs.
- cambridge-north-mass-evaluation.pdf/.txt:primaryevaluation,fullPDFandpdftotext.
- cambridge-2016-figures.pdf and cambridge-2021-traffic.pdf:baselinecounts,notpairedpostcounts.

Primary Cambridge report: https://www.cambridgema.gov/-/media/Files/Traffic/2021/20221118_northmassavepostimplementationanalysis.pdf
Project and bike counts: https://www.cambridgema.gov/streetsandtransportation/projectsandprograms/massavedudleysttoalewifebrookpkwy
Primary Bogotá paper: https://www.sciencedirect.com/science/article/pii/S0264275124005109
Primary Davis abstract: https://itspubs.ucdavis.edu/publication_detail.php?id=2897
Seattle Second report: https://www.seattle.gov/Documents/Departments/SDOT/BikeProgram/2nd_Ave_PBL_Report.pdf
Seattle WestMarginal primary summary: https://sdotblog.seattle.gov/2023/12/05/west-marginal-way-data-results/
