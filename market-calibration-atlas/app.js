'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('en-US');
  const exists = v => v !== null && v !== undefined && Number.isFinite(+v);
  const formatInt = v => exists(v) ? nf.format(v) : '—';
  const formatPct = v => exists(v) ? (v * 100).toFixed(2) + '%' : '—';
  const formatGap = v => exists(v) ? (v > 0 ? '+' : '') + (100 * v).toFixed(2) + ' pp' : '—';
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cache = new Map();
  const metas = {};
  const q = new URLSearchParams(location.search);
  const state = {venue:q.get('venue') || 'all', topic:q.get('topic') || '0', day:validDay(q.get('day'))||1, tab:parseTab()};
  let venues = [], current = null, pending = 0, oddsRequest = 0;
  const topic = () => metas[state.venue].topics.find(v => v.id === state.topic);
  function validDay(v) { return Number.isSafeInteger(+v) && +v > 0 && +v < 100000 ? +v : 0; }
  function parseTab() { return ['charts','intraday','validation','spreads','compare','history','coverage'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'explore'; }
  function setChoice(id, value) { if (Array.from($(id).options).some(o => o.value === value)) $(id).value = value; }
  function updateURL() {
    const u = new URL(location.href);
    for (const [k,v] of Object.entries({venue:state.venue,topic:state.topic,day:state.day,gran:$('gran').value,
      pair:$('pair').value,price:$('compare-price').value,match:$('compare-match').value,margin:$('compare-radius').value,trend:$('trendmetric').value,sort:$('sort').value,min:$('min-events').value})) u.searchParams.set(k,v);
    for(const key of ['side','cs','wside']) u.searchParams.delete(key);
    u.hash=state.tab;
    history.replaceState(null,'',u);
  }
  async function readJSON(path) {
    if (cache.has(path)) return cache.get(path);
    const promise = (async () => {
      const r = await fetch(path);
      if (!r.ok) throw Error('Could not load ' + path + ' (' + r.status + ').');
      if (!path.endsWith('.gz')) return r.json();
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes[0] !== 31 || bytes[1] !== 139) return JSON.parse(new TextDecoder().decode(bytes));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).json();
    })();
    cache.set(path,promise);
    try { return await promise; } catch (e) { cache.delete(path); throw e; }
  }
  const loadData = (vid,tid) => readJSON('data/'+encodeURIComponent(vid)+'/'+String(tid).split('/').map(encodeURIComponent).join('/')+'.json.gz');
  function resolveRows(entry,mode) {
    if (!entry) return [];
    let v = entry[mode];
    for (let i=0; typeof v==='string' && i<7; i++) v=entry[v];
    return Array.isArray(v) ? v : [];
  }
  function exportCSV(file,header,rows) {
    const quote = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const csv = [header,...rows].map(row=>row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));
    const a = document.createElement('a'); a.href=url; a.download=file.endsWith('.csv')?file:file+'.csv';
    document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function showError(err) { $('error').hidden=false; $('error').textContent='The selected data could not be displayed. '+err.message+' Reload to retry.'; }
  function fillTopics() {
    const sel=$('topic'); sel.replaceChildren();
    const groups=[['all','Overview'],['broad','Categories'],['detail','Specific event types']];
    for (const [kind,label] of groups) {
      const opts=metas[state.venue].topics.filter(t=>t.kind===kind);
      if (!opts.length) continue;
      const group=document.createElement('optgroup');group.label=label;
      for(const t of opts)group.append(new Option(t.name,t.id));
      sel.append(group);
    }
    if (!topic()) state.topic='0'; sel.value=state.topic;
  }
  function filters() {
    $('venue').value=state.venue; $('topic').value=state.topic; $('day').value=state.day;
    const choices=[1,7,30,90,180,365,730,1095].filter(n=>n<=Math.max(365,metas[state.venue].maxDays));
    $('quick').replaceChildren();
    for (const n of choices) {
      const b=document.createElement('button');b.textContent=formatInt(n)+'d';b.className=n===state.day?'selected':'';
      b.setAttribute('aria-pressed',String(n===state.day));b.onclick=()=>chooseDay(n);$('quick').append(b);
    }
  }
  function chooseDay(d) { if(!validDay(d)) return; state.day=+d; filters(); refresh(); }
  function select(vid,tid,day) {
    state.venue=vid;state.topic=String(tid);state.day=day;fillTopics();filters();openView('explore');
    $('controls').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function context() {
    return {venues,metas,venue:state.venue,topic:topic(),day:state.day,loadData,readJSON,resolveRows,select,chooseDay,exportCSV,formatPct,formatInt,formatGap,escape};
  }
  function openView(tab) {
    state.tab=tab;
    for (const v of ['explore','charts','intraday','validation','spreads','compare','history','coverage']) $(v).hidden=v!==tab;
    document.querySelectorAll('[data-nav]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.nav===tab)));
    $('main-day-label').textContent=tab==='charts'?'Extra horizon (days)':'Days before cutoff';
    $('quick').hidden=tab==='charts'||tab==='intraday';
    document.querySelector('.filter.day').hidden=tab==='intraday';
    $('controls').hidden=tab==='coverage';$('clocknote').hidden=tab==='coverage';refresh();
  }
  async function modesTable(record) {
    const req=++oddsRequest,rev=pending,mode=$('gran').value;
    let rows=[];
    if (record && mode==='original') {
      $('rows').innerHTML='<tr><td colspan="6">Loading fractional prices…</td></tr>';
      $('download').disabled=true;$('pages').hidden=true;
      try { rows=await AtlasWindows.exactRows(context(),state.venue,topic(),state.day); }
      catch(err) { if(req===oddsRequest && rev===pending){showError(err);$('rows').innerHTML='<tr><td colspan="6">Price data unavailable.</td></tr>';AtlasCharts.reliability($('relchart'),[]);}return; }
      if(req!==oddsRequest || rev!==pending)return;
    } else rows=resolveRows(record,'fx');
    const minimum=Math.max(0,Math.trunc(Number($('min-events').value)||0));
    const data=rows.filter(r=>r[0]>=51 && r[2]>=minimum).map(([price,n,events,p,wins])=>({label:String(price)+'%',n,events,p,y:wins/n,wins}));
    const criterion=$('sort').value;
    if(criterion==='size')data.sort((a,b)=>b.n-a.n);
    if(criterion==='best'||criterion==='worst')data.sort((a,b)=>(Math.abs(a.y-a.p)-Math.abs(b.y-b.p))*(criterion==='best'?1:-1));
    AtlasCharts.reliability($('relchart'),data);
    let page=0;
    function drawPage() {
      const from=page*50;
      $('rows').innerHTML=data.slice(from,from+50).map(r=>'<tr><td>'+r.label+'</td><td class="rates">'+formatPct(r.y)+'</td><td class="diff">'+formatGap(r.y-r.p)+'</td><td>'+formatInt(r.wins)+'</td><td>'+formatInt(r.n)+'</td><td>'+formatInt(r.events)+'</td></tr>').join('')||'<tr><td colspan="6">No qualifying observations for this selection.</td></tr>';
      $('pages').hidden=data.length<=50;
      $('page-count').textContent=formatInt(from+1)+'–'+formatInt(Math.min(from+50,data.length))+' of '+formatInt(data.length)+' prices';
      $('prev-page').disabled=!page;$('next-page').disabled=from+50>=data.length;
    }
    $('prev-page').onclick=()=>{if(page>0){page--;drawPage();}};
    $('next-page').onclick=()=>{if((page+1)*50<data.length){page++;drawPage();}};
    drawPage();
    $('bandnote').textContent=(mode==='original'?'Each row is a distinct quoted chance, including fractional percentages.':'Each row is an exact whole percentage from 51% through 100% that has observations.')+' Gap is the win rate minus the quote. '+(criterion==='best'||criterion==='worst'?'Small samples can rank highly by chance.':'Each contract counts once at this horizon.');
    $('download').disabled=!data.length;
    $('download').onclick=()=>exportCSV(state.venue+'-day-'+state.day+'-topic-'+state.topic+'-'+mode,
      ['venue','topic','days','side','price_selection','quoted_probability','observed_win_rate','gap_pp','wins','contracts','events'],
      data.map(r=>[state.venue,topic().name,state.day,'favorite',mode,r.p,r.y,(r.y-r.p)*100,r.wins,r.n,r.events]));
  }
  function renderTrend() {
    const series=Object.entries(current||{}).map(([d,r])=>[+d,...r.s]);
    window.AtlasCharts.horizon($('trendchart'),series,state.day,chooseDay,$('trendmetric').value);
    $('trend-export').onclick=()=>exportCSV(state.venue+'-topic-'+state.topic+'-all-horizons',
      ['venue','event_type','days','contracts','events','brier','favorite_win_rate','signed_bias_pp'],
      series.sort((a,b)=>a[0]-b[0]).map(([d,n,e,b,h,c])=>[state.venue,topic().name,d,n,e,b,h,c*100]));
  }
  function renderExplore(record) {
    const s=record?.s;
    const from=venues.find(v=>v.id===state.venue).name;
    $('empty').hidden=!!s && s[1]>=20;
    $('empty').textContent=s?'Only '+formatInt(s[1])+' distinct events qualified at this horizon. A few outcomes can move these rates substantially.':
      'No qualifying price for '+from+' · '+topic().name+' at '+formatInt(state.day)+' days. Choose another horizon on the trend chart below.';
    const cards=[
      ['Brier score',exists(s?.[2])?s[2].toFixed(3):'—','Lower is better · 0 is perfect'],
      ['Actual favorite win rate',formatPct(s?.[3]),s?'Odds implied '+formatPct(s[3]-s[4])+' wins':'Among favorites priced at 51% or higher'],
      ['Signed bias',formatGap(s?.[4]),'Actual win rate minus mean forecast'],
      ['Contracts',formatInt(s?s[0]:0),formatInt(s?s[1]:0)+(state.venue==='all'?' venue-specific events':' distinct parent events')]
    ];
    $('kpis').innerHTML=cards.map(([title,v,detail])=>'<div class="kpi"><label>'+title+'</label><strong>'+v+'</strong><small>'+detail+'</small></div>').join('');
    if(window.AtlasElectionCaveat)window.AtlasElectionCaveat.render(context(),record);

    modesTable(record);renderTrend();
  }
  async function matched(revision, inCharts=false) {
    const menu=$(inCharts?'charts-pair':'pair');
    const panel=$(inCharts?'charts-paired-results':'matched'), key=menu.value;
    try {
      const pairs=await readJSON('data/'+state.venue+'/matched.json');
      if (revision!==pending || key!==menu.value) return;
      const row=pairs[state.topic]?.[key], [a,b]=key.split('/');
      if (!inCharts) PairedBars.renderCategories($('landing-category-bars'),$('landing-category-summary'),context(),pairs,a,b);
      if (!row || !row[0]) {panel.textContent='No contracts had qualifying prices at both horizons.';return;}
      const [n,e,far,near,farHit,nearHit,farGap,nearGap]=row;
      const allA=!inCharts && current?.[a]?.s, allB=!inCharts && current?.[b]?.s;
      const dayLabel=d=>formatInt(+d)+(+d===1?' day':' days');
      const rounded=x => exists(x)?x.toFixed(4):'—';
      panel.innerHTML='<div class="scroll"><table><thead><tr><th>Matched sample</th><th>Brier score</th><th>Favorite win rate</th><th>Signed bias</th></tr></thead><tbody>'+
        '<tr><td>'+dayLabel(a)+' before</td><td>'+rounded(far)+'</td><td>'+formatPct(farHit)+'</td><td>'+formatGap(farGap)+'</td></tr>'+
        '<tr><td>'+dayLabel(b)+' before</td><td>'+rounded(near)+'</td><td>'+formatPct(nearHit)+'</td><td>'+formatGap(nearGap)+'</td></tr></tbody></table></div>'+
        '<p class="hint">'+formatInt(n)+' matched contracts across '+formatInt(e)+' events. The favorite qualified at both horizons.</p>'+
        (allA && allB?'<p class="hint">Across all eligible contracts, the '+a+'-day view includes '+formatInt(allA[0])+' contracts and the '+b+'-day view includes '+formatInt(allB[0])+'. The table above holds the contracts fixed.</p>':'');
      window.PairedBars.render(panel,a,b,row);
    } catch(e) {
      if (revision===pending && key===menu.value) {
        panel.textContent='Matched comparison unavailable. Reload to retry.';
        if(!inCharts) { $('landing-category-bars').replaceChildren(); $('landing-category-summary').textContent=panel.textContent; }
      }
    }
  }
  async function refresh() {
    if (!venues.length) return;
    const cutoff={polymarket:'the earlier of scheduled expiration and recorded close',kalshi:'the reported trading close',manifold:'the earlier of question close and resolution',predictit:'the general election or decisive runoff date',iem:'the election date',intrade:'the election date'};
    const daily=['iem','intrade','predictit'].includes(state.venue);
    const source=venues.find(v=>v.id===state.venue);
    $('clocknote').textContent=state.venue==='all'
      ? 'All six venues, including play-money Manifold. Each qualifying contract counts once per venue at the selected horizon. The same event can appear on multiple venues.'
      : source.name+' · '+source.money+' · Days before '+cutoff[state.venue]+'. '+(daily?'Only trading dates with positive volume qualify.':'Only trades in the eligible 24-hour window qualify.')+' Furthest observed for this event type: '+formatInt(topic().maxDays)+' days.';
    const revision=++pending; updateURL(); $('error').hidden=true; $('loading').hidden=true;
    if (state.tab==='coverage') { window.AtlasCompare.coverage(context());renderAudit();return; }
    if (state.tab==='intraday') {
      $('clocknote').textContent='Intraday histories use separate source cohorts. The Market and Event type filters apply; hour and movement controls are in this view.';
      try { await window.AtlasIntraday.render(context()); } catch(err) { if(revision===pending) showError(err); }
      return;
    }
    if (state.tab==='validation') {
      $('clocknote').textContent='Additional checks use the downloadable Polymarket and Kalshi panels. Event IDs are venue-specific; actual event occurrence has not been independently verified.';
      try { await window.AtlasValidation.render(context()); } catch(err) { if(revision===pending) showError(err); }
      return;
    }
    if (state.tab==='charts') {
      const metric=$('chart-metric').value;
      $('chart-reading').textContent={brier:'Lower Brier scores mean forecasts were closer to the outcomes. A 50% forecast on every contract scores 0.25.',hit:'Favorite win rate is the share of contracts won by the side priced at 51% or above. An event type with more heavy favorites can have a higher win rate.',bias:'Signed bias is the actual favorite win rate minus the average forecast, in percentage points. Zero means they agree on average.'}[metric];
      try { await Promise.all([CalendarLines.render(context(),metric),CategoryLines.render(context(),metric),matched(revision,true)]); }
      catch(err) { if(revision===pending) showError(err); }
      return;
    }
    if (state.tab==='spreads') {
      $('clocknote').textContent='The spread analysis uses a smaller sample with historical bids, asks and resolved outcomes. Each quote source is shown separately.';
      try { await QuoteStudy.render(context()); } catch(err) { if(revision===pending) showError(err); }
      return;
    }
    if (state.tab==='compare') {
      try { await window.AtlasCompare.render(context()); } catch(err) { if(revision===pending) showError(err); }
      return;
    }
    if (state.tab==='history') {
      try { await window.AtlasHistory.render(context()); } catch(err) {if(revision===pending) showError(err);}
      return;
    }
    const requested=state.venue,tid=state.topic;
    $('loading').hidden=false;$('explore').setAttribute('aria-busy','true');
    try {
      const loaded=await loadData(requested,tid);
      if (revision!==pending || state.tab!=='explore') return;
      current=loaded;
      const record=current[state.day]; renderExplore(record); matched(revision);
      Promise.resolve(window.AtlasWindows.render(context())).catch(err=>{if(revision===pending)showError(err);});

    } catch(err) { if(revision===pending) {current=null;$('explore').hidden=true;showError(err);} }
    finally { if(revision===pending) {$('loading').hidden=true;$('explore').removeAttribute('aria-busy');if(current)$('explore').hidden=false;} }
  }
  let auditVenue='both', auditCategory='All categories', auditBasis='7/1';
  async function renderAudit() {
    const host=$('refresh-audit');
    if(!host) return;
    try {
      const audit=await readJSON('data/research-audit.json');
      function draw() {
        const cats=Object.keys(audit.tables[auditVenue]);
        if(!cats.includes(auditCategory)) auditCategory='All categories';
        const scope=audit.tables[auditVenue][auditCategory];
        const paired=scope.matched[auditBasis];
        const days=auditBasis.split('/');
        const rows=(auditBasis==='eligible'?Object.entries(scope.horizons):paired?[[days[0],paired.far],[days[1],paired.near]]:[]).filter(([,row])=>row);
        host.innerHTML='<div class="eyebrow">SEPARATE EXTERNAL BENCHMARK · OCTOBER 2026</div><h2>Do newer data tell the same story?</h2>'+
          '<p class="hint">'+formatInt(audit.uniqueContracts)+' unique high-volume contracts in the <a href="'+escape(audit.source)+'" target="_blank" rel="noopener">PredictDesks Research download</a>, with reference dates through '+escape(audit.referenceEnd.slice(0,10))+'. These records are kept separate from the main charts because their sampling and price definitions differ.</p>'+
          '<div class="rowcontrols"><label>Benchmark venue <select id="audit-venue"><option value="both">Both venues</option><option value="polymarket">Polymarket</option><option value="kalshi">Kalshi</option></select></label><label>Source category <select id="audit-category">'+cats.map(c=>'<option>'+escape(c)+'</option>').join('')+'</select></label><label>Sample <select id="audit-basis"><option value="7/1">Same contracts: 7 vs. 1 day</option><option value="30/7">Same contracts: 30 vs. 7 days</option><option value="30/1">Same contracts: 30 vs. 1 day</option><option value="eligible">All eligible at each horizon</option></select></label></div>'+
          '<div class="scroll"><table aria-label="Independent October benchmark"><thead><tr><th>Days before cutoff</th><th>Contracts</th><th>Expected wins</th><th>Actual wins</th><th>Gap</th><th>Brier</th></tr></thead><tbody>'+rows.map(([d,r])=>'<tr><td>'+d+'</td><td>'+formatInt(r.n)+'</td><td>'+formatPct(r.expected)+'</td><td>'+formatPct(r.actual)+'</td><td>'+formatGap(r.gap)+'</td><td>'+(Number.isFinite(r.brier)?r.brier.toFixed(4):'—')+'</td></tr>').join('')+(rows.length?'':'<tr><td colspan="6">No qualifying contracts for this selection.</td></tr>')+'</tbody></table></div>'+
          '<p class="hint">Only contracts with at least 100,000 final volume qualify (dollars on Polymarket; contracts on Kalshi). Event IDs and individual quote timestamps are absent, so these rows have no event-clustered intervals. The category labels are from this source. Missing prices are screened out; they are never filled in.</p>'+
          '<details class="quote-method"><summary>Source differences and audit</summary><p>'+escape(audit.method)+'</p><ul>'+audit.limits.map(t=>'<li>'+escape(t)+'</li>').join('')+'</ul><p>Removed '+audit.exactDuplicatesRemoved+' duplicate rows and '+audit.invalidForecastsExcluded.length+' out-of-range forecast. '+escape(audit.attribution)+' Licensed <a href="'+escape(audit.license)+'" target="_blank" rel="noopener">CC BY 4.0</a>.</p></details><div class="downloads"><a href="'+escape(audit.localDownload)+'" download>Original CSV · gzip</a><a href="data/research-audit.json" download>Recalculated results and audit · JSON</a></div>';
        $('audit-venue').value=auditVenue;$('audit-category').value=auditCategory;$('audit-basis').value=auditBasis;
        $('audit-venue').onchange=e=>{auditVenue=e.target.value;draw();};
        $('audit-category').onchange=e=>{auditCategory=e.target.value;draw();};
        $('audit-basis').onchange=e=>{auditBasis=e.target.value;draw();};
      }
      draw();
    } catch(e) { host.textContent='External benchmark unavailable. Reload to retry.'; }
  }
  async function initialize() {
    venues=(await readJSON('data/index.json')).venues;
    await Promise.all(venues.map(async v=>{metas[v.id]=await readJSON('data/'+v.id+'/meta.json');}));
    if(!metas[state.venue])state.venue=venues[0].id;
    venues.forEach(v=>$('venue').append(new Option(v.name,v.id)));
    for(const [id,k] of [['gran','gran'],['trendmetric','trend'],['compare-match','match'],['pair','pair'],['sort','sort']])setChoice(id,q.get(k));
    if(q.has('min') && Number.isSafeInteger(+q.get('min')) && +q.get('min')>=0)$('min-events').value=q.get('min');
    if(q.has('price') && Number.isFinite(+q.get('price')) && +q.get('price')>=51 && +q.get('price')<=100) $('compare-price').value=q.get('price');
    if(q.has('margin') && q.get('margin')!=='' && Number.isFinite(+q.get('margin')) && +q.get('margin')>=0 && +q.get('margin')<=100)$('compare-radius').value=q.get('margin');
    setChoice('chart-metric',q.get('cm'));
    $('chart-metric').onchange=()=>{const u=new URL(location.href);u.searchParams.set('cm',$('chart-metric').value);history.replaceState(null,'',u);refresh();};
    $('charts-pair').replaceChildren(...Array.from($('pair').options,o=>o.cloneNode(true)));
    $('charts-pair').value=$('pair').value;
    fillTopics();filters();openView(state.tab);
    $('venue').onchange=()=>{const old=topic();state.venue=$('venue').value;state.topic=metas[state.venue].topics.find(t=>t.name===old.name && t.kind===old.kind)?.id||'0';fillTopics();filters();refresh();};
    $('topic').onchange=()=>{state.topic=$('topic').value;refresh();};
    $('day').onchange=()=>{if(validDay($('day').value))chooseDay(+$('day').value);else $('day').value=state.day;};
    for(const id of ['gran','sort','min-events'])$(id).onchange=()=>{modesTable(current?.[state.day]);updateURL();};
    $('trendmetric').onchange=()=>{renderTrend();updateURL();};
    $('pair').onchange=()=>{$('charts-pair').value=$('pair').value;matched(pending);updateURL();};
    $('charts-pair').onchange=()=>{$('pair').value=$('charts-pair').value;matched(pending,true);updateURL();};
    for(const id of ['compare-price','compare-match','compare-radius'])$(id).addEventListener('change',()=>setTimeout(updateURL));
    document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>openView(b.dataset.nav));
    document.querySelector('.brand').onclick=e=>{e.preventDefault();openView('explore');};
    window.addEventListener('hashchange',()=>{if(parseTab()!==state.tab)openView(parseTab());});
  }
  initialize().catch(e=>{$('loading').hidden=true;showError(e);});
})();
