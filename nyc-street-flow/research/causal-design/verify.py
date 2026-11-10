"""Offline consistency audit of acquired TLC rows, public contract and chart extracts.
This checks provenance/arithmetic, never causal identification. Python stdlib only.
"""
from pathlib import Path
from datetime import datetime
import json,csv,hashlib,math
R=Path(__file__).resolve().parent
summary=json.loads((R/'tlc-feasibility-summary.json').read_text())
totals={'rows':0,'valid':0,'invalid':0,'missing':0}
for wave in summary['years']:
 y=wave['year']; raw=(R/f'tlc-feasibility-{y}.json').read_bytes()
 assert hashlib.sha256(raw).hexdigest()==wave['source_sha256']
 rows=json.loads(raw);good=[];invalid=missing=0
 for x in rows:
  assert {int(x['pulocationid']),int(x['dolocationid'])} in [{112,145},{112,146}]
  pickup=datetime.fromisoformat(x['pickup_datetime']);assert pickup.year==y and pickup.month==5 and 1<=pickup.day<=7
  if not all(x.get(k) for k in ['request_datetime','pickup_datetime','dropoff_datetime']): missing+=1;continue
  request=datetime.fromisoformat(x['request_datetime']);drop=datetime.fromisoformat(x['dropoff_datetime'])
  wait=(pickup-request).total_seconds();ride=(drop-pickup).total_seconds()
  if wait<0 or ride<=0 or wait+ride>14400:invalid+=1
  else:good.append((wait,ride))
 assert len(rows)==wave['rows'] and len(good)==wave['timing_complete_valid']
 assert invalid==wave['timing_invalid_or_over_4h'] and missing==wave['timing_missing']
 derived=list(csv.DictReader((R/f'tlc-feasibility-derived-{y}.csv').open()))
 assert len(derived)==len(good)
 for row,(wait,ride) in zip(derived,good):
  assert float(row['request_to_pickup_seconds'])==wait
  assert float(row['in_vehicle_seconds'])==ride
  assert float(row['request_to_dropoff_seconds'])==wait+ride
 totals['rows']+=len(rows);totals['valid']+=len(good);totals['invalid']+=invalid;totals['missing']+=missing
assert totals=={'rows':11904,'valid':11892,'invalid':12,'missing':0}
d=json.loads((R/'design.json').read_text())
for key in ['outcomes','sources','candidates','gates']:
 assert len({v['id'] for v in d[key]})==len(d[key])
assert len(d['sources'])==20 and len(d['candidates'])==10 and len(d['gates'])==8
for f,n in [('mcguinness-peak-motor-counts-digitized.csv',16),('mcguinness-bicycle-counts-digitized.csv',4),('mcguinness-north-time-profiles-digitized.csv',558)]:
 rows=list(csv.DictReader((R/f).open()));assert len(rows)==n
 assert all(r['exact_count']=='False' for r in rows),f
assert all(r.get('do_not_sum_reason') for r in rows)
for p in R.glob('*.json'):
 json.loads(p.read_text(),parse_constant=lambda x: (_ for _ in ()).throw(ValueError((p.name,x))))
report={'checked_on':'2026-11-06','passed':True,'tlc':totals,'sources':20,'candidates':10,'gates':8,'scope':'Offline record/derived value checks, JSON validity, digitization labels and contract consistency. Not a causal validation.'}
(R/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
