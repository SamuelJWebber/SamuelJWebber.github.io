import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flowThreshold,symmetricExtent} from '../../estimate-lab.mjs';
const data=JSON.parse(readFileSync(new URL('./flow-sensitivity.json',import.meta.url)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
let checks=0;
for(const row of data.ppw){
 const c=row.source_counts;
 for(const baseline of Object.keys(c.vehicle_before)){
  for(const buses of [...new Set([c.scheduled_b69_before_min,c.scheduled_b69_before_max])]){
   for(const busPassengers of [0,50,c.historical_route_max_passengers_per_hour]){
    const result=flowThreshold(c,{baseline,buses,busPassengers});
    // Independent form: change in non-bus occupants, bus-driver loss, bike gain and passengers.
    const expected=1.3*(c.vehicle_after-c.vehicle_before[baseline])/3+.3*buses/3+(c.bike_after-c.bike_before)/3-busPassengers;
    close(result.beforeCorrection,expected);
    close(flowThreshold(c,{baseline,buses,busPassengers,correction:result.correctionToZero}).adjusted,0);
    const zero=(result.afterOccupancyAtZero*c.vehicle_after-1.3*(c.vehicle_before[baseline]-buses)-buses+c.bike_after-c.bike_before)/3-busPassengers;
    close(zero,0);checks+=3;
   }
  }
 }
}
const pm=data.ppw.find(r=>r.period==='pm').source_counts;
close(flowThreshold(pm,{buses:10}).baseChange,259/3);
close(flowThreshold(pm,{buses:11}).baseChange,259.3/3);
for(const bad of [{busPassengers:-1},{busPassengers:Infinity},{busPassengers:1e308},{buses:10.5},{buses:12},{occupancy:.9},{occupancy:5.01},{baseline:'missing'},{correction:NaN}]){assert.throws(()=>flowThreshold(pm,bad));checks++;}
for(const [values,expected] of [[[-7,3],10],[[-50,20],50],[[-50.1,20],60],[[0],10],[[],10]]){assert.equal(symmetricExtent(values),expected);checks++;}
const dist=JSON.parse(readFileSync(new URL('./distributions.json',import.meta.url)));
for(const r of dist.per_day){assert.equal(r.values_seconds.length,r.n);assert.ok(r.min_seconds<=r.p25_seconds&&r.p25_seconds<=r.median_seconds&&r.median_seconds<=r.p75_seconds&&r.p75_seconds<=r.p90_seconds&&r.p90_seconds<=r.max_seconds);checks+=2;}
console.log(JSON.stringify({passed:true,assertions:checks,scope:'Accounting identities, thresholds, input validation, symmetric signed axes and distribution ordering; no causal-validity claim.'}));
