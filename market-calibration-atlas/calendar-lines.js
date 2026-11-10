(() => {
  'use strict';
  const byId = id => document.getElementById('cal-'+id);
  const number = new Intl.NumberFormat('en-US');
  const standard = [1,7,30,90,180,365,730,1095];
  const colors = ['#225dab','#a04b16','#087766','#7f4ea0','#925168','#546a1b','#875900','#425674','#5f3d83','#007d91','#983e35','#73721e'];
  const dashes = ['', '7 3', '3 2', '10 3 2 3'];
  const metrics = {
    brier: {i:3, label:'Brier score', format:v=>v.toFixed(3)},
    hit: {i:4, label:'Favorite win rate', format:v=>(v*100).toFixed(1)+'%'},
    bias: {i:5, label:'Signed bias', format:v=>(v>0?'+':'')+(v*100).toFixed(1)+' pp'}
  };
  const params = new URLSearchParams(location.search);
  const fromURL = (params.get('calDays') || '').split(',').map(Number)
    .filter(v=>Number.isInteger(v) && v>=1 && v<=99999);
  const selected = new Set(fromURL.length ? fromURL.slice(0,12) : [1,7,30]);
  let unit = params.get('calPeriod')==='quarter' ? 'quarter' : 'year';
  let ctx, archive, metric, request=0, observer, inspected, previousDay, autoDay;
  const color = i => colors[i%colors.length], dash = i => dashes[i%dashes.length];
  const daysText = d => number.format(d)+(d===1?' day':' days');

  function syncURL() {
    const u = new URL(location.href);
    u.searchParams.set('calDays',Array.from(selected).sort((a,b)=>a-b).join(','));
    u.searchParams.set('calPeriod',unit);
    history.replaceState(null,'',u);
  }

  function mount() {
    if (byId('period')) return;
    document.getElementById('calendar-lines').innerHTML = `
      <section class="panel" aria-labelledby="cal-title">
        <div class="sectionhead"><div><div class="eyebrow">FORECAST DATE</div><h2 id="cal-title">Accuracy over calendar time</h2></div><button type="button" class="export" id="cal-export">Download CSV ↓</button></div>
        <p class="hint">Each line follows one forecast horizon. A point includes contracts with an eligible price that many days before cutoff. The eligible contracts and mix of events can change.</p>
        <div class="cal-controls"><label>Group by <select id="cal-period"><option value="year">Calendar year</option><option value="quarter">Calendar quarter</option></select></label>
          <form id="cal-custom"><label>Custom horizon <input id="cal-days" type="number" min="1" max="99999" step="1" inputmode="numeric" placeholder="Days" required></label><button class="export" type="submit">Add</button></form></div>
        <div class="cal-horizons" id="cal-legend" role="group" aria-label="Forecast horizons to plot"></div>
        <p class="cal-status" id="cal-status" role="status"></p><div id="cal-plot"></div>
        <div id="cal-values" hidden><label>Inspect <select id="cal-inspect"></select></label><ul id="cal-readout"></ul></div>
        <p class="hint cal-note" id="cal-note"></p>
      </section>`;
    byId('period').value=unit;
    byId('period').onchange = () => {unit=byId('period').value; inspected=undefined; syncURL(); draw();};
    byId('custom').onsubmit = e => {
      e.preventDefault();
      const input=byId('days'), day=Number(input.value);
      if (!archive || !Number.isInteger(day) || day<1 || day>99999) return;
      if (!archive[day]) {byId('status').textContent='No eligible forecasts at '+daysText(day)+' for this selection.'; return;}
      if (selected.size>=12 && !selected.has(day)) {byId('status').textContent='Remove a horizon before adding a thirteenth line.';return;}
      selected.add(day); input.value=''; syncURL(); draw();
    };
  }

  function periodIndex(label) {
    if (unit==='year') return Number(label);
    const m=String(label).match(/^(\d{4})\s*Q([1-4])$/);
    return m ? +m[1]*4 + Number(m[2])-1 : NaN;
  }
  function periodName(k) {
    return unit==='year' ? String(k) : Math.floor(k/4)+' Q'+(k%4+1);
  }
  function svgEl(parent,tag,attributes,value) {
    const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [k,v] of Object.entries(attributes)) el.setAttribute(k,v);
    if(value!==undefined) el.textContent=value;
    parent.append(el);return el;
  }
  function clear(message) {
    observer?.disconnect();byId('plot').replaceChildren();byId('legend').replaceChildren();
    byId('values').hidden=true;byId('export').disabled=true;byId('status').textContent=message;
    byId('note').textContent='';
  }

  function draw() {
    if(!archive) return;
    clear('');
    const list=Array.from(new Set([...standard,ctx.day,...selected])).sort((a,b)=>a-b);
    const styleIndex=d=>standard.includes(d)?standard.indexOf(d):standard.length+list.filter(v=>!standard.includes(v)).indexOf(d);
    for (const day of list) {
      if (!selected.has(day) && !archive[day]) continue;
      const i=styleIndex(day), button=document.createElement('button');
      button.type='button';button.textContent=daysText(day);button.setAttribute('aria-pressed',selected.has(day));
      button.style.setProperty('--series-color',color(i));
      button.onclick=()=>{
        if (selected.has(day)) {
          if(selected.size===1) {byId('status').textContent='Keep at least one forecast horizon selected.';return;}
          selected.delete(day);
        } else {
          if(selected.size>=12) {byId('status').textContent='Remove a horizon before adding another line.';return;}
          selected.add(day);
        }
        syncURL();draw();
        byId('legend').querySelector('[data-day="'+day+'"]')?.focus({preventScroll:true});
      };
      button.dataset.day=day;byId('legend').append(button);
    }
    const periods=new Set(), rows=[];
    const lines=Array.from(selected).sort((a,b)=>a-b).map(day=>{
      const points=new Map();
      for(const row of archive[day]?.[unit+'s'] || []) {
        const k=periodIndex(row[0]);
        if(!Number.isFinite(k) || !row[1] || !Number.isFinite(row[metric.i])) continue;
        periods.add(k);points.set(k,row);rows.push([day,...row]);
      }
      return {day,points,style:styleIndex(day)};
    });
    const periodsSorted=Array.from(periods).sort((a,b)=>a-b);
    if(!periodsSorted.length) {
      byId('status').textContent='No eligible forecasts for the selected horizons and event type.';return;
    }
    const missing=lines.filter(line=>!line.points.size).map(line=>daysText(line.day));
    byId('status').textContent=missing.length?'No eligible forecasts at '+missing.join(', ')+'.':'';
    byId('export').disabled=false;
    byId('export').onclick=()=>ctx.exportCSV(ctx.venue+'-'+ctx.topic.id+'-calendar-'+unit,
      ['venue','event_type','days_before_cutoff','forecast_period','contracts','events','brier_score','favorite_win_rate','bias_pp'],
      rows.map(([day,label,n,e,brier,hit,bias])=>[ctx.venue,ctx.topic.name,day,label,n,e,brier,hit,bias*100]));
    byId('note').textContent='Gaps mark periods without an eligible observation. Open circles mark fewer than 20 events. Periods use the recorded forecast date and may cover only part of a year or quarter.';
    byId('values').hidden=false;
    const select=byId('inspect');select.replaceChildren();
    for(const k of periodsSorted) select.add(new Option(periodName(k),String(k)));
    if(!periods.has(inspected)) inspected=periodsSorted.at(-1);
    select.value=String(inspected);
    const inspect=k=>{
      inspected=k;select.value=String(k);byId('readout').replaceChildren();
      for(const line of lines) {
        const row=line.points.get(k), item=document.createElement('li'), num=document.createElement('strong');
        const heading=document.createElement('span');heading.className='cal-series';heading.textContent=daysText(line.day);
        heading.style.setProperty('--series-color',color(line.style));item.append(heading);
        num.textContent=row?metric.format(row[metric.i]):'—';item.append(num);
        const meta=document.createElement('span');meta.textContent=row?number.format(row[1])+' contracts · '+number.format(row[2])+' events':'No eligible forecasts';
        item.append(meta);byId('readout').append(item);
      }
      const marker=byId('plot').querySelector('.cal-mark');
      if(marker) marker.setAttribute('transform','translate('+markerX(k)+' 0)');
    };
    select.onchange=()=>inspect(Number(select.value));
    const box=byId('plot'), first=periodsSorted[0],last=periodsSorted.at(-1);
    let markerX,prevWidth=0;
    const plot=()=>{
      const width=Math.max(230,Math.floor(box.getBoundingClientRect().width || 640));
      if(width===prevWidth) return;prevWidth=width;box.replaceChildren();
      const left=metric===metrics.bias?70:55,right=width-29,top=30,bottom=234;
      const x=k=>first===last?(left+right)/2:left+(right-left)*(k-first)/(last-first);markerX=x;
      const vals=rows.map(r=>r[metric.i+1]);
      const coarse=Math.max(.002,Math.max(...vals.map(Math.abs))/4), power=10**Math.floor(Math.log10(coarse));
      const step=([1,2,2.5,5,10].find(n=>n*power>=coarse)||10)*power;
      const max=metric===metrics.hit?1:Math.min(1,4*step),min=metric===metrics.bias?-max:0;
      const y=v=>bottom-(v-min)/(max-min)*(bottom-top);
      const svg=svgEl(box,'svg',{viewBox:'0 0 '+width+' 270',role:'img','aria-label':metric.label+' by forecast '+unit+' at '+lines.map(s=>daysText(s.day)).join(', ')+'. Select a period below for values and counts.'});
      svgEl(svg,'text',{x:left,y:14,class:'cal-axis-title'},metric.label);
      for(let i=0;i<=4;i++) {
        const v=min+(max-min)*i/4,py=y(v);
        svgEl(svg,'line',{x1:left,x2:right,y1:py,y2:py,class:v===0?'cal-zero':'cal-grid'});
        svgEl(svg,'text',{x:left-7,y:py+4,'text-anchor':'end'},metric.format(v));
      }
      const labelWidth=unit==='year'?44:57;
      const stride=Math.max(1,Math.ceil((last-first)/Math.max(1,Math.floor((right-left)/labelWidth))));
      for(let k=first;k<=last;k+=stride) {
        if(k!==first && k!==last && x(last)-x(k)<labelWidth) continue;
        svgEl(svg,'text',{x:x(k),y:bottom+22,'text-anchor':'middle'},periodName(k));
      }
      if((last-first)%stride) svgEl(svg,'text',{x:x(last),y:bottom+22,'text-anchor':'middle'},periodName(last));
      const marker=svgEl(svg,'g',{class:'cal-mark',transform:'translate('+x(inspected)+' 0)'});
      svgEl(marker,'line',{x1:0,x2:0,y1:top,y2:bottom,stroke:'#9aaabb','stroke-dasharray':'2 4'});
      for (const {day,style,points} of lines) {
        let prev=-Infinity,path='';
        for(const k of periodsSorted) {
          const row=points.get(k);if(!row) continue;
          path+=(k===prev+1?' L':' M')+x(k)+' '+y(row[metric.i]);prev=k;
        }
        if(path) svgEl(svg,'path',{d:path,fill:'none',stroke:color(style),'stroke-width':2.4,'stroke-dasharray':dash(style)});
        for(const [k,row] of points) {
          const c=svgEl(svg,'circle',{cx:x(k),cy:y(row[metric.i]),r:3.4,fill:row[2]<20?'white':color(style),stroke:color(style),'stroke-width':1.6});
          svgEl(c,'title',{},periodName(k)+' · '+daysText(day)+' · '+metric.format(row[metric.i])+' · '+number.format(row[1])+' contracts · '+number.format(row[2])+' events');
        }
      }
      function pointToPeriod(event) {
        const rect=svg.getBoundingClientRect(),px=(event.clientX-rect.left)*width/rect.width;
        if(px<left-7 || px>right+7) return;
        const nearest=periodsSorted.reduce((a,b)=>Math.abs(x(a)-px)<=Math.abs(x(b)-px)?a:b);
        if(nearest!==inspected) inspect(nearest);
      }
      svg.addEventListener('click',pointToPeriod);
      svg.addEventListener('pointermove',e=>{if(e.pointerType==='mouse') pointToPeriod(e);});
    };
    plot();inspect(inspected);
    if(typeof ResizeObserver!=='undefined') {observer=new ResizeObserver(plot);observer.observe(box);}
  }

  async function render(next,measure='brier') {
    mount();ctx=next;metric=metrics[measure] || metrics.brier;
    if(ctx.day!==previousDay) {
      // A user-selected extra horizon follows the shared day control.
      if(previousDay!==undefined || !fromURL.length) {
        if(autoDay!==undefined && selected.size>1) selected.delete(autoDay);
        autoDay=undefined;
        if(!selected.has(ctx.day) && selected.size<12) {selected.add(ctx.day);autoDay=ctx.day;}
      }
      if(previousDay!==undefined) syncURL();
      previousDay=ctx.day;
    }
    const token=++request;archive=null;clear('Loading calendar results…');
    try {
      const results=await ctx.loadData(ctx.venue,'history/'+ctx.topic.id);
      if(token!==request) return;
      archive=results || {};draw();
    } catch {
      if(token===request) clear('Calendar results could not be loaded. Reopen Charts to retry.');
    }
  }
  window.CalendarLines={render};
})();
