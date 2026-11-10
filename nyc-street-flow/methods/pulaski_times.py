"""Summarize Citi Bike weekday dock-to-dock subscriber times across Newtown Creek.
Download the 2015 and 2016 annual New York trip-history archives from
https://s3.amazonaws.com/tripdata/2015-citibike-tripdata.zip and
https://s3.amazonaws.com/tripdata/2016-citibike-tripdata.zip as 2015.zip and 2016.zip.
Run: python pulaski_times.py (requires pandas and NumPy). No routes are observed.
"""
from pathlib import Path
from zipfile import ZipFile
import json
import numpy as np
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar

YEARS = (2015, 2016)
# Rectangles around approaches to Pulaski Bridge, entirely on opposite sides of Newtown Creek.
LON = (-73.961, -73.947)
BROOKLYN_LAT = (40.728, 40.739)
QUEENS_LAT = (40.740, 40.750)

def read_rides(year):
    samples = []
    holidays = USFederalHolidayCalendar().holidays(f'{year}-10-01', f'{year}-11-30')
    with ZipFile(Path(f'{year}.zip')) as z:
        months = ('/10_October/', '/11_November/')
        paths = [p for p in z.namelist() if p.endswith('.csv') and not p.startswith('__MACOSX') and any(m in p for m in months)]
        for path in sorted(paths):
            with z.open(path) as f:
                for chunk in pd.read_csv(f, chunksize=150000, usecols=list(range(0, 11)) + [12]):
                    chunk.columns = [s.lower().replace(' ', '') for s in chunk.columns]
                    eligible = chunk[chunk.usertype.eq('Subscriber') & chunk.tripduration.gt(0)].copy()
                    def side(col):
                        lat, lon = eligible[col+'stationlatitude'], eligible[col+'stationlongitude']
                        return np.select([lon.between(*LON) & lat.between(*BROOKLYN_LAT), lon.between(*LON) & lat.between(*QUEENS_LAT)], ['Brooklyn','Queens'], default='Outside')
                    eligible['origin'], eligible['dest'] = side('start'), side('end')
                    keep = eligible[eligible.origin.ne('Outside') & eligible.dest.ne('Outside') & eligible.dest.ne(eligible.origin)].copy()
                    if keep.empty: continue
                    fmt = '%m/%d/%Y %H:%M:%S' if year == 2015 else '%Y-%m-%d %H:%M:%S'
                    dt = pd.to_datetime(keep.starttime, format=fmt)
                    keep['period'] = np.select([dt.dt.hour.lt(10),dt.dt.hour.lt(16)], ['AM','Midday'], default='PM')
                    keep['day_num'] = dt.dt.dayofyear
                    keep = keep[dt.dt.dayofweek.lt(5) & dt.dt.hour.between(7,18) & ~dt.dt.normalize().isin(holidays)].copy()
                    keep['year'] = year
                    samples.append(keep)
    return pd.concat(samples,ignore_index=True)

def almost_same_docks(all_rides):
    points=[]
    for side in ['start','end']:
        loc=all_rides[['year',side+'stationid',side+'stationlatitude',side+'stationlongitude',side+'stationname']].copy()
        loc.columns=['year','id','lat','lon','name'];points.append(loc)
    points=pd.concat(points).drop_duplicates()
    allowed=[]; desc=[]
    for station, group in points.groupby('id'):
        if group.year.nunique()!=2: continue
        # Check the most distant corners of the bounding box across all observed coordinates.
        drift=np.hypot((group.lat.max()-group.lat.min())*111100,(group.lon.max()-group.lon.min())*84300)
        if drift<=50:
            allowed.append(station); desc.append(dict(id=int(station), name=group.name.iloc[0], distance_m=float(drift)))
    eligible=all_rides[all_rides.startstationid.isin(allowed)&all_rides.endstationid.isin(allowed)]
    return eligible, desc

def summary(rides, min_count=5, band=True):
    keys=['startstationid','endstationid']+(['period'] if band else [])
    cells=[]
    for key, group in rides.groupby(keys):
        both=[]
        for year in YEARS:
            same=group[group.year==year]
            if len(same)<min_count: break
            durations=same.tripduration
            both.append((len(same),float(durations.median()),float(durations.clip(upper=2700).mean()),float(durations.mean()),int(durations.max()),int((durations>2700).sum()),int((durations>5400).sum())))
        if len(both)!=2: continue
        cells.append({'from':group.startstationname.iloc[0],'to':group.endstationname.iloc[0], 'direction':group.origin.iloc[0]+' to '+group.dest.iloc[0], 'band':key[2] if band else 'all', 'n0':both[0][0],'n1':both[1][0],'median0':both[0][1],'median1':both[1][1],'mean_capped0':both[0][2],'mean_capped1':both[1][2],'mean_raw0':both[0][3],'mean_raw1':both[1][3],'max0':both[0][4],'max1':both[1][4],'over45m0':both[0][5],'over45m1':both[1][5],'over90m0':both[0][6],'over90m1':both[1][6]})
    data=pd.DataFrame(cells)
    def stats(d):
        if d.empty:return {'cells':0}
        def avg(k):return float(np.average(d[k],weights=d.n0))
        return {'cells':len(d),'trips0':int(d.n0.sum()),'trips1':int(d.n1.sum()),'directed_pairs':len(d[['from','to']].drop_duplicates()),'fixed_avg_median_sec0':avg('median0'),'fixed_avg_median_sec1':avg('median1'),'delta_secs':avg('median1')-avg('median0'),'fixed_avg_untrimmed_sec0':avg('mean_raw0'),'fixed_avg_untrimmed_sec1':avg('mean_raw1'),'fixed_avg_45mincap_sec0':avg('mean_capped0'),'fixed_avg_45mincap_sec1':avg('mean_capped1'),'delta_cappedmean_secs':avg('mean_capped1')-avg('mean_capped0'),'max0':int(d.max0.max()),'max1':int(d.max1.max()),'over45m0':int(d.over45m0.sum()),'over45m1':int(d.over45m1.sum()),'over90m0':int(d.over90m0.sum()),'over90m1':int(d.over90m1.sum()),'faster_cells':int((d.median1<d.median0).sum())}
    return stats(data), {label:stats(d) for label,d in data.groupby('direction')} if len(data) else {},cells

if __name__=='__main__':
    all_rides=pd.concat([read_rides(y) for y in YEARS],ignore_index=True)
    stable, docks=almost_same_docks(all_rides)
    cells=summary(stable,5,True)
    results={'years':YEARS,'raw_all_neighborhood_rides':{str(k):int(v) for k,v in all_rides.groupby('year').size().items()},'stable_neighborhood_rides':{str(k):int(v) for k,v in stable.groupby('year').size().items()},'stable_docks':docks,'primary':cells[0],'directions':cells[1],'sensitivities':{f'min{n}_band{b}':summary(stable,n,b)[0] for n,b in [(1,True),(10,True),(5,False)]},'cell_data':cells[2]}
    print(json.dumps(results,indent=2))
