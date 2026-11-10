"""Classic Citi Bike member rides around two East River bridge approaches.
Requires Python 3, pandas 2+ and NumPy. Extract the June ZIP from each annual archive
(https://s3.amazonaws.com/tripdata/2021-citibike-tripdata.zip and .../2022-citibike-tripdata.zip).
Usage: python bridge_bike_times.py 202106-citibike-tripdata.zip 202206-citibike-tripdata.zip [cells.csv]
Prints JSON with both primary estimates and robustness checks. Docks imply plausible routes only.
"""
import json
import sys
from zipfile import ZipFile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import pandas as pd

YEARS = [2021, 2022]
# Fixed approximate approach points. West = Manhattan, east = Brooklyn.
ANCHORS = {'Brooklyn': [(40.7124, -74.0046), (40.6957, -73.9894)],
           'Manhattan': [(40.7153, -73.9944), (40.7006, -73.9868)]}
COLUMNS = ['ride_id','started_at','ended_at','rideable_type','member_casual','start_station_id','end_station_id',
           'start_station_name','end_station_name','start_lat','start_lng','end_lat','end_lng']

def distance(lat, lng, anchor):
    return np.hypot((lat-anchor[0])*111195, (lng-anchor[1])*111195*np.cos(np.deg2rad(40.7)))

def load_month(item):
    year, filename = item
    result = []
    with ZipFile(filename) as z:
        for member in z.namelist():
            if not member.endswith('.csv') or '__MACOSX' in member: continue
            with z.open(member) as f:
                for c in pd.read_csv(f, chunksize=125000, usecols=COLUMNS, dtype={'start_station_id':'string','end_station_id':'string'}):
                    c = c[c.rideable_type.eq('classic_bike') & c.member_casual.eq('member') & c.start_station_id.notna() & c.end_station_id.notna() & c.started_at.str.slice(0,10).between(f'{year}-06-01',f'{year}-06-20') & c.start_lat.between(40.68,40.73) & c.end_lat.between(40.68,40.73) & c.start_lng.between(-74.02,-73.97) & c.end_lng.between(-74.02,-73.97)].copy()
                    if c.empty: continue
                    start = pd.to_datetime(c.started_at,format='mixed'); end = pd.to_datetime(c.ended_at,format='mixed')
                    c['calendar_day'] = start.dt.day
                    c['minutes'] = (end-start).dt.total_seconds()/60
                    c['window'] = np.select([start.dt.dayofweek>=5, start.dt.hour.between(7,9) | start.dt.hour.between(16,18)], ['weekend','weekday_peak'], default='weekday_offpeak')
                    for bridge, anchors in ANCHORS.items():
                        other = ANCHORS['Manhattan' if bridge=='Brooklyn' else 'Brooklyn']
                        for side in (0, 1):
                            d_start = distance(c.start_lat,c.start_lng,anchors[side]); d_end = distance(c.end_lat,c.end_lng,anchors[1-side]);
                            gap_start = distance(c.start_lat,c.start_lng,other[side])-d_start
                            gap_end = distance(c.end_lat,c.end_lng,other[1-side])-d_end
                            mask = (d_start<=1000)&(d_end<=1000)&(gap_start>=250)&(gap_end>=250)
                            if not mask.any():continue
                            take = c.loc[mask,['ride_id','start_station_id','end_station_id','start_station_name','end_station_name','window','minutes','calendar_day','start_lat','start_lng','end_lat','end_lng']].copy()
                            take['bridge']=bridge;take['year']=year;take['maxd']=np.maximum(d_start[mask],d_end[mask]);result.append(take)
    out=pd.concat(result,ignore_index=True); assert not out.ride_id.duplicated().any();return out

def estimates(rides, radius=750, end=90, min_per_year=3):
    selected = rides[rides.maxd.le(radius)&rides.minutes.between(4,end)]
    report={}
    for bridge in ANCHORS:
        group = selected[selected.bridge.eq(bridge)]
        cells = ['start_station_id','end_station_id','window']
        # Shorter/longer trips within the broad elapsed time bounds count in the means.
        stats = group.groupby(cells+['year']).minutes.agg(['mean','size','median']).unstack('year').dropna()
        m=stats[(stats['size']>=min_per_year).all(axis=1)]
        if m.empty:continue
        weights = m['size'][2021]; means=[float(np.average(m['mean'][y],weights=weights)) for y in YEARS]
        diffs=m['mean'][2022]-m['mean'][2021]
        pair_weights=weights.groupby(level=[0,1]).sum();pair_totals=(diffs*weights).groupby(level=[0,1]).sum()
        excluded=(np.dot(diffs,weights)-pair_totals)/(weights.sum()-pair_weights)
        median_change=float(np.average(m['median'][2022]-m['median'][2021],weights=weights))
        report[bridge]={'leave_one_station_pair_out_change_range':[float(excluded.min()),float(excluded.max())], 'weighted_within_cell_median_change':median_change, 'eligible_before_after':[int(group.year.eq(y).sum()) for y in YEARS], 'matched_before_after':[int(m['size'][y].sum()) for y in YEARS],
          'matched_ordered_station_pairs':int(len(set(tuple(x[:2]) for x in m.index))),'matched_pair_time_cells':len(m),'mean_minutes':means,'change':means[1]-means[0],
          'unadjusted_group_medians':[float(group.loc[group.year.eq(y),'minutes'].median()) for y in YEARS]}
    if len(report)==2:report['brooklyn_minus_manhattan_change']=report['Brooklyn']['change']-report['Manhattan']['change']
    return report

def primary_uncertainty(rides, csv_path=None):
    # The support and baseline cell weights are held fixed in these conditional sampling intervals.
    selected=rides[rides.maxd.le(750) & rides.minutes.between(4,90)].copy()
    keys=['bridge','start_station_id','end_station_id','window']
    cells=selected.groupby(keys+['year']).minutes.agg(['size','mean']).unstack('year').dropna()
    cells=cells[(cells['size']>=3).all(axis=1)]
    retained=selected.set_index(keys).loc[cells.index].reset_index()
    table=pd.DataFrame({'n_2021':cells['size'][2021].astype(int),'n_2022':cells['size'][2022].astype(int),
                        'mean_min_2021':cells['mean'][2021],'mean_min_2022':cells['mean'][2022]})
    table['weight_2021']=table.n_2021/table.n_2021.groupby(level='bridge').transform('sum')
    names=retained.groupby(keys)[['start_station_name','end_station_name']].first()
    table=table.join(names)
    if csv_path:table.reset_index().to_csv(csv_path,index=False)
    scores={name:{} for name in ANCHORS};means={name:{} for name in ANCHORS}
    for y in YEARS:
        part=retained.loc[retained.year.eq(y)].merge(table.reset_index(),on=keys,validate='many_to_one')
        part['influence']=part.weight_2021*(part.minutes-part[f'mean_min_{y}'])/part[f'n_{y}']
        for name in ANCHORS:
            days=part.loc[part.bridge.eq(name)].groupby('calendar_day').influence.sum().reindex(range(1,21),fill_value=0)
            assert abs(days.sum())<1e-9
            scores[name][y]=days.to_numpy();t=table.loc[name];means[name][y]=(t.weight_2021*t[f'mean_min_{y}']).sum()
    scores['Brooklyn_minus_Manhattan']={y:scores['Brooklyn'][y]-scores['Manhattan'][y] for y in YEARS}
    means['Brooklyn_minus_Manhattan']={y:means['Brooklyn'][y]-means['Manhattan'][y] for y in YEARS}
    result={}
    for name in scores:
        delta=means[name][2022]-means[name][2021]
        se=np.sqrt(sum(20/19*np.sum(scores[name][y]**2) for y in YEARS))
        # t(19) critical value; 20 date clusters per independent year; same dates shared by bridges.
        result[name]={'change':float(delta), 'cluster_se':float(se), 'conditional_95_interval':[float(delta-2.093024*se),float(delta+2.093024*se)]}
    ends=[]
    for side in ['start','end']:
        fields=[side+'_station_id',side+'_lat',side+'_lng']
        part=retained[['year']+fields].copy()
        part.columns=['year','station','lat','lng']
        ends.append(part)
    med=pd.concat(ends).groupby(['station','year'])[['lat','lng']].median().unstack('year')
    shifts=distance(med['lat'][2022],med['lng'][2022],(med['lat'][2021],med['lng'][2021]))
    result['primary_dock_locations']={'n':len(shifts),'largest_median_shift_metres':float(shifts.max()),'dock_id_with_largest_shift':str(shifts.idxmax()),'dock_ids_over_50m':list(shifts[shifts>50].index)}
    if (shifts>50).any():
        bad=set(shifts[shifts>50].index)
        stable=rides[~rides.start_station_id.isin(bad) & ~rides.end_station_id.isin(bad)]
        result['excluding_shifted_docks']=estimates(stable)
    return result

if __name__=='__main__':
    if len(sys.argv) not in (3,4):sys.exit(__doc__)
    with ThreadPoolExecutor(2) as executor:
        rides=pd.concat(executor.map(load_month,zip(YEARS,sys.argv[1:3])),ignore_index=True)
    output={f'{radius}m_{limit}min_min{per_year}':estimates(rides,radius,limit,per_year) for radius,limit,per_year in [(750,90,3),(500,90,3),(1000,90,3),(750,60,3),(750,120,3),(750,90,1),(750,90,5)]}
    output['conditional_primary_intervals']=primary_uncertainty(rides,sys.argv[3] if len(sys.argv)==4 else None)
    print(json.dumps(output,indent=2))
