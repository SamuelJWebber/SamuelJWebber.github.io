/* Fixed-cohort checks of the price-shock conclusions. */
(() => {
  'use strict';
  const finite=Number.isFinite,q=new URLSearchParams(location.search);
  const state={minimum:q.get('emin')==='5'?5:20,metric:q.get('emetric')==='gap'?'gap':'drift',quote:'default',announcement:'',newsEnd:15};
  let request=0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>finite(v)?v.toLocaleString('en-US'):'—';
  const pp=v=>finite(v)?(v>0?'+':'')+(100*v).toFixed(2)+' pp':'—';
  const pct=v=>finite(v)?(100*v).toFixed(1)+'%':'—';
  const score=v=>finite(v)?v.toFixed(4):'—';
  const range=(v,f=pp)=>Array.isArray(v)&&v.length===2&&v.every(finite)?f(v[0])+' to '+f(v[1]):'Not estimable';
  const metric=(obj,key)=>({mean:obj?.[key]??null,ci:obj?.ci?.[key]??null,n:obj?.n,events:obj?.events});
  const direction=m=>m?.ci?.every(finite)?m.ci[1]<0?'negative':m.ci[0]>0?'positive':'uncertain':'unknown';
  const pvalue=v=>finite(v)?v<.001?'<0.001':v.toFixed(3):'—';
  function updateURL(){const u=new URL(location.href);u.searchParams.set('emin',state.minimum);u.searchParams.set('emetric',state.metric);history.replaceState(null,'',u);}
  const details=(title,body)=>'<details class="evidence-details"><summary>'+title+'</summary>'+body+'</details>';
  const cell=v=>'<td>'+v+'</td>';
  const table=(headers,rows,label)=>'<div class="scroll"><table aria-label="'+esc(label)+'"><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(cell).join('')+'</tr>').join('')+'</tbody></table></div>';
  function note(label,text,kind='neutral'){return '<div class="evidence-finding '+kind+'"><span>'+label+'</span><p>'+text+'</p></div>';}
  function forest(rows,label){
    const good=rows.filter(r=>finite(r.value?.mean));
    if(!good.length)return '<p class="empty">No estimable comparison for this selection.</p>';
    const W=1040,L=286,R=243,T=20,B=50,rowH=65,H=T+B+rows.length*rowH;
    const values=good.flatMap(r=>[r.value.mean,...(r.value.ci||[])]).filter(finite),extent=Math.max(.015,...values.map(Math.abs))*1.15;
    const x=v=>L+(v+extent)/(2*extent)*(W-L-R),y=i=>T+i*rowH+23;
    let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'">';
    for(let i=0;i<5;i++){const v=-extent+2*extent*i/4;svg+='<line class="evidence-grid" x1="'+x(v)+'" x2="'+x(v)+'" y1="'+T+'" y2="'+(H-B)+'"/><text class="evidence-axis" text-anchor="middle" x="'+x(v)+'" y="'+(H-B+24)+'">'+(100*v).toFixed(1)+' pp</text>';}
    svg+='<line class="evidence-zero" x1="'+x(0)+'" x2="'+x(0)+'" y1="'+T+'" y2="'+(H-B)+'"/>';
    rows.forEach((r,i)=>{const v=r.value||{},cy=y(i);svg+='<text class="evidence-row-label" x="0" y="'+(cy-4)+'">'+esc(r.label)+'</text><text class="evidence-row-note" x="0" y="'+(cy+14)+'">'+esc(r.note||n(r.n??v.n)+' observations · '+n(r.events??v.events)+' events')+'</text>';
      if(finite(v.mean)){if(v.ci?.every(finite))svg+='<line class="evidence-ci" x1="'+x(v.ci[0])+'" x2="'+x(v.ci[1])+'" y1="'+cy+'" y2="'+cy+'"/>';svg+='<circle cx="'+x(v.mean)+'" cy="'+cy+'" r="5" class="evidence-dot"><title>'+esc(r.label+': '+pp(v.mean)+'; 95% interval '+range(v.ci))+'</title></circle>';}
      svg+='<text class="evidence-value" x="'+(W-R+21)+'" y="'+(cy-3)+'">'+pp(v.mean)+'</text><text class="evidence-row-note" x="'+(W-R+21)+'" y="'+(cy+15)+'">'+esc(range(v.ci))+'</text>';
    });
    const pos=v=>100*(v+extent)/(2*extent);
    const mobile='<div class="evidence-mobile-forest"><div class="evidence-mobile-axis"><span>'+pp(-extent)+'</span><span>0</span><span>'+pp(extent)+'</span></div>'+rows.map(r=>{const v=r.value||{};return '<div class="evidence-mobile-row"><strong>'+esc(r.label)+'</strong><small>'+esc(r.note||n(r.n??v.n)+' observations · '+n(r.events??v.events)+' events')+'</small><div class="evidence-mobile-estimate"><b>'+pp(v.mean)+'</b><span>95% interval '+range(v.ci)+'</span></div><div class="evidence-mobile-track"><i class="evidence-mobile-zero"></i>'+(finite(v.mean)?(v.ci?.every(finite)?'<i class="evidence-mobile-ci" style="left:'+pos(v.ci[0])+'%;width:'+(pos(v.ci[1])-pos(v.ci[0]))+'%"></i>':'')+'<i class="evidence-mobile-dot" style="left:'+pos(v.mean)+'%"></i>':'')+'</div></div>';}).join('')+'</div>';
    return '<div class="evidence-forest">'+svg+'</svg></div>'+mobile;
  }
  function replication(data){
    if(!data)return '';
    const cohorts=(data.cohorts||[]).map(c=>({...c,a:c.analyses?.[state.minimum]})).filter(c=>c.a);
    const key=state.metric==='gap'?'gap':'drift',offset=state.metric==='gap'?'0':'60';
    const rows=cohorts.map(c=>({label:c.id==='march_reference'?'March reference':c.id==='february_all'?'February, all eligible events':'February, new event groups',n:c.a.n,events:c.a.events,value:metric(c.a.path?.[offset],key)}));
    const base=cohorts.find(c=>c.id==='march_reference'),independent=cohorts.find(c=>c.id==='february_disjoint');
    const b=metric(base?.a.path?.['60'],'drift'),f=metric(independent?.a.path?.['60'],'drift');
    let finding='The replication is too small to establish whether the March pattern repeats.';
    if(direction(b)==='negative'&&direction(f)==='negative')finding='The average one-hour reversal appears in both March and the separate February event groups.';
    else if(direction(b)==='negative'&&direction(f)==='positive')finding='The separate February event groups move in the opposite direction. The March reversal is not stable across these periods.';
    else if(direction(b)==='negative'&&finite(f.mean))finding='The March reversal is not clearly established in the separate February event groups; their interval includes zero or cannot be estimated.';
    else if(finite(b.mean)&&finite(f.mean))finding='These periods do not establish one consistent direction of average adjustment. Compare the size and uncertainty of each estimate.';
    return '<section class="evidence-block"><div class="evidence-block-head"><h3>Does it repeat in a different month?</h3><label>Compare<select id="evidence-metric"><option value="drift">Further price move over 60 minutes</option><option value="gap">Initial price minus outcome rate</option></select></label></div>'+note('Earlier-period replication',finding)+
      '<p class="hint">February 1–28, 2026 was evaluated with rules fixed before its results were opened. The last row excludes every parent event present in the March 1–28 archive. This is an earlier-period replication, not a prospective forecast test.</p>'+forest(rows,state.metric==='gap'?'Initial calibration across replication cohorts':'One-hour price movement across replication cohorts')+
      '<p class="hint">'+(state.metric==='gap'?'Positive gaps mean the rising side was priced above its eventual win rate.':'Negative changes mean the rising side gave back some of its initial jump.')+' Intervals cluster related contracts and repeated shocks by parent event.</p>'+
      details('Replication sample and forecast error',table(['Sample','Selected shocks','Complete paths','Retained','Events','Initial price','Outcome rate','Initial gap','60-minute drift','Brier improvement'],cohorts.map(c=>{const a=c.a,p=a.path?.['0'],end=a.path?.['60'];return [esc(c.label),n(a.selected),n(a.n),pct(a.retention),n(a.events),pct(p?.expected),pct(p?.observed),pp(p?.gap),pp(end?.drift),score(end?.brierGain)];}),'Replication sample and forecast error')+'<p class="hint">The detector, four-times-noise rule, six-hour spacing and exact 60-minute follow-up grid are the same. Calendar composition and the markets available in each month still differ.</p>')+
      '<p class="evidence-downloads"><a href="data/intraday/shock-replication.json" download>Replication results and provenance · JSON</a>'+((data.sourceManifest?.normalizedDownloads||[]).length?' · '+data.sourceManifest.normalizedDownloads.map((d,i)=>'<a href="'+esc(d.path)+'" download>February bars part '+(i+1)+'</a>').join(' · '):'')+'</p></section>';
  }
  function inference(data){
    const s=data?.scenarios?.[state.minimum];if(!s)return '';
    const episode=s.weights?.episode,event=s.weights?.eventEqual,day=s.dayBootstrap?.metrics;
    const row=data.multiplicity?.rows?.find(r=>r.thresholdPoints===state.minimum&&r.minutes===60);
    const rows=[{label:'Each shock has equal weight',n:episode?.n,events:episode?.events,value:episode?.metrics?.drift60},
      {label:'Each parent event has equal weight',n:event?.n,events:event?.events,value:event?.metrics?.drift60},
      {label:'Resample whole calendar days',n:episode?.n,events:episode?.events,note:n(s.dayBootstrap?.days)+' days · '+n(s.dayBootstrap?.replicates)+' resamples',value:day?.drift60}];
    if(row)rows.push({label:'Account for the tested grid',n:row.n,events:row.events,value:{mean:row.drift,ci:row.simultaneousCI}});
    const base=episode?.metrics?.drift60,daySign=direction(day?.drift60),adjusted=row?.passesHolm;
    let statement='The uncertainty checks do not establish a clear one-hour direction for this shock threshold.';
    if(direction(base)==='negative'&&direction(event?.metrics?.drift60)==='negative'&&daySign==='negative'&&adjusted)statement='The March one-hour reversal survives equal-event weighting, calendar-day uncertainty and the stated multiple-testing check. This does not establish that it generalizes to every category or another month.';
    else if(direction(base)==='negative'&&(daySign!=='negative'||adjusted===false))statement='The apparent reversal becomes less decisive under at least one stronger uncertainty check.';
    return '<section class="evidence-block"><h3>Is the finding driven by how we count uncertainty?</h3>'+note('Dependence and repeated testing',statement)+forest(rows,'Alternative weighting and uncertainty for one-hour price movement')+
      '<p class="hint">The day resample keeps shocks on a calendar day together. It is a separate dependence check, not a guarantee against every shared-information pattern. Event weighting gives each parent event equal influence.</p>'+
      details('Time stability and influential groups',table(['Period','Shocks','Events','60-minute drift','95% interval','Initial gap'],(s.timeSplits||[]).map(x=>[esc(x.label),n(x.n),n(x.events),pp(x.metrics?.drift60?.mean),range(x.metrics?.drift60?.ci),pp(x.metrics?.initialGap?.mean)]),'Within-March time stability')+'<p class="hint">Both March periods were already explored. This is a stability check, not an untouched holdout.</p>'+table(['Category left out','Shocks','Events','60-minute drift','95% interval'],(s.leaveCategoryOut||[]).map(x=>[esc(x.excluded),n(x.n),n(x.events),pp(x.metrics?.drift60?.mean),range(x.metrics?.drift60?.ci)]),'Category influence')+'<p class="hint">The largest parent event contributes '+n(s.eventInfluence?.largestEventN)+' shocks ('+pct(s.eventInfluence?.largestEventShare)+'). Removing one event at a time leaves the mean drift between '+range(s.eventInfluence?.leaveOneEventDriftRange)+'. This range is an influence check, not a confidence interval.</p>')+
      details('Multiple-testing grid',table(['Minimum initial move','Minutes later','Shocks','Further move','Pointwise 95% interval','Simultaneous interval','Holm-adjusted p'],(data.multiplicity?.rows||[]).map(x=>[x.thresholdPoints+'¢',n(x.minutes),n(x.n),pp(x.drift),range(x.ci),range(x.simultaneousCI),pvalue(x.holmP)]),'Multiple-testing sensitivity grid')+'<p class="hint">The family contains '+n(data.multiplicity?.familySize)+' stated comparisons. This correction does not erase earlier exploration or cover every possible dashboard filter.</p>')+
      '<p class="evidence-downloads"><a href="data/intraday/shock-robustness.json" download>Uncertainty, selection and sensitivity results · JSON</a></p></section>';
  }
  function missing(data){
    const s=data?.scenarios?.[state.minimum];if(!s)return '';
    const c=s.cohorts||{},b=s.missingBounds||{},names=[['allSelected','Every selected shock'],['completePath','Complete path at every point'],['endpointOnly','Observed at the 60-minute endpoint']];
    return '<section class="evidence-block"><h3>Could missing follow-ups change the answer?</h3>'+note('Coverage limits the conclusion','Complete price paths represent the actively observed subset. These checks show how that subset differs from all detected shocks.')+
      table(['Sample','Shocks','Events','Initial price','Outcome rate','Initial gap','60-minute drift'],names.filter(([key])=>c[key]).map(([key,label])=>{const x=c[key],m=x.metrics||{};return [label,n(x.n),n(x.events),pct(m.initialPrice?.mean),pct(m.outcomeRate?.mean),pp(m.initialGap?.mean),pp(m.drift60?.mean)];}),'Observed versus missing shock paths')+
      '<p class="hint">'+n(b.eligibleThrough60N)+' selected shocks remain open through the one-hour target; '+n(b.missingEligibleN)+' of these have no eligible endpoint price. '+n(b.excludedCloseN)+' close before that target and have no defined post-close price in this study.</p>'+
      (Array.isArray(b.drift60)?'<p class="evidence-bounds">Allowing each missing endpoint to be anywhere from 0% to 100%, the full eligible sample’s mean one-hour movement could range from <strong>'+range(b.drift60)+'</strong>.</p>':'')+
      '<p class="hint">This is a logical range under missing data, not a confidence interval and not an estimate that the extremes are likely. Missing prices are never replaced by zero movement.</p></section>';
  }
  function controls(data){
    if(!data)return '';
    const cases=(data.cases||[]).filter(x=>x.minimumJumpPoints===state.minimum).sort((a,b)=>(a.comparison==='contemporaneous'?0:1)-(b.comparison==='contemporaneous'?0:1));
    return '<section class="evidence-block"><h3>Do comparable quiet periods behave differently?</h3><p class="hint">The primary comparison uses other contracts at the same time and in the same detailed event type. Each quiet window is chosen before checking future-price availability. These are observational comparisons, not randomized controls.</p>'+(cases.length&&cases.every(c=>c.counts?.clusterGroups<20)?note('Limited matching support','Both comparisons have fewer than 20 event clusters. They cannot independently establish a general overreaction effect with this interval method.'):'')+
      cases.map(c=>{const m=c.metrics||{},counts=c.counts||{},sign=direction(m.excessDrift);const text=sign==='negative'?'Shocks fall more than their matched quiet windows over the following hour.':sign==='positive'?'Shocks rise more, or fall less, than their matched quiet windows over the following hour.':'The paired comparison does not establish a clear additional one-hour move after shocks.';return '<div class="evidence-control"><h4>'+esc(c.label)+(c.comparison==='same_contract'?' · secondary check':' · primary comparison')+'</h4>'+note(n(counts.completePairs)+' complete pairs · '+n(counts.clusterGroups)+' event clusters',text)+(c.comparison==='same_contract'?'<p class="hint">Matching an earlier price to the later post-jump price can select a fall-then-rebound history. This secondary check does not identify the causal effect of the shock.</p>':'')+forest([
        {label:'Shock windows',value:m.shockDrift,n:counts.completePairs,events:counts.clusterGroups},
        {label:'Matched quiet windows',value:m.controlDrift,n:counts.completePairs,events:counts.clusterGroups},
        {label:'Shock minus quiet window',value:m.excessDrift,n:counts.completePairs,events:counts.clusterGroups}
      ],c.label+' one-hour price movement')+'<p class="hint">'+n(counts.selectedShocks)+' shocks selected; '+n(counts.matchedBeforeFollowup)+' found a control before future prices were checked; '+n(counts.completePairs)+' pairs have every required follow-up. '+n(counts.unmatchedShocks)+' shocks have no match within the stated limits.</p>'+details('Balance and interpretation','<p>'+esc((c.limitations||[]).join(' '))+'</p><p>Prices must match within 5 percentage points and remaining time within a factor of two. Noise, activity and volume affect which control is chosen but do not have strict matching limits. Residual differences remain.</p><p>Among complete pairs, the mean absolute price difference is '+pp(c.balance?.completePairs?.priceDifference?.meanAbsolute)+' and the mean absolute noise difference is '+pp(c.balance?.completePairs?.noiseDifference?.meanAbsolute)+'. Mean remaining time is '+(finite(c.balance?.completePairs?.meanShockLeadHours)?c.balance.completePairs.meanShockLeadHours.toFixed(1):'—')+' hours for shocks versus '+(finite(c.balance?.completePairs?.meanControlLeadHours)?c.balance.completePairs.meanControlLeadHours.toFixed(1):'—')+' hours for controls.</p>'+table(['Quantity','Shock','Control','Paired difference'],[
        ['60-minute drift',pp(m.shockDrift?.mean),pp(m.controlDrift?.mean),pp(m.excessDrift?.mean)+' · '+range(m.excessDrift?.ci)],
        ['Brier improvement',score(m.shockBrierGain?.mean),score(m.controlBrierGain?.mean),score(m.excessBrierGain?.mean)+' · '+range(m.excessBrierGain?.ci,score)]
      ],c.label+' paired forecast comparison'))+'</div>';}).join('')+
      '<p class="evidence-downloads"><a href="data/intraday/shock-controls.json" download>Matched-control results · JSON</a> · <a href="data/intraday/shock-control-pairs.json.gz" download>Matched pairs · JSON gzip</a></p></section>';
  }
  function quotes(data){
    if(!data)return '';
    const checks=data.checks||[],desired=state.minimum===20?'large20':state.quote;
    const c=checks.find(x=>x.id===desired)||checks[0];if(!c)return '';
    const t=c.trade?.path?.['60'],m=c.midpoint?.path?.['60'],initialT=c.trade?.path?.['0'],initialM=c.midpoint?.path?.['0'],diff=c.pairedDifference||{};
    let finding='This quote sample is too small or imprecise to establish whether using midpoints changes the one-hour conclusion.';
    if(direction(metric(t,'drift'))==='negative'&&direction(metric(m,'drift'))==='negative')finding='The average reversal remains visible using midpoint prices on these same episodes.';
    else if(direction(metric(t,'drift'))==='negative'&&direction(metric(m,'drift'))!=='negative')finding='The trade-price reversal is not clearly established in midpoint prices on the same episodes.';
    return '<section class="evidence-block"><div class="evidence-block-head"><h3>Could the bid–ask spread explain the jump?</h3>'+(state.minimum===5?'<label>Quote check<select id="evidence-quote">'+checks.filter(x=>x.id!=='large20').map(x=>'<option value="'+esc(x.id)+'"'+(x.id===c.id?' selected':'')+'>'+esc(x.label)+'</option>').join('')+'</select></label>':'')+'</div>'+note('Same episodes, different price measure',finding)+
      '<p class="hint">'+n(c.completeBoth)+' complete trade-and-quote paths across '+n(c.events)+' parent events. Trade and midpoint results use identical episodes and timestamps. This Kalshi check cannot validate the Polymarket result, whose archive lacks historical quotes.</p>'+forest([
        {label:'Last-trade price',n:c.completeBoth,events:c.events,value:metric(t,'drift')},
        {label:'Bid–ask midpoint',n:c.completeBoth,events:c.events,value:metric(m,'drift')},
        {label:'Trade minus midpoint',n:c.completeBoth,events:c.events,value:metric(diff,'tradeMinusMidpointDrift')}
      ],'Kalshi trade and midpoint one-hour price movement')+
      table(['Price measure','Mean initial jump','Initial price','Outcome rate','Initial gap','60-minute drift','Brier improvement'],[
        ['Last trade',pp(initialT?.initialJump),pct(initialT?.expected),pct(initialT?.observed),pp(initialT?.gap),pp(t?.drift),score(t?.brierGain)],
        ['Midpoint',pp(initialM?.initialJump),pct(initialM?.expected),pct(initialM?.observed),pp(initialM?.gap),pp(m?.drift),score(m?.brierGain)]
      ],'Kalshi same-episode trade and midpoint comparison')+
      '<p class="hint">The initial trade-price jump exceeds the midpoint jump by '+pp(diff.tradeMinusMidpointInitialJump)+' (95% interval '+range(diff.ci?.tradeMinusMidpointInitialJump)+'). Midpoints are a check on trade-price noise, not an observed fair probability.</p>'+
      details('All quote and liquidity checks',table(['Check','Selected','Trade paths','Trade + quote paths','Events','Trade drift','Midpoint drift','Difference interval'],checks.map(x=>[esc(x.label),n(x.selected),n(x.completeTrade),n(x.completeBoth),n(x.events),pp(x.trade?.path?.['60']?.drift),pp(x.midpoint?.path?.['60']?.drift),range(x.pairedDifference?.ci?.tradeMinusMidpointDrift)]),'Quote and liquidity sensitivity')+'<p>'+esc((data.meta?.limitations||[]).join(' '))+'</p>')+
      '<p class="evidence-downloads"><a href="data/intraday/shock-quote-checks.json" download>Quote-check results · JSON</a> · <a href="data/intraday/shock-quote-pairs.json.gz" download>Paired quote observations · JSON gzip</a></p></section>';
  }
  function newsChart(path){
    if(!path?.length||!path.some(p=>finite(p.meanAbsError)))return '<p class="empty">No complete price path at every displayed point. Shorten the horizon or inspect the availability table.</p>';
    const W=1040,H=270,L=67,R=25,T=20,B=57,maximum=path.at(-1).minute,high=Math.max(.025,Math.ceil(Math.max(...path.map(p=>p.meanAbsError))*40)/40);
    const x=m=>L+m/maximum*(W-L-R),y=v=>T+(high-v)/high*(H-T-B);
    let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Distance from independently verified payout after the announcement">';
    for(let i=0;i<5;i++){const v=high*i/4;svg+='<line class="evidence-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text class="evidence-axis" x="'+(L-10)+'" y="'+(y(v)+4)+'" text-anchor="end">'+(v*100).toFixed(1)+' pp</text>';}
    svg+='<path class="evidence-news-line" d="'+path.map((p,i)=>(i?'L':'M')+x(p.minute)+' '+y(p.meanAbsError)).join(' ')+'"/>';
    path.forEach(p=>{svg+='<circle class="evidence-dot" cx="'+x(p.minute)+'" cy="'+y(p.meanAbsError)+'" r="4"><title>'+p.minute+' minutes: '+pp(p.meanAbsError)+' distance from payout; '+p.n+' contracts</title></circle><text class="evidence-axis" x="'+x(p.minute)+'" y="'+(H-B+22)+'" text-anchor="middle">'+(p.minute===0?'Release': '+'+p.minute+'m')+'</text>';});
    svg+='<text class="evidence-axis" x="'+((W+L-R)/2)+'" y="'+(H-5)+'" text-anchor="middle">Minutes after the independently timed announcement</text></svg>';
    return '<div class="evidence-news-chart">'+svg+'</div>';
  }
  function verifiedNews(data){
    if(!data)return '';
    const announcements=data.announcements||[];
    const a=announcements.find(x=>x.id===state.announcement)||announcements[0];if(!a)return '';
    state.announcement=a.id;
    const cohort=a.cohorts?.[state.newsEnd],path=cohort?.path||[],winners=(data.contracts||[]).filter(c=>c.announcement===a.id&&c.outcomeYes===1),five=data.overall?.availablePath?.find(p=>p.minute===5),outliers=(data.contracts||[]).filter(c=>finite(c.prices?.['5'])&&Math.abs(c.prices['5']-c.outcomeYes)>.05+1e-10);
    const price=c=>[0,5,15,60].map(m=>pct(c.prices?.[String(m)]));
    return '<section class="evidence-block evidence-verified"><div class="eyebrow">VERIFIED ANNOUNCEMENT CLOCKS</div><h3>What happens when the news time and answer are known?</h3>'+note('A separate, narrow benchmark','Three official US economic releases independently determine 31 binary contract answers. This test starts at the published release time and checks observed prices against the now-known 0-or-1 payout.')+
      '<p class="hint">These releases are selected by the announcement and contract rules, not by a detected price jump. The 5¢/20¢ audit selector does not change this section. Across the three releases, '+n(data.overall?.cohorts?.['5']?.n)+' contracts have both before/+5-minute observations, only '+n(data.overall?.cohorts?.['15']?.n)+' have complete 15-minute paths, and '+n(data.overall?.cohorts?.['60']?.n)+' have complete 60-minute paths. There are only three announcement clusters; no confidence intervals or general speed claim are reported.</p>'+
      '<div class="evidence-news-controls"><label>Official announcement<select id="evidence-announcement">'+announcements.map(x=>'<option value="'+esc(x.id)+'"'+(x.id===a.id?' selected':'')+'>'+esc(x.title)+'</option>').join('')+'</select></label><label>Require complete observations through<select id="evidence-news-end"><option value="5"'+(state.newsEnd===5?' selected':'')+'>5 minutes</option><option value="15"'+(state.newsEnd===15?' selected':'')+'>15 minutes</option><option value="60"'+(state.newsEnd===60?' selected':'')+'>60 minutes</option></select></label></div>'+
      '<p class="evidence-news-result"><strong>'+esc(a.localTime||(new Date(a.releaseUtc).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})+' ET'))+'</strong> · '+esc(a.result)+' · <a href="'+esc(a.sourceUrl)+'" target="_blank" rel="noopener">Official release</a></p>'+
      '<p class="evidence-cohort">'+n(cohort?.n)+' of '+n(a.eligibleContracts)+' contracts have every displayed price through '+state.newsEnd+' minutes.</p>'+newsChart(path)+
      (a.id==='fed'&&cohort?.n?'<p class="evidence-bounds">The observed Fed contracts were already close to their eventual payout before the announcement. Their small post-release error should not be interpreted as new information being absorbed quickly.</p>':'')+
      '<p class="hint">Lower distance means closer to the known payout. The release-time point contains trades from the five minutes before release; the first fully post-release bar ends at +5 minutes. The same contracts appear at every point. Complete paths favor contracts that keep trading. Trading may stop because the answer is known, so absent bars do not establish slow learning. Fees, settlement delay and platform risk can explain small residual distances.</p>'+
      '<p class="evidence-bounds">Across all three announcements at +5 minutes, '+n(five?.n)+' of '+n(data.meta?.eligibleContracts)+' contracts have observed bars. '+n(finite(five?.n)&&finite(five?.within5pp)?Math.round(five.n*five.within5pp):null)+' are within 5 percentage points of their payout; '+n(outliers.length)+' remain farther away. The missing '+n(data.meta?.eligibleContracts-five?.n)+' cannot be classified.</p>'+
      details('The contracts still far from payout at +5 minutes',table(['Contract','Known YES payout','+5-minute YES price','+10-minute price','+15-minute price'],outliers.map(c=>['<a href="'+esc(c.marketUrl)+'" target="_blank" rel="noopener">'+esc(c.question)+'</a>',pct(c.outcomeYes),pct(c.prices['5']),pct(c.prices['10']),pct(c.prices['15'])]),'Contracts farther than five points from payout at five minutes')+'<p>These cases include contracts omitted from the complete-path chart because an earlier or later bar is missing. Inspecting them avoids concluding that every contract had fully adjusted.</p>')+
      details('Winning-YES contracts and observed arrival times','<p>Many losing binary buckets already trade near zero. The winning-YES contracts below show whether the newly winning answer itself moved toward 100%. Missing observations are blank, not treated as failures or unchanged prices.</p>'+table(['Winning contract','At release','+5 min','+15 min','+60 min','First observed within 5 pp','Two-bar confirmation by'],winners.map(c=>['<a href="'+esc(c.marketUrl)+'" target="_blank" rel="noopener">'+esc(c.question)+'</a>',...price(c),finite(c.arrival?.['5']?.firstObservedMinute)?c.arrival['5'].firstObservedMinute+' min':'Not observed',finite(c.arrival?.['5']?.confirmationMinute)?c.arrival['5'].confirmationMinute+' min':'Not observed']),'Winning-YES contracts after the announcement')+'<p>Arrival times are observed five-minute bar endpoints, not second-level delays. An answer may already have been highly anticipated before the release. Confirmation is recorded at the second of two consecutive qualifying bars.</p>')+
      details('Coverage and the clock correction',table(['Minutes after release','Observed contracts','Mean distance from payout','Within 5 pp'],(a.availablePath||[]).map(p=>[p.minute===0?'Release':n(p.minute),n(p.n),pp(p.meanAbsError),pct(p.within5pp)]),'Announcement price availability')+'<p>The availability table changes composition and must not be read as a fixed-cohort time series.</p><p>'+esc(data.meta?.clockRepair)+'</p>')+
      '<p class="evidence-downloads"><a href="data/intraday/shock-verified-news.json" download>Verified-news results · JSON</a> · <a href="'+esc(data.meta?.manifest||'data/intraday/shock-verified-news-manifest.json')+'" download>Contract rules and release provenance</a> · <a href="'+esc(data.meta?.bars||'downloads/verified-news-bars.parquet')+'" download>Observed bars · Parquet</a></p></section>';
  }
  function overview(data){
    const march=data.replication?.cohorts?.find(c=>c.id==='march_reference')?.analyses?.[state.minimum],feb=data.replication?.cohorts?.find(c=>c.id==='february_disjoint')?.analyses?.[state.minimum];
    if(!march||!feb)return '';
    const row=data.inference?.multiplicity?.rows?.find(r=>r.thresholdPoints===state.minimum&&r.minutes===60);
    const ms=data.inference?.scenarios?.[state.minimum];
    if(direction(metric(march.path?.['60'],'drift'))==='negative'&&direction(metric(feb.path?.['60'],'drift'))!=='negative')return note('What the stronger checks say','The March reversal survives within-month checks, but was not clearly confirmed in the separate February event groups. General overreaction remains unproven. February’s interval still permits a meaningful reversal; it does not prove the months differ.');
    return note('What the stronger checks say','The broader shock sample does not establish a clear average one-hour reversal in either month. Forecast improvement, price drift and accuracy of the initial odds remain separate questions.');
  }
  function show(ctx,source,data,errors){
    const root=document.getElementById('shock-evidence-root');if(!root)return;
    const poly=source==='polymarket';
    root.innerHTML='<section class="panel shock-evidence"><div class="eyebrow">TEST THE CONCLUSION</div><div class="sectionhead"><div><h2>Does the conclusion survive stronger checks?</h2><p class="hint">Check the price-shock findings against another period, alternative prices, comparable quiet windows and different assumptions.</p></div><label class="evidence-threshold">Audit cohort<select id="evidence-minimum"><option value="5">At least 5¢ · broad shocks</option><option value="20">At least 20¢ · larger shocks</option></select></label></div>'+
      '<p class="evidence-scope"><strong>'+(poly?'Polymarket':'Kalshi')+' · fixed audit cohorts · all event types.</strong> The price-shock audits use four times prior noise, six-hour spacing and a 60-minute follow-up. '+(ctx.topic.kind==='all'?'':'The selected event-type filter does not change this all-topic audit. ')+'The exploratory controls above do not change these predefined comparisons.</p>'+
      (errors.length?'<p class="hint">Some audit files could not be loaded: '+errors.map(esc).join(', ')+'. Other checks remain available.</p>':'')+
      (poly?overview(data)+verifiedNews(data.news)+replication(data.replication)+inference(data.inference)+controls(data.controls)+missing(data.inference):quotes(data.quotes))+
      '<p class="evidence-footnote">Repeated descriptive findings strengthen evidence about price behavior. Price-detected shocks still use inferred news clocks. The verified-announcement check covers a small, different set of resolving releases; neither design establishes a general causal processing speed for all news. <a href="downloads/reproduce.zip" download>Methods and reproduction files ↓</a></p></section>';
    const el=id=>document.getElementById(id);
    el('evidence-minimum').value=String(state.minimum);el('evidence-minimum').onchange=e=>{state.minimum=+e.target.value;updateURL();show(ctx,source,data,errors);};
    if(el('evidence-metric')){el('evidence-metric').value=state.metric;el('evidence-metric').onchange=e=>{state.metric=e.target.value;updateURL();show(ctx,source,data,errors);};}
    if(el('evidence-quote'))el('evidence-quote').onchange=e=>{state.quote=e.target.value;show(ctx,source,data,errors);};
    if(el('evidence-announcement'))el('evidence-announcement').onchange=e=>{state.announcement=e.target.value;show(ctx,source,data,errors);};
    if(el('evidence-news-end'))el('evidence-news-end').onchange=e=>{state.newsEnd=+e.target.value;show(ctx,source,data,errors);};
  }
  async function render(ctx,source){
    const rev=++request,root=document.getElementById('shock-evidence-root');if(!root)return;
    if(!['polymarket','kalshi'].includes(source)){root.innerHTML='';return;}
    root.innerHTML='<section class="panel"><p class="hint">Loading the evidence checks…</p></section>';
    const files=source==='polymarket'?{replication:'shock-replication.json',inference:'shock-robustness.json',controls:'shock-controls.json',news:'shock-verified-news.json'}:{quotes:'shock-quote-checks.json'};
    const data={},errors=[];
    await Promise.all(Object.entries(files).map(async([key,path])=>{try{data[key]=await ctx.readJSON('data/intraday/'+path);}catch(error){errors.push(path);}}));
    if(rev===request)show(ctx,source,data,errors);
  }
  window.AtlasShockEvidence={render};
})();
