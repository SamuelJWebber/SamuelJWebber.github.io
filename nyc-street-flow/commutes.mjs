import {bridgeData, periods} from './core.mjs';
import {acs, boroughDifference} from './acs.mjs';
import {sector, sectorSources} from './sector.mjs';
import {railFields, railRows} from './rail.mjs';
import {commuteModes, crossingCounts, drivePeriods, drives, travelerGroups,
  defaultTrips, parseTrips, serializeTrips, tripBudget} from './commute-math.mjs';

const $ = selector => document.querySelector(selector);
const num = (v, places=0) => v.toLocaleString('en-US', {minimumFractionDigits:places, maximumFractionDigits:places});
const signed = (v, places=0) => (Math.abs(v) < 0.5 * 10 ** -places ? '' : v < 0 ? '−' : '+') + num(Math.abs(v), places);
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const markupOptions = entries => entries.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
const external = (label, url) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
const census = y => `https://www2.census.gov/programs-surveys/acs/data/pums/${y}/1-Year/csv_pny.zip`;
const links = {
  pums:external('Census methods', 'https://www.census.gov/programs-surveys/acs/microdata/documentation.2024.html'),
  hub:external('NYMTC annual reports', 'https://www.nymtc.org/hub-bound-travel'),
  walkers:external('NYC DOT pedestrian counts', 'https://data.cityofnewyork.us/Transportation/Bi-Annual-Pedestrian-Counts/cqsj-cfgu'),
  drives:external('DOT timed runs, p. 51', 'https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf#page=51'),
  bus:external('MTA bus timepoint data', 'https://data.ny.gov/d/58t6-89vi'),
  design:external('Third Avenue project', 'https://www.nyc.gov/html/dot/html/pr2023/3rd-ave-redesign.shtml')
};
const groups = {all:'All modes', subway:'Subway / elevated', auto:'Car, truck or van', bus:'Bus', bike:'Bicycle', near:'Downtown Brooklyn / Fort Greene · all modes', queens:'Queens to Manhattan · all modes'};
const state = {peak:'pm', from:2018, to:2024, road:'day', trips:parseTrips('')};
export function writeCommuteParams(params) {
  if (state.peak !== 'pm') params.set('crosspeak', state.peak);
  if (state.from !== 2018) params.set('crossfrom', state.from);
  if (state.to !== 2024) params.set('crossto', state.to);
  if (state.road !== 'day') params.set('driveperiod', state.road);
  const encoded = serializeTrips(state.trips);
  if (encoded !== serializeTrips(defaultTrips)) params.set('trips', encoded);
}

function observedCommutes(table) {
  const a = acs.all[2019], b = acs.all[2024];
  const rows = Object.keys(groups).map(k => {
    const first = acs[k][2019], last = acs[k][2024], diff = last.mean - first.mean;
    const moe = Math.hypot(first.moe, last.moe);
    return [groups[k], num(first.mean,1), num(last.mean,1), signed(diff,1), `${signed(diff - moe,1)} to ${signed(diff + moe,1)}`];
  });
  return `<article class="journey-lead"><div class="minilabel">Observed commute · Brooklyn residents working in Manhattan</div>
    <div class="journey-summary"><div><h3>A shorter average trip to work</h3><p>Workers reported their usual one-way travel time, taking any route or mode. The surveys cover the same borough pair in each year.</p></div>
    <div class="paired-time"><div><b>${num(a.mean,1)}</b><span>minutes · 2019</span></div><i aria-hidden="true">→</i><div><b>${num(b.mean,1)}</b><span>minutes · 2024</span></div></div></div>
    <p class="finding"><strong>${num(a.mean-b.mean,1)} minutes shorter per commute</strong> (90% interval, 0.9 to 2.8 minutes shorter). That is about ${num((a.mean-b.mean)*100)} fewer person-minutes per 100 commutes at the two observed averages. The travelers and workplaces within each borough could differ across years.</p>
    <p class="comparison-note"><strong>How did Queens compare?</strong> Queens residents working in Manhattan went from ${num(acs.queens[2019].mean,1)} to ${num(acs.queens[2024].mean,1)} minutes. Brooklyn’s commute shortened by ${num(-boroughDifference.estimate,1)} minutes more, but the 90% interval ranges from ${num(-boroughDifference.ci90[0],1)} minutes more improvement to ${num(boroughDifference.ci90[1],1)} minutes less. This comparison cannot separate a lane effect from borough-wide travel changes.</p>
    <p class="comparison-note"><strong>Did drivers switch to the subway?</strong> Subway or elevated rail was the primary mode for ${num(100*acs.subway[2019].people/a.people,1)}% of these Brooklyn commuters in 2019 and ${num(100*acs.subway[2024].people/b.people,1)}% in 2024. The two samples do not tell us who switched.</p>
    <details class="audit-detail"><summary>Compare modes, sample sizes and total minutes</summary><div class="over-scroll">${table(rows,['Usual travel mode or area','2019 · min','2024 · min','Change · min','90% interval for change'])}</div>
    <p>Each mode row covers Brooklyn residents who used that primary mode in a given year. The Downtown Brooklyn / Fort Greene row restricts residence to the community district near the bridges. Its change is consistent with either a shorter or a longer commute. Other modes remain in the all-mode estimate.</p>
    <p>The ${num(a.n)} and ${num(b.n)} survey responses represent about ${num(a.people)} and ${num(b.people)} commuters. Giving each commuter one usual trip produces ${num(a.personMinutes/1e6,2)} million and ${num(b.personMinutes/1e6,2)} million person-minutes. Fewer people traveled to Manhattan for work in the later sample. The survey does not record each week’s commuting days, so these totals cannot yield daily time savings.</p>
    <p>ACS 1-year public-use person records, age 16+, with a reported journey to work. Means use person weights, sampling margins use all 80 replicate weights and the change treats annual samples as independent. People working from home are excluded. The survey has no bridge used, prior mode or individual before/after link.</p>
    <p class="refline">${external('2019 New York person file',census(2019))} · ${external('2024 New York person file',census(2024))} · ${links.pums} · <a download href="methods/od_commutes.py">Calculation script</a></p>
    <button type="button" class="btn" id="download-acs">↓ Commute estimates CSV</button></details></article>`;
}

function sectorComparison() {
  const [a,b] = [state.from,state.to].map(year => sector.find(r=>r.year === year && r.period === state.peak));
  const sources = [a,b].map(r => external(String(r.year)+' sector tables',sectorSources[r.year].in)).join(' · ');
  return `<div class="wide-sector"><div class="minilabel">Wider boundary · Brooklyn sector</div><h4>Include the tunnels and ferries</h4>
    <p><strong>${num(a.allBoth/a.hours)} → ${num(b.allBoth/b.hours)} crossings per hour (${signed((b.allBoth/a.allBoth-1)*100,1)}%)</strong> over the same years and hours. This count includes the three bridges, six subway tunnels, the Hugh L. Carey road tunnel and the sector’s ferries. Each mode crosses the boundary once. Bridge walking is added once from DOT’s counts.</p><p class="refline">${sources} · ${links.walkers}</p></div>`;
}

function renderCrossings(table) {
  const a = crossingCounts(state.from,state.peak), b = crossingCounts(state.to,state.peak), h = a.hours;
  const totalDiff = b.total - a.total, railDiff = b.rail - a.rail;
  const decline = totalDiff < 0 && railDiff < 0 && Math.abs(railDiff) <= Math.abs(totalDiff);
  const pct = (b.total/a.total-1)*100;
  const byMode = [...commuteModes, ['total','All five modes']].map(([k,label]) => [label,num(a[k]/h),num(b[k]/h),signed((b[k]-a[k])/h)]);
  const years = bridgeData.years.map(y => crossingCounts(y,state.peak));
  const ceiling = Math.ceil(Math.max(...years.map(r => r.total/h))/10000)*10000;
  $('#crossing-result').innerHTML = `<div class="cross-visual"><div><div class="minilabel">Three bridges combined · both directions</div><h4>${num(a.total/h)} → ${num(b.total/h)} <small>people / hour</small></h4><p>${state.from} to ${state.to} · ${periods[state.peak].text} · ${num(Math.abs(pct),1)}% ${pct < 0 ? 'fewer' : 'more'} crossings. ${decline ? `About ${num(100*railDiff/totalDiff)}% of the decline came from fewer subway passengers crossing on the Manhattan and Williamsburg bridges.` : `Subway crossings changed by ${signed(railDiff/h)} riders per hour.`}</p></div>
    <figure class="rail-history"><figcaption>People per hour across the three bridges</figcaption>${years.map(r => `<div class="rail-spark"><span>${r.year}</span><div aria-hidden="true"><i style="width:${r.total/h/ceiling*100}%"></i></div><b>${num(r.total/h)}</b></div>`).join('')}</figure></div>
    <div class="over-scroll">${table(byMode,['Travel mode',`${state.from} / hour`,`${state.to} / hour`,'Change / hour'])}</div>
    ${sectorComparison()}
    <details class="audit-detail"><summary>Which crossings and people count here?</summary><p>The Brooklyn Bridge carries no subway. Add both subway service columns on the Manhattan Bridge and the subway and scheduled buses on the Williamsburg Bridge. Count non-bus motor occupants, cyclists and pedestrians across all three. These counts include trips for every purpose, in both directions. The commute survey above instead follows the home-to-work direction and covers workplaces anywhere in Manhattan. Neither source links the same travelers over time. The comparison spans pandemic disruptions and changes in working from home.</p>
    <p>NYMTC supplies typical fall weekday profiles. Walking comes from DOT’s fall weekday samples, taken in September before 2019 and October after 2020, on dates that can differ from the other counts. Bridge totals are period sums divided by the number of hours. Rows round independently. Comparable walking surveys are missing in 2019 and 2020.</p>
    <p>Subway riders across all eight Brooklyn-sector rail crossings, including the six tunnels, averaged <strong>${num(a.sectorRail/h)} → ${num(b.sectorRail/h)} / hour</strong>. This larger rail count already contains both rail bridges.</p>
    <p class="refline">${links.hub} · ${links.walkers}</p></details>`;
}

function roadPanel(table) {
  const period = state.road;
  const rows = drives.map(d=>[d.route,clock(d[period][0]),clock(d[period][1]),signed(d[period][1]-d[period][0])+' s']);
  $('#drive-result').innerHTML = table(rows,['Route','Before','After','Change']);
}

function scenarioMarkup() {
  return `<div class="scenario-grid"><span class="scenario-blank" aria-hidden="true"></span><span>People</span><span>Without lane<br><small>min / trip</small></span><span>With lane<br><small>min / trip</small></span>
    ${travelerGroups.map((label,i)=>`<label class="s-group" for="trip-${i}-0">${label}</label>${state.trips[i].map((v,j)=>`<input type="number" id="trip-${i}-${j}" aria-label="${label}, ${['people','minutes without lane','minutes with lane'][j]}" min="0" max="${j ? 1440 : 1000000}" step="${j ? 'any' : 1}" value="${v}">`).join('')}`).join('')}</div>`;
}

function scenarioResult(sync, updateURL) {
  const rows = travelerGroups.map((_,i)=>[0,1,2].map(j=>$('#trip-'+i+'-'+j).valueAsNumber));
  const result = tripBudget(rows), target = $('#minutes-answer');
  $('#dl-scenario').disabled = !result?.people;
  if (!result) {
    target.textContent = 'Enter a whole number of people per group and a positive time (up to 1,440 minutes) for each trip a traveler takes. Fill unused rows with zeros.';
    return;
  }
  state.trips = rows;
  if (updateURL) sync();
  if (!result.people) { target.textContent='Add at least one traveler to compare completed commutes.'; return; }
  const {people, saved, without, withLane, changes} = result;
  const word = saved < 0 ? 'added' : 'saved';
  const offset = changes.reduce((n,c)=>n+Math.max(c,0),0), loss = -changes.reduce((n,c)=>n+Math.min(c,0),0);
  target.innerHTML = `<strong>${num(Math.abs(saved),Math.abs(saved)%1&&Math.abs(saved)<10?1:0)} person-minutes ${word}</strong><span>${num(people)} completed commutes · ${num(without/people,1)} → ${num(withLane/people,1)} min per trip</span><p>${num(offset,1)} minutes gained across travelers with shorter trips, offset by ${num(loss,1)} minutes for travelers with longer trips. Average ${num(Math.abs(saved/people),1)} minutes ${word} per trip.</p>`;
}

function panelLayout(table) {
  const years = (min, max) => markupOptions(bridgeData.years.filter(y=>y>=min && y<=max).map(y=>[y,String(y)]));
  return `${observedCommutes(table)}
    <article class="journey-card"><div class="minilabel">Observed crossings · Fall weekdays</div><h3>What changes when subway riders count?</h3>
    <div class="cross-controls"><label>Before conversion<select id="cross-from">${years(2016,2018)}</select></label><label>After conversion<select id="cross-to">${years(2021,2024)}</select></label><label>Counting window<select id="cross-peak"><option value="pm">Evening · 4–7 p.m.</option><option value="am">Morning · 7–9 a.m.</option></select></label></div>
    <div id="crossing-result"></div><div class="commute-downloads"><button class="btn" type="button" id="dl-cross">↓ Crossing comparisons CSV</button><button class="btn" type="button" id="dl-rails">↓ Hourly subway and bus counts CSV</button></div></article>
    <article class="journey-card"><div class="minilabel">Observed travel times · Individual street segments</div><h3>What happened to travel on the redesigned streets?</h3>
    <div class="route-evidence"><div><h4>Drivers on Prospect Park West</h4><p>After the 2010 conversion, the daytime drive from Union Street to 15th Street took <strong>2:47, down from 2:54</strong>. Seventh Avenue took 28 seconds longer. Across four nearby routes the mean stayed <strong>4:14</strong>.</p></div><div><h4>Bus riders on Third Avenue</h4><p>Morning buses took <strong>16:22 → 15:53</strong> northbound from East 67th to 97th. Farther south, East 23rd to 42nd was <strong>9:26 → 9:27</strong>. The Third Avenue project added both bus and bike lanes.</p></div></div>
    <details class="audit-detail"><summary>Inspect the time-of-day results and segment methods</summary><label class="drive-label">Prospect Park West driving period<select id="drive-period">${markupOptions(Object.entries(drivePeriods))}</select></label><div class="over-scroll" id="drive-result"></div>
    <p>DOT timed 48 drives per route per period across two weekdays, May 11–12 and October 19–20, 2010. The northbound streets run between the same cross streets in the reverse direction. Minutes:seconds are for the timed segment. The four-route mean gives the surveyed routes equal weight and does not weight by traveler volume. ${links.drives}.</p>
    <p>Bus means compare April–June 2023 with April–June 2024, Tuesday to Thursday, 7–10 a.m. For the M101 Limited, M102 Local and M103 Local, we hold the 2023 mix of route, month, weekday and hour fixed across 81 cells. The main segment had 1,522 then 1,407 bus runs, the southern comparison 1,618 then 1,490. The 1.47-mile segment extends one block beyond the project. The means weight bus runs, and omit waiting, access and egress. Signal timing also changed. ${links.bus} · ${links.design}.</p>
    <p class="refline">${external('MTA cells for the project segment',busDataUrl('402688','403777'))} · ${external('MTA cells for the southern segment',busDataUrl('403855','402679'))}</p><button class="btn" type="button" id="dl-drive">↓ Park Slope timed drives CSV</button></details></article>
    <article id="scenario" class="journey-card scenario"><div class="minilabel">Try a scenario · Illustrative assumptions</div><h3>Would a shift from car to subway save time?</h3><p>Give the same people the same destinations and departure times in both cases. Enter one-way door-to-door minutes, including walking, waiting, transfers, parking and docking. Count each traveler once, including other people affected by slower or faster service.</p>
    <div id="scenario-inputs">${scenarioMarkup()}</div><div class="scenario-answer" id="minutes-answer" aria-live="polite"></div>
    <div class="commute-downloads"><button class="smallbtn" id="reset-trips" type="button">Reset example</button><button class="btn" id="dl-scenario" type="button">↓ Scenario CSV</button></div>
    <details class="audit-detail"><summary>What would establish the time saved by a lane?</summary><p>Compare the same home-to-work journeys, departure periods and travel purposes with similar corridors that had no conversion. Check several pre-project years to see if their travel times moved together. Account for pandemic changes in commuting, transit schedules, weather, construction and congestion. Include people who changed routes, people who stayed in cars or on transit, and people who started cycling.</p><p>A repeat travel diary could record each person’s mode, trip frequency and door-to-door time. Use all-mode diaries to weight trips, then check route-specific times against traffic and transit records. Count new and forgone trips separately, so canceling a commute cannot masquerade as time saved. Public ACS records and bridge counts cannot identify individual switchers.</p><p class="refline">${external('NYC DOT Citywide Mobility Survey user guide','https://www.nyc.gov/html/dot/downloads/pdf/2024-cms-user-guide.pdf')}</p></details></article>`;
}

function busDataUrl(start, end) {
  const where = `direction='N' AND ((route_id='M101' AND route_type='Limited') OR (route_id IN ('M102','M103') AND route_type='Local')) AND month BETWEEN 4 AND 6 AND hour_of_day BETWEEN 7 AND 9 AND day_of_week IN ('Tuesday','Wednesday','Thursday') AND timepoint_stop_id='${start}' AND next_timepoint_stop_id='${end}'`;
  return 'https://data.ny.gov/resource/58t6-89vi.json?' + new URLSearchParams({'$where':where,'$limit':'5000'}).toString();
}

export function initCommutes({query, sync, download, countsTable, reports}) {
  if (query.get('crosspeak') === 'am') state.peak = 'am';
  if ([2016,2017,2018].includes(Number(query.get('crossfrom')))) state.from = Number(query.get('crossfrom'));
  if ([2021,2022,2023,2024].includes(Number(query.get('crossto')))) state.to = Number(query.get('crossto'));
  if (Object.hasOwn(drivePeriods,query.get('driveperiod'))) state.road = query.get('driveperiod');
  state.trips = parseTrips(query.get('trips'));
  $('#commute-panel').innerHTML = panelLayout(countsTable);
  const bind = (id, field, numeric, render) => {
    const el = $(id);
    el.value = state[field];
    el.onchange = () => { state[field] = numeric ? Number(el.value) : el.value; render(countsTable); sync(); };
  };
  bind('#cross-from','from',true,renderCrossings);
  bind('#cross-to','to',true,renderCrossings);
  bind('#cross-peak','peak',false,renderCrossings);
  bind('#drive-period','road',false,roadPanel);
  renderCrossings(countsTable);
  roadPanel(countsTable);
  scenarioResult(sync,false);
  $('#scenario-inputs').oninput = () => scenarioResult(sync,true);
  $('#reset-trips').onclick = () => {
    state.trips = parseTrips('');
    $('#scenario-inputs').innerHTML = scenarioMarkup();
    scenarioResult(sync,true);
  };
  $('#dl-scenario').onclick = () => {
    const b = tripBudget(state.trips);
    if (!b?.people) return;
    download('door-to-door-scenario.csv',['traveler_group','completed_trips','minutes_without_per_trip','minutes_with_per_trip','person_minutes_saved'],[...state.trips.map((r,i)=>[travelerGroups[i],...r,b.changes[i]]),['All travelers',b.people,b.without/b.people,b.withLane/b.people,b.saved]]);
  };
  $('#dl-rails').onclick = () => download('bridge-and-sector-transit-hours.csv',[...railFields,'source_report'],railRows.map(r=>[...r,reports[r[0]]]));
  $('#dl-cross').onclick = () => {
    const keys = ['motor','bike','walk','bus','rail','total','sectorRail'];
    const rows = sector.map(s => {
      const c = crossingCounts(s.year,s.period);
      return [s.year,s.period,s.hours,...keys.map(k=>c[k]),s.inExclWalk,s.outExclWalk,s.walkBoth,s.allBoth,sectorSources[s.year].in,sectorSources[s.year].out];
    });
    download('brooklyn-crossing-period-totals.csv',['year','window','hours','three_bridges_motor_occupants','three_bridges_cyclists','three_bridges_pedestrians','three_bridges_bus_riders','three_bridges_subway_riders','three_bridges_all_five_modes','whole_sector_subway_including_bridges','sector_in_excluding_walking','sector_out_excluding_walking','bridge_walking_both_directions','whole_sector_all_modes_including_walking','sector_in_source','sector_out_source'],rows);
  };
  $('#dl-drive').onclick = () => download('park-slope-timed-drives.csv',['route','window','before_seconds','after_seconds','change_seconds','source'],drives.flatMap(d=>Object.keys(drivePeriods).map(k=>[d.route,drivePeriods[k],...d[k],d[k][1]-d[k][0],'https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf#page=51'])));
  $('#download-acs').onclick = () => download('commute-time-estimates.csv',['home_area_and_mode','year','sample_records','weighted_commuters','commuters_90pct_moe','mean_one_way_minutes','minutes_90pct_moe','primary_mode_share_of_brooklyn_to_manhattan_commuters_if_applicable','person_minutes_one_usual_trip_each','source'],Object.keys(groups).flatMap(k=>[2019,2024].map(y=>{const r=acs[k][y];const label=['queens','near'].includes(k)?groups[k]:'Brooklyn to Manhattan · '+groups[k];return [label,y,r.n,r.people,r.peopleMoe,r.mean,r.moe,['subway','auto','bus','bike'].includes(k)?r.people/acs.all[y].people:null,r.personMinutes,census(y)];})));
}
