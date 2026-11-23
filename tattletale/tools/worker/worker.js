/* TattleTale NYC shared AI: a Cloudflare Worker, so nobody needs an AI key of their own.
   The phone always goes first: it reads the plate, place and time itself, and the app only calls this for
   what the phone couldn't settle (usually: which violation is it?). Then this tries, in order:
     1. your computer: a Jev-compatible server (llm2jev serving the open JPT-4B) behind
        tools/tattletale_relay.py, given LOCAL_TIMEOUT_MS (default 10 s). Free. After a miss it rests for
        COMPUTER_REST_MS (default 2 minutes) so a sleeping computer doesn't slow everyone down.
     2. Workers AI on your Cloudflare account: an open vision model (Gemma 4 by default). Free: on the
        Workers Free plan Cloudflare gives 10,000 neurons a day and simply stops when they run out.
     3. Optional backup, only if you add an OPENROUTER_KEY secret: Jev 1.14 (or Qwen3.5-9B) on your key.
   No keys are needed to deploy it: the Workers AI binding comes with the account.
   Guard rails: a daily cap on cloud answers per person (by scrambled IP) and for everyone, counted exactly
   in a Durable Object; a 3 MB photo cap; only the app's site may call it from a browser.

   Vars:     LOCAL_URL, ALLOWED_ORIGIN, WAI_MODEL, OPENROUTER_MODEL (jev|qwen), PER_IP_DAILY (30), ALL_DAILY (500),
             LOCAL_TIMEOUT_MS (10000), COMPUTER_REST_MS (120000)
   Secrets:  LOCAL_TOKEN (the relay's token), OPENROUTER_KEY (optional)
   Bindings: AI (Workers AI), LIMITS (the Durable Object class Limits below); wrangler.toml sets both up

   POST /v1/look   { image: "data:image/jpeg;base64,..." }  -> { tier, model, label, calibrated, violation:{choice,p}, plateVisible, box, plate, plateState, ms, cost, fallback? }
   POST /v1/plate  { image, cands: ["ABC1234", ...] }       -> { tier, model, label, choice, p, read?, ms, cost, fallback? }
   GET  /v1/status[?probe=1]                                -> what's set up; with probe, a tiny test photo through each tier
   tier is "computer" or "cloud"; fallback says why the computer didn't answer (off, resting, timeout, error).
   A reading model (Workers AI) only confirms a plate by reading the same characters on its own: p is then 0.9.
   Errors come back as { error } with status 400, 403, 404, 413, 429, 502 or 503. */
const OR_MODELS = { jev: 'typesafe/jev-1.14', qwen: 'qwen/qwen3.5-9b' };
const WAI_DEFAULT = '@cf/google/gemma-4-26b-a4b-it';
const WAI_LABELS = { '@cf/google/gemma-4-26b-a4b-it': 'Gemma 4', '@cf/meta/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout' };
const CRITERIA = {
  bike_lane: 'Parked or stopped in a bike lane', double_traffic: 'Double parked beside parked cars, blocking a travel lane', hydrant: 'Parked next to a fire hydrant',
  crosswalk: 'Parked or stopped in a crosswalk', sidewalk: 'Parked on the sidewalk', bus: 'Stopped in a bus stop or bus lane',
  double_vehicle: 'Double parked next to a parked car, boxing it in', none: 'Legally parked, or no violation is visible' };
const SCENE = 'A phone photo taken on a New York City street to report the vehicle in the middle of the photo to 311.';
const LOOK_PROMPT = `${SCENE}\nAnswer with JSON only, no other text:\n{"violation": one of ${JSON.stringify(Object.keys(CRITERIA))},\n "confidence": your probability from 0 to 1 that the violation is right,\n "plate": the main vehicle's license plate characters exactly as printed, or "" if you cannot read every character,\n "plate_state": the plate's two-letter US state, or "",\n "plate_box_2d": [ymin, xmin, ymax, xmax] of that plate on a 0 to 1000 grid, or null}\nViolations: ${Object.entries(CRITERIA).map(([k, v]) => `${k} = ${v}`).join('; ')}.`;
const READ_PROMPT = `${SCENE}\nRead the license plate of the main vehicle. Answer with JSON only, no other text:\n{"plate": the characters exactly as printed, letters and digits only, or "" if you cannot read every character, "plate_state": the two-letter US state, or ""}`;
const MAX_IMAGE = 3 * 1024 * 1024 * 4 / 3; // a 3 MB photo as base64
const probOf = q => { const c = q?.choice; return c ? +(q.probabilities?.[c] ?? q.confidence ?? 0) : 0; };
const normPlate = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const stateOf = s => { const t = String(s || '').toUpperCase(); return /^[A-Z]{2}$/.test(t) ? t : ''; };
const clamp01 = x => Math.max(0, Math.min(1, +x || 0));
const nyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); // caps reset at midnight in NYC

const origins = env => (env.ALLOWED_ORIGIN || 'https://samueljwebber.github.io').split(',').map(s => s.trim()).filter(Boolean);
const cors = (env, origin) => ({ 'Access-Control-Allow-Origin': origins(env).includes(origin) ? origin : origins(env)[0], 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' });
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const timeoutError = () => Object.assign(new Error('timeout'), { timeout: true });
const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(timeoutError()), ms); })]).finally(() => clearTimeout(t)); };

async function post(url, headers, body, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal });
    if (!r.ok) throw Object.assign(new Error(`status ${r.status}`), { status: r.status });
    return await r.json();
  } catch (e) { throw ac.signal.aborted ? timeoutError() : e; }
  finally { clearTimeout(t); }
}
function parseJSON(txt) { try { return JSON.parse(String(txt || '').match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch { return {}; } }
const lookQuestions = withBox => ({
  violation: { type: 'choice', instructions: 'What is the main vehicle doing?', criteria: CRITERIA },
  plate_visible: { type: 'noul', instructions: "Is the main vehicle's license plate visible and readable?", criteria: { true: 'Its characters can be read', false: 'No plate is visible, or it cannot be read' } },
  ...(withBox ? { plate_box: { type: 'box', instructions: 'the license plate of the main vehicle' } } : {}) });
const plateQuestion = cands => ({ plate_text: { type: 'choice', instructions: "Which of these exactly matches the main vehicle's license plate?",
  criteria: Object.fromEntries([...cands.map(p => [p, `The plate reads ${p.split('').join(' ')}`]), ['none', 'None of these, or the plate cannot be read']]) } });
// boxes: [left, top, right, bottom] as fractions or on a 0-1000 grid; Gemma's habit is [ymin, xmin, ymax, xmax] on 0-1000
function toBox(v) {
  if (!Array.isArray(v) || v.length !== 4 || v.some(x => typeof x !== 'number' || !isFinite(x))) return null;
  let [l, t, r, b] = v, m = Math.max(...v); if (m > 1000) return null; if (m > 1.5) { l /= 1000; t /= 1000; r /= 1000; b /= 1000; }
  return r > l && b > t ? { left: l, top: t, right: r, bottom: b } : null;
}
const fromBox2d = v => Array.isArray(v) && v.length === 4 ? toBox([v[1], v[0], v[3], v[2]]) : null;

// 1. your computer, resting for a while after it misses
async function viaComputer(env, image, questions) {
  const j = await post(env.LOCAL_URL.replace(/\/+$/, '') + '/v1/systemone', env.LOCAL_TOKEN ? { Authorization: 'Bearer ' + env.LOCAL_TOKEN } : {},
    { state: [{ role: 'user', content: [{ type: 'image', image }, { type: 'text', text: SCENE }] }], questions }, +(env.LOCAL_TIMEOUT_MS || 10000));
  return j.answers || j;
}
const why = e => e?.timeout ? 'timeout' : 'error';
const limits = env => env.LIMITS.get(env.LIMITS.idFromName('daily'));
async function computerResting(env) {
  try { return (await (await limits(env).fetch('https://limits/computer', { method: 'POST', body: '{}' })).json()).resting === true; } catch { return false; }
}
async function restComputer(env) {
  try { await limits(env).fetch('https://limits/computer', { method: 'POST', body: JSON.stringify({ op: 'down', ms: +(env.COMPUTER_REST_MS || 120000) }) }); } catch {}
}
// 2. Workers AI: free daily allowance, no key
const waiModel = env => env.WAI_MODEL || WAI_DEFAULT;
const waiLabel = env => WAI_LABELS[waiModel(env)] || waiModel(env).split('/').pop();
const waiKind = e => /3036|allocation|neurons/i.test(e?.message || '') ? 'allowance' : /5035|paid plan/i.test(e?.message || '') ? 'paid' : /5007|no such model/i.test(e?.message || '') ? 'model' : e?.timeout ? 'timeout' : 'error';
async function viaWorkersAI(env, image, prompt) {
  try {
    const out = await withTimeout(env.AI.run(waiModel(env), { messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }], max_tokens: 300, temperature: 0 }), 30000);
    const r = out?.response ?? out?.choices?.[0]?.message?.content ?? out?.result?.response ?? '';
    return typeof r === 'object' && r ? r : parseJSON(r);
  } catch (e) { throw Object.assign(e instanceof Error ? e : new Error(String(e)), { wai: waiKind(e) }); }
}
// 3. optional backup on your OpenRouter key
const OR = env => (env.OPENROUTER_BASE || 'https://openrouter.ai/api').replace(/\/+$/, '');
async function viaJev(env, image, questions) {
  const j = await post(OR(env) + '/alpha/decisions', { Authorization: 'Bearer ' + env.OPENROUTER_KEY }, { model: OR_MODELS.jev, state: [SCENE, { type: 'image_url', image_url: { url: image } }], questions }, 30000);
  return { A: j.answers || j.results || j, cost: +(j.usage?.cost || 0) };
}
async function viaQwen(env, image) {
  const j = await post(OR(env) + '/v1/chat/completions', { Authorization: 'Bearer ' + env.OPENROUTER_KEY }, { model: OR_MODELS.qwen, temperature: 0, max_tokens: 300, response_format: { type: 'json_object' }, reasoning: { enabled: false },
    messages: [{ role: 'user', content: [{ type: 'text', text: LOOK_PROMPT }, { type: 'image_url', image_url: { url: image } }] }] }, 30000);
  return { o: parseJSON(j.choices?.[0]?.message?.content), cost: +(j.usage?.cost || 0) };
}

// daily caps on cloud answers, counted in one Durable Object so two requests can't both take the last one
async function allowCloud(env, ip) {
  try {
    const day = nyDay(), hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${ip}`));
    const who = [...new Uint8Array(hash)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); // no IP addresses are stored
    const r = await limits(env).fetch('https://limits/take', { method: 'POST', body: JSON.stringify({ day, who, perWho: +(env.PER_IP_DAILY || 30), all: +(env.ALL_DAILY || 500) }) });
    return (await r.json()).ok === true;
  } catch { return false; } // can't count, so don't spend
}
export class Limits {
  constructor(ctx) { this.storage = ctx.storage; }
  async fetch(request) {
    const path = new URL(request.url).pathname, body = await request.json().catch(() => ({}));
    if (path === '/computer') {
      if (body.op === 'down') await this.storage.put('pcRestUntil', Date.now() + (+body.ms || 120000));
      return Response.json({ resting: ((await this.storage.get('pcRestUntil')) || 0) > Date.now() });
    }
    const { day, who, perWho, all } = body;
    if ((await this.storage.get('day')) !== day) {
      const rest = await this.storage.get('pcRestUntil');
      await this.storage.deleteAll(); await this.storage.put('day', day); if (rest) await this.storage.put('pcRestUntil', rest);
    }
    const mine = (await this.storage.get('w:' + who)) || 0, total = (await this.storage.get('all')) || 0;
    if (mine >= perWho || total >= all) return Response.json({ ok: false, mine, total });
    await this.storage.put({ ['w:' + who]: mine + 1, all: total + 1 });
    return Response.json({ ok: true, mine: mine + 1, total: total + 1 });
  }
}

// try the computer (unless it's resting); returns its answers, or why it didn't answer
async function askComputer(env, image, questions, ok) {
  if (!env.LOCAL_URL) return { fallback: 'off' };
  if (await computerResting(env)) return { fallback: 'resting' };
  try { const A = await viaComputer(env, image, questions); if (ok(A)) return { A }; } catch (e) { await restComputer(env); return { fallback: why(e) }; }
  await restComputer(env); return { fallback: 'error' };
}
async function look(env, image, ip) {
  const t0 = Date.now(), pc = await askComputer(env, image, lookQuestions(false), A => !!A.violation?.choice);
  if (pc.A) return { tier: 'computer', model: 'local', label: "owner's computer", calibrated: true, violation: { choice: pc.A.violation.choice, p: probOf(pc.A.violation) }, plateVisible: pc.A.plate_visible?.noul ?? null, box: null, plate: '', plateState: '', ms: Date.now() - t0, cost: 0 };
  const fallback = pc.fallback;
  if (!(await allowCloud(env, ip))) return { error: 'daily limit reached', status: 429 };
  let first;
  if (env.AI) {
    try {
      const o = await viaWorkersAI(env, image, LOOK_PROMPT), plate = normPlate(o.plate);
      if (Object.prototype.hasOwnProperty.call(CRITERIA, o.violation))
        return { tier: 'cloud', model: 'wai', label: waiLabel(env), calibrated: false, violation: { choice: o.violation, p: clamp01(o.confidence) }, plateVisible: plate ? 1 : 0,
          box: fromBox2d(o.plate_box_2d), plate, plateState: stateOf(o.plate_state), ms: Date.now() - t0, cost: 0, fallback };
      first = Object.assign(new Error('unexpected answer'), { wai: 'format' });
    } catch (e) { first = e; }
  }
  if (!env.OPENROUTER_KEY) throw first || new Error('no cloud model set up');
  if ((env.OPENROUTER_MODEL || 'jev') === 'qwen') {
    const { o, cost } = await viaQwen(env, image), plate = normPlate(o.plate);
    return { tier: 'cloud', model: 'qwen', label: 'Qwen3.5-9B', calibrated: false, violation: { choice: Object.prototype.hasOwnProperty.call(CRITERIA, o.violation) ? o.violation : '', p: clamp01(o.confidence) },
      plateVisible: plate ? 1 : 0, box: fromBox2d(o.plate_box_2d), plate, plateState: stateOf(o.plate_state), ms: Date.now() - t0, cost, fallback };
  }
  const { A, cost } = await viaJev(env, image, lookQuestions(true));
  return { tier: 'cloud', model: 'jev', label: 'Jev', calibrated: true, violation: { choice: A.violation?.choice || '', p: probOf(A.violation) }, plateVisible: A.plate_visible?.noul ?? null, box: A.plate_box?.box || null, plate: '', plateState: '', ms: Date.now() - t0, cost, fallback };
}
async function plate(env, image, cands, ip) {
  const t0 = Date.now(), pc = await askComputer(env, image, plateQuestion(cands), A => !!A.plate_text?.choice);
  if (pc.A) return { tier: 'computer', model: 'local', label: "owner's computer", choice: pc.A.plate_text.choice, p: probOf(pc.A.plate_text), ms: Date.now() - t0, cost: 0 };
  const fallback = pc.fallback;
  if (!(await allowCloud(env, ip))) return { error: 'daily limit reached', status: 429 };
  let first;
  if (env.AI) {
    try { // a reading model reads on its own; agreeing with one of the phone's readings is the confirmation
      const o = await viaWorkersAI(env, image, READ_PROMPT), read = normPlate(o.plate), hit = cands.includes(read);
      return { tier: 'cloud', model: 'wai', label: waiLabel(env), choice: hit ? read : 'none', p: hit ? 0.9 : 0, read, readState: stateOf(o.plate_state), ms: Date.now() - t0, cost: 0, fallback };
    } catch (e) { first = e; }
  }
  if (!env.OPENROUTER_KEY) throw first || new Error('no cloud model set up');
  const { A, cost } = await viaJev(env, image, plateQuestion(cands));
  return { tier: 'cloud', model: 'jev', label: 'Jev', choice: A.plate_text?.choice || '', p: probOf(A.plate_text), ms: Date.now() - t0, cost, fallback };
}
// what's set up, and with ?probe=1, whether each tier answers a tiny test photo
async function status(env, ip, probe) {
  const s = { computer: env.LOCAL_URL ? 'set up' : 'not set up', cloud: env.AI ? `${waiLabel(env)} on Workers AI` : 'not set up', backup: env.OPENROUTER_KEY ? `${(env.OPENROUTER_MODEL || 'jev') === 'qwen' ? 'Qwen3.5-9B' : 'Jev'} on OpenRouter` : 'not set up',
    caps: { perPerson: +(env.PER_IP_DAILY || 30), everyone: +(env.ALL_DAILY || 500) }, ok: true };
  if (!probe) return s;
  if (env.LOCAL_URL) {
    const t0 = Date.now();
    try { const A = await viaComputer(env, PROBE, lookQuestions(false)); s.computer = A.violation?.choice ? `answered in ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'answered in an unexpected format'; }
    catch (e) { s.computer = e.timeout ? `no answer in ${+(env.LOCAL_TIMEOUT_MS || 10000) / 1000} s` : `didn't work (${e.message})`; }
  }
  if (env.AI) {
    if (!(await allowCloud(env, ip))) s.cloud += ': daily cap reached';
    else {
      const t0 = Date.now();
      try { const o = await viaWorkersAI(env, PROBE, LOOK_PROMPT); s.cloud += o.violation ? ` answered in ${((Date.now() - t0) / 1000).toFixed(1)} s` : ': answered in an unexpected format'; if (!o.violation) s.ok = false; }
      catch (e) { s.cloud += `: ${{ allowance: "today's free allowance is used up", paid: 'this model needs the Workers Paid plan', model: 'no such model (check WAI_MODEL)', timeout: 'no answer in 30 s' }[e.wai] || e.message}`; s.ok = false; }
    }
  }
  if (!env.AI && !env.OPENROUTER_KEY) s.ok = false;
  return s;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin'), h = cors(env, origin || '');
    if (origin && !origins(env).includes(origin)) return json({ error: 'not allowed from this site' }, 403, h);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(request.url), path = url.pathname, ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (request.method === 'GET' && path === '/v1/status') return json(await status(env, ip, url.searchParams.get('probe') === '1'), 200, h);
    if (request.method !== 'POST' || !['/v1/look', '/v1/plate'].includes(path)) return json({ error: 'not found' }, 404, h);
    if (+(request.headers.get('Content-Length') || 0) > MAX_IMAGE + 4096) return json({ error: 'photo too large' }, 413, h);
    let body; try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400, h); }
    const image = String(body?.image || '');
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]{100,}$/.test(image.slice(0, 200)) || image.length > MAX_IMAGE) return json({ error: 'send a JPEG or PNG data URL under 3 MB' }, 400, h);
    try {
      let r;
      if (path === '/v1/look') r = await look(env, image, ip);
      else {
        const cands = [...new Set((Array.isArray(body.cands) ? body.cands : []).map(normPlate))].filter(p => p.length >= 2 && p.length <= 8 && p !== 'NONE').slice(0, 5);
        if (!cands.length) return json({ error: 'no plate readings to choose from' }, 400, h);
        r = await plate(env, image, cands, ip);
      }
      if (r.error) { const { status: code, ...rest } = r; return json(rest, code, h); }
      return json(r, 200, h);
    } catch (e) {
      if (e.wai === 'allowance') return json({ error: 'daily limit reached' }, 429, h); // Workers AI's free neurons are used up for today
      if (e.wai === 'paid') return json({ error: 'the cloud model needs a paid plan' }, 503, h);
      if (e.status === 402) return json({ error: 'out of credit for today' }, 503, h);
      if (e.status === 401 || e.status === 403) return json({ error: 'the service key was rejected' }, 503, h);
      return json({ error: e.timeout ? 'the AI took too long' : 'the AI service failed' }, 502, h);
    }
  },
};

// a tiny made-up photo for /v1/status?probe=1
const PROBE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCADwAUADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDVoooqiQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoorE8U3pttNECNte4baeudo68/kPoTVwi5SSRLdlco634kcyG20+TaoyHmX+L2X29/y9+dklkmkMksjSOerMck/jTaK9SEIwVkcspOW4UVd/sTVv8AoF3n/gO/+FH9iat/0C7z/wAB3/wqrokpUVd/sTVv+gXef+A7/wCFH9iat/0C7z/wHf8AwougKVFXf7E1b/oF3n/gO/8AhR/Ymrf9Au8/8B3/AMKLoClRV3+xNW/6Bd5/4Dv/AIUf2Jq3/QLvP/Ad/wDCi6ApUVd/sTVv+gXef+A7/wCFH9iat/0C7z/wHf8AwougKVFXf7E1b/oF3n/gO/8AhR/Ymrf9Au8/8B3/AMKLoClRV3+xNW/6Bd5/4Dv/AIUf2Jq3/QLvP/Ad/wDCi6ApUVd/sTVv+gXef+A7/wCFH9iat/0C7z/wHf8AwougKVFXf7E1b/oF3n/gO/8AhR/Ymrf9Au8/8B3/AMKLoClRV3+xNW/6Bd5/4Dv/AIUf2Jq3/QLvP/Ad/wDCi6ApqzI4dGKspyCDgg1uaR4kntpRFfSNLAeN7csnvnqR/kelYjo8UjRyKyOhIZWGCCOoIptTKEZqzGm1semKyugdGDKwyCDkEUtc34RvS0c1k7Z2fPGOenf2xnH5mukrzKkOSXKdcXzK4UUUVmUFFFFABRRRQAUUUUAFFFFABRRRQAVzHjL/AJc/+B/+y109cx4y/wCXP/gf/stb0P4iM6nws5miiivTOU9sooorzygooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigDyDW/+Q7qH/X1J/wChGqVXdb/5Duof9fUn/oRqlXetiTd8I/8AIVl/64H/ANCWuwrj/CP/ACFZf+uB/wDQlrsK87E/xDppfCFFFFc5qFFFFABRRRQAUUUUAFFFFABRRRQAVzHjL/lz/wCB/wDstdPXMeMv+XP/AIH/AOy1vQ/iIzqfCzmaKKK9M5T2yiiivPKCiiigAooooAKKKKACiiigAooooAKK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LqEkbwafBKjMrLgliBuQAkdBnrjsKq/8Lkm/6F1P/A8//G6P+FyTf9C6n/gef/jdHsKnYPaR7nI+PdKutN8eXPn3E06SW8TxyyiMM67dvIRQBgqR0HT88StnxV4jfxTrKai9ktpst1hEYm8zOGds52j+9+lY1ejQi400mc1R3loFFFFbmYUUUUAFFFFAG74R/wCQrL/1wP8A6EtdhXnmn3c9lO0lvJscrtJwDxkev0rR/t7U/wDn5/8AIa/4V5uJ/iHVSXunZUVxv9van/z8/wDkNf8ACj+3tT/5+f8AyGv+Fc5pY7KiuN/t7U/+fn/yGv8AhR/b2p/8/P8A5DX/AAoCx2VFcb/b2p/8/P8A5DX/AAo/t7U/+fn/AMhr/hQFjOooooKCiiigAooooAKZKu5eOop9FOMnFpoTV1Yq0VNJFuOV61GUYH7pr1IVYzV7nHKDixtFLsb+6fyo2N/dP5VfNHuTZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KjY390/lRzR7hZiUUuxv7p/KpEi5y35VM6sIq7ZUYSbFhXAJPepKKK8uc3OTkzrjHlVgoooqSgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q==';
