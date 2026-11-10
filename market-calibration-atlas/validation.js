/* Event-level sensitivity checks and a chronological calibration holdout. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  let weight=params.get('vw')==='contract'?'contract':'event';
  let measure=params.get('vm')==='bias'?'bias':'probability';
  let includeSparse=params.get('vsparse')==='1';
  let pair='7/1',request=0;
  const finite=Number.isFinite;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=v=>finite(v)?(v*100).toFixed(2)+'%':'—';
  const gap=v=>finite(v)?(v>0?'+':'')+(100*v).toFixed(2)+' pp':'—';
  const num=v=>finite(v)?v.toLocaleString('en-US'):'—';
  const dayLabel=d=>num(+d)+(+d===1?' day':' days');
  const score=v=>finite(v)?v.toFixed(4):'—';
  const precise=v=>finite(v)?v.toFixed(6):'—';
  const interval=(ci,f=gap)=>Array.isArray(ci)&&ci.every(finite)?f(ci[0])+' to '+f(ci[1]):'Not estimable';
  function param(key,value){const u=new URL(location.href);u.searchParams.set(key,value);history.replaceState(null,'',u);}
  function link(venue='all',topic='0',day=1){const u=new URL(location.href);u.searchParams.set('venue',venue);u.searchParams.set('topic',topic);u.searchParams.set('day',day);u.hash='validation';return esc(u.href);}
  function metric(row){return row?.[weight];}
  function category(ctx){return ctx.topic.kind==='all'?'All':ctx.topic.kind==='broad'?ctx.topic.name.replace(/^All /,''):null;}
  function dayButtons(ctx,days){return '<div class="validation-days"><span>Available horizons</span>'+days.map(d=>'<button class="export" data-validation-day="'+d+'" aria-pressed="'+(d===ctx.day)+'">'+num(d)+'d</button>').join('')+'</div>';}
  function card(label,value,note){return '<div class="kpi"><label>'+label+'</label><strong>'+value+'</strong><small>'+note+'</small></div>';}
  function legend(){return measure==='probability'?'<span><i class="validation-key expected"></i>Mean quoted chance</span><span><i class="validation-key observed"></i>Actual win rate · 95% interval</span>':'<span><i class="validation-key observed"></i>Actual minus quoted · 95% interval</span><span>Zero = no average gap</span>';}
  function chart(rows,description){
    const available=rows.filter(r=>r.m&&finite(r.m[measure==='bias'?'bias':'observed']));
    const sparse=available.filter(r=>r.m.events<20);
    const usable=available.filter(r=>includeSparse||r.m.events>=20);
    const sparseNote=sparse.length?'<p class="validation-sparse-note">'+num(sparse.length)+(sparse.length===1?' row has':' rows have')+' fewer than 20 events'+(includeSparse?' and '+(sparse.length===1?'is':'are')+' included. Intervals are unavailable for these rows.':': '+esc(sparse.map(r=>r.label).join(', '))+'. Hidden from this chart; select “Include fewer than 20 events” above to show '+(sparse.length===1?'it':'them')+'.'+(sparse.some(r=>r.active)?' Your selected result is among them.':''))+' Summary numbers and downloads retain every eligible observation.</p>':'<p class="validation-sparse-note">All plotted rows have at least 20 events.</p>';
    if(!usable.length)return '<p class="empty">'+(available.length?'Every available row has fewer than 20 events.':'No eligible observations in this comparison.')+'</p>'+sparseNote;
    let lo,hi;
    if(measure==='bias'){
      const extent=Math.max(.02,...usable.flatMap(r=>[Math.abs(r.m.bias),...(r.m.ci?.bias||[]).map(Math.abs)]));
      hi=Math.ceil(extent*100/2)*.02;lo=-hi;
    }else{
      const low=Math.min(.5,...usable.flatMap(r=>[r.m.expected,r.m.observed,...(r.m.ci?.observed||[])]));
      lo=Math.max(0,Math.floor(low*10)/10);hi=1;
    }
    const x=v=>Math.max(0,Math.min(400,(v-lo)/(hi-lo)*400));
    const ticks=[lo,lo+(hi-lo)*.25,lo+(hi-lo)*.5,lo+(hi-lo)*.75,hi];
    const tickFormat=v=>measure==='bias'?(v>1e-8?'+':'')+(v*100).toFixed(0):(v*100).toFixed(0)+'%';
    return '<div class="validation-plot" role="group" aria-label="'+esc(description)+'"><div class="validation-axis"><span></span><div class="validation-ticks">'+ticks.map(t=>'<span>'+tickFormat(t)+'</span>').join('')+'</div><span>'+(measure==='bias'?'Gap (pp)':'Chance')+'</span></div>'+usable.map(({label,m,active})=>{
      const value=measure==='bias'?m.bias:m.observed, ci=m.ci?.[measure==='bias'?'bias':'observed'];
      const title=label+': expected '+pct(m.expected)+', actual '+pct(m.observed)+', gap '+gap(m.bias)+'. '+num(m.n)+' contracts, '+num(m.events)+' events. 95% interval '+interval(ci,measure==='bias'?gap:pct)+'.';
      const grid=ticks.map(t=>'<line class="validation-grid" x1="'+x(t)+'" x2="'+x(t)+'" y1="0" y2="30"/>').join('');
      const bar=Array.isArray(ci)?'<line class="validation-whisker" x1="'+x(ci[0])+'" x2="'+x(ci[1])+'" y1="15" y2="15"/><line class="validation-whisker" x1="'+x(ci[0])+'" x2="'+x(ci[0])+'" y1="10" y2="20"/><line class="validation-whisker" x1="'+x(ci[1])+'" x2="'+x(ci[1])+'" y1="10" y2="20"/>':'';
      const expected=measure==='probability'?'<line class="validation-expected" x1="'+x(m.expected)+'" x2="'+x(m.expected)+'" y1="6" y2="24"/>':'<line class="validation-zero" x1="'+x(0)+'" x2="'+x(0)+'" y1="0" y2="30"/>';
      const values=measure==='bias'?'<strong>'+gap(m.bias)+'</strong><small>'+interval(ci)+'</small>':'<strong>'+pct(m.observed)+' actual</strong><small>'+pct(m.expected)+' expected</small>';
      return '<div class="validation-chart-row'+(active?' active':'')+'"><div class="validation-row-label">'+esc(label)+'<small>'+num(m.events)+' events</small></div><svg viewBox="0 0 400 30" preserveAspectRatio="none" role="img" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title>'+grid+expected+bar+'<circle class="validation-dot" cx="'+x(value)+'" cy="15" r="4"/></svg><div class="validation-row-value">'+values+'</div></div>';
    }).join('')+'</div>'+sparseNote;
  }
  function pairPanel(scope){
    const entries=Object.entries(scope.pairs||{}).filter(([,v])=>metric(v)?.n);
    if(!entries.length)return '<section class="panel"><div class="eyebrow">MATCHED HORIZONS</div><h2>Did forecasts improve closer in?</h2><p class="hint">No matched contracts are available for this scope.</p></section>';
    if(!entries.some(([key])=>key===pair))pair=entries[0][0];
    const m=metric(scope.pairs[pair]),[far,near]=pair.split('/');
    const ci=m.ci?.brierChange;
    const verdict=ci?(ci[1]<0?'Brier scores improved in this matched sample.':ci[0]>0?'Brier scores worsened in this matched sample.':'The interval includes no change; this sample does not clearly distinguish an improvement from noise.'):'There are too few independent events, or too little variation, to estimate a useful interval.';
    return '<section class="panel"><div class="sectionhead"><div><div class="eyebrow">SAME CONTRACTS · '+esc(weight==='event'?'EQUAL EVENT WEIGHT':'EQUAL CONTRACT WEIGHT')+'</div><h2>Did forecasts improve closer in?</h2></div><label>Compare <select id="validation-pair">'+entries.map(([key])=>'<option value="'+esc(key)+'"'+(key===pair?' selected':'')+'>'+key.split('/').map(dayLabel).join(' vs. ')+'</option>').join('')+'</select></label></div><p class="hint">'+num(m.n)+' contracts across '+num(m.events)+' venue-specific events had a qualifying favorite at both horizons. Changes are '+dayLabel(near)+' minus '+dayLabel(far)+'.</p><div class="validation-stat-grid"><div><span>Brier score change · lower is better</span><strong>'+score(m.brierChange)+'</strong><small>95% interval '+interval(ci,score)+'</small></div><div><span>Favorite win rate change</span><strong>'+gap(m.hitChange)+'</strong><small>95% interval '+interval(m.ci?.hitChange)+'</small></div><div><span>Signed calibration gap change</span><strong>'+gap(m.biasChange)+'</strong><small>95% interval '+interval(m.ci?.biasChange)+'</small></div></div><p class="validation-takeaway">'+verdict+'</p><p class="hint">The favorite can change between dates. A higher hit rate alone does not establish better calibration; compare outcomes with the probabilities quoted at each horizon.</p></section>';
  }
  function calendarPanel(scope,ctx,meta){
    const c=scope.calendar?.days?.[ctx.day];
    const head='<div class="eyebrow">SAME VENUE AND CATEGORY MIX</div><h2>Are forecasts improving over calendar time?</h2>';
    if(!c||c.status!=='ok')return '<section class="panel">'+head+'<p class="hint">'+esc(c?.reason||'Not enough common event groups in 2024 and 2025 for a comparable calendar check at this horizon.')+'</p></section>';
    const rows=c.years||[],change=c.changes,ci=change?.ci?.brierChange;
    const max=Math.max(.001,...rows.map(r=>r.brier))*1.15;
    const bars=rows.map(r=>'<div class="validation-brier-row"><span>'+r.year+'</span><div class="validation-brier-track"><i style="width:'+(r.brier/max*100)+'%"></i></div><strong>'+score(r.brier)+'</strong></div>').join('');
    const verdict=ci?(ci[1]<0?'Brier scores were lower in 2025 after holding these mix weights fixed.':ci[0]>0?'Brier scores were higher in 2025 after holding these mix weights fixed.':'The interval includes no change in Brier score between these years.'):'The difference cannot be estimated precisely from these event groups.';
    return '<section class="panel">'+head+'<p class="hint">Compare forecasts quoted in 2024 and 2025 at '+dayLabel(ctx.day)+' before cutoff. Both years use the same '+num(c.strata.length)+' venue–category groups, weighted equally; events within each group also receive equal weight. This check uses its own fixed weights.</p><div class="validation-brier-bars" role="group" aria-label="Brier scores with a fixed venue and category mix">'+bars+'</div><div class="validation-stat-grid"><div><span>Brier change · 2025 minus 2024</span><strong>'+score(change?.brierChange)+'</strong><small>95% interval '+interval(ci,score)+'</small></div><div><span>Signed gap change</span><strong>'+gap(change?.biasChange)+'</strong><small>95% interval '+interval(change?.ci?.biasChange)+'</small></div><div><span>Favorite win rate change</span><strong>'+gap(change?.hitChange)+'</strong><small>95% interval '+interval(change?.ci?.hitChange)+'</small></div></div><p class="validation-takeaway">'+verdict+'</p><p class="hint">Event difficulty and the mix within categories can still change. A Brier change alone does not prove that markets became better or worse calibrated.</p><div class="scroll"><table aria-label="Calendar results with a fixed venue and category mix"><thead><tr><th>Quote year</th><th>Mean probability</th><th>Actual win rate</th><th>Signed gap</th><th>Brier score</th><th>Events</th><th>Contracts</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.year+'</td><td>'+pct(r.expected)+'</td><td>'+pct(r.observed)+'</td><td>'+gap(r.bias)+'</td><td>'+score(r.brier)+'</td><td>'+num(r.events)+'</td><td>'+num(r.n)+'</td></tr>').join('')+'</tbody></table></div><details class="validation-method"><summary>Which event groups are comparable?</summary><p>'+esc(meta?.calendarNote||'Only venue–category groups with at least 20 events in both years are retained.')+'</p><p>'+c.strata.map(s=>esc(s.venue+' · '+s.category)+' ('+pct(s.weight)+')').join('; ')+'.</p><p>Contracts excluded because their venue–category group was not represented sufficiently in both years: '+num(c.excluded2024)+' in 2024; '+num(c.excluded2025)+' in 2025.</p></details></section>';
  }
  function heldOutPanel(scope,ctx,meta){
    const h=scope.heldOut?.days?.[ctx.day];
    const heading='<div class="eyebrow">LEARN EARLIER · EVALUATE LATER</div><h2>Can an earlier correction improve later forecasts?</h2>';
    if(!h||!h.raw||!h.adjusted)return '<section class="panel">'+heading+'<p class="hint">'+esc(h?.reason||'Not enough eligible earlier and later events for a separate calibration test at this horizon.')+'</p></section>';
    const ci=h.ci, gain=h.brierGain;
    const verdict=Array.isArray(ci)?ci[0]>0?(gain<.0001?'The correction produced a very small Brier improvement on this later sample.':'The correction improved Brier scores on this later sample.'):ci[1]<0?'The correction made Brier scores worse on this later sample.':'The improvement interval crosses zero. The later sample does not establish a clear benefit.':'An uncertainty interval is not estimable for this sample.';
    const max=Math.max(h.raw.brier,h.adjusted.brier,.001)*1.15;
    const bar=(name,v)=>'<div class="validation-brier-row"><span>'+name+'</span><div class="validation-brier-track"><i style="width:'+Math.max(0,v/max*100)+'%"></i></div><strong>'+precise(v)+'</strong></div>';
    const dates=v=>esc(v?.firstDate?.slice(0,10)||'—')+' to '+esc(v?.lastDate?.slice(0,10)||'—');
    return '<section class="panel validation-holdout">'+heading+'<p class="hint">One adjustment was fitted on earlier events and then held fixed for later, separate venue-events. Both versions score the same original favorites. This test always gives each venue-specific event equal weight.</p><p class="hint">This is a retrospective test: settlement publication times are unavailable, so it cannot verify that every training outcome was known before the later forecasts. Test intervals condition on the fitted correction.</p><div class="validation-periods"><div><span>Earlier training events</span><strong>'+num(h.train?.events)+' events · '+num(h.train?.n)+' contracts</strong><small>'+dates(h.train)+'</small></div><div><span>Later test events</span><strong>'+num(h.test?.events)+' events · '+num(h.test?.n)+' contracts</strong><small>'+dates(h.test)+'</small></div></div><div class="validation-brier-bars" role="group" aria-label="Held-out Brier score, lower is better">'+bar('Original quotes',h.raw.brier)+bar('After correction',h.adjusted.brier)+'</div><div class="validation-holdout-result"><span>Brier improvement · positive is better</span><strong>'+precise(gain)+'</strong><small>95% interval '+interval(ci,precise)+'</small></div><p class="validation-takeaway">'+verdict+'</p><div class="scroll"><table aria-label="Original and adjusted forecasts on later events"><thead><tr><th>Later-event forecasts</th><th>Mean probability</th><th>Actual win rate</th><th>Signed gap</th><th>Brier score</th></tr></thead><tbody><tr><td>Original</td><td>'+pct(h.raw.expected)+'</td><td>'+pct(h.raw.observed)+'</td><td>'+gap(h.raw.bias)+'</td><td>'+precise(h.raw.brier)+'</td></tr><tr><td>Corrected</td><td>'+pct(h.adjusted.expected)+'</td><td>'+pct(h.adjusted.observed)+'</td><td>'+gap(h.adjusted.bias)+'</td><td>'+precise(h.adjusted.brier)+'</td></tr></tbody></table></div><details class="validation-method"><summary>How the later-event test works</summary><p>'+esc(h.note||scope.heldOut?.note||meta?.heldOutNote||'This is a retrospective chronological holdout. Reported close timestamps separate the periods, but actual resolution timestamps are not available for every row. It does not establish that every training outcome was known at that time, or that a trading strategy could have earned a return.')+'</p><p>'+esc(h.correction?.method||'A single additive adjustment to log odds is fitted using the training sample.')+' '+(finite(h.correction?.logitShift)?'Fitted log-odds shift: '+h.correction.logitShift.toFixed(4)+'. ':'')+'The evaluation starts '+esc(h.splitDate||'at the reported split')+'.</p></details></section>';
  }
  function show(ctx,data){
    const root=document.getElementById('validation-root');if(!root)return;
    const key=category(ctx),venue=data.venues?.[ctx.venue],scope=venue?.categories?.[key];
    const source=ctx.venue==='all'?'Polymarket + Kalshi':ctx.venue==='polymarket'?'Polymarket':ctx.venue==='kalshi'?'Kalshi':ctx.venues.find(v=>v.id===ctx.venue)?.name||ctx.venue;
    const head='<div class="chart-toolbar"><div><div class="eyebrow">CHECK THE EVIDENCE</div><h2>How robust are the results?</h2></div></div>';
    if(!scope){
      const why=!venue?'This validation panel currently covers the downloadable Polymarket and Kalshi archives. It does not cover '+source+'.':key===null?'Validation is available for all event types combined and broad categories. This detailed event type has not been aggregated for these tests.':'This category has no eligible records in the validation data.';
      root.innerHTML=head+'<section class="panel"><p class="empty">'+esc(why)+'</p><a href="'+link(venue?ctx.venue:'all','0',ctx.day)+'">View supported validation data →</a></section>';return;
    }
    const scopeName=key==='All'?'all event types':key;
    const days=Object.keys(scope.days||{}).map(Number).sort((a,b)=>a-b);
    const sample=scope.days?.[ctx.day], m=metric(sample);
    const rows=days.map(d=>({label:dayLabel(d),m:metric(scope.days[d]),active:d===ctx.day}));
    const categoryRows=Object.entries(venue.categories).filter(([name])=>name!=='All').map(([name,c])=>({label:name,m:metric(c.days?.[ctx.day]),active:name===key}));
    const controls='<div class="validation-controls"><label>Weight results <select id="validation-weight"><option value="event"'+(weight==='event'?' selected':'')+'>Each event equally</option><option value="contract"'+(weight==='contract'?' selected':'')+'>Each contract equally</option></select></label><label>Chart measure <select id="validation-measure"><option value="probability"'+(measure==='probability'?' selected':'')+'>Expected vs. actual</option><option value="bias"'+(measure==='bias'?' selected':'')+'>Signed calibration gap</option></select></label><label class="validation-sparse-control"><input id="validation-sparse" type="checkbox"'+(includeSparse?' checked':'')+'>Include fewer than 20 events</label><button class="export" id="validation-export">Download probability checks ↓</button></div>';
    const scopeNote=ctx.venue==='all'?'All markets is restricted to Polymarket and Kalshi in this view; the other four archives are not included. Events listed on both venues remain separate.':'Only this venue’s historical archive is included.';
    let summary='';
    if(m){summary='<div class="kpis validation-kpis">'+card('Mean quoted chance',pct(m.expected),'Expected favorite win rate')+card('Actual win rate',pct(m.observed),'95% interval '+interval(m.ci?.observed,pct))+card('Actual minus quoted',gap(m.bias),'95% interval '+interval(m.ci?.bias))+card('Sample',num(m.events)+' events',num(m.n)+' contracts · '+(weight==='event'?'equal event weight':'equal contract weight'))+'</div>';}else{summary='<p class="empty">No eligible validation sample at '+dayLabel(ctx.day)+' for '+esc(scopeName)+'. Choose one of the available horizons below.</p>';}
    const age=sample?.quoteAgeHours;
    const freshness=age&&finite(age.median)?'<p><strong>Recorded observation age at this cutoff:</strong> median '+age.median.toFixed(1)+' hours; 95th percentile '+(finite(age.p95)?age.p95.toFixed(1):'—')+' hours; maximum '+(finite(age.max)?age.max.toFixed(1):'—')+' hours.'+(finite(age.validCount)?' '+num(age.validCount)+' timestamped observations.':'')+'</p>':'';
    root.innerHTML=head+'<section class="panel validation-intro"><div class="sectionhead"><h3>'+esc(source)+' · '+esc(scopeName)+' · '+dayLabel(ctx.day)+' before cutoff</h3><a href="data/validation.json" download>Download full analysis JSON</a></div><p class="hint">'+scopeNote+'</p>'+controls+'<p class="hint">Equal event weights prevent an event with many listed contracts from dominating the result. Confidence intervals allow contracts belonging to the same venue event to move together.</p>'+summary+dayButtons(ctx,days)+'</section><div class="validation-chart-grid"><section class="panel"><div class="eyebrow">'+esc(scopeName.toUpperCase())+'</div><h2>Across forecast horizons</h2><div class="validation-legend">'+legend()+'</div>'+chart(rows,'Expected versus actual results by horizon')+'<p class="hint">Each horizon uses its eligible sample. These rows can contain different contracts; use the matched comparison below to hold contracts fixed.</p></section><section class="panel"><div class="eyebrow">'+dayLabel(ctx.day).toUpperCase()+' BEFORE CUTOFF</div><h2>Across event categories</h2><div class="validation-legend">'+legend()+'</div>'+chart(categoryRows,'Expected versus actual results by event category')+'<p class="hint">All available broad categories for '+esc(source)+'. '+(key!=='All'?'Your selected category is highlighted when included. ':'')+'The gap measures average calibration; opposing errors can cancel.</p></section></div>'+pairPanel(scope)+calendarPanel(scope,ctx,data.meta)+heldOutPanel(scope,ctx,data.meta)+'<section class="panel validation-method"><div class="eyebrow">TIMESTAMPS AND UNCERTAINTY</div><h2>What this check can establish</h2>'+freshness+'<p>'+esc(data.meta?.clockNote||'These horizons are measured from recorded venue cutoffs, not independently verified event occurrence times. A market may close after the result is publicly known.')+'</p><p>'+esc(data.meta?.intervalNote||'Intervals are approximate 95% event-clustered intervals. They require at least 20 venue-specific events and nonzero variation. An unavailable interval is not evidence of certainty. The intervals describe sampling variation; they do not correct missing markets, stale prices, or incorrect event clocks.')+'</p><p>Many categories and horizons are shown. These intervals are not adjusted for searching across comparisons. A small average gap does not mean each quoted probability is correct; the exact-price lookup remains the more detailed calibration check.</p></section>';
    root.querySelector('#validation-weight').onchange=e=>{weight=e.target.value;param('vw',weight);show(ctx,data);};
    root.querySelector('#validation-measure').onchange=e=>{measure=e.target.value;param('vm',measure);show(ctx,data);};
    root.querySelector('#validation-sparse').onchange=e=>{includeSparse=e.target.checked;param('vsparse',includeSparse?'1':'0');show(ctx,data);};
    root.querySelectorAll('[data-validation-day]').forEach(button=>button.onclick=()=>ctx.chooseDay(+button.dataset.validationDay));
    const select=root.querySelector('#validation-pair');if(select)select.onchange=e=>{pair=e.target.value;show(ctx,data);};
    root.querySelector('#validation-export').onclick=()=>{
      const records=[];
      for(const [name,c] of Object.entries(venue.categories))for(const [day,value] of Object.entries(c.days||{})){
        const v=metric(value);if(!v)continue;
        records.push([ctx.venue,name,day,weight,v.n,v.events,v.expected,v.observed,v.bias,v.brier,...(v.ci?.observed||[null,null]),...(v.ci?.bias||[null,null]),...(v.ci?.brier||[null,null])]);
      }
      ctx.exportCSV(ctx.venue+'-validation-'+weight,['venue','category','days','weight','contracts','venue_events','mean_probability','win_rate','signed_gap','brier','win_rate_ci_low','win_rate_ci_high','gap_ci_low','gap_ci_high','brier_ci_low','brier_ci_high'],records);
    };
  }
  async function render(ctx){
    const rev=++request,root=document.getElementById('validation-root');if(!root)return;
    root.innerHTML='<p class="hint">Loading event-level validation…</p>';
    try{const data=await ctx.readJSON('data/validation.json');if(rev===request)show(ctx,data);}
    catch(e){if(rev===request)root.innerHTML='<section class="panel"><p class="empty">Validation data could not be loaded. '+esc(e.message)+'</p></section>';}
  }
  window.AtlasValidation={render};
})();
