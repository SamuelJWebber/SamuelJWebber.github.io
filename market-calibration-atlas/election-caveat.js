'use strict';
// Election-clock caveat for the main dashboard (follow-up study 11; review round 1, finding R1-1).
// Some venues' rows for "days before cutoff" contain 2024 US election prices traded after the polls closed: Kalshi
// kept its 2024 election contracts open until certification (up to 75 days), and some Polymarket election questions
// were scheduled to end weeks after Election Day. For a Kalshi, Polymarket or All markets row that contains such
// prices, this shows how many there are and the same row without them. The numbers come from the files in SOURCES
// (studies/election-effect/election_effect.py and polymarket_effect.py); the imported aggregates under data/<venue>/
// are not changed.
(function () {
  const SOURCES = ['data/election-effect/dashboard-caveat.json', 'data/election-effect/dashboard-caveat-polymarket.json'];
  const STUDY = 'followups.html#election';
  const NAMES = {kalshi: 'Kalshi', polymarket: 'Polymarket'};
  const WHY = {kalshi: 'Kalshi kept its 2024 election contracts open until certification, weeks after the result was known',
    polymarket: 'some Polymarket election questions (popular-vote margins, seat counts and other national results) were scheduled to end weeks after Election Day'};
  let token = 0;

  // Dashboard row s = [contracts, events, brier, winRate, bias] without the subset
  // c = [contracts, sumSquaredError, wins, sumPrice, eventsRemoved]. Exact apart from the row's 6-decimal rounding.
  function without(s, c) {
    const [n, events, brier, win, bias] = s, [k, sse, wins, sumPrice, removed] = c;
    const m = n - k;
    if (!(m > 0)) return null;
    const winRate = (win * n - wins) / m, meanPrice = ((win - bias) * n - sumPrice) / m;
    return {contracts: m, events: events - removed, brier: (brier * n - sse) / m, winRate, meanPrice, bias: winRate - meanPrice};
  }

  // files: one caveat file or a list of them. Each covers its meta.venues (its own venue and the pooled "all").
  // Returns {sum: c, parts: {venue: contracts}} for the row, or null when no file has post-election prices there.
  function lookup(files, venue, topic, day) {
    if (!topic) return null;
    const sum = [0, 0, 0, 0, 0], parts = {};
    for (const f of [].concat(files)) {
      if (!f || !f.meta || !f.meta.venues.includes(venue)) continue;
      const entry = f.topics[topic.name];
      if (!entry || entry.kind !== topic.kind) continue;
      const c = entry.days[String(day)];
      if (!c) continue;
      c.forEach((v, i) => { sum[i] += v; });
      parts[f.meta.venue || 'kalshi'] = c[0];
    }
    return sum[0] ? {sum, parts} : null;
  }

  // Plain-text note for a row; every value in it is a number formatted here or a fixed string.
  function describe(s, found, venue) {
    const c = found.sum, w = without(s, c), share = c[0] / s[0];
    const count = v => v.toLocaleString('en-US');
    const pct = v => (100 * v).toFixed(v < 0.1 ? 1 : 0) + '%';
    const gap = v => (v > 0 ? '+' : '') + (100 * v).toFixed(2) + ' pp';
    const venues = Object.keys(found.parts);
    const who = venue === 'all'
      ? '2024 US election contracts (' + venues.map(v => NAMES[v] + ' ' + count(found.parts[v])).join(', ') + ')'
      : '2024 US election contracts';
    const why = venues.map(v => WHY[v]).join(', and ');
    let text = `Election clock: ${count(c[0])} of the ${count(s[0])} contracts in this row (${pct(share)}) are ${who} priced after the first polls closed on 5 November 2024. ` +
      `${why.charAt(0).toUpperCase() + why.slice(1)}, so for them "days before cutoff" is not days before the result. `;
    const digits = w && Math.abs(w.brier - s[2]) < 0.0005 ? 4 : 3;  // show a small difference instead of hiding it
    text += w ? `Without them, this row has a Brier score of ${w.brier.toFixed(digits)} (shown: ${s[2].toFixed(digits)}), a favorite win rate of ${(100 * w.winRate).toFixed(2)}% and a signed bias of ${gap(w.bias)} on ${count(w.contracts)} contracts.`
      : 'Every contract in this row is one of them.';
    return {share, text, without: w};
  }

  async function render(ctx, record) {
    const mine = ++token;
    let host = document.getElementById('election-caveat');
    const kpis = document.getElementById('kpis');
    if (!host && kpis) {
      host = document.createElement('div');
      host.id = 'election-caveat';
      host.className = 'empty';
      host.setAttribute('role', 'note');
      host.hidden = true;
      kpis.parentNode.insertBefore(host, kpis);
    }
    if (!host) return;
    const s = record && record.s;
    if (!s || !['kalshi', 'polymarket', 'all'].includes(ctx.venue) || !ctx.topic) { host.hidden = true; return; }
    const files = await Promise.all(SOURCES.map(src => ctx.readJSON(src).catch(() => null)));
    if (mine !== token) return;
    const found = lookup(files, ctx.venue, ctx.topic, ctx.day);
    if (!found) { host.hidden = true; return; }
    const d = describe(s, found, ctx.venue);
    host.replaceChildren(document.createTextNode(d.text + ' '));
    const link = document.createElement('a');
    link.href = STUDY;
    link.textContent = 'Study 11: election clock on the dashboard →';
    host.append(link);
    host.hidden = false;
  }

  window.AtlasElectionCaveat = {SOURCES, without, lookup, describe, render};
})();
