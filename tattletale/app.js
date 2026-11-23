'use strict';
/* TattleTale NYC — photo to 311 complaint, entirely on the phone. */

// ---------- constants ----------
const VIOLATIONS = [
  { key: 'bike_lane', btn: 'Blocking bike lane', label: 'Blocked bike lane', detail: 'Blocked Bike Lane', phrase: 'parked in the bike lane' },
  { key: 'double_traffic', btn: 'Double parked', label: 'Double parked, blocking traffic', detail: 'Double Parked Blocking Traffic', phrase: 'double parked, blocking traffic' },
  { key: 'hydrant', btn: 'Hydrant', label: 'Blocking a hydrant', detail: 'Blocked Hydrant', phrase: 'parked at a fire hydrant' },
  { key: 'crosswalk', btn: 'Crosswalk', label: 'Blocking a crosswalk', detail: 'Blocked Crosswalk', phrase: 'parked in the crosswalk' },
  { key: 'sidewalk', btn: 'On the sidewalk', label: 'Parked on the sidewalk', detail: 'Blocked Sidewalk', phrase: 'parked on the sidewalk' },
  { key: 'bus', btn: 'Bus stop or bus lane', label: 'In a bus stop or bus lane', detail: 'Posted Parking Sign Violation', phrase: 'parked in a bus stop or bus lane' },
  { key: 'double_vehicle', btn: 'Double parked, boxing a car in', label: 'Double parked, blocking a car', detail: 'Double Parked Blocking Vehicle', phrase: 'double parked, blocking in a parked car' },
  { key: 'permit', btn: 'Placard abuse', label: 'Placard or permit misuse', detail: 'Parking Permit Improper Use', phrase: 'parked illegally while displaying a placard or permit' },
  { key: 'posted_sign', btn: 'Other sign violation', label: 'Other posted sign violation', detail: 'Posted Parking Sign Violation', phrase: 'parked against the posted parking sign' },
];
const VMAP = Object.fromEntries(VIOLATIONS.map(v => [v.key, v]));
const PHONE_311 = '311692';
const LINK_311 = 'https://portal.311.nyc.gov/article/?kanumber=KA-01986';
const LINK_DEP = 'https://nycidling.azurewebsites.net/';
const LINK_OATH = 'https://a820-ecbticketfinder.nyc.gov/searchHome.action';
const SODA = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json';
const STATES = ['NY', 'NJ', 'PA', 'CT', 'MA', 'FL', 'VA', 'MD', 'DE', 'RI', 'VT', 'NH', 'ME', 'NC', 'SC', 'GA', 'OH', 'MI', 'IL', 'TX', 'CA', 'IN', 'TN', 'AL', 'AZ', 'AR', 'CO', 'DC', 'HI', 'ID', 'IA', 'KS', 'KY', 'LA', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NM', 'ND', 'OK', 'OR', 'SD', 'UT', 'WA', 'WV', 'WI', 'WY', 'AK', 'QC', 'ON'];
const BOROUGHS = ['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND'];
const OUTCOMES = ['Waiting', 'Ticketed', 'Moved along, no ticket', 'Gone when police came', 'Police said no action needed', 'Other'];
const IDLE_OUTCOMES = ['Waiting', 'Rejected by DEP', 'Summons issued', 'Upheld at OATH', 'Dismissed', 'Reward paid'];

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800); }
function nyParts(d) { return Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value])); }
function toLocalInput(d) { if (!d || isNaN(d)) return ''; const p = nyParts(d); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`; }
function fromLocalInput(s) {
  if (!s) return null; const [date, time = '00:00:00'] = s.split('T'); const [y, m, d] = date.split('-').map(Number); const [hh, mm, ss = 0] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  for (let i = 0; i < 2; i++) { const p = nyParts(guess); guess.setTime(guess.getTime() - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Date.UTC(y, m - 1, d, hh, mm, ss))); }
  return guess;
}
const fmtWhen = s => { const d = fromLocalInput(s); return d ? d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };
const fmtShort = s => { const d = fromLocalInput(s); return d ? d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };
const fmtDate = s => { const d = fromLocalInput(s); return d ? d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric' }) : ''; };
const fmtTime = s => { const d = fromLocalInput(s); return d ? d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''; };
const fmtDur = sec => { if (sec == null || !isFinite(sec)) return '?'; const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return `${m}:${String(s).padStart(2, '0')}`; };
const titleCase = s => String(s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
const exifStamp = raw => { const m = String(raw || '').match(/(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/); return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}` : ''; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
async function copyText(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); return true; } catch { showCopyModal(text); return false; } }
function showCopyModal(text) {
  $('#modal-root').innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Copy text"><div class="card"><h2>Copy this</h2><label class="f" for="copy-area">Press and hold to select, then copy<textarea id="copy-area" readonly>${esc(text)}</textarea></label><button class="btn" id="copy-close" type="button">Close</button></div></div>`;
  $('#copy-area').select(); $('#copy-close').onclick = () => { $('#modal-root').innerHTML = ''; };
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
function metersBetween(a, b) { const k = Math.cos(a.lat * Math.PI / 180); return Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * k); }
function canvasFrom(src, maxSide) {
  const w0 = src.videoWidth || src.width, h0 = src.videoHeight || src.height, k = Math.min(1, maxSide / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c;
}
const toBlob = (c, q = 0.85) => new Promise(r => c.toBlob(r, 'image/jpeg', q));

// ---------- saved reports and settings (on this phone only) ----------
const KEY = 'curb.reports.v1', SKEY = 'curb.settings.v1';
const store = {
  all() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } },
  put(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 400))); return true; } catch { toast('Phone storage is full. Delete old reports in My reports.'); return false; } },
  save(r) { const l = store.all(); const i = l.findIndex(x => x.id === r.id); r.updatedAt = new Date().toISOString(); if (i >= 0) l[i] = r; else l.unshift(r); return store.put(l); },
  remove(id) { store.put(store.all().filter(x => x.id !== id)); },
};
const settings = (() => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch { return {}; } })();
const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch {} };

// ---------- street map lookup (bundled city centerline tiles) ----------
let geoIndex = null; const tileCache = {};
async function reverseGeocode(lat, lon) {
  if (lat == null || lat < 40.47 || lat > 40.93 || lon < -74.27 || lon > -73.68) return null;
  try {
    if (!geoIndex) geoIndex = await (await fetch('geo/index.json')).json();
    const name = tileName(lat, lon, geoIndex.tile);
    if (!geoIndex.tiles.includes(name)) return null;
    if (!tileCache[name]) tileCache[name] = await (await fetch('geo/' + name)).json();
    const r = locate(tileCache[name], lat, lon);
    return r && r.distanceM < 120 ? r : null;
  } catch { return null; }
}
const here = { lat: null, lon: null, acc: null, ts: 0, place: null, placeAt: null, watching: false, denied: false };
function placeLine(p) { if (!p) return ''; return p.atIntersection ? `${titleCase(p.street)} & ${titleCase(p.nearestCross)}, ${titleCase(p.borough)}` : `${p.houseNumber ? p.houseNumber + ' ' : ''}${titleCase(p.street)}, ${titleCase(p.borough)}`; }
function startLocation() {
  if (here.watching || !navigator.geolocation) return;
  here.watching = true;
  navigator.geolocation.watchPosition(async pos => {
    const { latitude: lat, longitude: lon, accuracy: acc } = pos.coords;
    Object.assign(here, { lat, lon, acc, ts: Date.now(), denied: false });
    if (!here.placeAt || metersBetween(here.placeAt, { lat, lon }) > 12) {
      here.placeAt = { lat, lon };
      here.place = await reverseGeocode(lat, lon);
    }
    updateChips();
  }, err => { here.denied = err.code === 1; here.watching = false; updateChips(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}

function hereNow(ms = 8000) {
  startLocation();
  if (here.lat != null && Date.now() - here.ts < 60000) return Promise.resolve({ lat: here.lat, lon: here.lon });
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise(res => {
    const t = setTimeout(() => res(here.lat != null ? { lat: here.lat, lon: here.lon } : null), ms);
    navigator.geolocation.getCurrentPosition(p => { clearTimeout(t); res({ lat: p.coords.latitude, lon: p.coords.longitude }); }, () => { clearTimeout(t); res(null); }, { enableHighAccuracy: true, maximumAge: 60000, timeout: ms });
  });
}

// ---------- plate reader (web worker) ----------
const ocr = {
  w: null, ready: false, failed: false, loaded: 0, total: 0, seq: 0, pend: new Map(),
  init() {
    if (this.w) return; try { this.w = new Worker('ocr-worker.js'); } catch { this.failed = true; return; }
    this.w.onmessage = e => {
      const m = e.data;
      if (m.type === 'progress') { this.loaded = m.loaded; this.total = m.total; updateOcrProgress(); }
      else if (m.type === 'ready') { this.ready = true; updateOcrProgress(); }
      else if (m.type === 'result' || (m.type === 'error' && m.id != null)) { const p = this.pend.get(m.id); this.pend.delete(m.id); p && (m.type === 'result' ? p.ok(m) : p.no(new Error(m.message))); }
      else if (m.type === 'error') { this.failed = true; updateOcrProgress(); }
    };
    this.w.postMessage({ type: 'init' });
  },
  read(bitmap, opts = {}) {
    this.init(); const id = ++this.seq;
    return new Promise((ok, no) => { this.pend.set(id, { ok, no }); this.w.postMessage({ type: 'read', id, bitmap, ...opts }, [bitmap]); });
  },
};
function updateOcrProgress() {
  const bar = $('#ocr-progress'), note = $('#ocr-note');
  if (ocr.failed) { bar.hidden = true; note.textContent = 'The plate reader could not start on this phone. You can still type the plate.'; return; }
  if (ocr.ready) { bar.hidden = true; note.textContent = ''; return; }
  if (ocr.total) { bar.hidden = false; bar.firstElementChild.style.width = Math.round(100 * ocr.loaded / ocr.total) + '%'; note.textContent = `Setting up the plate reader (${Math.round(ocr.loaded / 1e6)} of ${Math.round(ocr.total / 1e6)} MB, once only).`; }
}

// ---------- camera and live plate scanning ----------
const video = $('#cam');
const cam = { on: false, scanning: false, live: null };
async function startCamera() {
  if (cam.on) return true;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    video.srcObject = s; await video.play().catch(() => {});
    cam.on = true; settings.camOK = true; saveSettings();
    $('#vf-start').hidden = true; $('#vf-overlay').hidden = false;
    scanLoop();
    return true;
  } catch (e) {
    $('#vf-start').querySelector('p').textContent = 'Camera is off. Allow camera access for this site in your browser settings, or use a photo instead.';
    return false;
  }
}
function stopCamera() { if (!cam.on) return; video.srcObject?.getTracks().forEach(t => t.stop()); video.srcObject = null; cam.on = false; $('#vf-start').hidden = false; $('#vf-overlay').hidden = true; }
async function scanLoop() {
  if (cam.scanning) return; cam.scanning = true;
  while (cam.on && currentView === 'report' && document.visibilityState === 'visible') {
    if (ocr.ready && video.videoWidth) {
      try {
        const bmp = await createImageBitmap(video);
        const r = await ocr.read(bmp, { maxSide: 1280, maxLines: 16, refine: true });
        if (r.plate && r.score >= 3.4) {
          const now = Date.now(); cam.votes = (cam.votes || []).filter(v => now - v.ts < 4000); cam.votes.push({ plate: r.plate, ts: now });
          const agree = cam.votes.filter(v => v.plate === r.plate).length;
          cam.live = { plate: r.plate, state: r.state, score: r.score, agree, unsure: (!!r.zoomed && agree < 2) || (agree < 2 && r.score < 4.8), ts: now };
        }
        updateChips();
      } catch {}
      await sleep(500);
    } else await sleep(400);
  }
  cam.scanning = false;
}
function livePlate() { return cam.live && Date.now() - cam.live.ts < 8000 ? cam.live : null; }
function updateChips() {
  const loc = $('#chip-loc'), pl = $('#chip-plate');
  if (here.denied) { loc.textContent = 'Location off: you will type the address'; loc.className = 'vchip'; }
  else if (here.place) { loc.textContent = placeLine(here.place) + (here.place.hasBikeLane ? ' · bike lane' : ''); loc.className = 'vchip ok'; }
  else if (here.lat) { loc.textContent = 'Not on a NYC street'; loc.className = 'vchip'; }
  else { loc.textContent = 'Finding your block…'; loc.className = 'vchip'; }
  const lp = livePlate();
  if (lp) { pl.textContent = `${lp.plate} ${lp.state || ''}`.trim(); pl.className = 'vchip mono ok'; }
  else { pl.textContent = ocr.ready ? 'Plate: point at it' : 'Plate reader loading'; pl.className = 'vchip mono'; }
}

// ---------- building a report ----------
function placeFields(p) {
  return { houseNumber: p?.houseNumber || '', street: p?.street || '', borough: p?.borough || '', zip: p?.zip || '', crossFrom: (p?.atIntersection ? p.nearestCross : p?.crossFrom) || '', crossTo: (p?.atIntersection ? '' : p?.crossTo) || '',
    where: p?.atIntersection ? 'intersection' : 'front', bikeLane: p?.bikeLane || '', hasBikeLane: !!p?.hasBikeLane, mapChecked: !!p };
}
function newReport(vkey, opts = {}) {
  const p = opts.place || null;
  return {
    id: uid(), kind: 'parking', violation: vkey, createdAt: new Date().toISOString(), observedAt: opts.observedAt || toLocalInput(new Date()),
    plate: opts.plate || '', plateState: opts.state || 'NY', lat: opts.lat ?? null, lon: opts.lon ?? null,
    ...placeFields(p),
    status: 'draft', ref: '', outcome: 'Waiting', thumb: opts.thumb || '', notes: '', msgTouched: false, message: '',
  };
}
function where(r) {
  const st = titleCase(r.street), b = titleCase(r.borough);
  if (!st) return '';
  if (r.where === 'intersection') return `${st} & ${titleCase(r.crossFrom || r.crossTo)}, ${b}`;
  const between = r.crossFrom && r.crossTo ? `, between ${titleCase(r.crossFrom)} and ${titleCase(r.crossTo)}` : '';
  return `${r.houseNumber ? r.houseNumber + ' ' : ''}${st}, ${b}${between}`;
}
function smsBody(r) {
  const v = VMAP[r.violation] || VIOLATIONS[0];
  const lines = [`311 complaint: Illegal Parking - ${v.detail}`];
  lines.push(`Where: ${where(r) || '[address]'}`);
  lines.push(`Vehicle: ${r.plate ? `plate ${r.plate} (${r.plateState})` : 'plate not readable'}, ${v.phrase}`);
  lines.push(`Seen: ${fmtShort(r.observedAt)}`);
  lines.push('Please file this with NYPD. I have a photo.');
  return lines.join('\n');
}
function webDescription(r) {
  const v = VMAP[r.violation] || VIOLATIONS[0];
  let s = `A vehicle${r.plate ? ` with plate ${r.plate} (${r.plateState})` : ''} was ${v.phrase} at ${where(r)} on ${fmtDate(r.observedAt)} at ${fmtTime(r.observedAt)}.`;
  if (r.violation === 'bike_lane' && r.hasBikeLane) s += ` This block has a ${r.bikeLane} on the city's street map.`;
  return s + ' I have a photo.';
}
function smsHref(body) { return `sms:${PHONE_311}${isIOS() ? '&' : '?'}body=${encodeURIComponent(body)}`; }
function openSms(body) {
  if (window.__curbTest) { window.__curbTest.sms = body; return; }
  const a = document.createElement('a'); a.href = smsHref(body); a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
}

// ---------- the one tap ----------
let lastShot = null, pendingSent = null;
async function onViolationTap(vkey) {
  if (!cam.on) { const ok = await startCamera(); if (!ok) return; await sleep(600); }
  const c = canvasFrom(video, 1920);
  const thumb = canvasFrom(c, 360).toDataURL('image/jpeg', 0.7);
  lastShot = { canvas: c, box: null };
  const lp = livePlate();
  const r = newReport(vkey, { place: here.place, lat: here.lat, lon: here.lon, plate: lp?.plate, state: lp?.state || 'NY', thumb });
  r.plateUnsure = !!lp?.unsure;
  const ready = r.street && r.plate && !r.plateUnsure && isPhone() && !settings.review;
  if (ready) {
    r.message = smsBody(r); r.status = 'texted'; r.sentAt = new Date().toISOString(); store.save(r); pendingSent = r.id;
    openSms(r.message);
    showSentBar(r);
    return;
  }
  draft = r; go('result');
  if (!r.plate) readShot(c);
}
async function readShot(canvasOrBitmap) {
  if (!draft) return;
  const d0 = draft, canAI = !!(d0.fromPhoto && canvasOrBitmap.getContext), primary = aiSource();
  // your own key or computer is asked while the phone reads; TattleTale's AI waits for the phone (sharedAssist)
  const useAI = canAI && aiEnabled() && primary !== 'shared';
  const ai = useAI ? AI.look(aiCfg(), canvasOrBitmap).catch(e => ({ error: e.message })) : null;
  const other = useAI && settings.aiCompare ? ['jev', 'qwen', 'local'].find(m => m !== primary && aiReady(m)) : null;
  const ai2 = other ? AI.look(aiCfg(other), canvasOrBitmap).catch(() => null) : null;
  if (ai) d0._ai = true;
  draft._reading = true; renderResult();
  let res = null;
  try {
    const bmp = await createImageBitmap(canvasOrBitmap);
    res = await ocr.read(bmp, { maxSide: 1600, zoom: true });
    if (draft && res.plate && res.score >= 3.4 && !draft.plateTouched) { draft.plate = res.plate; draft.plateUnsure = !!res.zoomed; if (res.state) draft.plateState = res.state; if (lastShot) lastShot.box = res.box; }
    if (draft && !(res.plate && res.score >= 3.4)) draft._noPlate = true;
    if (draft && !draft.street) {
      const texts = [...(res.rows || []).map(r => r.text), ...(res.lines || []).map(l => l.text)];
      const x = await placeFromSigns(texts, here.lat != null ? { lat: here.lat, lon: here.lon } : null);
      if (x && draft && !draft.street) {
        const p = await reverseGeocode(x.lat, x.lon);
        Object.assign(draft, { lat: x.lat, lon: x.lon, locSource: 'signs', signNames: x.names });
        if (p) Object.assign(draft, { houseNumber: '', street: p.street, borough: p.borough, zip: p.zip, crossFrom: p.crossFrom, crossTo: p.crossTo, bikeLane: p.bikeLane, hasBikeLane: !!p.hasBikeLane, mapChecked: true });
        const other = x.names.find(n => coreOf(n) !== coreOf(draft.street));
        draft.where = 'intersection'; if (other) draft.crossFrom = other;
      }
    }
  } catch { if (draft) draft._noPlate = true; }
  d0._res = res;
  if (draft) { draft._reading = false; if (!draft.msgTouched) draft.message = smsBody(draft); renderResult(); }
  if (ai && draft === d0) { try { const look = await ai; logAI(d0, look); await applyAI(d0, look, canvasOrBitmap, res, primary); const l2 = ai2 && await ai2; logAI(d0, l2); if (l2 && !l2.error) d0.aiCost = (d0.aiCost || 0) + (l2.cost || 0); } catch {} d0._ai = false; if (draft === d0) { if (!d0.msgTouched) d0.message = smsBody(d0); renderResult(); } }
  else if (canAI && draft === d0 && aiEnabled() && aiSource() === 'shared') await sharedAssist(d0, canvasOrBitmap, res);
  if (draft) pickFollowUp(false);
}
// TattleTale's AI is paid for by the app's owner, so the phone goes first: the photo only leaves the phone
// for what the phone couldn't settle. The service then tries the owner's computer, then the cloud (tools/worker).
async function sharedAssist(d, canvas, res) {
  const needV = !d._pick, needP = !d.plateTouched && (!d.plate || d.plateUnsure);
  if (!needV && !needP) return;
  d._ai = true; if (!settings.aiNoticeShown) { d.aiFirst = true; settings.aiNoticeShown = true; saveSettings(); }
  if (draft === d) renderResult();
  let look = { model: 'shared', cost: 0, ms: 0 };
  if (needV || !d.plate) { look = await AI.look(aiCfg('shared'), canvas).catch(e => ({ error: e.message })); logAI(d, look); }
  try { await applyAI(d, look, canvas, res, 'shared'); } catch {}
  d._ai = false;
  if (draft === d) { if (!d.msgTouched) d.message = smsBody(d); renderResult(); }
}
function showSentBar(r) {
  const bar = document.createElement('div'); bar.className = 'card'; bar.id = 'sent-bar';
  bar.innerHTML = `<div><b>Text to 311 opened</b> for ${esc(r.plate)} at ${esc(where(r))}. Press Send in Messages.</div>
    <label class="f" for="sent-ref">311 texts back a service request number. Paste it here to track the result<input id="sent-ref" class="mono" placeholder="311-12345678" autocomplete="off"></label>
    <div class="row"><button class="btn primary small" type="button" id="sent-save">Save number</button><button class="btn small" type="button" id="sent-edit">Fix details and resend</button><button class="btn small" type="button" id="sent-undo">I didn't send it</button></div>`;
  $('#sent-bar')?.remove(); $('#view-report').prepend(bar);
  $('#sent-save').onclick = () => { const l = store.all().find(x => x.id === r.id); if (l) { l.ref = $('#sent-ref').value.trim(); store.save(l); } bar.remove(); toast('Saved to My reports'); };
  $('#sent-undo').onclick = () => { store.remove(r.id); bar.remove(); toast('Removed'); };
  $('#sent-edit').onclick = () => { draft = store.all().find(x => x.id === r.id) || r; bar.remove(); go('result'); };
}

// ---------- AI assist: Jev, an open-weights model, or your own computer (lib/ai.js) ----------
const aiSource = () => settings.aiModel || (AI.SHARED && !settings.aiKey ? 'shared' : 'jev');
const aiCfg = (model = aiSource()) => ({ model, key: settings.aiKey, localUrl: settings.localUrl, localToken: settings.localToken });
const aiReady = m => m === 'shared' ? !!AI.SHARED : m === 'local' ? !!settings.localUrl : !!settings.aiKey;
// TattleTale's AI is on unless switched off; your own key or computer only once you switch it on
const aiEnabled = () => (settings.aiOn ?? aiSource() === 'shared') && aiReady(aiSource());
const probOf = AI.probOf;
async function applyAI(d, look, canvas, res, source = look?.model) {
  if (!look || look.error) { d.aiNote = !look?.error ? '' : source === 'shared' ? `${sharedTrouble(look.error)}, so pick the violation yourself.` : `AI assist failed: ${look.error}.`; return; }
  const model = look.model, tag = source === 'shared' ? 'shared' : model;
  d.aiCost = (d.aiCost || 0) + look.cost; d.aiMs = look.ms;
  const top = look.violation?.choice, p = look.violation?.p || 0;
  if (top) { d.aiPick = { key: top, p, model, tier: look.tier || '', label: look.label || '', calibrated: look.calibrated }; if (top !== 'none' && VMAP[top] && p >= 0.8 && !d._pick) d.violation = top; }
  // a model that reads text (Qwen, Gemma) is a second opinion on the plate: two readers agreeing confirms it
  const cands = () => [...new Set([d.plate, ...(d.aiCands || []), ...(res?.lines || []).filter(l => l.plate && l.plate.length >= 5 && l.plate.length <= 8 && /\d/.test(l.plate) && l.pconf >= 0.5).map(l => l.plate)])].filter(Boolean).slice(0, 5);
  if (look.plate && !d.plateTouched) {
    if (look.plate === d.plate) { d.plateUnsure = false; d.plateAI = Math.max(p, 0.9); d.plateAIModel = tag; }
    else if (d.plate && d.plateUnsure && cands().includes(look.plate)) { d.plate = look.plate; d.plateUnsure = false; d.plateAI = 0.9; d.plateAIModel = tag; if (look.plateState) d.plateState = look.plateState; }
    else if (!d.plate) { d.plate = look.plate; d.plateUnsure = true; d.plateByAI = tag; if (look.plateState) d.plateState = look.plateState; }
    else { d.plateUnsure = true; d.aiAltPlate = look.plate; d.aiAltBy = look.label || ''; }
  }
  // the phone couldn't read the plate confidently: read again inside the box the model found
  if ((!d.plate || d.plateUnsure) && !d.plateTouched && (look.plateVisible ?? 0) >= 0.5 && look.box) {
    const crop = AI.cropBox(canvas, look.box);
    if (crop) {
      const r2 = await ocr.read(await createImageBitmap(crop), { maxSide: 960, refine: true, budgetMs: 3000 }).catch(() => null);
      if (r2?.plate && r2.score >= 3.4 && draft === d) {
        d.aiCands = [r2.plate];
        if (!d.plate) { d.plate = r2.plate; d.plateUnsure = true; if (r2.state) d.plateState = r2.state; }
        else if (r2.plate === d.aiAltPlate) { d.plate = r2.plate; d.plateUnsure = false; d.plateAI = 0.9; d.plateAIModel = tag; d.aiAltPlate = ''; }
      }
    }
  }
  // still unsure: a model chooses which reading the photo actually shows (skipped if a reading model just had its say)
  const readerAnswered = source === 'shared' ? look.tier === 'cloud' && look.calibrated === false : model === 'qwen';
  if (!readerAnswered && d.plate && d.plateUnsure && !d.plateTouched && draft === d) {
    try {
      const v = await AI.pickPlate(aiCfg(source === 'shared' ? 'shared' : model), canvas, cands()); d.aiCost += v.cost || 0;
      if (v.choice && v.choice !== 'none' && v.p >= 0.85 && draft === d && !d.plateTouched) { d.plate = v.choice; d.plateUnsure = false; d.plateAI = v.p; d.plateAIModel = tag; }
      else if (v.choice === 'none' && v.read && v.read !== d.plate) { d.aiAltPlate = v.read; d.aiAltBy = v.label || ''; }
      else if (v.choice === 'none') d.aiPlateDoubt = true;
    } catch (e) { d.aiNote = source === 'shared' ? `${sharedTrouble(e.message)}, so check the plate yourself.` : `AI plate check failed: ${e.message}.`; }
  }
}
const sharedTrouble = e => /limit/.test(e) ? "TattleTale's AI is at its daily limit" : /credit|paid plan|key was rejected/.test(e) ? "TattleTale's AI isn't available right now" : /reach/.test(e) ? "Couldn't reach TattleTale's AI" : /too long/.test(e) ? "TattleTale's AI took too long" : "TattleTale's AI didn't answer";
// the log that makes every report a test case: what each model said, next to what you sent
function logAI(d, look) {
  if (!look || look.error) return;
  d.aiLog = [...(d.aiLog || []), { model: look.tier ? `shared-${look.tier === 'computer' ? 'computer' : look.model}` : look.model, v: look.violation?.choice || '', p: +(look.violation?.p || 0).toFixed(3), plate: look.plate || '', ms: look.ms, cost: look.cost }];
}
function aiLines(r) {
  const out = [], who = (m, tier, label) => tier === 'computer' ? "TattleTale's AI (owner's computer)" : tier === 'cloud' ? `TattleTale's AI (${label || AI.LABEL[m] || 'cloud'})` : AI.LABEL[m] || 'AI';
  if (r._ai) out.push(['warn', aiSource() === 'shared' ? "Asking TattleTale's AI…" : 'AI assist is looking at the photo…']);
  if (r.aiFirst) out.push(['ok', "AI assist is on: when your phone can't tell, TattleTale's AI checks the photo and keeps nothing. Turn it off in About."]);
  if (r.aiNote) out.push(['warn', r.aiNote]);
  if (r.aiPick) {
    const pc = Math.round(100 * r.aiPick.p), v = VMAP[r.aiPick.key], est = r.aiPick.calibrated === false || r.aiPick.model === 'qwen' ? ', its own estimate' : '', w = who(r.aiPick.model, r.aiPick.tier, r.aiPick.label);
    out.push(r.aiPick.key === 'none' ? ['warn', `${w} sees no violation (${pc}% sure${est}). Pick one if it's wrong.`]
      : r.aiPick.p >= 0.8 ? ['ok', `${w}: ${v.label} (${pc}% sure${est})`] : ['warn', `${w}'s best guess is ${v.label.toLowerCase()} (${pc}%${est}), not sure enough to pick it for you.`]);
  }
  if (r.aiAltPlate) out.push(['warn', `${r.aiAltBy ? `TattleTale's AI (${r.aiAltBy})` : who(r.aiPick?.model, r.aiPick?.tier, r.aiPick?.label)} read the plate as ${r.aiAltPlate}. Check which is right.`]);
  if (r.plateByAI) out.push(['warn', `Only ${who(r.plateByAI)} could read the plate. Check it.`]);
  if (r.aiPlateDoubt) out.push(['warn', "AI couldn't match the plate to any reading. Check it."]);
  const other = (r.aiLog || []).slice(1).find(x => x.model !== r.aiPick?.model);
  if (other) out.push(['ok', `Second opinion, ${who(other.model)}: ${other.v === 'none' ? 'no violation' : (VMAP[other.v]?.label || '?').toLowerCase()} (${Math.round(100 * other.p)}%)${other.plate ? `, plate ${other.plate}` : ''}`]);
  if (r.aiCost) out.push(['ok', `AI cost for this photo: $${r.aiCost.toFixed(5)}`]);
  return out;
}
function bindAI() {
  const key = $('#ai-key'), on = $('#ai-on'), st = $('#ai-status'), model = $('#ai-model'), cmp = $('#ai-compare'), lurl = $('#ai-local-url'), ltok = $('#ai-local-token'), blurb = $('#ai-blurb');
  if (!key) return;
  const opt = model.querySelector('option[value=shared]'); if (opt) opt.hidden = opt.disabled = !AI.SHARED;
  const show = (m = '') => {
    const md = aiSource();
    blurb.textContent = AI.SHARED ? "On photos you share or choose, TattleTale's AI steps in when your phone can't tell what's wrong or can't read the plate for sure: it suggests the violation and double-checks the plate. Free, nothing to set up." : 'This copy of the app has no shared AI. You can try models with your own key under Advanced.';
    model.value = md; on.checked = aiEnabled(); cmp.checked = !!settings.aiCompare; lurl.value = settings.localUrl || ''; $('#ai-local').hidden = md !== 'local';
    $('#ai-key-row').hidden = $('#ai-compare-row').hidden = md === 'shared';
    if (settings.aiModel && settings.aiModel !== 'shared') $('#ai-adv').open = true;
    st.textContent = m || (md === 'shared' ? '' : md === 'local' ? (settings.localUrl ? `Using ${settings.localUrl}` : 'Add your server address.') : settings.aiKey ? `OpenRouter key saved on this phone (ends in ${settings.aiKey.slice(-4)}).` : 'No key yet.');
  };
  key.onchange = () => { const v = key.value.trim(); if (v) { settings.aiKey = v; settings.aiOn = true; saveSettings(); key.value = ''; show(); } };
  model.onchange = () => { settings.aiModel = model.value; saveSettings(); show(); };
  cmp.onchange = () => { settings.aiCompare = cmp.checked; saveSettings(); show(); };
  lurl.onchange = () => { settings.localUrl = lurl.value.trim(); saveSettings(); show(); };
  ltok.onchange = () => { const v = ltok.value.trim(); if (v) { settings.localToken = v; ltok.value = ''; saveSettings(); show('Token saved.'); } };
  on.onchange = () => { settings.aiOn = on.checked && aiReady(aiSource()); saveSettings(); show(settings.aiOn || !on.checked ? '' : 'Add a key or server under Advanced first.'); };
  $('#ai-forget').onclick = () => { delete settings.aiKey; delete settings.localToken; settings.aiOn = false; saveSettings(); show('Key and token removed.'); };
  $('#ai-test').onclick = async () => {
    const md = aiSource();
    if (!aiReady(md)) return show('Add a key or server under Advanced first.');
    show('Testing…');
    try { const t = await AI.ping(aiCfg(md)); show(md === 'shared' ? `${t.ok ? 'Works' : 'Not fully working'}: ${t.note}.` : `Works: ${AI.LABEL[md]} answered in ${t.ms} ms (${t.note}), cost $${t.cost.toFixed(6)}.`); }
    catch (e) { show(`Didn't work: ${e.message}.`); }
  };
  show();
}

// ---------- quick pick (photos shared to the app or chosen from the gallery) ----------
function solidDraft(r) { return !!(r && r.street && r.plate && !r.plateUnsure && !r._ai && r.locSource !== 'signs' && r.timeSource !== 'file' && !r._reading && !r._locating); }
function sendDraftNow() {
  const r = draft; if (!r) return;
  if (!r.msgTouched) r.message = smsBody(r);
  r.status = 'texted'; r.sentAt = new Date().toISOString(); store.save(clean(r)); pendingSent = r.id;
  openSms(r.message);
  setTimeout(() => { if (draft === r) draft = null; go('report'); showSentBar(r); }, 300);
}
function quickPick(vkey) {
  const r = draft; if (!r) return;
  r.violation = vkey; r._pick = vkey;
  if (!r.msgTouched) r.message = smsBody(r);
  if (!settings.review && isPhone() && solidDraft(r)) { sendDraftNow(); return; }
  renderResult(); pickFollowUp(true);
}
function pickFollowUp(fromTap) {
  const r = draft; if (!r || !r._pick || r._reading || r._locating || r._ai) return;
  // the tap that picked can still open Messages for a few seconds while the photo finishes reading
  if (!fromTap && !settings.review && isPhone() && solidDraft(r) && navigator.userActivation?.isActive) { sendDraftNow(); return; }
  const issue = document.querySelector('#view-result .checks li.bad, #view-result .checks li.warn');
  (issue || $('#sms-link'))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#sms-link')?.classList.add('pulse');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b && draft) quickPick(b.dataset.pick); });
function pickBlock(r) {
  if (!r.fromPhoto) return '';
  const busy = r._reading || r._locating;
  const sug = r.aiPick && r.aiPick.key !== 'none' && r.aiPick.p >= 0.8 ? r.aiPick.key : '';
  const hint = !r._pick ? (sug ? `AI picked ${VMAP[sug].label.toLowerCase()}. Tap it to send, or pick another.` : '') : busy ? 'Reading the photo…' : settings.review ? 'Check the details, then tap Text 311.' : solidDraft(r) ? '' : 'Check the items marked below, then tap Text 311.';
  return `<div class="pick"><div class="pick-h">What is wrong?</div>
      <div class="vgrid">${VIOLATIONS.slice(0, 7).map(v => `<button class="vbtn${r._pick === v.key ? ' on' : !r._pick && sug === v.key ? ' suggest' : ''}" type="button" data-pick="${v.key}">${esc(v.btn)}${!r._pick && sug === v.key ? ' ✓' : ''}</button>`).join('')}</div>
      ${hint ? `<p class="small muted" style="margin:6px 0 0">${esc(hint)}</p>` : ''}</div>`;
}

// ---------- review screen ----------
let draft = null;
function fld(key, label, o = {}) {
  const id = 'r-' + key, v = draft[key] ?? '';
  if (o.options) return `<label class="f" for="${id}">${esc(label)}<select id="${id}" data-r="${key}">${o.options.map(x => { const [val, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}"${String(v) === String(val) ? ' selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
  if (o.area) return `<label class="f" for="${id}">${esc(label)}<textarea id="${id}" data-r="${key}">${esc(v)}</textarea></label>`;
  return `<label class="f" for="${id}">${esc(label)}<input id="${id}" data-r="${key}" type="${o.type || 'text'}"${o.type === 'datetime-local' ? ' step="1"' : ''}${o.mono ? ' class="mono"' : ''} value="${esc(v)}" autocomplete="off"></label>`;
}
function checksFor(r) {
  const out = [];
  out.push(r.plate && r.plateAI ? ['ok', `Plate ${r.plate} (${r.plateState}), double-checked by ${AI.LABEL[r.plateAIModel] || 'AI'} (${Math.round(100 * r.plateAI)}%).`] : r.plate && r.plateUnsure ? ['warn', `Plate ${r.plate} (${r.plateState})? It took a closer second look to read, so check every character against the photo.`] : r.plate ? ['ok', `Plate ${r.plate} (${r.plateState}). Check it against the photo.`] : r._reading ? ['warn', 'Reading the plate…'] : ['warn', 'Plate not readable. Type it, or send without it.']);
  const locNote = { photo: " (from the photo's GPS)", current: ' (your current location)', signs: r.gpsBlanked ? " (Android removed the photo's GPS, so this was read from the street signs: check it)" : ' (read from the street signs: check it)' }[r.locSource] || '';
  out.push(r.street ? [r.locSource === 'signs' ? 'warn' : 'ok', `Location: ${where(r)}${locNote}`] : r._locating ? ['warn', 'Finding where you are…'] : ['bad', r.gpsBlanked ? 'Android removed this photo\'s location. Pick it with "Choose a photo" (it opens Files, which keeps it), or type the address.' : 'No location in this photo. Type the address.']);
  if (r.timeSource) out.push(r.timeSource === 'photo' ? ['ok', `Taken ${fmtWhen(r.observedAt)} (from the photo)`] : ['warn', `No capture time in this photo; using ${fmtWhen(r.observedAt)}. Fix it below if that's wrong.`]);
  out.push(...aiLines(r));
  if (r.violation === 'bike_lane' && r.mapChecked) out.push(r.hasBikeLane ? ['ok', `City map shows a ${r.bikeLane} on this block`] : ['warn', 'The city map shows no bike lane on this block.']);
  return out;
}
function renderResult() {
  const el = $('#view-result'); if (!draft) { el.innerHTML = ''; return; }
  const r = draft; if (!r.msgTouched) r.message = smsBody(r);
  const active = document.activeElement?.id;
  const box = lastShot?.box && lastShot.canvas ? lastShot.box : null;
  const photo = lastShot?.canvas ? `<div class="photo"><span class="pw"><img src="${lastShot.url || (lastShot.url = lastShot.canvas.toDataURL('image/jpeg', 0.8))}" alt="Your photo">${box ? `<span class="pbox" style="left:${100 * box.x1 / lastShot.canvas.width}%;top:${100 * box.y1 / lastShot.canvas.height}%;width:${100 * (box.x2 - box.x1) / lastShot.canvas.width}%;height:${100 * (box.y2 - box.y1) / lastShot.canvas.height}%"></span>` : ''}</span></div>` : (r.thumb ? `<div class="photo"><span class="pw"><img src="${r.thumb}" alt="Your photo"></span></div>` : '');
  el.innerHTML = `<div class="card">
      <div class="row" style="justify-content:space-between"><h2>Check and send</h2><button class="btn small" type="button" data-act="discard">Start over</button></div>
      ${photo}
      ${pickBlock(r)}
      <ul class="checks">${checksFor(r).map(([l, t]) => `<li class="${l}"><span class="i">${l === 'ok' ? '✓' : l === 'warn' ? '!' : '✕'}</span><span>${esc(t)}</span></li>`).join('')}</ul>
      <div id="block-stats" class="small muted"></div>
    </div>
    <div class="card">
      ${fld('violation', 'What is wrong', { options: VIOLATIONS.map(v => [v.key, v.label]) })}
      <div class="grid2">${fld('plate', 'Plate', { mono: true })}${fld('plateState', 'Plate state', { options: STATES })}</div>
      <div class="grid3">${fld('houseNumber', 'House #')}${fld('street', 'Street')}${fld('borough', 'Borough', { options: ['', ...BOROUGHS] })}</div>
      <div class="grid2">${fld('crossFrom', 'Cross street')}${fld('crossTo', 'Other cross street')}</div>
      ${fld('where', 'Spot', { options: [['front', 'Mid-block'], ['intersection', 'At the corner']] })}
      ${fld('observedAt', 'Seen at', { type: 'datetime-local' })}
      ${fld('message', 'Text to 311', { area: true })}
    </div>
    <div class="card">
      <a class="btn primary big" id="sms-link" href="${esc(smsHref(r.message))}" data-act="sms">Text 311 (you press Send)</a>
      <div class="row"><button class="btn" type="button" data-act="web">Use the 311 website</button><button class="btn" type="button" data-act="save">Just save it</button></div>
      <p class="tip">Texting goes to 311's live agents at 311-692, who file it with NYPD and reply with a service request number. The website takes about a minute: the description is copied for you.</p>
    </div>`;
  if (active && document.getElementById(active)) document.getElementById(active).focus();
  loadBlockStats(r);
}
document.addEventListener('input', e => {
  const k = e.target.dataset?.r; if (!k || !draft) return;
  draft[k] = e.target.value;
  if (k === 'plate') { draft.plate = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); draft.plateTouched = true; draft.plateUnsure = false; draft.plateAI = 0; draft.aiAltPlate = ''; draft.plateByAI = ''; }
  if (k === 'message') draft.msgTouched = true; else if (!draft.msgTouched) { draft.message = smsBody(draft); const ta = $('#r-message'); if (ta) ta.value = draft.message; }
  const a = $('#sms-link'); if (a) a.href = smsHref(draft.message);
});
document.addEventListener('change', e => { if (e.target.dataset?.r && draft && e.target.tagName === 'SELECT') renderResult(); });
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]'); if (!a || !draft && !['still-plate', 'still-co', 'idle-save', 'idle-discard'].includes(a.dataset.act)) return;
  const act = a.dataset.act;
  if (act === 'discard') { draft = null; go('report'); }
  if (act === 'sms') {
    if (!draft.street) { e.preventDefault(); toast('Add the address first.'); $('#r-street')?.focus(); return; }
    draft.status = 'texted'; draft.sentAt = new Date().toISOString(); store.save(clean(draft));
    if (window.__curbTest) { e.preventDefault(); window.__curbTest.sms = draft.message; }
    setTimeout(() => { const r = draft; draft = null; go('report'); showSentBar(r); }, 300);
  }
  if (act === 'web') {
    if (!draft.street) { toast('Add the address first.'); return; }
    await copyText(webDescription(draft)); draft.status = 'web'; draft.sentAt = new Date().toISOString(); store.save(clean(draft));
    showWebSteps(draft);
  }
  if (act === 'save') { draft.status = 'logged'; store.save(clean(draft)); draft = null; toast('Saved to My reports'); go('log'); }
});
function clean(r) { const { _reading, _noPlate, _locating, _pick, _ai, _res, aiFirst, aiAltBy, plateTouched, plateUnsure, fromPhoto, aiCands, aiNote, aiAltPlate, ...rest } = r; return rest; }
function showWebSteps(r) {
  const v = VMAP[r.violation];
  $('#modal-root').innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="311 website steps"><div class="card">
    <h2>File on the 311 website</h2>
    <p class="small">The description is copied. On 311's form:</p>
    <ol class="small" style="margin:0;padding-left:20px;display:grid;gap:4px">
      <li>Problem Detail: <b>${esc(v.detail)}</b></li>
      <li>Date/Time Observed: use the calendar, ${esc(fmtShort(r.observedAt))}</li>
      <li>Description: paste</li>
      <li>Address: tap the search icon, type <b>${esc(r.where === 'intersection' ? `${titleCase(r.street)} & ${titleCase(r.crossFrom || r.crossTo)}, ${titleCase(r.borough)}` : `${r.houseNumber} ${titleCase(r.street)}, ${titleCase(r.borough)}`)}</b>, pick the match</li>
      <li>Stay anonymous or add your email to get the result</li>
      <li>Submit, then add the 311 number in My reports</li>
    </ol>
    <div class="row"><a class="btn primary" href="${LINK_311}" target="_blank" rel="noopener" id="open-311">Open 311 form</a><button class="btn" type="button" id="web-close">Done</button></div>
  </div></div>`;
  $('#web-close').onclick = () => { $('#modal-root').innerHTML = ''; draft = null; go('log'); };
}

// ---------- block stats from NYC Open Data ----------
const statCache = new Map();
function bucket(desc, status) {
  if (!desc) return status === 'Closed' ? 'Closed, no detail' : 'Still open';
  if (/issued a summons/i.test(desc)) return 'Ticketed';
  if (/made an arrest/i.test(desc)) return 'Arrest';
  if (/tow truck to remove/i.test(desc)) return 'Towed';
  if (/corrected without the need/i.test(desc)) return 'Moved along, no ticket';
  if (/upon their arrival|no evidence of a criminal violation/i.test(desc)) return 'Gone when police came';
  if (/police action was not necessary/i.test(desc)) return 'Police said no action needed';
  if (/does not fall under the jurisdiction/i.test(desc)) return 'Sent to another agency';
  return 'Other';
}
async function sodaStats(detail, lat, lon, radius) {
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 19);
  let where = `descriptor='${detail}' AND created_date>'${since}'`;
  if (lat != null) where += ` AND within_circle(location,${lat.toFixed(4)},${lon.toFixed(4)},${radius})`;
  const url = `${SODA}?$select=resolution_description,status,count(*) as n&$where=${encodeURIComponent(where)}&$group=resolution_description,status&$limit=200`;
  if (statCache.has(url)) return statCache.get(url);
  const p = fetch(url).then(r => { if (!r.ok) throw new Error('stats'); return r.json(); }).then(rows => {
    const b = {}; let total = 0;
    for (const row of rows) { const n = +row.n || 0; total += n; const k = bucket(row.resolution_description, row.status); b[k] = (b[k] || 0) + n; }
    return { total, buckets: Object.entries(b).sort((x, y) => y[1] - x[1]) };
  });
  statCache.set(url, p); p.catch(() => statCache.delete(url));
  return p;
}
async function sodaTiming(detail, lat, lon, radius) {
  const since = toLocalInput(new Date(Date.now() - 365 * 864e5));
  let where = `descriptor='${detail}' AND created_date>'${since}' AND closed_date IS NOT NULL AND date_extract_y(closed_date)=date_extract_y(created_date) AND date_extract_m(closed_date)=date_extract_m(created_date)`;
  if (lat != null) where += ` AND within_circle(location,${lat.toFixed(4)},${lon.toFixed(4)},${radius})`;
  const sel = `count(*) as n, sum(case(${MINS_SQL}<5,1,true,0)) as f5, sum(case(${MINS_SQL}<10,1,true,0)) as f10, sum(case(${MINS_SQL}>=60,1,true,0)) as s1, sum(case(${MINS_SQL}>=180,1,true,0)) as s3`;
  const url = `${SODA}?$select=${encodeURIComponent(sel)}&$where=${encodeURIComponent(where)}`;
  if (statCache.has(url)) return statCache.get(url);
  const p = fetch(url).then(r => { if (!r.ok) throw new Error('timing'); return r.json(); }).then(rows => { const x = rows[0] || {}; return { n: +x.n || 0, f5: +x.f5 || 0, f10: +x.f10 || 0, s1: +x.s1 || 0, s3: +x.s3 || 0 }; });
  statCache.set(url, p); p.catch(() => statCache.delete(url));
  return p;
}
const pct = (a, n) => { const v = n ? 100 * a / n : 0; return v < 10 ? v.toFixed(1) : String(Math.round(v)); };
function timingHTML(t) {
  return `<div class="stat"><div class="tile"><b>${pct(t.f5, t.n)}%</b><span>closed in under 5 min</span></div><div class="tile"><b>${pct(t.f10, t.n)}%</b><span>under 10 min</span></div><div class="tile"><b>${pct(t.s3, t.n)}%</b><span>3+ hours later</span></div></div>
    <p class="small">${t.f5.toLocaleString()} of ${t.n.toLocaleString()} were closed in under 5 minutes, too fast for anyone to have come and checked. ${pct(t.s1, t.n)}% were closed an hour or more after 311 logged them.</p>`;
}
async function loadBlockStats(r) {
  const el = $('#block-stats'); if (!el || r.lat == null) return;
  const v = VMAP[r.violation];
  try {
    const s = await sodaStats(v.detail, r.lat, r.lon, 150);
    if (!$('#block-stats')) return;
    const t = s.buckets.find(b => b[0] === 'Ticketed')?.[1] || 0;
    el.textContent = s.total ? `Within about a block, the past year: ${s.total.toLocaleString()} "${v.detail}" complaint${s.total > 1 ? 's' : ''}, ${t.toLocaleString()} ticketed.` : `No "${v.detail}" complaints within about a block in the past year. Yours would be the first.`;
  } catch { el.textContent = ''; }
}

// ---------- photos and videos from the phone (keep their time and location) ----------
const IS_ANDROID = /Android/i.test(navigator.userAgent);
// Android's Photo Picker hands web apps a copy with the GPS blanked. The Files picker hands over the original.
async function pickMedia(kind) {
  if (IS_ANDROID && 'showOpenFilePicker' in window) {
    try {
      const types = kind === 'video' ? [{ description: 'Videos', accept: { 'video/*': ['.mp4', '.mov', '.3gp', '.webm'] } }]
        : [{ description: 'Photos', accept: { 'image/*': ['.jpg', '.jpeg', '.heic', '.heif', '.png', '.webp'] } }];
      const [h] = await window.showOpenFilePicker({ types, multiple: false });
      return await h.getFile();
    } catch (e) { if (e && e.name === 'AbortError') return null; }
  }
  const inp = $(kind === 'video' ? '#in-video-any' : '#in-photo');
  // an extra non-media type stops Android Chrome from using the location-stripping Photo Picker
  inp.accept = IS_ANDROID ? `${kind}/*,application/octet-stream` : `${kind}/*`;
  return new Promise(res => { inp.onchange = () => { const f = inp.files[0] || null; inp.value = ''; res(f); }; inp.click(); });
}
// capture time and place from the photo's own EXIF
async function photoMeta(file) {
  const out = { when: '', lat: null, lon: null, gpsBlanked: false, source: '' };
  try {
    const raw = await exifr.parse(file, { reviveValues: false });
    const stamp = exifStamp(raw?.DateTimeOriginal || raw?.CreateDate || raw?.DateTime);
    const off = String(raw?.OffsetTimeOriginal || raw?.OffsetTime || '').match(/^([+-])(\d{2}):?(\d{2})$/);
    if (stamp && off) { // shot in another time zone: convert the absolute time to New York time
      const [y, mo, d, h, mi, s] = stamp.split(/[-T:]/).map(Number);
      const mins = (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3]));
      out.when = toLocalInput(new Date(Date.UTC(y, mo - 1, d, h, mi, s) - mins * 60000));
    } else out.when = stamp;
    if (out.when) out.source = 'photo';
    const hasTags = raw && ('GPSLatitude' in raw || 'GPSLongitude' in raw || 'latitude' in raw);
    const ok = raw && isFinite(raw.latitude) && isFinite(raw.longitude) && !(raw.latitude === 0 && raw.longitude === 0);
    if (ok) { out.lat = raw.latitude; out.lon = raw.longitude; }
    else if (hasTags) out.gpsBlanked = true;
  } catch {}
  return out;
}
// street signs in the photo -> intersection, when the photo has no GPS
let xings = null;
const SUFFIX = /\b(AVENUE|AVE|AV|STREET|STR|ST|PLACE|PL|ROAD|RD|BOULEVARD|BLVD|PARKWAY|PKWY|DRIVE|DR|LANE|LN|COURT|CT|TERRACE|TER|EXPRESSWAY|EXPY|HIGHWAY|HWY|PLAZA|PLZ|SQUARE|SQ)\b/g;
const coreOf = s => String(s).toUpperCase().replace(/(\d+)(ST|ND|RD|TH)\b/g, '$1').replace(SUFFIX, ' ').replace(/[^A-Z0-9]/g, '');
async function placeFromSigns(texts, near) {
  try {
    if (!xings) { const j = await (await fetch('geo/intersections.json')).json(); xings = { n: j.n, core: j.n.map(coreOf), x: j.x }; }
  } catch { return null; }
  const toks = new Set();
  for (const t of texts) {
    const up = String(t).toUpperCase(); const c = coreOf(up); if (c.length >= 2) toks.add(c);
    for (const w of up.split(/[^A-Z0-9]+/)) if (w.length >= 2) toks.add(coreOf(w) || w);
  }
  const T = [...toks].filter(Boolean);
  const hit = new Map(); // name index -> matched?
  const matches = i => {
    if (hit.has(i)) return hit.get(i);
    const core = xings.core[i]; let ok = false;
    if (core && core.length >= 2) {
      if (/\d/.test(core)) ok = T.some(t => t === core);
      else if (core.length >= 4) ok = T.some(t => t.length >= 4 && (t.includes(core) || (core.startsWith(t) && t.length >= core.length - 1)));
      else ok = T.some(t => t === core);
    }
    hit.set(i, ok); return ok;
  };
  let best = null;
  for (const row of xings.x) {
    let score = 0; const names = [];
    for (let k = 3; k < row.length; k++) if (matches(row[k])) { score++; names.push(xings.n[row[k]]); }
    if (score < 2) continue;
    const lat = row[1] / 1e5, lon = row[2] / 1e5;
    const dist = near ? metersBetween(near, { lat, lon }) : 0;
    if (!best || score > best.score || (score === best.score && dist < best.dist)) best = { score, names, lat, lon, dist, boro: row[0] };
  }
  return best;
}
async function fromGallery(file, via) {
  if (!file) return;
  if (/^video\//.test(file.type)) { go('idling'); startIdling(file); return; }
  const meta = await photoMeta(file);
  let gps = meta.lat != null ? { lat: meta.lat, lon: meta.lon, src: 'photo' } : null;
  const when = meta.when || toLocalInput(new Date(file.lastModified || Date.now()));
  const fresh = !!meta.when && Date.now() - fromLocalInput(meta.when) < 15 * 60 * 1000; // only trust the photo's own clock
  if (!gps && fresh && here.lat != null && Date.now() - here.ts < 60000) gps = { lat: here.lat, lon: here.lon, src: 'current' };
  const place = gps ? await reverseGeocode(gps.lat, gps.lon) : null;
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) { toast('Could not open that photo.'); return; }
  const c = canvasFrom(bmp, 2400);
  lastShot = { canvas: c, box: null };
  draft = newReport('bike_lane', { place, lat: gps?.lat, lon: gps?.lon, observedAt: when, thumb: canvasFrom(c, 360).toDataURL('image/jpeg', 0.7) });
  draft.timeSource = meta.when ? 'photo' : 'file';
  draft.locSource = gps ? gps.src : '';
  draft.gpsBlanked = meta.gpsBlanked;
  draft.fromPhoto = true;
  const d = draft;
  if (!gps && fresh) {
    // taken in the last 15 minutes: you are probably still there
    d._locating = true;
    hereNow().then(async p => {
      if (draft !== d) return;
      const pl = p && (!d.street || d.locSource === 'signs') ? await reverseGeocode(p.lat, p.lon) : null;
      if (draft !== d) return;
      if (pl) Object.assign(d, placeFields(pl), { lat: p.lat, lon: p.lon, locSource: 'current' });
      d._locating = false;
      if (!d.msgTouched) d.message = smsBody(d);
      renderResult(); pickFollowUp(false);
    });
  }
  go('result'); readShot(c);
}

// ---------- idling (DEP reward) ----------
let idle = null;
function renderIdling() {
  const el = $('#view-idling');
  if (!idle) {
    el.innerHTML = `<div class="card">
      <h2>Idling truck or bus: DEP reward</h2>
      <p class="small">If a truck or bus idles more than 3 minutes (1 minute next to a school or park), DEP fines the owner and pays you 25% of the fine when it is upheld. DEP needs a date- and time-stamped video that shows the plate, the company name on the truck, and the exhaust or engine sound.</p>
      <ol class="small" style="margin:0;padding-left:20px;display:grid;gap:4px">
        <li>Record with a timestamp camera app (DEP names Timestamp Camera Enterprise, free) for at least 3:04, starting at the plate and ending at the company name.</li>
        <li>Choose the video here. TattleTale checks it against DEP's rules, reads the plate and company, and makes the two stills DEP asks for.</li>
        <li>Paste the fields into DEP's form and upload the video and stills.</li>
      </ol>
      <button class="btn primary big" type="button" id="btn-pick-video">Choose idling video</button>
      <p class="tip">On Android this opens Files so the video keeps its time and location. Pick it from DCIM, Camera, or your timestamp app's folder.</p>
    </div>`;
    $('#btn-pick-video').onclick = async () => { const f = await pickMedia('video'); if (f) startIdling(f); };
    return;
  }
  const f = idle;
  const need = f.nearSchool ? 64 : 184, len = f.duration;
  const checks = [];
  checks.push(len == null ? ['warn', 'Could not read the video length'] : len >= need ? ['ok', `Video is ${fmtDur(len)}; DEP needs at least ${fmtDur(need)}`] : ['bad', `Video is ${fmtDur(len)}; DEP needs at least ${fmtDur(need)}`]);
  checks.push(f.plate ? ['ok', `Plate ${f.plate} (${f.plateState})`] : ['bad', 'DEP rejects complaints without a readable plate']);
  checks.push(f.company ? ['ok', `Company name: ${f.company}`] : ['bad', 'DEP needs the company name readable on the vehicle. Type it if the reader missed it.']);
  checks.push(f.stamp ? ['ok', `Timestamp on the video: "${f.stamp}"`] : ['warn', 'No date/time stamp found in the frames. DEP requires one burned into the video.']);
  checks.push(f.exhaust || f.audible ? ['ok', 'You confirmed exhaust or engine sound'] : ['bad', 'Confirm the exhaust is visible or the engine is audible from the front']);
  checks.push(f.noExempt ? ['ok', 'No lift gate, refrigeration or work equipment running'] : ['warn', 'Confirm no lift gate, refrigeration unit or work equipment was running']);
  const from = fromLocalInput(f.dateFrom); if (from) { const days = (Date.now() - from) / 864e5; checks.push(days > 90 ? ['bad', 'Older than 90 days. DEP may reject it.'] : ['ok', `Recorded ${Math.max(0, Math.floor(days))} days ago (limit 90)`]); }
  checks.push(f.street ? ['ok', `Location: ${where(f)}`] : ['bad', f.locNote || 'No location yet. Type the address.']);
  const blockers = checks.filter(c => c[0] === 'bad').length;
  const yn = b => b ? 'Yes' : 'No';
  const input = (k, label, o = {}) => `<label class="f" for="i-${k}">${esc(label)}${o.options ? `<select id="i-${k}" data-i="${k}">${o.options.map(x => `<option${String(f[k]) === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : o.area ? `<textarea id="i-${k}" data-i="${k}">${esc(f[k])}</textarea>` : `<input id="i-${k}" data-i="${k}" type="${o.type || 'text'}"${o.type === 'datetime-local' ? ' step="1"' : ''} value="${esc(f[k])}"${o.mono ? ' class="mono"' : ''} autocomplete="off">`}</label>`;
  const cb = (k, label) => `<label class="cb" for="i-${k}"><input type="checkbox" id="i-${k}" data-i="${k}"${f[k] ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  f.description = f.descTouched ? f.description : idleDescription(f);
  const rows = [['Bus/van with 15 passengers or less?', yn(f.vehicleType === 'BUS' && f.smallBus)], ['Loading or unloading passengers?', 'No'], ['Process activity (reefer, lift gate, mixer)?', yn(!f.noExempt)], ['Private vehicle?', 'No'],
    ['Company name', f.company], ['Company house number', f.coHouse], ['Company street', f.coStreet], ['Company city', f.coCity], ['Company state', f.coState], ['Company ZIP', f.coZip],
    ['Occurrence date from', f.dateFrom ? `${fmtDate(f.dateFrom)} ${fmtTime(f.dateFrom)}` : ''], ['Occurrence date to', f.dateTo ? `${fmtDate(f.dateTo)} ${fmtTime(f.dateTo)}` : ''], ['Location type', f.where === 'intersection' ? 'Intersection' : 'In front of'],
    ['House number', f.where === 'intersection' ? '' : f.houseNumber], ['Street name', titleCase(f.street)], ['Borough', f.borough], ['Vehicle type', f.vehicleType], ['License plate', f.plate], ['License state', f.plateState], ['In front of school', yn(f.nearSchool)], ['Description', f.description]];
  el.innerHTML = `<div class="card"><div class="row" style="justify-content:space-between"><h2>Idling report</h2><button class="btn small" type="button" data-act="idle-discard">Start over</button></div>
      ${f.frames?.length ? `<div class="thumbs">${f.frames.map((fr, i) => `<img src="${fr.url}" alt="Frame ${i + 1} at ${fmtDur(fr.t)}">`).join('')}</div>` : ''}
      ${f.busy ? `<p class="small">${esc(f.busy)}</p><div class="progress"><span style="width:${f.pct || 0}%"></span></div>` : ''}
      ${blockers ? `<div class="notice bad">${blockers} thing${blockers > 1 ? 's' : ''} DEP would likely reject this for.</div>` : '<div class="notice ok">Meets DEP\'s requirements as far as the app can tell. Watch the video once before you swear to it.</div>'}
      <ul class="checks">${checks.map(([l, t]) => `<li class="${l}"><span class="i">${l === 'ok' ? '✓' : l === 'warn' ? '!' : '✕'}</span><span>${esc(t)}</span></li>`).join('')}</ul>
      ${cb('exhaust', 'Exhaust is visible in the video')}${cb('audible', 'Engine is clearly audible, recorded from the front')}${cb('noExempt', 'No lift gate, refrigeration unit or work equipment was running')}${cb('nearSchool', 'Next to a school (pre-K to 12) or park: 1-minute limit')}
    </div>
    <div class="card">
      <div class="grid2">${input('plate', 'Plate (required)', { mono: true })}${input('plateState', 'Plate state', { options: STATES })}</div>
      ${input('vehicleType', 'Vehicle type', { options: ['TRUCK', 'BUS', 'VAN'] })}
      ${input('company', 'Company name on the vehicle')}
      <div class="grid3">${input('coHouse', 'Co. house #')}${input('coStreet', 'Co. street')}${input('coCity', 'Co. city')}</div>
      <div class="grid2">${input('coState', 'Co. state', { options: STATES })}${input('coZip', 'Co. ZIP')}</div>
      ${input('dateFrom', 'Idling from', { type: 'datetime-local' })}${input('dateTo', 'Idling to', { type: 'datetime-local' })}
      <div class="grid3">${input('houseNumber', 'House #')}${input('street', 'Street')}${input('borough', 'Borough', { options: ['', ...BOROUGHS] })}</div>
      ${input('description', 'Describe the complaint', { area: true })}
    </div>
    <div class="card"><h3>Stills for DEP</h3>
      <label class="f" for="i-plateFrame">Plate still<select id="i-plateFrame" data-frame="plateFrame">${(f.frames || []).map((fr, i) => `<option value="${i}"${i === f.plateFrame ? ' selected' : ''}>Frame ${i + 1} at ${fmtDur(fr.t)}</option>`).join('')}</select></label>
      <label class="f" for="i-coFrame">Company still<select id="i-coFrame" data-frame="coFrame">${(f.frames || []).map((fr, i) => `<option value="${i}"${i === f.coFrame ? ' selected' : ''}>Frame ${i + 1} at ${fmtDur(fr.t)}</option>`).join('')}</select></label>
      <div class="row"><button class="btn" type="button" data-act="still-plate">Save plate still</button><button class="btn" type="button" data-act="still-co">Save company still</button></div>
    </div>
    <div class="card"><h3>DEP form fields</h3>
      <div class="fields">${rows.map(([k, v]) => `<div class="fr"><div><div class="k">${esc(k)}</div><div class="v">${esc(v || '(blank)')}</div></div>${v ? `<button class="btn small" type="button" data-copy="${esc(v)}">Copy</button>` : ''}</div>`).join('')}</div>
      <div class="row"><a class="btn primary" href="${LINK_DEP}" target="_blank" rel="noopener">Open DEP system</a><button class="btn" type="button" data-act="idle-save">Save to My reports</button></div>
      <p class="tip">You sign in to DEP, upload the video and the two stills, and tick the sworn statement yourself. A summons that is upheld and paid earns 25% of the fine; track it on <a href="${LINK_OATH}" target="_blank" rel="noopener">OATH's ticket finder</a>.</p>
    </div>`;
}
function idleDescription(f) {
  const parts = [`${f.company ? f.company + ' ' : ''}${f.vehicleType.toLowerCase()}, plate ${f.plate || '[plate]'} (${f.plateState}), idled at ${where(f) || '[location]'} from ${fmtTime(f.dateFrom) || '[start]'} to ${fmtTime(f.dateTo) || '[end]'} on ${fmtDate(f.dateFrom) || '[date]'}, recorded continuously on video.`];
  const ev = []; if (f.exhaust) ev.push('exhaust is visible'); if (f.audible) ev.push('the engine is audible, recorded from the front');
  if (ev.length) parts.push(`In the video ${ev.join(' and ')}.`);
  if (f.noExempt) parts.push('No lift gate, refrigeration unit or work equipment was operating.');
  if (f.nearSchool) parts.push('The vehicle was next to a school or park, shown in the video with its signage.');
  return parts.join(' ');
}
function loadVideo(file) { return new Promise((ok, no) => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(file); v.onloadedmetadata = () => ok(v); v.onerror = () => no(new Error('This phone cannot open that video here.')); }); }
function seek(v, t) { return new Promise(ok => { const done = () => { v.removeEventListener('seeked', done); ok(); }; v.addEventListener('seeked', done); v.currentTime = Math.max(0, Math.min(t, v.duration - 0.05)); }); }
function parseStamp(text) {
  const t = text.replace(/\s+/g, ' ');
  let m = t.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2}).{0,6}?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  let y, mo, d, h, mi, s, ap;
  if (m) [, y, mo, d, h, mi, s, ap] = m;
  else if ((m = t.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2}|\d{2}).{0,6}?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i))) [, mo, d, y, h, mi, s, ap] = m;
  else if ((m = t.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s*(\d{1,2}),?\s*(20\d{2}).{0,6}?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i))) { mo = 'JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC'.indexOf(m[1].toUpperCase().slice(0, 3)) / 3 + 1; [, , d, y, h, mi, s, ap] = m; }
  else return null;
  y = +y; if (y < 100) y += 2000; h = +h; if (ap) { ap = ap.toUpperCase(); if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0; }
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || h > 23 || +mi > 59) return null;
  const p2 = n => String(n).padStart(2, '0');
  return { text: m[0], value: `${y}-${p2(mo)}-${p2(d)}T${p2(h)}:${p2(mi)}:${p2(s || 0)}` };
}
async function startIdling(file) {
  if (!file) return;
  idle = { kind: 'idling', id: uid(), createdAt: new Date().toISOString(), file, frames: [], plate: '', plateState: 'NY', vehicleType: 'TRUCK', company: '', coHouse: '', coStreet: '', coCity: '', coState: 'NY', coZip: '', dateFrom: '', dateTo: '', where: 'front', houseNumber: '', street: '', borough: '', crossFrom: '', crossTo: '', zip: '', nearSchool: false, exhaust: false, audible: false, noExempt: false, description: '', descTouched: false, busy: 'Reading the video…', pct: 5, stamp: '', usdot: '' };
  renderIdling();
  let meta = {}; try { meta = await readMp4Meta(file); } catch {}
  let v; try { v = await loadVideo(file); } catch (e) { idle.busy = e.message; renderIdling(); return; }
  idle.video = v; idle.duration = isFinite(v.duration) ? v.duration : meta.durationSec;
  const start = meta.created || (file.lastModified ? new Date(file.lastModified - (idle.duration || 0) * 1000) : null);
  if (start) { idle.dateFrom = toLocalInput(start); idle.dateTo = toLocalInput(new Date(start.getTime() + (idle.duration || 0) * 1000)); }
  if (!meta.lat && meta.locationBlanked) idle.locNote = 'Android removed this video\'s location. Pick it with "Choose idling video" (it opens Files, which keeps it), or type the address.';
  if (meta.lat) { const p = await reverseGeocode(meta.lat, meta.lon); if (p) Object.assign(idle, { houseNumber: p.houseNumber || '', street: p.street, borough: p.borough, zip: p.zip, crossFrom: p.crossFrom, crossTo: p.crossTo, lat: meta.lat, lon: meta.lon }); }
  const n = 8, D = v.duration, votes = {}, coCands = {}; let bestPlate = { s: -1, i: 0 }, bestCo = { s: -1, i: 0 };
  for (let i = 0; i < n; i++) {
    const t = i === n - 1 ? Math.max(0, D - 0.4) : D * i / (n - 1);
    await seek(v, t);
    const c = canvasFrom(v, 1600);
    idle.frames.push({ t, url: c.toDataURL('image/jpeg', 0.6) });
    idle.busy = `Reading frame ${i + 1} of ${n}…`; idle.pct = 10 + 85 * i / n; renderIdling();
    try {
      const r = await ocr.read(await createImageBitmap(c), { maxSide: 1600, maxLines: 30 });
      if (r.plate && r.score >= 3) { votes[r.plate] = (votes[r.plate] || 0) + r.score; if (r.score > bestPlate.s) bestPlate = { s: r.score, i, state: r.state }; }
      const joined = r.lines.map(l => l.text).join(' ');
      if (i === 0 || i === n - 1) { const st = parseStamp(joined); if (st) { if (i === 0) { idle.dateFrom = st.value; idle.stamp = st.text.trim(); } else idle.dateTo = st.value; } }
      const dot = joined.match(/U\.?\s?S\.?\s?D\.?\s?O\.?\s?T\.?\s*(?:NO\.?|#)?\s*(\d{5,8})/i); if (dot) idle.usdot = dot[1];
      for (const l of (r.rows || r.lines)) {
        const txt = l.text.trim(); const letters = (txt.match(/[A-Za-z]/g) || []).length;
        if (letters < 4 || (r.plate && txt.replace(/[^A-Z0-9]/gi, '').toUpperCase() === r.plate) || /NEW ?YORK|EMPIRE|JERSEY|STATE|USDOT|U\.S\.|DOT|\d{1,2}:\d{2}/i.test(txt)) continue;
        const key = txt.toUpperCase(); const s = l.h * l.conf; coCands[key] = (coCands[key] || 0) + s;
        if (s > bestCo.s) bestCo = { s, i };
      }
    } catch {}
  }
  const pl = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (pl) { idle.plate = pl[0]; idle.plateState = bestPlate.state || 'NY'; }
  const co = Object.entries(coCands).sort((a, b) => b[1] - a[1])[0];
  if (co) idle.company = co[0];
  idle.plateFrame = bestPlate.s >= 0 ? bestPlate.i : 0; idle.coFrame = bestCo.s >= 0 ? bestCo.i : Math.floor(n / 2);
  if (!idle.street && here.place && Date.now() - (file.lastModified || 0) < 30 * 60 * 1000) Object.assign(idle, { houseNumber: here.place.houseNumber || '', street: here.place.street, borough: here.place.borough, zip: here.place.zip, crossFrom: here.place.crossFrom, crossTo: here.place.crossTo, lat: here.lat, lon: here.lon });
  idle.busy = ''; renderIdling();
}
document.addEventListener('input', e => {
  const k = e.target.dataset?.i; if (!k || !idle) return;
  idle[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (k === 'plate') idle.plate = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (k === 'description') idle.descTouched = true;
});
document.addEventListener('change', e => {
  if (!idle) return;
  if (e.target.dataset?.frame) { idle[e.target.dataset.frame] = +e.target.value; return; }
  if (e.target.dataset?.i && e.target.dataset.i !== 'description') renderIdling();
});
document.addEventListener('click', async e => {
  const c = e.target.closest('[data-copy]'); if (c) { copyText(c.dataset.copy); return; }
  const a = e.target.closest('[data-act]'); if (!a || !idle) return;
  const act = a.dataset.act;
  if (act === 'idle-discard') { idle = null; renderIdling(); }
  if (act === 'still-plate' || act === 'still-co') {
    const i = act === 'still-plate' ? idle.plateFrame : idle.coFrame, fr = idle.frames[i]; if (!fr || !idle.video) return;
    a.disabled = true; await seek(idle.video, fr.t); const blob = await toBlob(canvasFrom(idle.video, 4096), 0.92); a.disabled = false;
    download(blob, `${act === 'still-plate' ? 'plate' : 'company'}-${idle.plate || 'vehicle'}.jpg`);
  }
  if (act === 'idle-save') {
    const { file, video: _v, frames, busy, pct, ...rest } = idle;
    store.save({ ...rest, violation: 'idling', status: 'logged', outcome: 'Waiting', observedAt: idle.dateFrom, thumb: frames?.[idle.plateFrame]?.url || '', ref: '' });
    toast('Saved to My reports'); idle = null; go('log');
  }
});

// ---------- my reports ----------
let openId = null;
function renderLog() {
  const el = $('#view-log'), list = store.all();
  el.innerHTML = `<div class="row" style="justify-content:space-between"><h2>My reports (${list.length})</h2><button class="btn small" type="button" id="csv"${list.length ? '' : ' disabled'}>Download CSV</button></div>
    ${list.length ? '' : '<div class="card"><p>Nothing yet. Each report you text or file is saved here, on this phone only, with its 311 number and what happened.</p></div>'}
    <div class="list">${list.map(r => {
      const v = r.kind === 'idling' ? 'Idling truck (DEP)' : (VMAP[r.violation]?.label || 'Report');
      const st = { texted: 'Texted 311', web: 'Filed on 311 website', logged: 'Saved only', draft: 'Draft' }[r.status] || r.status;
      const cls = /Ticketed|Summons|Upheld|Reward/.test(r.outcome) ? 'ok' : /Gone|no action|Rejected|Dismissed/.test(r.outcome) ? 'bad' : 'warn';
      return `<button class="item" type="button" data-open="${esc(r.id)}">${r.thumb ? `<img src="${r.thumb}" alt="">` : '<span class="ph"></span>'}<span><span class="t">${esc(v)}</span><br><span class="s">${esc([r.plate && `${r.plate} ${r.plateState}`, fmtWhen(r.observedAt)].filter(Boolean).join(' · '))}</span><br><span class="s">${esc(where(r))}</span><span class="chips" style="margin-top:4px"><span class="chip">${esc(st)}</span><span class="chip ${cls}">${esc(r.outcome || 'Waiting')}</span>${cityChip(r)}${r.ref ? `<span class="chip mono">${esc(r.ref)}</span>` : ''}</span></span></button>` + (openId === r.id ? editorHTML(r) : '');
    }).join('')}</div>`;
  $('#csv') && ($('#csv').onclick = () => download(new Blob([toCSV(list)], { type: 'text/csv' }), `tattletale-${new Date().toISOString().slice(0, 10)}.csv`));
  autoCheckCity();
}
function editorHTML(r) {
  const outs = r.kind === 'idling' ? IDLE_OUTCOMES : OUTCOMES;
  return `<div class="card">
    <div class="grid2"><label class="f" for="e-ref">${r.kind === 'idling' ? 'DEP complaint #' : '311 number'}<input id="e-ref" class="mono" value="${esc(r.ref || '')}"></label>
    <label class="f" for="e-out">What happened<select id="e-out">${outs.map(o => `<option${(r.outcome || 'Waiting') === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label></div>
    <label class="f" for="e-notes">Notes${r.kind === 'idling' ? ' (summons #, reward amount)' : ''}<input id="e-notes" value="${esc(r.notes || '')}"></label>
    ${r.kind !== 'idling' && (r.status === 'texted' || r.status === 'web') ? `<div class="track-nypd"><h3>Did NYPD really come?</h3>
      ${cityLines(r).length ? `<ul class="checks">${cityLines(r).map(([l, t]) => `<li class="${l}"><span class="i">${l === 'ok' ? '✓' : l === 'warn' ? '!' : '✕'}</span><span>${esc(t)}</span></li>`).join('')}</ul>` : `<p class="small muted">Sent ${esc(fmtClock(new Date(r.sentAt || r.createdAt)))}. The city publishes when 311 logged it and when NYPD closed it, overnight.</p>`}
      ${(r.rechecks || []).length ? `<div class="rechecks">${r.rechecks.map(k => `<figure><img src="${k.thumb}" alt="Re-check photo"><figcaption>${esc(fmtClock(new Date(k.at)))}${k.plate ? ` · ${esc(k.plate)}` : ''}</figcaption></figure>`).join('')}</div>` : ''}
      <div class="row"><button class="btn small" type="button" data-log="city" data-id="${esc(r.id)}">Check the city's record</button><button class="btn small" type="button" data-log="recheck" data-id="${esc(r.id)}">Still there? Take a photo</button></div>
      <p class="tip">If NYPD closes it as gone or fixed and the car is still there, a photo taken after the closing time is your proof.</p></div>` : ''}
    <div class="row"><button class="btn primary small" type="button" data-log="save" data-id="${esc(r.id)}">Save</button>${r.kind !== 'idling' ? `<button class="btn small" type="button" data-log="resend" data-id="${esc(r.id)}">Open again</button>` : ''}<a class="btn small" href="https://portal.311.nyc.gov/check-status/" target="_blank" rel="noopener">Check status on 311</a><button class="btn small" type="button" data-log="del" data-id="${esc(r.id)}">Delete</button></div>
  </div>`;
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) { openId = openId === o.dataset.open ? null : o.dataset.open; renderLog(); return; }
  const b = e.target.closest('[data-log]'); if (!b) return;
  const r = store.all().find(x => x.id === b.dataset.id); if (!r) return;
  if (b.dataset.log === 'save') { r.ref = $('#e-ref').value.trim(); r.outcome = $('#e-out').value; r.notes = $('#e-notes').value; store.save(r); openId = null; toast('Saved'); renderLog(); }
  if (b.dataset.log === 'resend') { draft = r; lastShot = null; go('result'); }
  if (b.dataset.log === 'city') { b.textContent = 'Checking…'; b.disabled = true; checkCity(r).then(ok => { if (!ok) toast("Couldn't reach NYC Open Data."); renderLog(); }); }
  if (b.dataset.log === 'recheck') recheck(r);
  if (b.dataset.log === 'del') { if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Tap again to delete'; return; } store.remove(r.id); openId = null; renderLog(); }
});
function toCSV(rs) {
  rs = rs.map(r => ({ ...r, city_key: r.city?.key, city_logged: r.city?.created, nypd_closed: r.city?.closed, minutes_to_close: r.city?.closed ? Math.round(minsBetween(r.city.created, r.city.closed)) : '', nypd_result: r.city?.result, precinct: r.city?.precinct,
    rechecks: (r.rechecks || []).map(k => `${k.at}${k.plate ? ' ' + k.plate : ''}`).join('; '),
    ...Object.fromEntries((r.aiLog || []).slice(0, 2).flatMap((x, i) => [[`ai${i + 1}_model`, x.model], [`ai${i + 1}_violation`, x.v], [`ai${i + 1}_p`, x.p], [`ai${i + 1}_plate`, x.plate], [`ai${i + 1}_ms`, x.ms]])) }));
  const cols = ['createdAt', 'sentAt', 'kind', 'violation', 'status', 'ref', 'outcome', 'observedAt', 'plate', 'plateState', 'houseNumber', 'street', 'borough', 'zip', 'crossFrom', 'crossTo', 'bikeLane', 'lat', 'lon', 'company', 'notes', 'city_key', 'city_logged', 'nypd_closed', 'minutes_to_close', 'nypd_result', 'precinct', 'rechecks', 'ai1_model', 'ai1_violation', 'ai1_p', 'ai1_plate', 'ai1_ms', 'ai2_model', 'ai2_violation', 'ai2_p', 'ai2_plate', 'ai2_ms'];
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rs.map(r => cols.map(c => q(r[c])).join(','))].join('\n');
}

// ---------- did NYPD really come? Each report is matched to the city's record of it ----------
// minutes from 311 logging a complaint to NYPD closing it, computed by NYC Open Data (same-month closings)
const MINS_SQL = '((date_extract_d(closed_date)-date_extract_d(created_date))*1440+(date_extract_hh(closed_date)-date_extract_hh(created_date))*60+(date_extract_mm(closed_date)-date_extract_mm(created_date)))';
const BAD_RESULTS = ['Gone when police came', 'Police said no action needed', 'Moved along, no ticket'];
const minsBetween = (a, b) => (fromLocalInput(b) - fromLocalInput(a)) / 60e3;
const fmtMins = m => { m = Math.max(0, Math.round(m)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return h < 10 && r ? `${h} h ${r} min` : `${Math.round(m / 60)} h`; };
const fmtClock = s => { const d = typeof s === 'string' ? fromLocalInput(s) : s; return d ? d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };
const ordinal = n => { n = +n; const t = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'); return n + t; };
const precinctName = p => { const n = String(p || '').match(/\d+/); return n ? `${ordinal(n[0])} Precinct` : ''; };
async function cityLookup(r) {
  const v = VMAP[r.violation]; if (!v || r.lat == null) return null;
  const sent = new Date(r.sentAt || r.createdAt);
  const where = `complaint_type='Illegal Parking' AND descriptor='${v.detail}' AND created_date between '${toLocalInput(new Date(+sent - 15 * 60e3))}' and '${toLocalInput(new Date(+sent + 6 * 3600e3))}' AND within_circle(location,${(+r.lat).toFixed(5)},${(+r.lon).toFixed(5)},300)`;
  const url = `${SODA}?$select=unique_key,created_date,closed_date,status,resolution_description,police_precinct&$where=${encodeURIComponent(where)}&$order=created_date&$limit=20`;
  const rows = await fetch(url).then(x => { if (!x.ok) throw new Error('city data'); return x.json(); });
  const digits = String(r.ref || '').replace(/\D/g, '');
  let best = (digits && rows.find(x => x.unique_key === digits)) || null;
  if (!best) { let bd = Infinity; for (const x of rows) { const d = Math.abs(fromLocalInput(x.created_date) - sent); if (d < bd) { bd = d; best = x; } } }
  if (!best) return null;
  return { key: best.unique_key, created: String(best.created_date).slice(0, 19), closed: best.closed_date ? String(best.closed_date).slice(0, 19) : '', result: best.closed_date ? bucket(best.resolution_description, best.status) : 'Still open', precinct: best.police_precinct || '' };
}
async function checkCity(r) {
  try { r.city = await cityLookup(r); r.cityCheckedAt = new Date().toISOString(); if (r.city?.closed && (!r.outcome || r.outcome === 'Waiting') && OUTCOMES.includes(r.city.result)) r.outcome = r.city.result; store.save(r); return true; }
  catch { return false; }
}
let cityBusy = false;
async function autoCheckCity() {
  if (cityBusy || !navigator.onLine) return; cityBusy = true;
  try {
    const now = Date.now(), age = r => now - new Date(r.sentAt || r.createdAt);
    const due = store.all().filter(r => (r.status === 'texted' || r.status === 'web') && r.kind !== 'idling' && r.lat != null && !r.city?.closed
      && age(r) > 3 * 3600e3 && age(r) < 60 * 864e5 && !(r.cityCheckedAt && now - new Date(r.cityCheckedAt) < 6 * 3600e3)).slice(0, 8);
    let changed = false;
    for (const r of due) changed = (await checkCity(r)) || changed;
    if (changed && currentView === 'log') renderLog();
  } finally { cityBusy = false; }
}
function cityLines(r) {
  const c = r.city, out = [];
  if (!c) {
    if (r.cityCheckedAt) out.push(['warn', Date.now() - new Date(r.sentAt || r.createdAt) < 36 * 3600e3 ? "Not in the city's data yet. It updates overnight, so check again tomorrow." : "No matching complaint in the city's data. If 311 texted you a number, check it on 311's site."]);
    return out;
  }
  const sent = r.sentAt ? new Date(r.sentAt) : null;
  const lag = sent ? (fromLocalInput(c.created) - sent) / 60e3 : null;
  out.push(['ok', `311 logged it ${fmtClock(c.created)}${lag != null && lag > 1 ? `, ${fmtMins(lag)} after you sent it` : ''}${c.precinct ? `, for the ${precinctName(c.precinct)}` : ''}.`]);
  if (!c.closed) { out.push(['warn', 'NYPD has not closed it yet.']); return out; }
  const m = minsBetween(c.created, c.closed);
  const when = `NYPD closed it ${fmtClock(c.closed)}, ${fmtMins(m)} after 311 logged it`;
  out.push(m < 5 ? ['bad', `${when}. No one could be sent, get there and check that fast.`]
    : m < 10 ? ['bad', `${when}. That's about as fast as police get to a 911 crime in progress.`]
    : m >= 180 ? ['warn', `${when}. After 3 hours the car is usually gone.`]
    : ['ok', `${when}.`]);
  out.push([/Ticketed|Towed|Arrest/.test(c.result) ? 'ok' : 'bad', `NYPD's result: ${c.result}.`]);
  const closedAt = fromLocalInput(c.closed);
  for (const k of r.rechecks || []) {
    const at = new Date(k.at); if (!(at > closedAt) || !BAD_RESULTS.includes(c.result)) continue;
    const far = k.lat != null && r.lat != null ? metersBetween(k, r) : 0;
    if (far > 150) continue;
    const same = k.plate && r.plate && k.plate === r.plate;
    out.push(['bad', `Your photo ${fmtClock(at)}, ${fmtMins((at - closedAt) / 60e3)} after NYPD closed it as "${c.result}", ${same ? `shows ${r.plate} still there` : 'shows the spot after the closing'}.`]);
  }
  return out;
}
function cityChip(r) {
  const c = r.city; if (!c) return '';
  if (!c.closed) return '<span class="chip warn">NYPD: open</span>';
  const m = minsBetween(c.created, c.closed), bad = m < 10 || BAD_RESULTS.includes(c.result);
  return `<span class="chip ${bad ? 'bad' : 'ok'}">NYPD closed in ${esc(fmtMins(m))}</span>`;
}
const inRecheck = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
inRecheck.setAttribute('capture', 'environment'); document.body.appendChild(inRecheck);
async function recheck(r) {
  const f = await new Promise(res => { inRecheck.onchange = () => { const x = inRecheck.files[0] || null; inRecheck.value = ''; res(x); }; inRecheck.click(); });
  if (!f) return;
  toast('Reading the photo…');
  const meta = await photoMeta(f).catch(() => ({}));
  const at = meta.when ? fromLocalInput(meta.when) : new Date();
  const pos = meta.lat != null ? { lat: meta.lat, lon: meta.lon } : await hereNow(6000);
  const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) { toast('Could not open that photo.'); return; }
  const c = canvasFrom(bmp, 1600);
  let plate = '';
  try { const res = await ocr.read(await createImageBitmap(c), { maxSide: 1600, zoom: true }); if (res.plate && res.score >= 3.4) plate = res.plate; } catch {}
  const k = { at: at.toISOString(), lat: pos?.lat ?? null, lon: pos?.lon ?? null, plate, thumb: canvasFrom(c, 240).toDataURL('image/jpeg', 0.6) };
  r.rechecks = [...(r.rechecks || []), k]; store.save(r); renderLog();
  toast(plate && plate === r.plate ? `Same plate, ${plate}, at ${fmtClock(at)}` : plate ? `Read ${plate} at ${fmtClock(at)}` : `Saved, ${fmtClock(at)}`);
}

// ---------- stats ----------
let statDetail = 'Blocked Bike Lane';
async function renderStats() {
  const el = $('#view-stats'), mine = store.all();
  const byV = {}; for (const r of mine) { const k = r.kind === 'idling' ? 'Idling (DEP)' : (VMAP[r.violation]?.label || 'Other'); byV[k] = (byV[k] || 0) + 1; }
  const mineSent = mine.filter(r => r.status === 'texted' || r.status === 'web').length;
  const details = [...new Set(VIOLATIONS.map(v => v.detail))];
  el.innerHTML = `<div class="card"><h2>What happens to these complaints</h2>
      <label class="f" for="s-detail">Complaint type<select id="s-detail">${details.map(d => `<option${d === statDetail ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></label>
      <div id="s-city"><p class="small muted">Loading NYC Open Data…</p></div>
      <div id="s-near"></div>
      <h3 style="margin-top:12px">How fast NYPD closes them</h3>
      <div id="s-time"><p class="small muted">Loading…</p></div>
      <div id="s-time-near"></div>
      <p class="tip">Source: NYC Open Data, 311 Service Requests, last 12 months, grouped by NYPD's closing note. Time to close runs from when 311 logged the complaint to when NYPD entered a result; the city doesn't publish when an officer was assigned.</p>
      <div class="row"><button class="btn small" type="button" id="s-copy">Copy these numbers</button></div>
    </div>
    <div class="card"><h3>Your reports</h3><div class="stat"><div class="tile"><b>${mine.length}</b><span>reports</span></div><div class="tile"><b>${mineSent}</b><span>sent to 311</span></div><div class="tile"><b>${mine.filter(r => /Ticketed|Summons|Upheld|Reward/.test(r.outcome)).length}</b><span>ticketed</span></div></div>
      ${bars(Object.entries(byV).sort((a, b) => b[1] - a[1]))}</div>`;
  $('#s-detail').onchange = e => { statDetail = e.target.value; renderStats(); };
  let summary = '';
  try {
    const s = await sodaStats(statDetail, null, null, 0);
    const t = s.buckets.find(b => b[0] === 'Ticketed')?.[1] || 0;
    summary = `Citywide in the last 12 months, NYC 311 got ${s.total.toLocaleString()} "${statDetail}" complaints. NYPD ticketed ${t.toLocaleString()} (${s.total ? Math.round(100 * t / s.total) : 0}%).`;
    $('#s-city').innerHTML = `<div class="stat"><div class="tile"><b>${s.total.toLocaleString()}</b><span>complaints, citywide</span></div><div class="tile"><b>${s.total ? Math.round(100 * t / s.total) : 0}%</b><span>ticketed</span></div><div class="tile"><b>${s.total ? Math.round(100 * ((s.buckets.find(b => b[0] === 'Gone when police came')?.[1]) || 0) / s.total) : 0}%</b><span>gone when police came</span></div></div>${bars(s.buckets, k => k === 'Ticketed' || k === 'Towed' || k === 'Arrest' ? '' : k === 'Still open' ? 'warn' : 'bad')}`;
  } catch { $('#s-city').innerHTML = '<p class="small">Could not reach NYC Open Data. Check your connection and try again.</p>'; }
  try {
    const t = await sodaTiming(statDetail, null, null, 0);
    summary += ` ${pct(t.f5, t.n)}% were closed in under 5 minutes and ${pct(t.s3, t.n)}% 3+ hours after they were logged.`;
    $('#s-time').innerHTML = timingHTML(t);
  } catch { $('#s-time').innerHTML = ''; }
  if (here.lat != null) {
    try {
      const t = await sodaTiming(statDetail, here.lat, here.lon, 400);
      if (t.n) $('#s-time-near').innerHTML = `<h3 style="margin-top:8px">Within about 400 m of you</h3>${timingHTML(t)}`;
    } catch {}
    try {
      const s = await sodaStats(statDetail, here.lat, here.lon, 400);
      const t = s.buckets.find(b => b[0] === 'Ticketed')?.[1] || 0;
      summary += ` Near ${placeLine(here.place) || 'me'}: ${s.total} complaints, ${t} ticketed.`;
      $('#s-near').innerHTML = `<h3 style="margin-top:8px">Within about 400 m of you</h3>${s.total ? bars(s.buckets, k => k === 'Ticketed' ? '' : 'bad') : '<p class="small">None in the last 12 months.</p>'}`;
    } catch {}
  }
  $('#s-copy').onclick = () => copyText(summary + ' (NYC Open Data, 311 Service Requests)');
}
function bars(rows, cls = () => '') {
  if (!rows.length) return '<p class="small muted">Nothing yet.</p>';
  const max = Math.max(...rows.map(r => r[1]));
  return `<div class="bars">${rows.map(([k, n]) => `<div class="bar"><span>${esc(k)}</span><span class="track"><span class="fill ${cls(k)}" style="width:${Math.max(3, 100 * n / max)}%"></span></span><b>${n.toLocaleString()}</b></div>`).join('')}</div>`;
}

// ---------- routing ----------
let currentView = 'report';
const VIEWS = ['report', 'result', 'idling', 'log', 'stats', 'about'];
function go(v) { if (location.hash !== '#' + v) location.hash = v; else route(); }
function route() {
  const h = (location.hash || '#report').slice(1); let v = VIEWS.includes(h) ? h : 'report';
  if (v === 'result' && !draft) v = 'report';
  currentView = v;
  for (const x of VIEWS) $('#view-' + x).hidden = x !== v;
  for (const x of ['report', 'idling', 'log', 'stats', 'about']) { const a = $('#nav-' + x); if (x === v || (v === 'result' && x === 'report')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  if (v === 'report') { if (settings.camOK && !cam.on) startCamera(); else if (cam.on) scanLoop(); }
  else if (v !== 'result') stopCamera();
  if (v === 'result') renderResult(); else $('#view-result').innerHTML = '';
  if (v === 'idling') renderIdling();
  if (v === 'log') renderLog();
  if (v === 'stats') renderStats();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && currentView === 'report') { if (settings.camOK && !cam.on) startCamera(); else scanLoop(); } if (document.visibilityState === 'hidden') stopCamera(); });

// ---------- start ----------
$('#vgrid').innerHTML = VIOLATIONS.slice(0, 7).map((v, i) => `<button class="vbtn${i === 0 ? ' main' : ''}" type="button" data-v="${v.key}">${esc(v.btn)}</button>`).join('');
$('#vgrid').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) onViolationTap(b.dataset.v); });
$('#btn-start').onclick = async () => { startLocation(); await startCamera(); };
$('#btn-pick').onclick = async () => { const f = await pickMedia('image'); if (f) fromGallery(f, 'picker'); };
async function takeShared() {
  try {
    const c = await caches.open('tt-share'); const r = await c.match('shared-media'); if (!r) return;
    await c.delete('shared-media');
    const blob = await r.blob();
    const f = new File([blob], decodeURIComponent(r.headers.get('x-name') || 'shared'), { type: blob.type || r.headers.get('content-type') || '', lastModified: Number(r.headers.get('x-modified')) || Date.now() });
    fromGallery(f, 'share');
  } catch {}
}
if (location.hash === '#shared') { history.replaceState(null, '', '#report'); takeShared(); }
$('#set-review').checked = !!settings.review;
bindAI();
$('#set-review').onchange = e => { settings.review = e.target.checked; saveSettings(); };
if (settings.camOK) startLocation();
if (navigator.permissions?.query) navigator.permissions.query({ name: 'geolocation' }).then(p => { if (p.state === 'granted') startLocation(); }).catch(() => {});
ocr.init();
updateChips();
route();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
