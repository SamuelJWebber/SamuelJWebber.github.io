/* TattleTale NYC shared AI: a Cloudflare Worker for people who don't have an AI key of their own.
   The phone always goes first: it reads the plate, place and time itself, and the app only calls this for
   what the phone couldn't settle (usually: which violation is it?). Then this tries, in order:
     1. your computer: a Jev-compatible server (llm2jev serving the open JPT-4B) behind
        tools/tattletale_relay.py, given LOCAL_TIMEOUT_MS (default 10 s) to answer. Free.
     2. the cloud: Jev 1.14 (or Qwen3.5-9B) through OpenRouter, paid with your key.
   Your OpenRouter key and your computer's token are Worker secrets: never in the app or in this repo.
   Guard rails: a daily cap on cloud answers per person (by scrambled IP) and for everyone, counted exactly
   in a Durable Object; a 3 MB photo cap; only the app's site may call it from a browser. Also give the
   OpenRouter key a monthly spending limit: that is the hard ceiling.

   Secrets:  OPENROUTER_KEY, LOCAL_TOKEN                   (npx wrangler secret put NAME)
   Vars:     LOCAL_URL, ALLOWED_ORIGIN, CLOUD_MODEL (jev|qwen), PER_IP_DAILY (30), ALL_DAILY (500), LOCAL_TIMEOUT_MS (10000)
   Binding:  LIMITS, the Durable Object class Limits below (wrangler.toml sets it up)

   POST /v1/look   { image: "data:image/jpeg;base64,..." }  -> { tier, model, violation:{choice,p}, plateVisible, box, plate, plateState, ms, cost, fallback? }
   POST /v1/plate  { image, cands: ["ABC1234", ...] }       -> { tier, model, choice, p, ms, cost, fallback? }
   tier is "computer" or "cloud"; fallback says why the computer didn't answer (off, timeout, error).
   Errors come back as { error } with status 400, 403, 404, 413, 429, 502 or 503. */
const MODELS = { jev: 'typesafe/jev-1.14', qwen: 'qwen/qwen3.5-9b' };
const CRITERIA = {
  bike_lane: 'Parked or stopped in a bike lane', double_traffic: 'Double parked beside parked cars, blocking a travel lane', hydrant: 'Parked next to a fire hydrant',
  crosswalk: 'Parked or stopped in a crosswalk', sidewalk: 'Parked on the sidewalk', bus: 'Stopped in a bus stop or bus lane',
  double_vehicle: 'Double parked next to a parked car, boxing it in', none: 'Legally parked, or no violation is visible' };
const SCENE = 'A phone photo taken on a New York City street to report the vehicle in the middle of the photo to 311.';
const MAX_IMAGE = 3 * 1024 * 1024 * 4 / 3; // a 3 MB photo as base64
const probOf = q => { const c = q?.choice; return c ? +(q.probabilities?.[c] ?? q.confidence ?? 0) : 0; };
const normPlate = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const nyDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); // limits reset at midnight in NYC

const origins = env => (env.ALLOWED_ORIGIN || 'https://samueljwebber.github.io').split(',').map(s => s.trim()).filter(Boolean);
const cors = (env, origin) => ({ 'Access-Control-Allow-Origin': origins(env).includes(origin) ? origin : origins(env)[0], 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' });
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function post(url, headers, body, ms) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal });
    if (!r.ok) throw Object.assign(new Error(`status ${r.status}`), { status: r.status });
    return await r.json();
  } catch (e) { throw ac.signal.aborted ? Object.assign(new Error('timeout'), { timeout: true }) : e; }
  finally { clearTimeout(t); }
}
const lookQuestions = withBox => ({
  violation: { type: 'choice', instructions: 'What is the main vehicle doing?', criteria: CRITERIA },
  plate_visible: { type: 'noul', instructions: "Is the main vehicle's license plate visible and readable?", criteria: { true: 'Its characters can be read', false: 'No plate is visible, or it cannot be read' } },
  ...(withBox ? { plate_box: { type: 'box', instructions: 'the license plate of the main vehicle' } } : {}) });
const plateQuestion = cands => ({ plate_text: { type: 'choice', instructions: "Which of these exactly matches the main vehicle's license plate?",
  criteria: Object.fromEntries([...cands.map(p => [p, `The plate reads ${p.split('').join(' ')}`]), ['none', 'None of these, or the plate cannot be read']]) } });
// boxes come back as fractions or on a 0-1000 grid; anything else is dropped
function toBox(v) {
  if (!Array.isArray(v) || v.length !== 4 || v.some(x => typeof x !== 'number' || !isFinite(x))) return null;
  let [l, t, r, b] = v, m = Math.max(...v); if (m > 1000) return null; if (m > 1.5) { l /= 1000; t /= 1000; r /= 1000; b /= 1000; }
  return r > l && b > t ? { left: l, top: t, right: r, bottom: b } : null;
}

// 1. your computer
async function viaComputer(env, image, questions) {
  if (!env.LOCAL_URL) throw Object.assign(new Error('off'), { off: true });
  const j = await post(env.LOCAL_URL.replace(/\/+$/, '') + '/v1/systemone', env.LOCAL_TOKEN ? { Authorization: 'Bearer ' + env.LOCAL_TOKEN } : {},
    { state: [{ role: 'user', content: [{ type: 'image', image }, { type: 'text', text: SCENE }] }], questions }, +(env.LOCAL_TIMEOUT_MS || 10000));
  return j.answers || j;
}
const why = e => e?.off ? 'off' : e?.timeout ? 'timeout' : 'error';
// 2. the cloud, on your key
const OR = env => (env.OPENROUTER_BASE || 'https://openrouter.ai/api').replace(/\/+$/, '');
async function viaJev(env, image, questions) {
  const j = await post(OR(env) + '/alpha/decisions', { Authorization: 'Bearer ' + env.OPENROUTER_KEY }, { model: MODELS.jev, state: [SCENE, { type: 'image_url', image_url: { url: image } }], questions }, 30000);
  return { A: j.answers || j.results || j, cost: +(j.usage?.cost || 0) };
}
async function viaQwen(env, image) {
  const prompt = `${SCENE}\nAnswer with JSON only, no other text:\n{"violation": one of ${JSON.stringify(Object.keys(CRITERIA))},\n "confidence": your probability from 0 to 1 that the violation is right,\n "plate": the main vehicle's license plate characters exactly as printed, or "" if you cannot read every character,\n "plate_state": the plate's two-letter US state, or "",\n "plate_box": [left, top, right, bottom] of the plate as fractions of the image width and height, or null}\nViolations: ${Object.entries(CRITERIA).map(([k, v]) => `${k} = ${v}`).join('; ')}.`;
  const j = await post(OR(env) + '/v1/chat/completions', { Authorization: 'Bearer ' + env.OPENROUTER_KEY }, { model: MODELS.qwen, temperature: 0, max_tokens: 300, response_format: { type: 'json_object' }, reasoning: { enabled: false },
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }] }, 30000);
  let o = {}; try { o = JSON.parse(String(j.choices?.[0]?.message?.content || '').match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch {}
  return { o, cost: +(j.usage?.cost || 0) };
}

// daily caps on cloud answers, counted in one Durable Object so two requests can't both take the last one
async function allowCloud(env, ip) {
  try {
    const day = nyDay(), hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}|${ip}`));
    const who = [...new Uint8Array(hash)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); // no IP addresses are stored
    const r = await env.LIMITS.get(env.LIMITS.idFromName('daily')).fetch('https://limits/take', { method: 'POST', body: JSON.stringify({ day, who, perWho: +(env.PER_IP_DAILY || 30), all: +(env.ALL_DAILY || 500) }) });
    return (await r.json()).ok === true;
  } catch { return false; } // can't count, so don't spend
}
export class Limits {
  constructor(ctx) { this.storage = ctx.storage; }
  async fetch(request) {
    const { day, who, perWho, all } = await request.json();
    if ((await this.storage.get('day')) !== day) { await this.storage.deleteAll(); await this.storage.put('day', day); }
    const mine = (await this.storage.get('w:' + who)) || 0, total = (await this.storage.get('all')) || 0;
    if (mine >= perWho || total >= all) return Response.json({ ok: false, mine, total });
    await this.storage.put({ ['w:' + who]: mine + 1, all: total + 1 });
    return Response.json({ ok: true, mine: mine + 1, total: total + 1 });
  }
}

async function look(env, image, ip) {
  const t0 = Date.now(); let fallback;
  try {
    const A = await viaComputer(env, image, lookQuestions(false));
    if (A.violation?.choice) return { tier: 'computer', model: 'local', violation: { choice: A.violation.choice, p: probOf(A.violation) }, plateVisible: A.plate_visible?.noul ?? null, box: null, plate: '', plateState: '', ms: Date.now() - t0, cost: 0 };
    fallback = 'error';
  } catch (e) { fallback = why(e); }
  if (!(await allowCloud(env, ip))) return { error: 'daily limit reached', status: 429 };
  if ((env.CLOUD_MODEL || 'jev') === 'qwen') {
    const { o, cost } = await viaQwen(env, image), plate = normPlate(o.plate), st = String(o.plate_state || '').toUpperCase();
    return { tier: 'cloud', model: 'qwen', violation: { choice: Object.prototype.hasOwnProperty.call(CRITERIA, o.violation) ? o.violation : '', p: Math.max(0, Math.min(1, +o.confidence || 0)) },
      plateVisible: plate ? 1 : 0, box: toBox(o.plate_box), plate, plateState: /^[A-Z]{2}$/.test(st) ? st : '', ms: Date.now() - t0, cost, fallback };
  }
  const { A, cost } = await viaJev(env, image, lookQuestions(true));
  return { tier: 'cloud', model: 'jev', violation: { choice: A.violation?.choice || '', p: probOf(A.violation) }, plateVisible: A.plate_visible?.noul ?? null, box: A.plate_box?.box || null, plate: '', plateState: '', ms: Date.now() - t0, cost, fallback };
}
async function plate(env, image, cands, ip) {
  const t0 = Date.now(), qs = plateQuestion(cands); let fallback;
  try {
    const A = await viaComputer(env, image, qs);
    if (A.plate_text?.choice) return { tier: 'computer', model: 'local', choice: A.plate_text.choice, p: probOf(A.plate_text), ms: Date.now() - t0, cost: 0 };
    fallback = 'error';
  } catch (e) { fallback = why(e); }
  if (!(await allowCloud(env, ip))) return { error: 'daily limit reached', status: 429 };
  const { A, cost } = await viaJev(env, image, qs);
  return { tier: 'cloud', model: 'jev', choice: A.plate_text?.choice || '', p: probOf(A.plate_text), ms: Date.now() - t0, cost, fallback };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin'), h = cors(env, origin || '');
    if (origin && !origins(env).includes(origin)) return json({ error: 'not allowed from this site' }, 403, h);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const path = new URL(request.url).pathname;
    if (request.method !== 'POST' || !['/v1/look', '/v1/plate'].includes(path)) return json({ error: 'not found' }, 404, h);
    if (+(request.headers.get('Content-Length') || 0) > MAX_IMAGE + 4096) return json({ error: 'photo too large' }, 413, h);
    let body; try { body = await request.json(); } catch { return json({ error: 'bad request' }, 400, h); }
    const image = String(body?.image || '');
    if (!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]{100,}$/.test(image.slice(0, 200)) || image.length > MAX_IMAGE) return json({ error: 'send a JPEG or PNG data URL under 3 MB' }, 400, h);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      let r;
      if (path === '/v1/look') r = await look(env, image, ip);
      else {
        const cands = [...new Set((Array.isArray(body.cands) ? body.cands : []).map(normPlate))].filter(p => p.length >= 2 && p.length <= 8 && p !== 'NONE').slice(0, 5);
        if (!cands.length) return json({ error: 'no plate readings to choose from' }, 400, h);
        r = await plate(env, image, cands, ip);
      }
      if (r.error) { const { status, ...rest } = r; return json(rest, status, h); }
      return json(r, 200, h);
    } catch (e) {
      // the cloud said no: out of credit or over the key's spending limit, or a bad key
      if (e.status === 402) return json({ error: 'out of credit for today' }, 503, h);
      if (e.status === 401 || e.status === 403) return json({ error: 'the service key was rejected' }, 503, h);
      return json({ error: e.timeout ? 'the AI took too long' : 'the AI service failed' }, 502, h);
    }
  },
};
