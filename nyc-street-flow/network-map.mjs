import {esc,table,link} from './research-view.mjs';

const GROUPS={project:['Lane conversion','#206c4a'],observed:['Measurements','#276b9a'],comparison:['Comparisons / approach','#92723b'],bus:['Bus reroute','#bb5e38'],rail:['Subway context','#82639a']};
const W=900,H=650,PAD=58;

export function mapProjection(bounds){
 const [west,south,east,north]=bounds;
 const cos=Math.cos((north+south)/2*Math.PI/180);
 const scale=Math.min((W-2*PAD)/((east-west)*cos),(H-2*PAD)/(north-south));
 const ox=(W-(east-west)*cos*scale)/2,oy=(H-(north-south)*scale)/2;
 return ([lon,lat])=>[ox+(lon-west)*cos*scale,oy+(north-lat)*scale];
}
function paths(geometry){
 if(!geometry)return [];
 if(geometry.type==='LineString')return [geometry.coordinates];
 if(geometry.type==='MultiLineString')return geometry.coordinates;
 return [];
}
function points(geometry){
 if(!geometry)return [];
 if(geometry.type==='Point')return [geometry.coordinates];
 if(geometry.type==='MultiPoint')return geometry.coordinates;
 return [];
}
function featureAnchor(feature){
 if(feature.label)return feature.label;
 if(!feature.geometry)return null;
 return points(feature.geometry)[0]||paths(feature.geometry)[0]?.[0];
}
export function renderMapSVG(c,enabled,selected){
 const xy=mapProjection(c.bounds),pos=p=>xy(p).map(v=>v.toFixed(2)).join(',');
 let out=`<svg class="network-map-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="map-svg-title map-svg-desc"><title id="map-svg-title">${esc(c.title)}: study locations</title><desc id="map-svg-desc">Georeferenced schematic. Select a numbered location using the accessible list below the map. Road geometry is approximate. ${esc(c.takeaway)}</desc><rect width="${W}" height="${H}" fill="#f5f4ed" rx="12"/>`;
 for(const b of c.background||[]){
  const [tx,ty]=xy(b.coords[Math.min(1,b.coords.length-1)]);
  out+=`<polygon points="${b.coords.map(pos).join(' ')}" fill="${b.kind==='water'?'#dae8e9':'#e3e9da'}"/><text class="map-place" x="${Math.max(85,Math.min(W-145,tx))}" y="${Math.max(35,Math.min(H-35,ty))}">${esc(b.name)}</text>`;
 }
 // Draw every line before point markers; observed and project widths keep overlaps visible.
 for(const [i,f] of c.features.entries()){
  if(!enabled.has(f.group)||!f.geometry)continue;
  const color=GROUPS[f.group][1],active=f.id===selected;
  for(const p of paths(f.geometry)){
   const dashed=f.group==='rail'?'8 6':f.group==='bus'?'4 8':null;
   const width=f.group==='project'?14:f.group==='observed'?5:f.group==='bus'?5:3.5;
   out+=`<polyline points="${p.map(pos).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${dashed?`stroke-dasharray="${dashed}"`:''} opacity="${active?1:.72}"/>`;
   if(f.group==='rail')for(const station of p){const [x,y]=xy(station);out+=`<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="${color}" stroke-width="2"/>`;}
  }
  for(const point of points(f.geometry)){const [x,y]=xy(point);out+=`<circle cx="${x}" cy="${y}" r="${f.group==='rail'?5:8}" fill="${f.group==='rail'?'white':color}" stroke="${f.group==='rail'?color:'white'}" stroke-width="2.5"/>`;}
 }
 for(const [i,f] of c.features.entries()){
  if(!enabled.has(f.group)||!f.geometry)continue;
  const anchor=featureAnchor(f),[x,y]=xy(anchor),active=f.id===selected;
  out+=`<g class="map-marker" data-map-feature="${esc(f.id)}" aria-hidden="true"><circle cx="${x}" cy="${y}" r="${active?18:15}" fill="${GROUPS[f.group][1]}" stroke="${active?'#111':'#fff'}" stroke-width="${active?3:2}"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="#fff" font-size="15" font-weight="700">${i+1}</text></g>`;
 }
 out+=`<g transform="translate(854 45)" fill="#425242"><path d="M0 22V-9M-6 -1L0 -12L6 -1" fill="none" stroke="currentColor" stroke-width="2"/><text y="-21" text-anchor="middle" font-size="13">N</text></g><text x="24" y="625" class="map-footnote">Georeferenced schematic · approximate road geometry · no observed diversion paths</text></svg>`;
 return out;
}

export async function renderNetworkMap(root){
 if(!root)return;
 try{
  const r=await fetch(new URL('./research/network-map/map-data.json',import.meta.url));
  if(!r.ok)throw Error(`Map data: ${r.status}`);
  const data=await r.json();
  let params=new URL(location.href).searchParams;
  let caseId=data.cases.some(c=>c.id===params.get('mapCase'))?params.get('mapCase'):'ppw';
  let enabled=new Set(Object.keys(GROUPS));
  const supplied=params.get('mapLayers');
  if(supplied!==null){enabled=new Set(supplied.split(',').filter(k=>k in GROUPS));enabled.add('project');}
  let current=data.cases.find(c=>c.id===caseId);
  let selected=current.features.find(f=>f.id===params.get('mapFeature')&&enabled.has(f.group))?.id||current.features[0].id;
  root.innerHTML=`<article class="research-card network-map-card"><div class="minilabel">Map the question before adding the counts</div><h3>Where was the lane—and where did we measure?</h3><p>Inspect the counting locations, comparison streets and rail context. A count on one street can fall when people change routes; that alone says little about the whole network.</p><div class="network-map-controls"><label for="network-map-case">Study area<select id="network-map-case">${data.cases.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('')}</select></label><fieldset><legend>Layers</legend>${Object.entries(GROUPS).map(([k,[label,color]])=>`<label class="map-layer"><input type="checkbox" value="${k}" ${enabled.has(k)?'checked':''} ${k==='project'?'disabled':''}><i style="--map-color:${color}"></i>${esc(label)}</label>`).join('')}</fieldset></div><div class="network-map-heading"><h4 id="map-case-subtitle"></h4><p id="map-case-takeaway"></p></div><div class="network-map-layout"><div class="network-map-visual"><div id="network-map-canvas"></div><div class="map-geography-note">Roads and count points drawn by hand are approximate. Subway stations and the labeled counter registry points use official coordinates.</div></div><aside class="network-map-detail" id="network-map-detail" aria-live="polite"></aside></div><div class="network-map-features" role="group" aria-label="Select a study location"></div><div class="map-boundary-note"><b>The counting boundary</b><p id="map-boundary-text"></p></div><details class="map-methods"><summary>Measurement coverage, sources and downloadable geography</summary><div id="map-coverage"></div><p>${esc(data.precision_note)}</p><p>Connecting subway station centers shows context only. Historical service, actual transfers, passenger paths and induced mode changes are not inferred from the map. The map is not a journey planner or an estimate of walking distance.</p><div id="map-sources"></div><div class="research-downloads"><a class="btn" href="research/network-map/map-data.json" download>Map data + provenance · JSON</a><a class="btn" href="research/network-map/map-features.geojson" download>Spatial features · GeoJSON</a><a class="btn" href="research/network-map/README.txt" download>Map methods</a></div></details></article>`;
  const select=root.querySelector('#network-map-case');select.value=caseId;
  const setURL=()=>{const u=new URL(location.href);u.searchParams.set('mapCase',caseId);u.searchParams.set('mapLayers',Object.keys(GROUPS).filter(k=>enabled.has(k)).join(','));u.searchParams.set('mapFeature',selected);history.replaceState(null,'',u);};
  const chooseFeature=id=>{if(current.features.some(f=>f.id===id)){selected=id;draw();}};
  function draw(){
   const focusedFeature=root.contains(document.activeElement)?document.activeElement?.dataset?.mapFeature:null;
   current=data.cases.find(c=>c.id===caseId);
   if(!current.features.some(f=>f.id===selected&&enabled.has(f.group)))selected=current.features[0].id;
   const chosen=current.features.find(f=>f.id===selected);
   root.querySelector('#map-case-subtitle').textContent=current.subtitle;
   root.querySelector('#map-case-takeaway').textContent=current.takeaway;
   root.querySelector('#network-map-canvas').innerHTML=renderMapSVG(current,enabled,selected);
   root.querySelector('#network-map-detail').innerHTML=`<span class="minilabel">${esc(GROUPS[chosen.group][0])}</span><h4>${esc(chosen.title)}</h4><p>${esc(chosen.description)}</p><p class="map-feature-status">${esc(chosen.status)}</p><p class="small">${chosen.sources.map(id=>link(data.sources[id].title,data.sources[id].url)).join('<br>')}</p>${!chosen.geometry?'<span class="map-offmap">Not located on this map</span>':''}`;
   root.querySelector('.network-map-features').innerHTML=current.features.map((f,i)=>`<button type="button" class="map-feature-button ${selected===f.id?'active':''}" data-map-feature="${esc(f.id)}" aria-pressed="${selected===f.id}" ${!enabled.has(f.group)?'disabled':''}><span style="--map-color:${GROUPS[f.group][1]}">${i+1}</span>${esc(f.title)}${!f.geometry?' · off-map':''}</button>`).join('');
   root.querySelector('#map-boundary-text').textContent=current.boundary;
   root.querySelector('#map-coverage').innerHTML=table(['Evidence','Geography and coverage'],current.coverage);
   const sources=[...new Set(current.features.flatMap(f=>f.sources))];
   root.querySelector('#map-sources').innerHTML=`<p class="small">${sources.map(id=>link(data.sources[id].title,data.sources[id].url)).join(' · ')}</p>`;
   setURL();
   if(focusedFeature)root.querySelector(`button[data-map-feature="${focusedFeature}"]`)?.focus({preventScroll:true});
  }
  select.addEventListener('change',()=>{caseId=select.value;current=data.cases.find(c=>c.id===caseId);selected=current.features[0].id;draw();});
  root.querySelectorAll('.map-layer input').forEach(input=>input.addEventListener('change',()=>{input.checked?enabled.add(input.value):enabled.delete(input.value);draw();}));
  root.addEventListener('click',e=>{const marker=e.target.closest('[data-map-feature]');if(marker&&!marker.disabled)chooseFeature(marker.dataset.mapFeature);});
  draw();
 }catch(error){root.innerHTML='<article class="research-card"><h3>Study geography</h3><p role="status">The map data could not load. Please reload, or use the downloadable map data.</p><a href="research/network-map/map-data.json">Map data</a></article>';console.error(error);}
}
