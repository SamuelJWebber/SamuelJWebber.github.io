// Independent algebra/property checks. Run: node independent_math_audit.mjs
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {calculateJourneys, journeyPreset, journeyFrontier, encodeJourneyState, decodeJourneyState, SWITCH_PAIRS} from '../../network-time.mjs';
import {flowThreshold} from '../../estimate-lab.mjs';
const checks=[];let maxError=0;
const close=(a,b)=>{const e=Math.abs(a-b);maxError=Math.max(maxError,e);assert.ok(e<1e-6,`${a} ≠ ${b}`);};
const record=(name,fn)=>{fn();checks.push({check:name,passed:true});};
record('No-change scenario preserves people and time',()=>{
 const s=journeyPreset('unchanged'),r=calculateJourneys(s);
 assert.equal(r.valid,true);close(r.saved,0);close(r.beforeMean,r.afterMean);assert.deepEqual(r.afterCounts,s.counts);
});
record('Every single mode switch conserves travelers exactly',()=>{
 for(const [i,j] of SWITCH_PAIRS){
  const s=journeyPreset('unchanged');s.counts=[0,0,0,0,0];s.counts[i]=100;s.before=[11,17,23,31,41];s.stay=[13,19,29,37,43];s.switches.fill(0);s.switchTimes.fill(7);
  const k=SWITCH_PAIRS.findIndex(([a,b])=>a===i&&b===j);s.switches[k]=20;
  const r=calculateJourneys(s);assert.ok(r.valid);close(r.people,100);close(r.afterCounts[i],80);close(r.afterCounts[j],20);close(r.beforeTotal,100*s.before[i]);close(r.afterTotal,80*s.stay[i]+20*7);
 }
});
let seed=7161;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
record('500 mixed weighted cohorts reconcile with independent sums',()=>{
 for(let n=0;n<500;n++){
  const s=journeyPreset('unchanged');s.counts=s.counts.map(()=>rand()*1000+.1);s.before=s.before.map(()=>rand()*90+1);s.stay=s.stay.map(()=>rand()*90+1);s.switchTimes=s.switchTimes.map(()=>rand()*90+1);s.switches.fill(0);
  for(let i=0;i<5;i++){let left=s.counts[i];for(let k=0;k<20;k++)if(SWITCH_PAIRS[k][0]===i){s.switches[k]=left*rand();left-=s.switches[k];}}
  let b=0,a=0;const post=Array(5).fill(0);
  for(let i=0;i<5;i++){
   b+=s.counts[i]*s.before[i];let stay=s.counts[i];
   for(let k=0;k<20;k++){const [from,to]=SWITCH_PAIRS[k];if(from===i){stay-=s.switches[k];post[to]+=s.switches[k];a+=s.switches[k]*s.switchTimes[k];}}
   post[i]+=stay;a+=stay*s.stay[i];
  }
  const r=calculateJourneys(s);assert.ok(r.valid);close(r.beforeTotal,b);close(r.afterTotal,a);close(r.saved,b-a);r.afterCounts.forEach((v,i)=>close(v,post[i]));close(r.afterCounts.reduce((x,y)=>x+y,0),r.people);close(r.meanChange*r.people,a-b);
  assert.deepEqual(decodeJourneyState(encodeJourneyState(s)),s);
 }
});
record('Illustrative break-even frontier satisfies its defining equation',()=>{
 const s=journeyPreset();
 for(const r of journeyFrontier(s,100)) if(r.additionalCarMinutes!==null)close(r.savedPersonMinutes,r.remainingCarPeople*r.additionalCarMinutes);
});
record('Overallocated switches, missing and infinite inputs are rejected',()=>{
 for(const change of [s=>s.switches[0]=s.counts[0]+1,s=>s.before[0]=NaN,s=>s.counts[0]=Infinity,s=>s.switchTimes[0]=-1]){const s=journeyPreset();change(s);assert.equal(calculateJourneys(s).valid,false);}
});
record('Occupied groups cannot receive zero complete journey time',()=>{
 const a=journeyPreset('unchanged');a.before[0]=0;assert.equal(calculateJourneys(a).valid,false);
 const b=journeyPreset('unchanged');b.stay[1]=0;assert.equal(calculateJourneys(b).valid,false);
 const c=journeyPreset();c.switchTimes[SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===3)]=0;assert.equal(calculateJourneys(c).valid,false);
});
record('Unoccupied zero-time alternatives do not crash the frontier',()=>{
 const s=journeyPreset('unchanged'),k=SWITCH_PAIRS.findIndex(([i,j])=>i===1&&j===3);s.switchTimes[k]=0;
 assert.equal(calculateJourneys(s).valid,true);const rows=journeyFrontier(s,10);assert.ok(rows.some(r=>r.valid===false));assert.ok(rows.filter(r=>r.valid===false).every(r=>r.additionalCarMinutes===null&&r.unavailableReason));
 const t=journeyPreset('unchanged');t.switches[k]=t.counts[1];t.stay[1]=0;
 assert.equal(calculateJourneys(t).valid,true);assert.ok(journeyFrontier(t,10).some(r=>r.valid===false));
});
record('Impossible uniform car-time reductions are identified',()=>{
 const s=journeyPreset('unchanged');s.counts=[0,1,100,0,0];s.before=[1,1,1,1,1];s.stay=[1,1,100,1,1];
 const r=calculateJourneys(s);assert.ok(r.valid);assert.equal(r.uniformCarBreakEvenFeasible,false);assert.ok(r.additionalCarMinutesToBreakEven < -r.minimumPostCarMinutes);
});
const flow=JSON.parse(await readFile(new URL('../causal/flow-sensitivity.json',import.meta.url),'utf8'));
record('PPW zero-flow thresholds reconcile across periods, baselines and occupancies',()=>{
 for(const row of flow.ppw){const c=row.source_counts;
  for(const baseline of Object.keys(c.vehicle_before))for(const occupancy of [1,1.3,2,5])for(const busPassengers of [0,12.5,126,214])for(const buses of [...new Set([c.scheduled_b69_before_min,c.scheduled_b69_before_max])]){
   const r=flowThreshold(c,{baseline,occupancy,busPassengers,buses,correction:73});
   const before=occupancy*(c.vehicle_before[baseline]-buses)+buses+3*busPassengers+c.bike_before;
   const after=occupancy*c.vehicle_after+c.bike_after;
   close(r.beforeCorrection,(after-before)/3);close(r.adjusted,(after-before)/3+73);
   close(flowThreshold(c,{baseline,occupancy,busPassengers,buses,correction:r.correctionToZero}).adjusted,0);
   close((r.afterOccupancyAtZero*c.vehicle_after+c.bike_after-before)/3,0);
  }
 }
});
const result={audit_date:'2026-11-05',scope:'Independent algebra checks of calculators, not validation of assumptions or causal identification',checks,passed:true,max_abs_numeric_discrepancy:maxError};
await writeFile(new URL('independent-math-audit.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
