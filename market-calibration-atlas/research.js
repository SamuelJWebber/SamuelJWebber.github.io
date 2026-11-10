/* Source-backed research views. No result is inferred when a dataset is absent. */
(() => {
  'use strict';
  const studies = [
    {id:'weather', name:'Weather', question:'Does public weather information improve the odds?'},
    {id:'sports', name:'Sports clocks', question:'When did the information actually arrive?'},
    {id:'crypto', name:'Crypto speed', question:'How fast does a market follow another market?'},
    {id:'quotes', name:'Which price?', question:'Does the midpoint improve on the last trade?'},
    {id:'recalibration', name:'Corrections', question:'Do earlier errors help with later forecasts?'},
    {id:'consensus', name:'Consensus', question:'Does combining two markets improve a forecast?'}
  ];
  const colors = ['#356caf','#148477','#b18439','#8b70a5'];
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const human = v => String(v).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase());
  const href = u => typeof u === 'string' && /^(https?:\/\/|(?:data|downloads)\/)/.test(u) ? esc(u) : '';
  const format = (v, f, digits) => {
    if (v == null) return '—';
    if (!finite(v)) return typeof v === 'object' ? objectValue(v) : esc(v);
    if (f === 'percent' || f === 'probability') return (v*100).toLocaleString('en-US',{maximumFractionDigits:1})+'%';
    if (f === 'integer' || Number.isInteger(v)) return v.toLocaleString('en-US');
    const d = digits ?? (Math.abs(v)<.001 ? 6 : Math.abs(v)<1 ? 5 : 2);
    return v.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:d});
  };
  const objectValue = v => {
    if (Array.isArray(v)) return v.map(x=>format(x)).join(' – ');
    if (finite(v?.mean)) return format(v.mean)+(Array.isArray(v.ci)?` [${v.ci.map(x=>format(x)).join(', ')}]`:'');
    return 'See full result file';
  };
  const textOf = v => typeof v === 'string' ? v : v?.text || v?.description || v?.note || v?.label || v?.title || '';
  const list = items => `<ul>${(Array.isArray(items)?items:items?[items]:[]).map(x=>`<li>${esc(textOf(x))}</li>`).join('')}</ul>`;
  const svg = (title,body,height=290) => `<svg class="chart-svg" viewBox="0 0 650 ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>`;
  const label = (x,y,text,anchor='middle',cls='') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(text)}</text>`;
  const wrapped = (x,y,text,max=18) => {
    const words=String(text).split(' '),lines=[''];
    words.forEach(w=>{const i=lines.length-1;if(lines[i].length+w.length>max&&lines[i])lines.push(w);else lines[i]+=(lines[i]?' ':'')+w;});
    return `<text x="${x}" y="${y}" text-anchor="middle">${lines.map((s,i)=>`<tspan x="${x}" dy="${i?13:0}">${esc(s)}</tspan>`).join('')}</text>`;
  };
  function table(rows,columns,title) {
    if (!Array.isArray(rows)||!rows.length) return '<p class="empty">No eligible observations are reported for this table.</p>';
    columns = columns || Object.keys(rows[0]).filter(k=>typeof rows[0][k]!=='object'||finite(rows[0][k]?.mean)).map(k=>({key:k,label:human(k)}));
    columns = columns.map((c,i)=>typeof c==='string'?{key:Array.isArray(rows[0])?i:c,label:human(c)}:c);
    return `${title?`<h3>${esc(title)}</h3>`:''}<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(title||'Study data table')}"><table><thead><tr>${columns.map(c=>`<th scope="col">${esc(c.label||human(c.key))}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,60).map(r=>`<tr>${columns.map(c=>`<td class="${finite(r[c.key])?'numeric':''}">${format(r[c.key],c.format)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length>60?`<p class="table-caption">Showing 60 of ${rows.length.toLocaleString()} rows. All rows are included in the result download.</p>`:''}`;
  }
  function intervalChart(c) {
    const rows=c.rows.filter(r=>finite(r.value)),height=100+rows.length*43,left=175,right=520;
    let lo=Math.min(0,...rows.map(r=>finite(r.low)?r.low:r.value)),hi=Math.max(0,...rows.map(r=>finite(r.high)?r.high:r.value));
    const pad=(hi-lo||1)*.1;lo-=pad;hi+=pad;
    const x=v=>left+(v-lo)/(hi-lo)*(right-left);
    let b='';
    for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;b+=`<line class="grid" x1="${x(v)}" y1="20" x2="${x(v)}" y2="${height-55}"/>`+label(x(v),height-34,format(v,null,3));}
    b+=`<line class="zero" x1="${x(0)}" y1="15" x2="${x(0)}" y2="${height-55}"/>`;
    rows.forEach((r,i)=>{const y=35+i*43;b+=label(left-12,y+4,r.label,'end');
      if(finite(r.low)&&finite(r.high))b+=`<path d="M${x(r.low)},${y-5}v10m0,-5H${x(r.high)}m0,-5v10" fill="none" stroke="${colors[0]}" stroke-width="2"/>`;
      b+=`<circle cx="${x(r.value)}" cy="${y}" r="4.5" fill="${colors[0]}"><title>${esc(r.label)}: ${format(r.value)}${finite(r.low)?`; interval ${format(r.low)} to ${format(r.high)}`:''}</title></circle>`+label(right+16,y+4,format(r.value),'start','value');});
    b+=label((left+right)/2,height-9,c.axisLabel||c.unit||'Score difference','middle','axis-title');
    return svg(c.title,b,height);
  }
  function lineChart(c) {
    const rows=c.rows.filter(r=>finite(r.value)),cat=c.kind==='categorical-line',left=58,right=622,top=24,bottom=205;
    const probability=c.unit==='probability',max=probability?1:Math.max(...rows.map(r=>r.value),0)*1.1||1,min=probability?0:Math.min(...rows.map(r=>r.value),0);
    const xmin=cat?0:Math.min(...rows.map(r=>r.x)),xmax=cat?rows.length-1:Math.max(...rows.map(r=>r.x));
    const x=(r,i)=>left+((cat?i:r.x)-xmin)/(xmax-xmin||1)*(right-left),y=v=>bottom-(v-min)/(max-min||1)*(bottom-top);
    let b='';for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;b+=`<line class="grid" x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}"/>`+label(left-10,y(v)+4,format(v,probability?'percent':null,2),'end');}
    b+=`<path d="${rows.map((r,i)=>`${i?'L':'M'}${x(r,i)},${y(r.value)}`).join(' ')}" fill="none" stroke="${colors[0]}" stroke-width="2.6"/>`;
    rows.forEach((r,i)=>{b+=`<circle cx="${x(r,i)}" cy="${y(r.value)}" r="4" fill="${colors[0]}"><title>${esc(r.label??r.x)}: ${format(r.value,probability?'percent':null)}${r.n?`; n=${r.n}`:''}</title></circle>`;if(cat)b+=wrapped(x(r,i),bottom+22,r.label,16);});
    if(!cat)for(let i=0;i<=5;i++){const v=xmin+(xmax-xmin)*i/5;b+=label(left+(right-left)*i/5,bottom+23,format(v,null,0));}
    b+=label((left+right)/2,cat?286:260,c.xLabel||(cat?'Recorded event anchors · categorical spacing':'Time'),'middle','axis-title');
    return svg(c.title,b,cat?305:278);
  }
  function barChart(c) {
    const series=(c.series||[{key:'value',label:'Brier score'}]).map(s=>typeof s==='string'?{key:s,label:human(s)}:s),rows=c.rows;
    const left=59,right=623,top=28,bottom=211;
    const vals=rows.flatMap(r=>series.map(s=>r[s.key])).filter(finite);if(!vals.length)return '<p class="empty">No chart values are available.</p>';
    const min=Math.min(0,...vals),max=Math.max(0,...vals,...rows.map(r=>r.upper).filter(finite))*1.18||1,y=v=>bottom-(v-min)/(max-min)*(bottom-top);
    const group=(right-left)/rows.length,bw=Math.min(70,group*.7/series.length);let b='';
    for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;b+=`<line class="grid" x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}"/>`+label(left-10,y(v)+4,format(v,null,3),'end');}
    rows.forEach((r,i)=>{const center=left+(i+.5)*group;series.forEach((s,j)=>{const v=r[s.key];if(!finite(v))return;const xx=center+(j-series.length/2)*bw+2,yy=y(Math.max(v,0));b+=`<rect x="${xx}" y="${yy}" width="${bw-4}" height="${Math.abs(y(v)-y(0))}" rx="2" fill="${colors[j%colors.length]}"><title>${esc(r.label??r[c.x]??'')}, ${esc(s.label)}: ${format(v)}</title></rect>`+label(xx+(bw-4)/2,finite(r.upper)&&series.length===1?y(r.upper)-7:yy-7,format(v,null,5),'middle','value');if(finite(r.lower)&&finite(r.upper)&&series.length===1){const mx=xx+(bw-4)/2;b+=`<path d="M${mx-5},${y(r.lower)}h10m-5,0V${y(r.upper)}m-5,0h10" stroke="#273e59" stroke-width="1.5" fill="none"/>`;}});b+=wrapped(center,bottom+22,r.label??`${r[c.x]} days`,24);});
    b+=label((left+right)/2,278,c.yLabel||'Brier score · lower is better','middle','axis-title');
    return svg(c.title,b,295)+`<div class="legend">${series.map((s,i)=>`<span><i class="swatch" style="background:${colors[i%colors.length]}"></i>${esc(s.label)}</span>`).join('')}</div>`;
  }
  function chartsFor(d,id) {
    let charts=Array.isArray(d.charts)?d.charts:d.chart?[d.chart]:[];
    if(id==='quotes'&&d.chart?.rows)charts=[{...d.chart,kind:'interval',axisLabel:'Trade Brier − midpoint Brier · positive favors midpoint',note:'One day is the primary comparison. Other horizons use different cohorts; whiskers are event-clustered 95% intervals.',rows:d.chart.rows.map(r=>({label:`${r.x} day${r.x===1?'':'s'} before close`,value:r.y,low:r.ci?.[0],high:r.ci?.[1],n:r.n}))}];
    if(id==='crypto'&&d.chart?.rows)charts=[{...d.chart,kind:'line',unit:'probability',note:'A 1-percentage-point quote response is an observed threshold, not evidence that the new price is correct. The horizontal scale is elapsed milliseconds.',rows:d.chart.rows.map(r=>({...r,x:r.milliseconds,value:r.shareReachedOnePoint}))}];
    return charts.map(c=>{
      if(!Array.isArray(c.rows)||!c.rows.length)return '';
      const kind=c.kind||c.type||'';let content='';
      if(kind==='interval')content=intervalChart(c);
      else if(kind==='categorical-line'||kind==='line')content=lineChart(c);
      else if(['bar','paired-bars','grouped-bars'].includes(kind))content=barChart(c);
      else return `<figure class="figure"><h3>${esc(c.title||'Study observations')}</h3>${table(c.rows)}</figure>`;
      const columns=id==='crypto'?[{key:'milliseconds',label:'Milliseconds'},{key:'shareReachedOnePoint',label:'Reached +1 point',format:'percent'},{key:'shareReachedOppositeOnePoint',label:'Reached −1 point',format:'percent'},{key:'meanSignedMidpointChangePp',label:'Mean signed change (points)'},{key:'n',label:'Episodes'}]:undefined;
      return `<figure class="figure"><h3>${esc(c.title||'Study observations')}</h3>${c.note||c.subtitle?`<p class="chart-note">${esc(c.note||c.subtitle)}</p>`:''}${c.yLabel&&kind==='line'?`<p class="chart-note">${esc(c.yLabel)}</p>`:''}<div class="chart-scroll">${content}</div><details><summary>View chart values</summary>${table(c.rows,columns)}</details></figure>`;
    }).join('');
  }
  function tablesFor(d,id) {
    if(Array.isArray(d.tables)&&d.tables.length)return d.tables.map(t=>table(t.rows,t.columns,t.title)).join('');
    if(d.table?.rows)return table(d.table.rows,d.table.columns,d.table.title);
    if(!Array.isArray(d.table))return '';
    if(id==='recalibration')return table(d.table,[{key:'label',label:'Horizon'},{key:'n',label:'Test contracts',format:'integer'},{key:'events',label:'Test events',format:'integer'},{key:'rawBrier',label:'Raw Brier'},{key:'calibratedBrier',label:'Corrected Brier'},{key:'brierImprovement',label:'Improvement [95% CI]'},{key:'logLossImprovement',label:'Log-loss improvement [95% CI]'}]);
    if(id==='crypto')return table(d.table,[{key:'date',label:'Date'},{key:'n',label:'Episodes'},{key:'markets',label:'Contracts'},{key:'responders',label:'Responders ≤5s'},{key:'responseShare',label:'Response share',format:'percent'},{key:'medianDelayAmongRespondersMs',label:'Median delay, responders (ms)'}]);
    return table(d.table);
  }
  function sourcesFor(d) {
    return `<ul class="source-list">${(d.sources||[]).map(s=>{if(typeof s==='string')return `<li>${esc(s)}</li>`;const u=href(s.url||s.link),name=s.title||s.label||s.name||s.url||'Source';return `<li>${u?`<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(name)} ↗</a>`:esc(name)}${s.description||s.note?`<span class="source-meta">${esc(s.description||s.note)}</span>`:''}${s.sha256||s.md5?`<span class="source-meta">${s.sha256?'SHA-256':'MD5'} <code>${esc(s.sha256||s.md5)}</code></span>`:''}${s.revision?`<span class="source-meta">Pinned revision: ${esc(s.revision)}</span>`:''}</li>`;}).join('')}</ul>`;
  }
  function auditFor(d,id) {
    const bits=[];
    if(id==='quotes'&&d.downloadedArchiveAudit){const a=d.downloadedArchiveAudit;bits.push(`<p>The additional quote recording is a source audit, not a scored forecast sample. Its market identities and event clocks were not validated for outcome scoring. See the full audit download for lookup evidence.</p>`);if(a.note)bits.push(`<p>${esc(a.note)}</p>`);}
    if(Array.isArray(d.inputs)&&d.inputs.length)bits.push(table(d.inputs,[{key:'path',label:'Input file'},{key:'bytes',label:'Bytes',format:'integer'},{key:'sha256',label:'SHA-256'}],'Reproducibility inputs'));
    const rep=d.reproducibility||d.reproduction;if(rep?.command)bits.push(`<p>Reproduce: <code>${esc(rep.command)}</code></p>`);
    if(rep?.script)bits.push(`<p>Analysis script: <code>${esc(rep.script)}</code></p>`);
    return sourcesFor(d)+bits.join('');
  }
  function render(d,study,i) {
    const {id}=study,status=d.status||'limited',statusText=({complete:'Test completed',limited:'Limited inference',blocked:'Result unavailable',unavailable:'Unavailable'})[status]||human(status);
    const metrics=Array.isArray(d.metrics)?d.metrics:[],limits=Array.isArray(d.limitations)?d.limitations:[];
    const t=tablesFor(d,id),c=chartsFor(d,id),sourceCount=(d.sources||[]).length;
    const cryptoPrimary=id==='crypto'&&d.analyses?.find(a=>a.thresholdBps===5);
    const coverage=cryptoPrimary&&finite(cryptoPrimary.selectedSpotMoves)&&finite(cryptoPrimary.completePaths)?`<div class="coverage-note"><strong>Coverage: ${format(cryptoPrimary.selectedSpotMoves)} detected spot moves → ${format(cryptoPrimary.completePaths)} complete, eligible quote paths (${format(cryptoPrimary.completePaths/cryptoPrimary.selectedSpotMoves,'percent')}).</strong> ${finite(cryptoPrimary.exclusions?.noActiveRecorded15MinuteMarket)?`${format(cryptoPrimary.exclusions.noActiveRecorded15MinuteMarket)} moves had no active recorded contract. `:''}The response result describes this small observed subset, not all detected moves.</div>`:'';
    const downloads=(d.downloads||[]).map(x=>{const u=href(x.url);return u?`<a class="source-download" href="${u}" download>${esc(x.label||x.title||'Download source')} ↓</a>`:'';}).join('');
    return `<div class="study-head"><div><p class="eyebrow">${String(i+1).padStart(2,'0')} / ${esc(study.name)} · ${esc(study.question)}</p><h2 id="${id}-title">${esc(d.title||study.name)}</h2></div><span class="status ${esc(status)}">${status==='complete'?'●':'◐'} ${esc(statusText)}</span></div>
      <p class="finding">${esc(d.finding||'No finding has been reported for this study.')}</p>${typeof d.scope==='string'?`<p class="scope">${esc(d.scope)}</p>`:''}${coverage}
      ${metrics.length?`<div class="metrics">${metrics.map(m=>`<div class="metric"><div class="metric-value ${typeof m.value==='string'?'metric-text':''}">${format(m.value,m.format)}${m.unit?` <small>${esc(m.unit)}</small>`:''}</div><div class="metric-label">${esc(m.label)}</div>${m.ci?`<div class="metric-ci">95% CI: ${m.ci.map(x=>format(x,m.format)).join(' to ')}</div>`:''}</div>`).join('')}</div>`:''}
      ${limits.length?`<div class="boundary"><strong>Inference boundary:</strong> ${esc(textOf(limits[0]))}</div>`:''}
      ${c?`<div class="chart-grid">${c}</div>`:''}
      <div class="detail-stack">${t?`<details><summary>Results and sensitivity checks</summary><div class="detail-content">${t}</div></details>`:''}
      <details><summary>How this was measured</summary><div class="detail-content">${list(d.methods||['No methodology was supplied in this result file.'])}</div></details>
      <details><summary>What this cannot establish${limits.length?` · ${limits.length} limitations`:''}</summary><div class="detail-content">${list(limits)}</div></details>
      <details><summary>Sources and data audit · ${sourceCount} source${sourceCount===1?'':'s'}</summary><div class="detail-content">${auditFor(d,id)}</div></details></div>
      <div class="study-actions"><a class="download" href="data/expansion/${id}.json" download>Download complete result · JSON ↓</a>${downloads}</div>`;
  }
  async function load() {
    let loaded=0;
    await Promise.all(studies.map(async(study,i)=>{
      const el=document.getElementById(study.id);
      try{const response=await fetch(`data/expansion/${study.id}.json`);if(!response.ok)throw Error(`HTTP ${response.status}`);const d=await response.json();if(!d||typeof d!=='object'||!d.title)throw Error('Unrecognized result file');el.innerHTML=render(d,study,i);el.classList.remove('pending');loaded++;}
      catch(error){el.innerHTML=`<div class="study-head"><div><p class="eyebrow">${String(i+1).padStart(2,'0')} / ${esc(study.name)}</p><h2 id="${study.id}-title">${esc(study.question)}</h2></div><span class="status unavailable">Unavailable</span></div><p class="empty">This study result could not be loaded. No result is shown without its underlying data.</p><p class="scope">${esc(error.message)}</p>`;el.classList.remove('pending');}
    }));
    document.getElementById('load-status').textContent=`${loaded} of ${studies.length} studies loaded · Every chart is calculated from the linked result file. Expand a study to inspect its methods and sources.`;
  }
  // Exported only for a lightweight local schema/HTML check; no network is needed by the checker.
  if(typeof module!=='undefined'&&module.exports)module.exports={render,studies,format};
  if(typeof document!=='undefined')load();
})();
