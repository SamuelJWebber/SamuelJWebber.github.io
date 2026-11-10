#!/usr/bin/env python3
"""Independent arithmetic checks using released raw rows, not producer functions.
Run from any directory: python independent_data_audit.py
Requires pandas and numpy. No network. These checks do not establish causal validity.
"""
from pathlib import Path
import json, math, hashlib
import numpy as np
import pandas as pd

P=Path(__file__).resolve().parent
R=P.parent
issues=[]
checks=[]
max_error=0.

def check(name, ok, detail):
    checks.append({'check':name,'passed':bool(ok),'detail':detail})
    if not ok: issues.append(name)

def eq(a,b,tol=1e-7):
    global max_error
    err=abs(float(a)-float(b)); max_error=max(max_error,err)
    return err<tol

D=R/'directional'
raw=pd.read_csv(D/'source-three-station-directional-days.csv',dtype={'station':str,'direction':str,'source_direction_code':str})
hours=[f'h{i:02}' for i in range(24)]
raw['date']=pd.to_datetime(raw.date)
check('directional source keys unique',not raw.duplicated(['station','date','source_direction_code']).any(),f'{len(raw)} rows')
source_dates=raw.groupby('date')
# Complete observations at all three sites and two directions per site.
valid=source_dates.filter(lambda x: len(x)==6 and x.groupby('station').size().eq(2).all() and x[hours].notna().all().all() and x[hours].ge(0).all().all())
valid=valid[valid.date.dt.dayofweek<5]
bydate=valid.groupby('date')[hours].min().min(axis=1)
comparisons=json.loads((D/'analysis.json').read_text())
expected=comparisons['comparisons']+comparisons['hourly']
windows={'post':(2016,range(5,13)),'pre':(2015,range(1,9)),'early_pre':(2015,[1,2])}
periods={'day':hours,'am':hours[7:10],'pm':hours[16:19],'other':[h for i,h in enumerate(hours) if i not in [7,8,9,16,17,18]],**{h:[h] for h in hours}}
actual={}
for quality in ['all_complete','exclude_flagged']:
    r=valid[valid.date.isin(bydate.index if quality=='all_complete' else bydate[bydate>0].index)].copy()
    r['year']=r.date.dt.year;r['month']=r.date.dt.month;r['weekday']=r.date.dt.dayofweek
    dates=r[['date','year','month','weekday']].drop_duplicates()
    ndates=dates.groupby(['year','month','weekday']).size()
    # This estimator uses equal retained cell weights, never counts rows as passengers.
    for window,(year,months) in windows.items():
        eligible=[(m,w) for m in months for w in range(5) if ndates.get((2014,m,w),0)>=2 and ndates.get((year,m,w),0)>=2]
        chosen=r[r.set_index(['month','weekday']).index.isin(eligible)]
        target=chosen[chosen.station=='021284']
        donors=chosen[chosen.station!='021284'].groupby(['station','date','year','month','weekday'])[hours].sum().reset_index()
        tmeans=target.groupby(['direction','year','month','weekday'])[hours].mean().groupby(['direction','year']).mean()
        cmeans=donors.groupby(['station','year','month','weekday'])[hours].mean().groupby(['station','year']).mean()
        for direction in ['NB','SB','both']:
            t0=(tmeans.loc[('NB',2014)]+tmeans.loc[('SB',2014)]) if direction=='both' else tmeans.loc[(direction,2014)]
            t1=(tmeans.loc[('NB',year)]+tmeans.loc[('SB',year)]) if direction=='both' else tmeans.loc[(direction,year)]
            for control in ['010009','010012']:
                for period,hs in periods.items():
                    a,b=t0[hs].sum(),t1[hs].sum();c,d=cmeans.loc[(control,2014),hs].sum(),cmeans.loc[(control,year),hs].sum()
                    cf=a*d/c
                    actual[(quality,window,direction,control,period)]={'target_before':a,'target_after':b,'control_before':c,'control_after':d,'counterfactual_target':cf,'relative_change_vehicles':b-cf,'raw_change_pct':100*(b/a-1),'relative_change_pct':100*(b/cf-1),'retained_cells':len(eligible)}
err=[]
for row in expected:
    key=tuple(row[k] for k in ['quality','window','direction','control','period'])
    computed=actual[key]
    err.extend((key,k,row[k],v) for k,v in computed.items() if not eq(row[k],v))
check('all directional and hourly estimates independently reproduced',not err,f'{len(expected)} rows × 9 numeric fields; largest absolute discrepancy {max_error:.3g}')
if err: issues.extend(str(e) for e in err[:10])
E=R/'estimate-lab'
ppw=pd.read_csv(E/'ppw-raw-runs.csv')
ppw=ppw[ppw.weekday.isin(['Tuesday','Wednesday'])]
dist=json.loads((E/'distributions.json').read_text())
qfields={'min_seconds':0,'p25_seconds':.25,'median_seconds':.5,'p75_seconds':.75,'p90_seconds':.9,'max_seconds':1}
win={'daily_07_19':(7,19),'am_07_10':(7,10),'midday_10_14':(10,14),'pm_16_19':(16,19)}
qerrors=[]
for kind in ['per_day','pooled_wave']:
    for item in dist[kind]:
        a,b=win[item['window']]
        rows=ppw[(ppw.route==item['route']) & ppw.hour.ge(a) & ppw.hour.lt(b)]
        rows=rows[rows.date==item['date']] if kind=='per_day' else rows[rows.period==item['period']]
        v=rows.total_seconds.to_numpy()
        expected_q={k:float(np.quantile(v,p,method='linear')) for k,p in qfields.items()}
        expected_q.update({'mean_seconds':float(v.mean()),'n':len(v)})
        qerrors.extend((kind,item['route'],item['window'],k) for k,x in expected_q.items() if not eq(item[k],x))
check('PPW raw-run distributions independently reproduced',not qerrors,f"{len(dist['per_day'])} per-day groups and {len(dist['pooled_wave'])} pooled groups; NumPy quantiles")
# Two exact accounting cases are repeated independently from inputs.
flow=json.loads((R/'causal'/'flow-sensitivity.json').read_text())
flows=[]
for row in flow['ppw']:
    c=row['source_counts'];r=[]
    for n in [c['scheduled_b69_before_min'],c['scheduled_b69_before_max']]:
        r.append((1.3*c['vehicle_after']-1.3*(c['vehicle_before']['published_average']-n)-n+c['bike_after']-c['bike_before'])/3)
    flows.append({'period':row['period'],'lower':min(r)-c['historical_route_max_passengers_per_hour'],'upper':max(r)})
check('PPW conditional PM range reconciles',any(x['period']=='pm' and abs(x['lower']-(-39.6666666667))<1e-6 and abs(x['upper']-86.4333333333)<1e-6 for x in flows),flows)
result={'audit_date':'2026-11-05','scope':'Independent arithmetic audit of released derived datasets, no causal-validity certificate.','checks':checks,'passed':not issues,'issues':issues,'max_abs_numeric_discrepancy':max_error,'inputs_sha256':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [D/'analysis.json',D/'source-three-station-directional-days.csv',E/'distributions.json',E/'ppw-raw-runs.csv']}}
(P/'independent-data-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(bool(issues))
