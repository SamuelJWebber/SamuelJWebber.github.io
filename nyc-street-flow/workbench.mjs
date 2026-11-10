const tabs = [
  {id:'outcomes',label:'01 · Outcome scorecards',module:'project-scorecards.mjs',fn:'renderProjectScorecards',mount:'project-scorecards'},
  {id:'map',label:'02 · Network map',module:'network-map.mjs',fn:'renderNetworkMap',mount:'network-map'},
  {id:'time',label:'03 · People × minutes',module:'network-time.mjs',fn:'renderNetworkTime',mount:'network-time'},
  {id:'directions',label:'04 · Direction & hour',module:'directional-evidence.mjs',fn:'renderDirectionalEvidence',mount:'directional-evidence'},
  {id:'estimates',label:'05 · Sensitivity lab',module:'estimate-lab.mjs',fn:'renderEstimateLab',mount:'estimate-lab'},
  {id:'design',label:'06 · Causal design',module:'causal-design.mjs',fn:'renderCausalDesign',mount:'causal-design'},
  {id:'world',label:'07 · Other cities',module:'global-evidence.mjs',fn:'renderGlobalEvidence',mount:'global-evidence'}
];
const bar = document.querySelector('#workbench-tabs');
const panels = document.querySelector('#workbench-panels');
const states = new Map();
bar.innerHTML = tabs.map(t=>`<button type="button" role="tab" id="wb-tab-${t.id}" aria-controls="wb-panel-${t.id}" aria-selected="false" tabindex="-1" data-workbench="${t.id}">${t.label}</button>`).join('');
panels.innerHTML = tabs.map(t=>`<div id="wb-panel-${t.id}" role="tabpanel" aria-labelledby="wb-tab-${t.id}" tabindex="0" hidden><div id="${t.mount}"></div></div>`).join('');

async function select(id,focus=false){
  const selected = tabs.find(t=>t.id===id)||tabs[0];
  for(const t of tabs){
    const button=document.querySelector(`#wb-tab-${t.id}`);
    button.setAttribute('aria-selected',String(t===selected));
    button.tabIndex=t===selected?0:-1;
    document.querySelector(`#wb-panel-${t.id}`).hidden=t!==selected;
  }
  if(focus)document.querySelector(`#wb-tab-${selected.id}`).focus();
  const u=new URL(location.href);u.searchParams.set('workbench',selected.id);history.replaceState(null,'',u);
  if(states.get(selected.id))return;
  states.set(selected.id,'loading');
  const mount=document.getElementById(selected.mount);
  mount.innerHTML='<div class="research-card"><p role="status">Loading this analysis…</p></div>';
  try{
    const module=await import(`./${selected.module}`);
    await module[selected.fn](mount);
    states.set(selected.id,'ready');
  }catch(error){
    states.delete(selected.id);
    mount.innerHTML='<article class="research-card"><p role="alert">This analysis could not load.</p><button type="button" class="smallbtn">Try again</button></article>';
    mount.querySelector('button').addEventListener('click',()=>select(selected.id));
    console.error(selected.id,error);
  }
}
bar.addEventListener('click',e=>{const b=e.target.closest('[data-workbench]');if(b)select(b.dataset.workbench);});
bar.addEventListener('keydown',e=>{
  const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;
  const current=tabs.findIndex(t=>`wb-tab-${t.id}`===document.activeElement.id);if(current<0)return;
  e.preventDefault();
  const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  select(tabs[next].id,true);
});
select(new URL(location.href).searchParams.get('workbench')||'outcomes');
