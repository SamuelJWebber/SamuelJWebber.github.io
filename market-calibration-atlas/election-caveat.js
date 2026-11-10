'use strict';
// Election-clock caveat for the main dashboard (follow-up study 11; review round 1, R1-1; round 2, R2-1/2/3/6).
// Some venues' rows for "days before cutoff" contain 2024 US election prices traded after the polls closed: Kalshi
// kept its 2024 election contracts open until certification (up to 87 days of a row), and some Polymarket election
// questions were scheduled to end weeks after Election Day. For a Kalshi, Polymarket or All markets row that contains
// such prices, this gives how many there are and the same row without them. The numbers come from the files in
// SOURCES (studies/election-effect/election_effect.py and polymarket_effect.py); the imported aggregates under
// data/<venue>/ are not changed.
//
// Views use it three ways: render() writes the note above the Explore summary cards; check() and series() give the
// per-row and per-day numbers that the trend chart, the Charts tab, Compare and the CSV exports mark; text helpers
// keep the wording the same everywhere. If a file a row needs failed to load, check() says so instead of presenting a
// partial count as the whole (R2-6).
(function () {
  const FILES = [
    {path: 'data/election-effect/dashboard-caveat.json', venues: ['kalshi', 'all']},
    {path: 'data/election-effect/dashboard-caveat-polymarket.json', venues: ['polymarket', 'all']}];
  const SOURCES = FILES.map(f => f.path);
  const VENUES = ['kalshi', 'polymarket', 'all'];
  const STUDY = 'followups.html#election';
  const NAMES = {kalshi: 'Kalshi', polymarket: 'Polymarket'};
  const WHY = {kalshi: 'Kalshi kept its 2024 election contracts open until certification, weeks after the result was known',
    polymarket: 'some Polymarket election questions (popular-vote margins, seat counts and other national results) were scheduled to end weeks after Election Day'};
  // Below both of these the note is one muted line (R2-3): share of the row, and change in the row's Brier score.
  const FULL_SHARE = 0.01, FULL_BRIER = 0.001;
  const UNAVAILABLE = 'Election note unavailable: a data file it needs failed to load. Rows for Kalshi, Polymarket and All markets may include 2024 US election prices traded after the result was known. Reload to retry.';
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

  // The caveat files, in SOURCES order; a file that failed to load is null.
  function load(readJSON) {
    return Promise.all(SOURCES.map(src => readJSON(src).catch(() => null)));
  }

  // True when a file that this venue's rows need is missing (files in SOURCES order).
  function missing(files, venue) {
    const list = [].concat(files || []);
    return FILES.some((f, i) => f.venues.includes(venue) && !list[i]);
  }

  // One row: null (venue not covered, or no post-election prices), {unavailable: true}, or the numbers to flag it.
  function check(files, venue, topic, day, s) {
    if (!VENUES.includes(venue) || !topic) return null;
    if (missing(files, venue)) return {unavailable: true};
    const found = lookup(files, venue, topic, day);
    if (!found || !s) return null;
    const k = found.sum[0], w = without(s, found.sum);
    return {contracts: k, rowContracts: s[0], share: k / s[0], without: w, parts: found.parts, found};
  }

  // Every day of a topic's rows (data: {day: {s: [...]}}): {unavailable} or {days: {day: check()}}.
  function series(files, venue, topic, data) {
    if (!VENUES.includes(venue) || !topic) return {unavailable: false, days: {}};
    if (missing(files, venue)) return {unavailable: true, days: {}};
    const days = {};
    for (const [d, record] of Object.entries(data || {})) {
      const c = check(files, venue, topic, +d, record && record.s);
      if (c && !c.unavailable) days[d] = c;
    }
    return {unavailable: false, days};
  }

  const count = v => v.toLocaleString('en-US');
  const pct = v => v > 0 && v < 0.001 ? '<0.1%' : (100 * v).toFixed(v < 0.1 ? 1 : 0) + '%';
  const gap = v => (v > 0 ? '+' : '') + (100 * v).toFixed(2) + ' pp';

  // A short tooltip/table phrase for a flagged point, e.g. "includes 375 prices of 2024 US election contracts traded
  // after the polls closed (76%); without them 0.140".
  function phrase(c, format) {
    const after = c.without && format ? '; without them ' + format(c.without) : '';
    return 'includes ' + count(c.contracts) + ' prices of 2024 US election contracts traded after the polls closed (' + pct(c.share) + ')' + after;
  }

  const topicLabel = t => t.kind === 'broad' ? t.name.replace(/^All /, '') : t.name;
  const dayLabel = d => count(d) + (+d === 1 ? ' day' : ' days');

  // Footnote for views that show a subset of rows or a matched sample at given horizons, where only the full rows'
  // counts are known (landing bars, matched comparisons, Compare, paired Charts). items: [{topic, day, venue?}].
  // Returns '' when no listed row has post-election prices, or UNAVAILABLE when a needed file failed to load.
  function rowsNote(files, venue, items) {
    if (missing(files, venue) && VENUES.includes(venue)) return UNAVAILABLE;
    const groups = new Map();
    for (const {topic, day, venue: own} of items) {
      const v = own || venue;
      if (!VENUES.includes(v) || !topic) continue;
      if (missing(files, v)) return UNAVAILABLE;
      const f = lookup(files, v, topic, day);
      if (!f) continue;
      const name = (own && NAMES[own] ? NAMES[own] + ' ' : '') + topicLabel(topic);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(count(f.sum[0]) + ' at ' + dayLabel(day));
    }
    if (!groups.size) return '';
    return 'Election clock: the full rows include prices of 2024 US election contracts traded after the polls closed on 5 November 2024 (' +
      [...groups].map(([name, list]) => name + ': ' + list.join(', ')).join('; ') + '). A matched or price-filtered sample holds at most that many.';
  }

  // Latest horizon with post-election prices in this venue's rows of a topic, or 0.
  function lastDay(files, venue, topic) {
    let last = 0;
    for (const f of [].concat(files || [])) {
      if (!f || !f.meta || !f.meta.venues.includes(venue) || !topic) continue;
      const entry = f.topics[topic.name];
      if (!entry || entry.kind !== topic.kind) continue;
      for (const d of Object.keys(entry.days)) last = Math.max(last, +d);
    }
    return last;
  }

  // Consecutive day runs as text: [1,2,3,5] -> "1–3 and 5".
  function runs(days) {
    const out = [];
    for (const d of [...days].sort((a, b) => a - b)) {
      const last = out[out.length - 1];
      if (last && d === last[1] + 1) last[1] = d; else out.push([d, d]);
    }
    const text = out.map(([a, b]) => a === b ? String(a) : a + '–' + b);
    return text.length > 1 ? text.slice(0, -1).join(', ') + ' and ' + text[text.length - 1] : text.join('');
  }

  // A <p class="election-flag"> with the given id, created after `anchor` if needed; hidden when text is empty.
  function footnote(id, anchor, text, key) {
    let p = document.getElementById(id);
    if (!p && anchor) {
      p = document.createElement('p');
      p.id = id;
      p.className = 'election-flag';
      anchor.after(p);
    }
    if (!p) return null;
    p.replaceChildren();
    p.hidden = !text;
    if (!text) return p;
    if (key) {
      const mark = document.createElement('span');
      mark.className = key;
      mark.setAttribute('aria-hidden', 'true');
      p.append(mark);
    }
    const link = document.createElement('a');
    link.href = STUDY;
    link.textContent = 'Study 11 →';
    p.append(document.createTextNode(text + ' '), link);
    return p;
  }

  // Plain-text note for a row; every value in it is a number formatted here or a fixed string.
  function describe(s, found, venue) {
    const c = found.sum, w = without(s, c), share = c[0] / s[0];
    const venues = Object.keys(found.parts);
    const who = venue === 'all'
      ? '2024 US election contracts (' + venues.map(v => NAMES[v] + ' ' + count(found.parts[v])).join(', ') + ')'
      : '2024 US election contracts';
    const full = !w || share >= FULL_SHARE || Math.abs(w.brier - s[2]) >= FULL_BRIER;
    const digits = w && Math.abs(w.brier - s[2]) < 0.0005 ? 4 : 3;  // show a small difference instead of hiding it
    if (!full) {
      return {share, full, without: w,
        text: `Election clock: ${count(c[0])} of the ${count(s[0])} contracts in this row (${pct(share)}) are ${who} priced after the polls closed on 5 November 2024. Without them the Brier score is ${w.brier.toFixed(digits)} (shown: ${s[2].toFixed(digits)}).`};
    }
    const why = venues.map(v => WHY[v]).join(', and ');
    let text = `Election clock: ${count(c[0])} of the ${count(s[0])} contracts in this row (${pct(share)}) are ${who} priced after the first polls closed on 5 November 2024. ` +
      `${why.charAt(0).toUpperCase() + why.slice(1)}, so for them "days before cutoff" is not days before the result. `;
    text += w ? `Without them, this row has a Brier score of ${w.brier.toFixed(digits)} (shown: ${s[2].toFixed(digits)}), a favorite win rate of ${(100 * w.winRate).toFixed(2)}% and a signed bias of ${gap(w.bias)} on ${count(w.contracts)} contracts.`
      : 'Every contract in this row is one of them.';
    return {share, full, text, without: w};
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
    if (!s || !VENUES.includes(ctx.venue) || !ctx.topic) { host.hidden = true; return; }
    const files = ctx.caveat || await load(ctx.readJSON);
    if (mine !== token) return;
    const c = check(files, ctx.venue, ctx.topic, ctx.day, s);
    if (!c) { host.hidden = true; return; }
    const link = document.createElement('a');
    link.href = STUDY;
    if (c.unavailable) {
      host.className = 'empty';
      host.replaceChildren(document.createTextNode(UNAVAILABLE + ' '));
    } else {
      const d = describe(s, c.found, ctx.venue);
      host.className = d.full ? 'empty' : 'empty election-caveat-minor';
      host.replaceChildren(document.createTextNode(d.text + ' '));
    }
    link.textContent = 'Study 11: election clock on the dashboard →';
    host.append(link);
    host.hidden = false;
  }

  window.AtlasElectionCaveat = {SOURCES, FILES, VENUES, FULL_SHARE, FULL_BRIER, UNAVAILABLE, STUDY, without, lookup, load,
    missing, check, series, describe, phrase, pct, rowsNote, lastDay, runs, footnote, render};
})();
