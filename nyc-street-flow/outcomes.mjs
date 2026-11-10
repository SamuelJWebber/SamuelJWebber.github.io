import {drives} from './commute-math.mjs';
import {eastRiver} from './ride-samples.mjs';

const parkWest = drives.find(r=>r.route.startsWith('Prospect Park West'));
const nearby = drives.find(r=>r.route==='Four-route mean');
const roadSource = 'https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf#page=51';
const radarSource = 'https://www.nyc.gov/html/dot/downloads/pdf/20110120_ppw_data.pdf#page=27';
const busSource = 'https://data.ny.gov/d/58t6-89vi';
const clock = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const elapsed = (a,b) => `${Math.abs(b-a)} sec ${b < a ? 'shorter' : 'longer'}`;

export function travelEvidence(project, peak) {
  if(project === 'prospect') {
    const [a,b] = parkWest[peak];
    const [neighborBefore,neighborAfter] = nearby[peak];
    const [radarBefore,radarAfter] = peak === 'am' ? [34.1,27.7] : [32.8,25.9];
    return {
      value:elapsed(a,b), subtitle:'Timed drives on Prospect Park West',
      detail:`<b>${clock(a)} → ${clock(b)}</b> from Union St to 15th St, southbound. Same peak hours as the flow counts.`,
      foot:`<b>Nearby streets.</b> In the same peak period, the four-route driving mean went from <b>${clock(neighborBefore)} to ${clock(neighborAfter)}</b>. The daytime mean across all four stayed at 4:14. DOT timed runs in May and October 2010. These timings cover drivers only. <a href="${roadSource}" target="_blank" rel="noopener">DOT travel times</a>.`,
      radar:`<b>Speed at one block.</b> At 5th–6th streets, average peak motor speed was <b>${radarBefore} → ${radarAfter} mph</b> in March 2009 and October 2010. A radar reading captures vehicles as they pass. The timed drive includes time spent waiting at signals. <a href="${radarSource}" target="_blank" rel="noopener">DOT radar surveys</a>.`
    };
  }
  if(project === 'third') return {
    value:'≈30 sec shorter', subtitle:'Buses · separate morning sample',
    detail:'<b>16:22 → 15:53</b> northbound, E 67th to E 97th. April–June 2023 vs. 2024, Tuesday–Thursday, 7–10 a.m.',
    foot:`The bus-time sample above holds the 2023 mix of route, month, weekday and hour fixed across 81 cells. Its dates, hours and segment differ from the selected 60th Street counts. The redesigned corridor also gained a bus lane. The same routes farther south took <b>9:26 → 9:27</b>. <a href="${busSource}" target="_blank" rel="noopener">MTA bus observations</a>. <a href="?evidence=causal&causal=bus#evidence">The fixed-mix, controlled analysis uses a longer window and fails its pre-period comparison check</a>.`,
    radar:''
  };
  if(project === 'brooklyn') {
    return {value:'0.8–1.4 min shorter', subtitle:'Classic Citi Bike members · two longer windows',
      detail:'<b>16.6 → 15.8 min</b> near Brooklyn, January 1–June 20 in 2021 vs. 2022. The full-year window gives a 1.4 min drop. Relative improvement versus Manhattan is 0.43–0.72 min; the weather-adjusted interval includes no change. <a href="#longer-times">Inspect the expanded sample</a>.',
      foot:'The expanded sample fixes month, directed dock pair and departure-period mix. It contains 529 before and 626 after rides. Actual routes and complete journey times remain unknown. Its dates differ from the fall flow counts. The original June-only estimate remains below as a short-window sensitivity.', radar:''};
  }
  return {value:'Unknown', subtitle:'Time through the redesigned section',
    detail:'The selected Amsterdam Avenue counts record who crossed 60th Street. We have no matched times for the same journey in this study.', foot:'', radar:''};
}
