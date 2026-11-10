import {esc, fmt, sign, table, link} from './research-view.mjs';

const periods = {
  combined: 'AM + PM peaks',
  am: 'AM · 07:00–09:59',
  pm: 'PM · 16:00–18:59'
};
const controls = [
  ['lexington', 'Lexington E96→E68 · primary'],
  ['first', 'First Avenue E79→E97'],
  ['madison', 'Madison E57→E95 · M3/M4'],
  ['third_south', 'Third Avenue E23→E42'],
  ['third_north', 'Third Avenue E99→E125 · M101']
];
const asset = name => new URL(`./research/causal/${name}`, import.meta.url).href;
const seconds = value => Number.isFinite(value) ? `${sign(value, 1)} sec` : 'Unavailable';
const download = (label, name) => `<a class="btn" href="${esc(asset(name))}" download>${esc(label)}</a>`;

/** Render an executed but inconclusive quasi-experimental bus-time analysis. */
export function renderCausalBus(root, d) {
  if (!root) return;
  if (!Array.isArray(d?.estimates) || !Array.isArray(d?.monthly_panel)) {
    root.innerHTML = '<article class="research-card"><h3>Third Avenue bus times</h3><p role="status">The controlled bus-time analysis is unavailable.</p></article>';
    return;
  }
  let period = 'combined';
  root.innerHTML = `<article class="research-card" aria-labelledby="causal-bus-title">
    <div class="minilabel">Third Avenue · 2023 street redesign · Actual bus travel times</div>
    <h3 id="causal-bus-title">A measured improvement, with an unresolved causal comparison</h3>
    <p>The E59–E96 redesign replaced general traffic space with a bus lane and protected bike lane, alongside intersection and signal changes. We compare the same published bus-time cells before and after that <strong>combined package</strong>, using nearby streets as controls.</p>
    <p class="research-verdict"><strong>The causal effect is not established.</strong> The primary control diverged before construction, and the estimate changes with the control street. These are in-vehicle bus minutes, including dwell and signals—not door-to-door time or total traveler time.</p>
    <div class="research-controls"><label for="causal-bus-period">Weekday clock-hour window<select id="causal-bus-period">${Object.entries(periods).map(([value, label]) => `<option value="${value}"${value === period ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label></div>
    <div data-causal-bus-result aria-live="polite" aria-atomic="true"></div>
    <h4>How the control choice changes the answer</h4>
    <p class="small">All values below are seconds over the treated 1.472-mile distance. Negative controlled change means shorter bus time. Forecast error measures how well the control predicted a held-out period before construction; lower is better. The primary Lexington control stays fixed.</p>
    <div data-causal-bus-controls></div>
    <p class="small" data-causal-bus-control-support></p>
    <p class="small">First and Madison are comparison avenues; the two other Third Avenue segments are spatial sensitivity checks. None is guaranteed free of displaced traffic or shared operational changes. Controls were not selected for a favorable after-project result.</p>
    <details>
      <summary>Monthly evidence: all of 2023 and 2024</summary>
      <p class="small">The figure follows the selected peak period. Gold marks July–December 2023 implementation, excluded from the estimate; green marks the primary January–June 2024 post period. The later 2024 observations are descriptive.</p>
      <img data-causal-bus-figure class="research-chart" style="display:block;width:100%;max-width:100%;height:auto" loading="lazy" alt="">
      <p class="small">The top panel normalizes both streets to 1.472 miles. Only Third Avenue is actually that segment length. The lower panel shows changes in the treated-minus-control gap, relative to the January–June 2023 mean. Source rows and all five controls are available in the downloads.</p>
    </details>
    <details>
      <summary>Method and control audit</summary>
      <p>The primary window was fixed as January–June 2023 versus the same six months in 2024. Construction was announced in July 2023 and completion in December 2023. The observed Third Avenue segment is <strong>E67→E97 northbound</strong>, including one block beyond the E96 project boundary; it is not the entire project.</p>
      <p>We retain exact endpoint IDs, route, service type, weekday and hour. M101 Limited, M102 Local and M103 Local receive fixed January–June 2023 bus-trip weights. Lexington E96→E68 uses the identical treated route and clock-hour weights. Each calendar-month pair gets equal weight. Roadway distances are held fixed, with no missing time filled in.</p>
      <p><strong>Spring 2023 signal priority is a baseline complication.</strong> DOT had already added transit signal priority along Third Avenue E7–E125. Signal changes, bus operations, loading, detours and traffic diversion can differ across the treatment and controls. The package’s bike, bus and intersection components cannot be separated here.</p>
      <p>The exploratory control check calibrates each control to the treated January–March 2023 mean, then predicts held-out April–June 2023. It uses no post-period outcomes for ranking. Fixed January–June count weights and complete-period support are retained, so this is an outcome holdout, not a fully prospective availability test. Only three validation months are available; no flexible synthetic-control fit is used.</p>
      <p>Madison retains <strong>M3 and M4 Local</strong>; M1’s exact timepoint is unavailable throughout the comparison. Its small average placebo drift masks large positive and negative monthly errors. Official releases place the new Madison bus-lane extension and M2/M4 camera expansion in 2025. No 2023–June 2024 E57–E95 redesign was found in the reviewed official sources, which does not prove an absence of operational changes.</p>
      <p>First Avenue starts at E79 to avoid the directly redesigned E61–E79 stretch listed in DOT’s 2023 archive, but upstream spillover remains possible. Both Third Avenue controls share corridor signals and operations. Even matching M101 Limited alone with identical weights leaves the northern control’s combined-peak estimate positive (+54.5 seconds).</p>
      <p>There is one treated corridor and six paired calendar months. Thousands of published rows or bus trips do not create thousands of independent policy experiments. No headline confidence interval or causal significance claim is made. Matching coverage describes selected published records, not all buses that operated.</p>
    </details>
    <details>
      <summary>Sources, independent audit and reproducible files</summary>
      <p>${link('MTA bus segment times', 'https://data.ny.gov/d/58t6-89vi')} · ${link('DOT construction announcement', 'https://www.nyc.gov/html/dot/html/pr2023/3rd-ave-redesign.shtml')} · ${link('DOT completion announcement', 'https://www.nyc.gov/html/dot/html/pr2023/completion-safety-project-third-ave.shtml')} · ${link('Five-to-three-lane design, PDF pp. 16–17', 'https://www.nyc.gov/html/dot/downloads/pdf/third-ave-complete-streets-safety-improvements-oct2022.pdf#page=16')}</p>
      <p class="small">Retrieved November 5, 2026. The download contains ${fmt(d.qa?.raw_rows, 0)} raw source records, query URLs, checksums, fixed weights, methods and Python scripts. An independent calculation from the raw records reproduces the primary result. Historical DOT E-ZPass access required login in this session; this panel estimates no car-time effect.</p>
      <div class="research-downloads">
        ${download('Reproduce the analysis · ZIP', 'third-avenue-reproducible.zip')}
        ${download('Methods and findings', 'third-avenue-methods.txt')}
        ${download('Controlled comparisons · CSV', 'third-avenue-comparisons.csv')}
        ${download('Monthly panel · CSV', 'third-avenue-monthly-panel.csv')}
        ${download('Pre-period validation · CSV', 'third-avenue-prevalidation.csv')}
        ${download('Analysis · JSON', 'third-avenue-analysis.json')}
        ${download('Independent audit · JSON', 'third-avenue-independent-qa.json')}
      </div>
    </details>
  </article>`;

  function renderSelection() {
    const primary = d.estimates.find(row => row.period === period && row.control === 'lexington');
    const result = root.querySelector('[data-causal-bus-result]');
    if (!primary) {
      result.innerHTML = '<p role="status">This peak-period comparison is unavailable.</p>';
      root.querySelector('[data-causal-bus-controls]').innerHTML = '';
      return;
    }
    const support = d.monthly_panel.filter(row => row.period === period && row.support === 'primary12' && row.group === 'third_treated');
    const beforeTrips = support.filter(row => row.month.startsWith('2023')).reduce((sum, row) => sum + row.matched_bus_trips, 0);
    const afterTrips = support.filter(row => row.month.startsWith('2024')).reduce((sum, row) => sum + row.matched_bus_trips, 0);
    const minimumShare = support.length ? Math.min(...support.map(row => row.matched_share)) : null;
    const validation = primary.control_validation || {};
    result.innerHTML = `<p><strong>${esc(periods[period])} · January–June 2023 → January–June 2024</strong></p>
      <div class="research-status">
        <div><span>Conditional change vs Lexington</span><b>${seconds(primary.did_seconds_over_treated_segment)}</b><span>${sign(primary.percent_vs_counterfactual, 2)}% against the assumed counterfactual</span></div>
        <div><span>Placebo drift before construction</span><b>${seconds(primary.pre_placebo_seconds_over_treated_segment)}</b><span>Jan–Mar → Apr–Jun 2023, treated minus control</span></div>
        <div><span>Exploratory pre-period forecast error</span><b>${fmt(validation.held_out_rmspe_seconds_treated_segment, 1)} sec</b><span>RMS error on held-out April–June 2023</span></div>
      </div>
      <p>Observed fixed-weight Third Avenue time: <strong>${fmt(primary.treated_before_min_per_mile * 1.472, 2)} → ${fmt(primary.treated_after_min_per_mile * 1.472, 2)} minutes</strong> over E67→E97. The controlled change subtracts the comparison street’s change; it remains conditional on assumptions that the pre-period checks do not establish.</p>
      <p class="small"><strong>Published-trip support:</strong> ${fmt(support[0]?.fixed_cells, 0)} paired route × weekday × hour cells in each of 12 months; ${fmt(beforeTrips, 0)} selected bus traversals before and ${fmt(afterTrips, 0)} after. At least ${minimumShare == null ? 'unavailable' : `${fmt(minimumShare * 100, 1)}%`} of selected published trips are retained each month. These are bus observations, not passengers or unique buses.</p>`;

    root.querySelector('[data-causal-bus-controls]').innerHTML = table(
      ['Control segment', 'Conditional change', 'Held-out pre-period RMS error', 'Mean pre-period forecast drift'],
      controls.map(([id, label]) => {
        const row = d.estimates.find(item => item.period === period && item.control === id);
        return [label, seconds(row?.did_seconds_over_treated_segment), row ? `${fmt(row.control_validation?.held_out_rmspe_seconds_treated_segment, 1)} sec` : 'Unavailable', seconds(row?.control_validation?.held_out_mean_drift_seconds_treated_segment)];
      })
    );
    const madisonSupport = d.monthly_panel.filter(row => row.period === period && row.support === 'primary12' && row.group === 'madison');
    const madisonMinimum = madisonSupport.length ? Math.min(...madisonSupport.map(row => row.matched_share)) : null;
    root.querySelector('[data-causal-bus-control-support]').textContent = `Madison’s stable M3/M4 basket retains at least ${madisonMinimum == null ? 'an unavailable share' : `${fmt(madisonMinimum * 100, 1)}%`} of the originally eligible published trips in any primary-window month; M1 is excluded when its timepoint changes. Matching does not establish a valid counterfactual.`;
    const figure = root.querySelector('[data-causal-bus-figure]');
    figure.src = asset(`third-avenue-event-${period}.svg`);
    figure.alt = `${periods[period]}: monthly fixed-weight Third Avenue and Lexington bus times in 2023–2024, plus treated-control gaps for Lexington, First and Madison. July–December 2023 construction is shaded; January–June 2024 is the primary after period. Pre-period differences limit causal interpretation.`;
  }
  const control = root.querySelector('#causal-bus-period');
  control.addEventListener('change', () => {period = control.value; renderSelection();});
  renderSelection();
}
