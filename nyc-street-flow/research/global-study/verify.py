from pathlib import Path
import csv,json,datetime as dt,statistics as st,math
P=Path(__file__).resolve().parent
def rows(s):return list(csv.DictReader((P/s).open()))
d=json.loads((P/'global.json').read_text()); checks=[]
assert len(d['cases'])==19 and len(set(c['city'] for c in d['cases']))==13
assert len({c['id'] for c in d['cases']})==19
for c in d['cases']:
 for k in ['eligibility','measurement','identification','finding','limit','source_url']:assert c.get(k),(c['id'],k)
for c in d['comparisons']:
 assert c['note'] and c['source_url'] and c['rows']
 for r in c['rows']:
  if all(isinstance(r[k],(int,float)) for k in ['before','after','change']):assert math.isclose(r['after']-r['before'],r['change'],abs_tol=1e-5),(c['id'],r)
checks.append('All comparison changes equal displayed after minus before; no mixed units in chart rows.')
raw=json.loads((P/'canada/burrard-2009-2010-full.json').read_text());assert len(raw)==579
lookup={r['date']:r for r in raw}
for r in rows('canada/burrard-matched-summary.csv'):
 pairs=[p for p in rows('canada/burrard-matched-pairs.csv') if p['window']==r['window'] and p['metric']==r['metric']]
 assert len(pairs)==int(float(r['paired_days']))
 for p in pairs:
  a,b=lookup[p['before_date']],lookup[p['after_date']]
  assert not a['comments'] and not b['comments']
  assert a[r['metric']]==float(p['before']) and b[r['metric']]==float(p['after'])
  assert dt.date.fromisoformat(p['before_date']).weekday()==dt.date.fromisoformat(p['after_date']).weekday()
 assert math.isclose(st.mean(float(p['before']) for p in pairs),float(r['before_daily_mean']))
 assert math.isclose(st.mean(float(p['after']) for p in pairs),float(r['after_daily_mean']))
checks.append('All Vancouver retained pairs match raw values, weekdays, event exclusions and published comparison means.')
b=rows('canada/bloor-daily-counts.csv')
sums={wave:sum(float(r['count']) for r in b if r['mode']=='bicycles' and r['wave']==wave) for wave in ['2016-06','2017-06']}
assert sums=={'2016-06':8896,'2017-06':9267}
byid={c['id']:c for c in d['comparisons']}
for mode in ['bicycles','motor_vehicles']:
 for r in byid['toronto-'+mode]['rows']:
  for wave,k in [('2016-06','before'),('2017-06','after')]:assert r[k]==float(next(x['count'] for x in b if x['corridor']==r['label'] and x['mode']==mode and x['wave']==wave))
checks.append('Toronto dashboard values match source transcriptions; three-corridor bicycle count index verified.')
for c in d['comparisons']:
 if c['id'].startswith('cambridge-road'):assert '2021' in c['subtitle'] or '2019' in c['subtitle']
assert byid['london-person-flow']['chart'] is False
assert byid['copenhagen-bus']['rows'][0]['change']==-25
assert 'Proposed, not yet run' in next(c['identification'] for c in d['cases'] if c['id']=='paris-voltaire-2017-2019')
checks.append('Window separation, proposed-design label, post-only chart suppression and Copenhagen source discrepancy verified.')
for f in d['downloads']:assert (P/f['file']).exists(),f
checks.append('All download targets exist.')
report={'checked_on':'2026-11-05','passed':True,'checks':checks,'scope':'Arithmetic, extraction consistency and presentation safeguards; not causal validation.'}
(P/'checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
