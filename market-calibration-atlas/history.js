/* Calendar cohorts at fixed lead time, and same-horizon trading-volume groups. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const metrics = {
    brier: { index: 2, label: 'Brier score', direction: 'Lower is better.', format: x => x.toFixed(3) },
    bias: { index: 4, label: 'Calibration bias', direction: 'Zero means the average prediction matched the win rate.', format: x => (x > 0 ? '+' : '')+(100*x).toFixed(2)+' pp' },
    hit: { index: 3, label: 'Favorite win rate', direction: 'Higher means more favorites won.', format: x => (100*x).toFixed(2)+'%' }
  };
  const valid = x => typeof x === 'number' && Number.isFinite(x);
  const fmt = (metric, value) => valid(value) ? metric.format(value) : '—';
  const count = x => new Intl.NumberFormat('en-US').format(x);
  const medianNumber = x => new Intl.NumberFormat('en-US',{maximumSignificantDigits:8}).format(x);
  const headers = ['Contracts','Events','Brier score','Avg. favorite chance','Favorite won','Calibration bias'];
  const csvHeaders = ['contracts','distinct_events','brier_score','mean_favorite_price','favorite_win_rate','calibration_bias_pp'];
  let ctx, entry, info, generation=0, observer;
  let volumeChoice=new URLSearchParams(location.search).get('vol')==='window'?'window':'cumulative';

  function setup() {
    if ($('history-period')) return;
    $('history').innerHTML = `
      <section class="panel">
        <div class="sectionhead"><div><div class="eyebrow">FIXED FORECAST HORIZON</div><h2>Accuracy over calendar time</h2></div><button type="button" class="export" id="history-calendar-export">Download CSV ↓</button></div>
        <p class="history-scope" id="history-scope"></p>
        <div class="history-filters"><label for="history-period">Group forecasts by<select id="history-period"><option value="years">Calendar year</option><option value="quarters">Calendar quarter</option></select></label>
          <label for="history-metric">Measure for both charts<select id="history-metric"><option value="brier">Brier score</option><option value="bias">Calibration bias</option><option value="hit">Favorite win rate</option></select></label></div>
        <p class="history-help" id="history-metric-note"></p>
        <p class="history-summary" id="history-calendar-summary" aria-live="polite"></p>
        <div id="history-calendar-plot" class="history-plot"></div>
        <div class="scroll"><table aria-label="Accuracy by calendar period"><thead id="history-calendar-head"></thead><tbody id="history-calendar-rows"></tbody></table></div>
        <p class="history-help" id="history-period-note"></p><p class="history-help">The mix of events and their difficulty can change over time. The first and last periods may cover only part of a year or quarter.</p>
      </section>
      <section class="panel">
        <div class="sectionhead"><div><div class="eyebrow">TRADING ACTIVITY</div><h2>High- vs. low-volume contracts</h2></div><button type="button" class="export" id="history-volume-export">Download CSV ↓</button></div>
        <p class="history-scope" id="history-volume-scope"></p>
        <div class="history-filters"><label for="history-volume-period">Group contracts by<select id="history-volume-period"><option value="cumulative">Volume through forecast cutoff</option><option value="window">Volume in forecast window</option></select></label></div>
        <p class="history-help" id="history-volume-method"></p><p class="history-help" id="history-volume-threshold"></p>
        <div id="history-volume-plot"></div>
        <div class="scroll"><table aria-label="Accuracy by trading volume"><thead id="history-volume-head"></thead><tbody id="history-volume-rows"></tbody></table></div>
        <p class="history-help" id="history-volume-note"></p>
      </section>`;
    const params = new URLSearchParams(location.search);
    if (params.get('period') === 'quarters') $('history-period').value='quarters';
    if (Object.hasOwn(metrics,params.get('hmetric'))) $('history-metric').value=params.get('hmetric');
    for (const id of ['history-period','history-metric','history-volume-period']) $(id).onchange=()=>{
      if(id==='history-volume-period') volumeChoice=$(id).value;
      const url=new URL(location.href);
      url.searchParams.set('period',$('history-period').value);
      url.searchParams.set('hmetric',$('history-metric').value);
      url.searchParams.set('vol',volumeChoice);
      window.history.replaceState(null,'',url);
      if (entry !== undefined) draw();
    };
  }
  function table(id,first,rows,empty) {
    const head=$('history-'+id+'-head'), body=$('history-'+id+'-rows');
    head.replaceChildren();body.replaceChildren();
    const tr=head.insertRow();
    for(const name of [first,...headers]) {
      const th=document.createElement('th'); th.scope='col'; th.textContent=name; tr.append(th);
    }
    if(!rows.length) {
      const td=body.insertRow().insertCell();td.colSpan=7;td.textContent=empty;td.className='dim';return;
    }
    for(const [name,s] of rows) {
      const r=body.insertRow(), th=document.createElement('th');th.scope='row';th.textContent=name;r.append(th);
      for(const val of [count(s[0]),count(s[1]),fmt(metrics.brier,s[2]),fmt(metrics.hit,meanPrice(s)),fmt(metrics.hit,s[3]),fmt(metrics.bias,s[4])])
        r.insertCell().textContent=val;
    }
  }
  function clear(message) {
    $('history-calendar-summary').textContent=message;
    $('history-calendar-plot').replaceChildren();$('history-volume-plot').replaceChildren();
    $('history-volume-threshold').textContent='';
    $('history-volume-method').textContent='';
    $('history-volume-note').textContent='';
    $('history-period-note').textContent='';
    $('history-metric-note').textContent='';
    for(const id of ['calendar','volume']) {
      $('history-'+id+'-head').replaceChildren();$('history-'+id+'-rows').replaceChildren();
      $('history-'+id+'-export').disabled=true;
    }
    observer?.disconnect();
  }
  function periodIndex(label,quarter) {
    if(!quarter) return Number(label);
    const parts=String(label).match(/^(\d{4})\s*Q([1-4])$/);
    return parts ? Number(parts[1])*4+Number(parts[2])-1 : NaN;
  }
  function addSVG(parent,tag,attributes,value) {
    const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,v] of Object.entries(attributes)) el.setAttribute(key,String(v));
    if(value!==undefined) el.textContent=value;
    parent.append(el);return el;
  }
  function graph(rows,metric,quarter) {
    const box=$('history-calendar-plot'); box.replaceChildren();observer?.disconnect();
    const points=rows.map(([label,s])=>({label,ordinal:periodIndex(label,quarter),s,value:s[metric.index]}))
      .filter(p=>valid(p.value) && valid(p.ordinal));
    if(!points.length) return;
    let lastWidth=0;
    function plot() {
      const width=Math.max(220,Math.round(box.getBoundingClientRect().width || 640));
      if(width===lastWidth) return;
      lastWidth=width;box.replaceChildren();
      const height=185,l=60,r=width-24,t=15,b=height-35,first=points[0].ordinal,last=points.at(-1).ordinal;
      const svg=addSVG(box,'svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':metric.label+' by calendar '+(quarter?'quarter':'year')+'. Exact results follow in the table.'});
      const signed=metric===metrics.bias;
      const mx=Math.max(...points.map(p=>Math.abs(p.value)));
      const step0=Math.max(.001,mx/4),power=10**Math.floor(Math.log10(step0));
      const step=([1,2,2.5,5,10].find(n=>n*power>=step0) || 10)*power;
      const ceiling=metric===metrics.hit?1:Math.min(1,Math.max(step,Math.ceil(mx/step)*step));
      const floor=signed?-ceiling:0;
      const y=v=>b-(v-floor)/(ceiling-floor)*(b-t), x=i=>first===last?(l+r)/2:l+(r-l)*(i-first)/(last-first);
      const ticks=metric===metrics.hit?[0,.25,.5,.75,1]:signed?[-ceiling,-ceiling/2,0,ceiling/2,ceiling]:[0,ceiling/2,ceiling];
      for(const tick of ticks) {
        addSVG(svg,'line',{x1:l,x2:r,y1:y(tick),y2:y(tick),stroke:signed&&tick===0?'#5f6d7d':'#dce3e8','stroke-width':signed&&tick===0?1.7:1});
        addSVG(svg,'text',{x:l-7,y:y(tick)+4,'text-anchor':'end',fill:'#526981','font-size':11},fmt(metric,tick));
      }
      for(let i=1;i<points.length;i++) {
        const p=points[i-1],q=points[i];
        if(q.ordinal===p.ordinal+1) addSVG(svg,'line',{x1:x(p.ordinal),x2:x(q.ordinal),y1:y(p.value),y2:y(q.value),stroke:'#287969','stroke-width':2});
      }
      const minSpace=quarter?63:41;
      let lastLabel=-Infinity;
      points.forEach((p,i)=>{
        const px=x(p.ordinal);
        const circle=addSVG(svg,'circle',{cx:px,cy:y(p.value),r:4,fill:p.s[1]<20?'#fff':'#17735f',stroke:'#17735f','stroke-width':1.7});
        addSVG(circle,'title',{},p.label+' · '+fmt(metric,p.value)+' · '+count(p.s[0])+' contracts · '+count(p.s[1])+' events');
        if (i===points.length-1 || (px-lastLabel>=minSpace && (i===0 || x(last)-px>=minSpace))) {
          addSVG(svg,'text',{x:px,y:b+20,fill:'#526981','text-anchor':i===points.length-1&&points.length>1?'end':'middle','font-size':11},p.label);
          lastLabel=px;
        }
      });
    }
    plot();
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(plot);observer.observe(box);}
  }
  function meanPrice(s) {return valid(s[3]) && valid(s[4]) ? Math.max(0,Math.min(1,s[3]-s[4])) : null;}
  function statCSV(s) {return [s[0],s[1],s[2],meanPrice(s),s[3],valid(s[4])?s[4]*100:null];}
  function exportRows(id,labels,rows) {
    const button=$('history-'+id+'-export');
    button.disabled=!rows.length;
    button.onclick=()=>ctx.exportCSV(ctx.venue+'-'+ctx.topic.id+'-'+ctx.day+'d-'+id,
      ['venue','topic','days_before_cutoff',...labels,...csvHeaders],rows.map(r=>[ctx.venue,ctx.topic.name,ctx.day,...r]));
  }
  function calendar(metric) {
    const quarter=$('history-period').value==='quarters', type=quarter?'Quarter':'Year';
    const rows=(entry?.[quarter?'quarters':'years'] || []).map(([label,...stats])=>[String(label),stats])
      .sort((a,b)=>periodIndex(a[0],quarter)-periodIndex(b[0],quarter));
    const plotted=rows.filter(([,s])=>valid(s[metric.index]));
    let headline='';
    if(plotted.length>=2) {
      const [early,a]=plotted[0], [late,b]=plotted.at(-1);
      headline=metric.label+' was '+fmt(metric,a[metric.index])+' in '+early+' and '+fmt(metric,b[metric.index])+' in '+late+'.';
    } else if(plotted.length===1) {
      headline='One '+type.toLowerCase()+' has a measured '+metric.label.toLowerCase()+' at this horizon.';
    } else {
      headline=rows.length?'No contract had a higher-priced side in these periods.':'No forecast qualified for this selection.';
    }
    $('history-calendar-summary').textContent=headline;
    graph(rows,metric,quarter);
    table('calendar',type,rows,'No qualifying observations at this horizon.');
    const dated=info?.periodMethod || (['predictit','intrade','iem'].includes(ctx.venue)?'Periods follow the trading session date.':'Periods follow the date of the forecast observation, in UTC.');
    $('history-period-note').textContent=dated+(info?.firstDate && info?.lastDate?' Observed prices span '+info.firstDate+' to '+info.lastDate+'.':'')+(plotted.some(([,s])=>s[1]<20)?' Open circles mark periods with fewer than 20 events.':'');
    exportRows('calendar',['period_type','period'],rows.map(([label,s])=>[type.toLowerCase(),label,...statCSV(s)]));
  }
  function volumes(metric) {
    const periodSelect=$('history-volume-period');
    const cumulativeAvailable=info?.cumulativeStatus==='available' || !!entry?.volumeCumulative;
    periodSelect.options[0].disabled=!cumulativeAvailable;
    const mode=volumeChoice==='cumulative' && cumulativeAvailable?'cumulative':'window';
    const cumulative=mode==='cumulative';
    periodSelect.value=mode;
    const v=cumulative?entry?.volumeCumulative:entry?.volume;
    const unit=(cumulative?info?.cumulativeUnit:info?.unit) || 'volume units';
    const rows=[['Low volume',v?.low],['High volume',v?.high]].filter(([,s])=>Array.isArray(s) && s[0]>0);
    const box=$('history-volume-plot');box.replaceChildren();box.className='history-volume-rows';
    $('history-volume-method').textContent=(cumulative?info?.cumulativeMethod:info?.method) || '';
    const total=(entry?.years || []).reduce((n,r)=>n+r[1],0);
    const pooled=ctx.venue==='all',units=(cumulative?info?.cumulativeUnits:info?.units)||{};
    const cutoffs=Object.entries(v?.cuts||{}).filter(([,cut])=>valid(cut));
    const known=valid(v?.n) && v.n>0 && (pooled?cutoffs.length>0:valid(v.cut));
    const cutLabels=cutoffs.map(([id,cut])=>(ctx.venues.find(s=>s.id===id)?.name||id)+' '+medianNumber(cut)+' '+(units[id]||''));
    const threshold=pooled?'Venue medians for this selection · '+cutLabels.join(' · ')+'.':'Low volume includes contracts at or below the median of '+medianNumber(v?.cut)+' '+unit+'. High volume contains those strictly above it.';
    $('history-volume-threshold').textContent=known?threshold+' Volume was measured for '+count(v.n)+' of '+count(total)+' qualifying contracts.':'';
    const csv=rows.map(([g,s])=>[g,mode,pooled?'':v.cut,pooled?'':unit,...(pooled?[JSON.stringify(v.cuts),JSON.stringify(units)]:[]),v.n,total,...statCSV(s)]);
    exportRows('volume',['volume_group','volume_time_basis','median','volume_unit',...(pooled?['venue_medians','venue_units']:[]),'contracts_with_volume','all_qualifying_contracts'],csv);
    const noData=total?'No measured trading volume for this selection.':'No qualifying observations at this horizon.';
    table('volume','Trading activity',rows,noData);
    if(!rows.length) {
      $('history-volume-note').textContent=info?.unavailableReason||'';
      return;
    }
    const signed=metric===metrics.bias;
    const biggest=Math.max(0,...rows.map(([,s])=>Math.abs(s[metric.index] || 0)));
    for(const [label,s] of rows) {
      const card=document.createElement('div');card.className='history-volume-bar';
      const name=document.createElement('span');name.textContent=label+' · '+metric.label;
      const val=document.createElement('b');val.textContent=fmt(metric,s[metric.index]);
      const scale=document.createElement('span');scale.className='history-volume-scale'+(signed?' signed':'');scale.setAttribute('aria-hidden','true');
      const bar=document.createElement('span');bar.className='history-volume-meter';
      const value=s[metric.index]||0, fraction=biggest?Math.abs(value)/biggest:0;
      bar.style.width=(signed?50:100)*fraction+'%';
      if(signed) bar.style.left=(value<0?50-50*fraction:50)+'%';
      scale.append(bar);
      const meta=document.createElement('p');meta.textContent=count(s[0])+' contracts · '+count(s[1])+' events';
      card.append(name,val,scale,meta);box.append(card);
    }
    let note=(pooled?'Low volume includes contracts at or below their own venue’s median for this event type and horizon. High volume includes those above it.':'The median is calculated retrospectively within this venue, event type and horizon, using each contract’s volume through its forecast cutoff.')+' Equal volumes stay together and can make the groups uneven. The mix of events may differ.';
    if(!v.high || v.high[0]===0) note+=' No contract exceeded the median in this sample.';
    if(rows.some(([,s])=>s[1]<20)) note+=' At least one group has fewer than 20 events.';
    $('history-volume-note').textContent=note;
  }
  function draw(){
    const metric=metrics[$('history-metric').value];
    const explanation=metric===metrics.brier?'Brier score measures the squared distance between a price and its outcome.':metric===metrics.bias?'Bias is the actual favorite win rate minus its average quoted chance. A negative value means favorites won less often than priced.':'Favorite win rate counts how often the higher-priced side paid out.';
    $('history-metric-note').textContent=explanation+' '+metric.direction;
    calendar(metric);volumes(metric);
  }
  async function render(next) {
    setup();ctx=next;entry=undefined;info=null;
    const token=++generation;
    const venue=ctx.venues.find(v=>v.id===ctx.venue);
    const scope=venue.name+' · '+ctx.topic.name+' · '+count(ctx.day)+(ctx.day===1?' day':' days')+' before cutoff · Favorites priced at 51% or higher';
    $('history-scope').textContent=scope;
    $('history-volume-scope').textContent=scope;
    clear('Loading historical results…');
    try {
      const [series,source]=await Promise.all([ctx.loadData(ctx.venue,'history/'+ctx.topic.id),ctx.readJSON('data/'+ctx.venue+'/history/info.json').catch(()=>null)]);
      if(token!==generation) return;
      entry=series?.[ctx.day] || null;info=source;draw();
    } catch(e) {
      if(token===generation) clear('Historical results could not be loaded. Select this view again to retry.');
    }
  }
  window.AtlasHistory={render};
})();
