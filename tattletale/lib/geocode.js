// Offline NYC reverse geocoder over CSCL street-centerline tiles.
const BORO = {1:'MANHATTAN',2:'BRONX',3:'BROOKLYN',4:'QUEENS',5:'STATEN ISLAND'};
const BIKE = {1:'protected/off-street bike path',2:'painted bike lane',3:'shared bike route (sharrows)',4:'bike connector',5:'protected path + painted lane',6:'painted lane + shared route',8:'protected path + shared route',9:'painted lane + protected path',10:'shared route + protected path',11:'shared route + painted lane'};
function hasLane(code){ return [1,2,5,6,8,9,10,11].includes(code); }
function decode(flat){ const pts=[[flat[0],flat[1]]]; for(let i=2;i<flat.length;i+=2){const p=pts[pts.length-1]; pts.push([p[0]+flat[i],p[1]+flat[i+1]]);} return pts.map(p=>[p[0]/1e5,p[1]/1e5]); }
function hnParse(v){ if(typeof v==='number') return {pre:null,n:v}; const [a,b]=String(v).split('-'); return {pre:a,n:parseInt(b,10)}; }
function interp(lo,hi,t){
  if(!lo && !hi) return null;
  const a=hnParse(lo), b=hnParse(hi);
  if(!(a.n||b.n)) return null;
  let n=Math.round(a.n+(b.n-a.n)*t);
  if((n%2)!==(a.n%2)) n+= (b.n>=a.n?1:-1);
  const lo2=Math.min(a.n,b.n), hi2=Math.max(a.n,b.n); n=Math.max(lo2,Math.min(hi2,n));
  return a.pre? `${a.pre}-${String(n).padStart(2,'0')}` : String(n);
}
function locate(tile, lat, lon){
  const k=Math.cos(lat*Math.PI/180), py=lat*111320, px=lon*111320*k; const near=[]; let best=null;
  for(const s of tile.s){
    const pts=decode(s[11]); let total=0; const lens=[];
    for(let i=1;i<pts.length;i++){ const dy=(pts[i][0]-pts[i-1][0])*111320, dx=(pts[i][1]-pts[i-1][1])*111320*k; const L=Math.hypot(dx,dy); lens.push(L); total+=L; }
    let acc=0, mine=null;
    for(let i=1;i<pts.length;i++){
      const ay=pts[i-1][0]*111320, ax=pts[i-1][1]*111320*k, by=pts[i][0]*111320, bx=pts[i][1]*111320*k;
      const vx=bx-ax, vy=by-ay, L2=vx*vx+vy*vy||1e-9; let u=((px-ax)*vx+(py-ay)*vy)/L2; u=Math.max(0,Math.min(1,u));
      const d=Math.hypot(px-(ax+u*vx),py-(ay+u*vy));
      if(!mine||d<mine.d) mine={d,s,total,t: total? (acc+u*lens[i-1])/total : 0.5, side:(vx*(py-ay)-vy*(px-ax))>0?'L':'R'};
      acc+=lens[i-1];
    }
    if(!mine) continue;
    if(mine.d<=30) near.push(mine);
    if(!best||mine.d<best.d) best=mine;
  }
  if(!best) return null;
  const s=best.s, n=tile.n, L=best.side==='L';
  const num = L? interp(s[4],s[5],best.t) : interp(s[6],s[7],best.t);
  const street=n[s[0]], from=n[s[2]], to=n[s[3]];
  const zip = (L? s[8]:s[9]) || s[8] || s[9] || '';
  // within about 25 m of the end of the block: report the intersection
  const endDist = Math.min(best.t, 1-best.t) * best.total;
  const endName = best.t<0.5 ? from : to;
  const atIntersection = !!endName && (endDist <= 25 || best.t<0.06 || best.t>0.94);
  // bike lanes on any street within 20 m (a corner photo can show the cross street's lane)
  const lanes = near.filter(c=>c.d<=20 && hasLane(c.s[10])).sort((a,b)=>a.d-b.d);
  const laneSeg = hasLane(s[10]) ? best : lanes[0];
  const laneDesc = laneSeg ? (BIKE[laneSeg.s[10]] + (laneSeg===best ? '' : ' on ' + n[laneSeg.s[0]].toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()))) : '';
  return { street, houseNumber: atIntersection ? '' : num, borough:BORO[s[1]], zip:String(zip||''), crossFrom:from, crossTo:to,
    nearestCross: endName || (best.t<0.5?from:to), atIntersection,
    bikeLaneCode: laneSeg ? laneSeg.s[10] : s[10], bikeLane: laneDesc, hasBikeLane: !!laneSeg, distanceM: Math.round(best.d) };
}
function tileName(lat,lon,size){ return `${Math.floor(lat/size)}_${Math.floor(lon/size)}.json`; }
if(typeof module!=='undefined') module.exports={locate,tileName};
