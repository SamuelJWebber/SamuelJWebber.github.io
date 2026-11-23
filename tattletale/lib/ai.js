/* AI models for TattleTale NYC: one interface, three places to run them.
   - jev:   TypeSafe's Jev 1.14 through OpenRouter's decisions API. Closed weights; typed answers with
            calibrated probabilities; can draw a box around the plate; cannot read text.
   - qwen:  Qwen3.5-9B through OpenRouter's chat API. Open weights (the same model runs on a laptop);
            reads the plate text itself; its confidence is its own estimate, not calibrated.
   - local: any Jev-compatible server on your own computer, e.g. llm2jev serving the open JPT-4B,
            reached through tools/tattletale_relay.py and a tunnel. No box question.
   - shared: TattleTale's own service (tools/worker), on by default, no key: the owner's computer for up to
            10 s, then a free open model on Cloudflare Workers AI, with daily limits.
   look(cfg, canvas) -> { model, tier, violation: { choice, p }, plateVisible, box, plate, plateState, ms, cost } */
const AI = (() => {
  const OR = 'https://openrouter.ai/api';
  // the shared service's address; empty until it's deployed (tools/worker/README)
  const SHARED = (typeof window !== 'undefined' && window.TT_SHARED_AI) || ''; // set in config.js
  const MODELS = { jev: 'typesafe/jev-1.14', qwen: 'qwen/qwen3.5-9b' };
  const LABEL = { jev: 'Jev', qwen: 'Qwen3.5-9B', local: 'Your computer', shared: "TattleTale's AI", wai: 'Workers AI' };
  const CRITERIA = {
    bike_lane: 'Parked or stopped in a bike lane', double_traffic: 'Double parked beside parked cars, blocking a travel lane', hydrant: 'Parked next to a fire hydrant',
    crosswalk: 'Parked or stopped in a crosswalk', sidewalk: 'Parked on the sidewalk', bus: 'Stopped in a bus stop or bus lane',
    double_vehicle: 'Double parked next to a parked car, boxing it in', none: 'Legally parked, or no violation is visible' };
  const SCENE = 'A phone photo taken on a New York City street to report the vehicle in the middle of the photo to 311.';
  const probOf = q => { const c = q?.choice; return c ? +(q.probabilities?.[c] ?? q.confidence ?? 0) : 0; };
  const normPlate = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), AI_norm = normPlate;
  // Jev wants 280 to 1568 px per side, JPEG or PNG, already rotated; the chat models are fine with the same
  function image(src) {
    const w0 = src.width, h0 = src.height; let k = Math.min(1, 1568 / Math.max(w0, h0)); if (Math.min(w0, h0) * k < 280) k = 280 / Math.min(w0, h0);
    const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }
  async function post(url, headers, body) {
    let r;
    try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); }
    catch { throw new Error(url.startsWith(OR) ? "couldn't reach OpenRouter" : SHARED && url.startsWith(SHARED) ? "couldn't reach TattleTale's AI" : "couldn't reach your server"); }
    if (!r.ok) {
      let m = ''; try { const e = (await r.json())?.error; m = typeof e === 'string' ? e : e?.message || ''; } catch {}
      throw new Error(SHARED && url.startsWith(SHARED) && m ? m : r.status === 401 ? 'the key or token was rejected' : r.status === 402 ? 'the key is out of credit' : r.status === 429 ? 'too many requests' : `error ${r.status}${m ? ': ' + m : ''}`);
    }
    return r.json();
  }
  async function decide(cfg, imageUrl, questions) {
    const t0 = performance.now();
    if (cfg.model === 'local') {
      const j = await post(String(cfg.localUrl || '').replace(/\/+$/, '') + '/v1/systemone', cfg.localToken ? { Authorization: 'Bearer ' + cfg.localToken } : {},
        { state: [{ role: 'user', content: [{ type: 'image', image: imageUrl }, { type: 'text', text: SCENE }] }], questions });
      return { A: j.answers || j, cost: 0, ms: Math.round(performance.now() - t0) };
    }
    const j = await post(OR + '/alpha/decisions', { Authorization: 'Bearer ' + cfg.key }, { model: MODELS.jev, state: [SCENE, { type: 'image_url', image_url: { url: imageUrl } }], questions });
    return { A: j.answers || j.results || j, cost: +(j.usage?.cost || 0), ms: Math.round(performance.now() - t0) };
  }
  // boxes come back as fractions (Jev), 0-1000 (Qwen's habit) or pixels; normalize to fractions
  function toBox(v, W, H) {
    if (!Array.isArray(v) || v.length !== 4 || v.some(x => typeof x !== 'number' || !isFinite(x))) return null;
    const m = Math.max(...v); let [l, t, r, b] = v;
    if (m > 1000) { l /= W; r /= W; t /= H; b /= H; } else if (m > 1.5) { l /= 1000; r /= 1000; t /= 1000; b /= 1000; }
    return r > l && b > t ? { left: l, top: t, right: r, bottom: b } : null;
  }
  function parseJSON(txt) { const m = String(txt || '').match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } }
  async function qwenLook(cfg, url, W, H) {
    const t0 = performance.now();
    const prompt = `${SCENE}\nAnswer with JSON only, no other text:\n{"violation": one of ${JSON.stringify(Object.keys(CRITERIA))},\n "confidence": your probability from 0 to 1 that the violation is right,\n "plate": the main vehicle's license plate characters exactly as printed, or "" if you cannot read every character,\n "plate_state": the plate's two-letter US state, or "",\n "plate_box": [left, top, right, bottom] of the plate as fractions of the image width and height, or null}\nViolations: ${Object.entries(CRITERIA).map(([k, v]) => `${k} = ${v}`).join('; ')}.`;
    const j = await post(OR + '/v1/chat/completions', { Authorization: 'Bearer ' + cfg.key }, {
      model: MODELS.qwen, temperature: 0, max_tokens: 300, response_format: { type: 'json_object' }, reasoning: { enabled: false },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url } }] }] });
    const o = parseJSON(j.choices?.[0]?.message?.content);
    const choice = Object.prototype.hasOwnProperty.call(CRITERIA, o.violation) ? o.violation : '';
    const plate = normPlate(o.plate);
    return { model: 'qwen', violation: { choice, p: Math.max(0, Math.min(1, +o.confidence || 0)) }, plateVisible: plate ? 1 : 0, box: toBox(o.plate_box, W, H),
      plate, plateState: /^[A-Z]{2}$/.test(String(o.plate_state || '').toUpperCase()) ? String(o.plate_state).toUpperCase() : '', cost: +(j.usage?.cost || 0), ms: Math.round(performance.now() - t0) };
  }
  async function viaShared(path, body) {
    const t0 = performance.now(), j = await post(SHARED.replace(/\/+$/, '') + path, {}, body);
    if (j.error) throw new Error(j.error);
    return { ...j, ms: j.ms ?? Math.round(performance.now() - t0), cost: +(j.cost || 0) };
  }
  async function look(cfg, canvas) {
    const url = image(canvas);
    if (cfg.model === 'shared') { const j = await viaShared('/v1/look', { image: url }); return { ...j, source: 'shared', plate: AI_norm(j.plate) }; }
    if (cfg.model === 'qwen') return qwenLook(cfg, url, canvas.width, canvas.height);
    const qs = { violation: { type: 'choice', instructions: 'What is the main vehicle doing?', criteria: CRITERIA },
      plate_visible: { type: 'noul', instructions: "Is the main vehicle's license plate visible and readable?", criteria: { true: 'Its characters can be read', false: 'No plate is visible, or it cannot be read' } } };
    if (cfg.model !== 'local') qs.plate_box = { type: 'box', instructions: 'the license plate of the main vehicle' };
    const { A, cost, ms } = await decide(cfg, url, qs);
    return { model: cfg.model || 'jev', violation: { choice: A.violation?.choice || '', p: probOf(A.violation) }, plateVisible: A.plate_visible?.noul, box: A.plate_box?.box || null, plate: '', plateState: '', cost, ms };
  }
  // which of these readings is the plate? (decision models only: they can't write text, but they can choose)
  async function pickPlate(cfg, canvas, cands) {
    if (cfg.model === 'shared') { const j = await viaShared('/v1/plate', { image: image(canvas), cands }); return { choice: j.choice || '', p: +(j.p || 0), read: normPlate(j.read), cost: j.cost, ms: j.ms, model: j.model, tier: j.tier, label: j.label || '' }; }
    const criteria = Object.fromEntries([...cands.map(p => [p, `The plate reads ${p.split('').join(' ')}`]), ['none', 'None of these, or the plate cannot be read']]);
    const { A, cost, ms } = await decide(cfg, image(canvas), { plate_text: { type: 'choice', instructions: "Which of these exactly matches the main vehicle's license plate?", criteria } });
    return { choice: A.plate_text?.choice || '', p: probOf(A.plate_text), cost, ms };
  }
  // the box a model drew around the plate, padded and enlarged for the phone's text reader
  function cropBox(canvas, b) {
    const W = canvas.width, H = canvas.height; if (!b || !(b.right > b.left) || !(b.bottom > b.top)) return null;
    const bw = (b.right - b.left) * W, bh = (b.bottom - b.top) * H; if (bw < 8 || bh < 4) return null;
    const x = Math.max(0, b.left * W - bw * 0.25), y = Math.max(0, b.top * H - bh * 0.4), w = Math.min(W - x, bw * 1.5), h = Math.min(H - y, bh * 1.8);
    const k = Math.max(1, Math.min(6, 160 / h)), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(canvas, x, y, w, h, 0, 0, c.width, c.height); return c;
  }
  async function ping(cfg) {
    if (cfg.model === 'shared') { // a tiny made-up photo through each of its tiers
      const t0 = performance.now(); let r;
      try { r = await fetch(SHARED.replace(/\/+$/, '') + '/v1/status?probe=1'); } catch { throw new Error("couldn't reach TattleTale's AI"); }
      if (!r.ok) throw new Error(r.status === 403 ? "this site isn't allowed to use TattleTale's AI" : `TattleTale's AI answered with status ${r.status}`);
      const s = await r.json();
      return { ms: Math.round(performance.now() - t0), cost: 0, ok: !!s.ok, note: `owner's computer ${s.computer}; free cloud model: ${s.cloud}; paid backup: ${s.backup}` };
    }
    if (cfg.model === 'qwen') {
      const t0 = performance.now();
      const j = await post(OR + '/v1/chat/completions', { Authorization: 'Bearer ' + cfg.key }, { model: MODELS.qwen, max_tokens: 5, reasoning: { enabled: false }, messages: [{ role: 'user', content: 'Reply with the word ok.' }] });
      return { ms: Math.round(performance.now() - t0), cost: +(j.usage?.cost || 0), note: String(j.choices?.[0]?.message?.content || '').trim().slice(0, 20) };
    }
    const t0 = performance.now();
    const q = { t: { type: 'noul', instructions: 'Is a hydrant mentioned?', criteria: { true: 'Yes', false: 'No' } } };
    const j = cfg.model === 'local'
      ? await post(String(cfg.localUrl || '').replace(/\/+$/, '') + '/v1/systemone', cfg.localToken ? { Authorization: 'Bearer ' + cfg.localToken } : {}, { state: 'A parked car is blocking a fire hydrant.', questions: q })
      : await post(OR + '/alpha/decisions', { Authorization: 'Bearer ' + cfg.key }, { model: MODELS.jev, state: ['A parked car is blocking a fire hydrant.'], questions: q });
    const A = j.answers || j;
    return { ms: Math.round(performance.now() - t0), cost: +(j.usage?.cost || 0), note: `yes = ${Math.round(100 * (A.t?.noul ?? 0))}%` };
  }
  return { MODELS, LABEL, CRITERIA, SHARED, look, pickPlate, cropBox, image, probOf, normPlate, ping };
})();
if (typeof module !== 'undefined') module.exports = AI;
