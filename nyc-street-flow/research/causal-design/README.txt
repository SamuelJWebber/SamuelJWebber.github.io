NYC STREET FLOW — CAUSAL DESIGN WORKBENCH
Evidence checked November 5, 2026; release November 6, 2026.

This bundle specifies a target trial, maps available data and records actual source-access tests. It does not contain a new causal effect estimate.

START HERE
- protocol.txt: ideal experiment, observational emulation, pilot, estimands and acceptance rules.
- design.json: the dashboard's 20-source map, 10 ranked candidates, 9 trial requirements, 8 evidence gates.
- data-map.json / data-map-memo.md: detailed coverage, fields and join limits.
- candidates.json: primary-source geometry and timing evidence.
- methods.json / methods-memo.txt: methods, similar studies and their limits.
- red-team-identification.md: adversarial audit.
- acquisition-brief.txt: unsent new acquisition specifications; existing request status is separate.

ACTUAL ACQUISITIONS
TLC: 11,904 completed Greenpoint–LIC bookings from two pre-construction sample weeks. Raw public rows, derived durations, exact queries and SHA256 hashes included. No before/after effect calculated. Run python verify.py for an offline check; python tlc_feasibility.py re-fetches the public APIs (requires network, and upstream data may change).

B62: stop-boardings and segment-time coverage probes, with distinct-month checks. These confirm temporal availability for a candidate nearby service, not direct use of the converted street or identical segment/stop support.

NYSDOT: 2022 continuous-count coverage, stale 2024 AADT inventory fields, public 2026 short-count summary and metadata. The small 2026 summary/latest timestamp is not a recovered date-level series. Non-finite GDB fields are normalized to JSON null; the underlying source URL/fields are retained. The full large archive/GDB is referenced, not bundled.

DOT: public API probe snapshots and E-ZPass partition metadata. Failed queries/empty name searches do not establish a spatial absence of observations.

McGuinness official 2026 evaluation: audit plus approximate vector-chart digitization. All chart CSVs explicitly say not exact counts. The 558 northern time-profile values have unknown interval/rolling-window semantics: DO NOT SUM. They are not 558 independent observations. Travel-time ranges are descriptive official statements, not causal estimates or uncertainty intervals.

REPRODUCING CHART EXTRACTION
Download the exact public PDFs listed in mcguinness-source-manifest.json into this directory with the listed filenames and verify SHA256 hashes. PDFs are not bundled. Run extract_mcguinness_2026.py with Python and PyMuPDF (fitz). Source files have been inspected; a later upstream replacement can change the hash/output. The supplied verify.py does not need those PDFs or external packages.

INTERPRETATION
Do not add northern/southern serial counts, mismatched survey dates, station entries, or completed ride-hail bookings into a total person-flow estimate. Do not treat an implementation queue as random without evidence. Do not turn the 2026 day/night difference into the daytime effect without identifying the nighttime effect. Full uncertainty requires more than a raw-data audit.

The public Site's Git-backed source includes the UI and these assets. This ZIP contains this design module's research inputs, snapshots and checks, not every historical dashboard dataset.
