/* On-device text reader for TattleTale NYC: PP-OCRv4 detection + recognition via onnxruntime-web.
   Runs entirely in the browser. Messages in: {type:'init'} | {type:'read', id, bitmap, mode}
   Messages out: {type:'progress', loaded, total} | {type:'ready'} | {type:'result', id, ...} | {type:'error', id, message} */
importScripts('vendor/ort.wasm.min.js');
ort.env.wasm.wasmPaths = new URL('vendor/', self.location).href;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

let det = null, rec = null, CHARS = null, ALLOWED = null, ready = null;

async function fetchWithProgress(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load ' + url);
  if (!res.body || !res.body.getReader) { const b = await res.arrayBuffer(); onBytes(b.byteLength); return b; }
  const reader = res.body.getReader(); const chunks = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; onBytes(value.length); }
  const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

function init() {
  if (ready) return ready;
  ready = (async () => {
    const files = [['models/det.onnx', 4745517], ['models/rec.onnx', 10822323]];
    const total = files.reduce((s, f) => s + f[1], 0) + 11210254; let loaded = 0;
    const tick = n => { loaded += n; postMessage({ type: 'progress', loaded, total }); };
    const keys = (await (await fetch('models/keys.txt')).text()).split('\n');
    CHARS = ['', ...keys, ' '];
    ALLOWED = [0]; CHARS.forEach((c, i) => { if (/^[A-Z0-9]$/.test(c)) ALLOWED.push(i); });
    const [detBuf, recBuf] = await Promise.all(files.map(f => fetchWithProgress(f[0], tick)));
    const opts = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
    det = await ort.InferenceSession.create(detBuf, opts);
    tick(11210254);
    rec = await ort.InferenceSession.create(recBuf, opts);
    postMessage({ type: 'ready' });
  })();
  ready.catch(e => { ready = null; postMessage({ type: 'error', message: String(e && e.message || e) }); });
  return ready;
}

function pixels(bitmap, sx, sy, sw, sh, w, h) {
  const c = new OffscreenCanvas(w, h); const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
  return g.getImageData(0, 0, w, h).data;
}

async function detect(bitmap, maxSide) {
  const W = bitmap.width, H = bitmap.height, k = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.max(32, Math.round(W * k / 32) * 32), h = Math.max(32, Math.round(H * k / 32) * 32);
  const px = pixels(bitmap, 0, 0, W, H, w, h);
  const plane = w * h, data = new Float32Array(3 * plane);
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  for (let i = 0; i < plane; i++) {
    const r = px[i * 4] / 255, gg = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    data[i] = (b - mean[0]) / std[0]; data[plane + i] = (gg - mean[1]) / std[1]; data[2 * plane + i] = (r - mean[2]) / std[2];
  }
  const out = await det.run({ x: new ort.Tensor('float32', data, [1, 3, h, w]) });
  const prob = out[Object.keys(out)[0]].data;
  const seen = new Uint8Array(plane), stack = new Int32Array(plane), boxes = [];
  for (let p = 0; p < plane; p++) {
    if (seen[p] || prob[p] <= 0.3) continue;
    let top = 0; stack[top++] = p; seen[p] = 1;
    let minx = w, maxx = 0, miny = h, maxy = 0, s = 0, cnt = 0;
    while (top) {
      const q = stack[--top], y = (q / w) | 0, x = q - y * w; s += prob[q]; cnt++;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && !seen[q - 1] && prob[q - 1] > 0.3) { seen[q - 1] = 1; stack[top++] = q - 1; }
      if (x < w - 1 && !seen[q + 1] && prob[q + 1] > 0.3) { seen[q + 1] = 1; stack[top++] = q + 1; }
      if (y > 0 && !seen[q - w] && prob[q - w] > 0.3) { seen[q - w] = 1; stack[top++] = q - w; }
      if (y < h - 1 && !seen[q + w] && prob[q + w] > 0.3) { seen[q + w] = 1; stack[top++] = q + w; }
    }
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    if (Math.min(bw, bh) < 3 || s / cnt < 0.5) continue;
    const d = bw * bh * 1.6 / (2 * (bw + bh)), sx = W / w, sy = H / h;
    boxes.push({ x1: Math.max(0, (minx - d) * sx), y1: Math.max(0, (miny - d) * sy), x2: Math.min(W, (maxx + 1 + d) * sx), y2: Math.min(H, (maxy + 1 + d) * sy), score: s / cnt });
  }
  return boxes;
}

async function recognize(bitmap, b) {
  const sw = b.x2 - b.x1, sh = b.y2 - b.y1; if (sw < 4 || sh < 4) return null;
  const tw = Math.max(16, Math.min(640, Math.round(48 * sw / sh)));
  const px = pixels(bitmap, b.x1, b.y1, sw, sh, tw, 48), plane = tw * 48, data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    data[i] = (px[i * 4 + 2] / 255 - 0.5) / 0.5; data[plane + i] = (px[i * 4 + 1] / 255 - 0.5) / 0.5; data[2 * plane + i] = (px[i * 4] / 255 - 0.5) / 0.5;
  }
  const out = await rec.run({ x: new ort.Tensor('float32', data, [1, 3, 48, tw]) });
  const t = out[Object.keys(out)[0]], [, T, C] = t.dims, p = t.data;
  // greedy CTC decode; also keeps the weakest character's probability and the runner-up for each character
  const decode = cols => {
    let txt = '', confs = 0, n = 0, prev = -1, min = 1; const alts = [];
    for (let s = 0; s < T; s++) {
      let bi = 0, bv = -1, si = 0, sv = -1; const base = s * C;
      const scan = c => { const v = p[base + c]; if (v > bv) { si = bi; sv = bv; bv = v; bi = c; } else if (v > sv) { sv = v; si = c; } };
      if (cols) { for (const c of cols) scan(c); } else { for (let c = 0; c < C; c++) scan(c); }
      if (bi !== 0 && bi !== prev) { txt += CHARS[bi]; confs += bv; n++; if (bv < min) min = bv; if (si !== 0 && sv > 0.05) alts.push([txt.length - 1, CHARS[si], +sv.toFixed(3)]); }
      prev = bi;
    }
    return [txt, n ? confs / n : 0, n ? min : 0, alts];
  };
  const [text, conf] = decode(null), [plate, pconf, pmin, alts] = decode(ALLOWED);
  return { text, conf, plate, pconf, pmin, alts, box: b, w: sw, h: sh };
}

const PATTERNS = [[/^[A-Z]{3}\d{4}$/, 3], [/^\d{5}[A-Z]{2}$/, 2.6], [/^T\d{6}C$/, 3], [/^[A-Z]\d{2}[A-Z]{3}$/, 2.5], [/^[A-Z]{2}\d{5}$/, 2], [/^\d[A-Z]{2}\d{3,4}$/, 2], [/^[A-Z]{3}\d{3}$/, 1.1], [/^\d{3}[A-Z]{3}$/, 1.1], [/^[A-Z]{2}\d{4}[A-Z]?$/, 1.0]];
const STATES = [['NEWYORK', 'NY'], ['EMPIRE', 'NY'], ['EXCELSIOR', 'NY'], ['NEWJERSEY', 'NJ'], ['GARDEN', 'NJ'], ['PENNSYLVANIA', 'PA'], ['VISITPA', 'PA'], ['CONNECTICUT', 'CT'], ['CONSTITUTION', 'CT'], ['FLORIDA', 'FL'], ['SUNSHINE', 'FL'], ['MASSACHUSETTS', 'MA'], ['VIRGINIA', 'VA'], ['MARYLAND', 'MD'], ['DELAWARE', 'DE'], ['VERMONT', 'VT'], ['MAINE', 'ME'], ['TEXAS', 'TX'], ['CALIFORNIA', 'CA'], ['OHIO', 'OH'], ['NORTHCAROLINA', 'NC'], ['GEORGIA', 'GA'], ['ILLINOIS', 'IL'], ['MICHIGAN', 'MI'], ['RHODEISLAND', 'RI'], ['NEWHAMPSHIRE', 'NH'], ['LIVEFREE', 'NH'], ['QUEBEC', 'QC'], ['ONTARIO', 'ON']];

const GENERIC = 1.3, SIGNLIKE = /\d(AM|PM)|\d(ST|ND|RD|TH|AV|AVE)$|^(ST|AVE?)\d/;
function pickPlate(lines) {
  let best = null;
  for (const L of lines) {
    const s = L.plate;
    if (s.length < 4 || s.length > 8 || !/\d/.test(s)) continue;
    let score = L.pconf * 2, w = 0;
    for (const [re, wgt] of PATTERNS) if (re.test(s)) { w = wgt; break; }
    // any other US format: 5-8 letters and digits, every character read confidently, and not sign text (2AM, 4TH, 103RD)
    if (!w && /[A-Z]/.test(s) && s.length >= 5 && (L.pmin ?? 0) >= 0.9 && !SIGNLIKE.test(s)) w = GENERIC;
    score += w || (/[A-Z]/.test(s) ? 0.8 : 0);
    const ar = L.w / Math.max(1, L.h); if (ar >= 1.8 && ar <= 9) score += 0.5;
    if (!best || score > best.score) best = { score, w, L };
  }
  const joined = lines.map(L => L.text.toUpperCase().replace(/[^A-Z]/g, '')).join(' ');
  let state = '';
  for (const [k, st] of STATES) if (joined.includes(k)) { state = st; break; }
  return best ? { plate: best.L.plate, pconf: best.L.pconf, pmin: best.L.pmin, score: best.score, w: best.w, box: best.L.box, state } : { plate: '', pconf: 0, score: 0, box: null, state };
}

// a read good enough to stop looking: a clear read of a standard plate format
const enough = p => p.score >= 4.6 || (p.w >= 2 && p.pconf >= 0.9) || (p.w === GENERIC && (p.pmin ?? 0) >= 0.95);
// partial plate reads: digits present but not a full plate pattern
function partials(lines) {
  return lines.filter(l => l.plate.length >= 3 && (l.plate.match(/\d/g) || []).length >= 2 && !PATTERNS.some(([re]) => re.test(l.plate)))
    .sort((a, b) => b.pconf - a.pconf).slice(0, 3);
}
// how many characters of the partial read survive, in order, in the refined read
function overlap(a, b) {
  const dp = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) { let prev = 0; for (let j = 1; j <= b.length; j++) { const tmp = dp[j]; dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]); prev = tmp; } }
  return dp[b.length];
}
// re-read a partial: widen the box, enlarge it, and try a few rotations (tilted plates)
async function refine(bitmap, b, partial, trace, deadline = Infinity) {
  const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2, w = b.x2 - b.x1, h = b.y2 - b.y1;
  const need = Math.min(3, (partial || '').length);
  let best = null;
  for (const ex of [1.4, 1.8, 2.3]) for (const ang of [0, 8, -8, 14, -14, 20, -20]) {
    if (performance.now() > deadline) return best;
    const rw = w * ex + 12, rh = h * ex * 0.75 + 12, S = Math.max(2, Math.min(6, 200 / rh));
    const c = new OffscreenCanvas(Math.round(rw * S), Math.round(rh * S)), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high';
    g.translate(c.width / 2, c.height / 2); g.rotate(ang * Math.PI / 180); g.scale(S, S);
    g.drawImage(bitmap, cx - rw / 2, cy - rh / 2, rw, rh, -rw / 2, -rh / 2, rw, rh);
    const crop = await createImageBitmap(c);
    const lines = [];
    for (const bb of (await detect(crop, 960)).slice(0, 4)) { const r = await recognize(crop, bb); if (r && r.text) lines.push(r); }
    const whole = await recognize(crop, { x1: 0, y1: 0, x2: crop.width, y2: crop.height, score: 1 });
    if (whole && whole.text) lines.push(whole);
    crop.close && crop.close();
    const p = pickPlate(lines.filter(l => !partial || overlap(partial, l.plate) >= need));
    if (trace && p.plate) trace.push(['refine', partial, p.plate, +p.score.toFixed(2), ex, ang]);
    if (p.plate && p.score >= 3.4 && (!best || p.score > best.score)) best = { ...p, box: { x1: cx - rw / 2, y1: cy - rh / 2, x2: cx + rw / 2, y2: cy + rh / 2 } };
    if (best && enough(best)) return best;
  }
  return best;
}
async function readLines(bitmap, maxSide, maxLines) {
  const boxes = (await detect(bitmap, maxSide)).sort((a, b) => b.score - a.score).slice(0, maxLines);
  const lines = [];
  for (const b of boxes) { const r = await recognize(bitmap, b); if (r && r.text) lines.push(r); }
  return lines;
}
// second pass for small or far plates: 3x3 overlapping tiles, each enlarged 2x
async function zoomPass(bitmap, trace, deadline = Infinity) {
  const W = bitmap.width, H = bitmap.height, n = 3, tw = Math.round(W / n * 1.35), th = Math.round(H / n * 1.35);
  let best = null;
  for (let j = n - 1; j >= 0; j--) for (let i = 0; i < n; i++) {
    if (performance.now() > deadline) return best;
    const x0 = Math.max(0, Math.min(W - tw, Math.round(i * W / n - (tw - W / n) / 2)));
    const y0 = Math.max(0, Math.min(H - th, Math.round(j * H / n - (th - H / n) / 2)));
    const c = new OffscreenCanvas(tw * 2, th * 2), g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(bitmap, x0, y0, tw, th, 0, 0, tw * 2, th * 2);
    const tile = await createImageBitmap(c);
    const lines = await readLines(tile, 1280, 12);
    tile.close && tile.close();
    const toOrig = b => ({ x1: x0 + b.x1 / 2, y1: y0 + b.y1 / 2, x2: x0 + b.x2 / 2, y2: y0 + b.y2 / 2 });
    const p = pickPlate(lines);
    if (trace && p.plate) trace.push(['tile', i, j, p.plate, +p.score.toFixed(2)]);
    if (p.plate && p.score >= 3.4 && (!best || p.score > best.score)) best = { ...p, box: toOrig(p.box) };
    for (const l of partials(lines)) {
      const r = await refine(bitmap, toOrig(l.box), l.plate, trace, deadline);
      if (r && (!best || r.score > best.score)) best = r;
    }
    if (best && enough(best)) return best;
  }
  return best;
}

onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') { init(); return; }
  if (m.type === 'read') {
    try {
      await init();
      const t0 = performance.now();
      const lines = await readLines(m.bitmap, m.maxSide || 1280, m.maxLines || 24);
      let plate = pickPlate(lines); const trace = m.debug ? [['base', plate.plate, +plate.score.toFixed(2)]] : null;
      const deadline = t0 + (m.budgetMs ?? (m.zoom ? 8000 : 1500));
      if ((m.zoom || m.refine) && !enough(plate)) {
        for (const l of partials(lines)) { if (performance.now() > deadline) break; const r = await refine(m.bitmap, l.box, l.plate, trace, deadline); if (r && r.score > plate.score) plate = { ...r, state: r.state || plate.state, zoomed: true }; if (enough(plate)) break; }
        if (m.zoom && !enough(plate)) { const z = await zoomPass(m.bitmap, trace, deadline); if (z && z.score > plate.score) plate = { ...z, state: z.state || plate.state, zoomed: true }; }
      }
      // merge words that sit on the same row into one line (company names, street signs)
      const rows = [];
      for (const l of [...lines].sort((a, b) => (a.box.y1 + a.box.y2) - (b.box.y1 + b.box.y2))) {
        const yc = (l.box.y1 + l.box.y2) / 2;
        const row = rows.find(r => Math.abs(r.yc - yc) < 0.45 * Math.max(r.h, l.h) && l.h / r.h > 0.6 && l.h / r.h < 1.6);
        if (row) row.items.push(l); else rows.push({ yc, h: l.h, items: [l] });
      }
      const merged = [];
      for (const r of rows) {
        r.items.sort((a, b) => a.box.x1 - b.box.x1);
        let cur = null;
        for (const it of r.items) {
          if (cur && it.box.x1 - cur.box.x2 < 1.3 * Math.max(cur.h, it.h)) { cur.text += ' ' + it.text; cur.conf = Math.min(cur.conf, it.conf); cur.box = { x1: cur.box.x1, y1: Math.min(cur.box.y1, it.box.y1), x2: it.box.x2, y2: Math.max(cur.box.y2, it.box.y2) }; cur.w = cur.box.x2 - cur.box.x1; }
          else { cur && merged.push(cur); cur = { text: it.text, conf: it.conf, h: it.h, w: it.w, box: { ...it.box } }; }
        }
        cur && merged.push(cur);
      }
      m.bitmap.close && m.bitmap.close();
      postMessage({ type: 'result', id: m.id, ...plate, lines: lines.map(l => ({ text: l.text, conf: l.conf, plate: l.plate, pconf: l.pconf, pmin: l.pmin, alts: l.alts, h: l.h, w: l.w, box: l.box })), rows: merged, trace, ms: Math.round(performance.now() - t0) });
    } catch (err) { postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) }); }
  }
};
