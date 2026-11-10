import {eastRiver, pulaski, pathCounts} from './ride-samples.mjs';

const fmt = (v,d=0)=>v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const signed = v => (v<0?'−':'+') + fmt(Math.abs(v),2);
const clock = seconds => {
  const s = Math.round(seconds);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
};
const link = (label,href)=>`<a target="_blank" rel="noopener" href="${href}">${label}</a>`;
const archive = y => link(String(y),`https://s3.amazonaws.com/tripdata/${y}-citibike-tripdata.zip`);
const wide = rows => `<div class="over-scroll">${rows}</div>`;

export function renderBikeTimes(table) {
  const b = eastRiver.Brooklyn, m = eastRiver.Manhattan, p = pulaski;
  const hours = 20 * 24, [beforeCount,afterCount] = pathCounts.Brooklyn;
  const flowDelta = (afterCount-beforeCount)/hours;
  const bikeRows = Object.entries(pathCounts).map(([name,[a,b]])=>[name+' Bridge',fmt(a/hours,1),fmt(b/hours,1),`${b >= a ? '+' : '−'}${fmt(Math.abs((b/a-1)*100),1)}%`]);
  const [lo,hi] = eastRiver.intervals.Brooklyn_minus_Manhattan.conditional_95_interval;
  const brooklynRows = [['Brooklyn Bridge',b],['Manhattan Bridge',m]].map(([name,g])=>[
    name,...g.mean_minutes.map(v=>fmt(v,2)),signed(g.change),g.matched_before_after.map(v=>fmt(v)).join(' → ')
  ]);
  const pulaskiRows = [
    ['Mean · all recorded durations',p.fixed_avg_untrimmed_sec0,p.fixed_avg_untrimmed_sec1],
    ['Mean · rentals capped at 45 min',p.fixed_avg_45mincap_sec0,p.fixed_avg_45mincap_sec1],
    ['Typical trip · within-group medians',p.fixed_avg_median_sec0,p.fixed_avg_median_sec1]
  ].map(([s,a,b])=>[s,clock(a),clock(b),`${Math.round(Math.abs(b-a))} sec ${b<a?'shorter':'longer'}`]);
  document.querySelector('#bike-times').innerHTML=`<div class="minilabel">Cycling flow and trip time · Two bridge conversions</div>
    <h3>The original short-window comparison</h3><p><strong>Expanded analysis now available.</strong> The January–June comparison gives a smaller relative time change. <a href="#longer-times">See the wider sample and uncertainty</a>. These June-only results are retained to show sensitivity to the observation window.</p><p>A path counter measures everyone cycling past a point. Citi Bike records tell us how long members took from unlocking to docking. We compare the same docks, direction and time of day. The records do not identify the route or the rider.</p>
    <div class="dock-example"><h4>Brooklyn Bridge and its approaches</h4><p>The city opened the protected bikeway in September 2021. Both measures below compare <strong>June 1–20, 2021 with June 1–20, 2022</strong>.</p>
    <div class="outcome-pair river-pair"><div class="outcome-card"><div class="outcome-question"><span>1</span><h4>Flow on the bike path</h4></div><div class="outcome-value">${fmt(beforeCount/hours,1)} → ${fmt(afterCount/hours,1)}</div><div class="outcome-caption">bicycle crossings per hour</div><p class="outcome-detail">${fmt(beforeCount)} → ${fmt(afterCount)} crossings across 480 hours, both directions. That is ${fmt((afterCount/beforeCount-1)*100,1)}% more cyclists.</p></div>
    <div class="outcome-card time-card"><div class="outcome-question"><span>2</span><h4>Time between docks</h4></div><div class="outcome-value">${fmt(b.mean_minutes[0],1)} → ${fmt(b.mean_minutes[1],1)}</div><div class="outcome-caption">minutes per matched Citi Bike ride</div><p class="outcome-detail">${b.matched_before_after[0]} before and ${b.matched_before_after[1]} after. Classic bikes ridden by members. A trip near the bridge could use another route.</p></div></div>
    <p><strong>What would make total flow rise?</strong> The path added ${fmt(flowDelta,1)} cyclists per hour. Total bridge flow rose if all other travelers combined fell by less than that amount or increased. Matched June counts of those other travelers are missing.</p>
    <h5>Travel time at the nearby comparison bridge</h5>
    ${wide(table(brooklynRows,['Docks near','2021 · min','2022 · min','Change · min','Matched trips']))}
    <p>Brooklyn’s drop was ${fmt(-eastRiver.relative,1)} minutes larger. The approximate 95% interval spans ${fmt(-lo,1)} minutes more improvement to ${fmt(hi,1)} minutes less. The sample cannot separate the lane’s effect from year-to-year changes or route choices.</p>
    <details class="audit-detail"><summary>Check station matching, sensitivity and sources</summary>
    <p>Starts and ends must be within 750 m of opposite bridge approaches and at least 250 m closer to that bridge than the other. We use rides lasting 4–90 minutes. We group by start dock, end dock and departure period (weekend, weekday peak or weekday off-peak). Weekday peaks are 7–10 a.m. and 4–7 p.m. Each group needs at least three trips in each year. Its share of matched 2021 trips weights the mean in both years.</p>
    <p>Near Brooklyn, ${b.matched_before_after[0]} of ${b.eligible_before_after[0]} before and ${b.matched_before_after[1]} of ${b.eligible_before_after[1]} after qualified for the matched result (${b.matched_ordered_station_pairs} directional pairs). Near Manhattan the counts were ${m.matched_before_after[0]} of ${m.eligible_before_after[0]} and ${m.matched_before_after[1]} of ${m.eligible_before_after[1]} (${m.matched_ordered_station_pairs} pairs). The median reported locations of all 20 matched docks moved less than one metre between years. Different people can make the trips. The interval groups variation by calendar day within each of the two 20-day samples and holds eligible groups and their weights fixed. The Manhattan Bridge can absorb diverted trips.</p>
    ${wide(table(eastRiver.checks.map(([label,a,b,d])=>[label,signed(a),signed(b),signed(d)]),['Change one setting','Brooklyn Δ min','Manhattan Δ min','Difference Δ min']))}
    <h5>Bicycle crossings in the same 20 days</h5>${wide(table(bikeRows,['Designated path','2021 cyclists / h','2022 cyclists / h','Change']))}
    <p>NYC DOT comprehensive counter 300020904 follows the designated Brooklyn Bridge route from the promenade to the new roadway. It recorded every quarter-hour in both directions. DOT labels the 2021 observations modified and the 2022 observations raw. The Manhattan Bridge comparison uses comprehensive counter 100062893 and sums its four channels once. Averaging uses all 480 hours, including nights and weekends. Citi Bike trips are a separate sample and do not add to these counts.</p>
    <p class="refline">${link('DOT path counts','https://data.cityofnewyork.us/Transportation/Bicycle-and-Pedestrian-Counts/ct66-47at')} · ${link('Counter locations','https://data.cityofnewyork.us/Transportation/Bicycle-and-Pedestrian-Count-Sensors/6up2-gnw8')} · <a href="methods/bike-path-counts.csv" download>Counts and source queries CSV</a></p>
    <p class="refline">${link('NYC DOT opening and counter','https://www.nyc.gov/html/dot/html/pr2021/brooklyn-bridge-bike-ridership-skyrockets.shtml')} · ${link('Construction dates','https://www.nysenate.gov/newsroom/press-releases/2021/brian-kavanagh/forwarding-mayor-announces-construction-brooklyn-bridge')} · Citi Bike archives ${archive(2021)} / ${archive(2022)} · <a href="methods/east-river-time-cells.csv" download>Matched groups CSV</a> · <a href="methods/bridge_bike_times.py" download>Calculation script</a></p></details></div>
    <div class="dock-example"><h4>Pulaski Bridge approaches</h4><p>For Greenpoint–Long Island City trips, the ordinary mean fell from <strong>${clock(p.fixed_avg_untrimmed_sec0)} to ${clock(p.fixed_avg_untrimmed_sec1)}</strong>. A handful of very long rentals influenced that result. The typical matched trip stayed close to <strong>6 minutes 39 seconds</strong>.</p>
    ${wide(table(pulaskiRows,['Measure','2015 · min:sec','2016 · min:sec','Change']))}
    <details class="audit-detail"><summary>Check long rentals, coverage and sources</summary><p>These are October–November member trips on non-holiday weekdays, 7 a.m.–7 p.m. The project converted a southbound driving lane to a protected two-way bikeway in April 2016. Construction and the local Citi Bike rollout overlapped the earlier sample. Service was still growing, so changes in sample size cannot stand in for changes in bridge flow.</p>
    <p>We match ${p.directed_pairs} directional dock pairs, split them into morning, midday and evening, and require five trips in each year. Each of ${p.cells} groups keeps its 2015 trip weight. The estimates use ${fmt(p.trips0)} before and ${fmt(p.trips1)} after. Three rides in each year exceeded 45 minutes. The longest lasted about 16 hours before and 9½ hours after. The middle row caps durations at 45 minutes for comparison. The last row weights each group’s median by its 2015 trip count.</p>
    <p class="refline">${link('NYC DOT Pulaski project','https://www.nyc.gov/html/dot/html/pr2016/pr16-044.shtml')} · ${link('2015 construction record','https://www.nyc.gov/html/dot/downloads/pdf/dot_bridgereport15_part2.pdf')} · Citi Bike archives ${archive(2015)} / ${archive(2016)} · <a href="methods/pulaski-time-cells.csv" download>Matched groups CSV</a> · <a href="methods/pulaski_times.py" download>Calculation script</a></p></details></div>
    <p class="refline">${link('Citi Bike trip history fields and data use policy','https://citibikenyc.com/system-data')}</p>`;
}
