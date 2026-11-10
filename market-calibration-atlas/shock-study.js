/* An onset-aligned, conditional study of price responses to inferred news. */
(() => {
  'use strict';
  const q=new URLSearchParams(location.search), finite=Number.isFinite;
  const valid=(v,lo,hi)=>v!==null&&v!==''&&finite(+v)&&+v>=lo&&+v<=hi;
  const state={
    minimum:valid(q.get('smin'),5,95)?+q.get('smin'):5,
    noise:[0,2,3,4,6,8].includes(+q.get('snoise'))&&q.has('snoise')?+q.get('snoise'):4,
    lead:[0,1,6,24].includes(+q.get('slead'))&&q.has('slead')?+q.get('slead'):0,
    volume:valid(q.get('svolume'),0,1e12)?+q.get('svolume'):0,
    spread:[2,5,10].includes(+q.get('sspread'))&&q.has('sspread')?+q.get('sspread'):null,
    end:[15,30,60,180,360,1440].includes(+q.get('send'))?+q.get('send'):60,
    chart:['price','gap','brier','retained'].includes(q.get('schart'))?q.get('schart'):'price'
  };
  let request=0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>finite(n)?n.toLocaleString('en-US'):'—';
  const pct=n=>finite(n)?(100*n).toFixed(2)+'%':'—';
  const pp=n=>finite(n)?(n>0?'+':'')+(100*n).toFixed(2)+' pp':'—';
  const score=n=>finite(n)?n.toFixed(4):'—';
  const ci=(range,format=pp)=>range?.every(finite)?format(range[0])+' to '+format(range[1]):'Not estimable';
  const minutes=m=>m<60?m+' min':m%60===0?m/60+' hr':m+' min';
  const match=(m,ctx)=>ctx.topic.kind==='all'||(ctx.topic.kind==='broad'?m.broad===ctx.topic.name.replace(/^All /,''):m.topic===ctx.topic.name);
  function url(){const u=new URL(location.href);for(const [k,v] of Object.entries({smin:state.minimum,snoise:state.noise,slead:state.lead,svolume:state.volume,send:state.end,schart:state.chart}))u.searchParams.set(k,v);if(state.spread===null)u.searchParams.delete('sspread');else u.searchParams.set('sspread',state.spread);history.replaceState(null,'',u);}
  function critical(g){const z=1.959963984540054,d=g-1;return z+(z**3+z)/(4*d)+(5*z**5+16*z**3+3*z)/(96*d*d)+(3*z**7+19*z**5+17*z**3-15*z)/(384*d**3);}
  function estimate(rows,value,bounds){
    if(!rows.length)return {n:0,events:0,mean:null,ci:null};
    const groups=new Map();let sum=0;
    for(const row of rows){const x=value(row),key=row.market.event??row.market.id,g=groups.get(key)||[0,0];sum+=x;g[0]++;g[1]+=x;groups.set(key,g);}
    const n=rows.length,g=groups.size,mean=sum/n;let ss=0,range=null;
    for(const [count,total] of groups.values())ss+=(total-count*mean)**2;
    if(g>=20&&ss>1e-18){const d=critical(g)*Math.sqrt(g/(g-1)*ss)/n;range=[mean-d,mean+d];if(bounds)range=[Math.max(bounds[0],range[0]),Math.min(bounds[1],range[1])];}
    return {n,events:g,mean,ci:range};
  }
  function retainedEstimate(rows,value){
    if(!rows.length)return {mean:null,ci:null};
    let numerator=0,denominator=0;const groups=new Map();
    for(const r of rows){const x=value(r)-r.before,y=r.after-r.before,key=r.market.event??r.market.id,g=groups.get(key)||[0,0];numerator+=x;denominator+=y;g[0]+=x;g[1]+=y;groups.set(key,g);}
    const mean=numerator/denominator,G=groups.size;let ss=0,range=null;
    for(const [x,y] of groups.values())ss+=(x-mean*y)**2;
    if(G>=20&&ss>1e-18){const radius=critical(G)*Math.sqrt(G/(G-1)*ss)/denominator;range=[mean-radius,mean+radius];}
    return {mean,ci:range,n:rows.length,events:G};
  }
  function select(payload,ctx,source,minLead=state.lead){
    const c=Object.fromEntries(payload.columns.map((k,i)=>[k,i])),last=new Map(),rows=[];let candidates=0;
    for(const r of payload.rows){
      const index=r[c.market],m=payload.markets[index],jump=r[c.after]-r[c.before],noise=r[c.noise],ts=r[c.ts],v=r[c.responseVolume],b=r[c.spreadBefore],a=r[c.spreadAfter];
      if(!match(m,ctx)||jump+1e-9<Math.max(state.minimum/100,state.noise*noise)||r[c.leadHours]+1e-9<minLead)continue;
      if(state.volume&&(!finite(v)||v<state.volume))continue;
      if(source==='kalshi'&&state.spread!==null&&(!finite(b)||!finite(a)||Math.max(b,a)>state.spread/100+1e-9))continue;
      candidates++;
      if(last.has(index)&&ts-last.get(index)<21600)continue;
      rows.push({market:m,index,ts,before:r[c.before],after:r[c.after],won:r[c.won],noise,lead:r[c.leadHours],volume:v,spreadBefore:b,spreadAfter:a,quietRange:r[c.quietRange],historyN:r[c.historyN],quietN:r[c.quietN],prices:r[c.prices],ages:r[c.priceAges]});
      last.set(index,ts);
    }
    return {rows,candidates};
  }
  function summary(rows,offsets,barMinutes){
    const points=[{label:'Before move',elapsed:1,offset:null,get:r=>r.before},...offsets.map((offset,i)=>({label:offset===0?'First response':minutes(offset)+' later',elapsed:barMinutes+1+offset,offset,get:r=>r.prices[i]}))];
    const outcome=estimate(rows,r=>r.won,[0,1]);
    for(const point of points){point.price=estimate(rows,point.get,[0,1]);point.gap=estimate(rows,r=>point.get(r)-r.won);point.brier=estimate(rows,r=>(point.get(r)-r.won)**2,[0,1]);point.drift=estimate(rows,r=>point.get(r)-r.after);point.gain=estimate(rows,r=>(r.after-r.won)**2-(point.get(r)-r.won)**2);point.retained=retainedEstimate(rows,point.get);}
    return {points,outcome};
  }
  function chart(points,outcome,metricOverride){
    const W=1040,H=330,L=66,R=26,T=25,B=74,metric=metricOverride||state.chart;
    const title=metric==='price'?'Mean price after an inferred news shock':metric==='gap'?'Price minus outcome rate after an inferred news shock':metric==='retained'?'How much of the initial price movement remains':'Brier score after an inferred news shock';
    const values=points.map(p=>p[metric]);let lo=0,hi=1;
    if(metric==='gap'){const extent=Math.max(.025,...values.flatMap(m=>[Math.abs(m.mean),...(m.ci||[]).map(Math.abs)]));hi=Math.ceil(extent*100/5)*.05;lo=-hi;}
    if(metric==='brier')hi=Math.ceil(Math.max(.05,...values.flatMap(m=>[m.mean,...(m.ci||[])]))*20)/20;
    if(metric==='retained'){lo=Math.min(0,Math.floor(Math.min(...values.flatMap(m=>[m.mean,...(m.ci||[])]))*4)/4);hi=Math.max(1.25,Math.ceil(Math.max(...values.flatMap(m=>[m.mean,...(m.ci||[])]))*4)/4);}
    if(metric==='price'){lo=Math.max(0,Math.floor(Math.min(outcome.mean,...values.flatMap(m=>[m.mean,...(m.ci||[])]))*10)/10-.1);hi=Math.min(1,Math.ceil(Math.max(outcome.mean,...values.flatMap(m=>[m.mean,...(m.ci||[])]))*10)/10+.1);}
    const x=i=>L+Math.log(points[i].elapsed)/Math.log(points.at(-1).elapsed)*(W-L-R),y=v=>T+(hi-v)/(hi-lo)*(H-T-B),fmt=v=>metric==='brier'?v.toFixed(2):metric==='gap'?(100*v).toFixed(0)+' pp':(100*v).toFixed(0)+'%';
    let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+title+'">';
    for(let i=0;i<5;i++){const value=lo+(hi-lo)*i/4;svg+='<line class="shock-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(value)+'" y2="'+y(value)+'"/><text class="shock-axis" x="'+(L-11)+'" y="'+(y(value)+4)+'" text-anchor="end">'+fmt(value)+'</text>';}
    const reference=metric==='price'?outcome.mean:metric==='gap'?0:metric==='retained'?1:null;
    if(reference!==null)svg+='<line class="shock-reference" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(reference)+'" y2="'+y(reference)+'"/>';
    for(let i=1;i<points.length;i++){const a=values[i-1].ci,b=values[i].ci;if(a&&b)svg+='<polygon class="shock-band" points="'+x(i-1)+','+y(a[0])+' '+x(i-1)+','+y(a[1])+' '+x(i)+','+y(b[1])+' '+x(i)+','+y(b[0])+'"/>';}
    svg+='<path d="'+values.map((m,i)=>(i?'L':'M')+x(i)+' '+y(m.mean)).join(' ')+'" class="shock-path"/>';
    let lastTick=-Infinity;
    points.forEach((p,i)=>{const m=values[i],title=p.label+' · '+p.elapsed+' minutes after assumed news · '+(metric==='brier'?score(m.mean):metric==='gap'?pp(m.mean):pct(m.mean));svg+='<circle cx="'+x(i)+'" cy="'+y(m.mean)+'" r="'+(i===1?5.5:4)+'" fill="'+(i===0?'#9aabc3':i===1?'#b47737':'#315b99')+'"><title>'+esc(title)+'</title></circle>';if(i===points.length-1||i<2||(x(i)-lastTick>=64&&x(points.length-1)-x(i)>=64)){svg+='<text class="shock-axis" x="'+x(i)+'" y="'+(H-B+21)+'" text-anchor="middle">+'+p.elapsed+'m</text>';lastTick=x(i);}if(i<2)svg+='<text class="shock-point-label" x="'+x(i)+'" y="'+(H-B+39)+'" text-anchor="middle">'+(i===0?'Before move':'First response')+'</text>';});
    svg+='<text class="shock-axis" x="'+((W+L-R)/2)+'" y="'+(H-4)+'" text-anchor="middle">Minutes after assumed news · logarithmic time scale</text></svg>';
    const legend='<span><i></i>'+(metric==='price'?'Mean price':metric==='gap'?'Price minus outcome rate':metric==='retained'?'Initial move retained':'Brier score')+'</span>'+(metric==='price'?'<span><i class="actual"></i>Final outcome rate: '+pct(outcome.mean)+'</span>':metric==='gap'?'<span><i class="actual"></i>Zero average gap</span>':metric==='retained'?'<span><i class="actual"></i>100% = initial move</span>':'')+'<span>Shading: pointwise approximate 95% interval</span>';
    return '<div class="shock-legend">'+legend+'</div><div class="shock-chart">'+svg+'</div><p class="hint">The same shocks appear at every point. Logarithmic time spacing expands the early response; all labels show actual elapsed minutes under the news-timing assumption. '+(metric==='price'?'The outcome-rate line is a cohort calibration benchmark, not the correct probability for every individual market.':metric==='gap'?'Above zero means the rising side was overpriced on average against final outcomes; below zero means underpriced.':metric==='retained'?'Below 100% means the initial move was partly given back; above 100% means it continued. This is the ratio of mean changes, not the average of individual ratios, and 100% does not mean fair value.':'Lower forecast error is better. Differences between times are paired on the same shocks.')+'</p>';
  }
  function verdict(first,last,drift){
    const gap=first.gap.ci;
    if(!gap)return 'There are too few independent event groups, or too little variation, to distinguish an initial overshoot from an undershoot with this interval method.';
    if(gap[0]>0){const confirm=drift.ci&&drift.ci[1]<0;return 'The initial response priced the rising side above its eventual outcome rate.'+(confirm?' Subsequent prices also moved back down on average, a pattern consistent with initial overreaction.':' The subsequent-price estimate does not establish a clear reversal.');}
    if(gap[1]<0){const confirm=drift.ci&&drift.ci[0]>0;return 'The initial response priced the rising side below its eventual outcome rate.'+(confirm?' Subsequent prices also continued upward on average, a pattern consistent with initial underreaction.':' The subsequent-price estimate does not establish clear continued adjustment.');}
    return 'The initial calibration interval includes both overpricing and underpricing. That is uncertainty about the average gap, not proof the initial response was correctly priced.';
  }
  function controls(source,meta){
    return '<div class="shock-controls"><label>Minimum first-bar move (¢)<input id="shock-minimum" type="number" min="5" max="95" step="any" required value="'+state.minimum+'"></label><label>Relative to recent noise<select id="shock-noise">'+[0,2,3,4,6,8].map(n=>'<option value="'+n+'"'+(state.noise===n?' selected':'')+'>'+(n?n+'× recent noise':'Size floor only')+'</option>').join('')+'</select></label><label>Follow response for<select id="shock-end">'+[15,30,60,180,360,1440].map(n=>'<option value="'+n+'"'+(state.end===n?' selected':'')+'>'+minutes(n)+' after first response</option>').join('')+'</select></label><button class="export" id="shock-apply">Apply filters</button></div>'+
      '<details class="shock-options"><summary>Timing, volume and spread filters</summary><div class="shock-controls"><label>Before recorded close<select id="shock-lead">'+[24,6,1,0].map(h=>'<option value="'+h+'"'+(state.lead===h?' selected':'')+'>'+(h?'At least '+h+' hours':'Include all times')+'</option>').join('')+'</select></label><label>Minimum first-bar volume<input id="shock-volume" type="number" min="0" max="1000000000000" step="any" required value="'+state.volume+'"></label>'+(source==='kalshi'?'<label>Maximum endpoint spread<select id="shock-spread"><option value="">No filter</option>'+[10,5,2].map(n=>'<option value="'+n+'"'+(state.spread===n?' selected':'')+'>'+n+'¢</option>').join('')+'</select></label>':'')+'<button class="export" id="shock-quality-apply">Apply filters</button></div><p class="hint">Volume counts '+(source==='polymarket'?'shares of the tracked token':'contracts')+' in the first moving bar. It is not dollar turnover. '+(source==='kalshi'?'The spread filter requires usable bid and ask quotes at both endpoints.':'Historical bid and ask quotes are unavailable in this Polymarket archive.')+' The close-time filter cannot exclude every post-event or settlement-dispute trade.</p></details>';
  }
  function show(ctx,source,payload,optionsOpen=false){
    const root=document.getElementById('shock-root');if(!root)return;
    const meta=payload.meta||{},bar=meta.barMinutes||(source==='kalshi'?1:5),allOffsets=meta.offsetMinutes,offsets=allOffsets.filter(t=>t<=state.end),indices=offsets.map(t=>allOffsets.indexOf(t));
    const selection=select(payload,ctx,source),complete=selection.rows.filter(r=>indices.every(i=>finite(r.prices[i])));
    // Convert to the selected point grid only after outcome-blind episode selection.
    const rows=complete.map(r=>({...r,prices:indices.map(i=>r.prices[i]),ages:indices.map(i=>r.ages[i])}));
    const events=new Set(rows.map(r=>r.market.event??r.market.id)).size,contracts=new Set(rows.map(r=>r.index)).size;
    let html='<section class="panel shock-study"><div class="eyebrow">NEWS REACTION</div><div class="sectionhead"><div><h2>Do markets overreact or underreact?</h2><p class="hint">Follow the first unusually sharp move after a quiet period, then watch how the same markets adjust.</p></div><button class="export" id="shock-export"'+(!rows.length?' disabled':'')+'>Download matched shock paths ↓</button></div>'+
      '<p class="shock-assumption"><strong>Timing assumption:</strong> news arrives one minute before the first moving bar starts. The first observed response is therefore about <strong>'+ (bar+1)+' minutes after assumed news</strong> with these '+bar+'-minute bars. This clock is inferred from prices; it does not identify an actual news release.</p><button class="export" id="shock-evidence-jump">See stronger evidence checks ↓</button>'+controls(source,meta)+
      '<p class="hint">A shock must move at least '+state.minimum+'¢ and '+state.noise+'× its own recent price noise, after a quiet 15-minute period. We follow the side whose price rose, even if it remains below 50%.</p>';
    if(!selection.rows.length){
      const alternate=state.lead?select(payload,ctx,source,0).rows.length:0;
      html+='<p class="empty">No shocks meet these filters for '+esc(ctx.topic.name)+'.</p>'+(alternate?'<p class="hint">'+num(alternate)+' episodes meet the other filters if moves near recorded close are included.</p><button class="export" id="shock-near">Include moves near close</button>':'');
    }else{
      html+='<p class="shock-cohort">'+num(rows.length)+' matched shocks · '+num(contracts)+' contracts · '+num(events)+' event groups.</p><p class="hint">'+num(selection.rows.length)+' episodes qualify before requiring follow-up prices. '+num(selection.rows.length-rows.length)+' lack at least one required observation through '+minutes(state.end)+' after the first response and are excluded from every plotted point. '+num(selection.candidates-selection.rows.length)+' nearby candidate windows are excluded by six-hour spacing.</p>';
      if(!rows.length)html+='<p class="empty">No complete paths reach this follow-up horizon. Select a shorter follow-up to inspect the available shocks.</p>';
      else{
        const result=summary(rows,offsets,bar),first=result.points[1],last=result.points.at(-1),drift=last.drift,gain=last.gain;
        html+='<div class="shock-chart-head"><h3>How the response develops</h3><label>Chart<select id="shock-chart"><option value="price">Price and final outcome rate</option><option value="gap">Overpricing / underpricing</option><option value="brier">Forecast error (Brier score)</option><option value="retained">Initial movement retained</option></select></label></div>'+chart(result.points,result.outcome)+(state.chart!=='brier'?'<div class="shock-chart-head shock-error-head"><h3>Does forecast error keep improving?</h3></div>'+chart(result.points,result.outcome,'brier'):'')+
          '<div class="shock-kpis"><div><span>Initial price minus outcome rate</span><strong>'+pp(first.gap.mean)+'</strong><small>95% interval '+ci(first.gap.ci)+'</small></div><div><span>Further move over '+minutes(state.end)+'</span><strong>'+pp(drift.mean)+'</strong><small>95% interval '+ci(drift.ci)+'</small></div><div><span>Brier improvement after first response</span><strong>'+score(gain.mean)+'</strong><small>95% interval '+ci(gain.ci,score)+' · positive is better</small></div></div><p class="hint">At this horizon, '+pct(last.retained.mean)+' of the initial mean movement remains (100% is the first response; 95% interval '+ci(last.retained.ci,pct)+').</p><p class="shock-verdict">'+verdict(first,last,drift)+(gain.ci&&gain.ci[0]>0?' Individual forecast error fell after the first response. Average odds can match the group’s outcome rate while individual forecasts continue improving.':'')+'</p>'+
          '<p class="hint">This does not establish how long one news item took to be absorbed. Later news, trading noise and selection of observable paths can also produce drift. A flat average path, or an interval crossing zero, is not proof of the correct price.</p>'+
          '<details class="shock-details"><summary>Accuracy and adjustment at every observation</summary><div class="scroll"><table aria-label="Shock response accuracy at each observation"><thead><tr><th>Observation</th><th>Minutes after assumed news</th><th>Mean price</th><th>Price − outcome rate</th><th>95% gap interval</th><th>Brier</th><th>Further move</th></tr></thead><tbody>'+result.points.map(p=>'<tr><td>'+esc(p.label)+'</td><td>'+p.elapsed+'</td><td>'+pct(p.price.mean)+'</td><td>'+pp(p.gap.mean)+'</td><td>'+ci(p.gap.ci)+'</td><td>'+score(p.brier.mean)+'</td><td>'+pp(p.drift.mean)+'</td></tr>').join('')+'</tbody></table></div><p class="hint">All rows use the same '+num(rows.length)+' shocks. The final outcome rate is '+pct(result.outcome.mean)+' (95% interval '+ci(result.outcome.ci,pct)+'). Mean gaps can hide mispricing at particular prices. These are exploratory pointwise intervals, not a simultaneous confidence band.</p></details>';
      }
      html+='<details class="shock-details"><summary>Follow-up availability</summary><p class="hint">These counts show how much data is available before restricting to complete paths. They are not used to mix different cohorts in the chart.</p><div class="scroll"><table aria-label="Shock follow-up availability"><thead><tr><th>After first response</th><th>Observed / qualifying episodes</th><th>Complete through this time</th></tr></thead><tbody>'+allOffsets.map((m,i)=>'<tr><td>'+minutes(m)+'</td><td>'+num(selection.rows.filter(r=>finite(r.prices[i])).length)+' / '+num(selection.rows.length)+'</td><td>'+num(selection.rows.filter(r=>r.prices.slice(0,i+1).every(finite)).length)+'</td></tr>').join('')+'</tbody></table></div></details>';
    }
    html+='<details class="shock-details"><summary>Detection, timing and interpretation</summary><p>The first moving bar and its immediately preceding bar must both contain trades and be adjacent in time. The prior 15 minutes must have a price range no wider than 5¢, with at least '+(bar===5?3:6)+' active bars spanning at least ten minutes. Recent noise is 1.4826 times the median absolute deviation of adjacent-bar price changes in the prior hour, requiring at least '+(bar===5?6:12)+' such changes. The current jump is excluded from that noise calculation. If recent noise is zero, the absolute size floor still applies.</p><p>Only current and past prices determine candidate shocks. After your size, noise, category, lead-time, volume and spread filters, we keep the earliest qualifying episode and require six hours before another selected episode in that contract. We then require an active completed bar ending exactly at every plotted follow-up time. The last actual trade within that bar can be up to '+bar+' minutes earlier. Missing follow-ups remain missing; they are not interpolated. The complete-path requirement selects actively traded survivors and can affect the result.</p><p>Each episode has equal weight. Approximate 95% intervals cluster repeated episodes and related contracts by parent event and are suppressed below 20 event groups or at zero estimated variance. They do not correct source errors, dependence across event IDs, multiple comparisons or an inferred news clock. The source close/expiry is not verified event time and can follow an already-known outcome. Trade closes can reflect bid–ask bounce.</p><p>Following price rises alone cannot identify the true probability after a specific news item. The outcome-rate line evaluates average calibration of this selected group. To isolate information-processing speed causally, news timestamps and a separate probability benchmark would be needed. <a href="https://arxiv.org/abs/2606.07811" target="_blank" rel="noopener">Related research on public signals and price adjustment</a>.</p><p><a href="data/intraday/'+source+'-shocks.json.gz" download>Shock candidates and paths · JSON gzip</a> · <a href="downloads/reproduce.zip" download>Reproduction files</a></p></details></section>';
    root.innerHTML=html;
    const el=id=>document.getElementById(id),apply=()=>{
      const minimum=el('shock-minimum'),volume=el('shock-volume');
      for(const [input,lo,hi] of [[minimum,5,95],[volume,0,1e12]])if(!valid(input.value,lo,hi)){input.setAttribute('aria-invalid','true');input.reportValidity();input.focus();return;}
      const open=root.querySelector('.shock-options').open;
      state.minimum=+minimum.value;state.volume=+volume.value;state.noise=+el('shock-noise').value;state.end=+el('shock-end').value;state.lead=+el('shock-lead').value;
      if(el('shock-spread'))state.spread=el('shock-spread').value===''?null:+el('shock-spread').value;
      url();show(ctx,source,payload,open);
    };
    root.querySelector('.shock-options').open=optionsOpen;
    if(el('shock-evidence-jump'))el('shock-evidence-jump').onclick=()=>document.getElementById('shock-evidence-root')?.scrollIntoView({behavior:'smooth',block:'start'});
    el('shock-apply').onclick=apply;el('shock-quality-apply').onclick=apply;
    for(const id of ['shock-noise','shock-end','shock-lead','shock-spread'])if(el(id))el(id).onchange=apply;
    for(const id of ['shock-minimum','shock-volume'])el(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();apply();}};
    if(el('shock-chart')){el('shock-chart').value=state.chart;el('shock-chart').onchange=e=>{state.chart=e.target.value;url();show(ctx,source,payload,optionsOpen);};}
    if(el('shock-near'))el('shock-near').onclick=()=>{state.lead=0;url();show(ctx,source,payload,optionsOpen);};
    el('shock-export').onclick=()=>ctx.exportCSV(source+'-matched-shock-paths-'+state.end+'m',
      ['venue','market_id','event_id','category','event_type','assumed_news_utc','first_response_bar_end_utc','hours_before_recorded_close','price_before_rising_side','initial_price_rising_side','rising_side_won','prior_noise','first_bar_volume','spread_before','spread_after',...offsets.map(m=>'price_'+m+'m_after_first_response'),...offsets.map(m=>'bar_age_minutes_at_'+m+'m')],
      rows.map(r=>[source,r.market.id,r.market.event,r.market.broad,r.market.topic,new Date((r.ts-(bar+1)*60)*1000).toISOString(),new Date(r.ts*1000).toISOString(),r.lead,r.before,r.after,r.won,r.noise,r.volume,r.spreadBefore,r.spreadAfter,...r.prices,...r.ages]));
  }
  async function render(ctx,source){
    const rev=++request,root=document.getElementById('shock-root');if(!root)return;
    root.innerHTML='<section class="panel"><p class="hint">Loading shock-response paths…</p></section>';
    try{const payload=await ctx.readJSON('data/intraday/'+source+'-shocks.json.gz');if(rev===request)show(ctx,source,payload);}
    catch(error){if(rev===request)root.innerHTML='<section class="panel"><h2>News reaction</h2><p class="empty">Could not load this shock study. '+esc(error.message)+'</p></section>';}
  }
  window.AtlasShock={render};
})();
