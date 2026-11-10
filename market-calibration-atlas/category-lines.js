/* Compare event categories at the same forecast horizons. */
(() => {
  'use strict';
  const host = () => document.getElementById('category-lines');
  const byId = id => document.getElementById('category-' + id);
  const palette = ['#275ab5','#087863','#ba581d','#82529e','#286d92','#a43e64','#78691e','#484e73'];
  const broadColors = new Map(['Politics','Weather','Sports','Finance','Crypto','Culture','Other','Tech'].map((name,i)=>[name,palette[i]]));
  function seriesColor(topic) {
    if (topic.kind==='all') return '#25334c';
    if (topic.kind==='broad' && broadColors.has(broadName(topic))) return broadColors.get(broadName(topic));
    const hue=(Number(topic.id)*137.5+9)%360;
    return 'hsl('+hue+' 56% 37%)';
  }
  const metrics = {
    brier: { index: 2, name: 'Brier score', format: n => n.toFixed(3), axis: n => n.toFixed(2) },
    hit: { index: 3, name: 'Favorite win rate', format: n => (100*n).toFixed(2)+'%', axis: n => Math.round(100*n)+'%' },
    bias: { index: 4, name: 'Signed calibration bias', format: n => (n>0?'+':'')+(100*n).toFixed(2)+' pp', axis: n => (100*n).toLocaleString('en-US', {maximumFractionDigits:2})+' pp' }
  };
  const broadName = t => t.kind === 'broad' ? t.name.replace(/^All /, '') : t.name;
  const count = n => n.toLocaleString('en-US');
  const valid = (row, metric) => row && row[0] > 0 && Number.isFinite(row[metric.index]);
  const element = (tag, attrs, content) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (content !== undefined) node.textContent = content;
    return node;
  };
  let pairedSample=new URLSearchParams(location.search).get('catcohort')==='paired';
  let ctx, metric, matrix, pairs, selected, extended, lastScope, lastVenue, observer, request=0;

  function setup() {
    host().classList.add('panel');
    host().innerHTML = `
      <div class="sectionhead"><div><div class="eyebrow">EVENT CATEGORIES</div><h2>Accuracy by days before cutoff</h2></div>
      <button class="export" type="button" id="category-export">Download CSV ↓</button></div>
      <p class="hint" id="category-scope"></p>
      <div class="category-actions"><label>Sample <select id="category-sample"><option value="each">Eligible at each horizon</option><option value="paired">Same contracts at both horizons</option></select></label>
        <label id="category-pair-label" hidden>Compare <select id="category-pair"></select></label></div>
      <div class="category-actions"><label>Add an event type <select id="category-add"></select></label>
        <button class="export" type="button" id="category-all">Select all categories</button>
        <button class="export" type="button" id="category-clear">Clear</button>
        <label id="category-extended-label"><input id="category-extended" type="checkbox"> Include horizons beyond one year</label></div>
      <div id="category-legend" role="group" aria-label="Event category lines"></div>
      <div id="category-plot"></div>
      <p id="category-readout" aria-live="polite"></p>
      <p class="hint" id="category-method"></p>
      <details id="category-details"><summary>Chart data and sample sizes</summary><div class="scroll"><table aria-label="Category forecasts by horizon"><thead><tr><th>Event type</th><th>Days before cutoff</th><th id="category-measure"></th><th>Contracts</th><th>Events</th></tr></thead><tbody id="category-rows"></tbody></table></div></details>`;
    const pairMenu=document.getElementById('charts-pair');
    byId('pair').replaceChildren(...Array.from(pairMenu.options,option=>new Option(option.textContent,option.value)));
    pairMenu.addEventListener('change',()=>{if(pairedSample && matrix) draw();});
    byId('pair').onchange=e=>{pairMenu.value=e.target.value;pairMenu.dispatchEvent(new Event('change',{bubbles:true}));};
    byId('sample').onchange=e=>{pairedSample=e.target.value==='paired';changed();};
    byId('all').onclick = () => {
      ctx.metas[ctx.venue].topics.filter(t=>t.kind==='broad').forEach(t=>selected.add(t.id));
      changed();
    };
    byId('clear').onclick = () => { selected.clear(); changed(); };
    byId('add').onchange = e => { if(e.target.value) selected.add(e.target.value); changed(); };
    byId('extended').onchange = e => { extended=e.target.checked; changed(); };
    if (typeof ResizeObserver !== 'undefined') {
      let previous=0;
      observer=new ResizeObserver(entries=>{
        const w=Math.round(entries[0].contentRect.width);
        if (w>0 && w!==previous && ctx && matrix) {previous=w; draw();}
      });
      observer.observe(byId('plot'));
    }
  }

  function changed() {
    const url=new URL(location.href);
    url.searchParams.set('catset',ctx.venue+'.'+[...selected].join(','));
    if(pairedSample) url.searchParams.set('catcohort','paired');else url.searchParams.delete('catcohort');
    if(extended) url.searchParams.set('catrange','long'); else url.searchParams.delete('catrange');
    history.replaceState(null,'',url);
    draw();
  }

  function initialSelection(topics) {
    const broad=topics.filter(t=>t.kind==='broad');
    const result = broad.length>1
      ? broad.filter(t=>['Politics','Sports','Weather','Finance'].includes(broadName(t))).map(t=>t.id)
      : topics.filter(t=>t.kind==='detail').sort((a,b)=>b.n-a.n).slice(0,3).map(t=>t.id);
    return result.length ? result : topics.slice(0,1).map(t=>t.id);
  }

  async function render(context, key) {
    const serial=++request;
    if(!host()) return;
    if (!byId('plot')) setup();
    ctx=context; metric=metrics[key]||metrics.brier;
    const params=new URLSearchParams(location.search), topics=ctx.metas[ctx.venue].topics;
    if(lastVenue!==ctx.venue) {
      const saved=params.get('catset') || '', prefix=ctx.venue+'.';
      const ids=saved.startsWith(prefix) ? saved.slice(prefix.length).split(',').filter(id=>topics.some(t=>t.id===id)) : initialSelection(topics);
      selected=new Set(ids);
      extended=params.get('catrange')==='long';
    }
    if (ctx.topic.kind!=='all' && (lastScope!==ctx.topic.id || lastVenue!==ctx.venue)) {
      // A shared custom selection, including an explicitly empty one, takes precedence on first load.
      if(lastVenue!==undefined || !params.get('catset')?.startsWith(ctx.venue+'.')) selected.add(ctx.topic.id);
    }
    const needsData = lastVenue!==ctx.venue || !matrix;
    lastScope=ctx.topic.id;lastVenue=ctx.venue;
    if (needsData) {
      matrix=null;
      byId('export').disabled=true;
      byId('legend').replaceChildren();byId('rows').replaceChildren();byId('readout').textContent='';
      byId('plot').textContent='Loading category forecasts…';
      try {
        const [loaded,matched]=await Promise.all([
          ctx.loadData(ctx.venue,'matrix'),ctx.readJSON('data/'+ctx.venue+'/matched.json')
        ]);
        if(serial!==request) return;
        matrix=loaded;pairs=matched;
      } catch (_) {
        if(serial===request) byId('plot').textContent='Category forecasts could not be loaded. Reopen the chart to try again.';
        return;
      }
    }
    if(serial===request) draw();
  }

  function controls(topics,chosen,colors) {
    const legend=byId('legend'), picker=byId('add'), prior=document.activeElement?.dataset.category;
    legend.replaceChildren();picker.replaceChildren(new Option('Choose a category or topic…',''));
    for(const [kind,label] of [['all','Overview'],['broad','Categories'],['detail','Specific event types']]) {
      const opts=topics.filter(t=>t.kind===kind && !selected.has(t.id));
      if(opts.length) {
        const group=document.createElement('optgroup');group.label=label;
        for(const t of opts) group.append(new Option(broadName(t),t.id));
        picker.append(group);
      }
    }
    const legendTopics=topics.filter(t=>t.kind==='broad' || selected.has(t.id));
    for(const t of legendTopics) {
      const active=selected.has(t.id), button=document.createElement('button');
      button.type='button';button.className='category-chip';button.dataset.category=t.id;
      button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',broadName(t));
      const marker=document.createElement('span');marker.className='category-marker';
      if(active) marker.style.cssText='background:'+colors.get(t.id)+';border-color:'+colors.get(t.id);
      button.append(marker,document.createTextNode(broadName(t)));
      button.onclick=()=>{if(selected.has(t.id))selected.delete(t.id);else selected.add(t.id);changed();};legend.append(button);
      if(prior===t.id) button.focus({preventScroll:true});
    }
    byId('all').disabled=!topics.some(t=>t.kind==='broad' && !selected.has(t.id));
    byId('clear').disabled=!chosen.length;
    byId('extended-label').hidden=pairedSample || ctx.metas[ctx.venue].maxDays<730;
    byId('sample').value=pairedSample?'paired':'each';
    byId('pair-label').hidden=!pairedSample;
    byId('pair').value=document.getElementById('charts-pair').value;
    byId('extended').checked=extended;
  }

  function draw() {
    if(!matrix) return;
    const topics=ctx.metas[ctx.venue].topics, chosen=topics.filter(t=>selected.has(t.id));
    const colors=new Map(chosen.map(t=>[t.id,seriesColor(t)]));
    controls(topics,chosen,colors);
    const max=ctx.metas[ctx.venue].maxDays;
    let days=[1,7,30,90,180,365,...(extended?[730,1095]:[])].filter(d=>d<=max);
    if(Number.isInteger(ctx.day) && !days.includes(ctx.day)) days.push(ctx.day);
    const pair=byId('pair').value, [far,near]=pair.split('/').map(Number);
    if(pairedSample) days=[near,far];
    days.sort((a,b)=>a-b);
    const rowAt=(topic,day)=>{
      if(!pairedSample) return matrix[day]?.[topic.id];
      const row=pairs[topic.id]?.[pair];
      if(!row || !row[0]) return undefined;
      const offset=day===far?0:1;
      return [row[0],row[1],row[2+offset],row[4+offset],row[6+offset]];
    };
    byId('method').textContent=pairedSample
      ? 'Both points on a category line use the same contracts, each with a qualifying favorite at both horizons. The favored side can change. Hollow points have fewer than 20 contracts.'
      : 'Horizons are spaced evenly. Each point includes contracts with an eligible price at that horizon. Hollow points have fewer than 20 contracts. The mix of contracts can change between horizons.';
    const venue=ctx.venues.find(v=>v.id===ctx.venue)?.name || ctx.venue;
    byId('scope').textContent=venue+' · Compare categories across the same forecast horizons.';
    const rows=chosen.flatMap(t=>days.map(day=>({topic:t,day,row:rowAt(t,day)})));
    const observed=rows.filter(d=>valid(d.row,metric));
    // Election clock (follow-up study 11, review round 2 R2-2): rows holding 2024 US election prices traded after the
    // polls closed get a ring and their value without those prices (dist/election-caveat.js). A paired sample is a
    // subset of the rows, so it gets the full rows' counts as a footnote instead.
    const A=window.AtlasElectionCaveat, withoutKey={2:'brier',3:'winRate',4:'bias'}[metric.index];
    const flagOf=(topic,day,row)=>!pairedSample && A && row ? A.check(ctx.caveat,ctx.venue,topic,day,row) : null;
    const flags=rows.map(d=>flagOf(d.topic,d.day,d.row));
    const unavailable=flags.some(f=>f&&f.unavailable), ringed=flags.some(f=>f&&!f.unavailable);
    if(A) A.footnote('category-election',byId('method'),unavailable?A.UNAVAILABLE:pairedSample
      ? A.rowsNote(ctx.caveat,ctx.venue,chosen.flatMap(t=>[far,near].map(day=>({topic:t,day}))))
      : ringed?'Ringed points include 2024 US election prices traded after the polls closed on 5 November 2024. Inspect one for the count and its value without them.':'',
      ringed&&!unavailable?'election-ring':null);
    const postElection=i=>{const f=flags[i];return f?(f.unavailable?'unavailable':f.contracts):(A&&A.VENUES.includes(ctx.venue)&&!pairedSample?0:'');};
    byId('measure').textContent=metric.name;
    byId('rows').innerHTML=rows.map(({topic,day,row})=>'<tr><td>'+ctx.escape(broadName(topic))+'</td><td>'+count(day)+'</td><td>'+(valid(row,metric)?metric.format(row[metric.index]):'—')+'</td><td>'+count(row?.[0]||0)+'</td><td>'+count(row?.[1]||0)+'</td></tr>').join('');
    byId('export').disabled=!observed.length;
    byId('export').onclick=()=>ctx.exportCSV(ctx.venue+'-category-chart-'+(pairedSample?'paired-'+far+'-'+near:'eligible')+'-'+metric.index+'.csv',
      ['venue','event_type','days_before_cutoff','metric','value','value_unit','contracts','events','status','sample','paired_horizons','post_election_contracts'],
      rows.map(({topic,day,row},i)=>[venue,topic.name,day,metric.name,valid(row,metric)?row[metric.index]:'',metric===metrics.brier?'Brier score':'probability units (1.0 = 100%)',row?.[0]||0,row?.[1]||0,valid(row,metric)?'Observed':'No eligible observation',pairedSample?'Same contracts at both horizons':'Eligible at each horizon',pairedSample?pair:'',postElection(i)]));
    const plot=byId('plot');
    plot.replaceChildren();byId('readout').textContent='';
    if(!observed.length) {
      const empty=document.createElement('p');empty.className='category-empty';
      empty.textContent=chosen.length?'No eligible observations for these event types at the displayed horizons.':'Select a category or add an event type to draw a line.';
      plot.append(empty);return;
    }
    const width=Math.max(245,Math.round(plot.getBoundingClientRect().width)||700), height=width<480?240:285;
    const left=metric===metrics.bias?60:45,right=width-18,top=29,bottom=height-42;
    const x=i=>days.length>1 ? left+i*(right-left)/(days.length-1) : (left+right)/2;
    const vals=observed.map(d=>d.row[metric.index]);
    let low=Math.min(...vals), high=Math.max(...vals);
    if(metric===metrics.bias) {low=Math.min(low,0);high=Math.max(high,0);}
    const span=Math.max(high-low,metric===metrics.bias ? 0.02 : 0.08);
    const rawStep=span/4, power=Math.pow(10,Math.floor(Math.log10(rawStep)));
    const step=[1,2,2.5,5,10].map(n=>n*power).find(n=>n>=rawStep*(1-1e-12)) || power*10;
    low=Math.floor(low/step)*step;high=Math.ceil(high/step)*step;
    if(high<=low+1e-12) { low-=step;high+=step; }
    if(metric!==metrics.bias) {low=Math.max(0,low);high=Math.min(1,high);}
    const y=v=>bottom-(v-low)*(bottom-top)/(high-low);
    const svg=element('svg',{viewBox:'0 0 '+width+' '+height,width:'100%',height,role:'group','aria-label':metric.name+' by event type and days before cutoff. Inspect a point for counts.'});
    const add=(tag,attrs,text)=>{const el=element(tag,attrs,text);svg.append(el);return el;};
    add('text',{x:left,y:15,class:'category-axis-title'},metric.name);
    for(let i=0;i<=Math.round((high-low)/step);i++) {
      const tick=+(low+i*step).toFixed(10), yy=y(tick);
      add('line',{x1:left,x2:right,y1:yy,y2:yy,class:metric===metrics.bias&&Math.abs(tick)<1e-8?'category-zero':'category-grid'});
      add('text',{x:left-8,y:yy+4,'text-anchor':'end'},metric.axis(tick));
    }
    days.forEach((day,i)=>{
      const label=width<560&&day>=365&&day%365===0?(day/365)+'y':day+'d';
      add('text',{x:x(i),y:bottom+17,'text-anchor':'middle'},label);
    });
    add('text',{x:(left+right)/2,y:height-3,'text-anchor':'middle',class:'category-axis-title'},'Days before cutoff');
    for(const t of chosen) {
      let path='', move=true;
      const points=[];
      days.forEach((day,i)=>{
        const row=rowAt(t,day);
        if(!valid(row,metric)) {move=true;return;}
        const px=x(i), py=y(row[metric.index]);
        path+=(move?'M':' L')+px+' '+py;move=false;points.push({day,row,px,py});
      });
      const color=colors.get(t.id);
      add('path',{d:path,fill:'none',stroke:color,'stroke-width':2.3,'stroke-linejoin':'round','stroke-linecap':'round'});
      for(const {day,row,px,py} of points) {
        const flag=flagOf(t,day,row), late=flag&&!flag.unavailable;
        const text=broadName(t)+' · '+day+(day===1?' day':' days')+' · '+metric.name+' '+metric.format(row[metric.index])+' · '+count(row[0])+' contracts · '+count(row[1])+' events'+
          (late?' · '+A.phrase(flag,w=>metric.format(w[withoutKey])):'');
        const g=add('g',{tabindex:0,role:'img','aria-label':text,class:'category-point'});
        g.append(element('title',{},text),element('circle',{cx:px,cy:py,r:8,fill:'transparent'}),element('circle',{cx:px,cy:py,r:3.8,fill:row[0]<20?'white':color,stroke:color,'stroke-width':1.8}));
        if(late) g.append(element('circle',{cx:px,cy:py,r:7,fill:'none',stroke:'#b4561d','stroke-width':1.6}));
        const show=()=>{byId('readout').textContent=text;};
        g.onpointerenter=g.onclick=g.onfocus=show;
      }
    }
    plot.append(svg);
    byId('readout').textContent='Tap, hover or focus a point to see its value and sample size.';
  }
  window.CategoryLines={render};
})();
