import {esc, fmt, table, link} from './research-view.mjs';

const dataUrl = new URL('./research/new/calibration.json', import.meta.url);
const count = value => fmt(value, Number.isInteger(Number(value)) ? 0 : 1);
const share = row => `${fmt(100 * row.citi_bikes / row.all_bicycles, 2)}%`;
const inverse = row => row.citi_bikes > 0
  ? `${fmt(row.all_bicycles / row.citi_bikes, 2)}×`
  : 'Not defined';
const siteKey = row => `${row.source}:${row.location_id}`;
const options = (values, selected) => values.map(([value, label]) =>
  `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`
).join('');
const download = (label, filename) =>
  `<a class="btn" href="research/new/${esc(filename)}" download>${esc(label)}</a>`;

/** Show historical local observations without changing the existing calculator. */
export async function renderCalibrationEvidence(rootSelector = '#calibration-evidence') {
  const root = document.querySelector(rootSelector);
  if (!root) return;
  root.innerHTML = '<p class="small" role="status">Loading local bicycle-count evidence…</p>';

  let data;
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (!Array.isArray(data?.dcp?.records)) throw new Error('Missing local count records');
  } catch {
    root.innerHTML = `<div class="research-card"><h3>Local Citi Bike shares</h3><p role="status">The local count data could not be loaded. Please reload to try again.</p><p>${link('DCP on-street bicycle counts', 'https://data.cityofnewyork.us/Transportation/NYCDCP-Manhattan-Bike-Counts-On-Street-Weekday/qfs9-xn8t')}</p></div>`;
    return;
  }

  const rows = data.dcp.records.filter(row =>
    Number.isFinite(row.citi_bikes) && Number.isFinite(row.all_bicycles) &&
    row.all_bicycles > 0 && row.citi_bikes >= 0 && row.citi_bikes <= row.all_bicycles &&
    Number.isFinite(row.year)
  );
  if (!rows.length) {
    root.innerHTML = '<div class="research-card"><h3>Local Citi Bike shares</h3><p role="status">No usable local count records are available.</p></div>';
    return;
  }

  const sites = [...new Map(rows.map(row => [siteKey(row), row])).entries()]
    .sort((a, b) => Number(a[1].location_id) - Number(b[1].location_id));
  const preferred = rows.find(row => row.source === 'dcp_offstreet' && String(row.location_id) === '11') || rows[0];
  const state = {site: siteKey(preferred), day: 'Weekday', year: 2015};
  const zeroCount = rows.filter(row => row.citi_bikes === 0).length;

  root.innerHTML = `<article class="research-card" aria-labelledby="local-calibration-title">
    <div class="minilabel">Fall 2013–2015 · Manhattan field counts</div>
    <h3 id="local-calibration-title">Choose a share from a specific place and period</h3>
    <p>DCP recorded Citi Bikes and all bicycles together at ${sites.length} locations. These historical observations show how coverage varies by place, year and day type.</p>
    <div class="research-controls">
      <label for="calibration-location">Count location<select id="calibration-location"></select></label>
      <label for="calibration-day">Day type<select id="calibration-day"></select></label>
      <label for="calibration-year">Year<select id="calibration-year"></select></label>
    </div>
    <div data-calibration-selection aria-live="polite" aria-atomic="true"></div>
    <div data-calibration-years></div>
    <div data-calibration-days></div>
    <p class="small">Exact survey dates and within-day counting windows are absent from this release. The counts support local shares; no hourly flow is calculated here. All ${zeroCount} recorded zero Citi Bike counts are retained.</p>
    <details>
      <summary>What the newer NYU counts can establish</summary>
      <p>The October 24–25, 2024 study says it recorded electric and pedal Citi Bikes. Its published Appendix C tables instead list personal e-bikes, rental e-bikes, mopeds, pedal bikes, “other bike” and scooters. The report does not explain how Citi Bikes map to those rows.</p>
      <p>These tables provide classified counts for specific two-hour windows. They do not provide an identifiable Citi Bike numerator, so a Citi Bike share remains unavailable. “Other bike” is not treated as Citi Bike.</p>
      <p class="small">${link('NYU report: Appendix C tables, PDF pages 84–86', `${data.nyu?.source_url || 'https://c2smart.engineering.nyu.edu/wp-content/uploads/2026/04/25-38-NYC-Delivery-Worker-Data-Collection-and-Research-Report.pdf'}#page=84`)}. The collection definitions appear in Figure 3, PDF page 23.</p>
    </details>
    <details>
      <summary>Definitions and calculation</summary>
      <p>Share = Citi Bike count ÷ all-bicycle count in the same source record. The inverse share is the number of bicycles per Citi Bike under that observed share. A zero Citi count cannot produce a finite multiplier. Counts of walkers, joggers and other users are excluded from the bicycle denominator.</p>
      <p>The three-year comparison retains the same location and day type. Changes are descriptive: survey conditions and the bike-share network can change between years. This is not a current citywide calibration or a measured lane-conversion effect.</p>
      <p>One source record—Route 9A at 80th Street, weekday 2013—has a 0.5-bicycle discrepancy between component counts and the published total. The published denominator is retained and flagged when selected.</p>
      <p class="small">${link('DCP data dictionary', data.methods?.dictionary_url || 'https://data.cityofnewyork.us/api/views/qfs9-xn8t/files/2ba06c49-0f97-4120-a71a-760730887123')}. Source records and calculation notes are included in the downloads.</p>
    </details>
    <div class="research-downloads">
      ${download('Local shares · CSV', 'dcp-local-shares.csv')}
      ${download('Same-location changes · CSV', 'dcp-same-location-changes.csv')}
      ${download('Other field studies · CSV', 'reference-samples.csv')}
      ${download('Methods', 'METHODS.txt')}${download('Data + code · ZIP', 'bike-reproducibility.zip')}
    </div>
  </article>`;

  const locationControl = root.querySelector('#calibration-location');
  const dayControl = root.querySelector('#calibration-day');
  const yearControl = root.querySelector('#calibration-year');
  locationControl.innerHTML = options(sites.map(([key, row]) =>
    [key, `${row.location} · ${row.location_type}`]), state.site);

  function renderSelection() {
    const siteRows = rows.filter(row => siteKey(row) === state.site);
    const days = [...new Set(siteRows.map(row => row.day_type))].sort();
    if (!days.includes(state.day)) state.day = days.includes('Weekday') ? 'Weekday' : days[0];
    const sameDay = siteRows.filter(row => row.day_type === state.day).sort((a, b) => a.year - b.year);
    const years = sameDay.map(row => row.year);
    if (!years.includes(state.year)) state.year = years.at(-1);
    dayControl.innerHTML = options(days.map(day => [day, day]), state.day);
    yearControl.innerHTML = options(years.map(year => [year, `Fall ${year}`]), state.year);
    const row = sameDay.find(item => item.year === state.year);

    const inverseExplanation = row.citi_bikes > 0
      ? `${fmt(row.all_bicycles / row.citi_bikes, 2)} bicycles per Citi Bike under this historical share.`
      : 'No Citi Bikes were recorded in this sample. Inverse scaling is unavailable.';
    const quality = row.data_quality_flags
      ? `<p class="research-verdict"><strong>Source discrepancy:</strong> ${esc(row.data_quality_flags)}. The share uses the reported bicycle total; no count has been silently corrected.</p>`
      : '';
    root.querySelector('[data-calibration-selection]').innerHTML = `
      <p><strong>${esc(row.location)} · ${esc(row.day_type.toLowerCase())}, fall ${row.year}</strong></p>
      <div class="research-status">
        <div><span>Observed Citi Bike share</span><b>${share(row)}</b><span>Among bicycles in this record</span></div>
        <div><span>Numerator / denominator</span><b>${count(row.citi_bikes)} / ${count(row.all_bicycles)}</b><span>Citi Bikes / all bicycles</span></div>
        <div><span>Historical inverse share</span><b>${inverse(row)}</b><span>${esc(inverseExplanation)}</span></div>
      </div>${quality}
      <p class="small">${link('View the source dataset', row.source_url)}. ${row.citi_bikes === 0 ? 'The source reports a zero Citi Bike count with a positive bicycle total.' : 'Counts refer to the published observation period, not an hourly rate.'}</p>`;

    root.querySelector('[data-calibration-years]').innerHTML = `
      <h4>Same location and day type across years</h4>
      ${table(['Fall year', 'Citi Bikes / all bicycles', 'Citi Bike share', 'Inverse share'], sameDay.map(item => [
        `${item.year}${item.year === state.year ? ' · selected' : ''}`,
        `${count(item.citi_bikes)} / ${count(item.all_bicycles)}`,
        share(item), inverse(item)
      ]))}`;

    let exampleRows = siteRows.filter(item => item.year === state.year);
    let exampleTitle = `Weekday and weekend at this location · fall ${state.year}`;
    if (new Set(exampleRows.map(item => item.day_type)).size < 2) {
      exampleRows = rows.filter(item => item.source === 'dcp_offstreet' && String(item.location_id) === '11' && item.year === 2013);
      exampleTitle = 'A same-site day-type example · East River at E Houston, fall 2013';
    }
    root.querySelector('[data-calibration-days]').innerHTML = new Set(exampleRows.map(item => item.day_type)).size < 2 ? '' : `
      <h4>${esc(exampleTitle)}</h4>
      ${table(['Day type', 'Citi Bikes / all bicycles', 'Citi Bike share'], exampleRows.sort((a, b) => a.day_type.localeCompare(b.day_type)).map(item => [
        item.day_type, `${count(item.citi_bikes)} / ${count(item.all_bicycles)}`, share(item)
      ]))}`;
  }

  locationControl.addEventListener('change', () => {state.site = locationControl.value; renderSelection();});
  dayControl.addEventListener('change', () => {state.day = dayControl.value; renderSelection();});
  yearControl.addEventListener('change', () => {state.year = Number(yearControl.value); renderSelection();});
  renderSelection();
}
