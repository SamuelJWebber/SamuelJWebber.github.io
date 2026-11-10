/* Compare three price bases without changing the outcome or favorite between columns. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const currency = v => (100*v).toFixed(2)+'¢';
  const signedCents = v => (v>0?'+':'')+currency(v);
  const params = new URLSearchParams(location.search);
  let sampleChoice=params.get('qs'), initial=true, request=0;

  function derive(r) {
    const {yesBid:b,yesAsk:a,yesTrade:t,outcome:y}=r;
    if (![b,a,y].every(Number.isFinite) || b<0 || a>1 || a<b || (t!=null && (!Number.isFinite(t) || t<0 || t>1)) || (y!==0 && y!==1)) return;
    const mid=(b+a)/2;
    if (Math.round(Math.abs(mid-.5)*1e10)<1e8) return;
    const yes=mid>.5;
    const ask=yes?a:1-b;
    return {...r,side:yes?'YES':'NO',bid:yes?b:1-a,ask,normalizedAsk:ask/(a+1-b),
      trade:t==null?null:(yes?t:1-t),midpoint:yes?mid:1-mid,won:yes?y:1-y};
  }

  function updateParam(k,value) {
    const url=new URL(location.href);
    url.searchParams.set(k,value);
    history.replaceState(null,'',url);
  }

  function horizonLinks(ctx, days) {
    const group=document.createElement('div');group.className='quote-days';
    if (!days.length) return group;
    const label=document.createElement('span');label.textContent='Quote sample horizons';group.append(label);
    for (const day of days) {
      const b=document.createElement('button');b.type='button';b.className='export';b.textContent=day+'d';
      b.setAttribute('aria-pressed',String(day===ctx.day));b.onclick=()=>ctx.chooseDay(day);group.append(b);
    }
    return group;
  }

  function sourceLink(source) {
    try {
      const url=new URL(source);
      if(url.protocol==='https:') {
        const a=document.createElement('a');a.href=url.href;a.textContent='Quote source';a.target='_blank';a.rel='noopener';return a;
      }
    } catch {}
    return '';
  }

  function show(ctx, venue, panel, displayed) {
    const host=$('quote-results'),feeField=$('quote-fee'),dl=$('quotes-export');
    const fee=feeField.valueAsNumber;
    const goodFee=Number.isFinite(fee) && fee>=0 && fee<=100;
    feeField.setAttribute('aria-invalid',String(!goodFee));dl.disabled=true;
    const matches=r=>ctx.topic.kind==='all' || (ctx.topic.kind==='broad'
      ? String(r.category).toLowerCase()===ctx.topic.name.replace(/^All /,'').toLowerCase()
      : r.topic===ctx.topic.name);
    const unpack = row=>Object.fromEntries(panel.columns.map((field,i)=>[field,row[i]]));
    const scope=panel.rows.map(unpack).filter(matches);
    const slice=scope.filter(r=>r.days===ctx.day);
    const rows=slice.map(derive).filter(Boolean);
    const method=document.createElement('details');method.className='quote-method';
    const title=document.createElement('summary');title.textContent='Sample and price definitions';
    const methodText=document.createElement('p');methodText.textContent=panel.method;
    if(panel.refreshedAt) methodText.textContent+=' Sample expanded '+String(panel.refreshedAt).slice(0,10)+'. Existing historical observations were retained where their contract, horizon and cutoff matched.';
    const src=sourceLink(panel.source);method.append(title,methodText,src);
    for (const [i,url] of (panel.outcomeSources||[]).entries()) {
      const link=sourceLink(url);
      if(link) {link.textContent='Outcome source '+(i+1);method.append(' · ',link);}
    }
    const days=[...new Set(scope.map(r=>r.days))].sort((a,b)=>a-b);
    host.replaceChildren(horizonLinks(ctx,days));
    const scopeText=document.createElement('p');scopeText.className='quote-scope';scopeText.textContent=displayed.label+' · '+ctx.topic.name+' · '+ctx.day+(ctx.day===1?' day':' days')+' before cutoff.';host.append(scopeText);
    const coverage=panel.coverage?.[ctx.day];
    const allVenueNote=ctx.venue==='all'?' With All markets selected, this analysis shows one quote source at a time.':'';
    const studyNote=document.createElement('p');studyNote.className='hint';studyNote.textContent=displayed.note+allVenueNote;host.append(studyNote);
    if(!rows.length) {
      const empty=document.createElement('p');empty.className='empty';
      empty.textContent=slice.length?'No two-sided midpoint favorite reached 51% for this selection.':'No eligible paired quote and outcome for this event type and horizon.';
      host.append(empty,method);return;
    }
    const mean=f=>rows.reduce((s,r)=>s+f(r),0)/rows.length;
    const n=rows.length, events=new Set(rows.map(r=>r.event)).size;
    const win=mean(r=>r.won),mid=mean(r=>r.midpoint),ask=mean(r=>r.ask),spread=mean(r=>r.ask-r.bid);
    const card=(label,value,note)=>'<div class="kpi"><label>'+label+'</label><strong>'+value+'</strong><small>'+note+'</small></div>';
    const output=document.createElement('div');
    output.innerHTML='<div class="kpis quote-kpis">'+
      card('Matched contracts',ctx.formatInt(n),ctx.formatInt(events)+' distinct events')+
      card('Average spread',currency(spread),'Favorite ask minus favorite bid')+
      card('Cost above midpoint',currency(ask-mid),'Paid when buying at the quoted ask')+
      card('Favorite win rate',ctx.formatPct(win),'Same outcomes for every price basis')+'</div>';
    const tableRows=[
      ['Bid–ask midpoint',mid,mean(r=>(r.midpoint-r.won)**2)],
      ['Proportional no-vig price',mean(r=>r.normalizedAsk),mean(r=>(r.normalizedAsk-r.won)**2)],
      ['Buy at the ask',ask,mean(r=>(r.ask-r.won)**2)]
    ];
    const tradeCount=rows.filter(r=>r.trade!=null).length;
    if(tradeCount===n) tableRows.unshift(['Last trade',mean(r=>r.trade),mean(r=>(r.trade-r.won)**2)]);
    output.innerHTML+='<div class="scroll"><table aria-label="Alternative price bases for the same contracts"><thead><tr><th>Price basis</th><th>Mean price</th><th>Actual win rate</th><th>Win rate − price</th><th>Brier score</th></tr></thead><tbody>'+
      tableRows.map(([name,price,brier])=>'<tr><td>'+name+'</td><td>'+currency(price)+'</td><td>'+ctx.formatPct(win)+'</td><td>'+ctx.formatGap(win-price)+'</td><td>'+brier.toFixed(4)+'</td></tr>').join('')+'</tbody></table></div>';
    output.innerHTML+='<div class="quote-return"><div><span>Buying one favorite per contract at the quoted ask</span><strong>'+signedCents(win-ask)+' gross</strong></div><div><span>After the assumed fee</span><strong>'+(goodFee?signedCents(win-ask-fee/100)+' net':'Enter a fee from 0¢ to 100¢')+'</strong></div></div>';
    const note=document.createElement('p');note.className='hint';note.textContent='Amounts are averages per $1 contract held to settlement. '+ctx.formatInt(n)+' of '+ctx.formatInt(slice.length)+' quote rows in this selection had a midpoint favorite of at least 51%.';
    if(coverage && Number.isFinite(coverage.attempted) && Number.isFinite(coverage.observed)) note.textContent+=' Before event-type and favorite filters, '+ctx.formatInt(coverage.observed)+' of '+ctx.formatInt(coverage.attempted)+' sampled contracts at this horizon had usable quotes.';
    if(!tradeCount) note.textContent+=' This archive records quotes without a contemporaneous trade price.';
    else if(tradeCount!==n) note.textContent+=' Only '+ctx.formatInt(tradeCount)+' of '+ctx.formatInt(n)+' rows also have a trade price, so the paired comparison uses the midpoint and ask.';
    if(events<20) note.textContent+=' Fewer than 20 distinct events contribute to this result.';
    const ages=rows.map(r=>(r.anchor-r.days*86400-r.quoteTime)/3600).filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
    if(ages.length===rows.length) note.textContent+=' Median quote age at the forecast cutoff: '+ages[Math.floor(ages.length/2)].toFixed(1)+' hours; oldest: '+ages[ages.length-1].toFixed(1)+' hours.';
    host.append(output,note,method);
    dl.disabled=!goodFee;
    dl.onclick=()=>ctx.exportCSV(venue+'-paired-quotes-'+ctx.day+'d-'+ctx.topic.id,
      [...panel.columns,'midpoint_favorite','favorite_bid','favorite_midpoint','favorite_normalized_ask','favorite_ask','favorite_trade','favorite_won','assumed_fee_cents','net_result_cents'],
      rows.map(r=>[...panel.columns.map(k=>r[k]),r.side,r.bid,r.midpoint,r.normalizedAsk,r.ask,r.trade,r.won,fee,100*(r.won-r.ask)-fee]));
  }

  async function render(ctx) {
    const revision=++request, sel=$('quote-venue'), fee=$('quote-fee');
    if(initial) {
      const fromURL=Number(params.get('qfee'));
      if(Number.isFinite(fromURL) && fromURL>=0 && fromURL<=100) fee.value=fromURL;
      initial=false;
    }
    const registry=await ctx.readJSON('data/quotes/index.json');
    if(request!==revision)return;
    const venues=registry.filter(v=>ctx.venue==='all' || v.id===ctx.venue);
    sel.replaceChildren(...venues.map(v=>new Option(v.label,v.id)));
    $('quotes-controls').hidden=!venues.length;
    $('quote-venue-wrap').hidden=venues.length<2;
    $('quotes-export').disabled=true;
    const host=$('quote-results');host.textContent='';
    if(!venues.length) {
      const p=document.createElement('p');p.className='empty';
      p.textContent='This archive has no verified paired quote sample in the Atlas. The main accuracy charts use the recorded forecast price. ';
      const a=document.createElement('a');const u=new URL(location.href);u.searchParams.set('venue','all');u.searchParams.set('topic','0');u.searchParams.set('day','1');
      a.href=u.href;a.textContent='View the available quote samples →';p.append(a);host.append(p);return;
    }
    const selected=venues.find(v=>v.id===sampleChoice)||venues[0];sel.value=selected.id;
    sel.onchange=()=>{sampleChoice=sel.value;updateParam('qs',sampleChoice);render(ctx).catch(e=>{host.textContent=e.message;});};
    host.textContent='Loading historical quotes…';
    const panel=await ctx.readJSON('data/quotes/'+selected.id+'.json');
    if(request!==revision)return;
    fee.oninput=()=>{if(fee.value!=='' && fee.validity.valid) updateParam('qfee',fee.value);show(ctx,selected.id,panel,selected);};
    show(ctx,selected.id,panel,selected);
  }
  window.QuoteStudy={render};
})();
