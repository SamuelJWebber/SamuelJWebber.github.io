"""Fetch MTA monthly weekday-hour OD estimates. These are inferred trips, not crossing counts."""
import urllib.request,urllib.parse,json,concurrent.futures,pathlib,time,csv,statistics,sys
P=pathlib.Path(__file__).parent
if not (P/'stations.json').exists():
 with urllib.request.urlopen('https://data.ny.gov/resource/39hk-dx4f.json?$limit=1000',timeout=120) as r:(P/'stations.json').write_bytes(r.read())
ST=json.loads((P/'stations.json').read_text()); ids={}
for s in ST:
 for k in ['station_id','complex_id']:
  n=int(s[k]); b=s['borough']
  if n in ids:assert ids[n]==b,(n,ids[n],b)
  ids[n]=b
sets={b:','.join(str(n) for n in sorted(ids) if ids[n]==b) for b in ['Bk','M','Q']}
print('boroughs',set(ids.values()),flush=True)
if not sets['Bk']: sets['Bk']=','.join(str(n) for n in sorted(ids) if ids[n]=='B')
def fetch(k,id,p):
 if (P/(k+'.json')).exists() and '--refresh' not in sys.argv:return
 u=f'https://data.ny.gov/resource/{id}.json?'+urllib.parse.urlencode(p)
 (P/(k+'-query.txt')).write_text(u)
 for a in range(3):
  try:
   with urllib.request.urlopen(u,timeout=180) as r:d=json.load(r)
   (P/(k+'.json')).write_text(json.dumps(d));print('OK',k,len(d),flush=True);return
  except Exception as e: print('ERROR',k,str(e),flush=True)
queries=[]
for year,id in [(2021,'rapa-97zv'),(2022,'nqnz-e9z9')]:
 for b in ['Bk','Q']:
  clause=f"(origin_station_complex_id in ({sets[b]}) and destination_station_complex_id in ({sets['M']})) or (origin_station_complex_id in ({sets['M']}) and destination_station_complex_id in ({sets[b]}))"
  queries.append((f'subway_{year}_{b}',id,{'$select':'year,month,day_of_week,hour_of_day,sum(estimated_average_ridership) as trips','$where':clause,'$group':'year,month,day_of_week,hour_of_day','$order':'month,day_of_week,hour_of_day','$limit':3000}))
 queries.append((f'od_origins_{year}',id,{'$select':'origin_station_complex_id,origin_station_complex_name','$group':'origin_station_complex_id,origin_station_complex_name','$limit':1000}))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:list(ex.map(lambda t:fetch(*t),queries))
for y in [2021,2022]:
 d=json.loads((P/f'od_origins_{y}.json').read_text());unknown=[r for r in d if int(r['origin_station_complex_id']) not in ids];print('UNKNOWN',y,unknown);assert not unknown, 'Unmapped historical origin IDs'
rows=[]
for y in [2021,2022]:
 for b in ['Bk','Q']:
  d=json.loads((P/f'subway_{y}_{b}.json').read_text())
  for month in range(1,13):
   subset=[r for r in d if int(r['month'])==month and r['day_of_week'] not in ['Saturday','Sunday']]
   daily=sum(float(r['trips']) for r in subset)/5 if len(subset)==120 else None
   assert len([r for r in subset if 7<=int(r['hour_of_day'])<10])==15
   assert len([r for r in subset if 16<=int(r['hour_of_day'])<19])==15
   am=sum(float(r['trips']) for r in subset if 7<=int(r['hour_of_day'])<10)/15
   pm=sum(float(r['trips']) for r in subset if 16<=int(r['hour_of_day'])<19)/15
   rows.append(dict(year=y,month=month,borough=b,weekday_hour_cells=len(subset),weekday_daily_trips=daily,am_trips_per_hour=am,pm_trips_per_hour=pm))
with (P/'subway-monthly-od.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
print(json.dumps([r for r in rows if r['month']==6],indent=2))

metadata=dict(label="Estimated subway OD trips, both directions",unit="Trips per average weekday hour",sources={"2021":"https://data.ny.gov/d/rapa-97zv","2022":"https://data.ny.gov/d/nqnz-e9z9","stations":"https://data.ny.gov/d/39hk-dx4f","methods":"https://data.ny.gov/api/views/rapa-97zv/files/11596109-1af7-4a7e-9761-d557634415c6?download=true"},method="Sum estimated OD trips whose origin and inferred destination lie in the two boroughs, both directions. Equally weight Monday–Friday. AM7–10 and PM16–19 each divide summed five weekday × three hour cells by15. Borough mapping uses official complex IDs and same-borough station IDs for historical complexes; all424 observed origin complexes in each year are mapped. No trip records or travelers are linked across years.",caveats=["These are inferred OD estimates from return taps/swipes, scaled to origin entries; individual pairs are not exact counts.","No actual route, bridge/tunnel, exact trip date, previous mode, exit timestamp or door-to-door time is supplied.","Monthly averages include holidays; they cannot isolate June1–20 or other exact-day samples.","Published data contain populated OD pairs; January2021 has absent overnight cells. Daily totals are withheld where weekday24-hour coverage is incomplete. All AM and PM cells used here are present.","Current station registry is applied to historical IDs; all observed IDs map, but this does not independently validate inferred destinations.","A broad borough-pair recovery series is contextual; it does not identify a bike-lane effect or individual mode switching."])
june=[r for r in rows if r['month']==6]
coverage=[]
for y in [2021,2022]:
 for b in ['Bk','Q']:
  d=json.loads((P/f'subway_{y}_{b}.json').read_text());have={(int(r['month']),r['day_of_week'],int(r['hour_of_day'])) for r in d}
  absent=[dict(month=m,day_of_week=w,hour=h) for m in range(1,13) for w in ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] for h in range(24) if (m,w,h) not in have]
  coverage.append(dict(year=y,borough=b,published_cells=len(d),expected_cells=2016,absent_cells=absent,unknown_origin_ids=0))
result=dict(metadata=metadata,rows=rows,june=june,coverage=coverage)
(P/'subway-panel.json').write_text(json.dumps(result,indent=2))
(P/'subway-panel.mjs').write_text('export default '+json.dumps(result)+';\n')
print(json.dumps(result['june'],indent=2))
