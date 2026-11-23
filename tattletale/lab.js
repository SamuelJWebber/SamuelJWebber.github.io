/* Model lab: score the phone's plate reader and the AI models on OpenALPR's public US plate photos. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const settings = (() => { try { return JSON.parse(localStorage.getItem('curb.settings.v1') || '{}'); } catch { return {}; } })();
const cfg = model => ({ model, key: settings.aiKey, localUrl: settings.localUrl, localToken: settings.localToken });
const SET = 'https://api.github.com/repos/openalpr/benchmarks/contents/endtoend/us';

// the same plate reader the app uses
const worker = new Worker('ocr-worker.js'); let seq = 0; const pend = new Map();
const ready = new Promise((res, rej) => {
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'ready') res();
    else if (m.type === 'error' && m.id == null) rej(new Error(m.message));
    else if (m.id != null && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
});
worker.postMessage({ type: 'init' });
const read = (bmp, opts) => new Promise(res => { const id = ++seq; pend.set(id, res); worker.postMessage({ type: 'read', id, bitmap: bmp, ...opts }, [bmp]); });
ready.then(() => { $('#status').textContent = `Ready. AI models use ${settings.aiKey ? `the OpenRouter key saved in the app (ends in ${settings.aiKey.slice(-4)})` : 'no key yet: add one in the app under About'}${settings.localUrl ? ` and ${settings.localUrl}` : ''}.`; })
  .catch(e => { $('#status').textContent = `The plate reader didn't load: ${e.message}`; });

function canvasOf(bmp, max = 2400) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c;
}
const norm = AI.normPlate;
const median = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function loadSet(n) {
  const r = await fetch(SET); if (!r.ok) throw new Error(`GitHub listing failed (${r.status})`);
  const files = await r.json(), byName = Object.fromEntries(files.map(f => [f.name, f]));
  const imgs = files.filter(f => /\.jpe?g$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
  const step = imgs.length / Math.min(n, imgs.length), pick = Array.from({ length: Math.min(n, imgs.length) }, (_, i) => imgs[Math.floor(i * step)]);
  return Promise.all(pick.map(async f => {
    const txt = byName[f.name.replace(/\.\w+$/, '.txt')];
    const line = txt ? (await (await fetch(txt.download_url)).text()).trim().split('\n')[0].split('\t') : [];
    return { name: f.name, url: f.download_url, truth: norm(line[5] || '') };
  }));
}

let rows = [];
const METHODS = [
  ['phone', 'Phone reader (first pass)'],
  ['jev', 'Phone + Jev'],
  ['qwen', 'Qwen3.5-9B alone'],
  ['agree', 'Phone + Qwen agree'],
  ['local', 'Phone + your computer'],
];
function summary() {
  const on = { phone: true, jev: $('#m-jev').checked, qwen: $('#m-qwen').checked, agree: $('#m-qwen').checked, local: $('#m-local').checked };
  const n = rows.length;
  const tr = METHODS.filter(([k]) => on[k]).map(([k, label]) => {
    const ans = rows.filter(r => r[k]), right = ans.filter(r => r[k] === r.truth).length, wrong = ans.length - right;
    const ms = median(rows.map(r => r[k + 'Ms'])), cost = rows.reduce((t, r) => t + (r[k + 'Cost'] || 0), 0);
    const err = rows.find(r => r[k + 'Err'])?.[k + 'Err'];
    return `<tr><td>${esc(label)}${err ? `<div class="small bad">${esc(err)}</div>` : ''}</td><td class="num ok">${right} (${n ? Math.round(100 * right / n) : 0}%)</td><td class="num bad">${wrong} (${n ? (100 * wrong / n).toFixed(1) : 0}%)</td><td class="num">${n - ans.length}</td><td class="num">${ms != null ? (ms / 1000).toFixed(1) + ' s' : ''}</td><td class="num">${cost ? '$' + cost.toFixed(4) : ''}</td></tr>`;
  }).join('');
  $('#summary').innerHTML = `<thead><tr><th>Method</th><th class="num">Right</th><th class="num">Wrong</th><th class="num">No answer</th><th class="num">Median time</th><th class="num">Cost</th></tr></thead><tbody>${tr}</tbody>`;
  $('#rows').innerHTML = `<thead><tr><th>Truth</th><th>Phone</th><th>+ Jev</th><th>Qwen</th><th>+ yours</th></tr></thead><tbody>${rows.map(r => `<tr><td class="mono">${esc(r.truth)}</td>${['phone', 'jev', 'qwen', 'local'].map(k => `<td class="mono ${r[k] ? (r[k] === r.truth ? 'ok' : 'bad') : 'muted'}">${esc(r[k] || '·')}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('#summary-card').hidden = $('#rows-card').hidden = !n;
}

async function runOne(item, use) {
  const row = { name: item.name, truth: item.truth };
  const bmp = await createImageBitmap(await (await fetch(item.url)).blob(), { imageOrientation: 'from-image' });
  const canvas = canvasOf(bmp);
  // 1. the phone's reader, exactly as the app runs it on a shared photo's first pass
  const res = await read(await createImageBitmap(canvas), { maxSide: 1600 });
  row.phoneMs = res.ms;
  if (res.plate && res.score >= 3.4) row.phone = res.plate;
  const cands = [...new Set([row.phone, ...(res.lines || []).filter(l => l.plate && l.plate.length >= 5 && l.plate.length <= 8 && /\d/.test(l.plate) && l.pconf >= 0.5).map(l => l.plate)].filter(Boolean))].slice(0, 5);
  // 2. Jev: box the plate when the phone found nothing, then choose among the readings
  if (use.jev) {
    try {
      let t = 0, cost = 0, c = cands;
      if (!c.length) {
        const look = await AI.look(cfg('jev'), canvas); t += look.ms; cost += look.cost;
        const crop = (look.plateVisible ?? 0) >= 0.5 ? AI.cropBox(canvas, look.box) : null;
        if (crop) { const r2 = await read(await createImageBitmap(crop), { maxSide: 960, refine: true, budgetMs: 3000 }); if (r2.plate && r2.score >= 3.4) c = [r2.plate]; }
      }
      if (c.length) { const v = await AI.pickPlate(cfg('jev'), canvas, c); t += v.ms; cost += v.cost; if (v.choice && v.choice !== 'none' && v.p >= 0.85) row.jev = v.choice; }
      row.jevMs = t; row.jevCost = cost;
    } catch (e) { row.jevErr = e.message; use.jev = false; }
  }
  // 3. Qwen reads the plate on its own
  if (use.qwen) {
    try { const q = await AI.look(cfg('qwen'), canvas); row.qwen = q.plate || ''; row.qwenMs = q.ms; row.qwenCost = q.cost; }
    catch (e) { row.qwenErr = e.message; use.qwen = false; }
    if (row.phone && row.qwen && row.phone === row.qwen) row.agree = row.phone;
    row.agreeMs = row.qwenMs != null ? Math.max(row.phoneMs || 0, row.qwenMs) : null;
  }
  // 4. your computer (JPT-4B or any Jev-compatible server) chooses among the readings
  if (use.local && cands.length) {
    try { const v = await AI.pickPlate(cfg('local'), canvas, cands); row.localMs = v.ms; if (v.choice && v.choice !== 'none' && v.p >= 0.85) row.local = v.choice; }
    catch (e) { row.localErr = e.message; use.local = false; }
  }
  return row;
}

$('#go').onclick = async () => {
  const use = { jev: $('#m-jev').checked && !!settings.aiKey, qwen: $('#m-qwen').checked && !!settings.aiKey, local: $('#m-local').checked && !!settings.localUrl };
  $('#go').disabled = true; $('#csv').disabled = true; rows = [];
  try {
    await ready;
    $('#status').textContent = 'Loading the photo list from GitHub…';
    const set = await loadSet(Math.max(5, Math.min(222, +$('#n').value || 50)));
    const prog = $('#prog'); prog.hidden = false; prog.max = set.length; prog.value = 0;
    for (const [i, item] of set.entries()) {
      $('#status').textContent = `Photo ${i + 1} of ${set.length}…`;
      try { rows.push(await runOne(item, use)); } catch (e) { rows.push({ name: item.name, truth: item.truth, phoneErr: e.message }); }
      prog.value = i + 1; summary();
    }
    $('#status').textContent = `Done: ${rows.length} photos.${!settings.aiKey ? ' Add an OpenRouter key in the app to include Jev and Qwen.' : ''}`;
    $('#csv').disabled = false;
  } catch (e) { $('#status').textContent = `Stopped: ${e.message}`; }
  $('#go').disabled = false;
};
$('#csv').onclick = () => {
  const cols = ['name', 'truth', 'phone', 'phoneMs', 'jev', 'jevMs', 'jevCost', 'jevErr', 'qwen', 'qwenMs', 'qwenCost', 'qwenErr', 'agree', 'local', 'localMs', 'localErr'];
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob([[cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tattletale-bakeoff-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
};
