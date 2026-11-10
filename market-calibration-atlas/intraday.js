/* Hourly forecasts and conditional outcomes after rapid price changes. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const finite = Number.isFinite;
  const valid = (v, lo, hi) => finite(+v) && +v >= lo && +v <= hi;
  const state = {
    source: params.get('isource') === 'kalshi' ? 'kalshi' : 'polymarket',
    hour: valid(params.get('ihour'),1,72) ? Math.round(+params.get('ihour')) : 1,
    metric: ['brier','bias','probability'].includes(params.get('imetric')) ? params.get('imetric') : 'brier',
    threshold: valid(params.get('imove'),5,50) ? +params.get('imove') : 30,
    window: [15,30,60].includes(+params.get('iwindow')) ? +params.get('iwindow') : 30,
    lead: [0,1,6,24].includes(+params.get('ilead')) && params.has('ilead') ? +params.get('ilead') : 24,
    volume: valid(params.get('ivolume'),0,1e12) ? +params.get('ivolume') : 0,
    spread: valid(params.get('ispread'),0,100) && params.has('ispread') ? +params.get('ispread') : null,
    pair: params.get('ipair') || '24/1'
  };
  let request = 0;
  const unpacked = new WeakMap();
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = v => finite(v) ? (100*v).toFixed(2)+'%' : '—';
  const pp = v => finite(v) ? (v>0?'+':'')+(100*v).toFixed(2)+' pp' : '—';
  const score = v => finite(v) ? v.toFixed(4) : '—';
  const num = v => finite(v) ? v.toLocaleString('en-US') : '—';
  const ciText = (ci,fmt=pp) => Array.isArray(ci) && ci.every(finite) ? fmt(ci[0])+' to '+fmt(ci[1]) : 'Not estimable';
  const hourLabel = h => num(+h)+(+h===1?' hour':' hours');
  const sourceName = s => s==='kalshi' ? 'Kalshi' : 'Polymarket';
  const dateLabel = value => {
    if(value===null||value===undefined)return 'unknown date';
    const date=new Date(typeof value==='number'?value*1000:value);
    return Number.isFinite(date.getTime())?date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'unknown date';
  };
  function sourceCoverage(meta) {
    const manifest=meta.sourceManifest||{},counts=meta.counts||{};
    if(state.source==='polymarket') {
      const end=manifest.cohortEndExclusive;
      const lastDay=end?new Date(new Date(end).getTime()-86400000).toISOString():null;
      return '<p class="intraday-source-counts">'+num(manifest.cohortContracts)+' contracts · '+num(manifest.cohortEvents)+' events · '+num(manifest.cohortRows)+' active five-minute bars. '+dateLabel(manifest.cohortStart||meta.cohortStart)+'–'+dateLabel(lastDay)+'.</p><p class="hint">Counts describe the core archive cohort. Adjacent days supply context; the hourly and move filters select smaller sets.</p>';
    }
    return '<p class="intraday-source-counts">'+num(manifest.sampleSize)+' contracts sampled · '+num(manifest.observedContracts)+' with observed bars · '+num(counts.sourceBars)+' one-minute candles · '+num(counts.activeBars)+' active bars. Recorded cutoffs: '+dateLabel(manifest.firstAnchor)+'–'+dateLabel(manifest.lastAnchor)+'.</p><p class="hint">Sampled from '+num(manifest.sourceUniverse)+' resolved contracts in the selected daily-history universe. Contracts without an eligible daily-history observation, including short-lived markets absent from that universe, are excluded.</p>';
  }
  const scopeKey = ctx => ctx.topic.kind==='all' ? 'all' : ctx.topic.kind+':'+(ctx.topic.kind==='broad'?ctx.topic.name.replace(/^All /,''):ctx.topic.name);
  const matches = (market,ctx) => ctx.topic.kind==='all' || (ctx.topic.kind==='broad' ? market.broad===ctx.topic.name.replace(/^All /,'') : market.topic===ctx.topic.name);
  const card = (label,value,note) => '<div class="kpi"><label>'+label+'</label><strong>'+value+'</strong><small>'+note+'</small></div>';
  function updateURL() {
    const u = new URL(location.href);
    for(const [k,v] of Object.entries({isource:state.source,ihour:state.hour,imetric:state.metric,imove:state.threshold,iwindow:state.window,ilead:state.lead,ivolume:state.volume,ipair:state.pair})) u.searchParams.set(k,v);
    if(state.spread===null) u.searchParams.delete('ispread'); else u.searchParams.set('ispread',state.spread);
    history.replaceState(null,'',u);
  }
  function sourceURL(ctx) {
    const u=new URL(location.href);u.searchParams.set('venue','all');u.searchParams.set('topic','0');u.hash='intraday';return esc(u.href);
  }
  function tCritical(g) {
    const z=1.959963984540054, df=g-1;
    return z+(z**3+z)/(4*df)+(5*z**5+16*z**3+3*z)/(96*df**2)+(3*z**7+19*z**5+17*z**3-15*z)/(384*df**3);
  }
  function estimate(rows, value, bound) {
    if(!rows.length) return {n:0,events:0,mean:null,ci:null};
    const groups=new Map();let sum=0;
    for(const r of rows) {
      const x=value(r);sum+=x;
      const key=r.market.event ?? r.market.id;
      const g=groups.get(key)||[0,0];g[0]++;g[1]+=x;groups.set(key,g);
    }
    const n=rows.length,G=groups.size,mean=sum/n;
    let ci=null,ss=0;
    for(const [count,total] of groups.values()) ss+=(total-count*mean)**2;
    if(G>=20 && ss>1e-18) {
      const margin=tCritical(G)*Math.sqrt(G/(G-1)*ss)/n;
      ci=[mean-margin,mean+margin];
      if(bound) ci=[Math.max(bound[0],ci[0]),Math.min(bound[1],ci[1])];
    }
    return {n,events:G,mean,ci};
  }
  function rowsFor(payload) {
    if(unpacked.has(payload)) return unpacked.get(payload);
    const c=Object.fromEntries(payload.columns.map((name,i)=>[name,i]));
    const indexed={c,rows:payload.rows};
    unpacked.set(payload,indexed);return indexed;
  }
  function chosenMoves(payload,ctx,minLead=state.lead) {
    const {c,rows:rawRows}=rowsFor(payload),last=new Map(),rows=[];
    let candidates=0;
    // Published shards are ordered by market index, then endpoint time.
    // Construct objects only after filtering and spacing to keep mobile memory small.
    for(const r of rawRows) {
      const index=r[c.market],market=payload.markets[index],ts=r[c.ts],volume=r[c.windowVolume],b=r[c.spreadBefore],a=r[c.spreadAfter];
      if(!matches(market,ctx)||r[c.window]!==state.window||r[c.after]-r[c.before]+1e-10<state.threshold/100||r[c.leadHours]+1e-10<minLead)continue;
      if(state.volume&&(!finite(volume)||volume<state.volume))continue;
      if(state.source==='kalshi'&&state.spread!==null&&(!finite(b)||!finite(a)||Math.max(b,a)>state.spread/100+1e-10))continue;
      candidates++;
      if(last.has(index)&&ts-last.get(index)<21600)continue;
      rows.push({raw:r,marketIndex:index,market,window:r[c.window],ts,before:r[c.before],after:r[c.after],won:r[c.won],lead:r[c.leadHours],forward:[r[c.forward1h],r[c.forward6h],r[c.forward24h]],volume,spreadBefore:b,spreadAfter:a});
      last.set(index,ts);
    }
    rows.sort((a,b)=>a.ts-b.ts||a.marketIndex-b.marketIndex);
    return {rows,candidates};
  }
  function hourlyChart(scope) {
    const rows=Object.entries(scope?.hours||{}).map(([h,m])=>({h:+h,...m})).filter(r=>r.n).sort((a,b)=>b.h-a.h);
    if(!rows.length) return '<p class="empty">No eligible hourly forecasts for this event type.</p>';
    const W=1040,H=285,L=61,R=20,T=22,B=44, maxHour=Math.max(...rows.map(r=>r.h)), minHour=Math.min(...rows.map(r=>r.h));
    let lo=0,hi,series;
    if(state.metric==='probability') {
      series=[['expected','Expected wins','#315b99'],['observed','Actual wins','#087c6b']];
      lo=Math.max(0,Math.floor(Math.min(.5,...rows.map(r=>r.observed))*10)/10);hi=1;
    } else {
      series=[[state.metric,state.metric==='bias'?'Actual minus quoted':'Brier score','#315b99']];
      if(state.metric==='bias') {
        const extent=Math.max(.02,...rows.flatMap(r=>[Math.abs(r.bias),...(r.ci?.bias||[]).map(Math.abs)]));
        hi=Math.ceil(extent*100/2)*.02;lo=-hi;
      } else hi=Math.ceil(Math.max(.05,...rows.flatMap(r=>[r.brier,...(r.ci?.brier||[])]))*20)/20;
    }
    const x=h=>L+(maxHour-h)/(maxHour-minHour||1)*(W-L-R);
    const y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
    const fmt=v=>state.metric==='brier'?v.toFixed(2):state.metric==='bias'?(v*100).toFixed(0)+' pp':(v*100).toFixed(0)+'%';
    let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(series.map(s=>s[1]).join(' and ')+' by hours before recorded cutoff')+'">';
    for(let i=0;i<5;i++) {
      const v=lo+(hi-lo)*i/4;
      svg+='<line class="intraday-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="intraday-axis" x="'+(L-10)+'" y="'+(y(v)+4)+'" text-anchor="end">'+fmt(v)+'</text>';
    }
    const xticks=[maxHour,60,48,36,24,12,minHour].filter((h,i,a)=>h>=minHour&&h<=maxHour&&a.indexOf(h)===i);
    for(const h of xticks) svg+='<text class="intraday-axis" x="'+x(h)+'" y="'+(H-B+22)+'" text-anchor="middle">'+h+'h</text>';
    if(state.metric==='bias') svg+='<line class="intraday-zero" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(0)+'" y2="'+y(0)+'"/>';
    if(state.metric!=='probability') {
      const metric=state.metric;
      // Render separate adjacent strips; never bridge a missing interval.
      for(let i=1;i<rows.length;i++) {
        const a=rows[i-1],b=rows[i],ca=a.ci?.[metric],cb=b.ci?.[metric];
        if(!ca||!cb||a.h-b.h!==1)continue;
        svg+='<polygon class="intraday-band" points="'+x(a.h)+','+y(ca[0])+' '+x(a.h)+','+y(ca[1])+' '+x(b.h)+','+y(cb[1])+' '+x(b.h)+','+y(cb[0])+'"/>';
      }
    }
    for(const [key,label,color] of series) {
      let path='',previous;
      for(const r of rows) {path+=(previous!==undefined&&previous-r.h===1?' L':' M')+x(r.h)+' '+y(r[key]);previous=r.h;}
      svg+='<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2.5" vector-effect="non-scaling-stroke"/>';
      for(const r of rows) {
        const title=hourLabel(r.h)+' before cutoff · '+label+': '+(key==='brier'?score(r[key]):key==='bias'?pp(r[key]):pct(r[key]))+' · '+num(r.n)+' contracts / '+num(r.events)+' events.';
        svg+='<circle data-intraday-hour="'+r.h+'" class="intraday-point" tabindex="0" role="button" aria-label="'+esc(title)+'" cx="'+x(r.h)+'" cy="'+y(r[key])+'" r="'+(r.h===state.hour?5:3)+'" fill="'+(r.events<20?'white':color)+'" stroke="'+color+'" stroke-width="1.4"><title>'+esc(title)+'</title></circle>';
      }
    }
    svg+='<text class="intraday-axis" x="'+((W+L-R)/2)+'" y="'+(H-4)+'" text-anchor="middle">Hours before recorded cutoff · closer to cutoff →</text></svg>';
    return '<div class="intraday-legend">'+series.map(([,label,color])=>'<span><i style="background:'+color+'"></i>'+label+'</span>').join('')+(state.metric!=='probability'?'<span>Shading: approximate 95% interval</span>':'')+'</div><div class="intraday-hour-chart">'+svg+'</div><p class="hint">Select a point or an hour below. Each horizon can contain different contracts. Hollow points have fewer than 20 events.</p>';
  }
  function pairedHours(scope) {
    const entries=Object.entries(scope?.pairs||{}).filter(([,v])=>v.n);
    if(!entries.length)return '';
    if(!entries.some(([p])=>p===state.pair))state.pair=entries[0][0];
    const p=scope.pairs[state.pair],[far,near]=state.pair.split('/');
    return '<div class="intraday-paired"><div class="sectionhead"><h3>Hold the contracts fixed</h3><label>Matched hours <select id="intraday-pair">'+entries.map(([key])=>'<option value="'+key+'"'+(key===state.pair?' selected':'')+'>'+key.split('/').map(hourLabel).join(' vs. ')+'</option>').join('')+'</select></label></div><p class="hint">'+num(p.n)+' contracts across '+num(p.events)+' events qualify at both horizons.</p><div class="intraday-three"><div><span>'+hourLabel(far)+' Brier</span><strong>'+score(p.far?.brier)+'</strong></div><div><span>'+hourLabel(near)+' Brier</span><strong>'+score(p.near?.brier)+'</strong></div><div><span>Brier improvement · positive is better</span><strong>'+score(p.brierGain)+'</strong><small>95% interval '+ciText(p.ci,score)+'</small></div></div></div>';
  }
  function hoursPanel(scope) {
    const m=scope?.hours?.[state.hour];
    const hours=Object.keys(scope?.hours||{}).map(Number).sort((a,b)=>a-b);
    let out='<section class="panel"><div class="sectionhead"><div><div class="eyebrow">HOUR BY HOUR</div><h2>How accurate are the final hours?</h2></div><label>Hourly chart <select id="intraday-metric"><option value="brier">Brier score</option><option value="probability">Expected vs. actual wins</option><option value="bias">Signed calibration gap</option></select></label></div>'+hourlyChart(scope)+
      '<div class="intraday-hours"><label>Inspect hour <input id="intraday-hour" type="number" min="1" max="72" step="1" required value="'+state.hour+'"></label><button class="export" id="intraday-hour-apply">Show hour</button>'+[1,3,6,12,24,48,72].map(h=>'<button class="export" data-intraday-hour="'+h+'" aria-pressed="'+(h===state.hour)+'">'+h+'h</button>').join('')+'<button class="export" id="intraday-hours-export">Download hourly results ↓</button></div>';
    if(m?.n) {
      out+='<div class="kpis intraday-kpis">'+card('Expected wins',pct(m.expected),'Mean favorite price at '+state.hour+'h')+card('Actual wins',pct(m.observed),'95% interval '+ciText(m.ci?.observed,pct))+card('Actual minus quoted',pp(m.bias),'95% interval '+ciText(m.ci?.bias))+card('Contracts',num(m.n),num(m.events)+' distinct events')+'</div><p class="hint">Brier score '+score(m.brier)+'. '+(m.ageMinutes?'Completed-bar age: median '+m.ageMinutes.median.toFixed(1)+' minutes; oldest '+m.ageMinutes.max.toFixed(1)+' minutes. ':'')+'Only active bars completed in the preceding 30 minutes qualify; missing prices are screened out.</p>';
    } else out+='<p class="empty">No eligible observation at '+hourLabel(state.hour)+' for this source and event type.</p>';
    out+=pairedHours(scope)+'<details class="intraday-details"><summary>All hourly values</summary><div class="scroll"><table aria-label="Hourly accuracy results"><thead><tr><th>Hours before cutoff</th><th>Expected wins</th><th>Actual wins</th><th>Gap</th><th>Brier</th><th>Contracts</th><th>Events</th></tr></thead><tbody>'+hours.map(h=>{const r=scope.hours[h];return '<tr><td>'+h+'</td><td>'+pct(r.expected)+'</td><td>'+pct(r.observed)+'</td><td>'+pp(r.bias)+'</td><td>'+score(r.brier)+'</td><td>'+num(r.n)+'</td><td>'+num(r.events)+'</td></tr>';}).join('')+'</tbody></table></div></details></section>';
    return out;
  }
  function outcomeChart(before,after,observed) {
    const bar=(label,value,kind)=>'<div class="intraday-outcome-row"><span>'+label+'</span><div class="intraday-bar-track"><i class="'+kind+'" style="width:'+(value*100)+'%"></i></div><strong>'+pct(value)+'</strong></div>';
    return '<div class="intraday-outcomes" role="group" aria-label="Probabilities before and after the move compared with the final win rate">'+bar('Before the move',before,'before')+bar('After the move',after,'after')+bar('Actually won',observed,'actual')+'<div class="intraday-bar-axis"><span>0%</span><span>100%</span></div></div>';
  }
  function futurePanel(rows) {
    const groups=[1,6,24].map((h,i)=>{
      const known=rows.filter(r=>finite(r.forward[i]));
      const half=estimate(known,r=>r.forward[i]<=r.after-(r.after-r.before)/2+1e-10?1:0,[0,1]);
      const full=estimate(known,r=>r.forward[i]<=r.before+1e-10?1:0,[0,1]);
      const continued=estimate(known,r=>r.forward[i]>r.after+1e-10?1:0,[0,1]);
      const change=estimate(known,r=>r.forward[i]-r.after);
      return {h,known,half,full,continued,change};
    });
    return '<div class="intraday-future"><h3>Did the price move reverse?</h3><p class="hint">“Half reversed” means the rising outcome gave back at least half its initial gain. “Continued” means its price rose further. A full reversal is included in the half-reversal rate.</p><div class="intraday-legend"><span><i style="background:#af693c"></i>Half reversed or more</span><span><i style="background:#087c6b"></i>Continued upward</span></div>'+
      groups.map(g=>'<div class="intraday-follow-row"><div><strong>'+hourLabel(g.h)+' later</strong><small>'+num(g.known.length)+' observed · '+num(rows.length-g.known.length)+' unavailable</small></div><div class="intraday-follow-bars">'+[['Half reversed',g.half,'reversed'],['Continued',g.continued,'continued']].map(([name,m,cls])=>'<div><span class="intraday-sr">'+name+'</span><div class="intraday-bar-track"><i class="'+cls+'" style="width:'+(finite(m.mean)?m.mean*100:0)+'%"></i></div><strong>'+pct(m.mean)+'</strong></div>').join('')+'</div></div>').join('')+
      '<details class="intraday-details"><summary>Reversal counts and uncertainty</summary><div class="scroll"><table aria-label="Price behavior after rapid moves"><thead><tr><th>After move</th><th>Observed / selected</th><th>Half reversed</th><th>95% interval</th><th>Fully reversed</th><th>Continued</th><th>Mean price change</th></tr></thead><tbody>'+groups.map(g=>'<tr><td>'+hourLabel(g.h)+'</td><td>'+num(g.known.length)+' / '+num(rows.length)+'</td><td>'+pct(g.half.mean)+'</td><td>'+ciText(g.half.ci,pct)+'</td><td>'+pct(g.full.mean)+'</td><td>'+pct(g.continued.mean)+'</td><td>'+pp(g.change.mean)+'</td></tr>').join('')+'</tbody></table></div></details><p class="hint">Each follow-up uses only moves with an active bar completed within five minutes before that time and before the recorded cutoff. The actual trade can be up to one bar earlier. The available set changes by follow-up; missing follow-ups are excluded, not treated as no reversal.</p></div>';
  }
  function movesPanel(ctx,payload,meta) {
    const volumeUnit=meta.volumeUnit||payload.meta?.volumeUnit||'source units';
    let html='<section class="panel intraday-moves"><div class="eyebrow">RAPID PRICE MOVES</div><div class="sectionhead"><h2>Did the new price match the final outcome?</h2><button class="export" id="intraday-moves-export">Download selected moves ↓</button></div><p class="hint">A move from 30¢ to 60¢ is accurate if that outcome wins about 60% of the time. We compare the final outcome with both prices, then check whether the price later reverses.</p>'+
      '<p class="intraday-clock"><strong>Timing is measured before recorded close or expiry.</strong> This is not verified event time. Some contracts trade after the outcome is known, including during resolution disputes. Even the 24-hour filter can include post-event trading, so these results do not isolate genuine advance forecasts.</p>'+
      '<div class="intraday-move-controls"><label>Minimum price move (¢)<input id="intraday-threshold" type="number" min="5" max="50" step="any" required value="'+state.threshold+'"></label><label>Lookback window<select id="intraday-window">'+[15,30,60].map(m=>'<option value="'+m+'"'+(m===state.window?' selected':'')+'>'+m+' minutes</option>').join('')+'</select></label><label>At least this far before recorded cutoff<select id="intraday-lead">'+[24,6,1,0].map(h=>'<option value="'+h+'"'+(h===state.lead?' selected':'')+'>'+(h?hourLabel(h):'Include all times')+'</option>').join('')+'</select></label><button class="export" data-intraday-apply>Apply filters</button></div>'+
      '<p class="hint">These are '+meta.barMinutes+'-minute trade-bar closes. For a '+state.window+'-minute lookback, the underlying endpoint trades can be '+(state.window-meta.barMinutes)+'–'+(state.window+meta.barMinutes)+' minutes apart.</p>'+
      '<details class="intraday-details intraday-quality"><summary>Volume and spread filters</summary><div class="intraday-move-controls"><label>Minimum volume during move ('+esc(volumeUnit)+')<input id="intraday-volume" type="number" min="0" max="1000000000000" step="any" required value="'+state.volume+'"></label>'+
      (state.source==='kalshi'?'<label>Maximum spread at both endpoints<select id="intraday-spread"><option value="">No spread filter</option><option value="10">10¢</option><option value="5">5¢</option><option value="2">2¢</option></select></label>':'')+'<button class="export" data-intraday-apply>Apply filters</button></div><p class="hint">Volume is measured during the lookback window, using only trades available at the move’s endpoint.'+(state.source==='kalshi'?' A spread filter also requires usable bid and ask quotes at both endpoints.':' This Polymarket source has trade bars, not historical bid and ask quotes.')+' Results use trade closes; some price movement can reflect the bid–ask spread.</p></details>';
    if(!valid(state.threshold,5,50)||!valid(state.volume,0,1e12)) return {html:html+'<p class="empty">Use a move threshold from 5¢ to 50¢ and a nonnegative volume.</p></section>',rows:[]};
    const selected=chosenMoves(payload,ctx), rows=selected.rows;
    if(!rows.length) {
      const unrestricted=state.lead>0?chosenMoves(payload,ctx,0).rows.length:0;
      const alternate=unrestricted?'<p class="hint">'+num(unrestricted)+' moves satisfy the other filters when moves near the cutoff are included. Those can contain reactions to outcomes already announced.</p><button class="export" id="intraday-include-near">Include moves near cutoff</button>':'';
      return {html:html+'<p class="empty">No qualifying moves for this selection. Try a smaller move, another event type, or include moves closer to the cutoff.</p>'+alternate+'<p class="hint">The default filter excludes the final 24 hours before recorded cutoff. It cannot remove all post-event trading or verify when the outcome became known.</p></section>',rows};
    }
    const before=estimate(rows,r=>r.before,[0,1]),after=estimate(rows,r=>r.after,[0,1]),observed=estimate(rows,r=>r.won,[0,1]),bias=estimate(rows,r=>r.won-r.after),
      oldBrier=estimate(rows,r=>(r.before-r.won)**2,[0,1]),newBrier=estimate(rows,r=>(r.after-r.won)**2,[0,1]),
      gain=estimate(rows,r=>(r.before-r.won)**2-(r.after-r.won)**2);
    const contracts=new Set(rows.map(r=>r.marketIndex)).size;
    let verdict='The sample is too small or has too little variation for a useful uncertainty interval.';
    if(gain.ci) verdict=gain.ci[0]>0?'The new price reduced average forecast error in this sample.':gain.ci[1]<0?'The new price increased average forecast error in this sample.':'The interval includes no improvement in forecast error.';
    const calibration=bias.ci?(bias.ci[0]>0?'The rising outcomes won more often than the new prices implied.':bias.ci[1]<0?'The rising outcomes won less often than the new prices implied.':'The average calibration-gap interval includes zero.'):'The average gap has no estimable confidence interval.';
    html+='<p class="intraday-cohort">'+num(rows.length)+' selected moves · '+num(contracts)+' contracts · '+num(observed.events)+' events. '+num(selected.candidates-rows.length)+' overlapping or nearby qualifying windows excluded by the six-hour spacing rule.</p>'+
      '<div class="intraday-result-grid"><div>'+outcomeChart(before.mean,after.mean,observed.mean)+'<p class="hint">All three values describe the same outcome: whichever side increased in price. No favorite threshold is applied to this test.</p></div><div class="intraday-move-stats"><div><span>Actual win rate minus new price</span><strong>'+pp(bias.mean)+'</strong><small>95% interval '+ciText(bias.ci)+'</small></div><div><span>Brier improvement · positive is better</span><strong>'+score(gain.mean)+'</strong><small>95% interval '+ciText(gain.ci,score)+'</small></div><p>'+verdict+' '+calibration+'</p></div></div>'+
      '<div class="scroll"><table aria-label="Forecast quality before and after rapid moves"><thead><tr><th>Forecast</th><th>Mean probability</th><th>Actual win rate</th><th>Signed gap</th><th>Brier score</th></tr></thead><tbody><tr><td>Before the move</td><td>'+pct(before.mean)+'</td><td>'+pct(observed.mean)+'</td><td>'+pp(observed.mean-before.mean)+'</td><td>'+score(oldBrier.mean)+'</td></tr><tr><td>After the move</td><td>'+pct(after.mean)+'</td><td>'+pct(observed.mean)+'</td><td>'+pp(bias.mean)+'</td><td>'+score(newBrier.mean)+'</td></tr></tbody></table></div>'+futurePanel(rows)+
      '<details class="intraday-details"><summary>Inspect selected moves</summary><p>The '+Math.min(20,rows.length)+' most recent selected moves are shown. The download contains every selected move. Outcomes refer to the side whose price rose.</p><div class="scroll"><table aria-label="Selected rapid move examples"><thead><tr><th>Move ended (UTC)</th><th>Market ID</th><th>Before</th><th>After</th><th>Rising side won?</th><th>Hours before cutoff</th></tr></thead><tbody>'+rows.slice(-20).reverse().map(r=>'<tr><td>'+new Date(r.ts*1000).toISOString().slice(0,16).replace('T',' ')+'</td><td class="intraday-market-id" title="'+esc(r.market.id)+'">'+esc(r.market.id)+'</td><td>'+pct(r.before)+'</td><td>'+pct(r.after)+'</td><td>'+(r.won?'Won':'Lost')+'</td><td>'+r.lead.toFixed(2)+'</td></tr>').join('')+'</tbody></table></div></details>'+
      '<details class="intraday-details"><summary>What counts as one move?</summary><p>Both endpoint bars must contain actual trading and be exactly '+state.window+' minutes apart. A fall in the tracked outcome is represented as the equal rise in its opposite. We keep the earliest qualifying move, then require at least six hours before another selected endpoint in that contract. The spacing rule is applied after your threshold, event-type, timing, volume and spread filters; it does not use the outcome or future price.</p><p>Each selected move has equal weight. Approximate 95% intervals cluster related contracts and repeated moves by the source’s parent event. Intervals require at least 20 events and nonzero variation; many slices are exploratory. Forecast improvement is not a return after trading costs, and a small average gap can conceal errors at particular prices.</p></details></section>';
    return {html,rows};
  }
  function show(ctx,analysis,moves) {
    const root=document.getElementById('intraday-root');if(!root)return;
    const scope=analysis.scopes?.[scopeKey(ctx)], meta=analysis.meta||{}, qualityOpen=root.querySelector('.intraday-quality')?.open;
    const selected=movesPanel(ctx,moves,meta);
    const rawDownloads=state.source==='polymarket'
      ? [0,1,2].map(i=>'<a href="downloads/intraday-polymarket-'+i+'.parquet" download>Polymarket bars · part '+(i+1)+' Parquet</a>').join('')+'<a href="data/intraday/polymarket-source.json" download>Source notes and coverage · JSON</a>'
      : '<a href="data/intraday/kalshi-raw.json.gz" download>Kalshi minute bars · JSON gzip</a>';
    root.innerHTML='<div class="chart-toolbar"><div><div class="eyebrow">PRICES THROUGH TIME</div><h2>News reactions & intraday accuracy</h2></div>'+(ctx.venue==='all'?'<label>Intraday source<select id="intraday-source"><option value="polymarket">Polymarket · 5-minute bars</option><option value="kalshi">Kalshi · 1-minute sample</option></select></label>':'')+'</div>'+
      '<section class="panel intraday-source"><div class="sectionhead"><h3>'+sourceName(state.source)+' · '+esc(ctx.topic.name)+'</h3><a href="data/intraday/'+state.source+'-analysis.json" download>Hourly analysis JSON ↓</a></div>'+sourceCoverage(meta)+'<p class="hint">'+esc(meta.method||'Historical trade bars linked to final outcomes. Each source has a separate collection period and selection rule.')+'</p>'+(ctx.venue==='all'?'<p class="hint">All markets shows one intraday source at a time. The source cohorts differ and are not pooled.</p>':'')+'<p class="intraday-clock">'+esc(meta.clockNote||'Hours are measured before the recorded market cutoff, not independently verified event occurrence. A price move can follow an already-known outcome. Excluding moves near the cutoff reduces this concern but cannot remove it.')+'</p></section>'+
      '<div id="shock-root" aria-live="polite"></div><div id="shock-evidence-root" aria-live="polite"></div>'+
      (scope?hoursPanel(scope):'<section class="panel"><h2>Hourly accuracy</h2><p class="empty">No hourly forecast data for this event type in the selected source. The rapid-move test below uses its own eligible windows.</p></section>')+selected.html+
      '<section class="panel intraday-details"><h3>Source and interpretation</h3>'+(meta.sourceManifest?.attribution?'<p>'+esc(meta.sourceManifest.attribution)+'</p>':'')+'<p>Hourly accuracy uses the favorite at 51% or above. The rapid-move test instead follows the side whose price rose, including rises that end below 51%. All prices remain unbinned.</p><p>'+esc(meta.intervalNote||'Intervals describe variation across archive-defined events. They do not correct missing markets, shared information across events, or errors in the event clock.')+'</p><p>'+ (meta.source?'<a href="'+esc(meta.source)+'" target="_blank" rel="noopener">Original source and definitions</a> · ':'')+'<a href="'+esc(meta.movesFiles?.[state.window]||'data/intraday/'+state.source+'-moves.json.gz')+'" download>Candidate moves for this window · JSON gzip</a> · <a href="downloads/reproduce.zip" download>Reproduction files</a></p><div class="downloads">'+rawDownloads+'</div></section>';
    const el=id=>document.getElementById(id);
    if(qualityOpen&&root.querySelector('.intraday-quality'))root.querySelector('.intraday-quality').open=true;
    if(el('intraday-source')){el('intraday-source').value=state.source;el('intraday-source').onchange=e=>{state.source=e.target.value;updateURL();render(ctx);};}
    if(el('intraday-metric')){el('intraday-metric').value=state.metric;el('intraday-metric').onchange=e=>{state.metric=e.target.value;updateURL();show(ctx,analysis,moves);};}
    const applyHour=()=>{const input=el('intraday-hour');if(!input)return;if(input.value!==''&&valid(input.value,1,72)&&Number.isInteger(+input.value)){state.hour=+input.value;updateURL();show(ctx,analysis,moves);}else{input.setAttribute('aria-invalid','true');input.reportValidity();}};
    if(el('intraday-hour')){el('intraday-hour').onchange=applyHour;el('intraday-hour').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applyHour();}};}
    if(el('intraday-hour-apply'))el('intraday-hour-apply').onclick=applyHour;
    root.querySelectorAll('[data-intraday-hour]').forEach(b=>{
      const choose=()=>{state.hour=+b.dataset.intradayHour;updateURL();show(ctx,analysis,moves);};
      b.onclick=choose;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};
    });
    if(el('intraday-pair')) el('intraday-pair').onchange=e=>{state.pair=e.target.value;updateURL();show(ctx,analysis,moves);};
    const applyFilters=()=>{
      const threshold=el('intraday-threshold'),volume=el('intraday-volume');
      for(const [input,min,max] of [[threshold,5,50],[volume,0,1e12]])if(input&&(input.value===''||!valid(input.value,min,max))){input.setAttribute('aria-invalid','true');input.reportValidity();input.focus();return;}
      state.threshold=+threshold.value;state.volume=+volume.value;updateURL();show(ctx,analysis,moves);
    };
    for(const id of ['intraday-threshold','intraday-volume'])if(el(id)){el(id).onchange=applyFilters;el(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applyFilters();}};}
    root.querySelectorAll('[data-intraday-apply]').forEach(button=>{button.onclick=applyFilters;});
    for(const [id,key] of [['intraday-window','window'],['intraday-lead','lead']])if(el(id))el(id).onchange=e=>{state[key]=+e.target.value;updateURL();if(key==='window')render(ctx);else show(ctx,analysis,moves);};
    if(el('intraday-spread')){el('intraday-spread').value=state.spread===null?'':String(state.spread);el('intraday-spread').onchange=e=>{state.spread=e.target.value===''?null:+e.target.value;updateURL();show(ctx,analysis,moves);};}
    if(el('intraday-hours-export')) el('intraday-hours-export').onclick=()=>ctx.exportCSV(state.source+'-'+ctx.topic.id+'-hourly-accuracy',
      ['venue','event_type','hours_before_cutoff','contracts','events','mean_probability','actual_win_rate','signed_gap','brier','win_rate_ci_low','win_rate_ci_high','gap_ci_low','gap_ci_high','brier_ci_low','brier_ci_high','median_age_minutes','max_age_minutes'],
      Object.entries(scope.hours).map(([h,m])=>[state.source,ctx.topic.name,h,m.n,m.events,m.expected,m.observed,m.bias,m.brier,...(m.ci?.observed||[null,null]),...(m.ci?.bias||[null,null]),...(m.ci?.brier||[null,null]),m.ageMinutes?.median,m.ageMinutes?.max]));
    const download=el('intraday-moves-export');if(download){download.disabled=!selected.rows.length;download.onclick=()=>ctx.exportCSV(state.source+'-'+state.threshold+'c-'+state.window+'m-moves',
      ['venue','market_id','event_id','category','event_type','window_minutes','move_end_utc','price_before_rising_side','price_after_rising_side','rising_side_won','hours_before_cutoff','price_1h_later','price_6h_later','price_24h_later','lookback_volume','spread_before','spread_after'],
      selected.rows.map(r=>[state.source,r.market.id,r.market.event,r.market.broad,r.market.topic,r.window,new Date(r.ts*1000).toISOString(),r.before,r.after,r.won,r.lead,...r.forward,r.volume,r.spreadBefore,r.spreadAfter]));}
    if(el('intraday-include-near'))el('intraday-include-near').onclick=()=>{state.lead=0;updateURL();show(ctx,analysis,moves);};
    if(window.AtlasShock)window.AtlasShock.render(ctx,state.source);
    if(window.AtlasShockEvidence)window.AtlasShockEvidence.render(ctx,state.source);
  }
  async function render(ctx) {
    const rev=++request,root=document.getElementById('intraday-root');if(!root)return;
    if(!['all','polymarket','kalshi'].includes(ctx.venue)){
      root.innerHTML='<section class="panel"><h2>Intraday history</h2><p class="empty">This intraday study currently covers Polymarket and Kalshi. The selected archive has no comparable history in this view.</p><a href="'+sourceURL(ctx)+'">View the available intraday sources →</a></section>';return;
    }
    if(ctx.venue!=='all')state.source=ctx.venue;
    root.innerHTML='<p class="hint">Loading intraday forecasts and price moves…</p>';
    const source=state.source;
    try{
      const analysis=await ctx.readJSON('data/intraday/'+source+'-analysis.json');
      if(rev!==request||source!==state.source)return;
      const moves=await ctx.readJSON(analysis.meta?.movesFiles?.[state.window]||'data/intraday/'+source+'-moves.json.gz');
      if(rev===request && source===state.source)show(ctx,analysis,moves);
    }catch(e){if(rev===request)root.innerHTML='<section class="panel"><p class="empty">The selected intraday source could not be loaded. '+esc(e.message)+'</p></section>';}
  }
  window.AtlasIntraday={render};
})();
