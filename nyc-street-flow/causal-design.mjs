import {esc} from './research-view.mjs';

const base = new URL('./research/causal-design/', import.meta.url);
const list = value => Array.isArray(value) ? value : [];
const words = value => value == null ? '' : Array.isArray(value) ? value.join(' · ') : String(value);
const modeLabel = value => ({bike:'Bicycle',bicycle:'Bicycle',car:'Motor vehicles',road:'Road traffic',motor:'Motor vehicles',bus:'Bus',subway:'Subway',rail:'Rail',all:'All modes',multimode:'All modes',journey:'Whole journeys',journeys:'Whole journeys',design:'Treatment / assignment',treatment:'Treatment / assignment',context:'Context',confounders:'Context',walk:'Walking',ferry:'Ferry'}[value] || words(value).replaceAll('_',' '));
const modes = source => Array.isArray(source.mode) ? source.mode.map(String) : [words(source.mode) || 'other'];
function safeLink(label,url,className=''){
  if(!url)return esc(label);
  try{
    const u=new URL(url,location.href);
    if(!['https:','http:'].includes(u.protocol))return esc(label);
    const external=u.origin!==location.origin;
    return `<a${className?` class="${esc(className)}"`:''} href="${esc(u.href)}"${external?' target="_blank" rel="noopener"':''}>${esc(label)}${external?'<span class="design-external" aria-hidden="true"> ↗</span>':''}</a>`;
  }catch{return esc(label);}
}
function badge(status){
  const s=words(status),l=s.toLowerCase();
  const tone=/missing|not established|blocked|not available|unresolved|not verified|pending/.test(l)?'missing':/partial|conditional|limited|proxy|candidate|requested|incomplete|planned/.test(l)?'partial':/verified|acquired|available|pass|complete/.test(l)?'verified':'neutral';
  return `<span class="design-badge design-badge-${tone}">${esc(s||'Not assessed')}</span>`;
}
function download(name,label){return `<a class="btn" href="${esc(new URL(name,base).href)}" download>${esc(label)}</a>`;}
function params(key,value){const u=new URL(location.href);u.searchParams.set(key,value);history.replaceState(null,'',u);}

export async function renderCausalDesign(root){
  if(!root)return;
  root.classList.add('causal-design');
  const response=await fetch(new URL('design.json',base));
  if(!response.ok)throw Error(`Causal design data: ${response.status}`);
  const d=await response.json();
  const outcomes=list(d.outcomes),sources=list(d.sources),candidates=list(d.candidates),gates=list(d.gates),trial=list(d.trial),pilot=d.pilot||{};
  const q=new URL(location.href).searchParams;
  let outcome=outcomes.some(o=>o.id===q.get('designOutcome'))?q.get('designOutcome'):outcomes[0]?.id;
  const sourceModes=[...new Set(sources.flatMap(modes))];
  let mode=sourceModes.includes(q.get('designMode'))?q.get('designMode'):'';
  root.innerHTML=`<article class="research-card design-intro" aria-labelledby="design-title">
    <div class="minilabel">From the ideal experiment to the data we can obtain</div>
    <h3 id="design-title">Causality needs a comparison we can defend.</h3>
    <p class="design-thesis">${esc(words(d.thesis))}</p>
    <div class="design-two-tests">
      <div><span class="design-step-number">01</span><div><h4>Was the change caused by the conversion?</h4><p>A credible assignment or comparison separates the redesign from other changes over time.</p><b>Assignment credibility: not established</b></div></div>
      <div><span class="design-step-number">02</span><div><h4>Did we measure the outcome we care about?</h4><p>The same place, population and time boundary must include the people and journey stages in the claim.</p><b>Measurement coverage: varies by outcome</b></div></div>
    </div>
    <p class="design-claim"><b>No valid natural experiment has been established for these project-wide claims.</b> A narrower, explicitly conditional study may still be feasible. More complete data and a better causal design solve different problems.</p>
    <div class="design-outcome-control"><label for="design-outcome">Choose the causal question<select id="design-outcome">${outcomes.map(o=>`<option value="${esc(o.id)}"${o.id===outcome?' selected':''}>${esc(o.label)}</option>`).join('')}</select></label></div>
    <div id="design-outcome-detail" aria-live="polite"></div>
    <details class="design-trial"><summary>The ideal trial, mapped to available evidence <span>${trial.length} requirements</span></summary><p class="small">Randomize when ready, eligible corridor networks receive the conversion, keeping delayed projects as contemporaneous comparisons. Track the wider network so route changes remain in the outcome. An implementation queue is only a candidate source of quasi-random timing: its scheduling mechanism and competing influences must be verified.</p><div class="design-table-scroll" tabindex="0" role="region" aria-label="Ideal trial mapping; scroll horizontally if needed"><table class="design-trial-table"><thead><tr><th scope="col">Requirement</th><th scope="col">Ideal experiment</th><th scope="col">Available evidence</th><th scope="col">Remaining gap</th></tr></thead><tbody>${trial.map(t=>`<tr><th scope="row">${esc(t.label)}</th><td>${esc(words(t.ideal))}</td><td>${esc(words(t.available))}</td><td>${esc(words(t.gap))}</td></tr>`).join('')}</tbody></table></div></details>
  </article>
  <article class="research-card design-pilot" aria-labelledby="design-pilot-title"><div class="minilabel">Next executable study · conditional on the checks below</div><h3 id="design-pilot-title">${esc(pilot.title||'Start with a claim the data can support')}</h3><p>${esc(words(pilot.summary))}</p>
    ${list(pilot.probes).length?`<div class="design-probes">${list(pilot.probes).map(p=>`<div><span>${esc(p.label)}</span><strong>${esc(words(p.value))}</strong><p>${esc(words(p.detail))}</p></div>`).join('')}</div>`:''}
    ${list(pilot.steps).length?`<ol class="design-next-steps">${list(pilot.steps).map(s=>`<li><b>${esc(s.label)}</b><p>${esc(words(s.detail))}</p></li>`).join('')}</ol>`:''}
    <details class="design-gates"><summary>Checks that constrain the causal claim <span>${gates.length} checks</span></summary><div class="design-gate-grid">${gates.map(g=>`<section aria-labelledby="design-gate-${esc(g.id)}"><div>${badge(g.status)}</div><h4 id="design-gate-${esc(g.id)}">${esc(g.label)}</h4><p>${esc(words(g.detail))}</p></section>`).join('')}</div><p class="small">These statuses describe documented conditions. They are not probabilities, scores, or proof that a comparison is valid.</p></details>
  </article>
  <article class="research-card" aria-labelledby="design-sources-title"><div class="minilabel">Requirement → source → limitation</div><h3 id="design-sources-title">What can each dataset actually supply?</h3><p>Filter the source map by mode. A verified source can still measure only part of the desired outcome; source availability does not establish causal identification.</p><div class="design-source-controls"><label for="design-mode">Mode or purpose<select id="design-mode"><option value="">All sources</option>${sourceModes.map(m=>`<option value="${esc(m)}"${m===mode?' selected':''}>${esc(modeLabel(m))}</option>`).join('')}</select></label><label for="design-search">Find a source or requirement<input id="design-search" type="search" placeholder="Try occupancy, timing, subway…"></label></div><p id="design-source-count" class="small" role="status"></p><div id="design-source-results"></div></article>
  <article class="research-card" aria-labelledby="design-candidates-title"><div class="minilabel">Choose the study before choosing a favorable result</div><h3 id="design-candidates-title">Which projects deserve the next effort?</h3><p>The order below prioritizes the next investigation. It does not rank the probability that bike lanes help, and does not make the candidates comparable experiments.</p><div class="design-candidates">${candidates.map(c=>`<section class="design-candidate"><div class="design-candidate-top"><span class="design-priority">${c.rank==null?'Candidate':`Priority ${esc(c.rank)}`}</span>${badge(c.status)}</div><h4>${esc(c.name)}</h4><p class="design-treatment">${esc(words(c.treatment))}</p><p>${esc(words(c.reason))}</p><div class="design-next"><b>Next evidence</b><p>${esc(words(c.next))}</p></div>${c.url?`<p class="small">${safeLink('Inspect the supporting evidence',c.url)}</p>`:''}</section>`).join('')}</div></article>
  <article class="research-card design-method-note"><h3>Keep the total effect and its mechanisms separate.</h3><p>We do not need to identify every individual car-to-subway switch to estimate a credible aggregate policy effect. But claiming that specific switching mechanism requires linked evidence or additional assumptions. Do not adjust away changes in mode choice, traffic volume or congestion when estimating the total effect: those can be ways the policy works.</p><p>Do not restrict the primary time comparison to people who still drive or only to journeys completed after the change. Report complete journey time, completed trips and total minutes together, so suppressed travel cannot masquerade as a benefit.</p><div class="research-downloads">${download('design.json','Experiment and source map · JSON')}${download('protocol.txt','Full causal protocol · TXT')}${download('reproduction.zip','Design inputs and checks · ZIP')}</div><p class="small">Evidence checked ${esc(words(d.checked_on)||'date unavailable')}. The protocol is a proposed design, not a retrospective preregistration or a completed experiment.</p></article>`;

  function renderOutcome(){
    const o=outcomes.find(x=>x.id===outcome);
    root.querySelector('#design-outcome-detail').innerHTML=o?`<div class="design-outcome"><div><span class="minilabel">Define the target</span><h4>${esc(o.label)}</h4><p>${esc(words(o.definition))}</p></div><div class="design-pitfall"><b>What would change the question?</b><p>${esc(words(o.pitfall))}</p></div></div>`:'<p>No outcome definitions are available.</p>';
  }
  function renderSources(){
    const search=root.querySelector('#design-search').value.trim().toLowerCase();
    const rows=sources.filter(s=>(!mode||modes(s).includes(mode))&&(!search||[s.name,s.coverage,s.role,s.limit,s.mode,s.status].map(words).join(' ').toLowerCase().includes(search)));
    root.querySelector('#design-source-count').textContent=`${rows.length} of ${sources.length} sources${mode?` · ${modeLabel(mode)}`:''}`;
    root.querySelector('#design-source-results').innerHTML=rows.length?`<div class="design-table-scroll" tabindex="0" role="region" aria-label="Source mapping table; scroll horizontally if needed"><table class="design-source-table"><thead><tr><th scope="col">Source / status</th><th scope="col">Available coverage</th><th scope="col">Role in the causal study</th><th scope="col">What it cannot establish</th></tr></thead><tbody>${rows.map(s=>`<tr><th scope="row">${safeLink(s.name,s.url)}<div>${badge(s.status)}</div><small>${esc(modes(s).map(modeLabel).join(' · '))}</small></th><td>${esc(words(s.coverage))}</td><td>${esc(words(s.role))}</td><td>${esc(words(s.limit))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="design-empty"><b>No sources match this filter.</b><p>Try another mode or a broader search term.</p></div>';
  }
  root.querySelector('#design-outcome').addEventListener('change',event=>{outcome=event.target.value;params('designOutcome',outcome);renderOutcome();});
  root.querySelector('#design-mode').addEventListener('change',event=>{mode=event.target.value;params('designMode',mode);renderSources();});
  root.querySelector('#design-search').addEventListener('input',renderSources);
  renderOutcome();renderSources();
}
