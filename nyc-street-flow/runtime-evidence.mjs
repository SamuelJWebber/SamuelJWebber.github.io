import {esc, fmt, sign, table, link} from './research-view.mjs';

const dataUrl = new URL('./research/new/runtime-analysis.json', import.meta.url);
const percent = value => Number.isFinite(value) ? `${fmt(value * 100, 1)}%` : 'Unavailable';
const minutes = value => Number.isFinite(value) ? `${fmt(value, 2)} min` : 'Unavailable';
const change = value => !Number.isFinite(value) ? 'Unavailable' : Math.abs(value) < 1
  ? `${sign(value * 60, 1)} sec` : `${sign(value, 2)} min`;
const lineLabel = line => line === 'ALL' ? 'All included lines' : line === 'J' ? 'J / Z reporting group' : line === 'N' ? 'N / W reporting group' : `${line} line`;
const optionList = (values, selected) => values.map(([value, label]) =>
  `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
const download = (label, filename) => `<a class="btn" href="research/new/${esc(filename)}" download>${esc(label)}</a>`;
const comparisonKey = row => `${row.window}:${row.baseline_year}:${row.target_year}`;

// Only the balanced, five-year intersection is plotted. Pairwise baskets are never spliced.
function balancedChart(rows) {
  const usable = rows.length === 5 && rows.every(row =>
    row.matched_cells > 0 && Number.isFinite(row.change_minutes) && Number.isFinite(row.fixed_actual_minutes));
  if (!usable) return '<p class="small">No exact peak-period basket is shared across all five years for this selection. A five-year trend is unavailable; a supported two-year comparison may still be available above.</p>';
  const W = 760, H = 205, L = 57, R = 43, T = 33, B = 37;
  const low = Math.min(0, ...rows.map(row => row.change_minutes));
  const high = Math.max(0, ...rows.map(row => row.change_minutes));
  const padding = Math.max(.22, (high - low) * .19);
  const lo = low - padding, hi = high + padding;
  const x = year => L + (year - 2019) / 7 * (W - L - R);
  const y = value => T + (hi - value) / (hi - lo) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi];
  const points = rows.map(row => `${x(row.year)},${y(row.change_minutes)}`).join(' ');
  const smallestShare = Math.min(...rows.map(row => row.matched_share));
  const lowCapture = rows.filter(row => Number.isFinite(row.actual_to_scheduled_ratio) && row.actual_to_scheduled_ratio < .6);
  const desc = rows.map(row => `${row.year}: ${sign(row.change_minutes, 2)} minutes from 2019, ${percent(row.matched_share)} of published trains retained`).join('; ');
  return `<p class="small">Change from 2019 in minutes per full train path. All five years use the same exact paths, months, directions and departure periods, with fixed 2019 train weights.</p>
    <svg class="research-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Five-year matched runtime changes. ${desc}`)}">
      <title>Fixed-basket full train-path runtime changes</title><desc>${esc(desc)}</desc>
      ${ticks.map(tick => `<line x1="${L}" x2="${W - R}" y1="${y(tick)}" y2="${y(tick)}" stroke="#dbe2d6"/><text x="${L - 9}" y="${y(tick) + 4}" text-anchor="end" font-size="11" fill="#536354">${sign(tick, 1)}</text>`).join('')}
      <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#8e9d88" stroke-dasharray="4 4"/>
      <text x="${L}" y="14" font-size="11" fill="#536354">Minutes from 2019</text>
      <polyline fill="none" stroke="#386348" stroke-width="2.5" points="${points}"/>
      ${rows.map(row => `<circle cx="${x(row.year)}" cy="${y(row.change_minutes)}" r="4" fill="#386348"/><text x="${x(row.year)}" y="${y(row.change_minutes) - 11}" text-anchor="middle" font-size="12" fill="#203e2a">${sign(row.change_minutes, 2)}</text><text x="${x(row.year)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#536354">${row.year}</text>`).join('')}
    </svg>
    <p class="small">The stricter five-year basket retains at least ${percent(smallestShare)} of published trains in each year. Its 2019 mean is ${minutes(rows[0].fixed_actual_minutes)}. It can differ from the two-year basket above; no intervening years are imputed.</p>
    ${lowCapture.length ? `<p class="research-verdict"><strong>Five-year capture limitation:</strong> retained actual / scheduled train ratios are ${lowCapture.map(row => `${percent(row.actual_to_scheduled_ratio)} in ${row.year}`).join(', ')}. The low retained counts limit comparability despite any high path-match share.</p>` : ''}
    <details><summary>Five-year values and capture diagnostics</summary>${table(
      ['Year', 'Fixed-basket actual runtime', 'Change from 2019', 'Matched / published trains', 'Retained actual / scheduled'],
      rows.map(row => [row.year, minutes(row.fixed_actual_minutes), change(row.change_minutes), `${fmt(row.matched_trains, 0)} / ${fmt(row.published_trains, 0)} (${percent(row.matched_share)})`, percent(row.actual_to_scheduled_ratio)])
    )}<p class="small">The last column is a data-capture diagnostic, not a cancellation or service-delivery rate. A high matched share does not repair missing observations in the source.</p></details>`;
}

/** Actual train runtimes are a separate context layer, not a passenger-time or lane-effect estimate. */
export async function renderRuntimeEvidence(rootSelector = '#runtime-evidence') {
  const root = document.querySelector(rootSelector);
  if (!root) return;
  root.innerHTML = '<p class="small" role="status">Loading matched subway runtimes…</p>';
  let data;
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (!Array.isArray(data?.pairwise_comparisons) || !Array.isArray(data?.balanced_series) || !data?.selectors?.lines?.brooklyn_manhattan) throw new Error('Missing runtime comparisons');
  } catch {
    root.innerHTML = `<article class="research-card"><h3>Actual subway runtimes</h3><p role="status">The runtime analysis could not be loaded. Please reload to try again.</p><p>${link('MTA end-to-end running times', 'https://data.ny.gov/d/sp9g-mzjh')}</p></article>`;
    return;
  }

  const scope = 'brooklyn_manhattan';
  const pairwise = data.pairwise_comparisons.filter(row => row.scope === scope);
  const comparisons = [...new Map(pairwise.map(row => [comparisonKey(row), row])).values()]
    .sort((a, b) => (a.window === 'june' ? 0 : 1) - (b.window === 'june' ? 0 : 1) || b.baseline_year - a.baseline_year || b.target_year - a.target_year);
  const defaultKey = 'june:2021:2022';
  const state = {line: 'L', period: 'peak_combined', comparison: comparisons.some(row => comparisonKey(row) === defaultKey) ? defaultKey : comparisonKey(comparisons[0])};
  const sources = data.metadata.source_urls;

  root.innerHTML = `<article class="research-card" aria-labelledby="runtime-evidence-title">
    <div class="minilabel">MTA actual train records · Weekday schedules · Through September 2026</div>
    <h3 id="runtime-evidence-title">Did the same subway train paths get faster?</h3>
    <p>Compare actual running time on paths that stop in both Brooklyn and Manhattan. These are <strong>full train paths, weighted by trains</strong>, including intermediate station dwell. They are not a rider’s Brooklyn–Manhattan journey or door-to-door travel time.</p>
    <div class="research-controls">
      <label for="runtime-line">Line<select id="runtime-line"></select></label>
      <label for="runtime-period">First departure period<select id="runtime-period"></select></label>
      <label for="runtime-comparison">Same-month comparison<select id="runtime-comparison"></select></label>
    </div>
    <div data-runtime-result aria-live="polite" aria-atomic="true"></div>
    <div data-runtime-chart></div>
    <details>
      <summary>What is matched, and what these minutes mean</summary>
      <p>The two-year comparison matches calendar month, reporting line, railroad direction, departure period and the exact ordered stop sequence. Baseline-year actual train counts weight both years. Official path IDs are combined only when the line, direction and every stop agree. The five-year chart uses a separate, stricter intersection and fixed 2019 weights.</p>
      <p>The raw comparison weights each year’s available paths by that year’s train counts. It can change because route lengths, short turns, service patterns or the mix of trains changed. Matched shares use published actual trains as the denominator; they do not measure coverage of all trains that operated.</p>
      <p>MTA derives actual runtimes from calibrated train-location systems, with corrections and interpolation. B Division source systems changed around 2019–2020. The release excludes cancellations, unscheduled skips or reroutes, very small or implausible path samples, and other filtered records. Actual-to-scheduled train ratios can reflect missing observations, filters, schedules and service changes; they are not cancellation rates.</p>
      <p>Runtime runs from departure at the first stop to arrival at the last. It includes intermediate dwell and excludes platform wait, access walks, transfer waits and terminal layover. “Weekday” means the schedule day type. AM uses first departures 06:00–08:59 and PM 15:00–18:59, which differ from the OD panel’s passenger-entry windows. These values are not multiplied by that panel’s riders.</p>
      <p>This is descriptive context for travel conditions. It does not estimate a lane-conversion effect, individual mode switching, passenger-weighted time or total passenger-minutes. Published path means do not support trip-level uncertainty intervals.</p>
    </details>
    <details>
      <summary>Sources and reproducible calculations</summary>
      <p>${link('MTA actual end-to-end running times', sources.runtime)} · ${link('Ordered subway paths', sources.paths)} · ${link('Station reference', sources.stations)} · ${link('MTA definitions and exclusions (PDF)', sources.runtime_overview)}</p>
      <p class="small">Retrieved November 5, 2026. Latest published month: September 2026. The analysis checked ${fmt(data.coverage?.source_runtime_rows, 0)} weekday runtime records in the selected years, with no duplicate source keys or unmapped runtime paths. Downloads include all matched comparisons and the calculation script.</p>
      <div class="research-downloads">
        ${download('Two-year comparisons · CSV', 'runtime-pairwise-comparisons.csv')}
        ${download('Five-year series · CSV', 'runtime-balanced-series.csv')}
        ${download('Monthly changes · CSV', 'runtime-monthly-comparisons.csv')}
        ${download('Analysis data · JSON', 'runtime-analysis.json')}
        ${download('Methods · JSON', 'runtime-methods.json')}
        ${download('Reproduce · Python', 'runtime_analysis.py')}
      </div>
    </details>
  </article>`;

  const lineControl = root.querySelector('#runtime-line');
  const periodControl = root.querySelector('#runtime-period');
  const comparisonControl = root.querySelector('#runtime-comparison');
  lineControl.innerHTML = optionList([...data.selectors.lines[scope].map(line => [line, lineLabel(line)]), ['ALL', 'All included lines']], state.line);
  periodControl.innerHTML = optionList([
    ['peak_combined', 'AM + PM peaks'], ['am_peak', 'AM · 06:00–08:59'], ['pm_peak', 'PM · 15:00–18:59']
  ], state.period);
  comparisonControl.innerHTML = optionList(comparisons.map(row => [comparisonKey(row), `${data.selectors.windows[row.window].label} · ${row.baseline_year} → ${row.target_year}`]), state.comparison);

  function renderSelection() {
    const row = pairwise.find(item => item.line === state.line && item.period === state.period && comparisonKey(item) === state.comparison);
    const result = root.querySelector('[data-runtime-result]');
    const chart = root.querySelector('[data-runtime-chart]');
    if (!row) {
      result.innerHTML = '<p role="status">This comparison is unavailable.</p>';
      chart.innerHTML = '';
      return;
    }
    const supported = row.matched_cells > 0 && Number.isFinite(row.fixed_change_minutes);
    const baseline = row.baseline_year, target = row.target_year;
    const title = `${lineLabel(state.line)} · ${data.selectors.windows[row.window].label} ${baseline} → ${target}`;
    const lowRatio = [row.baseline_actual_to_scheduled_ratio, row.target_actual_to_scheduled_ratio].some(value => Number.isFinite(value) && value < .8);
    const severeRatio = row.low_retained_actual_to_schedule;
    const warnings = [];
    if (!supported) warnings.push('<strong>No exact common support.</strong> The selected years have no matching stop-path basket in this departure period. No like-for-like change is estimated; the raw change alone cannot establish a speed change.');
    else if (Math.min(row.baseline_matched_share, row.target_matched_share) < .8) warnings.push(`<strong>Partial matching coverage.</strong> This fixed-basket change covers ${percent(row.baseline_matched_share)} of published ${baseline} trains and ${percent(row.target_matched_share)} of ${target} trains. The unmatched paths may differ.`);
    if (lowRatio) warnings.push(`<strong>${severeRatio ? 'Low retained train counts' : 'Capture caution'}${baseline === 2021 || target === 2021 ? ' in this 2021 comparison' : ''}.</strong> Retained actual / scheduled train counts are ${percent(row.baseline_actual_to_scheduled_ratio)} → ${percent(row.target_actual_to_scheduled_ratio)}. ${severeRatio ? 'The low ratio makes source coverage a substantial limitation. ' : ''}Matching the published paths cannot repair missing observations. This diagnostic is not a cancellation rate.`);
    const examples = data.representative_paths.filter(path => path.line === state.line);
    const examplesText = examples.slice(0, 2).map(path => `${path.station_names[0]} → ${path.station_names.at(-1)} (${path.number_of_stops} stops)`).join('; ');
    const meanText = supported ? `Fixed-basket actual runtime: <strong>${minutes(row.fixed_baseline_minutes)} → ${minutes(row.fixed_target_minutes)}</strong> per full train path (${sign(row.fixed_change_pct, 2)}%).` : 'Fixed-basket runtime is unavailable for this comparison.';
    const sameScheduleSupport = supported && row.scheduled_support_weight_share >= .999999;

    result.innerHTML = `<p><strong>${esc(title)}</strong></p>
      <div class="research-status">
        <div><span>Same paths · fixed baseline train weights</span><b>${change(row.fixed_change_minutes)}</b><span>${supported ? (row.fixed_change_minutes > 0 ? 'Longer actual runtime' : row.fixed_change_minutes < 0 ? 'Shorter actual runtime' : 'No measured change') : 'No matching basket'}</span></div>
        <div><span>All published paths · each year’s train mix</span><b>${change(row.raw_change_minutes)}</b><span>Raw change, including service-pattern mix</span></div>
        <div><span>Matched share of published actual trains</span><b>${percent(row.baseline_matched_share)} → ${percent(row.target_matched_share)}</b><span>${baseline} → ${target} · ${fmt(row.matched_paths, 0)} exact paths</span></div>
      </div>
      <p>${meanText}</p>
      <p class="small"><strong>Retained actual / scheduled train counts:</strong> ${percent(row.baseline_actual_to_scheduled_ratio)} → ${percent(row.target_actual_to_scheduled_ratio)}. A source-coverage diagnostic, not a service-delivery rate.</p>
      ${warnings.map(warning => `<p class="research-verdict">${warning}</p>`).join('')}
      ${examplesText ? `<p class="small"><strong>Example full paths:</strong> ${esc(examplesText)}. These examples have June AM observations in all five years; the selected basket can include other paths.</p>` : `<p class="small">${state.line === 'ALL' ? 'Includes entire paths on all selected lines, some extending into Queens or the Bronx.' : 'No representative June AM path is shared across all five years for this line.'}</p>`}
      <details><summary>Selected comparison: counts and scheduled runtimes</summary>
        ${table(['Measure', baseline, target], [
          ['Matched actual trains', fmt(row.baseline_matched_trains, 0), fmt(row.target_matched_trains, 0)],
          ['All eligible published actual trains', fmt(row.baseline_published_trains, 0), fmt(row.target_published_trains, 0)],
          ['Fixed-basket actual runtime', minutes(row.fixed_baseline_minutes), minutes(row.fixed_target_minutes)],
          ['Raw actual runtime', minutes(row.raw_baseline_minutes), minutes(row.raw_target_minutes)],
          ...(sameScheduleSupport ? [['Fixed-weight scheduled runtime · same full basket', minutes(row.fixed_scheduled_baseline_minutes), minutes(row.fixed_scheduled_target_minutes)]] : []),
          ['Retained actual trains on paths with schedules', fmt(row.baseline_actual_on_scheduled_paths, 0), fmt(row.target_actual_on_scheduled_paths, 0)],
          ['Scheduled trains on those published paths', fmt(row.baseline_scheduled_trains, 0), fmt(row.target_scheduled_trains, 0)]
        ])}
        <p class="small">${fmt(row.matched_cells, 0)} matched month × path × direction × departure-period cells. ${sameScheduleSupport ? 'Scheduled runtime uses the same complete fixed basket as actual runtime. Scheduled minutes are distinct from observed actual minutes.' : `Only ${percent(row.scheduled_support_weight_share)} of the fixed actual-train weight has valid schedules in both years. Scheduled-runtime means are hidden because their basket differs from the actual-runtime basket.`}</p>
      </details>`;
    const series = data.balanced_series.filter(item => item.scope === scope && item.line === state.line && item.period === state.period && item.window === row.window).sort((a, b) => a.year - b.year);
    chart.innerHTML = `<h4>Same paths across five years · ${esc(data.selectors.windows[row.window].label)}</h4>${balancedChart(series)}`;
  }
  lineControl.addEventListener('change', () => {state.line = lineControl.value; renderSelection();});
  periodControl.addEventListener('change', () => {state.period = periodControl.value; renderSelection();});
  comparisonControl.addEventListener('change', () => {state.comparison = comparisonControl.value; renderSelection();});
  renderSelection();
}
