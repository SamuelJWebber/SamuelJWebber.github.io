import {esc} from './research-view.mjs';

const base=new URL('./research/global-study/',import.meta.url);
const array=value=>Array.isArray(value)?value:[];
const text=value=>value==null?'':Array.isArray(value)?value.join(' · '):String(value);
const numeric=value=>typeof value==='number'&&Number.isFinite(value);
const number=value=>numeric(value)?value.toLocaleString('en-US',{maximumFractionDigits:2}):text(value)||'Not available';
const change=value=>numeric(value)?`${value>0?'+':value<0?'−':''}${number(Math.abs(value))}`:text(value)||'Not available';
const outcomeLabel=value=>({flow:'Person / vehicle flow',time:'Speed / travel time',cycling:'Cycling activity'}[value]||text(value));
const caseOutcomes=c=>array(c.outcomes).map(String);
function url(value,relative=location.href){try{const u=new URL(value,relative);return ['https:','http:'].includes(u.protocol)?u:null;}catch{return null;}}
function link(label,value){const u=value&&url(value);return u?`<a href="${esc(u.href)}"${u.origin!==location.origin?' target="_blank" rel="noopener"':''}>${esc(label)}<span aria-hidden="true"> ↗</span></a>`:esc(label);}
function badge(value){return `<span class="world-badge">${esc(text(value)||'Evidence under review')}</span>`;}
function sync(values){const u=new URL(location.href);for(const [key,value] of Object.entries(values)){if(value)u.searchParams.set(key,value);else u.searchParams.delete(key);}history.replaceState(null,'',u);}
function pairedBars(c){
 const rows=array(c.rows);
 if(c.chart===false||!c.unit||!rows.length||!rows.every(r=>numeric(r.before)&&numeric(r.after)&&r.before>=0&&r.after>=0&&(!r.unit||r.unit===c.unit)))return '';
 const max=Math.max(...rows.flatMap(r=>[r.before,r.after]));if(max<=0)return '';
 return `<div class="world-bars" role="img" aria-label="${esc(c.title)}. Before and after values share the unit ${esc(c.unit)}. Exact values are in the following table."><div class="world-legend"><span><i class="world-before"></i>Before</span><span><i class="world-after"></i>After</span></div>${rows.map(r=>`<div class="world-bar-row"><span class="world-bar-label">${esc(r.label)}</span><div class="world-bar-pair"><div><i class="world-before" style="width:${r.before/max*100}%"></i><span>${esc(number(r.before))}</span></div><div><i class="world-after" style="width:${r.after/max*100}%"></i><span>${esc(number(r.after))}</span></div></div></div>`).join('')}</div>`;
}

const acquisitionLabels={downloaded_raw:'Raw records acquired',downloaded_table:'Published tables acquired',source_only:'Source located',blocked:'Access blocked',not_publicly_found:'Still missing'};
function acquisitionRecords(records,status=''){
 return records.filter(a=>!status||a.status===status).map(a=>`<details class="world-acq-record"><summary><span>${esc(a.city)}</span><b>${esc(a.dataset)}</b><em class="world-acq-status ${esc(a.status)}">${esc(acquisitionLabels[a.status]||a.status)}</em></summary><dl><div><dt>Coverage</dt><dd>${esc(text(a.coverage))}</dd></div><div><dt>Records acquired</dt><dd>${esc(typeof a.rows==='number'?number(a.rows):text(a.rows)||'Not acquired')}</dd></div><div><dt>What it supports</dt><dd>${esc(text(a.usable_for))}</dd></div><div><dt>Remaining limit</dt><dd>${esc(text(a.limitation))}</dd></div>${a.next_requirement?`<div><dt>Next requirement</dt><dd>${esc(text(a.next_requirement))}</dd></div>`:''}</dl><p class="small">${a.source_url?link('Official source',a.source_url):''}${a.bundle?' · '+link('Download acquired records and audit',new URL(a.bundle,base).href):''}</p></details>`).join('')||'<p>No datasets have this status.</p>';
}
function acquisitionPanel(a){
 if(!a||!array(a.records).length)return '';
 const records=array(a.records);
 return `<article class="research-card world-acquisition" aria-labelledby="world-acq-title"><div class="minilabel">Acquisition audit · ${esc(a.checked_on)}</div><h3 id="world-acq-title">Which data have we actually downloaded?</h3><p>${esc(a.summary)}</p><div class="world-acq-totals">${Object.entries(acquisitionLabels).map(([k,v])=>`<div><strong>${records.filter(a=>a.status===k).length}</strong><span>${esc(v)}</span></div>`).join('')}</div><p class="small">A downloaded dataset can still fail the study: dates, geography, passenger definitions and comparisons must line up. Counts below are source records, not independent experiments. Table extracts are distinct from original observations.</p><label for="world-acq-status">Acquisition status<select id="world-acq-status"><option value="">All statuses</option>${Object.entries(acquisitionLabels).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label><div id="world-acq-records">${acquisitionRecords(records)}</div><p class="small">Each download includes bounded source records or extracted tables, provenance and reproduction scripts. Large original archives remain linked to their official source; full original reports are not redistributed where prohibited.</p></article>`;
}

export async function renderGlobalEvidence(root){
 if(!root)return;
 root.classList.add('global-evidence');
 const response=await fetch(new URL('global.json',base));if(!response.ok)throw Error(`International evidence data: ${response.status}`);
 const d=await response.json(),cases=array(d.cases),comparisons=array(d.comparisons),studies=array(d.studies);
 const regions=[...new Set(cases.map(c=>text(c.region)).filter(Boolean))];
 const outcomeOptions=[...new Set(cases.flatMap(caseOutcomes))];
 const q=new URL(location.href).searchParams;
 let region=regions.includes(q.get('worldRegion'))?q.get('worldRegion'):'';
 let outcome=outcomeOptions.includes(q.get('worldOutcome'))?q.get('worldOutcome'):'';
 let selected=cases.some(c=>c.id===q.get('worldCase'))?q.get('worldCase'):cases[0]?.id;
 let comparison=comparisons.some(c=>c.id===q.get('worldComparison'))?q.get('worldComparison'):comparisons[0]?.id;
 root.innerHTML=`<article class="research-card world-intro" aria-labelledby="world-title"><div class="minilabel">A wider study pool · keep the question fixed</div><h3 id="world-title">${esc(d.title||'What can other cities tell us?')}</h3><p class="world-summary">${esc(text(d.summary))}</p><div class="world-findings">${array(d.findings).map(f=>`<section><span>${esc(f.label)}</span><strong>${esc(text(f.value))}</strong><p>${esc(text(f.detail))}</p></section>`).join('')}</div><div class="world-principle"><b>More cities can improve the evidence.</b><p>Keep treatment, outcome and comparison separate. More cyclists do not by themselves establish higher total person flow; a local traffic change does not establish a change in complete journey time.</p></div></article>
 ${acquisitionPanel(d.acquisition)}
 <article class="research-card world-pool" aria-labelledby="world-pool-title"><div class="minilabel">Treatment → measurement → identification</div><h3 id="world-pool-title">Inspect the expanded study pool</h3><p>Eligibility describes the actual street change. Evidence status describes what was measured or estimated. Neither is a score for whether a bike lane succeeded.</p><div class="world-controls"><label for="world-region">Region<select id="world-region"><option value="">All regions</option>${regions.map(r=>`<option value="${esc(r)}"${r===region?' selected':''}>${esc(r)}</option>`).join('')}</select></label><label for="world-outcome">Outcome topic<select id="world-outcome"><option value="">All outcomes</option>${outcomeOptions.map(o=>`<option value="${esc(o)}"${o===outcome?' selected':''}>${esc(outcomeLabel(o))}</option>`).join('')}</select></label></div><p class="small" id="world-case-count" role="status"></p><div class="world-case-layout"><div id="world-case-list" class="world-case-list" role="group" aria-label="Select a city and project"></div><div id="world-case-detail" class="world-case-detail" aria-live="polite"></div></div></article>
 ${comparisons.length?`<article class="research-card world-comparisons" aria-labelledby="world-comparison-heading"><div class="minilabel">Source-level reconstruction · not a pooled causal effect</div><h3 id="world-comparison-heading">What do the acquired observations show?</h3><label for="world-comparison">Choose an observed comparison<select id="world-comparison">${comparisons.map(c=>`<option value="${esc(c.id)}"${c.id===comparison?' selected':''}>${esc(c.title)}</option>`).join('')}</select></label><div id="world-comparison-detail" aria-live="polite"></div></article>`:''}
 ${studies.length?`<article class="research-card" aria-labelledby="world-studies-heading"><div class="minilabel">Published methods · verify the estimand</div><h3 id="world-studies-heading">Which research designs go further?</h3><div class="world-study-list">${studies.map(s=>`<details><summary>${esc(s.name)}</summary><dl><div><dt>Coverage</dt><dd>${esc(text(s.coverage))}</dd></div><div><dt>Outcome</dt><dd>${esc(text(s.outcome))}</dd></div><div><dt>Finding</dt><dd>${esc(text(s.finding))}</dd></div><div class="world-study-limit"><dt>Limit</dt><dd>${esc(text(s.limit))}</dd></div></dl>${s.url?`<p class="small">${link('Read the study or replication source',s.url)}</p>`:''}</details>`).join('')}</div></article>`:''}
 <article class="research-card world-strategy" aria-labelledby="world-strategy-heading"><div class="minilabel">What this changes about our study</div><h3 id="world-strategy-heading">Build comparable studies before combining results.</h3><ol>${array(d.strategy).map(s=>`<li><b>${esc(s.title)}</b><p>${esc(text(s.detail))}</p></li>`).join('')}</ol><p class="world-transportability">A result from another city applies first to that street, policy package and period. Applying it to NYC requires comparable starting demand, transit alternatives, network constraints and implementation. Multiple papers using the same project or counters are not independent replications.</p><div class="research-downloads">${array(d.downloads).map(f=>{const u=url(f.file,base);return u?`<a class="btn" href="${esc(u.href)}" download>${esc(f.label)}</a>`:'';}).join('')}</div><p class="small">Evidence checked ${esc(text(d.checked_on)||'date unavailable')}. Source observations, conditional estimates and unresolved outcomes retain their separate labels.</p></article>`;

 function renderCases(){
  const visible=cases.filter(c=>(!region||text(c.region)===region)&&(!outcome||caseOutcomes(c).includes(outcome)));
  if(!visible.some(c=>c.id===selected))selected=visible[0]?.id;
  root.querySelector('#world-case-count').textContent=`${visible.length} of ${cases.length} cases${region?` · ${region}`:''}${outcome?` · ${outcomeLabel(outcome)}`:''}`;
  root.querySelector('#world-case-list').innerHTML=visible.map(c=>`<button type="button" class="world-case-button" data-world-case="${esc(c.id)}" aria-pressed="${c.id===selected}" aria-controls="world-case-detail"><span>${esc(c.city)}</span><b>${esc(c.project)}</b><small>${esc(text(c.priority)||text(c.status))}</small></button>`).join('');
  const c=visible.find(c=>c.id===selected);
  root.querySelector('#world-case-detail').innerHTML=c?`<div class="world-detail-top"><span class="minilabel">${esc(c.city)} · ${esc(c.region)}</span>${badge(c.status)}</div><h4>${esc(c.project)}</h4><div class="world-eligibility"><b>Conversion eligibility</b><p>${esc(text(c.eligibility))}</p></div><dl class="world-facts"><div><dt>Street change</dt><dd>${esc(text(c.treatment))}</dd></div><div><dt>Timing</dt><dd>${esc(text(c.timing))}</dd></div><div><dt>Measurement</dt><dd>${esc(text(c.measurement))}</dd></div><div><dt>Causal comparison</dt><dd>${esc(text(c.identification))}</dd></div></dl><div class="world-result"><span class="minilabel">What the evidence supports</span><p>${esc(text(c.finding))}</p></div><div class="world-limit"><b>What remains unresolved</b><p>${esc(text(c.limit))}</p></div>${c.source_url?`<p class="small">${link('Inspect the primary source',c.source_url)}</p>`:''}`:'<div class="world-empty"><h4>No cases match these filters.</h4><p>Choose another region or outcome to inspect the available studies.</p></div>';
  sync({worldCase:selected,worldRegion:region,worldOutcome:outcome});
 }
 function renderComparison(){
  const c=comparisons.find(c=>c.id===comparison),mount=root.querySelector('#world-comparison-detail');if(!mount)return;
  if(!c){mount.innerHTML='<p>No comparison data are available.</p>';return;}
  mount.innerHTML=`<h4>${esc(c.title)}</h4>${c.subtitle?`<p class="world-comparison-subtitle">${esc(c.subtitle)}</p>`:''}<p class="world-unit"><b>Unit:</b> ${esc(c.unit||'See source and row notes')}</p>${pairedBars(c)}<div class="world-table-scroll" tabindex="0" role="region" aria-label="Before and after observations; scroll horizontally if needed"><table><thead><tr><th scope="col">Measure</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Change</th><th scope="col">Interpretation</th></tr></thead><tbody>${array(c.rows).map(r=>`<tr><th scope="row">${esc(r.label)}</th><td>${esc(number(r.before))}</td><td>${esc(number(r.after))}</td><td>${esc(change(r.change))}</td><td>${esc(text(r.note))}</td></tr>`).join('')}</tbody></table></div><p class="world-comparison-note">${esc(text(c.note))}</p>${c.source_url?`<p class="small">${link('Inspect the source for this comparison',c.source_url)}</p>`:''}`;
  sync({worldComparison:comparison});
 }
 root.querySelector('#world-region').addEventListener('change',e=>{region=e.target.value;renderCases();});
 root.querySelector('#world-outcome').addEventListener('change',e=>{outcome=e.target.value;renderCases();});
 root.querySelector('#world-case-list').addEventListener('click',e=>{const b=e.target.closest('[data-world-case]');if(b){selected=b.dataset.worldCase;renderCases();root.querySelector(`[data-world-case="${CSS.escape(selected)}"]`)?.focus({preventScroll:true});}});
 root.querySelector('#world-comparison')?.addEventListener('change',e=>{comparison=e.target.value;renderComparison();});
 root.querySelector('#world-acq-status')?.addEventListener('change',e=>{root.querySelector('#world-acq-records').innerHTML=acquisitionRecords(array(d.acquisition?.records),e.target.value);});
 renderCases();renderComparison();
}
