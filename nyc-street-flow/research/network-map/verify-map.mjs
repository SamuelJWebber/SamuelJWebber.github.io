import fs from 'node:fs';
import assert from 'node:assert/strict';
import {mapProjection,renderMapSVG} from '../../network-map.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./map-data.json',import.meta.url),'utf8'));
let geometries=0,vertices=0;
for(const c of data.cases){
 const projection=mapProjection(c.bounds),ids=new Set();
 for(const f of c.features){
  assert(!ids.has(f.id));ids.add(f.id);
  f.sources.forEach(id=>assert(data.sources[id]));
  if(!f.geometry)continue;
  geometries++;
  const g=f.geometry;
  const pts=g.type==='Point'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates.flat():g.coordinates;
  for(const p of pts){vertices++;assert(p.length===2&&p.every(Number.isFinite));const [x,y]=projection(p);assert(x>=0&&x<=900&&y>=0&&y<=650,`${f.id}: vertex outside view`);}
 }
 const full=renderMapSVG(c,new Set(['project','observed','comparison','bus','rail']),c.features[0].id);
 assert(!/NaN|undefined/.test(full));
 assert(full.includes('Georeferenced schematic'));
 const none=renderMapSVG(c,new Set(),c.features[0].id);
 assert(!none.includes('data-map-feature'));
}
console.log(JSON.stringify({cases:data.cases.length,geometries,vertices,status:'passed'},null,2));
