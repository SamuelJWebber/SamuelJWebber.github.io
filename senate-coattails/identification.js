'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const controls = ['margin', 'search', 'twofold'];
  const format = value => Number(value).toLocaleString('en-US');
  let audit;

  function cell(row, value, className) {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = value;
    row.append(td);
    return td;
  }

  function render() {
    if (!audit) return;
    const band = Number(byId('margin').value);
    const twofold = byId('twofold').checked;
    const query = byId('search').value.trim().toLowerCase();
    const source = (audit.cases || []).filter(c => Number(c.margin) <= band + 1e-9);
    const cohort = source.filter(c => !twofold || (c.zero_low_money || Number(c.ratio) >= 2));
    const aggregate = (audit.cohorts || []).find(c => Number(c.band) === band);
    const n = twofold ? cohort.length : (aggregate?.n ?? cohort.length);
    const states = twofold ? new Set(cohort.map(c => c.state)).size : (aggregate?.states ?? new Set(cohort.map(c => c.state)).size);
    const highWins = twofold ? cohort.filter(c => Number(c.high_won) === 1).length : (aggregate?.high_wins ?? cohort.filter(c => Number(c.high_won) === 1).length);
    byId('n').textContent = format(n);
    byId('states').textContent = format(states);
    byId('high-wins').textContent = format(highWins);
    const cases = cohort.filter(c => [c.year, c.state, c.party, c.high, c.low].join(' ').toLowerCase().includes(query))
      .sort((a, b) => Number(b.year) - Number(a.year) || String(a.state).localeCompare(String(b.state)));
    byId('row-count').textContent = `${format(cases.length)} shown${query ? ' · search filters the table only' : ''}`;
    const body = byId('cases');
    body.replaceChildren();
    for (const c of cases) {
      const tr = document.createElement('tr');
      const election = cell(tr, '', 'election');
      const strong = document.createElement('strong'); strong.textContent = `${c.state} · ${c.year}`;
      const party = document.createElement('span'); party.textContent = ({dem:'Democratic', rep:'Republican', D:'Democratic', R:'Republican'})[c.party] || c.party || '';
      election.append(strong, party);
      cell(tr, c.high || 'Not available');
      cell(tr, c.low || 'Not available');
      cell(tr, `${Number(c.margin).toFixed(2)} pp`, 'numeric');
      cell(tr, c.zero_low_money ? 'Other = $0' : c.ratio == null ? 'Unavailable' : `${Number(c.ratio).toFixed(2)}×`, 'numeric');
      const resultCell = cell(tr, '');
      const badge = document.createElement('span');
      const won = Number(c.high_won) === 1;
      badge.className = `result ${won ? 'win' : 'lose'}`;
      badge.textContent = won ? 'Higher-money won' : 'Higher-money lost';
      resultCell.append(badge);
      cell(tr, c.verification || 'Source join · further verification needed', 'verification');
      body.append(tr);
    }
    if (!cases.length) {
      const tr = document.createElement('tr');
      const td = cell(tr, 'No comparisons match these filters.', 'empty'); td.colSpan = 7;
      body.append(tr);
    }
    const date = audit.updated ? ` Audit updated ${audit.updated}.` : '';
    byId('data-foot').textContent = 'Margin is the difference between the top two candidates’ shares after restricting votes to those two candidates. All counts are provisional feasibility counts; runoff-rule states are quarantined.' + date;
  }

  controls.forEach(id => byId(id).addEventListener(id === 'search' ? 'input' : 'change', render));
  fetch('data/identification-audit.json')
    .then(response => { if (!response.ok) throw new Error('Audit data unavailable'); return response.json(); })
    .then(data => { audit = data; render(); })
    .catch(() => {
      byId('row-count').textContent = 'The audit data could not load.';
      const tr = document.createElement('tr');
      const td = cell(tr, 'Please reload, or use the download link below.', 'empty'); td.colSpan = 7;
      byId('cases').replaceChildren(tr);
    });
})();
