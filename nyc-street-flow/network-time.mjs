import {esc, fmt, sign, table} from './research-view.mjs';

export const JOURNEY_MODES = ['bike','car','bus','subway','walk'];
export const JOURNEY_LABELS = ['Bike','Car · all occupants','Bus','Subway','Walk'];
export const SWITCH_PAIRS = JOURNEY_MODES.flatMap((_,i)=>JOURNEY_MODES.flatMap((_,j)=>i===j?[]:[[i,j]]));
const VERSION = 1;
const MAX_COUNT = 10000000;
const MAX_TIME = 1440;
const EPS = 1e-8;
const clone = x=>JSON.parse(JSON.stringify(x));

export function journeyPreset(name='example'){
 const state={version:VERSION,counts:[100,500,200,500,100],before:[30,30,40,45,20],stay:[25,32,39,45,20],switches:SWITCH_PAIRS.map(()=>0),switchTimes:SWITCH_PAIRS.map(([,j])=>[25,32,39,45,20][j])};
 if(name==='unchanged'){state.stay=[...state.before];state.switchTimes=SWITCH_PAIRS.map(([,j])=>state.before[j]);}
 else {state.switches[SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===0)]=50;state.switches[SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===3)]=100;state.switchTimes[SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===3)]=name==='faster-subway'?20:40;}
 return state;
}

export function validateJourneyState(s){
 const errors=[];
 if(!s||s.version!==VERSION)return ['This saved scenario has an unsupported version.'];
 for(const [key,size,max] of [['counts',5,MAX_COUNT],['before',5,MAX_TIME],['stay',5,MAX_TIME],['switches',20,MAX_COUNT],['switchTimes',20,MAX_TIME]]){
  if(!Array.isArray(s[key])||s[key].length!==size){errors.push(`Invalid ${key} inputs.`);continue;}
  if(s[key].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>max))errors.push(`${key==='counts'||key==='switches'?'Traveler counts':'Journey minutes'} must be numbers between 0 and ${max.toLocaleString('en-US')}.`);
 }
 if(errors.length)return [...new Set(errors)];
 if(s.counts.reduce((a,b)=>a+b,0)<=0)errors.push('Enter at least one baseline traveler.');
 for(let i=0;i<5;i++){
  const outgoing=SWITCH_PAIRS.reduce((a,[from],k)=>a+(from===i?s.switches[k]:0),0);
  if(outgoing>s.counts[i]+EPS)errors.push(`${JOURNEY_LABELS[i]} switches exceed its ${fmt(s.counts[i],1)} baseline travelers. Reduce switches or increase that baseline group.`);
  if(s.counts[i]>EPS&&s.before[i]===0)errors.push(`${JOURNEY_LABELS[i]} needs a positive complete before time when it has travelers.`);
  if(s.counts[i]-outgoing>EPS&&s.stay[i]===0)errors.push(`${JOURNEY_LABELS[i]} stayers need a positive complete after time.`);
 }
 SWITCH_PAIRS.forEach(([i,j],k)=>{if(s.switches[k]>EPS&&s.switchTimes[k]===0)errors.push(`${JOURNEY_LABELS[i]} → ${JOURNEY_LABELS[j]} needs a positive complete after time when travelers switch.`);});
 return errors;
}

export function calculateJourneys(s){
 const errors=validateJourneyState(s);if(errors.length)return {valid:false,errors};
 const beforeTotal=s.counts.reduce((sum,n,i)=>sum+n*s.before[i],0);
 const people=s.counts.reduce((a,b)=>a+b,0);
 const afterCounts=Array(5).fill(0),afterMinutes=Array(5).fill(0),originAfterMinutes=Array(5).fill(0);
 const transitions=[];
 for(let i=0;i<5;i++){
  const outgoing=SWITCH_PAIRS.reduce((a,[from],k)=>a+(from===i?s.switches[k]:0),0);
  const stayed=Math.max(0,s.counts[i]-outgoing);
  transitions.push({from:i,to:i,people:stayed,afterMinutesEach:s.stay[i]});
 }
 SWITCH_PAIRS.forEach(([from,to],k)=>transitions.push({from,to,people:s.switches[k],afterMinutesEach:s.switchTimes[k]}));
 for(const row of transitions){afterCounts[row.to]+=row.people;afterMinutes[row.to]+=row.people*row.afterMinutesEach;originAfterMinutes[row.from]+=row.people*row.afterMinutesEach;}
 const afterTotal=afterMinutes.reduce((a,b)=>a+b,0),saved=beforeTotal-afterTotal;
 const carGroups=transitions.filter(t=>t.to===1&&t.people>EPS);
 const minCarMinutes=carGroups.length?Math.min(...carGroups.map(t=>t.afterMinutesEach)):null;
 const threshold=afterCounts[1]>EPS?saved/afterCounts[1]:null;
 return {valid:true,people,beforeTotal,afterTotal,saved,change:afterTotal-beforeTotal,beforeMean:beforeTotal/people,afterMean:afterTotal/people,meanChange:(afterTotal-beforeTotal)/people,afterCounts,afterMinutes,originAfterMinutes,transitions,switchers:transitions.filter(r=>r.from!==r.to).reduce((a,r)=>a+r.people,0),additionalCarMinutesToBreakEven:threshold,minimumPostCarMinutes:minCarMinutes,uniformCarBreakEvenFeasible:threshold===null?null:threshold>=-minCarMinutes-EPS};
}

export function journeyFrontier(s,steps=40){
 const result=calculateJourneys(s);if(!result.valid)return [];
 const k=SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===3);
 const otherSwitches=SWITCH_PAIRS.reduce((sum,[i],index)=>sum+(i===1&&index!==k?s.switches[index]:0),0);
 const available=Math.max(0,s.counts[1]-otherSwitches),rows=[];
 for(let n=0;n<=steps;n++){
  const state=clone(s);state.switches[k]=available*n/steps;
  const r=calculateJourneys(state);
  if(!r.valid){rows.push({valid:false,carToSubway:state.switches[k],remainingCarPeople:null,savedPersonMinutes:null,additionalCarMinutes:null,uniformCarBreakEvenFeasible:null,unavailableReason:r.errors.join(' ')});continue;}
  rows.push({valid:true,carToSubway:state.switches[k],remainingCarPeople:r.afterCounts[1],savedPersonMinutes:r.saved,additionalCarMinutes:r.additionalCarMinutesToBreakEven,uniformCarBreakEvenFeasible:r.uniformCarBreakEvenFeasible});
 }
 return rows;
}

export function encodeJourneyState(s){
 if(validateJourneyState(s).length)throw new Error('Cannot share an invalid scenario.');
 return JSON.stringify([VERSION,s.counts,s.before,s.stay,s.switches,s.switchTimes]);
}
export function decodeJourneyState(raw){
 try{const v=JSON.parse(raw);if(!Array.isArray(v)||v.length!==6)return null;const s={version:v[0],counts:v[1],before:v[2],stay:v[3],switches:v[4],switchTimes:v[5]};return validateJourneyState(s).length?null:s;}catch{return null;}
}
const numberInput=(kind,index,value,label)=>`<input type="number" min="0" max="${kind==='counts'||kind==='switches'?MAX_COUNT:MAX_TIME}" step="any" inputmode="decimal" data-nt-kind="${kind}" data-nt-index="${index}" value="${value}" aria-label="${esc(label)}">`;
const carSubway=SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===3);
const carBike=SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===0);

function frontierChart(state,result){
 const allRows=journeyFrontier(state),rows=allRows.filter(r=>r.valid&&r.additionalCarMinutes!==null);
 const omitted=allRows.some(r=>!r.valid);
 if(omitted&&rows.length<2)return '<p class="nt-error">The current scenario is valid, but the frontier needs positive complete times for car stayers and car → subway switchers, even if either group is currently empty. Enter those times above to calculate alternative switch counts.</p>';
 if(!rows.length)return '<p>No car travelers remain in these alternatives, so a per-car-traveler delay threshold is undefined.</p>';
 const W=850,H=320,L=73,R=24,T=24,B=55;
 const maxX=Math.max(1,...rows.map(r=>r.carToSubway));
 // Extreme thresholds near zero remaining car travelers are clipped explicitly.
 const cap=60,minY=Math.max(-cap,Math.min(-1,...rows.map(r=>r.additionalCarMinutes))),maxY=Math.min(cap,Math.max(1,...rows.map(r=>r.additionalCarMinutes)));
 const x=v=>L+(W-L-R)*v/maxX,y=v=>T+(H-T-B)*(maxY-v)/(maxY-minY);
 let marks='';
 for(let i=0;i<5;i++){
  const v=minY+(maxY-minY)*i/4,xx=maxX*i/4;
  marks+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#dbe3d6"/><text x="${L-9}" y="${y(v)+4}" text-anchor="end">${fmt(v,1)}</text><text x="${x(xx)}" y="${H-B+22}" text-anchor="middle">${fmt(xx,0)}</text>`;
 }
 marks+=`<line x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}" stroke="#657464" stroke-dasharray="4 4"/>`;
 const clamped=v=>Math.max(minY,Math.min(maxY,v));
 const paths={feasible:'',infeasible:''};
 for(let i=1;i<rows.length;i++){
  const a=rows[i-1],b=rows[i],key=a.uniformCarBreakEvenFeasible&&b.uniformCarBreakEvenFeasible?'feasible':'infeasible';
  paths[key]+=`M${x(a.carToSubway)},${y(clamped(a.additionalCarMinutes))}L${x(b.carToSubway)},${y(clamped(b.additionalCarMinutes))} `;
 }
 const current=result.additionalCarMinutesToBreakEven;
 if(current!==null)marks+=`<circle cx="${x(state.switches[carSubway])}" cy="${y(clamped(current))}" r="5" fill="#744f91" stroke="white" stroke-width="2"><title>Current scenario: ${fmt(state.switches[carSubway],1)} switch to subway; ${fmt(current,2)} minutes additional car time reaches break-even</title></circle>`;
 const clipped=rows.some(r=>r.additionalCarMinutes<minY||r.additionalCarMinutes>maxY);
 return `<svg class="nt-frontier" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scenario break-even frontier: car-to-subway switchers versus additional minutes per remaining car traveler"><title>Break-even frontier, illustrative scenarios</title><path d="${paths.feasible}" fill="none" stroke="#2a6946" stroke-width="3"/><path d="${paths.infeasible}" fill="none" stroke="#a96238" stroke-width="3" stroke-dasharray="6 4"/>${marks}<text x="${(L+W-R)/2}" y="${H-8}" text-anchor="middle">Baseline car travelers who switch to subway</text><text transform="translate(16 ${T+(H-T-B)/2}) rotate(-90)" text-anchor="middle">Extra car minutes to break even</text></svg><p class="small">Below the solid green line, total journey minutes fall; above it, they rise. Zero is the entered post-car time. A negative threshold requires faster car journeys before the scenario breaks even. Dashed brown segments include alternatives requiring negative journey time in a car group; these cannot break even through a uniform car-time reduction. ${clipped?'Plot clipped at ±60 minutes; exact values and feasibility are in the downloadable frontier CSV. ':''}The purple dot is your current scenario. All other switch counts and journey times stay fixed. This is arithmetic sensitivity, not a forecast of how drivers respond.</p>`;
}

function csv(rows){return rows.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');}
function download(text,name,type){const u=URL.createObjectURL(new Blob([type==='application/json'?'':'\ufeff',text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);}

export function renderNetworkTime(root){
 const requested=new URL(location.href).searchParams.get('journey');
 let state=requested?decodeJourneyState(requested):null;
 const failedLink=!!requested&&!state;state??=journeyPreset();
 root.classList.add('network-time');
 root.innerHTML=`<article class="research-card nt-intro"><div class="minilabel">Scenario lab · complete journeys</div><h3>Count people once. Include every minute.</h3><p>A lane conversion can slow remaining drivers and still reduce total travel time if other travelers save more. A switch from car to subway belongs in that accounting. Explore the conditions here; <b>every starting number is invented for illustration</b>.</p><p>This is a fixed cohort: the same people make one comparable journey before and after. Each switch subtracts a person from their old mode and adds them to their new one. Enter complete elapsed minutes, including access, waiting, transfers, parking and egress.</p><div class="nt-banner"><b>Not a finding about a NYC project.</b> The acquired records do not yet measure comparable, complete journeys across all modes. Segment times from PPW or Third Avenue must not be pasted in as door-to-door times.</div>${failedLink?'<p class="nt-error" role="status">The saved scenario could not be read. The illustrative example is shown instead.</p>':''}<div class="research-controls"><label for="nt-preset">Starting point<select id="nt-preset"><option value="example">Illustration A · slower subway switch</option><option value="faster-subway">Illustration B · faster subway switch</option><option value="unchanged">No change · arithmetic check</option></select></label><button type="button" class="btn" id="nt-reset">Reset inputs</button></div><div id="nt-form"></div><div id="nt-results"></div><details class="nt-methods"><summary>How the accounting works, and what it leaves unanswered</summary><ol><li><b>One person, one journey.</b> Car counts include passengers and drivers. Bus and subway counts are travelers, not vehicles or station entries. Pick one mutually exclusive main mode for a multimodal journey, but include all its legs in the time.</li><li><b>A fixed cohort and trip mix.</b> Baseline travelers by mode sum to the same total after. Origin, destination, purpose and departure-window composition must remain comparable; use baseline weights when analyzing real observations. Staying travelers and each switching group can have different post times. Baseline means refer to the entire original group, including its later switchers.</li><li><b>Person-minutes = people × complete minutes.</b> Subtract total after minutes from total before minutes. Divide by the fixed traveler total to get mean minutes saved. A negative average change means faster journeys. This calculator does not convert vehicle-minutes into passenger-minutes.</li><li><b>Throughput is a separate observation.</b> A cohort count divided by an arbitrary time window is not street or network throughput. Measure unique people crossing a defined boundary per hour, with aligned directions, times and alternate routes. A traveler who uses subway instead of the street still belongs in network accounting.</li><li><b>New and forgone journeys are separate outcomes.</b> Added journeys can raise total minutes while improving access; missing journeys can lower total minutes while making people worse off. Do not call either a time benefit. Report trip counts, destinations reachable and unserved demand beside standardized journey time.</li><li><b>Time savings are not the whole welfare calculation.</b> Safety, comfort, reliability, accessibility, cost, emissions and distributional effects are not valued here. A hypothetical time saving is not causal evidence for a redesign.</li></ol><p class="small">Formula: before = Σᵢ Nᵢtᵢ; after = ΣᵢΣⱼ nᵢⱼtᵢⱼ; Σⱼ nᵢⱼ = Nᵢ. Minutes saved = before − after. Remaining car travelers × additional car minutes equals the total saving at break-even.</p><a class="btn" href="research/network-time/methods.txt" download>Accounting method · TXT</a></details></article>`;
 const form=root.querySelector('#nt-form'),out=root.querySelector('#nt-results');
 if(root._streetflowShareListener)window.removeEventListener('streetflow:share',root._streetflowShareListener);
 root._streetflowShareListener=event=>{
  if(!root.isConnected||!root.getClientRects().length)return;
  if(!calculateJourneys(state).valid){event.preventDefault();return;}
  const u=new URL(location.href);u.searchParams.set('journey',encodeJourneyState(state));u.searchParams.set('workbench','time');
  history.replaceState(history.state,'',u);
 };
 window.addEventListener('streetflow:share',root._streetflowShareListener);
 function switchRow(k){const [i,j]=SWITCH_PAIRS[k];return `<tr><th scope="row">${JOURNEY_LABELS[i]} → ${JOURNEY_LABELS[j]}</th><td>${numberInput('switches',k,state.switches[k],`${JOURNEY_LABELS[i]} to ${JOURNEY_LABELS[j]} travelers`)}</td><td>${numberInput('switchTimes',k,state.switchTimes[k],`${JOURNEY_LABELS[i]} to ${JOURNEY_LABELS[j]} complete after minutes`)}</td></tr>`;}
 function fill(){
  form.innerHTML=`<h4>1. Baseline groups and journeys that keep the same mode</h4><p class="small">Counts are people in your chosen cohort, not vehicles. Fractional counts are allowed for weighted survey estimates. Zero travelers removes a group.</p><div class="nt-table-scroll"><table class="nt-input-table"><thead><tr><th scope="col">Main journey mode</th><th scope="col">Before travelers</th><th scope="col">Before complete min</th><th scope="col">After complete min · stayers</th></tr></thead><tbody>${JOURNEY_MODES.map((_,i)=>`<tr><th scope="row">${JOURNEY_LABELS[i]}</th><td>${numberInput('counts',i,state.counts[i],`${JOURNEY_LABELS[i]} baseline travelers`)}</td><td>${numberInput('before',i,state.before[i],`${JOURNEY_LABELS[i]} baseline complete minutes`)}</td><td>${numberInput('stay',i,state.stay[i],`${JOURNEY_LABELS[i]} staying complete after minutes`)}</td></tr>`).join('')}</tbody></table></div><h4>2. Travelers who switch mode</h4><p class="small">These travelers come out of their original group automatically. Their entered after time can differ from people already using the destination mode.</p><div class="nt-table-scroll"><table class="nt-input-table nt-switch-table"><thead><tr><th scope="col">Before → after mode</th><th scope="col">Travelers switching</th><th scope="col">Their complete after min</th></tr></thead><tbody>${[carSubway,carBike].map(switchRow).join('')}</tbody></table></div><details><summary>All other mode switches</summary><div class="nt-table-scroll"><table class="nt-input-table nt-switch-table"><thead><tr><th scope="col">Before → after mode</th><th scope="col">Travelers switching</th><th scope="col">Their complete after min</th></tr></thead><tbody>${SWITCH_PAIRS.map((_,k)=>k).filter(k=>k!==carSubway&&k!==carBike).map(switchRow).join('')}</tbody></table></div></details>`;
 }
 function draw(){
  const r=calculateJourneys(state);
  if(!r.valid){out.innerHTML=`<div class="nt-error" role="status"><b>Fix these inputs to calculate:</b><ul>${r.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;return;}
  const threshold=r.additionalCarMinutesToBreakEven;
  const thresholdText=threshold===null?'No remaining car travelers':!r.uniformCarBreakEvenFeasible?'Cannot break even by uniformly reducing car time':threshold>=0?`${fmt(threshold,2)} extra min / car traveler`:`${fmt(-threshold,2)} min / car traveler must be saved`;
  const gain=r.saved>=0;
  const status=Math.abs(r.saved)<EPS?'No change in total minutes':gain?'Fewer minutes for this fixed cohort':'More minutes for this fixed cohort';
  out.innerHTML=`<h4>3. Scenario result</h4><div class="nt-metrics" aria-live="polite"><div><span>Total journey minutes ${gain?'saved':'added'}</span><b>${fmt(Math.abs(r.saved),0)}</b><small>${status}</small></div><div><span>Mean complete journey change</span><b>${sign(r.meanChange,2)} min</b><small>${fmt(r.beforeMean,2)} → ${fmt(r.afterMean,2)} minutes</small></div><div><span>People counted before and after</span><b>${fmt(r.people,1)}</b><small>${fmt(r.switchers,1)} switch main mode · fixed cohort</small></div></div><div class="nt-totals"><span>Before: <b>${fmt(r.beforeTotal,0)} person-min</b></span><span>After: <b>${fmt(r.afterTotal,0)} person-min</b></span><span>Person throughput: <b>not estimated</b></span></div><div class="nt-break-even"><span>Break-even from your current assumptions</span><strong>${thresholdText}</strong><p>${threshold===null?'No car traveler remains to absorb an additional delay. Compare other modes directly.':!r.uniformCarBreakEvenFeasible?'The algebraic threshold would require at least one car group to have a negative journey time. Other mode changes are needed.':'Apply this change to every post-scenario car traveler, including passengers. All other counts and times stay fixed. This is extra time relative to your entered after-car times.'}</p></div><h4>Where the minutes go</h4>${table(['Original group','People in this group','Before person-min','After person-min for this same group','Change for this group'],JOURNEY_MODES.map((_,i)=>[JOURNEY_LABELS[i],fmt(state.counts[i],1),fmt(state.counts[i]*state.before[i],0),fmt(r.originAfterMinutes[i],0),sign(r.originAfterMinutes[i]-state.counts[i]*state.before[i],0)]))}<p class="small">Time changes follow each original group across all of its switches. The same people appear in the before and after totals on each row.</p><details><summary>See mode totals and the complete traveler matrix</summary>${table(['Main mode','Before travelers','After travelers'],JOURNEY_MODES.map((_,i)=>[JOURNEY_LABELS[i],fmt(state.counts[i],1),fmt(r.afterCounts[i],1)]))}${table(['Before mode ↓ / After mode →',...JOURNEY_LABELS],JOURNEY_MODES.map((_,i)=>[JOURNEY_LABELS[i],...JOURNEY_MODES.map((_,j)=>fmt(r.transitions.find(t=>t.from===i&&t.to===j).people,1))]))}</details><h4>How much additional car delay can the scenario absorb?</h4>${frontierChart(state,r)}<div class="research-downloads"><button class="btn" type="button" data-nt-action="json">Scenario + results · JSON</button><button class="btn" type="button" data-nt-action="csv">Traveler accounting · CSV</button><button class="btn" type="button" data-nt-action="frontier">Break-even frontier · CSV</button><button class="btn" type="button" data-nt-action="share">Create scenario link</button></div><div id="nt-share" role="status"></div>`;
 }
 form.addEventListener('input',event=>{const el=event.target;if(!el.matches('[data-nt-kind]'))return;state[el.dataset.ntKind][Number(el.dataset.ntIndex)]=el.value.trim()===''?NaN:Number(el.value);draw();});
 root.querySelector('#nt-reset').addEventListener('click',()=>{state=journeyPreset(root.querySelector('#nt-preset').value);fill();draw();});
 root.querySelector('#nt-preset').addEventListener('change',()=>{state=journeyPreset(root.querySelector('#nt-preset').value);fill();draw();});
 out.addEventListener('click',event=>{
  const button=event.target.closest('[data-nt-action]');if(!button)return;
  const r=calculateJourneys(state);if(!r.valid)return;
  const action=button.dataset.ntAction;
  if(action==='json')download(JSON.stringify({schema:'nyc-street-flow-journey-scenario-v1',evidence_status:'User-entered hypothetical scenario; not observed or causal',units:'people and complete elapsed journey minutes',modes:JOURNEY_MODES,inputs:state,results:r},null,2),'journey-scenario.json','application/json');
  if(action==='csv')download(csv([['evidence_status','Hypothetical scenario; not observed or causal'],['before_mode','after_mode','travelers','after_complete_minutes_each','after_person_minutes'],...r.transitions.map(t=>[JOURNEY_MODES[t.from],JOURNEY_MODES[t.to],t.people,t.afterMinutesEach,t.people*t.afterMinutesEach]),[],['baseline_mode','baseline_travelers','baseline_complete_minutes_each','baseline_person_minutes'],...JOURNEY_MODES.map((m,i)=>[m,state.counts[i],state.before[i],state.counts[i]*state.before[i]]),[],['fixed_cohort_people',r.people],['before_person_minutes',r.beforeTotal],['after_person_minutes',r.afterTotal],['person_minutes_saved',r.saved],['throughput','Not estimated']]),'journey-accounting.csv','text/csv');
  if(action==='frontier')download(csv([['evidence_status','Hypothetical scenario; not observed or causal'],['car_to_subway_travelers','remaining_car_travelers','person_minutes_saved_before_extra_car_delay','extra_car_minutes_to_break_even','uniform_car_time_change_keeps_every_journey_nonnegative','unavailable_reason'],...journeyFrontier(state,100).map(t=>[t.carToSubway,t.remainingCarPeople,t.savedPersonMinutes,t.additionalCarMinutes??(t.valid?'undefined: no remaining car travelers':'unavailable'),t.uniformCarBreakEvenFeasible??'undefined',t.unavailableReason||''])]),'journey-break-even-frontier.csv','text/csv');
  if(action==='share'){
   const u=new URL(location.href);u.searchParams.set('journey',encodeJourneyState(state));u.searchParams.set('workbench','time');u.hash=root.id||'journey-lab';
   history.replaceState(history.state,'',u);
   root.querySelector('#nt-share').innerHTML=`<p class="small">This link stores only the hypothetical numbers you entered. It does not upload personal travel records.</p><label class="nt-share-label">Scenario link<input type="text" readonly value="${esc(u.href)}" aria-label="Shareable journey scenario link"></label><a class="btn" href="${esc(u.href)}">Open this scenario</a>`;
   const input=root.querySelector('#nt-share input');input.focus();input.select();
  }
 });
 fill();draw();
}
