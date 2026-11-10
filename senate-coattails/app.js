'use strict';
const measureNotes = {
  standout: {
    title: 'Standouts versus other returning senators',
    description: '72 of 423 incumbents beat their party benchmark by at least 15 points in their previous Senate election.',
    reading: 'The senators themselves ran 7.4 points further ahead of benchmark. Their House teammates averaged 0.7 points lower, with an interval that includes zero. The governor estimate allows room for a meaningful gain or loss.'
  },
  continuous: {
    title: 'For every 10 points of prior overperformance',
    description: 'Uses all 423 reelections and measures the relationship across the full range of prior results.',
    reading: 'An extra 10 points last time was associated with 4.1 extra points for the senator next time. House and governor estimates were each within a third of a point of zero. This does not identify a causal spillover.'
  },
  upper: {
    title: 'The strongest 10% versus the middle 80%',
    description: '43 incumbents previously beat benchmark by at least 18.88 points. Both tails enter the same model. The governor sample contains 23 upper-tail races.',
    reading: 'The personal advantage persists. The governor estimate is sensitive to the threshold and has a wide interval. These results cannot establish that especially strong senators cost their governors votes.'
  },
  lower: {
    title: 'The weakest 10% versus the middle 80%',
    description: '43 returning incumbents previously fell at least 3.03 points below benchmark. The governor sample contains 23 lower-tail races.',
    reading: 'These senators underperformed in their own reelections. The House and governor intervals each include zero. Because these are all previous winners, even this lower tail excludes many of the weakest nominees.'
  },
  endorsement: {
    title: 'A stronger Senate matchup by newspaper endorsements',
    description: 'Change per one standardized point of Senate endorsement advantage for Democrats relative to Republicans. This secondary sample starts in 1952 and also includes first-time nominees.',
    reading: 'The rating predicts a larger Democratic Senate vote share. Estimated differences for the House and governor are small relative to their uncertainty. The score can reflect the strength of either nominee.'
  }
};
const officeNames = ['Senate', 'House', 'Governor'];
const ns = 'http://www.w3.org/2000/svg';
const signed = (n, places=1) => n === 0 ? Number(0).toFixed(places) : (n>0?'+':'−')+Math.abs(n).toFixed(places);
const num = n => Number(n).toLocaleString('en-US');
const signedTick = n => n ? (n>0?'+':'−')+Math.abs(n) : '0';
const pos = n => (n+12)/24*100;
const select = document.querySelector('#measure');
let estimates, csvURL;
function getMeasure() {
  const value = new URL(location.href).searchParams.get('measure');
  return Object.hasOwn(measureNotes,value) ? value : 'standout';
}
function chartView(key) {
  if (!estimates) return;
  const data=estimates[key], notes=measureNotes[key];
  select.value=key;
  document.querySelector('#comparison-title').textContent=notes.title;
  document.querySelector('#comparison-desc').textContent=notes.description;
  document.querySelector('#reading').textContent=notes.reading;
  const ticks=[-10,-5,0,5,10];
  const guides=ticks.map(t=>'<i aria-hidden="true" class="gridline '+(t===0?'zero':'')+'" style="left:'+pos(t)+'%"></i>').join('');
  let grid='<div class="forest-grid">';
  data.forEach(([val,lo,hi],i)=>{
    const label=officeNames[i]+': '+signed(val)+' percentage points, 95 percent interval '+signed(lo)+' to '+signed(hi)+'.';
    grid+='<div class="plot-label">'+officeNames[i]+'</div><div class="track '+(i===0?'senate':'')+'" role="img" aria-label="'+label+'" title="'+label+'">'+guides+
      '<i class="range" style="left:'+pos(lo)+'%;width:'+(pos(hi)-pos(lo))+'%"></i><b class="estimate-dot" style="left:'+pos(val)+'%"></b></div>'+
      '<div class="plot-value '+(i===0?'senate':'')+'">'+signed(val)+'</div>';
  });
  grid+='<div></div><div class="axis">'+ticks.map(t=>'<span class="tick" style="left:'+pos(t)+'%">'+signedTick(t)+'</span>').join('')+'</div><div></div></div>';
  document.querySelector('#forest').innerHTML=grid;
  const rows=data.map(([v,lo,hi,n,states,y0,y1],i)=>'<tr><th scope="row">'+officeNames[i]+'</th><td>'+signed(v,2)+'</td><td>'+signed(lo,2)+' to '+signed(hi,2)+'</td><td>'+num(n)+'</td><td>'+states+'</td><td>'+y0+'–'+y1+'</td></tr>').join('');
  document.querySelector('#exact-body').innerHTML='<div class="table-scroll"><table><thead><tr><th>Office</th><th>Estimate</th><th>95% interval</th><th>Races</th><th>State elections</th><th>Years</th></tr></thead><tbody>'+rows+'</tbody></table></div><a id="download-estimates">Download these estimates (CSV) ↓</a>';
  const csv=['measure,office,estimate_pp,lower95_pp,upper95_pp,races,state_elections,start_year,end_year',...data.map((r,i)=>[key,officeNames[i],...r].join(','))].join('\r\n');
  if(csvURL) URL.revokeObjectURL(csvURL);
  csvURL=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.querySelector('#download-estimates');a.href=csvURL;a.download='senate-coattails-'+key+'.csv';
}
select.addEventListener('change',()=>{
  const url=new URL(location.href);
  if(select.value==='standout') url.searchParams.delete('measure'); else url.searchParams.set('measure',select.value);
  history.replaceState(null,'',url);chartView(select.value);
});
window.addEventListener('popstate',()=>chartView(getMeasure()));
document.querySelector('#share').addEventListener('click',async()=>{
  const u=new URL(location.href);u.hash='estimates';
  const button=document.querySelector('#share'), status=document.querySelector('#share-status');
  try{
    await navigator.clipboard.writeText(u.href);
    button.textContent='Link copied ✓';status.textContent='View link copied.';
    setTimeout(()=>{button.innerHTML='Copy view link <span aria-hidden="true">↗</span>'},2000);
  }catch{
    const text=document.createElement('input');text.setAttribute('aria-label','Share this link');text.readOnly=true;text.value=u.href;button.after(text);text.select();status.textContent='Select and copy the displayed link.';
    text.addEventListener('blur',()=>text.remove(),{once:true});
  }
});
function svgElement(tag,attrs,text) {
  const el=document.createElementNS(ns,tag);
  for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
  if(text!==undefined)el.textContent=text;
  return el;
}
function sampleChart(races) {
  const host=document.querySelector('#sample-chart');
  const svg=svgElement('svg',{viewBox:'0 0 465 174',role:'img',tabindex:'0','aria-label':'423 Senate campaigns by election year and prior performance. The horizontal threshold is plus 15 points. Use left and right arrow keys to explore elections.'});
  svg.append(svgElement('title',{},'Previous performance of returning senators, 1982–2022'));
  const l=30,r=451,t=12,b=144;
  const X=y=>l+4+(y-1982)/40*(r-l-8),Y=n=>b-(n+16)/56*(b-t);
  for(const v of [-15,0,15,30]){
    svg.append(svgElement('line',{x1:l,y1:Y(v),x2:r,y2:Y(v),stroke:v===15?'#a9bf7b':'#4a6559','stroke-width':v===15?1.1:.8,'stroke-dasharray':v===15?'4 4':'0'}));
    svg.append(svgElement('text',{x:l-6,y:Y(v)+3,'text-anchor':'end'},signedTick(v)));
  }
  [1982,1992,2002,2012,2022].forEach(y=>svg.append(svgElement('text',{x:X(y),y:163,'text-anchor':'middle'},String(y))));
  const sorted=[...races].sort((a,b)=>a.year-b.year||a.prior-b.prior||a.state.localeCompare(b.state));
  // Resolve near-overlaps within a year by nudging points horizontally. The score always sets height.
  const occupied=new Map(),dots=[];
  sorted.forEach((row,i)=>{
    const yearPoints=occupied.get(row.year)||[];const py=Y(row.prior);
    const dx=[0,-3,3,-6,6,-8,8].find(offset=>yearPoints.every(p=>Math.abs(p.y-py)>4.6||Math.abs(p.x-offset)>2.9))??(i%2?8:-8);
    yearPoints.push({x:dx,y:py});occupied.set(row.year,yearPoints);
    const cx=X(row.year)+dx;
    const dot=svgElement('circle',{cx,cy:py,r:2.4,fill:row.prior>=15?'#daf28d':'#9bb6a7',opacity:row.prior>=15?1:.83,'data-i':i});
    dots.push({row,cx,py,dot});svg.append(dot);
  });
  const marker=svgElement('circle',{r:5,fill:'none',stroke:'#fff','stroke-width':1,'pointer-events':'none',display:'none'});svg.append(marker);
  const tip=document.createElement('div');tip.className='chart-tip';tip.hidden=true;host.replaceChildren(svg,tip);
  let active=0;
  function show(i){
    active=(i+dots.length)%dots.length;
    const {row,cx,py}=dots[active];tip.textContent=row.name+' · '+row.state+' '+row.year+' · '+signed(row.prior)+' pts';
    tip.hidden=false;tip.style.left=Math.min(Math.max(cx/465*100-18,2),54)+'%';tip.style.top=Math.min(py/174*100+6,73)+'%';
    marker.setAttribute('cx',cx);marker.setAttribute('cy',py);marker.removeAttribute('display');
  }
  function hide(){tip.hidden=true;marker.setAttribute('display','none')}
  svg.addEventListener('pointerover',e=>{if(e.target.hasAttribute('data-i'))show(Number(e.target.dataset.i));else if(e.pointerType==='mouse')hide()});
  svg.addEventListener('pointerleave',hide);svg.addEventListener('blur',hide);
  svg.addEventListener('focus',()=>show(active));
  svg.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(active+(e.key==='ArrowRight'?1:-1));svg.setAttribute('aria-label',tip.textContent+'. Use arrow keys to explore.')}if(e.key==='Escape')hide()});
}
async function readJSON(path){const res=await fetch(path);if(!res.ok)throw new Error('data unavailable');return res.json()}
readJSON('data/estimates.json').then(data=>{estimates=data;chartView(getMeasure())}).catch(()=>{document.querySelector('#forest').textContent='The chart could not load. Reload the page or download the study.'});
readJSON('data/elections.json').then(data=>sampleChart(data.races)).catch(()=>{document.querySelector('#sample-chart').textContent='The sample chart could not load. Reload the page to try again.'});

let historyData;
function renderHistory(){
 const k=document.querySelector('#history-model').value, labels=['Current House result','Previous House result · two years earlier','Current House result · adjusting for previous result'];
 const rows=historyData[k].map(([v,l,h],i)=>'<tr><th scope="row">'+labels[i]+'</th><td>'+signed(v,2)+'</td><td>'+signed(l,2)+' to '+signed(h,2)+'</td></tr>').join('');
 document.querySelector('#history-results').innerHTML='<div class="table-scroll"><table class="history-table"><thead><tr><th>Outcome</th><th>Association (pp)</th><th>95% interval</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 document.querySelector('#history-reading').textContent=k==='state'?'After accounting for persistent state differences, all three associations are small and uncertain. Adding the preceding House result does not reveal a positive relationship. This does not establish that a particular senator has no coattails.':'With only national year adjustments, higher prior Senate strength is associated with better House results—but a larger association is already present two years earlier. Adjusting for that previous House result brings the current association close to zero. The earlier advantage could reflect party strength or lasting candidate influence.';
}
readJSON('data/history.json').then(data=>{historyData=data;renderHistory();document.querySelector('#history-model').addEventListener('change',renderHistory)}).catch(()=>{document.querySelector('#history-results').textContent='The history checks could not load. Download the complete study for the results.'});
