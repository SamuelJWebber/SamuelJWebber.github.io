/* Query the observed, unrounded probability at a single forecast horizon. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const validPct = value => Number.isFinite(value) && value >= 0 && value <= 100;
  // Percent scale, with 12 decimal places to unify floating-point complements.
  const stablePct = value => Number(value.toFixed(12));
  const pctLabel = value => String(stablePct(value)) + '%';
  let latestContext, generation = 0;

  function accumulator() {
    return {n:0, wins:0, sum:0, eventIds:new Set(), distinct:0};
  }

  function include(bucket, event, price, n, wins) {
    bucket.n += n;
    bucket.wins += wins;
    bucket.sum += price * n;
    if (event === null) bucket.distinct += n;
    else bucket.eventIds.add(event);
  }

  async function scan(ctx, venue, topic, day, side, collect) {
    if (!Number.isInteger(day) || day < 1 || !topic || day > topic.maxDays) return;
    if (venue === 'all') {
      for (const source of ctx.venues) {
        if (source.id === 'all') continue;
        const local = ctx.metas[source.id].topics.find(t => t.kind === topic.kind && t.name === topic.name);
        if (!local) continue;
        await scan(ctx, source.id, local, day, side, (event, price, n, wins, probability) => {
          // Exchanges assign their own event IDs. Null rows already count unique singletons.
          collect(event === null ? null : source.id + '/' + event, price, n, wins, probability);
        });
      }
      return;
    }
    const block = Math.floor((day - 1) / 7);
    const rows = (await ctx.loadData(venue, 'windows/' + block))[day] || [];
    const col = topic.kind === 'all' ? -1 : topic.kind === 'broad' ? 1 : 0;
    const topicId = Number(topic.id);
    for (const row of rows) {
      if (col >= 0 && row[col] !== topicId) continue;
      const [, , event, price, n, wins] = row;
      const flip = side === 'favorite' && price < 0.5;
      const chosen = flip ? 1 - price : price;
      const probability = stablePct(chosen * 100);
      if (side === 'favorite' && probability < 51) continue;
      collect(event, chosen, n, flip ? n - wins : wins, probability);
    }
  }

  function winInterval(n, wins, events, singletonN, singletonWins, eventTotals) {
    if (events < 20 || wins === 0 || wins === n) return null;
    const rate = wins/n;
    let squares = singletonWins*(1-rate)**2 + (singletonN-singletonWins)*rate**2;
    for (const [contracts,winners] of eventTotals.values()) squares += (winners-contracts*rate)**2;
    if (squares <= Number.EPSILON) return null;
    const se = Math.sqrt(events/(events-1)*squares)/n;
    // Cornish-Fisher expansion of the two-sided 95% Student t critical value.
    const z = 1.959963984540054, df = events-1;
    const t = z+(z**3+z)/(4*df)+(5*z**5+16*z**3+3*z)/(96*df**2)+
      (3*z**7+19*z**5+17*z**3-15*z)/(384*df**3);
    return [Math.max(0,rate-t*se),Math.min(1,rate+t*se)];
  }

  async function query(ctx, venue, topic, day, side, center, radius) {
    if (!validPct(center) || !validPct(radius)) throw RangeError('Use a target and radius between 0 and 100.');
    const lo = stablePct(Math.max(side === 'favorite' ? 51 : 0, center - radius));
    const hi = stablePct(Math.min(100, center + radius));
    const bucket = accumulator(), eventTotals = new Map();
    let singletonWins = 0;
    if (lo <= hi) await scan(ctx, venue, topic, day, side, (ev,p,n,w,probability) => {
      if (probability < lo || probability > hi) return;
      include(bucket,ev,p,n,w);
      if (ev === null) singletonWins += w;
      else {
        if (!eventTotals.has(ev)) eventTotals.set(ev,[0,0]);
        const total = eventTotals.get(ev); total[0] += n; total[1] += w;
      }
    });
    const events = bucket.eventIds.size + bucket.distinct;
    const ci = winInterval(bucket.n,bucket.wins,events,bucket.distinct,singletonWins,eventTotals);
    return {
      lo, hi, n:bucket.n, events, wins:bucket.wins, ci,
      p:bucket.n ? bucket.sum / bucket.n : null, y:bucket.n ? bucket.wins / bucket.n : null
    };
  }

  function formatRows(buckets) {
    return [...buckets].sort(([a],[b]) => a - b).map(([price,b]) =>
      [price,b.n,b.distinct + b.eventIds.size,b.sum / b.n,b.wins]);
  }

  async function exactRows(ctx, venue, topic, day) {
    const buckets = new Map();
    await scan(ctx, venue, topic, day, 'favorite', (ev,p,n,w,price) => {
      if (!buckets.has(price)) buckets.set(price, accumulator());
      include(buckets.get(price),ev,p,n,w);
    });
    return formatRows(buckets);
  }

  async function bins(ctx, venue, topic, day, side, width) {
    if (![1,2,5,10].includes(width)) throw RangeError('Unsupported band width.');
    const buckets = new Map();
    await scan(ctx, venue, topic, day, side, (ev,p,n,w) => {
      // Match the established 10-cent band's round-off treatment at decimal boundaries.
      const lower = Math.min(100 - width, width * Math.floor(p * (100 / width) + 1e-12));
      if (!buckets.has(lower)) buckets.set(lower, accumulator());
      include(buckets.get(lower),ev,p,n,w);
    });
    return formatRows(buckets);
  }

  function attach() {
    const panel = document.createElement('section');
    panel.className = 'panel price-window';
    panel.id = 'price-window';
    panel.innerHTML = '<div class="sectionhead"><div><div class="eyebrow">FAVORITE OUTCOMES</div>'+
      '<h2>Look up a probability</h2></div><button type="button" class="export" id="window-export">Download CSV ↓</button></div>'+
      '<div class="rowcontrols"><label>Quoted chance (%) <input id="window-center" type="number" min="51" max="100" step="any" value="70"></label>'+
      '<label>Price match <select id="window-match"><option value="exact" selected>Exact price</option><option value="within">Within ±</option></select></label>'+
      '<label id="window-width-label" hidden>Within ± (points) <input id="window-radius" type="number" min="0" max="100" step="any" value="1"></label></div>'+
      '<div id="window-result" class="window-result" aria-live="polite"></div>'+
      '<p class="hint window-foot">Each contract contributes its higher-priced side at 51% or above. Exact prices retain fractional cents. Ranges include both endpoints. These historical forecast prices include no adjustment for spreads or fees. <a href="#spreads">See the historical quote comparison →</a></p>';
    $('kpis').after(panel);
    const params = new URLSearchParams(location.search);
    const target = Number(params.get('target'));
    if (validPct(target) && target >= 51) $('window-center').value = String(target);
    const radius = Number(params.get('radius'));
    const within = params.get('wmatch') === 'within' || (!params.has('wmatch') && radius > 0);
    if (within) {
      $('window-match').value = 'within';
      if (params.has('radius') && validPct(radius)) $('window-radius').value = String(radius);
    }
    for (const id of ['window-center','window-radius','window-match']) {
      $(id).addEventListener(id==='window-match'?'change':'input', () => render(latestContext,true));
    }
  }

  async function render(ctx, saveURL = false) {
    latestContext = ctx;
    if (!$('price-window')) attach();
    const token = ++generation;
    const exact = $('window-match').value === 'exact', side = 'favorite';
    const center = $('window-center').valueAsNumber, radius = exact ? 0 : $('window-radius').valueAsNumber;
    const output = $('window-result'), button = $('window-export');
    $('window-width-label').hidden = exact;
    button.disabled = true;
    if (!validPct(center) || !validPct(radius) || center < Number($('window-center').min)) {
      output.textContent = 'Choose a target from ' + $('window-center').min + '% to 100% and a width from 0 to 100 points.';
      return;
    }
    if (saveURL) {
      const url = new URL(location.href);
      url.searchParams.delete('wside');
      for (const [k,v] of Object.entries({target:center,radius,wmatch:$('window-match').value})) url.searchParams.set(k,v);
      history.replaceState(null,'',url);
    }
    output.textContent = 'Checking prices…';
    try {
      const result = await query(ctx,ctx.venue,ctx.topic,ctx.day,side,center,radius);
      if (generation !== token) return;
      const {lo,hi,n,wins,p,y,events,ci} = result;
      const range = lo === hi ? 'Exactly ' + pctLabel(lo) : pctLabel(lo) + ' to ' + pctLabel(hi);
      if (!n) { output.textContent = range + ' · No qualifying contracts at this horizon.'; return; }
      const ints = ctx.formatInt, pct = ctx.formatPct;
      const rangeLine = document.createElement('div');
      rangeLine.className = 'window-range';
      rangeLine.textContent = range + ' · ' + ctx.day + (ctx.day === 1 ? ' day' : ' days') + ' out';
      const rate = document.createElement('strong');
      rate.textContent = pct(y) + ' won';
      const details = document.createElement('p');
      details.textContent = ints(wins) + ' of ' + ints(n) + ' contracts across ' + ints(events) +
        (events === 1 ? ' event' : ' events') + '. Average quoted chance ' + pct(p) + ' (' + ctx.formatGap(y-p) + ' observed minus quoted).';
      output.replaceChildren(rangeLine,rate,details);
      if (ci) {
        const interval = document.createElement('p');
        interval.className = 'hint';
        interval.textContent = 'Approximate 95% range for the win rate is '+pct(ci[0])+' to '+pct(ci[1])+
          (ctx.venue === 'all'
            ? ', grouping related contracts within each venue. The same event may be listed on several venues.'
            : ', accounting for contracts on the same event.');
        output.append(interval);
      }
      button.disabled = false;
      button.onclick = () => ctx.exportCSV(ctx.venue+'-day-'+ctx.day+'-topic-'+ctx.topic.id+'-probability-window',
        ['venue','topic','days','side','target_pct','radius_pp','lower_pct_inclusive','upper_pct_inclusive','mean_quoted_probability','observed_win_rate','gap_pp','wins','contracts','events','event_clustered_95_lower','event_clustered_95_upper'],
        [[ctx.venue,ctx.topic.name,ctx.day,side,center,radius,lo,hi,p,y,(y-p)*100,wins,n,events,ci?.[0],ci?.[1]]]);
    } catch (_) {
      if (generation === token) output.textContent = 'Could not load this probability window. Reload to retry.';
    }
  }
  window.AtlasWindows = {query,bins,exactRows,render};
})();
