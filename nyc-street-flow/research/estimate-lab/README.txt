NYC Street Flow — estimate sensitivity and observed travel-time distributions
Prepared 5 November 2026

SCOPE
This package contains deterministic analyses of already-acquired public records.
It adds no new independent causal experiment. Do not pool PPW driving estimates
with Third Avenue bus estimates, treat specification counts as probabilities, or
interpret scenario ranges as confidence intervals.

REPRODUCE
From the extracted folder, run:
  python research/estimate-lab/reproduce.py
  node research/estimate-lab/test.mjs
The Python script uses only the standard library. Node is required for the JS
accounting and input-validation checks. No network request is needed.

INPUTS
ppw-raw-runs.csv: every extracted timed run from NYC DOT's original 2010 PPW
report (416 including Saturdays). Weekday analysis retains 384 traversals over
four roads, four survey dates, and 07:00–19:00. Each road has 48 before and 48
after runs for the full survey window.
Source: https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf
Full source-table extraction is available in ../causal/ppw-reproduction.zip on
the published dashboard.

ppw-times.json: existing controlled segment-time calculations, five comparator
baskets × four clock windows; each shown for both days, Tuesday, or Wednesday.
Seventh/Eighth were co-treated by B69 changes; Sixth runs in the other direction.

third-avenue-analysis.json: existing fixed-weight bus segment-time calculations,
five controls × three peak-period definitions; each shown for January–June,
January–March, or April–June matched 2023→2024 windows. Quarter subsets retain
the original Jan–Jun fixed weights. Values are seconds over the treated
1.472-mile E67→E97 segment. The primary control remains Lexington, regardless
of its result. Clock windows and date subsets change the target travel mix; the
range does not bound one common policy effect. Monthly bus averages do not permit individual bus-trip quantiles.
Source: https://data.ny.gov/d/58t6-89vi
Full acquisition and methods: ../causal/third-avenue-reproducible.zip on dashboard.

flow-sensitivity.json: existing PPW count/B69 scenario inputs. Motor and bike
counts are not aligned in date or position. B69 passenger loads and vehicle
occupancies are not observed for these windows. Historical maxima are not hard
2010 bounds. Full provenance: ../causal/flow-reproduction.zip on dashboard.

OUTPUTS
specifications.json/csv: 105 correlated specifications. PPW's 60 and Third
Avenue's 45 rows are not 105 independent studies. The UI displays appropriate
subsets without averaging or voting across them.
distributions.json: 64 per-day and 32 pooled-wave groups; all raw weekday runs
retained in the appropriate clock window. Hour bounds are inclusive of the
start and exclusive of the end (07–19, 07–10, 10–14, 16–19).
per-day-distributions.csv and pooled-wave-distributions.csv contain N, mean,
minimum, P25, median, P75, P90, maximum, in seconds. Quantiles use linear
interpolation at (n−1)*p (Hyndman–Fan type 7).
checks.json: deterministic Python reproduction checks, source SHA256 hashes
are stored in distributions.json. The independent audit elsewhere on the
site also checks these summaries with NumPy.

INTERPRETATION
Run quantiles characterize the observed survey, not long-term reliability,
complete journey time, matched individual traveler change, or causal effects.
There are two survey weekdays per wave. Repeated runs within days do not supply
independent policy replications. For AM/PM per-day groups (N=6), P90 is an
interpolation between the two slowest observed runs.

The PPW reversal calculator fixes non-B69 motor occupancy at 1.3 in both waves,
separates bus drivers and passenger loads, and allows an additive net correction.
Index/hour = [1.3*V_after − 1.3*(V_before−N_bus) − N_bus
              + Bikes_after−Bikes_before]/3 − B69_passengers_before/hour
              + net_correction/hour.
The correction can represent omitted/misaligned person changes minus no-project
counterfactual changes only on a coherent counting boundary, counting each
person once. It is not estimated or bounded by these records. Subway station
entries cannot simply be added as crossing passengers. The correction to zero
is the negative of the index before correction. Occupancy zero-crossing holds
the net correction at zero and before occupancy fixed at 1.3. All thresholds
are assumption thresholds, not evidence that the missing quantities took those
values. A negative passenger threshold means the index is already negative at
zero passengers.

DISPLAY
Signed plots use symmetric zero-centered axes. Negative seconds mean shorter
segment time relative to a comparator. Sensitivity range is not a confidence
interval. Raw run strips show min–max, interquartile range, median and every
observed run; none is an uncertainty interval. UI choice state uses est* URL
parameters, including reversal assumptions, for shareable views.
