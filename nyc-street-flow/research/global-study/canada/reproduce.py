#!/usr/bin/env python3
"""Rebuild descriptive evidence. Uses only Python stdlib and the preserved City data.

No coefficient below estimates a causal treatment effect. Daily totals retain the
publisher's rounding; missing values are not zero-filled or interpolated.
"""
from pathlib import Path
import csv, json, hashlib, datetime as dt, statistics as stats

ROOT = Path(__file__).resolve().parent
def csvout(name, rows):
    with (ROOT/name).open('w', newline='') as f:
        writer=csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
def jsonout(name, value):
    (ROOT/name).write_text(json.dumps(value, indent=2)+'\n')

raw = json.loads((ROOT/'burrard-2009-2010-full.json').read_text())
raw.sort(key=lambda r:r['date'])
assert len(raw)==579 and len({r['date'] for r in raw})==579
csvout('burrard-2009-2010-daily.csv', raw)
lookup={r['date']:r for r in raw}
fields=[k for k in raw[0] if k not in ('date','comments')]
coverage=[]
for field in fields:
    valid=[r for r in raw if r[field] is not None]
    coverage.append(dict(field=field, valid_days=len(valid), missing_days=len(raw)-len(valid), first_valid=valid[0]['date'], last_valid=valid[-1]['date'], pre_opening_valid_days=sum(r['date']<'2009-07-13' for r in valid)))
csvout('burrard-coverage.csv',coverage)

# Explicit fixed-offset same-weekday pairs. All inclusion rules are outcome-independent.
# Primary all-mode window starts at first pedestrian record and stops before installation.
# Counterfactual weather or seasonality adjustment is NOT available in these records.
windows=[
    dict(id='all_modes_14_day_pairs',start='2009-06-30',end='2009-07-09',lag=14,fields=['total_bicycles','total_pedestrians','total_vehicles']),
    dict(id='bike_vehicle_28_day_pairs',start='2009-06-16',end='2009-07-09',lag=28,fields=['total_bicycles','total_vehicles']),
    dict(id='immediate_four_weekdays_sensitivity',start='2009-07-06',end='2009-07-09',lag=7,fields=['total_bicycles','total_pedestrians','total_vehicles']),
]
summary=[]; pairs=[]; exclusions=[]
for w in windows:
    selected=[]
    for a in raw:
        if not w['start'] <= a['date'] <= w['end']:continue
        b=lookup[(dt.date.fromisoformat(a['date'])+dt.timedelta(days=w['lag'])).isoformat()]
        reasons=[]
        if a['comments'] or b['comments']:
            reasons.append('event_comment_before='+str(a['comments'])+';after='+str(b['comments']))
        missing=[k for k in w['fields'] if a[k] is None or b[k] is None]
        if missing: reasons.append('missing='+','.join(missing))
        if reasons:
            exclusions.append(dict(window=w['id'],before_date=a['date'],after_date=b['date'],reason=' | '.join(reasons)))
            continue
        assert dt.date.fromisoformat(a['date']).weekday()==dt.date.fromisoformat(b['date']).weekday()
        selected.append((a,b))
        for field in w['fields']:
            pairs.append(dict(window=w['id'],before_date=a['date'],after_date=b['date'],weekday=dt.date.fromisoformat(a['date']).strftime('%A'),metric=field,before=a[field],after=b[field],change=b[field]-a[field]))
    for field in w['fields']:
        before=stats.mean(a[field] for a,b in selected); after=stats.mean(b[field] for a,b in selected)
        summary.append(dict(window=w['id'],metric=field,paired_days=len(selected),baseline_candidate_start=w['start'],baseline_candidate_end=w['end'],pair_offset_days=w['lag'],before_daily_mean=before,after_daily_mean=after,change_daily_mean=after-before,change_pct=(after/before-1)*100,interpretation='same-weekday complete-pair descriptive comparison; not causal; not all-person flow'))
csvout('burrard-matched-summary.csv',summary)
csvout('burrard-matched-pairs.csv',pairs)
csvout('burrard-matched-exclusions.csv',exclusions)
rounding=[]
for r in raw:
    for mode in ('pedestrians','bicycles','vehicles'):
        n,s,t=(r[k+'_'+mode] for k in ('northbound','southbound','total'))
        if n is not None and s is not None and t is not None and n+s!=t:
            rounding.append(dict(date=r['date'],mode=mode,northbound=n,southbound=s,published_total=t,directional_sum=n+s,discrepancy=n+s-t))
csvout('burrard-directional-total-discrepancies.csv',rounding)

# Exact total columns of Toronto Attachment 1. Avoid re-summing rounded directions.
source='https://www.toronto.ca/wp-content/uploads/2017/10/9697-Cycling-Bloor-Attachment-1.pdf'
counts={
    ('Bloor','bicycles'):[3309,4501,4925],('Dupont','bicycles'):[956,798,852],('Harbord','bicycles'):[4631,3892,3490],
    ('Bloor','motor_vehicles'):[24322,19918,20434],('Dupont','motor_vehicles'):[20491,21155,21958],('Harbord','motor_vehicles'):[13502,13316,14086],
}
sites={'Bloor':'Bay;Bedford;Walmer;Clinton','Dupont':'Spadina;Bathurst;Shaw','Harbord':'Huron;Spadina;Bathurst;Shaw'}
rows=[]
for (corridor,mode), values in counts.items():
    for wave,value in zip(('2016-06','2016-10','2017-06'),values):
        rows.append(dict(corridor=corridor,mode=mode,wave=wave,count=value,unit='average daily count averaged across corridor video sites',video_sites=sites[corridor],observation_days='three consecutive weekdays (T/W/Th)',source_url=source,source_page=1))
csvout('bloor-daily-counts.csv',rows)
bsummary=[]
for mode in ('bicycles','motor_vehicles'):
    before=sum(v[0] for (c,m),v in counts.items() if m==mode)
    after=sum(v[2] for (c,m),v in counts.items() if m==mode)
    bsummary.append(dict(metric=mode,before=before,after=after,absolute_change=after-before,change_pct=(after/before-1)*100,unit='sum of three corridor-average daily counts; not an audited common screenline or unique journeys'))
csvout('bloor-corridor-index.csv',bsummary)
times={
 ('Bloor','AM','EB'):['10:01','14:13','12:01'],('Bloor','AM','WB'):['7:32','8:41','8:04'],('Bloor','PM','EB'):['11:47','12:52','12:36'],('Bloor','PM','WB'):['11:14','19:39','15:29'],
 ('Dupont','AM','EB'):['13:29','9:13','9:59'],('Dupont','AM','WB'):['6:33','6:16','7:43'],('Dupont','PM','EB'):['10:08','9:05','8:27'],('Dupont','PM','WB'):['11:19','13:25','10:31'],
 ('Harbord','AM','EB'):['11:39','10:26','11:15'],('Harbord','AM','WB'):['6:33','6:23','6:22'],('Harbord','PM','EB'):['9:50','9:37','10:45'],('Harbord','PM','WB'):['11:50','12:09','11:43'],
}
timerows=[]
for (corridor,peak,direction),values in times.items():
    for wave,value in zip(('2016-06','2016-10','2017-06'),values):
        mins,secs=map(int,value.split(':'))
        timerows.append(dict(corridor=corridor,peak=peak,direction=direction,wave=wave,seconds=60*mins+secs,unit='seconds driving measured corridor; not complete journey',source_url=source,source_page=1))
csvout('bloor-driving-times.csv',timerows)

# Calgary final report exact figures; all times are measured corridor driving, not trip times.
calgary_url='https://www.calgary.ca/content/dam/www/transportation/tp/documents/cycling/city-centre-cycle-track/cycle-track-summary-report-nov-2016.pdf'
calgary=[
 dict(corridor='5 Street SW',metric='16h bicycles at CPR underpass',before=630,after=2040,unit='bicycle crossings per 16h count',page=20),
 dict(corridor='12 Avenue S',metric='16h bicycles west of 2 Street SW',before=190,after=870,unit='bicycle crossings per 16h count',page=20),
 dict(corridor='8 Avenue SW',metric='16h bicycles west of 3 Street SW',before=920,after=1240,unit='bicycle crossings per 16h count',page=20),
 dict(corridor='5 Street SW',metric='PM southbound driving',before=360,after=370,unit='seconds',page=9),
 dict(corridor='12 Avenue S',metric='AM eastbound driving',before=340,after=430,unit='seconds',page=11),
 dict(corridor='12 Avenue S',metric='PM eastbound driving; baseline likely affected by Hotel Arts construction',before=690,after=440,unit='seconds',page=11),
 dict(corridor='8 Avenue SW',metric='AM eastbound driving',before=330,after=315,unit='seconds',page=13),
 dict(corridor='8 Avenue SW',metric='PM westbound driving',before=330,after=330,unit='seconds',page=13),
]
for row in calgary:
    row.update(before_wave='2014-09',after_wave='2016-09',change=row['after']-row['before'],change_pct=(row['after']/row['before']-1)*100,source_url=calgary_url)
csvout('calgary-selected-results.csv',calgary)

manifest=[]
for filename,url in [
 ('bloor-2017-report.pdf','https://www.toronto.ca/wp-content/uploads/2017/10/8ef6-cycling-bloor-backgroundfile-107582.pdf'),
 ('bloor-2017-metrics.pdf',source),('calgary-2016-report.pdf',calgary_url),
 ('burrard-2009-2010-full.json','https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/bike-lane-statistics-for-burrard-bridge-2009-2010/exports/json'),
]:
    p=ROOT/filename;blob=p.read_bytes()
    manifest.append(dict(filename=filename,url=url,bytes=len(blob),sha256=hashlib.sha256(blob).hexdigest(),retrieved_session_date='2026-11-06'))
jsonout('source-manifest.json',manifest)
print(json.dumps(dict(burrard=summary,bloor=bsummary,raw_rows=len(raw),directional_total_discrepancies=len(rounding)),indent=2))
