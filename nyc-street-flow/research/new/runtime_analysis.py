"""Reproduce matched MTA end-to-end subway runtime comparisons.
Python 3 standard library only. Run: python runtime_analysis.py [--refresh]
Writes only alongside this script. Public datasets: sp9g-mzjh, tdmq-asac, 39hk-dx4f.
"""
import argparse,collections,csv,datetime,hashlib,json,pathlib,urllib.parse,urllib.request,time,concurrent.futures
P=pathlib.Path(__file__).resolve().parent
YEARS=[2019,2021,2022,2024,2026]; BASE=2019
BROOKLYN_LINES=['2','3','4','5','A','B','C','D','F','G','J','L','M','N','Q','R','FS']
PERIODS={'am_peak':['AM peak'],'pm_peak':['PM peak'],'midday':['midday'],'evening':['evening'],'overnight':['overnight'],'peak_combined':['AM peak','PM peak'],'all_periods':['AM peak','PM peak','midday','evening','overnight']}
PERIOD_LABELS={'am_peak':'AM peak: first departure 06:00–08:59','pm_peak':'PM peak: first departure 15:00–18:59','midday':'Midday: 09:00–14:59','evening':'Evening: 19:00–22:59','overnight':'Overnight: 23:00–05:59','peak_combined':'AM 06:00–09:00 plus PM 15:00–19:00','all_periods':'All five departure periods'}
SCOPES={'brooklyn_manhattan':'Paths with stops in both Brooklyn and Manhattan','brooklyn_serving':'Paths with at least one Brooklyn stop'}

def fetch(name,ds,params=None,refresh=False):
 f=P/(name+'.json');mf=P/(name+'-manifest.json')
 if f.exists() and not refresh:return json.loads(f.read_text())
 url=('https://data.ny.gov/resource/'+ds+'.json?'+urllib.parse.urlencode(params)) if params else 'https://data.ny.gov/api/views/'+ds+'.json'
 for a in range(3):
  try:
   with urllib.request.urlopen(url,timeout=180) as response:b=response.read()
   v=json.loads(b);f.write_bytes(b)
   mf.write_text(json.dumps({'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'records':len(v) if isinstance(v,list) else None},indent=2))
   return v
  except Exception:
   if a==2:raise
   time.sleep(1)

def fnum(r,k):
 try:return float(r[k])
 except (KeyError,TypeError,ValueError):return None

def wm(rows,col,weight='actual_trains'):
 v=[r for r in rows if r.get(col) is not None and r.get(weight,0)>0]
 n=sum(r[weight] for r in v)
 return sum(r[col]*r[weight] for r in v)/n if n else None

def scheduled_diagnostic(rows):
 # This is a sample diagnostic, never a service-delivery or cancellation rate.
 valid=[r for r in rows if r.get('scheduled_trains') and r.get('scheduled_minutes') is not None]
 actual=sum(r['actual_trains'] for r in valid);scheduled=sum(r['scheduled_trains'] for r in valid)
 return {'actual_on_scheduled_paths':actual,'scheduled_trains':scheduled,'actual_to_scheduled_ratio':actual/scheduled if scheduled else None}

def rounded(v):
 if isinstance(v,float):return round(v,8)
 if isinstance(v,dict):return {k:rounded(x) for k,x in v.items()}
 if isinstance(v,list):return [rounded(x) for x in v]
 return v

def csvwrite(name,rows):
 if not rows:return
 keys=list(dict.fromkeys(k for r in rows for k in r))
 with (P/name).open('w',newline='') as fp:
  w=csv.DictWriter(fp,fieldnames=keys);w.writeheader()
  for r in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else rounded(v) for k,v in r.items()})

def main(refresh=False):
 where="schedule_day_type='Weekday' AND date_extract_y(month) in (2019,2021,2022,2024,2026)"
 tasks=[('runtime_raw','sp9g-mzjh',{'$where':where,'$order':'month,line,direction,time_period,stop_path_id','$limit':100000}),('paths_raw','tdmq-asac',{'$select':'stop_path_id,stop_order,station_id','$order':'stop_path_id,stop_order','$limit':200000}),('runtime_count','sp9g-mzjh',{'$where':where,'$select':'count(*) as rows'}),('path_count','tdmq-asac',{'$select':'count(*) as rows,count(distinct stop_path_id) as paths'}),('stations','39hk-dx4f',{'$limit':1000}),('runtime_metadata','sp9g-mzjh',None),('paths_metadata','tdmq-asac',None)]
 with concurrent.futures.ThreadPoolExecutor(5) as ex:res=list(ex.map(lambda t:fetch(*t,refresh=refresh),tasks))
 raw,pr,count,pc,stations,meta,pmeta=res
 assert len(raw)==int(count[0]['rows']), 'Runtime download truncated'
 assert len(pr)==int(pc[0]['rows']), 'Path download truncated'
 assert len(raw)<100000 and len(pr)<200000,'Increase page limits or paginate'
 st={s['gtfs_stop_id']:s for s in stations};paths=collections.defaultdict(list)
 for r in pr:paths[r['stop_path_id']].append((int(r['stop_order']),r['station_id']))
 paths={k:tuple(x[1] for x in sorted(v)) for k,v in paths.items()}
 assert all(s in st for seq in paths.values() for s in seq), 'Unmapped station'
 assert all(r['stop_path_id'] in paths for r in raw),'Unmapped path'
 max2026=max(int(r['month'][5:7]) for r in raw if r['month'].startswith('2026'))
 windows={'same_months_ytd':list(range(1,max2026+1)),'june':[6],'latest_month':[max2026]}
 rawkeys=set();md=collections.defaultdict(set);groups=collections.defaultdict(list);pathinfo={};aliases=collections.defaultdict(set)
 for r in raw:
  rk=(r['month'],r['line'],r['direction'],r['time_period'],r['stop_path_id'])
  assert rk not in rawkeys,'Duplicate source aggregation key'
  rawkeys.add(rk)
  if r['line'] not in BROOKLYN_LINES:continue
  seq=paths[r['stop_path_id']];assert len(seq)==int(r['number_of_stops'])
  md[r['stop_path_id']].add(tuple(r[k] for k in ['number_of_stops','origin_station_id','destination_station_id','distance','line','direction']))
  boroughs=sorted(set(st[s]['borough'] for s in seq))
  if 'Bk' not in boroughs:continue
  can=r['line']+'-'+r['direction']+'-'+hashlib.sha256('|'.join(seq).encode()).hexdigest()[:12]
  aliases[can].add(r['stop_path_id'])
  pathinfo[can]={'canonical_path':can,'line':r['line'],'direction':r['direction'],'origin':r['origin_station_name'],'destination':r['destination_station_name'],'number_of_stops':len(seq),'distance_miles':float(r['distance']),'boroughs':boroughs,'station_ids':list(seq),'station_names':[st[s]['stop_name'] for s in seq]}
  k=(int(r['month'][:4]),int(r['month'][5:7]),r['line'],r['direction'],r['time_period'],can)
  nr=dict(r)
  for field in ['average_actual_runtime','average_scheduled_runtime','actual_trains','scheduled_trains','_25th_percentile_runtime','_50th_percentile_runtime','_75th_percentile_runtime']:
   nr[field]=fnum(r,field)
  assert nr['actual_trains']>0 and nr['average_actual_runtime']>0
  groups[k].append(nr)
 assert all(len(v)==1 for v in md.values()),'Path geometry metadata changes across years'
 rows=[]
 for (y,m,line,direction,period,can),rs in groups.items():
  actual=sum(x['actual_trains'] for x in rs)
  sched=[x for x in rs if x['average_scheduled_runtime'] is not None and (x['scheduled_trains'] or 0)>0]
  # Aliases with exactly identical line, direction, ordered stops are combined; no approximate path matching.
  row=dict(year=y,month=m,line=line,direction=direction,time_period=period,canonical_path=can,actual_trains=actual,actual_minutes=wm(rs,'average_actual_runtime'),scheduled_minutes=wm(sched,'average_scheduled_runtime','scheduled_trains'),scheduled_trains=sum(x['scheduled_trains'] for x in sched) if sched else None,official_stop_path_ids=sorted(x['stop_path_id'] for x in rs),brooklyn_manhattan='M' in pathinfo[can]['boroughs'])
  rows.append(row)
 rows.sort(key=lambda r:(r['year'],r['month'],r['line'],r['direction'],r['time_period'],r['canonical_path']))
 csvwrite('runtime-tidy.csv',rows)
 csvwrite('runtime-paths.csv',[dict(**v,official_stop_path_ids=sorted(aliases[k])) for k,v in sorted(pathinfo.items())])
 # Key includes matching calendar month, exact ordered stops, direction and departure-period bucket.
 def key(r):return (r['month'],r['line'],r['direction'],r['time_period'],r['canonical_path'])
 lookup={y:{} for y in YEARS}
 for r in rows:lookup[r['year']][key(r)]=r
 assert sum(len(v) for v in lookup.values())==len(rows)
 def eligible(y,scope,line,period,months):
  return {k:r for k,r in lookup[y].items() if r['month'] in months and (line=='ALL' or r['line']==line) and r['time_period'] in PERIODS[period] and (scope!='brooklyn_manhattan' or r['brooklyn_manhattan'])}
 def fixed_value(yr,common,weights,metric):
  denominator=sum(weights[k] for k in common)
  return sum(weights[k]*yr[k][metric] for k in common)/denominator if denominator else None
 lineopts={scope:[l for l in BROOKLYN_LINES if any(r['line']==l and (scope!='brooklyn_manhattan' or r['brooklyn_manhattan']) for r in rows)] for scope in SCOPES}
 balanced=[];pairs=[];monthly=[]
 def pair_record(scope,line,period,window,months,b,t):
  B=eligible(b,scope,line,period,months);T=eligible(t,scope,line,period,months);common=B.keys()&T.keys()
  bn=sum(r['actual_trains'] for r in B.values());tn=sum(r['actual_trains'] for r in T.values())
  weights={k:B[k]['actual_trains'] for k in common};mb=sum(weights.values());mt=sum(T[k]['actual_trains'] for k in common)
  ba=fixed_value(B,common,weights,'actual_minutes');ta=fixed_value(T,common,weights,'actual_minutes')
  rawb=wm(list(B.values()),'actual_minutes');rawt=wm(list(T.values()),'actual_minutes');rawmt=wm([T[k] for k in common],'actual_minutes')
  sc={k for k in common if B[k]['scheduled_minutes'] is not None and T[k]['scheduled_minutes'] is not None}
  bs=mb/bn if bn else 0;ts=mt/tn if tn else 0
  result=dict(scope=scope,line=line,period=period,window=window,months=months,baseline_year=b,target_year=t,matched_cells=len(common),matched_paths=len({k[-1] for k in common}),baseline_published_trains=bn,target_published_trains=tn,baseline_matched_trains=mb,target_matched_trains=mt,baseline_matched_share=bs,target_matched_share=ts,fixed_baseline_minutes=ba,fixed_target_minutes=ta,fixed_change_minutes=ta-ba if ba is not None else None,fixed_change_pct=100*(ta/ba-1) if ba else None,raw_baseline_minutes=rawb,raw_target_minutes=rawt,raw_change_minutes=rawt-rawb if rawb is not None and rawt is not None else None,raw_change_pct=100*(rawt/rawb-1) if rawb and rawt is not None else None,target_matched_actual_weight_minutes=rawmt,target_mix_minus_fixed_minutes=rawmt-ta if rawmt is not None and ta is not None else None,scheduled_support_weight_share=sum(weights[k] for k in sc)/mb if mb else None,fixed_scheduled_baseline_minutes=fixed_value(B,sc,weights,'scheduled_minutes'),fixed_scheduled_target_minutes=fixed_value(T,sc,weights,'scheduled_minutes'),coverage_flag='no_common_support' if not common else ('low_coverage' if min(bs,ts)<.5 else 'partial_coverage' if min(bs,ts)<.8 else 'high_coverage'))
  for prefix,bucket in [('baseline',B),('target',T)]:
   result.update({prefix+'_'+k:v for k,v in scheduled_diagnostic(list(bucket.values())).items()})
  result['low_retained_actual_to_schedule']=any(result[k] is not None and result[k]<.6 for k in ['baseline_actual_to_scheduled_ratio','target_actual_to_scheduled_ratio'])
  return result
 for scope in SCOPES:
  for line in ['ALL']+lineopts[scope]:
   for period in PERIODS:
    for window,months in windows.items():
     buckets={y:eligible(y,scope,line,period,months) for y in YEARS}
     common=set.intersection(*(set(v) for v in buckets.values()));weights={k:buckets[BASE][k]['actual_trains'] for k in common};basevalue=fixed_value(buckets[BASE],common,weights,'actual_minutes')
     for y in YEARS:
      Y=buckets[y];n=sum(r['actual_trains'] for r in Y.values());nm=sum(Y[k]['actual_trains'] for k in common);a=fixed_value(Y,common,weights,'actual_minutes')
      balanced.append(dict(scope=scope,line=line,period=period,window=window,months=months,year=y,baseline_year=BASE,matched_cells=len(common),matched_paths=len({k[-1] for k in common}),published_trains=n,matched_trains=nm,matched_share=nm/n if n else None,fixed_actual_minutes=a,change_minutes=a-basevalue if a is not None else None,change_pct=100*(a/basevalue-1) if basevalue else None,raw_actual_minutes=wm(list(Y.values()),'actual_minutes'),baseline_weight_trains=sum(weights.values()),**scheduled_diagnostic(list(Y.values()))))
     for b,t in [(2019,2021),(2019,2022),(2019,2024),(2019,2026),(2021,2022)]:pairs.append(pair_record(scope,line,period,window,months,b,t))
    if period in ['am_peak','pm_peak','peak_combined']:
     for m in range(1,max2026+1):
      for b,t in [(2019,2026),(2021,2022)]:monthly.append(pair_record(scope,line,period,'calendar_month',[m],b,t))
 # Representative June AM paths: largest baseline train count among cells shared in all five years, one per line/direction.
 examples=[]
 for line in lineopts['brooklyn_manhattan']:
  for direction in ['N','S']:
   sets=[set(eligible(y,'brooklyn_manhattan',line,'am_peak',[6])) for y in YEARS]
   common=set.intersection(*sets);common={k for k in common if k[2]==direction}
   if not common:continue
   k=max(common,key=lambda k:lookup[BASE][k]['actual_trains'])
   examples.append(dict(**pathinfo[k[-1]],period='am_peak',month=6,official_stop_path_ids=sorted(aliases[k[-1]]),selection='Largest 2019 June AM train count among this line/direction cells shared in all five selected years',values=[dict(year=y,actual_minutes=lookup[y][k]['actual_minutes'],actual_trains=lookup[y][k]['actual_trains'],scheduled_minutes=lookup[y][k]['scheduled_minutes']) for y in YEARS]))
 csvwrite('runtime-pairwise-comparisons.csv',pairs);csvwrite('runtime-balanced-series.csv',balanced);csvwrite('runtime-monthly-comparisons.csv',monthly)
 # Small evidence tables for review; full line/period/window selectors supplied in arrays above.
 headlines=[r for r in pairs if r['scope']=='brooklyn_manhattan' and r['line'] in ['ALL','L','R','J','C','Q','F'] and r['period']=='peak_combined' and ((r['baseline_year']==2021 and r['window']=='june') or (r['target_year']==2026 and r['window']=='same_months_ytd'))]
 coverage={'source_runtime_rows':len(raw),'source_path_stop_rows':len(pr),'source_unique_paths':int(pc[0]['paths']),'source_duplicate_keys':0,'unmapped_runtime_paths':0,'unmapped_station_ids':0,'included_tidy_cells':len(rows),'included_unique_canonical_paths':len(pathinfo),'canonical_paths_with_multiple_official_ids':sum(len(a)>1 for a in aliases.values()),'latest_month_2026':max2026,'latest_published_month':'2026-%02d'%max2026,'source_metadata_updated_utc':datetime.datetime.fromtimestamp(meta['rowsUpdatedAt'],datetime.timezone.utc).isoformat()}
 methods={
 'unit':'Minutes per train end-to-end on published revenue-service patterns; fixed baseline train-count weighting.',
 'match_key':['Calendar month','Reporting line','Railroad direction','Departure time period','Exact ordered GTFS stop sequence'],
 'scope':'Primary scope requires the exact service path to stop in both Brooklyn and Manhattan. Runtime is still the full train path, which may extend into Queens or Bronx; it is not only the East River crossing or a Brooklyn–Manhattan passenger journey.',
 'pairwise':'Within each requested line/period/month window, intersect cells in baseline and target years. Normalize baseline actual_trains on that intersection and apply the same weights to both actual runtime means. Pairwise baskets can differ by year pair; do not splice them into a fixed-basket time series.',
 'balanced_series':'Intersect exact cells across all five selected years. Hold 2019 actual train weights fixed for all five. Month is part of the key, fixing season and baseline month weights. No support yields null, never zero.',
 'raw_comparator':'Each year’s actual_train-weighted mean over all eligible published paths in the same calendar months. Differences combine runtime, route length, service pattern and train-weight changes, so raw means are a composition diagnostic.',
 'coverage':'Matched share is matched actual_trains / all eligible published actual_trains for that scope, line, period and calendar-month window. It is not coverage of all trains that operated; source exclusions apply. Both baseline and target shares are supplied.',
 'actual_scheduled_diagnostic':'Sum retained actual_trains and scheduled_trains for eligible published cells with a valid schedule. Their ratio is only a diagnostic: missing observations, source filtering, schedule differences and actual service can all affect it. It is not a cancellation rate, a service-delivery measure, or proof of complete actual-data capture. Some June 2021 B Division lines have ratios near one third; matching their published paths does not repair this possible sample selection.',
 'aliases':'Combine official path IDs only if reporting line, direction and every ordered GTFS stop match exactly. Alias runtime means use actual train counts; schedule means use scheduled train counts. No approximate stop or endpoint-only matching.',
 'schedule_comparison':'Schedule means use baseline actual-train weights on matched cells with valid schedules in both years; scheduled_support_weight_share identifies this possibly smaller support. These are schedules, distinct from actual runtimes.',
 'missingness':'Source excludes cancellations, unscheduled skips/reroutes, trips >=250 min, very small/implausible path samples, missing distance, most <3-stop patterns and unmatched L schedules; no missing value is treated as zero.',
 'time_periods':PERIOD_LABELS,
 'inference_limits':['Train-weighted, not passenger-weighted or door-to-door; excludes platform wait, access walk, transfer wait and terminal layover, includes intermediate station dwell.','Weekday is schedule day type; some holidays use weekend schedules.','MTA timestamps derive from calibrated ATS/PLC/CBTC/beacon/I-TRAC observations with corrections/interpolation. B Division sources changed around 2019–2020; before/after is not pure mechanical performance change.','No causal lane-conversion effect or individual modal substitution is estimated. Runtime periods differ from OD AM 07–10 and PM16–19, so they are not merged.','Aggregated means cannot provide trip-level variance or valid sampling confidence intervals; weighted path quantiles are not reported as system quantiles.']}
 sources={'runtime':'https://data.ny.gov/d/sp9g-mzjh','paths':'https://data.ny.gov/d/tdmq-asac','stations':'https://data.ny.gov/d/39hk-dx4f','runtime_overview':'https://data.ny.gov/api/views/sp9g-mzjh/files/60d0d13e-fb31-44c7-875c-3052a0242042?download=true&filename=MTA_SubwayEndToEndRunningTimes_Overview.pdf'}
 out={'metadata':{'title':'Matched actual subway runtimes','analysis_date_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'years':YEARS,'baseline_year':BASE,'latest_month':'2026-%02d'%max2026,'default_scope':'brooklyn_manhattan','default_line':'L','default_period':'peak_combined','default_window':'same_months_ytd','source_urls':sources,'source_data_note':'Latest available published month September 2026. No claim that source retains every operated train.'},'selectors':{'scopes':SCOPES,'lines':lineopts,'periods':PERIOD_LABELS,'windows':{k:{'months':v,'label':'January–September' if k=='same_months_ytd' else 'June' if k=='june' else 'September (latest published)'} for k,v in windows.items()}},'methods':methods,'coverage':coverage,'headline_comparisons':headlines,'pairwise_comparisons':pairs,'balanced_series':balanced,'monthly_comparisons':monthly,'representative_paths':examples}
 # Keep the app-facing artifact focused; full scopes/periods/windows remain in tidy CSVs.
 app_periods=['am_peak','pm_peak','peak_combined'];app_windows=['same_months_ytd','june']
 out['selectors']['scopes']={'brooklyn_manhattan':SCOPES['brooklyn_manhattan']}
 out['selectors']['lines']={'brooklyn_manhattan':lineopts['brooklyn_manhattan']}
 out['selectors']['periods']={k:PERIOD_LABELS[k] for k in app_periods}
 out['selectors']['windows']={k:v for k,v in out['selectors']['windows'].items() if k in app_windows}
 out['pairwise_comparisons']=[r for r in pairs if r['scope']=='brooklyn_manhattan' and r['period'] in app_periods and r['window'] in app_windows]
 out['balanced_series']=[r for r in balanced if r['scope']=='brooklyn_manhattan' and r['period'] in app_periods and r['window'] in app_windows]
 out['monthly_comparisons']=[r for r in monthly if r['scope']=='brooklyn_manhattan' and r['period']=='peak_combined']
 (P/'runtime-analysis.json').write_text(json.dumps(rounded(out),ensure_ascii=False,separators=(',',':')))
 (P/'runtime-methods.json').write_text(json.dumps({'methods':methods,'coverage':coverage,'sources':sources},ensure_ascii=False,indent=2))
 print(json.dumps(rounded({'coverage':coverage,'headlines':headlines}),indent=2),flush=True)
if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--refresh',action='store_true');args=ap.parse_args();main(args.refresh)
