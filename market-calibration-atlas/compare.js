/* Cross-venue price comparisons, per-venue topic matrices, and archive coverage. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const definitions = {
    ece: {index:4,name:'Signed bias',unit:'points'},
    hit: {index:3,name:'Favorite win rate',unit:'percent'},
    brier: {index:2,name:'Brier score',unit:'score'},
    n: {index:0,name:'Contracts',unit:'count'},
    e: {index:1,name:'Events',unit:'count'}
  };
  let current, crossGeneration=0, matrixGeneration=0;
  const summaryCache=new Map();

  function blankRow(target, columns, text) {
    target.innerHTML='';
    const row=target.insertRow();
    const cell=row.insertCell();
    cell.colSpan=columns; cell.className='dim'; cell.textContent=text;
  }

  function sourceFor(ctx) {return ctx.venues.find(v=>v.id===ctx.venue);}

  function sameTopic(meta,topic) {
    if(!meta || !topic) return undefined;
    return meta.topics.find(t=>t.kind===topic.kind && t.name===topic.name);
  }

  async function crossLookup(ctx,venue,topic,price,radius) {
    if(!ctx.metas[venue.id]) return {venue,reason:'Archive unavailable'};
    if(!topic) return {venue,reason:'Event type outside this archive'};
    if(ctx.day>topic.maxDays) return {venue,topic,reason:'No observations at this horizon',empty:true};
    try {
      const r=await window.AtlasWindows.query(ctx,venue.id,topic,ctx.day,'favorite',price,radius);
      return r.n ? {venue,topic,...r,e:r.events} : {venue,topic,reason:radius?'No prices in this window':'No trades at this exact price',empty:true};
    } catch(_) {return {venue,topic,reason:'Could not load archive data'};}
  }
  async function cross(ctx) {
    const serial=++crossGeneration, body=$('cross'), note=$('compare-note'), button=$('compare-export');
    const priceInput=$('compare-price'), side='favorite', match=$('compare-match').value;
    const raw=priceInput.value.trim(), price=Number(raw), day=ctx.day;
    const isWindow=match==='window', radius=isWindow?$('compare-radius').valueAsNumber:0;
    $('margin-control').hidden=!isWindow; priceInput.step='any';
    const priceMin=51;
    priceInput.min=priceMin;
    button.disabled=true;
    if(!raw || !Number.isFinite(price) || price<priceMin || price>100) {
      priceInput.setAttribute('aria-invalid','true');
      note.textContent='Choose a favorite probability from 51% to 100%.';
      blankRow(body,7,'Enter a valid quoted chance to compare venues.');
      return;
    }
    priceInput.removeAttribute('aria-invalid');
    if(isWindow && !(Number.isFinite(radius) && radius>=0 && radius<=100)) {
      note.textContent='Enter a margin between 0 and 100 percentage points.';
      blankRow(body,7,'Waiting for a valid margin.');return;
    }
    if(!Number.isInteger(+day) || +day<1 || !ctx.topic) {
      note.textContent='Choose an event type and a positive whole number of days.';
      blankRow(body,7,'Waiting for an event type and horizon.');
      return;
    }
    const low=Number(Math.max(51,price-radius).toFixed(8)),high=Number(Math.min(100,price+radius).toFixed(8));
    const groupText=isWindow?low+'% through '+high+'%, including both endpoints':'exactly '+price+'%';
    note.textContent=ctx.topic.name+' · '+countDays(day)+' before cutoff · '+groupText+'.';
    blankRow(body,7,'Loading venue results…');
    const components=ctx.venues.filter(v=>v.id!=='all');
    const results=await Promise.all(components.map(v=>crossLookup(ctx,v,sameTopic(ctx.metas[v.id],ctx.topic),price,radius)));
    const pooledVenue=ctx.venues.find(v=>v.id==='all');
    if(pooledVenue) {
      const topic=sameTopic(ctx.metas.all,ctx.topic);
      const sum=results.reduce((t,r)=>{if(!r.reason){t.n+=r.n;t.e+=r.e;t.wins+=r.wins;t.totalPrice+=r.p*r.n;}return t;},{n:0,e:0,wins:0,totalPrice:0});
      const failed=results.some(r=>r.reason==='Could not load archive data' || r.reason==='Archive unavailable');
      const pooled=failed ? {reason:'Some venue data could not be loaded'} :
        sum.n ? {...sum,p:sum.totalPrice/sum.n,y:sum.wins/sum.n} : {reason:'No qualifying price across venues',empty:true};
      results.unshift({venue:pooledVenue,topic,...pooled});
    }
    if(serial!==crossGeneration || current!==ctx) return;
    const f=ctx.formatInt, pct=ctx.formatPct;
    body.replaceChildren();
    for(const r of results) {
      const tr=body.insertRow(),name=tr.insertCell();
      if(r.topic && +day<=r.topic.maxDays) {
        const go=document.createElement('button');go.className='topic-btn';go.textContent=r.venue.name;
        go.title='Explore '+r.venue.name+' at '+countDays(day);
        go.onclick=()=>ctx.select(r.venue.id,r.topic.id,day);name.append(go);
      } else name.textContent=r.venue.name;
      if(r.reason) {
        const status=tr.insertCell();status.className='dim';status.colSpan=6;status.textContent=r.reason;
      } else {
        for(const value of [pct(r.p),pct(r.y),ctx.formatGap(r.y-r.p),f(r.wins),f(r.n),f(r.e)]) tr.insertCell().textContent=value;
      }
    }
    if(!results.length) blankRow(body,7,'No venues are available.');
    // Election clock (study 11, review R2-2): the full Kalshi and Polymarket rows behind these prices.
    const A=window.AtlasElectionCaveat;
    if(A) A.footnote('cross-election',body.closest('.scroll')||body.closest('table'),A.rowsNote(ctx.caveat,'all',
      results.filter(r=>r.topic && ['kalshi','polymarket'].includes(r.venue.id)).map(r=>({topic:r.topic,day:+day,venue:r.venue.id}))),null);
    button.disabled=!results.some(r=>!r.reason);
    button.onclick=()=>ctx.exportCSV('venue-comparison-'+day+'d-'+price+'pct-'+match+(isWindow?'-'+radius+'pp':'')+'.csv',
      ['venue','event_type','days_before_cutoff','side','price_matching','target_favorite_pct','margin_pp','mean_price','observed_rate','gap_actual_minus_price','wins','contracts','events','status'],
      results.map(r=>[r.venue.name,ctx.topic.name,day,side,match,price,isWindow?radius:'',r.p??'',r.y??'',r.reason?'':r.y-r.p,r.wins??'',r.n??(r.empty?0:''),r.e??(r.empty?0:''),r.reason||'Observed']));
  }

  function countDays(day) {return day+' '+(+day===1?'day':'days');}

  function metricValue(ctx,metric,value) {
    if(value==null || !Number.isFinite(+value)) return '—';
    if(metric.unit==='points') return ctx.formatGap(value);
    if(metric.unit==='percent') return ctx.formatPct(value);
    if(metric.unit==='score') return (+value).toFixed(3);
    return ctx.formatInt(value);
  }

  async function matrix(ctx) {
    const serial=++matrixGeneration,meta=ctx.metas[ctx.venue],table=$('matrix'),button=$('matrix-export');
    const filter=$('matrix-search').value.trim().toLowerCase(),metric=definitions[$('matrix-metric').value]||definitions.ece;
    if(!meta) {table.replaceChildren();button.disabled=true;return;}
    const benchmarks=[...new Set(meta.topics.flatMap(t=>Object.keys(t.bench||{}).map(Number)))].sort((a,b)=>a-b);
    const requested=+ctx.day,custom=Number.isInteger(requested)&&requested>0&&!benchmarks.includes(requested);
    const horizons=custom?[...benchmarks,requested].sort((a,b)=>a-b):benchmarks;
    let daily=null,unavailable=false;
    if(custom && requested<=meta.maxDays) {
      const id=ctx.venue;
      if(!summaryCache.has(id)) summaryCache.set(id,ctx.loadData(id,'matrix').catch(e=>{summaryCache.delete(id);throw e;}));
      try {daily=(await summaryCache.get(id))[requested]||{};} catch(_) {unavailable=true;}
    }
    if(serial!==matrixGeneration || current!==ctx) return;
    const metadata=meta.topics.filter(t=>!filter||t.name.toLowerCase().includes(filter));
    const escape=ctx.escape,exportRows=[];
    // Election clock (study 11, review R2-2): a dagger on cells whose row holds 2024 US election prices traded after
    // the polls closed; the CSV gets their count.
    const A=window.AtlasElectionCaveat, covered=A&&A.VENUES.includes(ctx.venue);
    let daggers=0,unavailableCells=0;
    table.innerHTML='<thead><tr><th scope="col">Event type</th>'+horizons.map(d=>'<th scope="col">'+d+'d</th>').join('')+'</tr></thead><tbody></tbody>';
    const body=table.tBodies[0];
    if(!metadata.length) blankRow(body,horizons.length+1,'No event type matches your search.');
    const html=metadata.map(t=>{
      const cells=horizons.map(day=>{
        const arr=day===requested && custom ? daily?.[t.id] : t.bench?.[day];
        const unready=day===requested && custom && unavailable;
        const flag=covered&&arr?A.check(ctx.caveat,ctx.venue,t,day,arr):null, late=flag&&!flag.unavailable;
        if(late) daggers++; else if(flag) unavailableCells++;
        exportRows.push([sourceFor(ctx)?.name||ctx.venue,t.name,t.kind,day,...(arr||['','','','','']),unready?'Could not load this day':(arr?'Observed':'No observation'),
          flag?(late?flag.contracts:'unavailable'):(covered&&arr?0:'')]);
        if(!arr || arr[metric.index]==null) return '<td class="dim" title="'+(unready?'Could not load this day':arr?'No qualifying favorite':'No eligible observation')+'">'+(unready?'Unavailable':'—')+'</td>';
        const text=metricValue(ctx,metric,arr[metric.index]);
        const description=t.name+', '+countDays(day)+', '+metric.name+' '+text+'; '+ctx.formatInt(arr[0])+' contracts in '+ctx.formatInt(arr[1])+' events'+
          (late?'; '+A.phrase(flag,w=>metricValue(ctx,metric,{0:w.contracts,1:w.events,2:w.brier,3:w.winRate,4:w.bias}[metric.index])):'');
        return '<td><button class="matrix-value" data-topic="'+escape(String(t.id))+'" data-day="'+day+'" title="'+escape(description)+'" aria-label="'+escape(description)+'">'+escape(text)+'</button>'+
          (late?'<span class="matrix-flag" aria-hidden="true">†</span>':'')+'</td>';
      });
      return '<tr><th scope="row">'+escape(t.name)+'</th>'+cells.join('')+'</tr>';
    });
    if(metadata.length) body.innerHTML=html.join('');
    if(A) A.footnote('matrix-election',table.closest('.scroll')||table,unavailableCells?A.UNAVAILABLE:daggers?
      '† Values marked with a dagger come from rows that include 2024 US election prices traded after the polls closed on 5 November 2024, so for those prices "days before cutoff" is not days before the result. Hover or focus a value for the count and the value without them; the CSV has a post_election_contracts column.':'',null);
    table.onclick=e=>{const target=e.target.closest('button[data-topic][data-day]');if(target)ctx.select(ctx.venue,target.dataset.topic,+target.dataset.day);};
    button.disabled=!exportRows.length;
    button.onclick=()=>ctx.exportCSV(ctx.venue+'-topic-horizons.csv',['venue','event_type','group_level','days_before_cutoff','contracts','events','brier_score','favorite_win_rate','signed_bias_probability_units','status','post_election_contracts'],exportRows);
  }

  function render(ctx) {
    current=ctx;
    if(!$('compare-export')) {
      const button=document.createElement('button');button.id='compare-export';button.className='export';button.type='button';button.textContent='Download CSV ↓';
      button.setAttribute('aria-label','Download the cross-venue price comparison CSV');
      $('compare-match').closest('.rowcontrols').append(button);
    }
    $('compare-price').oninput=$('compare-radius').oninput=()=>cross(current);
    $('compare-match').onchange=()=>cross(current);
    $('matrix-metric').onchange=$('matrix-search').oninput=()=>matrix(current);
    return Promise.all([cross(ctx),matrix(ctx)]);
  }

  function dateLabel(iso) {
    if(!iso) return 'unknown';
    const date=new Date(iso+'T00:00:00Z');
    return Number.isFinite(+date)?new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(date):iso;
  }

  function coverage(ctx) {
    const holder=$('sources');holder.replaceChildren();
    for(const v of ctx.venues) {
      const meta=ctx.metas[v.id], card=document.createElement('article');
      card.className='source';
      const title=document.createElement('h3');title.textContent=v.name;card.append(title);
      if(typeof v.money==='string') {const sub=document.createElement('span');sub.className='subtag';sub.textContent=v.money;title.append(sub);}
      function paragraph(txt) {if(!txt) return; const p=document.createElement('p');p.textContent=txt;card.append(p);}
      paragraph(v.scope);
      if(meta) {
        paragraph('Favorites at 51% or above · '+dateLabel(meta.minDate)+' – '+dateLabel(meta.maxDate)+' · '+ctx.formatInt(meta.contracts)+' contracts · '+ctx.formatInt(meta.events)+' events · '+ctx.formatInt(meta.observations)+' price observations.');
        paragraph(meta.topics.filter(t=>t.kind==='detail').length+' event types · Longest observed horizon '+ctx.formatInt(meta.maxDays)+' days.');
      } else paragraph('Coverage figures are unavailable.');
      paragraph(v.method);
      const links=document.createElement('p');
      for(const s of v.sources||[]) {
        if(!/^https?:\/\//i.test(s.url||'')) continue;
        const a=document.createElement('a');a.href=s.url;a.textContent=s.label||'Source';a.target='_blank';a.rel='noopener noreferrer';
        if(links.childNodes.length) links.append(document.createTextNode(' · '));
        links.append(a);
      }
      if(links.childNodes.length)card.append(links);
      holder.append(card);
    }
  }
  window.AtlasCompare={render,coverage};
}());
