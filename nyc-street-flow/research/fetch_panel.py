import urllib.request,urllib.parse,json,pathlib,concurrent.futures,time
ROOT=pathlib.Path(__file__).parent
BASE='https://data.cityofnewyork.us/resource/ct66-47at.json'
SENSORS=['300020904','100062893','100009427','100010022','300020241','100047029']
def get(sensor):
 params={'$select':'sensor_id,date_trunc_ymd(timestamp) as day,flowid,direction,status,count(*) as records,count(counts) as valid_intervals,count(distinct timestamp) as intervals,sum(counts) as bikes,min(counts) as min_count,max(counts) as max_count','$where':f"sensor_id='{sensor}' AND timestamp >= '2019-01-01T00:00:00' AND timestamp < '2026-11-01T00:00:00' AND travelmode='bike'",'$group':'sensor_id,day,flowid,direction,status','$order':'day,flowid,status','$limit':'50000'}
 url=BASE+'?'+urllib.parse.urlencode(params)
 path=ROOT/f'daily_{sensor}.json'
 if path.exists() and "2026-10-31" in path.read_text()[-3000:]:return sensor,len(json.loads(path.read_text()))
 for attempt in range(3):
  try:
   a=json.load(urllib.request.urlopen(url,timeout=180));path.write_text(json.dumps(a));(ROOT/f'query_{sensor}.txt').write_text(url);return sensor,len(a)
  except Exception as e:
   if attempt==2:return sensor,str(e)
   time.sleep(1)
if __name__=='__main__':
 registry_url='https://data.cityofnewyork.us/resource/6up2-gnw8.json?$limit=1000'
 weather_url='https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728&startDate=2019-01-01&endDate=2026-10-31&dataTypes=PRCP,TMAX,TMIN,SNOW&units=metric&format=json'
 for filename,url in [('sensor_registry.json',registry_url),('weather.json',weather_url)]:
  if filename=='weather.json' or not (ROOT/filename).exists():
   (ROOT/filename).write_bytes(urllib.request.urlopen(url,timeout=120).read())
 (ROOT/'weather_query.txt').write_text(weather_url)
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
  for x in ex.map(get,SENSORS):print(x,flush=True)
