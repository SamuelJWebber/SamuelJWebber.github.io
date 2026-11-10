import {esc, fmt, sign, table, link} from './research-view.mjs';

const base = new URL('./research/directional/', import.meta.url);
const directions = {SB:'Southbound · toward Brooklyn', NB:'Northbound · toward Queens', both:'Both directions'};
const periods = {day:'All day · 24 hours', am:'AM peak · 07:00–10:00', pm:'PM peak · 16:00–19:00', other:'Other 18 hours · outside both peaks'};
const windows = {post:'After comparison · May–December 2014 → 2016', early_pre:'Conservative early check · January–February 2014 → 2015', pre:'Broader earlier sensitivity · January–August 2014 → 2015'};
const qualities = {exclude_flagged:'Exclude common dates with any zero hour', all_complete:'Keep zeros · complete nonnegative dates'};
const monthName = m => ['January','February','March','April','May','June','July','August','September','October','November','December'][m-1];
const asset = file => new URL(file,base).href;
const download = (file,label) => `<a class="btn" href="${esc(asset(file))}" download>${esc(label)}</a>`;
const options = obj => Object.entries(obj).map(([v,label])=>`<option value="${v}">${esc(label)}</option>`).join('');

function hourChart(rows, label, afterYear) {
  const W=900,H=300,L=66,R=22,T=24,B=42;
  const max=Math.max(...rows.flatMap(r=>[r.target_before,r.target_after]))*1.12||1;
  const x=h=>L+h*(W-L-R)/23, y=v=>H-B-v/max*(H-T-B);
  let grid='';
  for(let i=0;i<=4;i++){const v=max*i/4;grid+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#dde4d6"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="#526453">${fmt(v,0)}</text>`;}
  const bands=[[7,10,'AM'],[16,19,'PM']].map(([a,b,name])=>`<rect x="${x(a)-((W-L-R)/23)/2}" y="${T}" width="${(b-a)*(W-L-R)/23}" height="${H-T-B}" fill="#ebc660" opacity=".13"/><text x="${x(a+1)}" y="${T+13}" text-anchor="middle" font-size="11" fill="#6c6136">${name}</text>`).join('');
  const path=key=>rows.map((r,i)=>`${i?'L':'M'}${x(r.hour)},${y(r[key])}`).join(' ');
  const ticks=[0,3,6,9,12,15,18,21,23].map(h=>`<text x="${x(h)}" y="${H-17}" text-anchor="middle" font-size="12" fill="#526453">${String(h).padStart(2,'0')}</text>`).join('');
  return `<div class="research-legend"><span><i style="background:#8a7560"></i>2014</span><span><i style="background:#246846"></i>${afterYear}</span></div><svg class="research-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><desc>Mean vehicles per clock hour on matched weekday and month cells. The two lines show 2014 and ${afterYear}. Exact values are in the table below.</desc>${bands}${grid}<path d="${path('target_before')}" fill="none" stroke="#8a7560" stroke-width="2.5" stroke-dasharray="7 4"/><path d="${path('target_after')}" fill="none" stroke="#246846" stroke-width="3"/>${ticks}<text x="${L}" y="14" font-size="11" fill="#526453">vehicles / clock hour</text></svg>`;
}

/** Matched directional/hourly diagnostic: counts are vehicles, not passengers. */
export async function renderDirectionalEvidence(root) {
  if (!root) return;
  root.innerHTML='<article class="research-card"><p role="status">Loading directional counts…</p></article>';
  let d;
  try {const response=await fetch(asset('analysis.json'));if(!response.ok)throw Error(`Directional data: ${response.status}`);d=await response.json();}
  catch(error){root.innerHTML='<article class="research-card"><h3>Directional counts</h3><p role="status">The directional analysis could not load. Please reload the page.</p></article>';console.error(error);return;}
  root.innerHTML=`<article class="research-card" aria-labelledby="directional-title">
    <div class="minilabel">Measured motor counts · matched days and hours · historical 2014–2016</div>
    <h3 id="directional-title">The change looks different by direction and time of day</h3>
    <p>Pulaski’s 2016 bikeway replaced a <strong>southbound bridge lane</strong>. This separate NYSDOT counter sits farther south on McGuinness Boulevard, between Meeker Avenue / I-278 and Greenpoint Avenue. We can now inspect both directions and every clock hour using the same dates, rather than hide the pattern inside one daily total.</p>
    <p class="research-verdict"><strong>On the primary matched sample, traffic fell in both directions.</strong> The northbound evening decline is larger than the southbound decline. This weakens a simple story that all of the change is confined to the removed lane’s direction, but does not rule out network effects. It establishes neither the bike lane’s causal effect nor an all-mode person-flow loss.</p>
    <div class="research-controls">
      <label for="dir-direction">Direction<select id="dir-direction">${options(directions)}</select></label>
      <label for="dir-period">Count window<select id="dir-period">${options(periods)}</select></label>
      <label for="dir-window">Calendar comparison<select id="dir-window">${options(windows)}</select></label>
      <label for="dir-quality">Zero-hour sensitivity<select id="dir-quality">${options(qualities)}</select></label>
    </div>
    <div data-dir-result aria-live="polite"></div>
    <h4>The two directions on identical support</h4>
    <div data-dir-directions></div>
    <p class="small">Each donor uses <strong>both directions</strong> at its own counter in the selected clock-hour window. A directional target is scaled by that donor’s bidirectional growth. Northbound McGuinness is an outcome, never an assumed untreated control. Relative changes are sensitivity estimates, not confidence intervals.</p>
    <h4>Every hour, with the daily composition held fixed</h4>
    <p class="small">These curves always show all 24 clock hours for the selected direction and calendar comparison. Every hour uses the same retained dates and cell weights; this is not a mix of different days at different hours. Shading marks 07:00–10:00 and 16:00–19:00.</p>
    <div data-dir-hour-chart></div>
    <details><summary>Exact hourly values and donor comparisons</summary><div data-dir-hour-table></div></details>
    <details><summary>Which months and weekdays survive?</summary><p class="small">Each cell shows the number of exact common dates in 2014 / the comparison year. A dash means fewer than two dates in at least one year. Only retained cells receive weight; missing cells are not filled with zero. Equal retained-cell weighting does not mean equal weight across months.</p><div data-dir-support></div></details>
    <details><summary>Direction mapping, quality checks and interpretation</summary>
      <p>${esc(d.direction_rule)}</p><p>${esc(d.support_rule)}</p><p>${esc(d.qc_rule)}</p><p>${esc(d.timing_note)}</p><p>${esc(d.bottleneck_note)}</p>
      <p><strong>Lower counts are not slower journeys or lower capacity.</strong> They can reflect diversion, mode switching, suppressed travel, different demand or detector changes. There are no aligned bicycle, pedestrian, bus-passenger or rail-crossing counts at this boundary. Current McGuinness redesigns occurred much later and are not the treatment studied here.</p>
      <p>The earlier-period checks compare the same calendar months across 2014 and 2015. They are placebo-style diagnostics, not independently held-out forecasts. The broader January–August check may overlap preparatory work; use the conservative January–February check to inspect that risk. No confidence interval treats individual hours as independent policy experiments. Unverified sensor relocation or calibration could affect comparisons.</p>
      <p>${link('NYSDOT field definitions',d.documentation_urls[0])} · ${link('DOT September 2015 construction update',d.documentation_urls[1])} · ${link('DOT April 2016 opening',d.documentation_urls[2])} · ${link('DOT design and planned schedule',d.documentation_urls[3])}</p>
    </details>
    <div class="research-downloads">${download('comparisons.csv','Directional comparisons · CSV')}${download('hourly-comparisons.csv','Hourly comparisons · CSV')}${download('matched-dates.csv','Every matched date and weight · CSV')}${download('reproduction.zip','Raw sources + reproducible code · ZIP')}${download('methods.txt','Methods and findings')}</div>
  </article>`;
  const controls={direction:root.querySelector('#dir-direction'),period:root.querySelector('#dir-period'),window:root.querySelector('#dir-window'),quality:root.querySelector('#dir-quality')};
  const allowed={direction:directions,period:periods,window:windows,quality:qualities};
  const defaults={direction:'SB',period:'day',window:'post',quality:'exclude_flagged'};
  const params=new URL(location.href).searchParams;
  for(const [key,el] of Object.entries(controls)){const value=params.get('dir'+key[0].toUpperCase()+key.slice(1));el.value=Object.hasOwn(allowed[key],value)?value:defaults[key];}
  function draw(updateUrl=false){
    const state=Object.fromEntries(Object.entries(controls).map(([k,el])=>[k,el.value]));
    const match=r=>r.quality===state.quality&&r.window===state.window;
    const selected=d.comparisons.filter(r=>match(r)&&r.direction===state.direction&&r.period===state.period);
    const support=d.supports.find(match),r=selected[0];
    if(!r||!support){root.querySelector('[data-dir-result]').innerHTML='<p>No comparable observations for this selection.</p>';return;}
    const prior=d.comparisons.filter(z=>z.quality===state.quality&&z.window==='early_pre'&&z.direction===state.direction&&z.period===state.period);
    const range=selected.map(z=>z.relative_change_pct).sort((a,b)=>a-b);
    const clockHours={day:24,am:3,pm:3,other:18}[state.period];
    root.querySelector('[data-dir-result]').innerHTML=`<div class="research-status"><div><span>Observed vehicle change</span><b>${sign(r.raw_change_pct)}%</b><span>${fmt(r.target_before,0)} → ${fmt(r.target_after,0)} vehicles / ${clockHours}-hour window</span></div><div><span>Relative to the two donor trends</span><b>${sign(range[0])}% to ${sign(range[1])}%</b><span>Conditional comparisons · not causal bounds</span></div><div><span>Common calendar support</span><b>${support.retained_cells} / ${support.requested_cells} cells</b><span>${support.before_dates} baseline dates · ${support.after_dates} comparison dates</span></div></div>
    <p><strong>${esc(directions[state.direction])} · ${esc(periods[state.period])}.</strong> Retained months: ${support.retained_months.map(monthName).join(', ')}. These means describe the retained sample, not annual-average traffic.</p>
    ${table(['Donor · bidirectional','Relative change in selected window','Conservative early drift*','Early monthly RMS difference*'],selected.map(z=>{const p=prior.find(p=>p.control===z.control);return[d.stations[z.control],sign(z.relative_change_pct)+'%',sign(p?.relative_change_pct)+'%',fmt(p?.monthly_rms_relative_pct)+'%'];}))}
    <p class="small">*January–February 2014→2015, before the planned April 2015 start; actual lane-closure dates remain uncertain. This conservative check retains only ${prior[0]?.retained_cells ?? '—'} of 10 month × weekday cells and is too short to establish seasonal parallel trends. Select the broader January–August sensitivity to inspect additional months that may overlap preparatory work. Small error does not validate a donor.</p>`;
    const all=d.comparisons.filter(z=>match(z)&&z.period===state.period);
    root.querySelector('[data-dir-directions]').innerHTML=table(['Direction','2014 vehicles','Comparison-year vehicles','Observed change','vs Boston','vs Broadway'],['SB','NB','both'].map(dir=>{const a=all.find(z=>z.direction===dir&&z.control==='010009'),b=all.find(z=>z.direction===dir&&z.control==='010012');return[directions[dir],fmt(a.target_before,0),fmt(a.target_after,0),sign(a.raw_change_pct)+'%',sign(a.relative_change_pct)+'%',sign(b.relative_change_pct)+'%'];}));
    const hours=d.hourly.filter(z=>match(z)&&z.direction===state.direction&&z.control==='010009').sort((a,b)=>a.hour-b.hour);
    root.querySelector('[data-dir-hour-chart]').innerHTML=hourChart(hours,`${directions[state.direction]} vehicles per clock hour on matched cells, 2014 and ${support.year_after}`,support.year_after);
    root.querySelector('[data-dir-hour-table]').innerHTML=table(['Clock hour start','2014 vehicles','Comparison-year vehicles','Observed change','Relative vs Boston','Relative vs Broadway'],hours.map(h=>{const b=d.hourly.find(z=>match(z)&&z.direction===state.direction&&z.control==='010012'&&z.hour===h.hour);return[String(h.hour).padStart(2,'0')+':00',fmt(h.target_before,1),fmt(h.target_after,1),sign(h.raw_change_pct)+'%',sign(h.relative_change_pct)+'%',sign(b.relative_change_pct)+'%'];}));
    root.querySelector('[data-dir-support]').innerHTML=table(['Month','Mon','Tue','Wed','Thu','Fri'],support.requested_months.map(m=>[monthName(m),...[0,1,2,3,4].map(w=>{const c=support.cells.find(z=>z.month===m&&z.weekday===w);return c?`${c.before_dates} / ${c.after_dates}`:'—';})]));
    if(updateUrl){const u=new URL(location.href);for(const [k,v] of Object.entries(state))u.searchParams.set('dir'+k[0].toUpperCase()+k.slice(1),v);history.replaceState(null,'',u);}
  }
  for(const el of Object.values(controls))el.addEventListener('change',()=>draw(true));
  draw();
}
