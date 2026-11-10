"""Reproduce graph digitization from official NYC DOT PDFs.

Run with CODEX_PRIMARY_RUNTIME_PYTHON. Values are chart-derived approximations,
not raw observations, standard errors, or causal estimates. No network totals.
"""
from pathlib import Path
import csv, hashlib, json
import fitz

ROOT = Path(__file__).resolve().parent
DOT_URL = "https://www.nyc.gov/html/dot/downloads/pdf/mcguinness-blvd-calyer-st-freeman-st-apr2026.pdf"
CB_URL = "https://www.nyc.gov/assets/brooklyncb1/downloads/pdf/meeting-minutes/Combined-Public-Hearing-Board-Meeting-Minutes-04-14-26-Part-1.pdf"

def save_csv(name, rows):
    with (ROOT/name).open('w', newline='') as f:
        w=csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)

pdf = fitz.open(ROOT/'mcguinness-apr2026.pdf')
motor=[]
for draw in pdf[10].get_drawings():
    color=draw.get('fill')
    if not color or len(draw['items']) != 4: continue
    if abs(color[0]-.518)<.001: year=2023
    elif abs(color[0])<.001 and abs(color[1]-.251)<.001: year=2025
    else: continue
    north=draw['rect'].x0<400
    baseline=302.5899963378906
    top=173.10000610351562 if north else 169.92999267578125
    for j,item in enumerate(draw['items']):
        assert item[0]=='re'
        rect=item[1]
        value=(baseline-rect.y0)/(baseline-top)*1200
        direction='NB' if j<2 else 'SB'
        start,end=(('Green St','Freeman St') if direction=='NB' else ('Freeman St','Green St')) if north else (('Humboldt St','Newton St') if direction=='NB' else ('Newton St','Bayard St'))
        motor.append(dict(section='north' if north else 'south',direction=direction,from_street=start,to_street=end,peak='AM' if j%2==0 else 'PM',year=year,value_approx=round(value/10)*10,unit='vehicles during plotted peak; duration not stated',exact_count=False,observation_window='Two weeks of midweek ATR data in Fall',dates_disclosed=False,source_url=DOT_URL,pdf_page=11,method='Vector bar height; independently calibrated 0–1200 axis per panel; displayed value rounded to nearest 10',inference='descriptive only'))
motor.sort(key=lambda r:(r['section'],r['direction'],r['peak'],r['year']))
save_csv('mcguinness-peak-motor-counts-digitized.csv',motor)

bikes=[]
baseline,top=325.19500732421875,52.20001220703125
for draw in pdf[11].get_drawings():
    color=draw.get('fill')
    if not color: continue
    street=abs(color[0]-.0627)<.001
    sidewalk=abs(color[0]-.522)<.001
    if not (street or sidewalk): continue
    for item in draw['items']:
        if item[0]!='re' or item[1].width<20: continue
        rect=item[1]
        value=rect.height/(baseline-top)*60
        bikes.append(dict(year=2021 if rect.x0<550 else 2025,location='McGuinness Blvd at Greenpoint Ave',surface='in street' if street else 'on sidewalk',value_approx=round(value),unit='bicycles in one hour',exact_count=False,date=None,hour=None,source_url=DOT_URL,pdf_page=12,method='Vector stacked-bar height; 0–60 axis; rounded to nearest bicycle'))
bikes.append(dict(year=2025,location='McGuinness Blvd at Greenpoint Ave',surface='on sidewalk',value_approx=0,unit='bicycles in one hour',exact_count=False,date=None,hour=None,source_url=DOT_URL,pdf_page=12,method='No sidewalk segment visible in 2025 stacked bar; requires raw-count confirmation'))
bikes.sort(key=lambda r:(r['year'],r['surface']))
save_csv('mcguinness-bicycle-counts-digitized.csv',bikes)

# The CB1 copy includes slides 29–41 omitted from the standalone DOT version.
# Each panel has 93 bars per direction. Visual tick spacing suggests a 15-minute
# time grid from 00:00 to 23:00. This is NOT confirmation that bars are independent
# 15-minute counts: the ordinate explicitly says vehicles per hour.
cb = fitz.open(ROOT/'brooklyncb1-apr2026-minutes-part1.pdf')
profiles=[]
configs=[(68,True,2021,318.375,70.1300048828125),(70,True,2023,319.125,70.1300048828125),(68,False,2025,317.625,70.1300048828125)]
for page_index,left,year,y0,y1400 in configs:
    series={'NB':[],'SB':[]}
    for draw in cb[page_index].get_drawings():
        c=draw.get('fill')
        if not c: continue
        if all(abs(a-b)<.002 for a,b in zip(c,[.569,.749,.859])):direction='NB'
        elif all(abs(a-b)<.002 for a,b in zip(c,[.988,.553,.349])):direction='SB'
        else: continue
        for item in draw['items']:
            if item[0]!='re':continue
            rect=item[1]
            if 50<rect.y0<320 and .1<rect.width<5 and rect.height>5 and (rect.x0<400)==left:
                series[direction].append(rect)
    for direction,rects in series.items():
        rects.sort(key=lambda r:r.x0)
        assert len(rects)==93,(year,direction,len(rects))
        for i,rect in enumerate(rects):
            v=(y0-rect.y0)/(y0-y1400)*1400
            profiles.append(dict(year=year,direction=direction,location='McGuinness Blvd between Green St and Freeman St',plot_index=i,time_of_day_inferred=f'{i//4:02d}:{(i%4)*15:02d}',time_grid_status='Inferred from plotted labels; raw window semantics unknown',value_approx=round(v/10)*10,unit='vehicles per hour (source axis)',exact_count=False,observation_window='Two-week average ATRs counted in October/November',dates_disclosed=False,source_url=CB_URL,pdf_page=page_index+1,slide_number=page_index+1-35,method='Vector bar height; 0–1400 axis; rounded to nearest 10',do_not_sum_reason='Plotted hourly-rate windows may overlap; 93 point profile, not confirmed independent 15-minute totals'))
save_csv('mcguinness-north-time-profiles-digitized.csv',profiles)

sources=[]
for name,url in [('mcguinness-apr2026.pdf',DOT_URL),('brooklyncb1-apr2026-minutes-part1.pdf',CB_URL),('mcguinness-sept2024.pdf','https://www.nyc.gov/html/dot/downloads/pdf/mcguinness-blvd-update-sept2024.pdf'),('mcguinness-jun2022.pdf','https://www.nyc.gov/html/dot/downloads/pdf/mcguinness-blvd-complete-street-jun2022.pdf')]:
    p=ROOT/name
    sources.append(dict(file=name,url=url,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size,pages=len(fitz.open(p))))
(ROOT/'mcguinness-source-manifest.json').write_text(json.dumps(sources,indent=2)+'\n')
hours_pdf=ROOT/'cb1-oct11-2023-minutes.pdf'
if hours_pdf.exists():
    sources.append(dict(file=hours_pdf.name,url='https://www.nyc.gov/assets/brooklyncb1/downloads/pdf/meeting-minutes/Combined-Public-Hearing-and-Board-Meeting-Minutes-10-11-2023.pdf',sha256=hashlib.sha256(hours_pdf.read_bytes()).hexdigest(),bytes=hours_pdf.stat().st_size,pages=len(fitz.open(hours_pdf))))
    (ROOT/'mcguinness-source-manifest.json').write_text(json.dumps(sources,indent=2)+'\n')
print(json.dumps({'peak_motor_rows':len(motor),'bicycle_rows':len(bikes),'time_profile_rows':len(profiles),'sources':len(sources)}))
