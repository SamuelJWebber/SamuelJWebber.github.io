const format = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits}) : '—';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const subsets = [
  ['all_resident_journeys', 'All resident journeys'],
  ['both_endpoints_nyc', 'Start and end in NYC'],
  ['manhattan_origin', 'Start in Manhattan'],
  ['home_work_commute', 'Direct home–work journeys'],
  ['other_purposes', 'All other purposes']
];
const labels = {1:'Walking', 2:'Bicycle / e-bike', 8:'Car', 13:'Transit', 6:'App ride-hail'};
const link = (label, url) => `<a href="${escape(url)}" target="_blank" rel="noopener">${escape(label)}</a>`;
const table = (head, rows) => `<div class="over-scroll"><table><thead><tr>${head.map(x=>`<th scope="col">${escape(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((x,i)=>i?`<td>${escape(x)}</td>`:`<th scope="row">${escape(x)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;

export async function renderSurveyEvidence(rootSelector = '#survey-evidence') {
  const root = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;
  if (!root) return;
  root.innerHTML = '<p>Loading the all-purpose travel survey…</p>';
  let data;
  try {
    const response = await fetch('research/new/survey-analysis.json');
    if (!response.ok) throw new Error(`Survey data: ${response.status}`);
    data = await response.json();
  } catch (error) {
    root.innerHTML = '<p>The survey results could not load. <a href="research/new/survey-analysis.json">Open the analysis file</a>.</p>';
    return;
  }
  const state = {subset:'all_resident_journeys', allowance:0};
  const guide = 'https://www.nyc.gov/html/dot/downloads/pdf/2024-cms-user-guide.pdf';
  root.innerHTML = `<article class="journey-card survey-card">
    <div class="minilabel">All-purpose travel · NYC resident adults · 2024 survey</div>
    <h3>Travel beyond the commute</h3>
    <p>Shopping, visits, errands and other journeys belong in the travel mix. This reconstruction follows adult NYC residents across every purpose, including their trips outside the city.</p><p class="research-verdict"><strong>Independent reconstruction.</strong> These linked-journey estimates do not exactly reproduce DOT’s published modal split. The filter and grouping difference remains unresolved; the official figures and exclusions are disclosed below.</p>
    <div class="cross-controls survey-controls"><label>Journey population<select data-survey-subset>${subsets.filter(([key])=>data.subsets[key]).map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select></label>
    <label>Illustrative missing transit time<select data-survey-allowance>${[0,5,10,15].map(n=>`<option value="${n}">${n ? `Add ${n} minutes per affected journey` : 'Recorded time only'}</option>`).join('')}</select></label></div>
    <div data-survey-result aria-live="polite"></div><div class="research-downloads"><a class="btn" href="research/new/subset-mode-summary.csv" download>All subsets · CSV</a><a class="btn" href="research/new/survey-methods.md" download>Methods</a><a class="btn" href="research/new/survey-reproducibility.zip" download>Survey inputs + code · ZIP</a></div>
    <details class="audit-detail"><summary>Population, exclusions and how the calculation works</summary>
      <p>NYC resident adults aged 18+ in the survey's household frame. Nonresident commuters and visitors, children, commercial and delivery travel, and group quarters outside the frame are excluded. These are field-period estimates. A Manhattan origin still covers NYC residents only.</p>
      ${table(['Selection step','Sample journeys'], data.filters.sequential_attrition.map(r=>[r.stage,format(r.n,0)]))}
      <p>${format(data.filters.raw_trip_leg_rows,0)} trip-stage rows become ${format(data.filters.raw_linked_journeys,0)} linked journeys. A transit journey is counted once across its walking and transit stages. The baseline uses one positive citywide trip weight and excludes ${format(data.filters.complete_adult_inconsistent_weight_journeys,0)} complete-day journeys with unequal stage weights; it retains ${format(data.filters.baseline_weight_coverage_vs_max_ambiguous_weight_pct,2)}% of potential weight when those excluded journeys receive their largest stage weight. Unknown main modes stay in the denominator.</p>
      <p>Main mode is the highest valid broad mode code across a journey's stages, extending the guide's priority rule. “Car” is the survey group and can include motorcycles or mopeds. Taxi, app ride-hail and car share appear separately. Direct home–work means a home and work endpoint; chained errands and work-related trips fall in other purposes.</p>
      <p>Elapsed time runs from the first departure to the last arrival, including recorded gaps between stages. Survey timestamps can contain departure-time imputation. Synthetic access or exit stages have missing duration and copied boundary timestamps: recorded elapsed time omits their unknown time. The allowance adds a total of 5, 10 or 15 minutes once per affected Transit journey; it is an assumption, not an estimated correction. It does not fill missing time in other modes.</p>
      <p>The separate Day table includes ${format(data.weighted_day_denominator.sample_zero_trip_days,0)} zero-trip days. Weighted linked journeys average ${format(data.weighted_day_denominator.linked_journeys_per_resident_per_day,2)} per resident adult per day. Party size is not multiplied into person-trip weights. Survey responses are correlated within each diarist; no design-based confidence intervals are shown.</p>
      <p><strong>Independent estimate:</strong> this reconstruction does not exactly reproduce DOT's published city-to-city headline. The report gives 37.6% walking, 20.7% transit, 2.9% bike/micromobility and 38.5% car using broader groups. Its full filter and recoding recipe is unspecified; the difference remains unresolved.</p>
      <p class="refline">${link('DOT trip data','https://data.cityofnewyork.us/d/wgnh-qwsg')} · ${link('User guide',guide)} · ${link('Published report','https://www.nyc.gov/html/dot/downloads/pdf/2024-cms-report.pdf#page=9')} · <a href="research/new/survey-analysis.json" download>Full analysis JSON</a></p>
    </details>
  </article>`;

  function render() {
    const subset = data.subsets[state.subset];
    const rows = subset.mode_summary;
    const transit = rows.find(r=>r.mode_code===13);
    const affectedWeight = transit?.weighted_missing_time_journeys || 0;
    const extraTotal = affectedWeight*state.allowance;
    const capturedTotal = rows.reduce((sum,r)=>sum+r.weighted_observed_person_minutes,0);
    const weightedMissing = rows.reduce((sum,r)=>sum+r.weighted_missing_time_journeys,0);
    const bars = [1,8,13,2,6].map(code=>({label:labels[code],share:rows.find(r=>r.mode_code===code)?.trip_share_pct || 0}));
    bars.push({label:'Other modes / unknown',share:Math.max(0,100-bars.reduce((s,r)=>s+r.share,0))});
    bars.sort((a,b)=>b.share-a.share);
    const timeRows = rows.filter(r=>[1,2,8,13].includes(r.mode_code)).map(r=>{
      const added = r.mode_code===13 ? state.allowance*r.weighted_missing_time_journeys/r.weighted_daily_journeys : 0;
      const minutes = r.weighted_observed_person_minutes+(r.mode_code===13 ? extraTotal : 0);
      return [labels[r.mode_code], `${format(r.observed_mean_minutes+added)} min`, `${format(r.observed_median_minutes)} min`, `${format(r.missing_time_weight_share_pct)}%`, `${format(100*minutes/(capturedTotal+extraTotal))}%`];
    });
    const detailRows = rows.map(r=>[r.mode,format(r.sample_journeys,0),`${format(r.trip_share_pct,2)}%`,`${format(r.observed_0_to_240min_mean_minutes)} min`,`${format(r.observed_0_to_240min_weight_share_pct)}%`,`${format(r.complete_leg_duration_weight_share_pct)}%`]);
    const isCommute = state.subset==='home_work_commute';
    const subway = state.subset==='all_resident_journeys' ? `<p class="comparison-note">At least one explicitly stated NYC subway stage appears in <strong>${format(data.subway_indicator.share_of_all_journeys_pct)}% of all journeys</strong>. This overlaps Transit; it is not an additional mode share.</p>` : '';
    root.querySelector('[data-survey-result]').innerHTML = `
      <p class="comparison-note"><strong>${format(subset.sample_journeys,0)} sampled journeys from ${format(subset.sample_people,0)} diarists</strong> represent about ${format(subset.weighted_daily_journeys/1e6,2)} million daily resident journeys in this selection. ${isCommute ? 'This narrow definition excludes commutes chained with errands or other stops.' : ''}</p>
      <figure class="survey-mode-chart"><figcaption>Weighted main-mode share · one count per linked journey</figcaption>${bars.map(r=>`<div class="rail-spark survey-mode-row"><span>${escape(r.label)}</span><div aria-hidden="true"><i style="width:${r.share}%"></i></div><b>${format(r.share)}%</b></div>`).join('')}</figure>
      ${subway}
      <h4>Recorded travel time has gaps</h4>
      <p>${format(100*weightedMissing/subset.weighted_daily_journeys)}% of weighted journeys have a synthetic stage with missing time${transit ? `, including <strong>${format(transit.missing_time_weight_share_pct)}% of Transit journeys</strong>` : ''}. The mode shares retain these journeys. Recorded time is not fully measured door-to-door time.</p>
      ${table(['Mode',state.allowance ? 'Mean + assumed missing time' : 'Recorded mean · uncapped','Recorded median','Journeys missing time',state.allowance ? 'Share of captured + assumed minutes' : 'Share of captured minutes'],timeRows)}
      <p class="research-verdict"><strong>Long-duration sensitivity:</strong> restricting recorded elapsed time to 0–240 minutes changes the unadjusted means to ${rows.filter(r=>[1,2,8,13].includes(r.mode_code)).map(r=>`${labels[r.mode_code]} ${format(r.observed_0_to_240min_mean_minutes)} min`).join('; ')}. This removes long records rather than correcting them. It changes the sample and still leaves unknown access time.</p>
      <p class="comparison-note">${state.allowance ? `The ${state.allowance}-minute allowance adds ${format(extraTotal/1e6,2)} million assumed person-minutes in this selection. Recorded medians and mode shares stay unchanged; the allowance is applied only to the displayed mean and minute share.` : 'Minute shares describe captured time, not the true division of all travel time.'} Different distances, purposes and travelers prevent these averages from estimating the time saved by switching modes or installing a lane.</p>
      <details class="audit-detail"><summary>Inspect all modes and duration sensitivity</summary>
      ${table(['Mode','Sample journeys','Trip share','Mean with 0–240 min restriction','Weight retained by restriction','All leg durations present'],detailRows)}
      <p>Uncapped means above include long outliers. The 0–240 minute restriction is a sensitivity check, not a claim that longer trips are invalid. The last column reports nonmissing leg-duration coverage. Complete-leg cases select a different transit sample; they do not correct missing time.</p></details>`;
  }
  root.querySelector('[data-survey-subset]').addEventListener('change', event=>{state.subset=event.target.value;render();});
  root.querySelector('[data-survey-allowance]').addEventListener('change', event=>{state.allowance=Number(event.target.value);render();});
  render();
}
