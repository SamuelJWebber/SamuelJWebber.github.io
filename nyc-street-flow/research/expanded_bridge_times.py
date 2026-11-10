"""Fixed dock-pair/classic-member/time-window comparison around East River bridges.
Python3 + pandas2, numpy, scipy. Usage: python expanded_bridge_times.py INPUT_DIR OUTPUT_DIR
INPUT_DIR contains YYYYMM/month.csv files that are nested monthly ZIPs extracted from
https://s3.amazonaws.com/tripdata/2021-citibike-tripdata.zip and 2022-citibike-tripdata.zip.
These have a misleading .csv extension solely because of the cache downloader.
Construction began June21,2021. Primary windows Jan1-Jun20 2021 vs Jan1-Jun20 2022.
Results are elapsed dock-to-dock times for selected plausible routes, not observed routes,
door-to-door commutes, population trip times, or causal lane effects.
"""
import sys,json
from pathlib import Path
from zipfile import ZipFile
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import pandas as pd
from scipy.stats import t
ANCHORS={'Brooklyn':[(40.7124,-74.0046),(40.6957,-73.9894)],'Manhattan':[(40.7153,-73.9944),(40.7006,-73.9868)]}
COLS=['ride_id','started_at','ended_at','rideable_type','member_casual','start_station_id','end_station_id','start_station_name','end_station_name','start_lat','start_lng','end_lat','end_lng']
def distance(lat,lng,anchor):return np.hypot((lat-anchor[0])*111195,(lng-anchor[1])*111195*np.cos(np.deg2rad(40.7)))
def load_one(args):
    month,base,out=args; cache=out/f'rides-{month}.csv'
    if cache.exists():return pd.read_csv(cache,dtype={'start_station_id':str,'end_station_id':str})
    pieces=[]
    with ZipFile(base/month/'month.csv') as z:
      for member in z.namelist():
        if not member.endswith('.csv') or '__MACOSX' in member:continue
        with z.open(member) as f:
          for c in pd.read_csv(f,chunksize=125000,usecols=COLS,dtype={'start_station_id':'string','end_station_id':'string'}):
            c=c[c.rideable_type.eq('classic_bike')&c.member_casual.eq('member')&c.start_station_id.notna()&c.end_station_id.notna()&c.start_lat.between(40.68,40.73)&c.end_lat.between(40.68,40.73)&c.start_lng.between(-74.02,-73.97)&c.end_lng.between(-74.02,-73.97)].copy()
            if c.empty:continue
            st=pd.to_datetime(c.started_at,format='mixed');en=pd.to_datetime(c.ended_at,format='mixed')
            c['date']=st.dt.strftime('%Y-%m-%d');c['month']=st.dt.month;c['day']=st.dt.day;c['year']=st.dt.year
            c['minutes']=(en-st).dt.total_seconds()/60
            c['window']=np.select([st.dt.dayofweek>=5,st.dt.hour.between(7,9)|st.dt.hour.between(16,18)],['weekend','weekday_peak'],default='weekday_offpeak')
            for name,anchors in ANCHORS.items():
              other=ANCHORS['Manhattan' if name=='Brooklyn' else 'Brooklyn']
              for side in (0,1):
                ds=distance(c.start_lat,c.start_lng,anchors[side]);de=distance(c.end_lat,c.end_lng,anchors[1-side]);gs=distance(c.start_lat,c.start_lng,other[side])-ds;ge=distance(c.end_lat,c.end_lng,other[1-side])-de
                mask=(ds<=1000)&(de<=1000)&(gs>=250)&(ge>=250)
                if not mask.any():continue
                q=c.loc[mask,['ride_id','start_station_id','end_station_id','start_station_name','end_station_name','window','minutes','date','month','day','year','start_lat','start_lng','end_lat','end_lng']].copy()
                q['bridge']=name;q['maxd']=np.maximum(ds[mask],de[mask]);pieces.append(q)
    r=pd.concat(pieces,ignore_index=True) if pieces else pd.DataFrame()
    if len(r):assert not r.ride_id.duplicated().any()
    r.to_csv(cache,index=False);print('FILTERED',month,len(r),flush=True);return r

def calc(rides,radius=750,upper=90,minimum=3,months=None,drop_shifted=False,save=None,date_ranges=None):
    sel=rides[rides.maxd.le(radius)&rides.minutes.between(4,upper)].copy()
    if date_ranges is None:sel=sel[(sel.month<6)|sel.day.le(20)]
    if months is not None:sel=sel[sel.month.isin(months)]
    locs=[]
    for side in ['start','end']:
      part=sel[['year',side+'_station_id',side+'_lat',side+'_lng']].copy();part.columns=['year','station','lat','lng'];locs.append(part)
    loc=pd.concat(locs).groupby(['station','year'])[['lat','lng']].median().unstack('year').dropna()
    shifts=distance(loc['lat'][2022],loc['lng'][2022],(loc['lat'][2021],loc['lng'][2021]));bad=list(shifts[shifts>50].index)
    if drop_shifted:sel=sel[~sel.start_station_id.isin(bad)&~sel.end_station_id.isin(bad)]
    keys=['bridge','month','start_station_id','end_station_id','window']
    c=sel.groupby(keys+['year']).minutes.agg(n='size',mean='mean',median='median',p90=lambda x:x.quantile(.9)).unstack('year').dropna()
    c=c[(c['n']>=minimum).all(axis=1)]
    if c.empty:return {'status':'no_matched_cells'}
    tab=pd.DataFrame({f'{x}_{y}':c[x][y] for x in ['n','mean','median','p90'] for y in (2021,2022)})
    tab['weight']=tab.n_2021/tab.n_2021.groupby(level='bridge').transform('sum')
    names=sel.groupby(keys)[['start_station_name','end_station_name']].first();tab=tab.join(names)
    retained=sel.merge(tab.reset_index(),on=keys,validate='many_to_one')
    if save:tab.reset_index().to_csv(save,index=False)
    result={'settings':{'radius_m':radius,'duration_minutes':[4,upper],'minimum_each_year':minimum,'months':months or [1,2,3,4,5,6],'june_end_day':None if date_ranges else 20,'excluded_shifted_docks':bad if drop_shifted else []},'dock_check':{'over_50m_ids':bad,'largest_median_shift_m':float(shifts.max())}}
    scores={};means={}
    for bridge in ANCHORS:
      if bridge not in tab.index.get_level_values('bridge'):continue
      b=tab.loc[bridge]; rr=retained[retained.bridge.eq(bridge)]; allr=sel[sel.bridge.eq(bridge)]
      vals={x:[float((b.weight*b[f'{x}_{y}']).sum()) for y in (2021,2022)] for x in ['mean','median','p90']}
      means[bridge]=vals['mean'];scores[bridge]={}
      for y in (2021,2022):
        p=rr[rr.year.eq(y)].copy();p['influence']=p.weight*(p.minutes-p[f'mean_{y}'])/p[f'n_{y}']
        dates=pd.date_range(*(date_ranges[y] if date_ranges else (f'{y}-01-01',f'{y}-06-20')));dates=dates[dates.month.isin(months or [1,2,3,4,5,6])]
        scores[bridge][y]=p.groupby('date').influence.sum().reindex(dates.strftime('%Y-%m-%d'),fill_value=0)
      se=np.sqrt(sum(len(s)/(len(s)-1)*np.square(s).sum() for s in scores[bridge].values()));crit=t.ppf(.975,min(len(s) for s in scores[bridge].values())-1);delta=vals['mean'][1]-vals['mean'][0]
      diff=b.mean_2022-b.mean_2021;pw=b.n_2021.groupby(level=['start_station_id','end_station_id']).sum();pt=(diff*b.n_2021).groupby(level=['start_station_id','end_station_id']).sum();loo=((diff*b.n_2021).sum()-pt)/(b.n_2021.sum()-pw)
      result[bridge]={'eligible':[int(allr.year.eq(y).sum()) for y in (2021,2022)],'matched_rides':[int(b[f'n_{y}'].sum()) for y in (2021,2022)],'matched_cells':len(b),'matched_dock_pairs':len(b.reset_index()[['start_station_id','end_station_id']].drop_duplicates()),'weighted_mean_minutes':vals['mean'],'mean_change_minutes':delta,'weighted_within_cell_median_minutes':vals['median'],'weighted_within_cell_p90_minutes':vals['p90'],'conditional_cluster95_minutes':[float(delta-crit*se),float(delta+crit*se)],'cluster_se':float(se),'leave_one_dock_pair_out_mean_change_range':[float(loo.min()),float(loo.max())]}
    if len(means)==2:
      diff=np.diff(means['Brooklyn'])[0]-np.diff(means['Manhattan'])[0];s={y:scores['Brooklyn'][y]-scores['Manhattan'][y] for y in (2021,2022)};se=np.sqrt(sum(len(v)/(len(v)-1)*np.square(v).sum() for v in s.values()));crit=t.ppf(.975,min(len(v) for v in s.values())-1)
      result['Brooklyn_minus_Manhattan']={'mean_change_minutes':float(diff),'conditional_cluster95_minutes':[float(diff-crit*se),float(diff+crit*se)],'cluster_se':float(se)}
    return result

def finite(obj):
    if isinstance(obj,dict):return {k:finite(v) for k,v in obj.items()}
    if isinstance(obj,list):return [finite(v) for v in obj]
    if isinstance(obj,float) and not np.isfinite(obj):return None
    return obj

if __name__=='__main__':
    base,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
    months=[f'{y}{m:02d}' for y in (2021,2022) for m in range(1,7)]
    with ThreadPoolExecutor(4) as pool:rides=pd.concat(pool.map(load_one,[(m,base,out) for m in months]),ignore_index=True)
    assert not rides.ride_id.duplicated().any()
    results={'source_urls':['https://citibikenyc.com/system-data','https://s3.amazonaws.com/tripdata/2021-citibike-tripdata.zip','https://s3.amazonaws.com/tripdata/2022-citibike-tripdata.zip'],'periods':['2021-01-01/2021-06-20','2022-01-01/2022-06-20'],'primary':calc(rides,save=out/'expanded-time-cells.csv'),'monthly':{str(m):calc(rides,months=[m]) for m in range(1,7)},'sensitivities':{f'{r}m_{u}min_min{n}':calc(rides,r,u,n) for r,u,n in [(500,90,3),(1000,90,3),(750,60,3),(750,120,3),(750,90,1),(750,90,5)]},'excluding_moved_docks':calc(rides,drop_shifted=True),'limitations':['Actual route and rider identity unobserved.','Classic member trips only; excludes e-bikes and casual riders.','Month/OD/time-window mix held at 2021 weights among cells with at least three rides in each year.','Intervals cluster by date, preserving shared-date covariance across bridges, and condition on chosen cells and baseline weights. They do not cover selection, routing, pandemic or causal-identification uncertainty.','Neighboring Manhattan Bridge can receive or lose diverted trips and is not an assured untreated control.','No weather adjustment or 12-month preperiod has been completed.','Times include rental stops and docking but exclude walking, waiting to obtain a bike, and destination access.']}
    (out/'expanded-times.json').write_text(json.dumps(finite(results),indent=2,allow_nan=False));print(json.dumps(results['primary'],indent=2))
