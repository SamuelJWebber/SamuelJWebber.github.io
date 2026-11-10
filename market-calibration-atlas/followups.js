'use strict';
// Follow-up studies: renders saved JSON outputs from studies/ (no recomputation in the browser).
(function () {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const num = (v, d = 3) => v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d);
  const signed = (v, d = 3) => v === null || v === undefined ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  const pct = (v, d = 0) => v === null || v === undefined ? '—' : (100 * v).toFixed(d) + '%';
  const ci = (c, d = 3, f = signed) => c ? `[${f(c[0], d)}, ${f(c[1], d)}]` : 'interval suppressed';
  const int = v => Number(v).toLocaleString('en-US');
  const hours = m => m === null || m === undefined ? '—' : (m / 60).toFixed(1) + ' h';

  function metrics(items) {
    return `<div class="metrics">${items.map(m => `<div class="metric"><div class="metric-value${m.text ? ' metric-text' : ''}">${esc(m.value)}</div><div class="metric-label">${esc(m.label)}</div>${m.ci ? `<div class="metric-ci">${esc(m.ci)}</div>` : ''}</div>`).join('')}</div>`;
  }
  function table(caption, head, rows, numericFrom = 1) {
    return `<div class="table-wrap"><table><caption class="table-caption" style="caption-side:top;text-align:left">${esc(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i >= numericFrom ? 'numeric' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function head(eyebrow, title, id) {
    return `<div class="study-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2 id="${id}-title">${esc(title)}</h2></div></div>`;
  }
  // Horizontal point-and-interval chart. rows: {label, mean, ci, kind: 'test'|'seen'}
  function intervalChart(title, rows, unit, scale) {
    const width = 520, left = 190, right = 20, rowH = 30, top = 26, height = top + rows.length * rowH + 26;
    const values = rows.flatMap(r => r.ci ? r.ci : [r.mean]).concat([0]);
    let lo = Math.min(...values), hi = Math.max(...values);
    const pad = (hi - lo) * 0.08 || 0.01; lo -= pad; hi += pad;
    const x = v => left + (v - lo) / (hi - lo) * (width - left - right);
    const step = [0.01, 0.02, 0.025, 0.05, 0.1, 0.2].find(s => (hi - lo) / s <= 6) || 0.5;
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v / step) * step);
    const body = rows.map((r, i) => {
      const y = top + i * rowH + rowH / 2;
      const bar = r.ci ? `<line class="ci" x1="${x(r.ci[0])}" x2="${x(r.ci[1])}" y1="${y}" y2="${y}"/>` : '';
      return `<g class="${r.kind}"><text class="label" x="${left - 10}" y="${y + 4}" text-anchor="end">${esc(r.label)}</text>${bar}<circle cx="${x(r.mean)}" cy="${y}" r="4.5"/></g>`;
    }).join('');
    const axis = ticks.map(v => `<text x="${x(v)}" y="${height - 6}" text-anchor="middle">${signed(v * scale, 1)}${unit}</text>`).join('');
    return `<figure class="figure"><h3>${esc(title)}</h3><svg class="interval-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">` +
      `<line class="zero" x1="${x(0)}" x2="${x(0)}" y1="${top - 8}" y2="${height - 20}"/>${body}${axis}</svg>` +
      `<div class="key"><span><i style="background:#203d70"></i>untouched month</span><span><i style="background:#8ea2bb"></i>in-sample or previously examined</span></div></figure>`;
  }

  // Line chart over horizons (days). series: {label, color, dash, points: [[day, value]], mark: day to label}.
  // One y-axis; hover columns carry a crosshair and a native tooltip; a key is always shown for 2+ series.
  function lineChart(title, series, opts) {
    const width = 520, height = 230, left = 46, right = 16, top = 18, bottom = 30;
    const days = series[0].points.map(p => p[0]);
    const x0 = days[0], x1 = days[days.length - 1];
    const step = opts.yStep, yMax = Math.ceil(Math.max(...series.flatMap(s => s.points.map(p => p[1] || 0))) / step) * step || step;
    const x = v => left + (v - x0) / (x1 - x0) * (width - left - right);
    const y = v => top + (1 - v / yMax) * (height - top - bottom);
    const grid = [];
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      grid.push(`<line class="grid" x1="${left}" x2="${width - right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left - 6}" y="${y(v) + 4}" text-anchor="end">${esc(opts.yFormat(v))}</text>`);
    }
    const ticks = opts.xTicks.map(v => `<text x="${x(v)}" y="${height - 10}" text-anchor="middle">${v}</text>`).join('');
    const band = opts.band ? `<rect class="band" x="${x(opts.band[0])}" y="${top}" width="${x(opts.band[1]) - x(opts.band[0])}" height="${height - top - bottom}"/><text class="band-label" x="${(x(opts.band[0]) + x(opts.band[1])) / 2}" y="${top + 12}" text-anchor="middle">${esc(opts.bandLabel)}</text>` : '';
    const path = s => s.points.filter(p => p[1] !== null && p[1] !== undefined).map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const lines = series.map(s => `<path class="series" d="${path(s)}" stroke="${s.color}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`).join('');
    const marks = series.filter(s => s.mark).map(s => {
      const p = s.points.find(q => q[0] === s.mark.day);
      const px = x(p[0]), py = y(p[1]);
      const anchor = px > width - 150 ? 'end' : 'start';
      return `<circle cx="${px}" cy="${py}" r="4" fill="${s.color}" stroke="#fff" stroke-width="2"/><text class="direct" x="${px + (anchor === 'end' ? -8 : 8)}" y="${py + (s.mark.dy || -6)}" text-anchor="${anchor}">${esc(s.mark.text)}</text>`;
    }).join('');
    const colW = (width - left - right) / (x1 - x0);
    const hover = days.map((d, i) => `<g class="hover-col"><line class="cross" x1="${x(d)}" x2="${x(d)}" y1="${top}" y2="${height - bottom}"/><rect x="${x(d) - colW / 2}" y="${top}" width="${colW}" height="${height - top - bottom}"><title>${esc(opts.tooltip(d, i))}</title></rect></g>`).join('');
    const key = series.length > 1 ? `<div class="key">${series.map(s => `<span><i class="line-key" style="border-top:2px ${s.dash ? 'dashed' : 'solid'} ${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>` : '';
    return `<figure class="figure"><h3>${esc(title)}</h3><svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title + '. ' + opts.summary)}">` +
      `${band}${grid.join('')}<line class="axis" x1="${left}" x2="${width - right}" y1="${y(0)}" y2="${y(0)}"/>${ticks}${lines}${marks}${hover}</svg>${key}</figure>`;
  }

  function renderClocks(d, sports, election, polyElection) {
    const a = d.tierA, b = d.tierB, c = d.tierC;
    const fam = a.families;
    const total = fam.reduce((s, f) => s + f.contracts, 0);
    const before = fam.reduce((s, f) => s + f.closeBeforeNews.count, 0);
    const verified = fam.reduce((s, f) => s + (f.releaseTimeSource['FRED calendar time'] || 0) + (f.releaseTimeSource['FOMC statement page'] || 0) + (f.releaseTimeSource['BEA release page'] || 0), 0);
    const longest = a.closedMoreThan1DayBeforeNews.length ? a.closedMoreThan1DayBeforeNews[0] : null;
    const famRows = fam.map(f => [esc(f.label), int(f.contracts), int(f.releases), signed(f.closeMinusNewsMinutes.median, 0) + ' min',
      int(f.closeAtOrAfterNews.count), int(f.closeMoreThan60MinutesAfterNews.count), hours(f.settledMinusNewsMinutes.median)]);
    const delayed = a.closedMoreThan1DayBeforeNews.map(r => [esc(r.example.split('-').slice(0, 2).join('-')), esc(r.closeUtc.slice(0, 16).replace('T', ' ')),
      esc(r.newsUtc.slice(0, 16).replace('T', ' ')), num(-r.closeMinusNewsDays, 1) + ' days', int(r.contracts)]);
    const cats = [{broad: 'All sampled', ...b.all}, ...b.categories].map(x => {
      const h = x.horizons[0];
      return [esc(x.broad), int(x.contracts), pct(x.closeAfterExpectedPlus1h.share), `${int(h.tradedAfterScheduledExpiration)} of ${int(h.n)}`, num(h.brierFlagged), num(h.brierOther)];
    });
    const polyLabels = {cpi: 'Consumer Price Index', employment: 'Payrolls and unemployment', fomc: 'Fed decisions and dissents', claims: 'Weekly jobless claims'};
    const polyRows = c ? [['All', c.all], ...Object.entries(c.families)].map(([k, f]) => [esc(polyLabels[k] || k), int(f.contracts), int(f.releases),
      signed(f.anchorMinusNewsMinutes.median / 60, 1) + ' h', `${int(f.anchorBeforeNews.count)} of ${int(f.contracts)}`, `${int(f.postNewsObservations)} of ${int(f.panelObservations)}`,
      pct(f.closeAfterNews.share)]) : [];
    let sportsHtml = '';
    if (sports) {
      const rows = [['All leagues', sports.all], ...Object.entries(sports.leagues)].map(([k, s]) => [esc(k), int(s.games), int(s.contracts),
        signed(s.closeMinusGameEndMinutes.median, 1) + ' min', int(s.closeMoreThan60MinAfterEnd), hours(s.settledMinusGameEndMinutes.median),
        `${int(s.tradedAfterFirstPlay)} of ${int(s.panelObservations)}`, int(s.tradedAfterGameEnd)]);
      sportsHtml = table('Tier D: game end from ESPN play-by-play wall clocks vs Kalshi game-winner contracts (sampled panel games)',
        ['League', 'Games', 'Contracts', 'Median close − game end', 'Closed >60 min after end', 'Median settlement lag', 'Panel prices after first play', 'After game end'], rows);
    }
    let electionHtml = '';
    if (election) {
      const rows = [['All 2024 single-race contracts', election.all], ...Object.entries(election.offices)].map(([k, x]) => [esc(k), int(x.events), int(x.contracts),
        num(x.closeMinusFirstPollsCloseDays.median, 0) + ' days', `${int(x.tradedAfterFirstPollsClose)} of ${int(x.panelObservations)}`,
        num(x.brierBeforeFirstPollsClose), num(x.brierAfterFirstPollsClose)]);
      electionHtml = table('Tier E: 2024 US races on Kalshi vs the first poll closing (5 Nov 2024, 23:00 UTC), a lower bound on when any result could be public',
        ['Office', 'Races', 'Contracts', 'Median close after polls closed', 'Panel prices after polls closed', 'Brier, before', 'Brier, after'], rows);
    }
    const pe = polyElection;
    if (pe) {
      const rows = [['Single races', pe.singleRace.all], ['National or multi-race results', pe.national], ['Race-call timing', pe.callTiming], ['All mapped', pe.allMapped]]
        .map(([k, x]) => [esc(k), int(x.contracts), signed(x.anchorMinusFirstPollsCloseDays.median * 24, 0) + ' h',
          int(x.contracts - x.contractsAnchoredBeforeFirstPollsClose), `${int(x.tradedAfterFirstPollsClose)} of ${int(x.panelObservations)}`,
          num(x.brierBeforeFirstPollsClose), num(x.brierAfterFirstPollsClose)]);
      electionHtml += table(`Tier E2: Polymarket questions parsed to the 2024 US election (${int(pe.parser.mappedToElectionDay2024)} of ${int(pe.parser.contracts)}) vs the first poll closing; anchor = earlier of scheduled end and close`,
        ['Group', 'Contracts', 'Median anchor − polls closed', 'Anchored after polls closed', 'Panel prices after polls closed', 'Brier, before', 'Brier, after'], rows);
    }
    return head('07 · NEWS CLOCK VS EXCHANGE CLOCKS', 'Exchanges close on the schedule, not on the news', 'clocks') +
      `<p class="finding">For ${int(total)} Kalshi contracts on scheduled US releases (CPI, jobs, GDP, PCE, jobless claims, FOMC), trading closed before the official release in ${pct(before / total)} of cases, usually five minutes before. None of the ${int(a.panelObservations)} daily panel prices for these contracts was traded after the release. But close follows the calendar: when the 2025 shutdown delayed releases, contracts still closed on the original date${longest ? `, up to ${num(-longest.closeMinusNewsDays, 0)} days before the data appeared` : ''}.${c ? ` On Polymarket, trading usually continued past the release (${pct(c.all.closeAfterNews.share)} of ${int(c.all.contracts)} contracts), but the panel's anchor, the earlier of scheduled expiry and close, preceded it for ${pct(c.all.anchorBeforeNews.share)}, and no panel price was traded after it.` : ''}${election ? ` Elections are the exception: 2024 US race contracts on Kalshi closed about two months after Election Day, so ${pct(election.all.tradedAfterFirstPollsCloseShare)} of their panel prices, and every price within 30 days of close, were traded after polls had closed.` : ''}${pe ? ` Polymarket's panel mostly avoids this: it anchors single-race contracts at their scheduled end, before the polls closed, so only ${int(pe.singleRace.all.tradedAfterFirstPollsClose)} of their ${int(pe.singleRace.all.panelObservations)} prices were traded after.` : ''}</p>` +
      metrics([
        {value: pct(before / total), label: 'Kalshi: closed before the official release'},
        {value: int(a.postNewsObservations + (c ? c.all.postNewsObservations : 0)), label: `panel prices traded after the release (of ${int(a.panelObservations + (c ? c.all.panelObservations : 0))}, both venues)`},
        {value: longest ? num(-longest.closeMinusNewsDays, 0) + ' days' : '—', label: 'longest gap from close to delayed news (September 2025 jobs report)'},
        {value: `${int(verified)} of ${int(total)}`, label: 'Kalshi release times verified per release (FRED calendar from 2025, BEA and Fed release pages)'}]) +
      table('Tier A: Kalshi vs independent release clocks. Negative minutes mean trading closed before the release.',
        ['Release', 'Contracts', 'Releases', 'Median close − news', 'Closed at/after news', '>60 min after', 'Median settlement lag'], famRows) +
      table('Kalshi contracts that closed more than a day before the news', ['Event', 'Close (UTC)', 'News (UTC)', 'Gap', 'Contracts'], delayed) +
      (c ? table('Tier C: Polymarket panel anchor (earlier of scheduled expiry and close) vs the same release clocks',
        ['Release', 'Contracts', 'Releases', 'Median anchor − news', 'Anchor before news', 'Panel prices after news', 'Trading continued past news'], polyRows) : '') +
      sportsHtml + electionHtml +
      table('Tier B: 2,999 sampled Kalshi panel contracts, exchange clocks only (no independent news time)',
        ['Category', 'Contracts', 'Close > scheduled +1 h', '1-day prices after scheduled expiry', 'Brier, flagged', 'Brier, other'], cats) +
      `<div class="boundary"><strong>Boundary.</strong> Tiers A and C cover scheduled US releases; Tier D covers sampled games in 17 leagues, and information arrives during a game, not only at its end; its ESPN play clocks were collected once by script, which ESPN's terms of use prohibit, so Tier D is frozen, its raw data are not redistributed and it will not be extended from ESPN. Tiers E and E2 use the first poll closing as a bound because no public race-call clock could be used; it does not say when any race was called. Tier E2's parser dates only questions about the 2024 US general election; the other Polymarket election questions (primaries, 2025 races, non-US elections) were not compared with any election date. Release times for 2021–2024 BLS, BEA and DOL releases are the agencies' standing 8:30 a.m. New York time; from 2025 they come from FRED's calendar, and FOMC times from each statement. The exchange's own scheduled expiration is <em>not</em> a usable news clock: its meaning changes by year and the prices it flags are not systematically more accurate.</div>` +
      `<div class="study-actions"><a class="download" href="data/news-clock/clock-audit.json" download>Clock audit · JSON ↓</a>${sports ? '<a class="download" href="data/news-clock/sports-clock.json" download>Sports clock · JSON ↓</a>' : ''}${election ? '<a class="download" href="data/news-clock/election-clock.json" download>Election clock · JSON ↓</a>' : ''}${pe ? '<a class="download" href="data/news-clock/polymarket-election-clock.json" download>Polymarket election clock · JSON ↓</a>' : ''}</div>`;
  }

  function polymarketText(pm) {
    const s = pm.sweep.summary['Elections and primaries'], h = pm.headline;
    return ` Polymarket, by a second specification fixed before its rows were re-scored: its panel anchors most race contracts before the polls closed, so post-election prices are at most ${pct(s.peakShare.share, 1)} of its Elections and primaries row (${s.peakShare.day} days); the 1-day headline moves from ${num(h.published, 4)} to ${num(h.without, 4)} without them.`;
  }

  function renderElectionEffect(d, rt, pm) {
    const S = d.sets.S.scopes, h = d.headline;
    const cell = x => x ? `${num(x.brier, 4)} (${int(x.contracts)})` : '—';
    const rows = [];
    ['All Politics', 'Elections and primaries'].forEach(scope => ['1', '7', '30', '90'].forEach(hz => {
      const c = S[scope][hz], none = !!c.identicalSetComparison;
      rows.push([esc(scope), hz, cell(c.dashboardAsPublished), none ? '—' : cell(c.published), none ? '—' : num(c.reanchored.brier, 4), cell(c.excluded),
        `${int(c.electionPricesInDashboardRowTradedAfterFirstPollsClose)} of ${int(c.electionContractsInDashboardRow)}`]);
    }));
    // Post hoc sweep over every horizon (not in the SPEC; review round 1).
    const sw = d.postHocSweep;
    // The sweep uses W+ (W plus the eight House and Senate series added in review round 2, R2-1) when present.
    const setName = sw.tables['W+'] ? 'W+' : 'W', wp = sw.wPlus;
    const tableW = scope => sw.tables[setName][scope].map(r => Object.fromEntries(sw.columns.map((c, i) => [c, r[i]])));
    const ep = tableW('Elections and primaries'), ap = tableW('All Politics'), at = tableW('All topics');
    const sumW = sw.summary[setName], epSum = sumW['Elections and primaries'], apSum = sumW['All Politics'];
    const range = (t, a, b) => { const v = t.filter(r => r.day >= a && r.day <= b).map(r => r.postElectionShare); return [Math.min(...v), Math.max(...v)]; };
    const ep1 = range(ep, 1, 30), ep31 = range(ep, 31, 61);
    const ep62 = range(ep, 62, epSum.daysWithPostElectionPrices ? epSum.daysWithPostElectionPrices[1] : sw.days[1]);
    const half = ep.filter(r => r.postElectionShare >= 0.5).map(r => r.day);
    const peak = epSum.peakShare, at58 = ep.find(r => r.day === peak.day);
    const pctRange = r => `${(100 * r[0]).toFixed(0)}–${pct(r[1])}`;
    const shareChart = lineChart('Share of each Kalshi dashboard row priced after the polls closed, by days before close',
      [{label: 'Elections and primaries', color: '#2a78d6', points: ep.map(r => [r.day, r.postElectionShare]), mark: {day: peak.day, text: `${pct(peak.share)} at ${peak.day} days`}},
       {label: 'All Politics', color: '#eb6834', points: ap.map(r => [r.day, r.postElectionShare]), mark: {day: apSum.peakShare.day, text: pct(apSum.peakShare.share), dy: 14}},
       {label: 'All topics', color: '#1baf7a', points: at.map(r => [r.day, r.postElectionShare])}],
      {yStep: 0.2, yFormat: v => pct(v), xTicks: [1, 15, 30, 45, 60, 75, 90], band: [31, 61], bandLabel: '31–61 days',
       summary: `Post-election prices are ${pctRange(ep31)} of the Elections and primaries row from 31 to 61 days`,
       tooltip: (day, i) => `${day} days: Elections and primaries ${pct(ep[i].postElectionShare, 1)} (${int(ep[i].postElection)} of ${int(ep[i].rowContracts)}); All Politics ${pct(ap[i].postElectionShare, 1)}; All topics ${pct(at[i].postElectionShare, 1)}`});
    const widest = ep.reduce((a, r) => (r.withoutBrier - r.rowBrier > a.withoutBrier - a.rowBrier ? r : a));
    const brierChart = lineChart('Elections and primaries: Brier score as shown and without the post-election prices',
      [{label: 'As shown on the dashboard', color: '#2a78d6', points: ep.map(r => [r.day, r.rowBrier]), mark: {day: widest.day, text: `${num(widest.rowBrier, 3)} shown`, dy: 16}},
       {label: 'Without post-election prices', color: '#2a78d6', dash: '5 4', points: ep.map(r => [r.day, r.withoutBrier]), mark: {day: widest.day, text: `${num(widest.withoutBrier, 3)} without, ${widest.day} days`}}],
      {yStep: 0.05, yFormat: v => num(v, 2), xTicks: [1, 15, 30, 45, 60, 75, 90], band: [31, 61], bandLabel: '31–61 days',
       summary: `At ${peak.day} days the row shows ${num(at58.rowBrier, 3)}; without the post-election prices it is ${num(at58.withoutBrier, 3)}`,
       tooltip: (day, i) => `${day} days: shown ${num(ep[i].rowBrier, 4)}, without post-election prices ${num(ep[i].withoutBrier, 4)} (${int(ep[i].withoutContracts)} contracts)`});
    const lastDay = epSum.daysWithPostElectionPrices ? epSum.daysWithPostElectionPrices[1] : sw.days[1];
    const pick = [...new Set([1, 7, 30, 31, 45, peak.day, 61, 62, 75, lastDay, 90])].sort((a, b) => a - b);
    const setText = wp && setName === 'W+'
      ? `the wider set of ${int(wp.contracts)} election contracts (the specification's ${int(d.sets.W.contracts)} plus ${int(wp.addedToW.length)} House and Senate series its ticker list missed, added in review round 2)`
      : `the wider set of ${int(d.sets.W.contracts)} election contracts`;
    const sweepRows = pick.map(day => {
      const e = ep.find(r => r.day === day), a = ap.find(r => r.day === day);
      return [String(day), `${int(e.postElection)} of ${int(e.rowContracts)} (${pct(e.postElectionShare)})`, num(e.rowBrier, 4), num(e.withoutBrier, 4),
        `${int(a.postElection)} of ${int(a.rowContracts)} (${pct(a.postElectionShare)})`, num(a.rowBrier, 4), num(a.withoutBrier, 4)];
    });
    return head('11 · ELECTION CLOCK ON THE DASHBOARD', `Post-election prices barely move All Politics, but are ${pctRange(ep31)} of Kalshi's 31–61-day election rows`, 'election') +
      `<p class="finding">Kalshi kept its 2024 US election contracts open until certification, weeks after the result, so the dashboard's prices for them, counted back from that close, include prices traded after the polls closed, which score almost perfectly. The headline fixed in advance is small: anchoring the ${int(d.sets.S.contracts)} race contracts to election night moves the 1-day All Politics Brier score from ${num(h.published, 4)} to ${num(h.reanchored, 4)}. But the dashboard serves every horizon, not only the four in the specification. <strong>Post hoc</strong>, across days 1–${sw.days[1]} with ${setText}: in Elections and primaries these prices are ${pctRange(ep1)} of each row at 1–30 days, ${pctRange(ep31)} at 31–61 days (more than half from ${half[0]} to ${half[half.length - 1]} days) and ${pctRange(ep62)} from 62 days to ${lastDay}, the last day with any. At ${peak.day} days the row shows a Brier score of ${num(at58.rowBrier, 3)}; without them it would be ${num(at58.withoutBrier, 3)}. Thirty days, one of the four horizons in the specification, is not the worst. The main dashboard marks every Kalshi, Polymarket and All markets row that contains such prices: a note above the Explore summary cards, a dashed line on the Explore trend chart for the same rows without them, rings on the Charts tab, daggers in Compare and a column in each CSV download.${pm ? polymarketText(pm) : ''}</p>` +
      metrics([
        {value: `${num(h.published, 4)} → ${num(h.reanchored, 4)}`, label: 'All Politics, 1 day: published → re-anchored to election night (headline fixed in advance)', ci: 'difference ' + ci([-h.interval95[1], -h.interval95[0]], 4), text: true},
        {value: `${pct(peak.share)} at ${peak.day} days`, label: 'peak share of the Elections and primaries row priced after the polls closed (post hoc)', text: true},
        {value: `${num(at58.rowBrier, 3)} → ${num(at58.withoutBrier, 3)}`, label: `Elections and primaries, ${peak.day} days: Brier as shown → without them (post hoc)`, text: true},
        {value: `${pct(apSum.peakShare.share)} at ${apSum.peakShare.day} days`, label: 'peak share of the All Politics row (post hoc)', text: true}]) +
      `<div class="two-up">${shareChart}${brierChart}</div>` +
      table(`Post hoc, not in the specification: Kalshi dashboard rows at selected horizons, ${setText}. "Without" drops the rows' post-election prices.`,
        ['Days', 'Elections and primaries: post-election', 'Brier shown', 'Without', 'All Politics: post-election', 'Brier shown', 'Without'], sweepRows, 1) +
      table(`As specified in advance: Kalshi Brier score (contracts) for the ${int(d.sets.S.contracts)} 2024 US single-race contracts at 1, 7, 30 and 90 days. Published and Re-anchored use identical contracts; Excluded drops the election contracts; "—" where no election contract has a price under both anchors`,
        ['Scope', 'Days', 'Dashboard', 'Published', 'Re-anchored', 'Excluded', 'Election prices after polls closed'], rows, 1) +
      `<div class="boundary"><strong>Boundary.</strong> Descriptive. Re-anchored prices are earlier forecasts of the same races, so they answer a different question (accuracy before the result rather than before the venue closed); the "without" rows drop prices instead of replacing them. Neither is a corrected dashboard, and the published aggregates are unchanged. The horizon sweep was added after the specified tables were published (review round 1) and widened in review round 2 to series the specification's own definition covers but its ticker list missed; every other election event that closed after the polls closed is listed with the reason it is left out. At 90 days the election prices were traded before the election and score worse, so dropping them lowers Brier. Prices come from the daily panel, which keeps one trade per day${rt ? `; raw Kalshi trades confirm it missed no trade inside the election-anchored windows of the ${int(d.sets.S.contracts)} race contracts (${int(rt.windowsChecked)} windows checked across both sets; one 1¢ trade found for one contract of the wider set; the series added in round 2 were not checked against raw trades)` : ''}. Only 2024 US election contracts are counted; other Politics contracts that close after their news are not.</div>` +
      `<div class="study-actions"><a class="download" href="data/election-effect/election-effect.json" download>Results · JSON ↓</a><a class="download" href="data/election-effect/dashboard-caveat.json" download>Dashboard caveat data · JSON ↓</a>${rt ? '<a class="download" href="data/election-effect/raw-trades-check.json" download>Raw-trade check · JSON ↓</a>' : ''}${pm ? '<a class="download" href="data/election-effect/polymarket-effect.json" download>Polymarket rows · JSON ↓</a>' : ''}</div>`;
  }

  function renderReaction(d) {
    const p = d.periods;
    const jb = p.january.binB;
    const rowsFor = (key, field) => [
      {label: 'March (fit, in-sample)', block: p.march, kind: 'seen'},
      {label: 'February (examined before)', block: p.february, kind: 'seen'},
      {label: 'January (untouched)', block: p.january, kind: 'test'},
      {label: 'January, unseen events', block: p.januaryEventDisjoint, kind: 'test'}]
      .map(r => {
        const s = field === 'drift' ? r.block[key].path.drift60 : r.block[key][field];
        return {label: r.label, mean: s.mean, ci: s.ci, kind: r.kind};
      });
    const tableRows = [['March (fit)', p.march], ['February', p.february], ['January (primary)', p.january], ['January, unseen events', p.januaryEventDisjoint]]
      .map(([label, block]) => {
        const s = block.binB;
        return [esc(label), int(s.n), signed(s.gain.mean, 4) + ' ' + ci(s.gain.ci, 4), signed(s.gap.mean) + ' ' + ci(s.gap.ci),
          signed(s.path.drift60.mean) + ' ' + ci(s.path.drift60.ci), pct(s.path.selectionShare)];
      });
    return head('08 · FROZEN OUT-OF-SAMPLE TEST', 'The frozen forecast test is inconclusive in January', 'reaction') +
      `<p class="finding">A shrinkage factor fitted on March (${num(d.meta.frozenK.binB, 3)} for jumps of 20+ points) was frozen in git before any January 2026 bar was downloaded. In January it improved Brier by only ${signed(jb.gain.mean, 4)}, an interval that spans zero: <strong>inconclusive</strong>. Secondary, and not a headline under the frozen specification because the primary is inconclusive: where trading continued for the next hour, prices gave back ${num(-jb.path.drift60.mean * 100, 1)} points on average and kept ${pct(jb.path.retainedMovement)} of the jump, a reversal like March's; but only ${pct(jb.path.selectionShare)} of January's large jumps had that hour of trading.</p>` +
      metrics([
        {value: d.verdict.charAt(0).toUpperCase() + d.verdict.slice(1), label: 'pre-registered primary result', text: true},
        {value: signed(jb.gain.mean, 4), label: 'January Brier gain from shrinking 20+ point jumps', ci: ci(jb.gain.ci, 4)},
        {value: signed(jb.path.drift60.mean * 100, 1) + ' pts', label: `January 60-minute drift after 20+ point jumps (secondary; only the ${pct(jb.path.selectionShare)} with a complete hour)`, ci: ci(jb.path.drift60.ci.map(v => v * 100), 1)},
        {value: int(jb.n), label: 'January jumps of 20+ points (primary sample)'}]) +
      `<div class="two-up">${intervalChart('Outcome gap after jumps of 20+ points (outcome − price)', rowsFor('binB', 'gap'), ' pts', 100)}${intervalChart('60-minute drift after jumps of 20+ points', rowsFor('binB', 'drift'), ' pts', 100)}</div>` +
      table('Jumps of 20+ points. Gain: Brier of the post-jump price minus Brier of the March-fitted shrinkage forecast.',
        ['Period', 'Jumps', 'Brier gain [95% CI]', 'Outcome gap', '60-min drift', 'With complete hour'], tableRows) +
      `<div class="boundary"><strong>Boundary.</strong> January is an untouched earlier month, not a future one: the pinned Polymarket archive ends on 29 March 2026. News times are inferred from prices, trade prices include bid-ask bounce, and the reversal is measured only on markets that kept trading. A partial price reversal is not, by itself, a worse forecast of the outcome.</div>` +
      `<div class="study-actions"><a class="download" href="data/reaction-oos/reaction-oos.json" download>Results · JSON ↓</a><a class="download" href="data/reaction-oos/january-source.json" download>January source manifest · JSON ↓</a></div>`;
  }

  // Follow-up to study 09 (studies/reaction-quotes, SPEC frozen before the run): the same detector on midpoints.
  function quoteFollowUp(q) {
    if (!q || !q.quotes || !q.quotes.binB || !q.quotes.binB.n) return '';
    const s = q.quotes.binB, t = q.quotes.timingControl.binB, o = q.quotes.overlapWithTradeDetector;
    const rows = [['Midpoint jumps of 20+ points (pre-registered primary)', int(s.n), signed(s.gain.mean, 4) + ' ' + ci(s.gain.ci, 4), signed(s.gap.mean) + ' ' + ci(s.gap.ci)]]
      .concat(t && t.n ? ['a', 'm1', 't0', 't1'].map(k => [`Same ${int(t.n)} jumps: ${esc(t[k].label)}`, int(t.n), signed(t[k].gain.mean, 4) + ' ' + ci(t[k].gain.ci, 4), signed(t[k].gap.mean) + ' ' + ci(t[k].gap.ci)]) : []);
    return `<h3 class="subhead">Follow-up: the same detector on bid-ask midpoints</h3>` +
      `<p class="finding">A second frozen specification (committed before the run) moved the detector from last trades to quote midpoints on the same contracts and minutes. Primary result: <strong>${esc(q.verdict)}</strong>. After ${int(s.n)} midpoint jumps of 20+ points, shrinking changed Brier by ${signed(s.gain.mean, 4)} ${ci(s.gain.ci, 4)} and the outcome gap was ${signed(s.gap.mean * 100, 1)} points: no overshoot in the quotes. Only ${pct(o.withTradeEpisodeShare)} of these jumps coincide with a selected trade jump within two minutes. This informs how the trade result above is read (an overshoot found by conditioning on a large last-trade move); it is the same sample, not a replication.</p>` +
      table('Midpoint-detected jumps (exploratory follow-up; secondary rows are descriptive). Gain: Brier of the price minus Brier of the frozen shrinkage forecast', ['Episodes and price', 'Jumps', 'Brier gain [95% CI]', 'Outcome gap [95% CI]'], rows);
  }

  function renderForward(d, q) {
    const f = d.forward, m = d.meta, b = f.binB, a = f.binA;
    const row = (label, s) => s && s.n ? [esc(label), int(s.n), int(s.events), signed(s.gain.mean, 4) + ' ' + ci(s.gain.ci, 4), signed(s.gap.mean) + ' ' + ci(s.gap.ci)] : [esc(label), '0', '—', '—', '—'];
    const rows = [row('Jumps of 20+ points (primary)', b), row('Jumps of 5–20 points', a),
      row('20+ points, at least 1 h before close', f.leadAtLeast1h.binB), row('5–20 points, at least 1 h before close', f.leadAtLeast1h.binA)];
    const mid = ['binB', 'binA'].map(k => {
      const x = f.midpoint[k];
      return x && x.n ? [esc(k === 'binB' ? '20+ points' : '5–20 points'), int(x.n), signed(x.tradeGap.mean) + ' ' + ci(x.tradeGap.ci), signed(x.midGap.mean) + ' ' + ci(x.midGap.ci)] : [esc(k), '0', '—', '—'];
    });
    const broad = Object.entries(f.byBroadBinB).map(([k, x]) => [esc(k), int(x.n), int(x.events), signed(x.gap.mean) + ' ' + ci(x.gap.ci)]);
    const verdict = d.verdict.charAt(0).toUpperCase() + d.verdict.slice(1);
    const mb = f.midpoint.binB, tc = f.timingControl ? f.timingControl.binB : null;
    const t3 = tc && tc.tradeMidNextTrade && tc.tradeMidNextTrade.n ? tc.tradeMidNextTrade : null;
    const midText = mb && mb.n ? ` Measured at the bid-ask midpoint at the end of the same minute instead of that minute's last trade (${int(mb.n)} of these jumps), the outcome gap shrank from ${signed(mb.tradeGap.mean * 100, 1)} to ${signed(mb.midGap.mean * 100, 1)} points, an interval that includes zero.` +
      (t3 ? ` But that quote is also up to a minute later than the trade, and the next minute's trade had given back about as much (${signed(t3.a1.gap.mean * 100, 1)} points on the same ${int(t3.n)} jumps; exploratory). The overshoot fades within about a minute in trades and quotes alike; these data cannot say whether it is a last-print effect or a fast reversal.` : '') : '';
    const four = tc && tc.allFour && tc.allFour.n ? tc.allFour : null;
    const timingRows = four ? ['a', 'm0', 'a1', 'm1'].map(k => [esc(four[k].label.charAt(0).toUpperCase() + four[k].label.slice(1)), signed(four[k].gap.mean) + ' ' + ci(four[k].gap.ci), signed(four[k].gain.mean, 4) + ' ' + ci(four[k].gain.ci, 4)]) : [];
    return head('09 · FORWARD, CROSS-VENUE TEST', 'On Kalshi the frozen test passes; the overshoot it corrects fades within about a minute', 'forward') +
      `<p class="finding">The same frozen test, moved forward to Kalshi contracts that closed between 1 August and 10 September 2026 (one-minute bars, at least 10,000 contracts traded): ${int(m.sampled)} contracts sampled from ${int(m.eligible)} eligible, ${int(b.n || 0)} jumps of 20+ points. Shrinking those jumps by the March Polymarket factor changed Brier by ${b.n ? signed(b.gain.mean, 4) : '—'}: <strong>${esc(d.verdict)}</strong>.${midText}</p>` +
      metrics([
        {value: verdict, label: 'pre-registered primary result', text: true},
        {value: b.n ? signed(b.gain.mean, 4) : '—', label: 'Brier gain from shrinking 20+ point jumps', ci: b.n ? ci(b.gain.ci, 4) : ''},
        {value: b.n ? signed(b.gap.mean * 100, 1) + ' pts' : '—', label: 'outcome gap after 20+ point jumps (outcome − price)', ci: b.n && b.gap.ci ? ci(b.gap.ci.map(v => v * 100), 1) : ''},
        {value: f.refitK.binB === null ? '—' : num(f.refitK.binB, 3), label: 'shrinkage factor refitted on this sample (descriptive; March Polymarket: 0.908)'}]) +
      table('Kalshi, 1 Aug – 10 Sep 2026. Gain: Brier of the post-jump trade price minus Brier of the frozen shrinkage forecast.',
        ['Episodes', 'Jumps', 'Parent events', 'Brier gain [95% CI]', 'Outcome gap [95% CI]'], rows) +
      table('Trade price vs bid-ask midpoint at the first-response minute (same episodes, spread ≤ 10 points)', ['Jumps', 'Episodes', 'Gap, trade price', 'Gap, midpoint'], mid) +
      (four ? table(`Timing control, exploratory (not in the specification): the same ${int(four.n)} jumps of 20+ points scored at four prices, each with the frozen 0.908`, ['Price', 'Outcome gap [95% CI]', 'Brier gain [95% CI]'], timingRows) : '') +
      (broad.length ? table('Jumps of 20+ points by category (groups with at least 20 jumps). "Unmapped" = series newer than the January 2026 topic map, almost all in-game sports', ['Category', 'Jumps', 'Parent events', 'Outcome gap [95% CI]'], broad) : '') +
      quoteFollowUp(q) +
      `<div class="boundary"><strong>Boundary.</strong> Venue, bar length, period and population all differ from the Polymarket cohorts, so a different result cannot be attributed to any one of them. Jumps near a game's end can be the result itself becoming known. News times are inferred from prices; fees and spreads are ignored; a midpoint is not a tradable price.</div>` +
      `<div class="study-actions"><a class="download" href="data/reaction-forward/reaction-forward.json" download>Results · JSON ↓</a>${q ? '<a class="download" href="data/reaction-quotes/reaction-quotes.json" download>Midpoint follow-up · JSON ↓</a>' : ''}</div>`;
  }

  function renderBaseline(d) {
    const o = d.overall;
    const labels = {'1': '1 day before release', '7': '7 days before', '30': '30 days before', KXCCDELINQ: 'Credit-card delinquency (2026)', KXCREDITCDEF: 'Credit-card delinquency (2024 titles)', KXMORTGAGEDEF: 'Mortgage delinquency', KXUSPINCOME: 'Personal income'};
    const rows = [['All observations', o], ...Object.entries(d.byDays), ...Object.entries(d.bySeries)].map(([k, s]) => {
      const better = s.market < s.primary;
      return [esc(labels[k] || k), int(s.n), int(s.releases), `<span class="${better ? 'good' : ''}">${num(s.market)}</span>`, `<span class="${better ? '' : 'good'}">${num(s.primary)}</span>`, num(s.empirical)];
    });
    const obs = d.observations.map(i => [esc(i.ticker), int(i.days), num(i.market, 2), num(i.primary, 2), i.outcome ? 'Yes' : 'No']);
    return head('10 · CONSUMER CREDIT VS A FROZEN BASELINE', 'Consumer-credit markets did not beat a history-only baseline', 'baseline') +
      `<p class="finding">On the ${int(o.n)} comparable forecasts (${int(o.releases)} publications), a baseline using only each series as published the day before (a random walk for delinquency rates, a trailing average for income growth) scored Brier ${num(o.primary)} against the markets' ${num(o.market)}, and had the smaller error on ${int(o.baselineBetterCount)} of ${int(o.n)}. Markets did better on the 2024 credit-card contracts and on 7-day income; worse on mortgage delinquency and the 2026 card releases.</p>` +
      metrics([
        {value: num(o.market), label: 'market Brier (contract-weighted)'},
        {value: num(o.primary), label: 'baseline Brier, same observations'},
        {value: `${num(o.marketEqualRelease)} vs ${num(o.primaryEqualRelease)}`, label: 'market vs baseline, equal weight per publication', text: true},
        {value: `${int(o.baselineBetterCount)} of ${int(o.n)}`, label: 'observations where the baseline was closer'}]) +
      table('Brier score by lead and series (lower is better; the better of market and primary baseline is in green)', ['Group', 'Obs.', 'Publications', 'Market', 'Baseline', 'Empirical changes'], rows) +
      `<details class="figure"><summary>All ${int(d.observations.length)} observations</summary>${table('Probability of YES the stated number of days before release', ['Contract', 'Days', 'Market', 'Baseline', 'Outcome'], obs)}</details>` +
      `<div class="boundary"><strong>Boundary.</strong> Ten publications cannot separate the two forecasts statistically, and thresholds on one release move together. Most observations are nowcasts of a period that had already ended. Nothing here applies to a lender, credit-score band or loan losses. ALFRED's first releases reproduce all ${int(d.verification.length)} recorded outcomes.</div>` +
      `<div class="study-actions"><a class="download" href="data/consumer-baseline/comparison.json" download>Comparison · JSON ↓</a></div>`;
  }

  const studies = [
    ['clocks', ['data/news-clock/clock-audit.json', 'data/news-clock/sports-clock.json', 'data/news-clock/election-clock.json', 'data/news-clock/polymarket-election-clock.json'], renderClocks],
    ['election', ['data/election-effect/election-effect.json', 'data/election-effect/raw-trades-check.json', 'data/election-effect/polymarket-effect.json'], renderElectionEffect],
    ['reaction', ['data/reaction-oos/reaction-oos.json'], renderReaction],
    ['forward', ['data/reaction-forward/reaction-forward.json', 'data/reaction-quotes/reaction-quotes.json'], typeof renderForward === 'function' ? renderForward : null],
    ['baseline', ['data/consumer-baseline/comparison.json'], renderBaseline]].filter(s => s[2] && document.getElementById(s[0]));
  const status = document.getElementById('load-status');
  let done = 0, failed = 0;
  // A self-contained report (tools/build_followup_report.py) embeds the same JSON instead of fetching it.
  const load = url => {
    const embedded = window.ATLAS_FOLLOWUPS && window.ATLAS_FOLLOWUPS[url];
    return embedded ? Promise.resolve(embedded) : fetch(url).then(r => { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); });
  };
  studies.forEach(([id, urls, render]) => {
    const section = document.getElementById(id);
    Promise.all(urls.map(load))
      .then(data => { section.innerHTML = render(...data); section.classList.remove('pending'); })
      .catch(error => {
        failed += 1;
        section.innerHTML = id === 'forward'
          ? `<h2 id="${id}-title">09 · Forward, Kalshi</h2><p class="empty">Results not yet published; the frozen specification is in <code>studies/reaction-forward/SPEC.md</code>.</p>`
          : `<h2 id="${id}-title">Could not load this study</h2><p class="empty">${esc(error.message)}</p>`;
      })
      .finally(() => {
        done += 1;
        // Failures are counted as failures, not as loaded (review round 1, R1-8).
        status.textContent = done < studies.length ? `Loaded ${done} of ${studies.length}…`
          : failed ? `${studies.length - failed} of ${studies.length} studies loaded from saved outputs; ${failed} failed.`
          : `${studies.length} studies loaded from saved outputs.`;
      });
  });
})();
