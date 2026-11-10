'use strict';

const byId = id => document.getElementById(id);
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const number = value => Number(value).toLocaleString('en-US', {maximumFractionDigits: 2});
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value))}`;
const external = (label, href) => {
  const a = make('a', label);
  try {
    const url = new URL(href);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      a.href = url.href; a.target = '_blank'; a.rel = 'noopener';
    }
  } catch (_) { /* Missing source URLs remain plain text. */ }
  return a;
};
const score = (question, metric) => {
  const own = Number(question.pct), opponent = Number(question.opponent_pct);
  if (metric === 'margin') return own - opponent;
  if (metric === 'two_party') return 100 * own / (own + opponent);
  return own;
};
const displayNames = {
  'LAMONT, EDWARD M': 'Edward Lamont', 'LIEBERMAN, JOSEPH': 'Joseph Lieberman',
  'TING, JAN': 'Jan Ting', 'PROTACK, MICHAEL D': 'Michael Protack',
  'CARDIN, BENJAMIN L': 'Benjamin Cardin', 'MFUME, KWEISI': 'Kweisi Mfume',
  'REED, CHRISTOPHER': 'Christopher Reed', 'EICHHORN, GEORGE SCOTT': 'George Eichhorn',
  'CARTER, NICHOLAS H': 'Nicholas Carter', 'GOODENOUGH, KEITH': 'Keith Goodenough',
  'MILLER, JOSEPH W': 'Joseph Miller', 'MURKOWSKI, LISA': 'Lisa Murkowski',
  'Lincoln, Blanche Lambert': 'Blanche Lincoln', 'Halter, Bill': 'Bill Halter',
  'Perdue, David Alfred': 'David Perdue', 'Kingston, J. H. "Jack"': 'Jack Kingston',
  'SCHATZ, BRIAN EMANUEL': 'Brian Schatz', 'HANABUSA, COLLEEN WAKAKO': 'Colleen Hanabusa',
  'Cochran, Thad': 'Thad Cochran', 'McDaniel, Chris': 'Chris McDaniel',
  'PAIGE, H BROOKE': 'H. Brooke Paige', 'ZUPAN, LAWRENCE': 'Lawrence Zupan',
  'MCGRATH, AMY': 'Amy McGrath', 'BOOKER, CHARLES': 'Charles Booker',
  'Hegar, Mary "MJ"': 'MJ Hegar', 'West, Royce': 'Royce West'
};
const displayName = name => displayNames[String(name).trim()] || name;

let evidence;

function renderPoll() {
  const example = evidence.examples[Number(byId('poll-case').value)];
  if (!example) return;
  const metric = byId('poll-metric').value;
  const root = byId('poll-example'); root.replaceChildren();
  const heading = make('div', undefined, 'poll-heading');
  const title = make('div');
  title.append(make('div', `${example.state} · ${example.cycle}`, 'eyebrow'));
  title.append(make('h3', example.pollster));
  title.append(make('p', `${example.field_start} to ${example.field_end} · ${number(example.n)} respondents${example.population ? ` · ${example.population}` : ''}`));
  heading.append(title, external('Original survey ↗', example.source_url)); root.append(heading);

  const groups = new Map();
  for (const q of example.questions) {
    if (!groups.has(q.opponent)) groups.set(q.opponent, []);
    groups.get(q.opponent).push(q);
  }
  for (const [opponent, questions] of groups) {
    const group = make('section', undefined, 'poll-group');
    group.append(make('p', `Common opponent: ${opponent}`, 'poll-opponent'));
    const cards = make('div', undefined, 'poll-candidates');
    for (const q of questions) {
      const card = make('article', undefined, 'poll-candidate');
      card.append(make('h4', q.candidate));
      const value = make('div', metric === 'margin' ? signed(score(q, metric)) : number(score(q, metric)), 'poll-score');
      value.append(make('small', metric === 'margin' ? 'pp margin' : metric === 'two_party' ? '% two-party share' : '% support'));
      card.append(value, make('p', `${q.candidate}: ${number(q.pct)}% · ${opponent}: ${number(q.opponent_pct)}%`));
      cards.append(card);
    }
    group.append(cards);
    if (questions.length > 1) {
      const ordered = [...questions].sort((a, b) => score(b, metric) - score(a, metric));
      const contrasts = make('div', undefined, 'poll-contrasts');
      for (const q of ordered.slice(1)) {
        const diff = score(ordered[0], metric) - score(q, metric);
        const contrast = make('span', undefined, 'poll-contrast');
        contrast.append(make('strong', `${signed(diff)} pp`));
        contrast.append(document.createTextNode(` ${ordered[0].candidate} versus ${q.candidate}`));
        contrasts.append(contrast);
      }
      group.append(contrasts);
    }
    root.append(group);
  }
  root.append(make('p', example.notes, 'poll-note'));
  root.append(make('p', metric === 'margin'
    ? 'Margin = candidate support minus opponent support. The difference between two margins is not the same quantity as a difference in candidate support.'
    : metric === 'two_party'
      ? 'Two-party share = 100 × candidate support ÷ (candidate support + common opponent support). It excludes undecided and third-party responses. The proposed protocol uses the difference in this share; these displayed point estimates do not include sampling uncertainty.'
      : 'Support gap = one candidate’s support minus their rival’s support in the alternative matchup. Differences are point estimates; their uncertainty is not recovered from toplines alone.', 'poll-disclaimer'));
}

function renderNominations() {
  const body = byId('nomination-rows'); body.replaceChildren();
  for (const event of evidence.nomination_additions || []) {
    const row = make('tr');
    row.append(make('td', `${event.state} ${event.year} · ${event.party}`),
      make('td', event.round), make('td', displayName(event.winner)), make('td', displayName(event.runner_up)),
      make('td', `${number(event.margin_pp)} pp`, 'numeric'));
    const source = make('td'); source.append(external('Source ↗', event.source_url));
    if (event.verification) source.append(make('p', event.verification, 'event-verification'));
    row.append(source); body.append(row);
  }
  if (!body.children.length) { const row = make('tr'); const cell = make('td', 'Nomination audit is available in the download.'); cell.colSpan = 6; row.append(cell); body.append(row); }
}

function renderDataMap() {
  const body = byId('data-rows'); body.replaceChildren();
  for (const item of evidence.data_map || []) {
    const row = make('tr'); row.append(make('td', item.need));
    const source = make('td'); source.append(external(`${item.source} ↗`, item.url));
    const status = make('td'); status.append(make('span', item.status, 'readiness'));
    row.append(source, status, make('td', item.limitation)); body.append(row);
  }
}

async function loadEvidence() {
  try {
    const response = await fetch('data/causal-design.json');
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    evidence = await response.json();
    if (!Array.isArray(evidence.examples) || !evidence.examples.length) throw new Error('No polling examples found');
    const select = byId('poll-case'); select.replaceChildren();
    evidence.examples.forEach((example, i) => {
      const option = make('option', `${example.state} ${example.cycle} · ${example.pollster} · ${example.field_end}`);
      option.value = i; select.append(option);
    });
    select.disabled = false;
    if (evidence.updated) byId('updated').textContent = `Research audit · ${evidence.updated}`;
    if (evidence.stats) {
      for (const [id, key] of [['additional-count', 'additional_close_events'], ['archive-case-count', 'archive_matched_cases'], ['archive-survey-count', 'archive_surveys']]) {
        if (Number.isFinite(Number(evidence.stats[key]))) byId(id).textContent = number(evidence.stats[key]);
      }
    }
    renderPoll(); renderNominations(); renderDataMap();
    select.addEventListener('change', renderPoll); byId('poll-metric').addEventListener('change', renderPoll);
  } catch (error) {
    byId('poll-example').replaceChildren(make('p', 'The interactive data could not load. The proposed experiment is described below; use the audit download for source records.', 'failure'));
    for (const id of ['nomination-rows', 'data-rows']) {
      const cell = byId(id).querySelector('td'); if (cell) cell.textContent = 'Data could not load. See the downloadable audit.';
    }
  }
}

// 2026 cycle panel (added 2026-11-09, studies/senate-2026/nominations). Optional: the page works without it.
async function renderNominations2026() {
  let data;
  try {
    const response = await fetch('data/nominations-2026.json');
    if (!response.ok) return;
    data = await response.json();
  } catch (_) { return; }
  const anchor = byId('nomination-rows') && byId('nomination-rows').closest('details');
  if (!anchor || !Array.isArray(data.events) || !data.events.length) return;
  const within5 = data.events.filter(e => e.margin_pp < 5).length;
  const panel = make('details'); panel.className = 'nomination-details';
  panel.append(make('summary', `2026 cycle: ${within5} decisive Senate and governor nominations within five points (${data.events.length} within ten)`));
  const header = make('div'); header.className = 'table-header';
  header.append(make('h3', '2026 close nominations'), make('p', data.note));
  const scroll = make('div'); scroll.className = 'table-scroll'; scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '2026 close nomination events');
  const table = make('table'); const head = make('thead'); const headRow = make('tr');
  for (const [label, cls] of [['Election'], ['Deciding round'], ['Winner'], ['Runner-up'], ['Margin', 'numeric'], ['Verification and appeal measure']]) headRow.append(make('th', label, cls));
  head.append(headRow); const body = make('tbody');
  for (const e of data.events) {
    const row = make('tr');
    row.append(make('td', `${e.state} 2026 · ${e.party} · ${e.office}`), make('td', e.round), make('td', e.winner), make('td', e.runner_up),
      make('td', `${number(e.margin_pp)} pp`, 'numeric'));
    const cell = make('td'); cell.append(external('Source ↗', e.source_url), make('p', e.verification, 'event-verification'),
      make('p', `Appeal measure in window: ${e.appeal_measure}`, 'event-verification'));
    row.append(cell); body.append(row);
  }
  table.append(head, body); scroll.append(table); panel.append(header, scroll); anchor.after(panel);
}

loadEvidence().then(renderNominations2026);
