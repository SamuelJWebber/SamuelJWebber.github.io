import {esc, sign} from './research-view.mjs';
import {projectResult} from './core.mjs';

const base = 'research/scorecards/';
const outcomes = [
  ['flow','People per hour','At a fixed counting boundary, by direction.'],
  ['time','Minutes per comparable journey','Door to door, including access, waits and transfers.'],
  ['minutes','Total person-minutes','Sum of complete journey minutes; report trip counts too.']
];
const badge = (type,label) => `<span class="score-badge score-${type}">${esc(label)}</span>`;
const statuses = {measured:'Measured inputs',modeled:'Modeled / partial',missing:'Missing'};
const rawFlow = (id,before,after) => {
  const r=projectResult(id,'pm',before,after,1.3,1.3);
  return `${sign(r.net,0)} people/h`;
};

export const projectScorecards = [
  {
    id:'prospect',name:'Prospect Park West',subtitle:'2010 · three moving lanes → two',
    flow:{type:'modeled',value:'−40 to +86 people/h',detail:'Evening street-count scenario after separately accounting for the B69. Requires stable 1.3-person non-B69 motor occupancy and transferred historical bus loads. This range is not a confidence interval.'},
    time:{type:'missing',value:'Complete journeys missing',detail:'Measured driving segment: controlled changes from −36 to +11 seconds across comparison streets, 7 a.m.–7 p.m. Only two weekdays before and two after; these do not represent every traveler’s trip.'},
    minutes:{type:'missing',value:'Not identified',detail:'No contemporaneous traveler weights or complete journey times for the affected network. Hypothetical fixed-drive totals remain scenarios.'},
    blockers:['Bicycle and vehicle observations use different sites and dates.','B69 relocation changes passenger flow on PPW and nearby streets.','Parallel streets had concurrent changes; the comparison cannot isolate the lane.'],
    next:'Obtain retained synchronized passenger counts and B69 load/reroute records. If these were never collected, retain the conditional result rather than filling the gap with assumed riders.',
    links:[['Passenger and driving tests','?evidence=causal&causal=flow#evidence'],['DOT raw counts and timed runs','https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf']]
  },
  {
    id:'third',name:'Third Avenue',subtitle:'2023 · combined bus, bike and street redesign',
    flow:{type:'modeled',value:rawFlow('third',2022,2024),detail:'Motor occupants + bus riders at E60th Street, 2022→2024, 16:00–19:00. Source occupancy estimates are included. Cycling is observed at E50th, outside the project; walking is missing at the motor boundary.'},
    time:{type:'missing',value:'Complete journeys missing',detail:'Measured bus segment: −28 seconds relative to Lexington, while the pre-period placebo is +52 seconds. Run-weighted time over E67th–E97th is not passenger-weighted door-to-door time.'},
    minutes:{type:'missing',value:'Loads and whole trips missing',detail:'Bus runs cannot supply passenger-minutes without segment loads. Add access, waits, transfers and other modes before evaluating the complete network.'},
    blockers:['Bus and bike lanes, intersection work and signal changes form one package.','The primary comparison fails a reassuring pre-period stability check.','Motor and bicycle counts do not share a boundary; bus onboard loads remain missing.','Route-level bus fare entries were already falling against other Upper East Side routes before construction, so they cannot show a package effect either.'],
    next:'Use staged DOT and MTA records to verify treatment dates, timepoint continuity, bus loads and an eligible longer comparison history. Estimate the combined redesign unless its components can be separated.',
    links:[['Controlled bus analysis','?evidence=causal&causal=bus#evidence'],['MTA timepoint data','https://data.ny.gov/d/58t6-89vi'],['DOT project completion','https://www.nyc.gov/html/dot/html/pr2023/completion-safety-project-third-ave.shtml'],['Route ridership check','research/third-avenue-ridership/README.txt']]
  },
  {
    id:'pulaski',name:'Pulaski / McGuinness approach',subtitle:'2015–16 construction · detector and bridge are different locations',
    flow:{type:'missing',value:'Vehicles ≠ people',detail:'Continuous directional vehicle counts at station 021284 support motor-volume comparisons. Occupancy, aligned bicycle counts and the bridge screenline are not supplied by that detector.'},
    time:{type:'missing',value:'Complete journeys missing',detail:'A motor-count record contains no elapsed journey time. Available Citi Bike records cannot reconstruct every private-bike, motor or transit traveler’s door-to-door trip.'},
    minutes:{type:'missing',value:'Not identified',detail:'Neither all-mode traveler weights nor complete time observations are aligned to a verified permanent lane-closure date.'},
    blockers:['Junctions between the detector and Pulaski Bridge allow entries, exits and diversion.','Permanent motor-lane closure timing and detector continuity need agency confirmation.','The automatic bridge bicycle series begins after conversion; the Bronx donor roads have incomplete common coverage.'],
    next:'Verify station coordinates, direction codes, lane channels and quality logs before treating the motor series as continuous. Use shared calendar cells and present each direction separately.',
    links:[['Directional and hourly counts','?workbench=directions#workbench'],['Earlier motor-count diagnostics','?evidence=causal&causal=road#evidence'],['NYSDOT traffic-data repository','https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb']]
  },
  {
    id:'brooklyn',name:'Brooklyn Bridge',subtitle:'2021 · Manhattan-bound moving lane → two-way bikeway',
    flow:{type:'modeled',value:rawFlow('brooklyn',2018,2024),detail:'Representative evening profile, 2018→2024, both directions: motor occupants, cyclists and pedestrians. Motor occupancy is estimated by the source; the mode surveys are not synchronized.'},
    time:{type:'missing',value:'Complete journeys missing',detail:'Fixed-station Citi Bike trips and borough-level commute surveys supply separate context. They do not follow the same affected travelers before and after the conversion.'},
    minutes:{type:'missing',value:'Lane effect not identified',detail:'Survey-weighted usual-commute minutes can describe the borough pair. A changing number and mix of commuters prevents interpreting their total as daily minutes saved by the lane.'},
    blockers:['The intervention coincides with pandemic-era commuting changes.','Neighboring bridges can receive diverted travelers and have different pre-trends.','Subway, tunnel and ferry totals broaden the boundary but do not identify individual switches.'],
    next:'Keep bridge, three-bridge and wider sector boundaries visible. Obtain aligned modal dates and a credible comparison design; do not infer a driver→subway transition from aggregate ridership changes.',
    links:[['Bridge counts and benchmarks','#trends'],['Rail, tunnels and commute context','#commutes'],['NYMTC source reports','https://www.nymtc.org/hub-bound-travel']]
  },
  {
    id:'amsterdam',name:'Tenth / Amsterdam Avenue',subtitle:'2019 · full-time moving lane → protected bikeway',
    flow:{type:'modeled',value:rawFlow('amsterdam',2018,2019),detail:'Northbound motor occupants + bus riders at W60th Street, 2018→2019, 16:00–19:00. The first comparison predates the pandemic. Aligned cycling and walking at this crossing are absent.'},
    time:{type:'missing',value:'Complete journeys missing',detail:'No matched all-mode complete journey panel establishes travel time changes caused by this conversion.'},
    minutes:{type:'missing',value:'Not identified',detail:'The motor-and-bus subtotal cannot be multiplied by an unrelated citywide or modal average to produce a defensible network time burden.'},
    blockers:['Cycling is counted at W50th Street, south of the original project section.','Walking at the motor boundary and comparable whole trips are missing.','Later comparisons add pandemic changes and a 2023 bikeway extension through the bicycle count site.'],
    next:'Prioritize the 2018→2019 window, verify count dates and obtain a comparable untreated corridor. Add contemporaneous cycling and walking at W60th before reporting all-mode flow.',
    links:[['Project explorer','?project=amsterdam#projects'],['DOT design drawings','https://www.nyc.gov/html/dot/downloads/pdf/amsterdam-10th-ave-june2018.pdf'],['NYMTC source reports','https://www.nymtc.org/hub-bound-travel']]
  }
];

function safeLink([label,url]) { return `<a href="${esc(url)}"${url.startsWith('https:')?' target="_blank" rel="noopener"':''}>${esc(label)}</a>`; }

export async function renderProjectScorecards(root) {
  if(!root) return;
  const requested=new URL(location.href).searchParams.get('scorecard');
  let selected=projectScorecards.find(d=>d.id===requested)||projectScorecards[0];
  root.innerHTML=`<article class="research-card score-intro"><div class="score-intro-top"><div><div class="minilabel">Five projects · three separate outcomes</div><h3>What is measured, and what is still missing?</h3></div><label for="score-project">Project<select id="score-project">${projectScorecards.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></label></div><p>These cards separate the available evidence from the all-mode causal question. A source count or modeled subtotal can be useful while the effect of the conversion remains unresolved.</p><div class="score-key">${badge('measured','Measured inputs')}${badge('modeled','Modeled / partial')}${badge('missing','Missing')}<span>Labels describe coverage, not whether a lane helped or harmed.</span></div><div id="score-project-content" aria-live="polite"></div></article>
  <article class="research-card score-roadmap"><div class="minilabel">How the next evidence changes the answer</div><h3>A claim must pass four gates</h3><details class="score-protocol-details"><summary>Measurement, comparison and records roadmap</summary><div class="score-gates">${[
    ['1','Verify the intervention','Fix the lane-closure date, geography and simultaneous changes.'],
    ['2','Align the measurement','Same boundary, direction, hours and dates; count passengers once.'],
    ['3','Validate the comparison','Reserve pre-period months and test donor stability and spillovers.'],
    ['4','Evaluate all three outcomes','Throughput, complete journey time and total minutes with trip counts.']
  ].map(([n,title,detail])=>`<div><span class="score-gate-number">${n}</span><h4>${title}</h4><p>${detail}</p></div>`).join('')}</div><p class="score-gate-note">Failure at a gate changes the claim: retain descriptive observations, show justified sensitivity and name what is missing. More rows from the same flawed comparison do not repair the design.</p><details><summary>Concrete protocol for a stronger study</summary><p>Choose a defined traveler population and network boundary before a forthcoming conversion. Record synchronized counts on the treated street, parallel routes and transit crossings; repeat complete journeys with stable origin, destination, purpose and departure strata. Preserve switchers in the comparison and report newly enabled and forgone trips separately.</p><p>Seek two seasonal cycles of usable prehistory where feasible and a full post cycle. Those durations are planning targets, not a guarantee of identification: set the collection plan from baseline variance, temporal dependence, missingness and a prespecified meaningful effect. Reserve contiguous pre-period blocks for validation. Publish every eligible control and prespecified window; never select the favorable post-treatment estimate.</p><p>For many conversions, verify actual moving-lane removal independently of a protected-lane inventory. Estimate project-specific effects and aggregate with prespecified population weights. Use timing-aware comparisons that do not treat already exposed projects as untreated controls; account for corridor-level dependence. A few corridors can still leave broad uncertainty.</p><p>This extends analyses already viewed. It is a proposed protocol for future collection and newly acquired records, not a retroactive preregistration.</p></details>
  <div class="score-request-status" id="score-request-status"><h4>Records requests</h4><p class="small">Loading current request status… <a href="research/request-status.json">View status record</a></p></div></details><div class="research-downloads"><a class="btn" href="${base}measurement-protocol.txt" download>Study protocol</a><a class="btn" href="${base}measurement-data-contract.csv" download>Required fields · CSV</a><a class="btn" href="${base}project-scorecards.json" download>Project scorecards · JSON</a></div></article>`;
  const draw=()=>{
    root.querySelector('#score-project-content').innerHTML=`<div class="score-selected"><h4>${esc(selected.name)}</h4><p>${esc(selected.subtitle)}</p></div><div class="score-outcomes">${outcomes.map(([key,title,definition])=>{const d=selected[key];return `<section class="score-outcome" aria-label="${esc(title)}"><div class="score-outcome-top">${badge(d.type,statuses[d.type])}</div><h4>${title}</h4><p class="score-definition">${definition}</p><strong class="score-value">${esc(d.value)}</strong><p>${esc(d.detail)}</p></section>`;}).join('')}</div><div class="score-action"><div><h4>What blocks the causal claim?</h4><ul>${selected.blockers.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></div><div><h4>Most useful next evidence</h4><p>${esc(selected.next)}</p><p class="score-links">${selected.links.map(safeLink).join(' · ')}</p></div></div><p class="score-footnote">${selected.id==='prospect'?'The displayed flow interval is rounded from −39.7 to +86.4 people/h under explicit assumptions.':selected.id==='third'||selected.id==='brooklyn'||selected.id==='amsterdam'?'Displayed flow is a raw change in the stated partial/profile measure; it is not an estimate of the lane’s causal effect.':'Vehicle totals measure detector use, not road capacity or the number of unique people in the network.'} None of these cards identifies a citywide average effect.</p>`;
  };
  const select=root.querySelector('#score-project');select.value=selected.id;
  select.addEventListener('change',()=>{selected=projectScorecards.find(d=>d.id===select.value);draw();const u=new URL(location.href);u.searchParams.set('scorecard',selected.id);history.replaceState(null,'',u);});
  draw();
  try {
    const response=await fetch(new URL('research/request-status.json',import.meta.url));
    if(!response.ok) throw new Error(`Request status: ${response.status}`);
    const status=await response.json();
    const labels={sent:'Sent',acknowledged:'Acknowledged',not_accepted_by_email:'Not accepted by email',prepared_submission_pending:'Prepared, not submitted',draft_not_sent:'Draft, not sent'};
    const initial=status.requests.filter(d=>['A1','B1','C'].includes(d.id));
    const detail=d=>d.status_note?esc(d.status_note):(d.status==='sent'?(d.agency_receipt_verified?'Agency receipt verified.':'Agency acknowledgment and case number not yet verified.'):'Account setup and submission remain pending.');
    root.querySelector('#score-request-status').innerHTML=`<h4>Records requests · ${esc(status.updated_date)}</h4><ul>${initial.map(d=>`<li><b>${esc(d.agency)} ${esc(d.id)} — ${esc(labels[d.status]||d.status)}${d.case_number?` (${esc(d.case_number)})`:''}.</b> ${detail(d)}</li>`).join('')}</ul><p class="small">${status.fees_authorized?'Fees authorized as recorded in the status file.':'No fees authorized.'} <a href="research/request-status.json">Current status, including follow-up drafts</a></p>`;
  } catch {
    root.querySelector('#score-request-status').innerHTML='<h4>Records requests</h4><p>Current status could not load. <a href="research/request-status.json">Open the status record</a>.</p>';
  }
}
