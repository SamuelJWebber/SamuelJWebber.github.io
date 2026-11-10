(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(v,n=2)=>v==null?'—':Number(v).toFixed(n),signed=v=>v==null?'—':(v>0?'+':'')+f(v);
let data; const familySelect=$('benchmark-family'),viewSelect=$('benchmark-view');
function render(){
 const family=data.families.find(x=>x.id===familySelect.value)||data.families[0];
 const view=family.views.find(x=>x.id===viewSelect.value)||family.views[0];
 $('benchmark-description').textContent=family.description;
 $('benchmark-title').textContent=view.title;
 $('benchmark-meta').innerHTML=[view.sample,view.period,view.metricLabel||'Lower error is better'].filter(Boolean).map(s=>'<span>'+esc(s)+'</span>').join('');
 const precision=view.precision??2; const rows=view.models,max=Math.max(...rows.map(x=>x.error))*1.1;
 $('benchmark-bars').innerHTML=rows.map(m=>'<div class="error-row '+(m.baseline?'baseline':'')+'"><span>'+esc(m.label)+'</span><div class="error-track" aria-hidden="true"><div class="error-fill" style="width:'+m.error/max*100+'%"></div></div><span class="error-val">'+f(m.error,precision)+'</span></div>').join('');
 $('benchmark-bars').setAttribute('aria-label',view.errorLabel+' for each model. See exact results below.');
 $('benchmark-unit').textContent=view.errorLabel;
 $('benchmark-reading').textContent=view.reading;
 $('benchmark-caveat').textContent=family.caveat||view.caveat||'';
 $('benchmark-caveat').hidden=!$('benchmark-caveat').textContent;
 $('benchmark-method').textContent=view.method||family.method;
 $('benchmark-table').innerHTML='<thead><tr><th>Model</th><th>'+esc(view.errorLabel)+'</th><th>'+(view.secondaryLabel||'RMSE (points)')+'</th><th>Improvement vs baseline</th><th>95% interval</th></tr></thead><tbody>'+rows.map(m=>'<tr><th scope="row">'+esc(m.label)+'</th><td>'+f(m.error,precision)+'</td><td>'+f(m.secondary,precision)+'</td><td>'+(m.gain==null?'—':(m.gain>0?'+':'')+f(m.gain,precision))+'</td><td>'+(m.ci?f(m.ci[0],precision)+' to '+f(m.ci[1],precision):'—')+'</td></tr>').join('')+'</tbody>';
 const links=family.sources||[];$('benchmark-sources').innerHTML=links.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.name)+' ↗</a>').join(' · ');
 const predictions=view.predictions||[];$('forecast-details').hidden=!predictions.length;
 if(predictions.length)drawPredictions(predictions,view.predictionModel);
 const url=new URL(location.href);url.searchParams.set('benchmark',family.id);url.searchParams.set('validation',view.id);history.replaceState(null,'',url);
}
function drawPredictions(rows,model){
 $('forecast-model').textContent=model||'Candidate model';
 const w=470,h=350,left=45,right=18,top=15,bottom=40,x=v=>left+v*(w-left-right),y=v=>h-bottom-v*(h-top-bottom);
 let svg='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Actual versus predicted Democratic two-party vote share. Dashed diagonal means perfect prediction.">';
 [0,.25,.5,.75,1].forEach(t=>{svg+='<path d="M'+x(t)+' '+top+'V'+(h-bottom)+'M'+left+' '+y(t)+'H'+(w-right)+'" stroke="#e0e5d9" fill="none"/><text x="'+x(t)+'" y="'+(h-22)+'" text-anchor="middle">'+(t*100)+'</text><text x="'+(left-8)+'" y="'+(y(t)+4)+'" text-anchor="end">'+t*100+'</text>'});
 svg+='<path d="M'+x(0)+' '+y(0)+'L'+x(1)+' '+y(1)+'" stroke="#82917c" stroke-dasharray="5 5"/>';
 rows.forEach(r=>{svg+='<circle cx="'+x(r.actual)+'" cy="'+y(r.prediction)+'" r="4"><title>'+esc(r.state+' '+r.year+': '+r.dem+' vs '+r.rep+'; actual '+f(100*r.actual,1)+'%, predicted '+f(100*r.prediction,1)+'%')+'</title></circle>'});
 svg+='<text x="'+(w/2)+'" y="'+(h-2)+'" text-anchor="middle">Actual Democratic share (%)</text><text transform="translate(12 '+h/2+') rotate(-90)" text-anchor="middle">Predicted share (%)</text></svg>';$('forecast-scatter').innerHTML=svg;
 $('forecast-table').innerHTML='<thead><tr><th>Race</th><th>Nominees (D / R)</th><th>Actual</th><th>Baseline</th><th>Model</th></tr></thead><tbody>'+rows.slice().sort((a,b)=>b.year-a.year||a.state.localeCompare(b.state)).map(r=>'<tr><td>'+esc(r.state)+' '+r.year+'</td><td>'+esc(r.dem)+' / '+esc(r.rep)+'</td><td>'+f(r.actual*100,1)+'</td><td>'+f(r.baseline*100,1)+'</td><td>'+f(r.prediction*100,1)+'</td></tr>').join('')+'</tbody>';
}
function changeFamily(viewId){const family=data.families.find(x=>x.id===familySelect.value);viewSelect.innerHTML=family.views.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join('');if(family.views.some(x=>x.id===viewId))viewSelect.value=viewId;render();}
// 2026 out-of-sample view (added 2026-11-09, studies/senate-2026). Optional: the page works without it.
const extra=fetch('data/senate-2026.json').then(r=>r.ok?r.json():null).catch(()=>null);
function addExtra(d,x){if(!x||!x.view)return d;const fam=d.families.find(f=>f.id===x.family);if(!fam||fam.views.some(v=>v.id===x.view.id))return d;const i=fam.views.findIndex(v=>v.id===x.insert_after);fam.views.splice(i<0?fam.views.length:i+1,0,x.view);const c=d.coverage.find(r=>r.measure==='Prior electoral performance');if(c&&x.coverage_note)c.detail+=' '+x.coverage_note;return d}
fetch('data/prediction.json').then(r=>{if(!r.ok)throw Error('Could not load results');return r.json()}).then(d=>extra.then(x=>addExtra(d,x))).then(d=>{data=d;familySelect.innerHTML=d.families.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join('');const q=new URL(location.href).searchParams;if(d.families.some(x=>x.id===q.get('benchmark')))familySelect.value=q.get('benchmark');changeFamily(q.get('validation'));
 $('coverage-body').innerHTML=d.coverage.map(r=>'<tr><th scope="row">'+esc(r.measure)+'</th><td>'+esc(r.status)+'</td><td>'+esc(r.detail)+(r.url?' <a href="'+esc(r.url)+'" target="_blank" rel="noopener">Source ↗</a>':'')+'</td></tr>').join('');
 familySelect.addEventListener('change',()=>changeFamily());viewSelect.addEventListener('change',render);
}).catch(e=>{$('benchmark-reading').textContent='The comparison could not load. The downloadable results remain available.';console.error(e)});
})();
