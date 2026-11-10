#!/usr/bin/env python3
"""Rebuild directional/hourly McGuinness diagnostics from official NYSDOT ZIPs.

Python 3 standard library only. Run: python reproduce.py --sources /path/to/ZIPs
Without --sources, use the bundled sources/ directory. All generated results are
descriptive matched-support comparisons, never a causal all-person-flow effect.
"""
from pathlib import Path
import argparse, collections, csv, datetime as dt, hashlib, io, json, math, zipfile

P = Path(__file__).resolve().parent
STATIONS = ['021284', '010009', '010012']
NAMES = {'021284':'McGuinness Boulevard approach', '010009':'Boston Road, Bronx', '010012':'Broadway, Bronx'}
ARCHIVES = ['CC_VOL_R11_2014.zip', 'CC_VOL_R11_2015.zip', 'CC_Volume_Data_R11_2016.zip']
BASE = 'https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb/repository/'
PERIODS = {'day':list(range(24)), 'am':list(range(7,10)), 'pm':list(range(16,19)), 'other':[h for h in range(24) if h not in [7,8,9,16,17,18]]}
WINDOWS = {'post':(2016,list(range(5,13))), 'pre':(2015,list(range(1,9))), 'early_pre':(2015,[1,2])}

def mean(v): return sum(v)/len(v)
def csvout(name, rows):
    with (P/name).open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--sources',type=Path,default=P/'sources');a=ap.parse_args()
    station_days=collections.defaultdict(list); source_metadata=[];raw=[]
    for archive in ARCHIVES:
        path=a.sources/archive
        with zipfile.ZipFile(path) as z:
            member=z.namelist()[0]
            records=csv.DictReader(io.StringIO(z.read(member).decode('utf-8-sig')))
            for line,r0 in enumerate(records,2):
                r={k.strip():v.strip() for k,v in r0.items()}
                station=(r.get('RC_STATION') or r.get('Station ID')).replace('_','')
                if station not in STATIONS:continue
                date=dt.date(int(r['YEAR']),int(r['MONTH']),int(r['DAY']))
                code=r.get('FEDERAL_DIRECTION',r.get('ROAD'))
                values=[r.get(f'INTERVAL_{i:02d}',r.get(f'I{i}')) for i in range(1,25)]
                vals=[int(v) if v!='' else None for v in values]
                direction={'99':'NB','-99':'SB','1':'NB','5':'SB'}.get(code) if station=='021284' else code
                assert direction is not None
                row={'station':station,'date':date.isoformat(),'direction':direction,'source_direction_code':code,'source_file':archive,'source_row':line,**{f'h{h:02d}':v for h,v in enumerate(vals)}}
                raw.append(row)
                station_days[(station,date)].append({'direction':direction,'values':vals,'raw':row})
                if station=='021284' and not any(m['file']==archive for m in source_metadata):
                    source_metadata.append({'file':archive,'old_begin':r.get('Begin Desc'),'old_end':r.get('End Desc'),'dotid':r.get('DOTID'),'ccid':r.get('CCID'),'lanes_in_direction':r.get('LANES_IN_DIRECTION'),'direction_code':code})
    assert len({(r['station'],r['date'],r['source_direction_code']) for r in raw})==len(raw)
    csvout('source-three-station-directional-days.csv',raw)
    grouped={}
    for (station,date),rows in station_days.items():
        if len(rows)!=2:continue
        if any(v is None or v<0 for r in rows for v in r['values']):continue
        if station=='021284':assert {r['direction'] for r in rows}=={'NB','SB'}
        grouped[(station,date)]={'both':[sum(r['values'][h] for r in rows) for h in range(24)],'flagged':any(v==0 for r in rows for v in r['values']),**({r['direction']:r['values'] for r in rows} if station=='021284' else {})}
    dates=sorted({d for s,d in grouped if d.weekday()<5 and all((st,d) in grouped for st in STATIONS)})
    comparisons=[];hourly=[];supports=[];matched_dates=[];month_rows=[]
    for quality in ['exclude_flagged','all_complete']:
        eligible=[d for d in dates if quality=='all_complete' or not any(grouped[(s,d)]['flagged'] for s in STATIONS)]
        cells=collections.defaultdict(list)
        for d in eligible:cells[(d.year,d.month,d.weekday())].append(d)
        for window,(year,months) in WINDOWS.items():
            kk=[(m,w) for m in months for w in range(5) if len(cells[(2014,m,w)])>=2 and len(cells[(year,m,w)])>=2]
            assert kk
            support={'quality':quality,'window':window,'year_before':2014,'year_after':year,'retained_cells':len(kk),'requested_cells':len(months)*5,'retained_months':sorted(set(m for m,w in kk)),'requested_months':months,'before_dates':sum(len(cells[(2014,m,w)]) for m,w in kk),'after_dates':sum(len(cells[(year,m,w)]) for m,w in kk),'cells':[{'month':m,'weekday':w,'before_dates':len(cells[(2014,m,w)]),'after_dates':len(cells[(year,m,w)])} for m,w in kk]}
            supports.append(support)
            for yy in [2014,year]:
                for m,w in kk:
                    matched_dates.extend({'quality':quality,'window':window,'year':yy,'month':m,'weekday':w,'date':d.isoformat(),'cell_weight':1/len(kk),'date_weight':1/len(kk)/len(cells[(yy,m,w)])} for d in cells[(yy,m,w)])
            def av(st,dir,yy,hours,keys=kk):
                return mean([mean([sum(grouped[(st,d)][dir][h] for h in hours) for d in cells[(yy,m,w)]]) for m,w in keys])
            for direction in ['SB','NB','both']:
                for period,hours in {**PERIODS,**{f'h{h:02d}':[h] for h in range(24)}}.items():
                    t0=av('021284',direction,2014,hours);t1=av('021284',direction,year,hours)
                    for control in STATIONS[1:]:
                        c0=av(control,'both',2014,hours);c1=av(control,'both',year,hours)
                        cf=t0*c1/c0
                        row={'quality':quality,'window':window,'direction':direction,'period':period,'control':control,'target_before':t0,'target_after':t1,'control_before':c0,'control_after':c1,'raw_change_pct':100*(t1/t0-1),'counterfactual_target':cf,'relative_change_vehicles':t1-cf,'relative_change_pct':100*(t1/cf-1),'retained_cells':len(kk),'requested_cells':len(months)*5,'before_dates':support['before_dates'],'after_dates':support['after_dates']}
                        if period.startswith('h'):
                            row['hour']=int(period[1:]);hourly.append(row)
                        else:
                            monthly=[]
                            for mm in support['retained_months']:
                                km=[k for k in kk if k[0]==mm]
                                mt0=av('021284',direction,2014,hours,km);mt1=av('021284',direction,year,hours,km);mc0=av(control,'both',2014,hours,km);mc1=av(control,'both',year,hours,km)
                                mr={'quality':quality,'window':window,'direction':direction,'period':period,'control':control,'month':mm,'cells':len(km),'target_before':mt0,'target_after':mt1,'relative_change_pct':100*(mt1/(mt0*mc1/mc0)-1)}
                                month_rows.append(mr);monthly.append(mr['relative_change_pct'])
                            row['monthly_rms_relative_pct']=math.sqrt(mean([v*v for v in monthly]));comparisons.append(row)
    # Arithmetic invariants on identical support. These test outcomes, not formatting.
    for q in ['exclude_flagged','all_complete']:
        for w in WINDOWS:
            for c in STATIONS[1:]:
                for p in PERIODS:
                    rr=[r for r in comparisons if r['quality']==q and r['window']==w and r['control']==c and r['period']==p]
                    lookup={r['direction']:r for r in rr}
                    for v in ['target_before','target_after','relative_change_vehicles']:
                        assert abs(lookup['both'][v]-lookup['SB'][v]-lookup['NB'][v])<1e-8
                for dr in ['SB','NB','both']:
                    r=next(r for r in comparisons if r['quality']==q and r['window']==w and r['control']==c and r['period']=='day' and r['direction']==dr)
                    hh=[h for h in hourly if h['quality']==q and h['window']==w and h['control']==c and h['direction']==dr]
                    for v in ['target_before','target_after']:
                        assert abs(r[v]-sum(h[v] for h in hh))<1e-8
    # Independent previous all-direction audit should reconcile exactly.
    primary=[r for r in comparisons if r['quality']=='exclude_flagged' and r['window']=='post' and r['direction']=='both' and r['period']=='day']
    assert all(r['retained_cells']==20 and r['before_dates']==70 and r['after_dates']==66 for r in primary)
    expected={'010009':-4.91,'010012':-9.76}
    assert all(abs(r['relative_change_pct']-expected[r['control']])<.01 for r in primary)
    result={'title':'McGuinness approach: direction and hour','analysis_date':'2026-11-05','scope':'Station 021284, between Meeker Avenue / I-278 and Greenpoint Avenue. It is not on Pulaski Bridge. Historical 2014–2016 analysis of the Pulaski conversion, not a test of recent McGuinness redesigns.','units':'Motor vehicles. No vehicle occupancy, passenger count, journey time or capacity is inferred.','support_rule':'Exact same dates across McGuinness (both directions), Boston Road (both directions) and Broadway (both directions), within each year; then identical month × weekday cells across years. Each cell needs at least two dates per year. Equal retained-cell weights; all hours and directions share support.','control_rule':'Scale the target baseline by each Bronx donor’s bidirectional growth in the identical clock-hour window. Donors are distant diagnostics, not validated counterfactuals. Northbound is an outcome, not an untreated control.','qc_rule':'Both source directions must have all 24 nonnegative hourly values. Primary sensitivity excludes a whole common date if any of the six direction records contains a zero. Zeros can be genuine; the alternative keeps them. No imputations.','direction_rule':'2014/2015 ROAD 99 is begin-to-end: I-278 / Meeker Avenue to Greenpoint Avenue, mapped northbound; −99 is southbound. 2016 FEDERAL_DIRECTION 1 and 5 map north and south. Source code and raw rows retained.','timing_note':'Construction was documented by September 22, 2015, when DOT said it recently started; the bikeway opened April 29, 2016. The December 2014 plan scheduled an April 2015 project start and temporary lane closures, but that schedule does not establish actual closures. The exact permanent motor-lane closure date remains unverified. January–February 2014→2015 is the preferred conservative early diagnostic; it retains only five of ten requested cells. January–August is a broader sensitivity that may overlap preparatory work. Neither proves treatment-free conditions. 2017 is excluded because the Kosciuszko opening changes the network.','bottleneck_note':'The December 2014 design says three Brooklyn-bound bridge lanes already merged to two near McGuinness / Green Street. Removing a lane along the bridge therefore does not itself establish that the downstream bottleneck lost a lane or capacity.','limitations':['Approach traffic may enter or leave at intervening junctions; a change here is not the bridge’s vehicle change.','No aligned bike, pedestrian, bus-load or subway-crossing series for this boundary.','Lower counted traffic can reflect diversion, suppressed trips, mode switching, detector changes or demand; these data do not distinguish them.','Earlier-period differences, distant donor trends and unresolved counter continuity prevent a causal interpretation.','Sampled matched dates do not represent annual-average daily traffic or unobserved months. Hourly profiles are clock-hour volumes, not observed speed or travel time.'],'stations':NAMES,'source_metadata':source_metadata,'sources':[{'url':BASE+n,'file':n,'sha256':hashlib.sha256((a.sources/n).read_bytes()).hexdigest()} for n in ARCHIVES],'documentation_urls':['https://www.dot.ny.gov/divisions/engineering/technical-services/highway-data-services/hdsb/repository/Field_Definitions_CC%20Formats.pdf','https://www.nyc.gov/html/dot/html/pr2015/pr15-096.shtml','https://www.nyc.gov/html/dot/html/pr2016/pr16-044.shtml','https://www.nyc.gov/html/dot/downloads/pdf/2014-12-pulaski-presentation.pdf'],'supports':supports,'comparisons':comparisons,'hourly':hourly,'monthly':month_rows,'qa':{'source_direction_rows':len(raw),'comparison_rows':len(comparisons),'hourly_rows':len(hourly),'unique_source_keys':True,'direction_sums_reconcile':True,'hour_sums_reconcile':True,'previous_common_support_audit_reconciles':True}}
    (P/'analysis.json').write_text(json.dumps(result,indent=2)+'\n')
    csvout('comparisons.csv',comparisons);csvout('hourly-comparisons.csv',hourly);csvout('matched-dates.csv',matched_dates);csvout('monthly-comparisons.csv',month_rows)
    print(json.dumps({'qa':result['qa'],'primary_directional':[r for r in comparisons if r['quality']=='exclude_flagged' and r['window']=='post' and r['period'] in ['day','am','pm']]}))

if __name__=='__main__':main()
