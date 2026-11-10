"""NYC official bicycle-path counts, 2019–2026. Descriptive, not a causal effect.
Run fetch_panel.py, retrieve NOAA weather using weather_query.txt, then run this file.
Requires pandas and NumPy. Never combines a comprehensive sensor with its physical component.
"""
import json,math,datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
import pandas as pd
ROOT=Path(__file__).parent
SENSORS={'brooklyn':'300020904','manhattan':'100062893','williamsburg':'100009427'}
DATES=pd.date_range('2019-01-01','2026-10-31',name='date')
TZ=ZoneInfo('America/New_York')
def expected(date):
 a=date.to_pydatetime().replace(tzinfo=TZ);b=(date+pd.Timedelta(days=1)).to_pydatetime().replace(tzinfo=TZ)
 # The source uses local floating timestamps: spring has 92 slots, fall repeated hour is not represented twice.
 return 92 if b.utcoffset()>a.utcoffset() else 96
EXPECTED=pd.Series([expected(d) for d in DATES],index=DATES)

def load(sid):
 d=pd.read_json(ROOT/f'daily_{sid}.json');d['date']=pd.to_datetime(d.day)
 assert (d.records==d.intervals).all(), 'duplicate flow timestamps within status'
 assert d.min_count.min()>=0
 return d

frames={}; audits={}; invalid={}
for name,sid in SENSORS.items():
 d=load(sid)
 # A status split partitions a channel-day. Require its combined nonnull intervals to equal that calendar day's expected count.
 flows=d.groupby(['date','flowid']).agg(records=('records','sum'),valid=('valid_intervals','sum'),bikes=('bikes','sum')).reset_index()
 flows['expected']=flows.date.map(EXPECTED)
 flows['complete']=flows.records.eq(flows.expected)&flows.valid.eq(flows.expected)
 a=flows.groupby('date').agg(bikes=('bikes','sum'),complete=('complete','all'),channels=('flowid','nunique'))
 expected_channels=np.where(a.index>=pd.Timestamp('2020-11-23'),4,2) if name!='brooklyn' else np.repeat(2,len(a))
 a['complete']=a.complete&a.channels.eq(expected_channels)
 a=a.reindex(DATES);a['complete']=a.complete.eq(True)
 frames[name]=a
 invalid[name]=[x.strftime('%Y-%m-%d') for x in a.index[~a.complete]]
 bystatus=d.groupby('status').agg(intervals=('valid_intervals','sum'),bikes=('bikes','sum')).reset_index().to_dict('records')
 audits[name]={'sensorId':sid,'daysReturned':int(len(a.dropna(subset=['bikes']))),'completeDays':int(a.complete.sum()),'invalidDates':invalid[name],'status':bystatus,'negativeCounts':False}
panel=pd.DataFrame({name:frame.bikes for name,frame in frames.items()},index=DATES)
panel['valid']=np.logical_and.reduce([a.complete.values for a in frames.values()])
panel['total']=panel[list(SENSORS)].sum(axis=1)
panel['others']=panel.manhattan+panel.williamsburg
panel['brooklynShare']=100*panel.brooklyn/panel.total
panel['phase']=np.select([panel.index<pd.Timestamp('2021-06-21'),panel.index<pd.Timestamp('2021-09-15')],['pre','construction/opening'],default='post')
w=pd.read_json(ROOT/'weather.json');w['date']=pd.to_datetime(w.DATE);w=w.set_index('date')
for col in ['PRCP','TMAX','TMIN','SNOW']:panel[col.lower()]=pd.to_numeric(w[col],errors='coerce')
panel['tmean']=(panel.tmax+panel.tmin)/2
panel['month']=panel.index.strftime('%Y-%m')
monthly=[]
for month,group in panel.groupby('month'):
 g=group[group.valid]
 r={'month':month,'days':len(group),'validDays':len(g),'coveragePct':100*len(g)/len(group),'displayEligible':len(g)>=0.8*len(group),'phase':'mixed' if group.phase.nunique()>1 else group.phase.iloc[0]}
 r.update({k:float(g[k].mean()) for k in [*SENSORS,'total']})
 r['brooklynShare']=100*r['brooklyn']/r['total']
 r['weather']={'tmean':float(g.tmean.mean()),'prcp':float(g.prcp.mean()),'weatherDays':int(g[['tmean','prcp']].notna().all(axis=1).sum())}
 monthly.append(r)

def compare(label,before,after,kind):
 a=panel.loc[slice(*before)];a=a[a.valid];b=panel.loc[slice(*after)];b=b[b.valid]
 r={'label':label,'before':before,'after':after,'kind':kind,'daysBefore':len(a),'daysAfter':len(b),'unit':'bicycle crossings per valid calendar day'}
 for k in [*SENSORS,'total','others']:
  x=float(a[k].mean());y=float(b[k].mean());r[k]={'before':x,'after':y,'pct':100*(y/x-1)}
 r['relativeBrooklynVsOthersPct']=100*((r['brooklyn']['after']/r['brooklyn']['before'])/(r['others']['after']/r['others']['before'])-1)
 return r
comparisons=[compare('Same-season annual windows',['2020-06-01','2021-05-31'],['2022-06-01','2023-05-31'],'primary descriptive'),compare('First complete post-opening year',['2020-06-01','2021-05-31'],['2021-10-01','2022-09-30'],'sensitivity; full years but different calendar alignment'),compare('Pre-opening placebo',['2019-06-01','2020-05-31'],['2020-06-01','2021-05-31'],'false opening date 2020-06-01; pandemic-sensitive diagnostic'),compare('Original June 1–20 window',['2021-06-01','2021-06-20'],['2022-06-01','2022-06-20'],'short-window replication'),compare('Later same-season annual windows',['2020-06-01','2021-05-31'],['2023-06-01','2024-05-31'],'later follow-up'),compare('Pre-pandemic calendar baseline',['2019-01-01','2019-12-31'],['2022-01-01','2022-12-31'],'baseline sensitivity; different counter era'),compare('After comparator flow-channel change',['2020-11-24','2021-05-31'],['2022-11-24','2023-05-31'],'same-season sensitivity after 2020-11-23 channel change')]

def regress(d, post=None, trend=False):
 d=d[d.valid].dropna(subset=['tmean','prcp','snow']).copy();d=d[(d.brooklyn>0)&(d.others>0)]
 x=pd.DataFrame({'intercept':1.,'temp':d.tmean,'temp2':d.tmean**2,'rain':d.prcp,'snow':d.snow},index=d.index)
 x=pd.concat([x,pd.get_dummies(pd.Series(d.index.month,index=d.index),prefix='month',drop_first=True,dtype=float),pd.get_dummies(pd.Series(d.index.dayofweek,index=d.index),prefix='weekday',drop_first=True,dtype=float)],axis=1)
 if trend:x['trend_year']=(d.index-d.index.min()).days/365.25
 if post is not None:x['post']=(d.index>=pd.Timestamp(post)).astype(float)
 y=np.log(d.brooklyn/d.others).to_numpy();X=x.to_numpy(dtype=float)
 beta=np.linalg.lstsq(X,y,rcond=None)[0];e=y-X@beta
 # Newey-West covariance over actual calendar-day offsets, including gaps between analysis windows.
 scores=pd.DataFrame(X*e[:,None],index=d.index).reindex(pd.date_range(d.index.min(),d.index.max()),fill_value=0).to_numpy()
 meat=scores.T@scores;lag=28
 for l in range(1,lag+1):
  gamma=scores[l:].T@scores[:-l];meat+=(1-l/(lag+1))*(gamma+gamma.T)
 inv=np.linalg.pinv(X.T@X);cov=inv@meat@inv*len(d)/(len(d)-X.shape[1])
 target='post' if post is not None else 'trend_year';j=list(x).index(target);coef=float(beta[j]);se=float(np.sqrt(max(0,cov[j,j])))
 return {'nDays':len(d),'term':target,'logCoefficient':coef,'percent':100*math.expm1(coef),'conditional95Percent':[100*math.expm1(coef-1.96*se),100*math.expm1(coef+1.96*se)],'standardError':se,'controls':['month of year','weekday','temperature','temperature squared','rainfall','snowfall']+(['linear calendar-time trend'] if trend else []),'uncertainty':'Conditional regression interval; Newey-West 28-calendar-day lag. Does not cover confounding, spillovers or sensor calibration.'}
base=(panel.index>='2020-06-01')&(panel.index<='2021-05-31');after=(panel.index>='2022-06-01')&(panel.index<='2023-05-31')
primary=regress(panel[base|after],post='2022-06-01')
trend_sensitive=regress(panel[base|after],post='2022-06-01',trend=True)
placebo=regress(panel.loc['2019-06-01':'2021-05-31'],post='2020-06-01')
pretrend=regress(panel.loc['2019-06-01':'2021-05-31'],trend=True)
# Physical-sensor reconciliation is diagnostic; physical records never enter primary sum twice.
reconcile={}
for sid,reference,start,end in [('100010022','brooklyn','2019-01-01','2021-09-13'),('300020241','brooklyn','2021-09-15','2026-10-31'),('100047029','manhattan','2019-01-01','2026-10-31')]:
 q=load(sid).groupby('date').bikes.sum();diff=panel[reference].sub(q).loc[start:end]
 missing=diff[diff.isna()];diff=diff.dropna();bad=diff[diff.ne(0)]
 reconcile[sid]={'reference':reference,'first':start,'last':end,'comparedDays':len(diff),'missingComparisonDates':[str(k.date()) for k in missing.index],'daysDifferent':len(bad),'maxAbsoluteDifference':float(abs(diff).max()),'differences':[{'date':str(k.date()),'comprehensiveMinusPhysical':float(v)} for k,v in bad.items()]}
result={'title':'Bicycle crossing panel, 2019–October 2026','retrievedAt':'2026-11-05','range':['2019-01-01','2026-10-31'],'monthly':monthly,'comparisons':comparisons,'model':{'label':'Weather-adjusted relative bicycle use, not a causal effect','outcome':'log(Brooklyn bicycle counts / (Manhattan + Williamsburg bicycle counts))','annualWindows':primary,'withLinearTrend':trend_sensitive,'placebo':placebo,'pretrend':pretrend},'audit':{'calendarDays':len(panel),'commonValidDays':int(panel.valid.sum()),'excludedCommonDates':[str(d.date()) for d in panel.index[~panel.valid]],'sensors':audits,'physicalReconciliation':reconcile,'completenessRule':'Require every active flow channel to contain one nonnull count per expected local quarter-hour. Spring DST has 92 slots; other source days have 96. Exclude a day from every bridge if any bridge fails. Sum status partitions, never comprehensive and component sensors together.','weatherMissingDays':int(panel[['tmean','prcp','snow']].isna().any(axis=1).sum())},'sources':{'counts':'https://data.cityofnewyork.us/Transportation/Bicycle-and-Pedestrian-Counts/ct66-47at','registry':'https://data.cityofnewyork.us/Transportation/Bicycle-and-Pedestrian-Counter-Locations/6up2-gnw8','weather':(ROOT/'weather_query.txt').read_text()},'limitations':['These are designated bicycle-path crossings, not all people or unique travelers.','Manhattan and Williamsburg are possible diversion destinations; relative changes do not isolate lane-caused demand.','The pre-opening baseline includes COVID-19; weather adjustment does not remove pandemic, commuting, tourism or station-network changes.','Brooklyn comprehensive series stitches the former promenade to the roadway bikeway. A hardware/path change at intervention can alter measurement; equal published totals do not prove equal calibration.','Manhattan and Williamsburg added flow channels on 2020-11-23; physical hardware replacements also occur. Completeness checks detect missing records, not calibration changes.','No mode-switch or door-to-door travel-time observations are in this count panel.','The all-three sum uses common valid dates, but cycling via other crossings, on unauthorized paths, or entirely different trips remains outside it.','Recent 2026 months have many incomplete counter days. Their available-day means can be selection-biased; displayEligible is false below 80% common coverage and these months should be omitted from continuous trend lines.']}
if (ROOT/'uniqueness-audit.json').exists():result['audit']['uniquenessAcrossStatuses']=json.loads((ROOT/'uniqueness-audit.json').read_text())
(ROOT/'bridge-panel.json').write_text(json.dumps(result,indent=2,allow_nan=False))
(ROOT/'bridge-panel.mjs').write_text('export default '+json.dumps(result,allow_nan=False)+';\n')
output_daily=panel.copy()
for col in [*SENSORS,'total','others']:
 output_daily['raw_'+col]=output_daily[col]
 output_daily.loc[~output_daily.valid,col]=np.nan
output_daily.loc[~output_daily.valid,'brooklynShare']=np.nan
output_daily.reset_index().to_csv(ROOT/'bridge-daily-panel.csv',index=False)
pd.DataFrame([{k:v for k,v in r.items() if k!='weather'}|r['weather'] for r in monthly]).to_csv(ROOT/'bridge-monthly-panel.csv',index=False)
print(json.dumps({'comparisons':comparisons,'model':result['model'],'audit':result['audit']},indent=2))
