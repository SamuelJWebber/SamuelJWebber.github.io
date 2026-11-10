import bridgeData from './data.mjs';
import avenues from './avenues.mjs';
import amsterdam from './amsterdam.mjs';
export {bridgeData,avenues,amsterdam};
export const names={brooklyn:'Brooklyn Bridge',manhattan:'Manhattan Bridge',williamsburg:'Williamsburg Bridge'};
export const titles={prospect:'Prospect Park West',brooklyn:'Brooklyn Bridge',third:'Third Avenue',amsterdam:'Amsterdam Avenue'};
export const samples={pulaski:{label:'Pulaski Bridge · all sampled hours',n:205,d:960,where:'November 2019 field count',group:'local'},peak:{label:'Pulaski Bridge · peak hours',n:189,d:853,where:'Peak subset of the 2019 count',group:'local'},offpeak:{label:'Pulaski Bridge · off-peak',n:16,d:107,where:'Off-peak subset of the 2019 count',group:'local'},manhattan:{label:'Manhattan protected lanes',n:318,d:922,where:'Ten-zone sample of classic and electric bicycles',group:'local'},city:{label:'New York City · 2023',n:35088551,d:226300000,where:'Annual customer trips ÷ DOT’s modeled cycling trips',group:'city'}};
export const ppBikeDays=[
 {date:'2009-06-09',am:58,pm:130},
 {date:'2010-08-17',am:222,pm:409},
 {date:'2010-09-15',am:219,pm:362},
 {date:'2010-10-12',am:210,pm:386},
 {date:'2010-11-09',am:177,pm:268}
];
export const pp={am:{h:3,time:'7–10 a.m.',v:[2700,2909],b:[ppBikeDays[0].am,ppBikeDays[3].am]},pm:{h:3,time:'4–7 p.m.',v:[2807,2807],b:[ppBikeDays[0].pm,ppBikeDays[3].pm]}};
export const periods={am:{start:7,end:9,text:'7–9 a.m.'},pm:{start:16,end:19,text:'4–7 p.m.'},day:{start:6,end:24,text:'6 a.m.–midnight'}};
const mean=a=>a.reduce((v,n)=>v+n,0)/a.length;
export function bridgePoint(bridge,y,t){
 const {start,end}=periods[t],n=end-start;
 const rows=bridgeData.hourly.filter(a=>a[0]===y&&a[1]===bridge&&a[3]>=start&&a[3]<end);
 if(rows.length!==n*2||rows.some(a=>a[5]===null||a[6]===null))return null;
 const w=bridgeData.walking.filter(a=>a[0]===y&&a[1]===bridge&&a[4]===t);
 if(w.length!==(bridge==='manhattan'?2:1))return null;
 const sum=i=>rows.reduce((v,a)=>v+a[i],0);
 const motor=sum(5),bike=sum(6),walk=w.reduce((v,a)=>v+a[5],0);
 const inbound=rows.filter(a=>a[2]==='in').reduce((v,a)=>v+a[4],0);
 return {hours:n,vehicles:sum(4),inbound,outbound:sum(4)-inbound,motor,bike,walk,total:motor+bike+walk};
}
export function avenuePoint(avenue,year,time){
 const {start,end}=periods[time],rows=avenues.rows.filter(a=>a[0]===year&&a[1]===avenue&&a[2]>=start&&a[2]<end);
 if(rows.length!==end-start)return null;
 const s=i=>rows.reduce((v,a)=>v+a[i],0),motor=s(4),bus=s(6);
 const nearbyBike=rows.some(r=>r[7]==null)?null:s(7);
 return {hours:rows.length,vehicles:s(3),motor,bus,nearbyBike,total:motor+bus};
}
export function projectResult(id,time,before,after,a0=1.30,a1=1.30){
 let b,c;
 if(id==='prospect'){const r=pp[time];const observations=[a0,a1].map((o,i)=>({hours:r.h,vehicles:r.v[i],motor:r.v[i]*o,bike:r.b[i],total:r.v[i]*o+r.b[i]}));[b,c]=observations;}
 if(id==='brooklyn'){b=bridgePoint('brooklyn',before,time);c=bridgePoint('brooklyn',after,time);}
 if(id==='third'){b=avenuePoint('Third Avenue',before,time);c=avenuePoint('Third Avenue',after,time);}
 if(id==='amsterdam'){[b,c]=[before,after].map(y=>{const r=amsterdam.rows.find(row=>row.year===y&&row.period===time);return r?{hours:periods[time].end-periods[time].start,vehicles:r.vehicles,nearbyBike:r.bike,bus:r.bus,motor:r.motor,total:r.bus+r.motor}:null;});}
 if(!b||!c)return null;
 const modes=['motor','bus','bike','walk'].filter(k=>Number.isFinite(b[k])&&Number.isFinite(c[k]));const diff=k=>c[k]/c.hours-b[k]/b.hours;
 return {b,c,modes,diff,net:diff('total'),percent:(c.total/c.hours)/(b.total/b.hours)-1};
}
export function bridgeTrend(metric,time,compare){
 const chosen=compare==='both'?['manhattan','williamsburg']:[compare];
 const pts=bridgeData.years.map(y=>{const rate=b=>{const x=bridgePoint(b,y,time);return x[metric]/x.hours;};
 const treated=rate('brooklyn'),peers=chosen.reduce((s,b)=>s+rate(b),0);return {y,treated,peers,network:bridgeData.bridges.reduce((s,b)=>s+rate(b),0)};});
 const average=(key,min,max)=>mean(pts.filter(p=>p.y>=min&&p.y<=max).map(p=>p[key]));const pre={},post={};
 for(const k of ['treated','peers','network']){pre[k]=average(k,2016,2018);post[k]=average(k,2022,2024);}
 const ct=post.treated/pre.treated-1,cp=post.peers/pre.peers-1;
 return {pts,pre,post,ct,cp,networkChange:post.network/pre.network-1,relative:(ct-cp)*pre.treated};
}
export function csv(columns,rows){
 const escape=v=>{if(v==null)return '';const s=String(v);return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
 return [columns,...rows].map(r=>r.map(escape).join(',')).join('\r\n')+'\r\n';
}

