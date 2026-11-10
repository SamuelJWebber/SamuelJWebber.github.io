/* Paired comparisons use contracts that qualified on both forecast dates. */
(() => {
  'use strict';
  const count = new Intl.NumberFormat('en-US');
  const days = value => count.format(value) + (+value === 1 ? ' day out' : ' days out');
  const percent = value => (100 * value).toFixed(1) + '%';
  const points = value => (value > 0.0005 ? '+' : '') + (Math.abs(value) < 0.0005 ? '0.0' : (100 * value).toFixed(1)) + ' pp';
  const expected = (values, i) => Number.isFinite(values[6+i]) ? values[4+i] - values[6+i] : null;

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function metricChart(title, hint, observations, maximum, format, upperLabel) {
    const figure = make('figure', 'paired-figure');
    const caption = make('figcaption');
    caption.append(make('strong', '', title), make('span', '', hint));
    figure.append(caption);
    observations.forEach(([horizon, value], index) => {
      const row = make('div', 'paired-row');
      const track = make('div', 'paired-track');
      track.setAttribute('aria-hidden', 'true');
      const bar = make('div', index ? 'paired-bar nearer' : 'paired-bar');
      bar.style.width = 100 * value / maximum + '%';
      track.append(bar);
      row.append(make('span', 'paired-horizon', days(horizon)), track, make('b', 'paired-number', format(value)));
      figure.append(row);
    });
    const axis = make('div', 'paired-axis');
    axis.setAttribute('aria-hidden', 'true');
    axis.append(make('span', '', format(0)), make('span', '', upperLabel));
    figure.append(axis);
    return figure;
  }

  function calibrationHead() {
    const row = make('div', 'calibration-head');
    row.setAttribute('aria-hidden', 'true');
    ['Days out', '0–100%', 'Expected', 'Actual', 'Gap'].forEach(label => row.append(make('span', '', label)));
    return row;
  }

  function calibrationRow(horizon, actual, forecast, index, label) {
    const row = make('div', 'calibration-row');
    const track = make('div', 'paired-track calibration-track');
    track.setAttribute('aria-hidden', 'true');
    const bar = make('div', index ? 'paired-bar nearer' : 'paired-bar');
    bar.style.width = Math.max(0, Math.min(100, 100 * actual)) + '%';
    track.append(bar);
    const hasForecast = Number.isFinite(forecast);
    if (hasForecast) {
      const marker = make('span', 'calibration-marker');
      marker.style.left = Math.max(0, Math.min(100, 100 * forecast)) + '%';
      track.append(marker);
    }
    const gap = actual - forecast;
    const description = days(horizon) + ': ' + (hasForecast ? percent(forecast) + ' expected, ' : '')
      + percent(actual) + ' actual favorite wins' + (hasForecast ? ', gap ' + points(gap) + '.' : '.');
    row.title = (label ? label + ' · ' : '') + description;
    row.setAttribute('aria-label', description);
    const horizonLabel = make('span', 'calibration-horizon', count.format(horizon));
    const expectedLabel = make('span', 'calibration-expected', hasForecast ? percent(forecast) : '—');
    const actualLabel = make('b', 'calibration-actual', percent(actual));
    const gapLabel = make('span', 'calibration-gap', hasForecast ? points(gap) : '—');
    // A signed average gap can conceal offsetting errors, so it is never styled
    // as a pass/fail judgment or described as complete calibration accuracy.
    row.append(horizonLabel, track, expectedLabel, actualLabel, gapLabel);
    return row;
  }

  function calibrationKey(withHorizons, farDay, nearDay) {
    const legend = make('div', 'landing-legend');
    if (withHorizons) legend.append(make('span', 'far', days(farDay)), make('span', 'near', days(nearDay)));
    legend.append(make('span', 'actual', 'Bar: actual wins'), make('span', 'expected', 'Tick: expected wins'));
    return legend;
  }

  function render(container, farDay, nearDay, record) {
    container.querySelector('.paired-charts')?.remove();
    if (!record || !record[0]) return;
    const [, , farScore, nearScore, farWin, nearWin] = record;
    if (![farScore, nearScore, farWin, nearWin].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) return;
    // Keep the 0.25 Brier reference consistent across selections, expanding only
    // when an observed score exceeds it. Both bars on a chart share its scale.
    const scoreMaximum = Math.max(0.25, Math.ceil(4 * Math.max(farScore, nearScore)) / 4);
    const charts = make('div', 'paired-charts');
    const calibration = make('figure', 'paired-figure paired-calibration');
    const caption = make('figcaption');
    caption.append(make('strong', '', 'Expected vs. actual wins'),
      make('span', '', 'Expected is the mean favorite price. Gap = actual minus expected.'));
    calibration.append(caption, calibrationHead(),
      calibrationRow(farDay, farWin, expected(record, 0), 0),
      calibrationRow(nearDay, nearWin, expected(record, 1), 1),
      calibrationKey(false));
    charts.append(
      metricChart('Brier score', 'Lower means smaller forecast errors.', [[farDay, farScore], [nearDay, nearScore]],
        scoreMaximum, value => value.toFixed(3), scoreMaximum.toFixed(2)),
      calibration
    );
    container.prepend(charts);
  }

  function renderCategories(container, summary, ctx, pairs, farDay, nearDay) {
    const key = farDay + '/' + nearDay;
    const allTopics = ctx.metas[ctx.venue].topics;
    const broad = allTopics.filter(t => t.kind === 'broad');
    const topics = ctx.topic.kind !== 'all' ? [ctx.topic]
      : broad.length === 1 ? allTopics.filter(t => t.kind === 'detail') : broad;
    const pooled = pairs[ctx.topic.id]?.[key];
    const venue = ctx.venues.find(v => v.id === ctx.venue).name;
    container.replaceChildren();
    if (!pooled?.[0]) {
      summary.textContent = venue + ' · ' + ctx.topic.name + '. No contracts had a qualifying favorite at both horizons.';
      return;
    }
    const scope = ctx.topic.kind === 'all' ? venue : venue + ' · ' + ctx.topic.name.replace(/^All /, '');
    summary.textContent = scope + ' · ' + count.format(pooled[0]) + ' matched contracts across ' + count.format(pooled[1])
      + ' events. At ' + days(nearDay) + ', favorites won ' + percent(pooled[5])
      + (expected(pooled, 1) === null ? '.' : ' against ' + percent(expected(pooled, 1)) + ' expected (' + points(pooled[7]) + ').');
    const legend = calibrationKey(true, farDay, nearDay);
    const list = make('ul', 'landing-groups');
    const groups = topics.map(t => ({topic:t, values:pairs[t.id]?.[key]}))
      .filter(g => g.values?.[0]).sort((a,b) => b.values[5]-a.values[5]);
    for (const {topic, values} of groups) {
      const label = topic.kind === 'broad' ? topic.name.replace(/^All /, '') : topic.name;
      const item = make('li', 'landing-group');
      const caption = make('div', 'landing-label');
      caption.append(make('strong', '', label), make('small', '', count.format(values[0])
        + (values[0] === 1 ? ' contract' : ' contracts') + ' · ' + count.format(values[1])
        + (values[1] === 1 ? ' event' : ' events')));
      const tracks = make('div', 'landing-tracks');
      tracks.append(calibrationHead(), calibrationRow(farDay, values[4], expected(values, 0), 0, label),
        calibrationRow(nearDay, values[5], expected(values, 1), 1, label));
      item.append(caption,tracks);list.append(item);
    }
    const note = make('p', 'landing-calibration-note',
      'A higher win rate can reflect easier predictions. Compare actual wins with the odds: a positive gap means more favorites won than expected; a negative gap means fewer. Gaps are averages, so over- and underestimates can cancel.');
    container.append(legend,list,note);
  }

  window.PairedBars = {render,renderCategories};
})();
