#!/usr/bin/env python3
"""Reproduce descriptive PPW distributions and sensitivity-panel inputs.
Run from any directory. Inputs are bundled alongside this script. No network required.
"""
import csv, hashlib, json, math
from collections import defaultdict
from pathlib import Path
HERE = Path(__file__).resolve().parent
WINDOWS = {'daily_07_19': (7,19), 'am_07_10': (7,10), 'midday_10_14': (10,14), 'pm_16_19': (16,19)}

def quantile(values, p):
    values = sorted(values)
    if not values: return None
    q = (len(values)-1)*p
    lo, hi = math.floor(q), math.ceil(q)
    return values[lo] + (values[hi]-values[lo])*(q-lo)

def stats(rows):
    v=sorted(float(r['total_seconds']) for r in rows)
    return {'n':len(v), 'mean_seconds':sum(v)/len(v), 'min_seconds':min(v), 'p25_seconds':quantile(v,.25), 'median_seconds':quantile(v,.5), 'p75_seconds':quantile(v,.75), 'p90_seconds':quantile(v,.9), 'max_seconds':max(v), 'values_seconds':v}

def main():
    raw = list(csv.DictReader((HERE/'ppw-raw-runs.csv').open()))
    weekday = [r for r in raw if r['weekday'] in ['Tuesday','Wednesday']]
    assert len(raw)==416 and len(weekday)==384
    daily=[]; pooled=[]
    for route in ['PPW','6 Ave','7 Ave','8 Ave']:
      for window,(start,end) in WINDOWS.items():
        chosen=[r for r in weekday if r['route']==route and start<=int(r['hour'])<end]
        for date in sorted(set(r['date'] for r in chosen)):
          rows=[r for r in chosen if r['date']==date]
          daily.append({'route':route,'window':window,'date':date,'weekday':rows[0]['weekday'],'period':rows[0]['period'],**stats(rows)})
        for period in ['before','after']:
          rows=[r for r in chosen if r['period']==period]
          pooled.append({'route':route,'window':window,'period':period,**stats(rows)})
    originals=json.loads((HERE/'ppw-times.json').read_text())
    for row in originals['summaries']:
      for period in ['before','after']:
        stat=next(r for r in pooled if r['route']==row['route'] and r['window']==row['window'] and r['period']==period)
        assert abs(stat['mean_seconds']-row[period+'_mean_seconds'])<1e-9
    data={'title':'PPW observed-run distributions, four survey weekdays', 'source':'https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf', 'raw_rows':len(raw),'weekday_rows':len(weekday),'quantile_method':'Linear interpolation at (n-1)*p (Hyndman-Fan type 7). Quantiles describe observed runs; not confidence intervals.', 'limitations':['Two Tuesdays and two Wednesdays, with only two survey days per wave. No inference about day-to-day reliability.','Repeated runs within a day are not independent policy experiments.','Road segment times, not complete journey times.','P90 for six peak-period runs is interpolated from the two slowest observed runs; highly unstable.','Before May 11-12 and after October 19-20, 2010. Saturday runs excluded for aligned weekday comparison.'], 'per_day':daily,'pooled_wave':pooled,'input_sha256':{n:hashlib.sha256((HERE/n).read_bytes()).hexdigest() for n in ['ppw-raw-runs.csv','ppw-times.json','third-avenue-analysis.json','flow-sensitivity.json']}}
    (HERE/'distributions.json').write_text(json.dumps(data,indent=2)+'\n')
    for name,rows in [('per-day-distributions.csv',daily),('pooled-wave-distributions.csv',pooled)]:
      fields=[k for k in rows[0] if k!='values_seconds']
      with (HERE/name).open('w',newline='') as f:
        w=csv.DictWriter(f,fields,extrasaction='ignore');w.writeheader();w.writerows(rows)
    estimates=[]
    for r in originals['controlled_changes']:
      for sample,field in [('both_days','controlled_change_seconds'),('tuesday','Tuesday_controlled_change_seconds'),('wednesday','Wednesday_controlled_change_seconds')]:
        estimates.append({'study':'PPW driving segment','window':r['window'],'control':r['control'],'sample':sample,'change_seconds':r[field],'pre_placebo_seconds':None})
    bus=json.loads((HERE/'third-avenue-analysis.json').read_text())
    for r in bus['estimates']:
      for sample,field in [('jan_jun','did_seconds_over_treated_segment'),('jan_mar','q1_only_did_seconds_treated_segment'),('apr_jun','q2_only_did_seconds_treated_segment')]:
        estimates.append({'study':'Third Avenue bus segment','window':r['period'],'control':r['control'],'sample':sample,'change_seconds':r[field],'pre_placebo_seconds':r['pre_placebo_seconds_over_treated_segment']})
    (HERE/'specifications.json').write_text(json.dumps(estimates,indent=2)+'\n')
    with (HERE/'specifications.csv').open('w',newline='') as f:
      w=csv.DictWriter(f,estimates[0].keys());w.writeheader();w.writerows(estimates)
    checks={'raw_rows':len(raw),'weekday_rows':len(weekday),'per_day_groups':len(daily),'pooled_groups':len(pooled),'original_aggregate_means_reproduced':True,'specifications':len(estimates),'quantile_unit_checks': quantile([0,10],.9)==9 and quantile([1,3,5],.5)==3, 'note':'Deterministic arithmetic validation, not causal validity.'}
    assert checks['quantile_unit_checks']
    (HERE/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
    print(json.dumps(checks))
if __name__=='__main__':main()
