'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (value,digits=0) => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value).toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}) : '—';
  const displayName = value => {const name=String(value??'');if(/hegar/i.test(name))return 'MJ Hegar';return name.replace(/mcgrath/ig,'McGrath').replace(/mcconnell/ig,'McConnell');};
  const modelLabels = {baseline:'Election fundamentals',context:'Fundamentals only',market:'Fundamentals + market odds',context_adjusted:'Fundamentals-adjusted support',market_adjusted:'Market-adjusted support',raw_support:'Raw support'};
  const text = (id,value) => { if (value !== undefined && value !== null) $(id).textContent=value; };
  let data, selectedKey;
  const rowKey = r => [r.name,r.state,r.year,r.party,r.measure].join('|');
  const amount = (value,measure) => (measure.includes('dollar') ? '$' : '') + num(value,0);
  function renderSummary() {
    const s = data.summary || {};
    text('status-text',s.status || 'Executed fundraising analysis · Causal interpretation separate');
    text('status-date',s.period || (s.cycles || []).join(' · '));
    text('verdict-heading',s.heading || 'What the data support.');
    text('verdict',s.verdict || 'Review the held-out checks below before interpreting the candidate rankings.');
    text('verdict-subtitle',s.subtitle);
    text('scope-note',s.scope_note);
    const metrics=s.metrics || [{value:s.candidate_races,label:'candidate-election observations'},{value:s.races,label:'distinct Senate races'},{value:Array.isArray(s.cycles)?s.cycles.length:s.cycles,label:'election cycles'},{value:s.weeks,label:'candidate-week observations'}];
    $('sample-metrics').innerHTML=metrics.filter(m=>m.value!==undefined&&m.value!==null).map(m=>`<div class="sample-metric"><strong>${esc(typeof m.value==='number'?num(m.value):m.value)}</strong><span>${esc(m.label)}</span></div>`).join('');
    text('ranking-note',data.ranking_note);
    text('fundraising-verdict',data.tests?.fundraising || 'No held-out fundraising result is available in this release.');
    text('appeal-verdict',data.tests?.appeal || 'Independent candidate-appeal validation is not available in this release.');
    text('causal-verdict',data.tests?.causal || 'No new causal coattail estimate. A valid pre-primary score and credible nomination comparison are still required.');
    text('model-note',data.model_note || 'Metrics refer to their stated target and holdout. Different targets and units cannot be compared directly.');
    $('limitations').innerHTML='<ul>'+ (data.limitations || []).map(l=>`<li>${esc(l)}</li>`).join('')+'</ul>';
    $('source-list').innerHTML=(data.sources || []).map(s=>`<article class="source-item"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.name)} ↗</a><p>${esc(s.note || s.description || '')}</p></article>`).join('');
  }
  function renderModels() {
    const chosen=$('test-measure-select').value;
    const rows=(data.model_metrics || []).filter(r=>!chosen||chosen==='all'||r.measure===chosen||(data.measure_labels||{})[chosen]===r.measure);
    $('model-rows').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.test || 'Fundraising prediction')}</td><td>${esc((data.measure_labels||{})[r.measure] || r.measure || '')}<small>${esc(modelLabels[r.model] || r.model)}</small></td><td>${esc(r.holdout || r.test_cycle || '')}</td><td class="numeric">${num(r.n)}</td><td>${esc(r.metric)}</td><td class="numeric">${num(r.value,3)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty-state">No qualifying held-out model comparison is available.</td></tr>';
  }
  function initControls() {
    const rows=data.rankings || [];
    const measureOrder=['national_new_donors','in_state_new_donors','transactions','dollars'];
    const measures=[...new Set(rows.map(r=>r.measure))].sort((a,b)=>{const ai=measureOrder.indexOf(a),bi=measureOrder.indexOf(b);return (ai<0?99:ai)-(bi<0?99:bi);});
    const labels=data.measure_labels || {};
    $('test-measure-select').innerHTML=measures.map(m=>`<option value="${esc(m)}">${esc(labels[m]||m)}</option>`).join('')+'<option value="all">All support measures</option>';
    $('test-measure-select').addEventListener('change',renderModels);
    renderModels();
    $('measure-select').innerHTML=measures.map(m=>`<option value="${esc(m)}">${esc(labels[m] || m)}</option>`).join('') || '<option>No comparable scores</option>';
    const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>b-a);
    $('cycle-select').innerHTML='<option value="all">All available cycles</option>'+years.map(y=>`<option>${esc(y)}</option>`).join('');
    ['measure-select','cycle-select','candidate-search'].forEach(id=>$(id).disabled=!rows.length);
    ['measure-select','cycle-select'].forEach(id=>$(id).addEventListener('change',renderRankings));
    $('candidate-search').addEventListener('input',renderRankings);
    $('ranking-rows').addEventListener('click',e=>{const button=e.target.closest('[data-candidate-key]');if(button){selectedKey=button.dataset.candidateKey;renderRankings();}});
    const query=new URLSearchParams(location.search);
    if(measures.includes(query.get('measure'))) $('measure-select').value=query.get('measure');
    if(years.map(String).includes(query.get('year'))) $('cycle-select').value=query.get('year');
    if(query.get('candidate')) $('candidate-search').value=query.get('candidate');
    renderRankings();
  }
  function renderRankings() {
    const measure=$('measure-select').value,year=$('cycle-select').value,q=$('candidate-search').value.toLowerCase().trim();
    const rows=(data.rankings||[]).filter(r=>r.measure===measure&&(year==='all'||String(r.year)===year)&&(!q||[r.name,r.state,r.party].join(' ').toLowerCase().includes(q))).sort((a,b)=>(Number(b.ratio)||0)-(Number(a.ratio)||0));
    text('ranking-count',`${num(rows.length)} candidate-election${rows.length===1?'':'s'}`);
    if(!rows.length){$('ranking-rows').innerHTML='<tr><td colspan="6" class="empty-state">No candidates match this selection.</td></tr>';$('candidate-detail').innerHTML='';return;}
    const selected=rows.find(r=>rowKey(r)===selectedKey)||rows.find(r=>/ossoff/i.test(r.name)&&Number(r.year)===2020)||rows[0];selectedKey=rowKey(selected);
    $('ranking-rows').innerHTML=rows.map(r=>`<tr class="${rowKey(r)===selectedKey?'selected':''}"><td><button class="candidate-button" data-candidate-key="${esc(rowKey(r))}" aria-pressed="${rowKey(r)===selectedKey}">${esc(displayName(r.name))}</button><small>${esc(r.state)}</small></td><td>${esc(r.year)}<small>${esc(r.party)}</small></td><td class="numeric">${amount(r.actual,r.measure)}</td><td class="numeric">${amount(r.expected,r.measure)}</td><td class="numeric"><span class="ratio-pill ${r.ratio<1?'below':''}">${num(r.ratio,2)}×</span></td><td>${esc(r.coverage || r.window || '')}</td></tr>`).join('');
    const max=Math.max(Number(selected.actual)||0,Number(selected.expected)||0,1);
    const labels=data.measure_labels||{};
    const facts=[];
    if(selected.mean_lagged_probability!==undefined&&selected.mean_lagged_probability!==null) facts.push(`<div><strong>${num(selected.mean_lagged_probability*100,1)}%</strong>Mean lagged market probability</div>`);
    if(selected.matched_weeks!==undefined) facts.push(`<div><strong>${num(selected.matched_weeks)}</strong>Matched weeks</div>`);
    if(selected.window_start&&selected.window_end) facts.push(`<div><strong>${esc(selected.window_start)} – ${esc(selected.window_end)}</strong>Donation window</div>`);
    if(selected.min_lagged_probability!==undefined&&selected.max_lagged_probability!==undefined) facts.push(`<div><strong>${num(selected.min_lagged_probability*100,1)}–${num(selected.max_lagged_probability*100,1)}%</strong>Lagged probability range</div>`);
    if(selected.training_period||selected.training_cycles) facts.push(`<div><strong>${esc(selected.training_period||(Array.isArray(selected.training_cycles)?selected.training_cycles.join(', '):selected.training_cycles))}</strong>Model training cycles</div>`);
    if(selected.baseline_ratio!==undefined&&selected.baseline_ratio!==null) facts.push(`<div><strong>${num(selected.baseline_ratio,2)}× → ${num(selected.ratio,2)}×</strong>Fundamentals only → with market odds</div>`);
    $('candidate-detail').innerHTML=`<div><div class="eyebrow">${esc(selected.state)} · ${esc(selected.year)} · ${esc(selected.party)}</div><h3>${esc(displayName(selected.name))}</h3><p class="candidate-meta">${esc(labels[measure]||measure)}</p><div class="candidate-ratio">${num(selected.ratio,2)}×<span>the model’s expected support</span></div><p class="candidate-note">${esc(selected.note || selected.coverage || selected.window || '')}</p><div class="candidate-facts">${facts.join('')}</div></div><div><div class="comparison-row"><span>Observed</span><div class="comparison-track"><div class="comparison-bar" style="width:${Math.min(100,Math.max(0,Number(selected.actual)/max*100))}%"></div></div><strong class="comparison-value">${amount(selected.actual,measure)}</strong></div><div class="comparison-row"><span>Expected</span><div class="comparison-track"><div class="comparison-bar expected" style="width:${Math.min(100,Math.max(0,Number(selected.expected)/max*100))}%"></div></div><strong class="comparison-value">${amount(selected.expected,measure)}</strong></div><p class="comparison-key">${esc(selected.expectation_note || data.expectation_note || 'Expected support comes from the stated fitted model. This comparison is not a causal estimate.')}</p></div>`;
  }
  fetch('data/market-adjusted.json').then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}).then(d=>{data=d;renderSummary();renderModels();initControls();}).catch(()=>{text('status-text','Analysis data could not be loaded');text('verdict','The interactive results are unavailable in this view. Use the downloadable audit for the recorded analysis.');const e=$('load-error');e.hidden=false;e.innerHTML='The dashboard data did not load. <a href="data/market-adjusted-study.zip">Download the analysis bundle</a> or reload this page. No values have been substituted.';});
})();
