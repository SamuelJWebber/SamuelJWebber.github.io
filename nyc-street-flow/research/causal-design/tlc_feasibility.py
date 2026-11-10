from urllib.request import urlopen
from urllib.parse import urlencode
from pathlib import Path
from datetime import datetime
import json,csv,hashlib
ROOT=Path(__file__).resolve().parent
results=[]
for year,ds in [(2023,'u253-aew4'),(2024,'bqxa-629f')]:
    params={'$select':'request_datetime,pickup_datetime,dropoff_datetime,pulocationid,dolocationid,trip_time,trip_miles,shared_match_flag,hvfhs_license_num', '$where':f"pickup_datetime >= '{year}-05-01T00:00:00' AND pickup_datetime < '{year}-05-08T00:00:00' AND ((pulocationid=112 AND dolocationid in(145,146)) OR (dolocationid=112 AND pulocationid in(145,146)))", '$limit':50000,'$order':'pickup_datetime'}
    u='https://data.cityofnewyork.us/resource/'+ds+'.json?'+urlencode(params)
    try:
      with urlopen(u,timeout=50) as r:raw=r.read()
      rows=json.loads(raw);(ROOT/f'tlc-feasibility-{year}.json').write_bytes(raw)
      assert len(rows)<50000,'Pagination required'
      valid=[];bad=0;missing=0;pooled=0
      for row in rows:
        if row.get('shared_match_flag')=='Y':pooled+=1
        if not all(row.get(k) for k in ['request_datetime','pickup_datetime','dropoff_datetime']):missing+=1;continue
        a,b,c=[datetime.fromisoformat(row[k]) for k in ['request_datetime','pickup_datetime','dropoff_datetime']]
        wait=(b-a).total_seconds();ride=(c-b).total_seconds();total=(c-a).total_seconds()
        if wait<0 or ride<=0 or total>4*3600:bad+=1;continue
        valid.append({'year':year,'origin':row['pulocationid'],'destination':row['dolocationid'],'request_to_pickup_seconds':wait,'in_vehicle_seconds':ride,'request_to_dropoff_seconds':total,'shared_match_flag':row.get('shared_match_flag','missing')})
      result={'year':year,'dataset':ds,'query_url':u,'window':f'{year}-05-01 to {year}-05-07 inclusive','rows':len(rows),'timing_complete_valid':len(valid),'timing_missing':missing,'timing_invalid_or_over_4h':bad,'shared_matched_rows':pooled,'source_sha256':hashlib.sha256(raw).hexdigest(),'timestamp_filter_note':'Nonnegative request-to-pickup, positive ride, total at most4h. Threshold is feasibility cleaning, not analysis preregistration.'}
      results.append(result)
      with (ROOT/f'tlc-feasibility-derived-{year}.csv').open('w') as f:
        w=csv.DictWriter(f,fieldnames=list(valid[0]) if valid else ['year']);w.writeheader();w.writerows(valid)
    except Exception as e: results.append({'year':year,'dataset':ds,'error':str(e),'query_url':u})
    (ROOT/'tlc-feasibility-summary.json').write_text(json.dumps({'purpose':'Pre-treatment availability and timing completeness check only. No causal effect estimated.','checked_on':'2026-11-05','scope':'Completed HVFHV bookings between Greenpoint and Long Island City taxi zones; actual route and passenger count unobserved.','years':results,'limitations':['Both windows predate the southern McGuinness late2024 redesign.','Zone-level exposure cannot prove use of the redesigned road.','Request-to-dropoff omits access/egress and canceled/unserved requests.','Completed bookings are not people, vehicles or all travel; shared rows can overlap.','Same dates of month have different weekday composition; no year-to-year outcome comparison made.']},indent=2))
    print(json.dumps(result),flush=True)
