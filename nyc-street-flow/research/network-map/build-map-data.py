"""Build a self-contained, georeferenced study-area schematic.

Road vertices are manually approximated for explanation, NOT survey geometry.
Official station coordinates are retained in source-points.json. No routing or
distance estimate is made from the illustrative road or rail polylines.
"""
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
points = json.loads((HERE / 'source-points.json').read_text())
station = {r['gtfs_stop_id']: [float(r['gtfs_longitude']), float(r['gtfs_latitude'])] for r in points['subway_stations']}
SOURCES = {
 'ppw': {'title':'NYC DOT · PPW raw counts and travel-time tables (2011)', 'url':'https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf'},
 'ppw_design': {'title':'NYC DOT · PPW project findings (2011)', 'url':'https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw.pdf'},
 'b69': {'title':'MTA · 2010 service reduction evaluation (2011, archived)', 'url':'https://web.archive.org/web/20241003113136id_/http://web.mta.info/mta/news/books/docs/NYCT_2010_Service_Reduction_Evaluation.pdf'},
 'third': {'title':'NYC DOT · Third Avenue completion (December 2023)', 'url':'https://www.nyc.gov/html/dot/html/pr2023/completion-safety-project-third-ave.shtml'},
 'third_design': {'title':'NYC DOT · Third Avenue design (October 2022)', 'url':'https://www.nyc.gov/html/dot/downloads/pdf/third-ave-complete-streets-safety-improvements-oct2022.pdf'},
 'bus': {'title':'MTA · Bus segment speeds dataset', 'url':'https://data.ny.gov/d/58t6-89vi'},
 'pulaski': {'title':'NYC DOT · Pulaski opening (April 2016)', 'url':'https://www.nyc.gov/html/dot/html/pr2016/pr16-044.shtml'},
 'pulaski_plan': {'title':'NYC DOT · Pulaski design and existing downstream merge (2014)', 'url':'https://www.nyc.gov/html/dot/downloads/pdf/2014-12-pulaski-presentation.pdf'},
 'pulaski_design': {'title':'NYC DOT · 2016 bridge report, Pulaski lane conversion', 'url':'https://www.nyc.gov/html/dot/downloads/pdf/dot_bridgereport16.pdf'},
 'bikes': {'title':'NYC DOT · Bicycle and pedestrian counts', 'url':'https://data.cityofnewyork.us/d/ct66-47at'},
 'bike_registry': {'title':'NYC DOT · Counter registry (series start and published point)', 'url':'https://data.cityofnewyork.us/d/6up2-gnw8'},
 'counter': {'title':'NYSDOT · Traffic data repository / 2016 counter inventory', 'url':'https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb'},
 'subway': {'title':'MTA · Subway station coordinates', 'url':'https://data.ny.gov/d/39hk-dx4f'},
 'map': {'title':'MTA · Subway network map (context, not historical service)', 'url':'https://www.mta.info/map/5256'}
}

def f(id,title,group,geometry,description,status,sources,label=None):
 return dict(id=id,title=title,group=group,geometry=geometry,description=description,status=status,sources=sources,**({'label':label} if label else {}))
def line(coords):return {'type':'LineString','coordinates':coords}
def multi(coords):return {'type':'MultiLineString','coordinates':coords}
def point(coords):return {'type':'Point','coordinates':coords}

ppw=[[-73.9693,40.67365],[-73.97955,40.66055]]
six=[[-73.9759,40.6766],[-73.9862,40.6635]]
seven=[[-73.9737,40.6756],[-73.9840,40.6625]]
eight=[[-73.9715,40.67465],[-73.9818,40.6615]]
ppwcase={
 'id':'ppw','title':'Prospect Park West · 2010','subtitle':'Nearby does not mean comparable',
 'bounds':[-73.988,40.658,-73.963,40.678],
 'takeaway':'The bicycle count, motor count and bus passenger history describe different points and dates. Parallel streets also experienced a bus reroute.',
 'boundary':'A PPW street cross-section omits travelers who move to Seventh Avenue or rail. A network result requires synchronized counts across a prespecified network screenline or corridor boundary. Crossing events must not be mistaken for unique journeys; rail and road coverage must refer to the same population and time window.',
 'coverage':[['Bike passage','4th–5th Streets · June 2009 / October 2010'],['Motor passage','Carroll Street · April 2009 + May 2010 / October 2010'],['Driving time','Four street routes · two weekdays per wave'],['Complete journey / rail substitution','Not observed for this conversion']],
 'background':[{'kind':'park','name':'Prospect Park','coords':[[-73.9691,40.6734],[-73.962,40.6683],[-73.9735,40.6575],[-73.9793,40.6604]]}],
 'features':[
 f('ppw-lane','PPW: three moving lanes → two','project',line(ppw),'A two-way protected bikeway replaced a moving motor lane in June 2010. This line shows the corridor approximately, not lane engineering geometry.','Verified conversion · approximate drawing',['ppw','ppw_design'],[-73.9693,40.67365]),
 f('ppw-motor','Motor counter · Carroll Street','observed',point([-73.9713,40.67115]),'The published motor before/after counts were collected near Carroll Street. Vehicles are not people: bus passengers and other vehicle occupancy must be added correctly.','Observed vehicle counts · hand-positioned point',['ppw']),
 f('ppw-bike','Bike count · between 4th and 5th Streets','observed',point([-73.9750,40.6664]),'The original bicycle sheets identify the block between Fourth and Fifth Streets. It is not the Carroll Street motor-count location, and the survey dates differ.','Observed bike passages · hand-positioned point',['ppw']),
 f('ppw-six','Sixth Avenue · northbound comparator','comparison',line(six),'Travel-time comparison in the DOT survey. Opposite direction to PPW; a useful sensitivity test, not a validated untreated control.','Timed runs · direction mismatch',['ppw'],six[1]),
 f('ppw-seven','Seventh Avenue · southbound comparator','comparison',line(seven),'Same-direction travel-time comparison. The B69 moved here in June 2010, alongside bus-service changes, so this road is co-treated. The line is a corridor guide, not exact timed-run endpoints.','Timed runs · affected by bus rerouting',['ppw','b69'],seven[1]),
 f('ppw-eight','Eighth Avenue · northbound comparator','comparison',line(eight),'Opposite-direction travel-time comparison. B69 northbound service left Eighth Avenue in June 2010, so this comparator is also affected.','Timed runs · affected by bus rerouting',['ppw','b69'],eight[1]),
 f('ppw-b69','B69 moved from PPW / Eighth to Seventh','bus',multi([ppw,eight,seven]),'Effective June 27, 2010, the B69 moved from PPW southbound and Eighth Avenue northbound to Seventh Avenue. Service levels changed too. Highlighted corridors show this route change, not individual passengers or full bus routes.','Documented route change · approximate corridor highlights',['b69'],[-73.9776,40.67065]),
 f('ppw-rail','Nearby subway stations','rail',{'type':'MultiPoint','coordinates':[station[x] for x in ['237','F24','F25']]},'Grand Army Plaza, Seventh Avenue and 15 St–Prospect Park are possible access points, not evidence that travelers switched modes. Markers use official station-center coordinates; entrances, historical service and complete journey paths are not shown.','Station geography only · no attributed passenger change',['subway','map'],station['237'])
 ]}

# Manhattan road centerlines are approximations inferred from named endpoints.
third59=[-73.96575,40.76160];third96=[-73.94902,40.78470]
third67=[-73.96210,40.76660];third97=[-73.94857,40.78532]
lex96=[-73.95107,40.78567];lex68=[-73.96387,40.76814]
thirdcase={
 'id':'third','title':'Third Avenue · 2023','subtitle':'One redesign, several overlapping networks',
 'bounds':[-73.976,40.758,-73.941,40.790],
 'takeaway':'The measured bus segment extends beyond the project. Lexington, Madison and First Avenue are different corridors; rail stations supply context, not counts attributable to the redesign.',
 'boundary':'Choose a corridor or area boundary before summing modes. Subway station entries count access to the system, not passengers crossing this same street boundary; adding them directly would change the estimand.',
 'coverage':[['Redesign','Third Avenue · E59–E96'],['Measured bus segment','Third Avenue · E67–E97, 1.472 miles'],['Comparison geography','Lexington, First, Madison; other Third segments outside this view'],['All-mode people / complete journey','Aligned passenger and journey observations missing']],
 'background':[{'kind':'park','name':'Central Park edge','coords':[[-73.976,40.763],[-73.970,40.762],[-73.952,40.788],[-73.958,40.791]]}],
 'features':[
 f('third-lane','Project · E59–E96','project',line([third59,third96]),'The 2023 redesign combined a bike lane, bus lane, intersection changes and traffic calming. The design changes five general moving lanes to three, plus the bus and bike lanes. It cannot isolate a bike-lane-only effect.','Verified bundled redesign · approximate line',['third','third_design'],third59),
 f('third-measured','Measured bus segment · E67–E97 northbound','observed',line([third67,third97]),'The matched bus timepoints are E67 to E97, a published segment distance of 1.472 miles. The segment includes one block north of the E96 project limit. Run-weighted time is not passenger-weighted complete journey time.','Observed bus segment times · approximate line',['bus'],third97),
 f('third-lex','Lexington · E96–E68 southbound','comparison',line([lex96,lex68]),'Primary bus comparison uses the same three route/service types in the opposite direction. Its pre-period divergence is large enough to challenge a causal interpretation.','Comparison segment · pre-trend concern',['bus'],lex96),
 f('third-first','First Avenue · E79–E97 northbound','comparison',line([[-73.9510,40.7725],[-73.9428,40.7839]]),'M15 Local provides a same-direction bus comparison. Route, street and operating conditions differ from Third Avenue.','Alternative comparison · not an untreated guarantee',['bus'],[-73.9430,40.7839]),
 f('third-madison','Madison · E57–E95 northbound','comparison',line([[-73.9724,40.7622],[-73.9552,40.7860]]),'M3/M4 are retained for this comparison. M1 timepoints changed in April 2024 and are excluded. Corridor lines illustrate the named endpoints approximately.','Alternative comparison · fixed service selection',['bus'],[-73.9552,40.786]),
 f('third-rail','Lexington / Second Avenue subway context','rail',multi([[station[x] for x in ['629','628','627','626','625']],[station[x] for x in ['Q03','Q04','Q05']]]),'Official station centers are connected schematically along the two nearby subway corridors. These lines are not surveyed tunnel alignments or observed passenger paths. Station usage does not identify car-to-subway switching.','Rail geography only · no attributed mode shift',['subway','map'],station['Q03']),
 f('third-away','Additional comparisons outside this view','comparison',None,'Other estimates use Third Avenue E23–E42 and E99–E125. They are geographically distinct, and the northern comparator changes the sign of the estimate. Inspect all comparisons in the sensitivity view.','Off-map comparison segments',['bus'])
 ]}

pulaski=[[-73.95265,40.7350],[-73.95225,40.7387],[-73.95145,40.7430]]
counter=[points['motor_counter']['longitude'],points['motor_counter']['latitude']]
pulaskicase={
 'id':'pulaski','title':'Pulaski Bridge / McGuinness · 2016','subtitle':'A nearby counter is not a bridge screenline',
 'bounds':[-73.962,40.721,-73.940,40.747],
 'takeaway':'The conversion removed a Brooklyn-bound (southbound) lane on Pulaski Bridge. The long motor-count series is farther south on McGuinness, beyond intervening junctions.',
 'boundary':'For bridge person flow, count bikes, pedestrians and vehicle occupants at a common bridge screenline, then account separately for travelers using other crossings or rail. A McGuinness count cannot be substituted without junction-flow accounting.',
 'coverage':[['Motor counter','NYSDOT 021284 · between I-278 and Greenpoint Avenue'],['Bike automatic counter','Bridge series starts June 2017, after conversion'],['Treatment timing','Bike opening April 29, 2016; permanent motor-lane closure date unresolved'],['Donor roads','Boston Road and Broadway in the Bronx, outside this map']],
 'background':[{'kind':'water','name':'Newtown Creek','coords':[[-73.962,40.7418],[-73.939,40.7368],[-73.939,40.7348],[-73.962,40.7398]]}],
 'features':[
 f('pulaski-lane','Pulaski: southbound moving lane converted','project',line(pulaski),'One Brooklyn-bound / southbound car lane was converted to a two-way protected bikeway. DOT describes the scheme between Jackson Avenue in Queens and Eagle Street in Brooklyn. This is the 2016 bridge project, not the later McGuinness redesign.','Verified moving-lane conversion · approximate drawing',['pulaski','pulaski_design'],pulaski[1]),
 f('pulaski-counter','McGuinness motor counter · station 021284','observed',point(counter),'The 2016 NYSDOT inventory places this counter between I-278 and Greenpoint Avenue. It records vehicles traveling through this point, including trips that may enter or leave before reaching Pulaski. Station continuity still needs verification.','Official inventory coordinate · count continuity unresolved',['counter']),
 f('pulaski-approach','McGuinness approach and intervening junctions','comparison',line([[-73.9477,40.7237],counter,[-73.9502,40.7296],[-73.95265,40.7350]]),'This approximate approach line connects the counter area to Eagle Street. Intersecting streets can add or remove traffic. Before conversion, the three Brooklyn-bound lanes already merged to two approaching McGuinness / Green Street; losing a marked lane therefore does not establish a reduction in the network bottleneck capacity. Northbound is not assumed unaffected.','Documented downstream merge · not a control group',['counter','pulaski','pulaski_plan'],[-73.9502,40.7296]),
 f('pulaski-rail','Crosstown subway stations','rail',multi([[station[x] for x in ['G28','G26','G24','G22']]]),'Nassau Avenue, Greenpoint Avenue, 21 Street and Court Square provide rail context. Straight joins between station centers are schematic, not tunnel geometry. No observed car-to-subway switching is inferred.','Official station centers · schematic connections',['subway','map'],station['G26']),
 f('pulaski-bike','Bike counter · published registry location','observed',point([float(points['bike_counter_registry']['lon']),float(points['bike_counter_registry']['lat'])]),'The November 2026 registry gives this site coordinate and a June 24, 2017 series start, after conversion. It also lists a May 2022 equipment installation; the displayed point does not verify the 2017 hardware location or continuity. There is no pre-conversion automatic baseline.','Registry site point · historical hardware continuity unverified',['bike_registry','bikes','pulaski']),
 f('pulaski-donors','Two Bronx donor counters','comparison',None,'Boston Road station 010009 and Broadway station 010012 are not nearby alternative routes. They help test broader motor-count trends, but road context and data support differ. Donor choice is a sensitivity test.','Off-map donors · no local diversion measurement',['counter'])
 ]}

data={'schema_version':1,'updated':'2026-11-05','title':'NYC Street Flow — study geography',
 'coordinate_reference_system':'EPSG:4326; coordinates [longitude, latitude]',
 'precision_note':'Georeferenced schematic. Subway stations, the McGuinness motor counter and the published Pulaski bike site use official source coordinates. Road, park, creek and other count vertices are manually approximated for orientation, not survey, routing, distance or buffer analysis.',
 'sources':SOURCES,'cases':[ppwcase,thirdcase,pulaskicase]}
(HERE/'map-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
features=[]
for c in data['cases']:
 for v in c['features']:
  if v['geometry']:
   features.append({'type':'Feature','geometry':v['geometry'],'properties':{'case_id':c['id'],**{k:v[k] for k in ['id','title','group','description','status','sources']}}})
(HERE/'map-features.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,indent=2)+'\n')
print(f'Wrote {len(data["cases"])} cases and {len(features)} spatial features')
