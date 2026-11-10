(() => {
  'use strict';
  const dataUrl = new URL('data/elections.json', document.currentScript?.src || document.baseURI);
  const pageSize = 8;
  const mounts = new WeakMap();
  const states = Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(line => line.split(':')));
  const partyName = { D: 'Democratic', R: 'Republican' };
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const points = n => (n < 0 ? '−' : n > 0 ? '+' : '') + Math.abs(n).toFixed(1);
  const percent = n => n.toFixed(1) + '%';
  const plain = text => text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, '');
  const number = n => n.toLocaleString('en-US');

  function saveCsv(rows) {
    const headers = ['candidate','state','election_year','senator_party','prior_election_year','prior_senate_overperformance_pp','current_senate_overperformance_pp','mean_same_party_house_two_party_pct','house_districts_in_sample','same_party_governor_two_party_pct'];
    const cells = rows.map(r => [r.name,r.state,r.year,r.party,r.year-6,r.prior,r.current,r.house,r.seats,r.governor ?? '']);
    const csv = [headers,...cells].map(line => line.map(v => '"' + String(v).replaceAll('"','""') + '"').join(',')).join('\r\n');
    const href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'senate-coattails-filtered-elections.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1500);
  }

  function build(element, data) {
    const rows = data.races;
    const meta = data.coverage;
    const stateOptions = [...new Set(rows.map(r => r.state))].sort((a,b) => states[a].localeCompare(states[b]));
    element.innerHTML = `
      <form class="ce-filters" role="search" aria-label="Search and filter elections">
        <label class="ce-search">Senator
          <span class="ce-search-field"><svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8.5" cy="8.5" r="5.6"/><path d="m13 13 4 4"/></svg><input type="search" name="candidate" placeholder="Search by name" autocomplete="off"></span>
        </label>
        <label>State<select name="state"><option value="">All states</option>${stateOptions.map(code => `<option value="${code}">${states[code]}</option>`).join('')}</select></label>
        <label>Party<select name="party"><option value="">Both parties</option><option value="D">Democratic</option><option value="R">Republican</option></select></label>
        <label>Sort by<select name="sort"><option value="recent">Newest election</option><option value="oldest">Oldest election</option><option value="strong">Highest prior score</option><option value="weak">Lowest prior score</option></select></label>
      </form>
      <div class="ce-summary"><span class="ce-count" role="status" aria-live="polite" aria-atomic="true"></span><button type="button" class="ce-download"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v9m-3-3 3 3 3-3M2 11v3h12v-3"/></svg>Download CSV</button></div>
      <div class="ce-results"></div>
      <div class="ce-pagination"><span class="ce-pages"></span><span class="ce-page-actions"><button type="button" data-nav="-1">Previous</button><button type="button" data-nav="1">Next</button></span></div>
      <p class="ce-coverage">${number(meta.houseRaces)} repeat Senate elections in ${meta.states} states, ${meta.first}–${meta.last}. Governor returns match ${meta.governorMatches} of these elections. The full governor analysis also includes ${meta.governorRaces-meta.governorMatches} Vermont elections outside this House sample.</p>`;
    const form = element.querySelector('form');
    const results = element.querySelector('.ce-results');
    const count = element.querySelector('.ce-count');
    const download = element.querySelector('.ce-download');
    const pagination = element.querySelector('.ce-pagination');
    let page = 0;
    let ordered = [];
    let expanded = '';

    function detail(r) {
      const governor = r.governor === null ? 'Outside governor sample' : percent(r.governor);
      return `<div class="ce-details">
        <dl><div><dt>${r.year-6} Senate overperformance</dt><dd>${points(r.prior)} pp</dd></div>
        <div><dt>${r.year} Senate overperformance</dt><dd>${points(r.current)} pp</dd></div>
        <div><dt>${r.year} House · same party</dt><dd>${percent(r.house)}</dd><span>Mean of ${r.seats} included district${r.seats===1?'':'s'}</span></div>
        <div><dt>${r.year} governor · same party</dt><dd class="${r.governor===null?'ce-missing':''}">${governor}</dd></div></dl>
        <p>Senate figures show points above or below the state and election-cycle benchmark. House and governor figures show observed two-party vote shares for the senator’s party.</p>
      </div>`;
    }

    function render() {
      const first = page * pageSize;
      const visible = ordered.slice(first,first+pageSize);
      count.textContent = ordered.length ? `Showing ${first+1}–${first+visible.length} of ${number(ordered.length)} election${ordered.length===1?'':'s'}` : '0 elections';
      download.disabled = !ordered.length;
      pagination.hidden = ordered.length <= pageSize;
      element.querySelector('.ce-pages').textContent = `Page ${page+1} of ${Math.ceil(ordered.length/pageSize)}`;
      element.querySelector('[data-nav="-1"]').disabled = page === 0;
      element.querySelector('[data-nav="1"]').disabled = first+pageSize >= ordered.length;
      if (!visible.length) {
        results.innerHTML = '<div class="ce-empty"><b>No elections match these filters.</b><button type="button" data-reset>Clear filters</button></div>';
        return;
      }
      results.innerHTML = `<div class="ce-table" role="group" aria-label="Election results">
        <div aria-hidden="true" class="ce-table-head"><span>Senator</span><span>Election</span><span>Prior score</span><span>Current score</span><span></span></div>
        ${visible.map(r => {
          const key = r.state+'-'+r.year;
          const expandedNow = expanded===key;
          return `<div class="ce-record"><button class="ce-row" type="button" data-row="${key}" aria-expanded="${expandedNow}" aria-label="${escape(r.name)}, ${states[r.state]} ${r.year}, ${partyName[r.party]}, prior score ${points(r.prior)} points, current score ${points(r.current)} points">
              <span class="ce-person"><span class="ce-name">${escape(r.name)}</span><span class="ce-party">${partyName[r.party]}</span></span>
              <span class="ce-election"><strong>${r.year}</strong><span>${r.state}</span><span class="ce-mobile-party">· ${r.party}</span></span>
              <span class="ce-score"><span class="ce-mobile-label">Prior</span>${points(r.prior)}</span><span class="ce-score"><span class="ce-mobile-label">Current</span>${points(r.current)}</span>
              <svg class="ce-chevron" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg>
            </button>${expandedNow?detail(r):''}</div>`;
        }).join('')}</div>`;
    }

    function filter() {
      const terms = plain(form.elements.candidate.value).trim().split(/\s+/).filter(Boolean);
      const state = form.elements.state.value;
      const party = form.elements.party.value;
      const order = form.elements.sort.value;
      ordered = rows.filter(r => (!state || r.state===state) && (!party || r.party===party) && terms.every(term => plain(r.name).includes(term)));
      ordered.sort((a,b) => (order==='strong'? b.prior-a.prior : order==='weak'? a.prior-b.prior : order==='oldest'? a.year-b.year : b.year-a.year) || b.year-a.year || a.state.localeCompare(b.state));
      page = 0;
      expanded = '';
      render();
    }
    form.addEventListener('submit', event => event.preventDefault());
    form.elements.candidate.addEventListener('input',filter);
    form.querySelectorAll('select').forEach(select => select.addEventListener('change',filter));
    pagination.addEventListener('click', event => {
      const target = event.target.closest('[data-nav]');
      if (target && !target.disabled) {
        page += Number(target.dataset.nav);
        expanded = '';
        render();
        if (target.disabled) pagination.querySelector('[data-nav]:not(:disabled)')?.focus({preventScroll:true});
      }
    });
    results.addEventListener('click', event => {
      if (event.target.closest('[data-reset]')) {
        form.reset();filter();form.elements.candidate.focus();return;
      }
      const btn = event.target.closest('[data-row]');
      if (btn) {
        expanded = expanded===btn.dataset.row?'':btn.dataset.row;
        render();
        results.querySelector(`[data-row="${btn.dataset.row}"]`)?.focus({preventScroll:true});
      }
    });
    download.addEventListener('click',() => saveCsv(ordered));
    filter();
  }

  function initExplorer(element = document.getElementById('explorer-body')) {
    if (!element) return Promise.resolve();
    if (mounts.has(element)) return mounts.get(element);
    element.classList.add('coattail-explorer');
    element.innerHTML = '<p role="status">Loading election records…</p>';
    const ready = fetch(dataUrl).then(r => {
      if (!r.ok) throw new Error('Could not load records');
      return r.json();
    }).then(data => build(element,data)).catch(() => {
      element.innerHTML = '<p role="status">Election records could not be loaded. <button type="button" class="ce-download">Try again</button></p>';
      mounts.delete(element);
      element.querySelector('button').addEventListener('click',() => initExplorer(element));
    });
    mounts.set(element,ready);
    return ready;
  }
  window.initExplorer = initExplorer;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => initExplorer(),{once:true});
  else initExplorer();
})();
