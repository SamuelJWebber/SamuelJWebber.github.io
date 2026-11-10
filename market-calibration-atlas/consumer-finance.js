/* Consumer-finance explorer. All prices and outcomes come from the frozen result. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const fmt = (v,d=0) => finite(v) ? v.toLocaleString('en-US',{maximumFractionDigits:d}) : '—';
  const pct = v => finite(v) ? `${fmt(v*100,2)}%` : '—';
  const safeURL = s => typeof s === 'string' && /^https?:\/\//.test(s) ? esc(s) : '';
  const date = s => s && !Number.isNaN(Date.parse(s)) ? new Date(s).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}) : 'Not recorded';
  const dateTime = s => s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString().replace('T',' ').replace('.000Z',' UTC').replace('Z',' UTC') : 'Not recorded';
  const distinct = (rows,key) => new Set(rows.map(r=>r[key]).filter(x=>x!==null&&x!==undefined&&x!=='')).size;
  const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
  const svg = (title,body,height=290) => `<svg class="chart-svg cf-chart-small" viewBox="0 0 650 ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>`;
  const label = (x,y,t,anchor='middle',cls='') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(t)}</text>`;
  const empty = (title,body) => `<div class="cf-empty"><strong>${esc(title)}</strong>${esc(body)}</div>`;
  const list = rows => `<ul class="method-list">${rows.filter(Boolean).map(s=>`<li>${esc(typeof s==='string'?s:s.text||s.description||JSON.stringify(s))}</li>`).join('')}</ul>`;
  let data, series = new Map(), page=0, filtered=[];
  const active = m => ['active','open'].includes(m.status);
  const historical = m => m.settled || ['settled','finalized','closed','resolved'].includes(m.status);
  const isUsable = m => m.quoteUsable === true;
  const settled = m => m.settled===true && (m.outcome===0||m.outcome===1);
  const eventKey = r => r.releaseId || r.underlyingEventId || r.eventTicker || r.event || r.ticker;
  const eventCount = rows => new Set(rows.map(eventKey)).size;
  function table(rows,columns,caption='Chart values') {
    if(!rows.length) return '';
    return `<div class="table-wrap cf-small-table" role="region" tabindex="0" aria-label="${esc(caption)}"><table><thead><tr>${columns.map(c=>`<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${c.format?c.format(r[c.key],r):esc(r[c.key]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function metrics() {
    const rows=data.markets, resolved=rows.filter(historical), usable=rows.filter(isUsable);
    const cells=[
      [fmt(data.series.length),'Consumer-finance series collected'],
      [fmt(rows.filter(active).length),'Active listed contracts'],
      [fmt(usable.length),'Active quotes passing the quality screen'],
      [fmt(rows.filter(settled).length),'Settled contracts with binary outcomes']
    ];
    $('cf-summary').innerHTML=cells.map(([value,title])=>`<div class="metric"><div class="metric-value">${value}</div><div class="metric-label">${esc(title)}</div></div>`).join('');
  }
  function sourceLinks(s) {
    return (s.sources||[]).map((u,i)=>{const url=typeof u==='string'?u:u.url;return safeURL(url)?`<a href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">${esc(typeof u==='string'?`Source ${i+1}`:u.title||u.name||u.label||`Source ${i+1}`)} ↗</a>`:'';}).join(' · ');
  }
  function selectedDetail() {
    const s=series.get($('cf-series').value);
    if(!s){$('cf-series-detail').innerHTML='<div class="series-info"><h3>Different measures answer different questions</h3><p class="definition">Delinquency and charge-offs describe credit performance. Debt and savings describe household balance sheets. Income and spending describe cash flows. These are separate forecast targets.</p><p>Use the financial-measure filter to read the precise definition and lender relevance for each series.</p></div>';return;}
    $('cf-series-detail').innerHTML=`<div class="series-info"><h3>${esc(s.name)}</h3><p class="definition">${esc(s.description||s.definition||s.underlying)}</p><p><strong>Relevance for a lender:</strong> ${esc(s.relevance||'A candidate external signal; incremental forecasting value has not yet been established for a specific portfolio.')}</p>${s.clockNotes?`<p><strong>Timing:</strong> ${esc(s.clockNotes)}</p>`:''}<div class="series-meta"><span>Series <strong>${esc(s.id)}</strong></span><span>${sourceLinks(s)}</span></div></div>`;
  }
  function quoteChart(rows) {
    const a=rows.filter(active).filter(m=>finite(m.bid)&&finite(m.ask)&&m.bid<=m.ask).sort((x,y)=>Number(isUsable(y))-Number(isUsable(x))||x.ticker.localeCompare(y.ticker));
    if(!a.length)return empty('No active two-sided quote in this selection','Historical outcomes remain available in the registry. This does not imply that the outcome has probability zero.');
    const shown=a.slice(0,10),left=230,right=605,top=32,height=80+shown.length*34,bottom=height-36,x=p=>left+p*(right-left);let b='';
    for(let i=0;i<=4;i++){const p=i/4;b+=`<line class="grid" x1="${x(p)}" y1="17" x2="${x(p)}" y2="${bottom}"/>`+label(x(p),height-15,pct(p));}
    shown.forEach((m,i)=>{const y=top+i*34,c=isUsable(m)?'#356caf':'#aeb8c6',name=(m.yesSubtitle||m.subtitle||m.title||m.ticker).replace(/\s+/g,' '),short=name.length>31?name.slice(0,29)+'…':name;
      b+=label(left-12,y+3,short,'end')+`<line class="errorbar" x1="${x(m.bid)}" y1="${y}" x2="${x(m.ask)}" y2="${y}" stroke="${c}"><title>${esc(name)}: YES bid ${pct(m.bid)}, ask ${pct(m.ask)}. ${esc(m.quoteReason||'')}</title></line>`;
      if(isUsable(m)&&finite(m.midpoint))b+=`<circle cx="${x(m.midpoint)}" cy="${y}" r="4" fill="#203d70"><title>Midpoint: ${pct(m.midpoint)}</title></circle>`;
    });
    return svg('Active YES bid–ask ranges',b,height)+`<p class="quote-count">Showing ${shown.length} of ${a.length} active two-sided quotes, ordered by quality screen then ticker. ${rows.filter(active).filter(isUsable).length} active quotes pass the screen. All are available in the registry.</p>`;
  }
  function coverageChart(rows) {
    const counts=[['Active listings',rows.filter(active).length],['Active usable quotes',rows.filter(isUsable).length],['Settled contracts',rows.filter(settled).length],['Documented release events',eventCount(rows.filter(m=>settled(m)&&m.releaseGateTime))]];
    const left=190,right=590,max=Math.max(1,...counts.map(r=>r[1])),x=v=>left+v/max*(right-left);let b='';
    counts.forEach(([name,n],i)=>{const y=30+i*51;b+=label(left-12,y+13,name,'end')+`<rect x="${left}" y="${y}" width="${Math.max(0,x(n)-left)}" height="22" fill="${i===1?'#148477':'#91a8c3'}" rx="2"/>`+label(x(n)+10,y+15,fmt(n),'start','value');});
    return svg('Contract and parent-event coverage',b,244);
  }
  function registry(rows) {
    const size=15,pages=Math.max(1,Math.ceil(rows.length/size));page=Math.max(0,Math.min(page,pages-1));
    if(!rows.length){$('cf-market-table').innerHTML=empty('No contracts match these filters','Choose all contract statuses or clear the search to inspect the collected markets.');return;}
    const display=rows.slice(page*size,(page+1)*size);
    $('cf-market-table').innerHTML=`<div class="registry-head"><span>Contract / settlement target</span><span class="contract-state">Status</span><span>YES bid–ask</span><span class="contract-volume">24h volume</span></div><div class="registry">${display.map(m=>{
      const s=series.get(m.seriesId),releaseTime=m.releaseAnchorTime||m.releaseGateTime||m.anchorTime||m.publicationTime,range=finite(m.bid)&&finite(m.ask)?`${pct(m.bid)}–${pct(m.ask)}`:'Unavailable',outcome=m.outcome===1?'YES':m.outcome===0?'NO':'Not resolved',mid=isUsable(m)?`Mid ${pct(m.midpoint)}`:active(m)?'Fails quality screen':'Archive metadata';
      return `<details class="contract"><summary><span class="contract-title">${esc(m.title||m.ticker)}<span class="contract-ticker">${esc(m.ticker)}${m.yesSubtitle||m.subtitle?` · ${esc(m.yesSubtitle||m.subtitle)}`:''}</span></span><span class="contract-state"><span class="pill ${active(m)?'active':'historical'}">${esc(active(m)?'Active':m.status||'Historical')}</span></span><span class="contract-stat">${range}<small>${esc(mid)}</small></span><span class="contract-stat contract-volume">${fmt(m.volume24h,2)}<small>contracts traded</small></span></summary><div class="contract-body"><p><strong>${esc(s?.name||m.seriesId)}</strong> · ${esc(s?.description||'See the settlement text for the target definition.')}</p>${active(m)?`<p class="quote-warning"><strong>Snapshot quality:</strong> ${esc(m.quoteReason|| (isUsable(m)?'Passes the stated quality screen':'Not an eligible snapshot forecast'))}</p>`:''}<dl><div><dt>Opened</dt><dd>${date(m.openTime)}</dd></div><div><dt>Recorded close</dt><dd>${date(m.closeTime)}</dd></div><div><dt>Measurement period</dt><dd>${esc(m.measurementPeriod||'Not parsed; consult the rules')}</dd></div><div><dt>Resolved outcome</dt><dd>${outcome}${m.expirationValue!=null?` · underlying ${esc(m.expirationValue)}`:''}</dd></div><div><dt>Last traded price</dt><dd>${pct(m.lastTrade)} · may be stale</dd></div><div><dt>Total volume</dt><dd>${fmt(m.volume,2)} contracts</dd></div>${releaseTime?`<div><dt>Documented release anchor</dt><dd>${dateTime(releaseTime)} · ${esc(m.releaseTimePrecision||'See source audit')}</dd></div>`:''}</dl>${m.clockError?`<p class="quote-warning"><strong>Clock inconsistency:</strong> ${esc(m.clockErrorReason||'Excluded from historical accuracy.')}</p>`:''}${/^first[ -]passage/.test(m.targetType||'')?'<p class="quote-warning">This contract asks whether a threshold is crossed at any point in a period. It is not the same target as the rate in a single reference month; it is excluded from pooled release-based accuracy.</p>':''}${m.opensAfterMeasurement===true?'<p class="quote-warning">This contract opened after its measurement period ended. It can nowcast the later release, but could not have forecast that period before it began.</p>':''}${m.rules?`<div class="rule-text"><strong>Exchange settlement rules</strong>\n${esc(m.rules)}</div>`:''}<p>${safeURL(m.url)?`<a href="${safeURL(m.url)}" target="_blank" rel="noopener noreferrer">Open official market ↗</a>`:''}${safeURL(m.apiUrl||m.sourceUrl)?` · <a href="${safeURL(m.apiUrl||m.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official catalogue response ↗</a>`:''}</p></div></details>`;
    }).join('')}</div><div class="pager"><button id="cf-prev" type="button" ${page===0?'disabled':''}>← Previous</button><span>${page+1} / ${pages} · ${fmt(rows.length)} contracts</span><button id="cf-next" type="button" ${page===pages-1?'disabled':''}>Next →</button></div>`;
    $('cf-prev').addEventListener('click',()=>{page--;registry(filtered);});$('cf-next').addEventListener('click',()=>{page++;registry(filtered);});
  }
  function explorer() {
    const id=$('cf-series').value,status=$('cf-status-filter').value,q=$('cf-search').value.trim().toLowerCase();
    filtered=data.markets.filter(m=>(id==='all'||m.seriesId===id)&&(status==='all'||(status==='active'?active(m):historical(m)))&&(!q||`${m.title} ${m.ticker} ${m.measurementPeriod} ${m.yesSubtitle}`.toLowerCase().includes(q))).sort((a,b)=>Number(active(b))-Number(active(a))||String(b.closeTime||'').localeCompare(String(a.closeTime||''))||a.ticker.localeCompare(b.ticker));
    $('cf-filter-count').textContent=`${fmt(filtered.length)} contracts across ${fmt(distinct(filtered,'eventTicker'))} exchange parent events in this selection. Prices are a frozen snapshot, not a streaming feed.`;
    selectedDetail();$('cf-price-chart').innerHTML=quoteChart(filtered);$('cf-coverage-chart').innerHTML=coverageChart(filtered);registry(filtered);
  }
  function scoreRows(rows,price) {
    const valid=rows.filter(r=>finite(price(r))&&finite(r.outcome));
    const byEvent=new Map();valid.forEach(r=>{const key=eventKey(r);if(!byEvent.has(key))byEvent.set(key,[]);byEvent.get(key).push((price(r)-r.outcome)**2);});
    return {n:valid.length,events:byEvent.size,brier:mean(valid.map(r=>(price(r)-r.outcome)**2)),eventEqualBrier:mean([...byEvent.values()].map(mean))};
  }
  function horizonChart(rows) {
    const valid=rows.filter(r=>r.n>0&&finite(r.brier));if(!valid.length)return empty('No eligible pre-release forecasts','The catalog includes real contracts, but historical accuracy is shown only when price, outcome and timing checks succeed.');
    const left=60,right=610,top=25,bottom=220,max=Math.max(.05,...valid.flatMap(r=>[r.brier,r.eventEqualBrier]).filter(finite))*1.15,x=i=>left+i/Math.max(1,rows.length-1)*(right-left),y=v=>bottom-v/max*(bottom-top);let b='';
    for(let i=0;i<=4;i++){const v=max*i/4;b+=`<line class="grid" x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}"/>`+label(left-9,y(v)+4,fmt(v,3),'end');}
    [['brier','#356caf'],['eventEqualBrier','#148477']].forEach(([key,color])=>{let started=false,path='';rows.forEach((r,i)=>{if(r.n&&finite(r[key])){path+=`${started?' L':' M'}${x(i)},${y(r[key])}`;started=true;b+=`<circle cx="${x(i)}" cy="${y(r[key])}" r="4" fill="${color}"><title>${r.days} days: ${fmt(r[key],5)}; ${r.n} contracts, ${r.events} events</title></circle>`;}else started=false;});b+=`<path d="${path}" stroke="${color}" fill="none" stroke-width="2"/>`;});
    rows.forEach((r,i)=>{b+=label(x(i),bottom+23,`${r.days}d`);});b+=label((left+right)/2,276,'Days before the documented release anchor · unequal cohorts','middle','axis-title');
    return svg('Brier score by available horizon',b,290)+'<div class="legend"><span><i class="swatch" style="background:#356caf"></i>Each contract equal</span><span><i class="swatch" style="background:#148477"></i>Each publication event equal</span></div>';
  }
  function calibrationChart(rows) {
    if(!rows.length)return empty('No exact-probability observations','Select a different horizon or measure. Forecasts with a favorite below 51% are excluded from this calibration view.');
    const left=65,right=610,top=24,bottom=220,x=v=>left+(v-.51)/.49*(right-left),y=v=>bottom-v*(bottom-top);let b='';
    for(let i=0;i<=4;i++){const v=i/4;b+=`<line class="grid" x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}"/>`+label(left-10,y(v)+4,pct(v),'end');}
    b+=`<path class="zero" d="M${x(.51)},${y(.51)}L${x(1)},${y(1)}" fill="none"/>`;
    [.51,.6,.7,.8,.9,1].forEach(p=>{b+=label(x(p),bottom+24,pct(p));});
    rows.forEach(r=>{const radius=Math.min(12,3+Math.sqrt(r.n));b+=`<circle cx="${x(r.p)}" cy="${y(r.winRate)}" r="${radius}" fill="#356caf" fill-opacity=".64" stroke="#fff" stroke-width="1"><title>Favorite ${pct(r.p)}: won ${pct(r.winRate)}, ${r.n} contracts across ${r.events} events</title></circle>`;});
    b+=label((left+right)/2,276,'Exact favorite probability · 51% or higher','middle','axis-title');
    return svg('Exact-probability calibration for favorites at least 51%',b,290);
  }
  function pairedResults(rows,price) {
    const map=new Map(rows.filter(r=>finite(price(r))).map(r=>[`${r.ticker}|${r.days}`,r]));
    const comparisons=[];
    for(const [early,late] of [[7,1],[30,7],[30,1],[90,30]]) {
      const earlier=rows.filter(r=>r.days===early&&finite(price(r))&&map.has(`${r.ticker}|${late}`));
      if(!earlier.length)continue;
      const later=earlier.map(r=>map.get(`${r.ticker}|${late}`)),a=scoreRows(earlier,price),b=scoreRows(later,price);
      comparisons.push({pair:`${early} → ${late} days`,n:a.n,events:a.events,earlier:a.eventEqualBrier,later:b.eventEqualBrier,improvement:a.eventEqualBrier-b.eventEqualBrier});
    }
    if(!comparisons.length)return empty('No matched horizon pair for this selection','This comparison requires the same contract to pass the price and release-clock screens at both dates.');
    const left=170,right=510,mid=(left+right)/2,max=Math.max(.001,...comparisons.map(r=>Math.abs(r.improvement)))*1.25,x=v=>mid+v/max*(right-left)/2,height=80+comparisons.length*42;let body='';
    body+=`<line class="zero" x1="${mid}" y1="12" x2="${mid}" y2="${height-38}"/>`;
    comparisons.forEach((r,i)=>{const y=27+i*42,xx=x(r.improvement);body+=label(left-15,y+5,r.pair,'end')+`<rect x="${Math.min(mid,xx)}" y="${y-9}" width="${Math.max(.5,Math.abs(xx-mid))}" height="19" rx="2" fill="${r.improvement>=0?'#148477':'#b18439'}"><title>${esc(r.pair)}: ${fmt(r.improvement,5)} publication-equal Brier improvement</title></rect>`+label(right+18,y+5,`${r.improvement>0?'+':''}${fmt(r.improvement,5)}`,'start','value');});
    body+=label((left+right)/2,height-10,'Publication-equal Brier improvement · positive favors later','middle','axis-title');
    return `<div class="chart-scroll">${svg('Matched-contract forecast improvement',body,height)}</div><p class="boundary"><strong>Small matched sample.</strong> Each comparison below is descriptive. With only a few contracts and publication events, its sign does not establish whether markets generally improve closer to release.</p>`+table(comparisons,[{key:'pair',label:'Horizon pair'},{key:'n',label:'Contracts',format:v=>fmt(v)},{key:'events',label:'Releases',format:v=>fmt(v)},{key:'earlier',label:'Earlier Brier',format:v=>fmt(v,5)},{key:'later',label:'Later Brier',format:v=>fmt(v,5)},{key:'improvement',label:'Improvement',format:v=>fmt(v,5)}]);
  }
  function history() {
    const id=$('cf-history-series').value,measure=$('cf-price-measure').value,day=Number($('cf-calibration-day').value),clock=$('cf-clock-filter').value,price=r=>measure==='trade'?r.lastTrade:r.p;
    const all=(data.observations||[]).filter(r=>id==='all'||r.seriesId===id);
    // The collector marks a primary observation only after the pre-release clock audit.
    const eligible=all.filter(r=>(r.primaryEligible===true||r.preReleaseVerified===true||r.releaseVerifiedEligible===true)&&(clock==='all'||/^exact(?: |$)/i.test(r.releaseTimePrecision||'')));
    const days=[...new Set((data.horizons||[]).map(r=>r.days).concat(all.map(r=>r.days)))].sort((a,b)=>a-b);
    const h=days.map(days=>({days,...scoreRows(eligible.filter(r=>r.days===days),price)}));
    $('cf-horizon-chart').innerHTML=horizonChart(h);
    $('cf-horizon-table').innerHTML=table(h,[{key:'days',label:'Days'},{key:'n',label:'Contracts',format:v=>fmt(v)},{key:'events',label:'Releases',format:v=>fmt(v)},{key:'brier',label:'Brier',format:v=>fmt(v,5)},{key:'eventEqualBrier',label:'Release-equal',format:v=>fmt(v,5)}]);
    const buckets=new Map();eligible.filter(r=>r.days===day&&finite(price(r))).forEach(r=>{const yes=price(r),p=Math.max(yes,1-yes);if(p<.51-1e-12)return;const key=p.toFixed(12);if(!buckets.has(key))buckets.set(key,{p,rows:[]});buckets.get(key).rows.push({...r,y:yes>=.5?r.outcome:1-r.outcome});});
    const cal=[...buckets.values()].map(b=>({p:b.p,n:b.rows.length,events:eventCount(b.rows),winRate:mean(b.rows.map(r=>r.y))})).sort((a,b)=>a.p-b.p);
    $('cf-calibration-chart').innerHTML=calibrationChart(cal);
    $('cf-calibration-table').innerHTML=cal.length?`<details><summary>Exact probabilities and outcomes</summary>${table(cal,[{key:'p',label:'Favorite',format:pct},{key:'winRate',label:'Actual wins',format:pct},{key:'n',label:'Contracts',format:v=>fmt(v)},{key:'events',label:'Releases',format:v=>fmt(v)}])}</details>`:'';
    $('cf-paired-results').innerHTML=pairedResults(eligible,price);
    const primary=scoreRows(eligible,price);
    $('cf-history-finding').textContent=primary.n?`${fmt(primary.n)} eligible contract–horizon observations across ${fmt(eventCount(eligible))} publication events. This is a small, selected historical sample; the chart describes it without establishing a general accuracy claim.`:'The contract history is real. A defensible accuracy estimate also needs a price observed before the outcome was public; the timing audit determines which observations can enter these charts.';
    $('cf-evidence-status').textContent=primary.n?'Limited historical sample':'Timing / coverage limited';
    $('cf-history-note').textContent=`${measure==='trade'?'Last-trade':'Midpoint'} scores use all eligible YES probabilities from 0–100%; calibration folds the same observations to favorites of at least 51%. ${id==='all'?'The aggregate mixes different economic targets.':''}`;
    $('cf-history-audit').innerHTML=`<strong>Timing and sample boundary.</strong> ${fmt(eligible.length)} of ${fmt(all.length)} collected observations pass the collector’s primary pre-release timing gate in this selection. The number of contracts is not the number of independent economic periods. Prices quoted after public release cannot demonstrate advance prediction. ${esc(data.audit?.primaryNote||'Date-only anchors use the start of the documented release date; this is conservative within that date but does not independently verify the earliest public availability. The exact-time filter restricts the sample further. Multiple measures can share the same publication event.')}`;
    const related=(data.horizons||[]).filter(r=>r.seriesId===id),rows=related.length?related:(data.horizons||[]).filter(r=>r.seriesId==='all');
    $('cf-attrition').innerHTML='<p>Collection-level counts below precede the release-precision and price display filters. A screened-out record is never substituted with a later price.</p>'+list([data.audit?.clockNote,data.audit?.qualityNote,...(data.limitations||[])])+table(rows,[{key:'days',label:'Horizon'},{key:'attempted',label:'Attempted',format:v=>fmt(v)},{key:'n',label:'Selected',format:v=>fmt(v)},{key:'exclusions',label:'Exclusions',format:v=>esc(v?JSON.stringify(v):'See full JSON')}]);
  }
  function methods() {
    const notes=Array.isArray(data.methods)?data.methods:data.methods&&typeof data.methods==='object'?Object.values(data.methods):Object.entries(data.audit||{}).filter(([k,v])=>typeof v==='string'&&k!=='priceOrientation').map(([,v])=>v);
    const defaults=[
      'The collection uses official exchange records for listing metadata, settlement outcomes and historical candlesticks. Market-rule text is retained for inspection.',
      'Snapshot usable-quote screen: active contract, an interior two-sided book, bid no greater than ask, spread no greater than 20 percentage points, and positive reported trading volume in the previous 24 hours. Passing this screen does not guarantee an executable size or a calibrated probability.',
      'Historical quote screen: an interior two-sided book, spread no greater than 20 points, positive volume in the selected hourly candle, and a candle ending no later than the cutoff within a 24-hour lookback. The cutoff uses a documented release time or a date-only start-of-day bound, not the exchange close. Use the exact-time filter to exclude date-only clocks.',
      'No probability bins are used in the calibration plot. Identical probabilities are grouped to numerical precision only; a point can therefore contain very few contracts.',
      'Missing data and failures remain explicit. This is a dated snapshot, not an unattended live update.'
    ];
    $('cf-methods').innerHTML='<p><strong>Display convention:</strong> Brier scores retain all eligible YES probabilities. The exact-probability calibration chart folds each observation to its favorite and requires at least 51%. The raw result also retains unfurled YES calibration values.</p>'+list(notes.length?notes:defaults)+`<p><strong>Reproduce:</strong> <code>python scripts/consumer_finance.py --help</code>. The code and frozen collection inputs are described on the <a href="source.html">Code &amp; methods page</a>.</p>`;
    $('cf-sources').innerHTML=`<ul class="source-list">${data.series.map(s=>`<li><strong>${esc(s.name)}</strong> · <code>${esc(s.id)}</code><p>${esc(s.description||s.underlying||'')}</p>${s.relevance?`<p>${esc(s.relevance)}</p>`:''}${sourceLinks(s)}</li>`).join('')}</ul>`;
  }
  function exportContracts() {
    const keys=['ticker','seriesId','eventTicker','title','status','releaseId','underlyingId','targetType','releaseGateTime','releaseTimePrecision','releaseGateSource','measurementPeriod','openTime','closeTime','bid','ask','midpoint','quoteUsable','quoteReason','lastTrade','volume24h','volume','outcome','url','rules'];
    const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv=[keys.map(quote).join(','),...filtered.map(m=>keys.map(k=>quote(m[k])).join(','))].join('\r\n');
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='consumer-finance-contracts.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function init() {
    const response=await fetch('data/consumer-finance/summary.json');if(!response.ok)throw new Error(`Data request returned ${response.status}`);data=await response.json();
    if(!Array.isArray(data.series)||!Array.isArray(data.markets))throw new Error('The result is missing its series or contract catalog.');
    series=new Map(data.series.map(s=>[s.id,s]));
    const options=data.series.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');$('cf-series').insertAdjacentHTML('beforeend',options);$('cf-history-series').insertAdjacentHTML('beforeend',options);
    const days=[...new Set((data.horizons||[]).map(r=>r.days).concat((data.observations||[]).map(r=>r.days)))].sort((a,b)=>a-b);if(days.length)$('cf-calibration-day').innerHTML=days.map(d=>`<option value="${d}"${d===7?' selected':''}>${d} day${d===1?'':'s'}</option>`).join('');
    $('cf-status').textContent=`Snapshot collected through ${dateTime(data.asOf||data.generatedAt)} · Kalshi official market and historical API records. Snapshot values do not refresh automatically.`;$('cf-snapshot-label').textContent=date(data.asOf||data.generatedAt);
    ['cf-series','cf-status-filter'].forEach(id=>$(id).addEventListener('change',()=>{page=0;explorer();}));$('cf-search').addEventListener('input',()=>{page=0;explorer();});
    ['cf-history-series','cf-price-measure','cf-calibration-day','cf-clock-filter'].forEach(id=>$(id).addEventListener('change',history));$('cf-export').addEventListener('click',exportContracts);
    metrics();explorer();history();methods();$('cf-content').hidden=false;
  }
  init().catch(error=>{$('cf-status').className='cf-error';$('cf-status').textContent=`The consumer-finance view could not load: ${error.message}. The source bundle and other dashboard views remain available.`;});
})();
