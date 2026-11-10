INTERNATIONAL DATA ACQUISITION — NOVEMBER 6, 2026

This release turns a list of candidate sources into inspectable download packages.
It does not turn the existing before/after observations into a causal result.

Scope: 19 screened street-reallocation cases in 13 cities. This acquisition pass
added or extended actual source data for eight cities: Berlin, Paris, London,
Cambridge (Massachusetts), Seattle, Toronto, Calgary and Vancouver.

The ledger contains 36 source families / outstanding data requirements:
21 raw-source acquisitions, 5 published-table acquisitions, 4 sources located,
5 requirements not publicly found, and 1 blocked retrieval. These categories
are not independent studies. Some raw sources are location inventories, weather
or geometry rather than outcome observations. Coverage is explicit per entry.

WHAT WAS ACTUALLY ACQUIRED

Berlin: all 24 monthly 2019–2020 motor archives, 4,532,392 hourly records.
Published: 190,837 cross-section days and 309,085 candidate-road hours, plus
456,118 bicycle counter-hour cells with provider flags preserved, weather,
geometry and sensor proximity audits. Candidate street names do not establish
treatment assignment. Nearby bicycle counters are not on treated boundaries.

London: 2,021,712 original survey rows across 23 waves in 2014–2017, included
in the London ZIP with extracts and reproduction scripts. A 16-hour survey
wave can combine hour slots from several dates; it is not necessarily one day.
The original passenger-occupancy calculation behind the reported +5% throughput
claim has not been obtained.

Cambridge: 156,166 intersection movement rows, 131,728 historical MBTA APC
records, 651,740 selected bus timing events and 9,616 pedestrian records.
Raw query windows and source metadata are included. Newly generated count and
bus comparison tables are withheld: sensor identifiers indicate UTC while the
provisional count script treated clock hours as local. Correct local-day
extraction requires padded dates and America/New_York conversion. Seasonal
APC averages are not passenger loads on these specific sampled days.

Seattle: 89,125 bicycle counter rows and 1,239 motor-study records. Second
Avenue's retrieved counter starts in 2015, so it cannot establish a 2014
baseline. Nearby Spokane Street is not the West Marginal measurement boundary.

Toronto: 3,456 quarter-hour records spanning 108 surveys and 49 named
intersections, 2013–2019. These are queried public turning counts, not verified
original observations from the 11-site Bloor pilot evaluation.

Calgary: original annual downtown cordon workbooks for 2012–2019, 24 extracted
16-hour summary rows, plus 123 site-year count records for 2016–2019. Earlier
API records are location inventories; their counts come from workbook
attachments. Person-count definitions are documented in the city package.

Vancouver: original 579-date panel and extended 1,005-date bicycle panel,
location inventories and derived TransLink 2008/2011 tables. One overlapping
day disagrees between sources (2010-06-29: 40,358 versus 4,420); preserve and
flag it. Motorized person totals exclude cycling/walking; transit covers
9 hours versus 16 hours for road counts. Canada Line opening is a major
co-intervention. Full restricted TransLink reports are not redistributed.

Paris: five annual bicycle archives (2,343,597 source rows) and five annual
road-count archives acquired. The public package contains 119,870 selected
Rivoli/Voltaire bicycle rows and 19,488 road arc-hours from two bounded 2020
weeks, plus archive hashes and retrieval scripts. It does not contain a fully
harmonized five-year motor panel. Rivoli counter location changes and 2018
coverage is absent. Loop occupancy is not passengers per car. Rail catalog
metadata were acquired; the station-level passenger files were not.

HOW TO USE THE DOWNLOADS

Use ledger.json or ledger.csv for statuses, exact coverage, primary source
URLs, limitations and next requirements. Each city ZIP carries its own audit
notes and source manifest. Large original archives can be retrieved from their
official URLs with included scripts. The main workbench reproduction ZIP does
not duplicate these eight city ZIPs; download them separately when needed.

The new data improve the study's inputs, not its causal identification by
themselves. Remaining gates: dated lane geometry; stable same-boundary counts;
matched car occupancy and transit loads; valid comparison corridors and
pre-trends; network diversion; and complete journey times. Do not combine
different hours, count serial locations as unique trips, or substitute station
entries for onboard passenger loads.

Checks cover file integrity, row counts, source provenance, link targets,
arithmetic and UI behavior. They do not certify causal validity. Acquisition
records reflect what was retrieved by November 6, 2026, not an exhaustive
inventory of all data that exist.
