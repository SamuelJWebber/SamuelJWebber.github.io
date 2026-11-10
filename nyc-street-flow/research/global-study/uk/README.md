# UK lane-conversion evidence: findings and source audit

Manchester is the strongest new UK case for measuring multimodal outcomes and diversion. London Blackfriars remains a useful person-throughput benchmark. Neither establishes the isolated causal effect of bike-lane conversions on total network person flow or door-to-door travel minutes.

## Manchester: keep the mixed result

TfGM's original May 2025 Bus Priority Programme final evaluation was downloaded in full. The intervention combines 4.5 km of segregated on-carriageway cycle lanes, a 1.6 km bus/taxi/cycle-only section, wider pavements, a 30-to-20 mph speed-limit change, new through-bus services, signal changes, and capacity improvements on adjacent Upper Brook Street. Full enforcement was in September 2017. This is evidence about a package, not a bike-only experiment.

The original report is `manchester_final_evaluation.docx`. All 82 tables are preserved in `manchester_all_tables.json`; ten relevant tables have standalone CSVs. Table numbers are stable locators; the document's pagination was not independently verified.

- Table 5.9: at four main Oxford Road sites, one-day cycle counts rose from 772/1,264/1,799/1,876 in March 2015 to 2,580/3,499/3,922/4,425 in March 2019. These are repeated point counts, not unique trips, so they must not be summed as people served. Parallel routes were checked, but their baseline counts were in different seasons and are not clean controls.
- Table 4.6: observed June bus times from Manchester Royal Infirmary to the city increased from 16:33 to 19:14 in the AM peak, 17:55 to 18:40 interpeak, and 19:15 to 22:10 PM between 2013 and 2018. Variability generally decreased. Reverse-direction times (Table 4.9) changed little. Do not report that this corridor simply made buses faster.
- Tables 4.8 and 4.10 construct longer through-trip benefits by removing an 11-minute interchange allowance when buses start running across the city. This is relevant to complete journeys, but is not a directly observed door-to-door panel and cannot be attributed to cycle lanes alone.
- Table 5.13 compares GPS journey-time changes on adjacent Upper Brook Street with four other radial roads, weighted by 2013 traffic volumes. Our calculations reproduce the indices: in 2019 the relative change ranges from +12.42% inbound AM to -12.03% outbound AM. There is only one pre-treatment year; no pre-trend or uncertainty estimate; Upper Brook was itself widened to accommodate diversion.
- Table 5.12 supplies annual cycle counts from 2017–2023, including documented sensor-gap imputation in 2022. These give a longer-run monitoring series, not a long pre-period.

**Two original-report audit flags:** Table 4.10 prints a PM reduction of 20%, but 40:38 to 29:25 calculates to **27.60%**. Our derived CSV preserves both. Table 5.13 repeats the same PM comparison indices in both directions; we preserve the published values and flag them for raw-data verification. No raw bus/GPS observations were available to audit those tables.

Source: https://assets.ctfassets.net/nv7y93idf4jq/55vJ8zHHCDR7dnj7oyuSbe/7cdba94ff01594bb1ac4ccadde2721ca/Bus_Priority_Programme_-_final_evaluation_full_report.docx

## London: useful person counts, incomplete causal design

The 2017 TfL evidence pack, PDF page 17, gives Blackfriars northbound 08:00–09:00 throughput of 1,938 people on the cycle track and 1,542 on the main carriageway. That is **3,480 people/hour** across those two facilities, **55.69%** on cycles, and a **1.257** cycle/carriageway people ratio. The headline 5x claim normalizes for road space; it is not a 5x actual-person-flow ratio. Footways and rail are excluded from our arithmetic.

The NS proposal, PDF page 2, explicitly replaces traffic lanes over most of the corridor. Its PDF page 4 map marks the Blackfriars Road/Bridge portion as traffic-lane replacement. Exact as-built lane counts have not been checked segment by segment. Avoid conflating the separate 2011 Blackfriars junction alterations with the 2016 project.

The FOI-1339-2021 response says the initial 5% person-flow increase is an average of Blackfriars and Victoria Embankment calculations. It refers to attached tables and bus-passenger methodology, but those attachments were not exposed in the retrieved response. Direct TfL executor requests returned HTTP 403. **The 5% result has not been independently reproduced.** The 18% figure in TfL's parliamentary evidence is a capacity estimate, not an observed before/after result.

The evidence pack page 13 time table compares predictions with on-street measurements, **not pre versus post**. Eastbound PM observations were 25–30 minutes compared with a modelled 13; model assumptions, construction, and bedding-in differed. NS measurement was limited by camera failures. Do not infer a full journey-time effect from these figures.

Sources:
- https://content.tfl.gov.uk/segregated-cycling-infrastructure-evidence-pack.pdf — PDF pages 12–13, 16–17.
- https://content.tfl.gov.uk/board-20150204-part-1-item-07d-propose-csh-appx2-ns.pdf — PDF pages 2 and 4; map visually inspected.
- https://tfl.gov.uk/corporate/transparency/freedom-of-information/foi-request-detail?referenceId=FOI-1339-2021 — response 3 November 2020.
- https://committees.parliament.uk/writtenevidence/77255/html/ — paragraphs 5.6–5.8.

## Downloaded London raw counts: do not skip the quality flags

Downloaded 1,368 hourly raw vehicle-class rows for DfT points 56614, 18468, 47661, 48552 and 58306. `london_dft_raw_counts.csv` retains date, hour, direction and vehicle type; `london_dft_survey_day_direction_totals.csv` contains 114 survey-day/direction totals. Four AADF panels retain `estimation_method` and detailed flags.

- Bridge 56614 has a raw survey on 28 June 2011 and 28 June 2016, with no raw manual survey in between. AADF 2012–2015 is extrapolated from 2011. A naïve 2015–2016 jump conflates count refresh with treatment.
- North approach 6751 has a real count in 2014, then extrapolated AADF throughout 2015–2024. A DID using those annual numbers would manufacture treatment-period observations.
- Adjacent points 73304 and 75396 repeat the 56614 AADF series; they are not independent replicates.
- Point 58306 records only one raw cycle in 2018 versus 2,258 in 2014. New segregated-track coverage and counter geometry need checking before interpreting this as cycling decline.

API and quality documentation: https://roadtraffic.dft.gov.uk/api-documentation and https://roadtraffic.dft.gov.uk/downloads . Count profiles: https://roadtraffic.dft.gov.uk/count-points/56614 and https://roadtraffic.dft.gov.uk/count-points/6751 . Raw original API JSONs are retained alongside CSVs.

## Causal-method precedent, with treatment mismatch

Bhuyan, McCoy, Li and Graham (2021), DOI 10.1214/21-AOAS1450, use propensity-weighted DID and doubly robust mixed models on 75 treated and 375 comparison zones. Their 2007–2014 panel covers earlier CS2/CS3/CS7/CS8 routes, not the 2016 segregated conversion. The published ATT doubly robust estimates are motor traffic -7.026% (95% CI -9.684 to -5.007) and point speed +2.096% (-0.813 to +4.704). These are author estimates, not our replication. They concern vehicles and point speeds, not person flow or complete journeys.

Original downloaded PDF: https://arxiv.org/pdf/2003.08993 . Tables 11–12 are extracted in `bhuyan_published_estimates.csv`.

## Integration files

`candidates.json`: four cases, detailed treatment, measurements, limitations and sources.

`comparisons.json`: 14 dashboard-ready measured comparisons; all carry causal-eligibility flags. It includes six local bus-time comparisons and six 2019 relative parallel-road comparisons, preserving both positive and negative results.

`source_audit.json`: machine-readable retrieval and audit record.

`manifest.json`: hashes and sizes for the original sources and first-round extracted files.

Recommended dashboard treatment: publish Manchester as a **bundled redesign / mixed time result**, London as **peak person-flow benchmark with unreproduced before/after claim**, and Bhuyan as **causal-method precedent / treatment mismatch**. Keep all out of a pooled bike-lane-only causal coefficient until eligibility is established.
