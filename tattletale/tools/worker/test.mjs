// Runs the Worker in Cloudflare's own runtime (workerd, via Miniflare) against a fake computer, a fake
// Workers AI and a fake OpenRouter.     npm install && node test.mjs     (about 20 s; one case waits the real 10 s)
import { Miniflare } from 'miniflare';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
const WORKER = process.argv[2] || fileURLToPath(new URL('./worker.js', import.meta.url));
let computer = 'fast', ai = 'ok', or = 'ok'; const seen = []; let aiInputs = [];
const read = req => new Promise(res => { let b = ''; req.on('data', c => b += c); req.on('end', () => res(b)); });
const send = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const listen = handler => new Promise(res => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => res(s)); });
const pc = await listen(async (req, res) => {
  const body = JSON.parse(await read(req)); seen.push('computer');
  if (req.headers.authorization !== 'Bearer tok') return send(res, 401, {});
  if (computer === 'slow') return setTimeout(() => { try { send(res, 200, {}); } catch {} }, 12000);
  if (computer === 'broken') return send(res, 500, {});
  const q = body.questions, first = q.plate_text && Object.keys(q.plate_text.criteria)[0];
  send(res, 200, { answers: q.plate_text ? { plate_text: { choice: first, probabilities: { [first]: 0.91 } } } : { violation: { choice: 'hydrant', probabilities: { hydrant: 0.88 } }, plate_visible: { noul: 0.9 } } });
});
const ctl = await listen(async (req, res) => { // fake Workers AI (through the wrapped binding below) and fake OpenRouter
  const body = JSON.parse(await read(req));
  if (req.url === '/ai') {
    seen.push('workers-ai'); aiInputs.push(body);
    const prompt = body.input.messages[0].content.find(c => c.type === 'text').text, reading = /Read the license plate/.test(prompt);
    if (ai === 'allowance') return send(res, 200, { throw: '3036: You have used up your daily free allocation of 10,000 neurons.' });
    if (ai === 'paid') return send(res, 200, { throw: '5035: This model requires a Workers Paid plan.' });
    if (ai === 'garbage') return send(res, 200, { response: 'It looks like a blue car.' });
    const plate = ai === 'misread' ? 'B4535NG' : '84535NG';
    return send(res, 200, { response: reading ? `{"plate":"${plate}","plate_state":"NY"}` : `Here you go: {"violation":"crosswalk","confidence":0.83,"plate":"${plate}","plate_state":"ny","plate_box_2d":[555,193,580,222]}` });
  }
  seen.push('openrouter');
  if (or === 'broke') return send(res, 402, {});
  const q = body.questions || {}, second = q.plate_text && Object.keys(q.plate_text.criteria)[1];
  send(res, 200, { answers: q.plate_text ? { plate_text: { choice: second, probabilities: { [second]: 0.87 } } } : { violation: { choice: 'crosswalk', probabilities: { crosswalk: 0.93 } }, plate_visible: { noul: 0.95 }, plate_box: { box: { left: 0.2, top: 0.5, right: 0.3, bottom: 0.55 } } }, usage: { cost: 0.00006 } });
});
const FAKE_AI = `export default function (env) { return { async run(model, input) {
  const j = await (await fetch(env.CTL + '/ai', { method: 'POST', body: JSON.stringify({ model, input }) })).json();
  if (j.throw) throw new Error(j.throw); return j; } }; }`;
const base = { LOCAL_TOKEN: 'tok', LOCAL_URL: `http://127.0.0.1:${pc.address().port}`, OPENROUTER_BASE: `http://127.0.0.1:${ctl.address().port}`, PER_IP_DAILY: '4', ALL_DAILY: '8', LOCAL_TIMEOUT_MS: '1500', COMPUTER_REST_MS: '2500' };
const make = (bindings, withAI = true) => new Miniflare({ workers: [
  { name: 'tattletale-ai', modules: true, scriptPath: WORKER, modulesRoot: WORKER.replace(/\/[^/]*$/, ''), compatibilityDate: '2026-07-01',
    durableObjects: { LIMITS: { className: 'Limits', useSQLite: true } }, bindings, ...(withAI ? { wrappedBindings: { AI: { scriptName: 'fake-ai' } } } : {}) },
  ...(withAI ? [{ name: 'fake-ai', modules: true, script: FAKE_AI, bindings: { CTL: `http://127.0.0.1:${ctl.address().port}` } }] : [])] });
let mf = make(base);
const IMG = 'data:image/jpeg;base64,' + '/9j/'.repeat(3000), SITE = 'https://samueljwebber.github.io', CANDS = ['84535NG', '84S35NG'];
const call = (path, body, { ip = '1.2.3.4', origin = SITE, method = 'POST' } = {}) => mf.dispatchFetch('https://tattletale-ai.example.workers.dev' + path, { method, headers: { Origin: origin, 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
let fails = 0;
const row = async (label, p, expect) => {
  seen.length = 0; const t0 = Date.now(), r = await p, j = await r.json().catch(() => ({})), ms = Date.now() - t0;
  const short = j.error ? `error: ${j.error}` : j.violation ? `${j.tier}/${j.label} ${j.violation.choice} ${j.violation.p}${j.plate ? ' plate ' + j.plate + ' ' + j.plateState : ''}${j.box ? ' box' : ''}${j.fallback ? ' (computer ' + j.fallback + ')' : ''}`
    : `${j.tier}/${j.label} ${j.choice} ${j.p}${j.read ? ' read ' + j.read : ''}${j.fallback ? ' (computer ' + j.fallback + ')' : ''}`;
  const ok = !expect || expect(r.status, j); if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(44)} ${String(r.status).padEnd(4)}${short.padEnd(62)}${String(ms).padStart(6)} ms  ${seen.join(' > ')}`);
};
const pre = await call('/v1/look', null, { method: 'OPTIONS' }), evil = await call('/v1/look', { image: IMG }, { origin: 'https://evil.example' });
console.log(`${pre.status === 204 && evil.status === 403 ? 'ok  ' : 'FAIL'} preflight from the app ${pre.status}, from another site ${evil.status}`);
computer = 'fast';   await row('computer answers', call('/v1/look', { image: IMG }), (s, j) => s === 200 && j.tier === 'computer');
computer = 'slow';   await row('computer too slow -> free cloud model', call('/v1/look', { image: IMG }), (s, j) => j.tier === 'cloud' && j.label === 'Gemma 4' && j.fallback === 'timeout' && j.plate === '84535NG' && j.plateState === 'NY' && Math.abs(j.box.left - 0.193) < 1e-9 && j.cost === 0);
const sent = aiInputs.at(-1); console.log(`${sent?.model === '@cf/google/gemma-4-26b-a4b-it' && sent.input.messages[0].content.some(c => c.type === 'image_url' && c.image_url.url.startsWith('data:image/jpeg')) ? 'ok  ' : 'FAIL'} Workers AI got ${sent?.model} with the photo as an image_url part`);
computer = 'fast';   await row('computer resting after a miss', call('/v1/look', { image: IMG }), (s, j) => j.tier === 'cloud' && j.fallback === 'resting' && !seen.includes('computer'));
await new Promise(r => setTimeout(r, 2600));
await row('rest over: computer tried again', call('/v1/look', { image: IMG }, { ip: '1.1.1.1' }), (s, j) => j.tier === 'computer');
computer = 'broken'; await row('computer errors', call('/v1/look', { image: IMG }, { ip: '1.1.1.1' }), (s, j) => j.tier === 'cloud' && j.fallback === 'error');
await new Promise(r => setTimeout(r, 2600)); computer = 'fast';
await row('plate check on the computer', call('/v1/plate', { image: IMG, cands: CANDS }, { ip: '1.1.1.1' }), (s, j) => j.tier === 'computer' && j.choice === '84535NG');
mf = make({ ...base, LOCAL_URL: '' }); ai = 'ok';
await row('plate: free model reads the same', call('/v1/plate', { image: IMG, cands: CANDS }), (s, j) => j.choice === '84535NG' && j.p === 0.9 && j.fallback === 'off');
ai = 'misread';      await row('plate: free model reads something else', call('/v1/plate', { image: IMG, cands: CANDS }), (s, j) => j.choice === 'none' && j.read === 'B4535NG');
ai = 'allowance';    await row('free allowance used up, no backup', call('/v1/look', { image: IMG }, { ip: '2.2.2.2' }), s => s === 429);
ai = 'paid';         await row('model needs paid plan, no backup', call('/v1/look', { image: IMG }, { ip: '2.2.2.2' }), s => s === 503);
ai = 'garbage';      await row('free model answers nonsense, no backup', call('/v1/look', { image: IMG }, { ip: '2.2.2.3' }), s => s === 502);
mf = make({ ...base, LOCAL_URL: '', OPENROUTER_KEY: 'sk-or-test' }); ai = 'allowance';
await row('allowance used up -> Jev on the owner\'s key', call('/v1/look', { image: IMG }), (s, j) => j.label === 'Jev' && j.cost > 0);
await row('plate: allowance used up -> Jev', call('/v1/plate', { image: IMG, cands: CANDS }), (s, j) => j.label === 'Jev' && j.choice === '84S35NG');
or = 'broke';        await row('...and OpenRouter out of credit', call('/v1/look', { image: IMG }), s => s === 503);
or = 'ok'; ai = 'ok';
await row('4th cloud answer for one person (cap 4)', call('/v1/look', { image: IMG }), s => s === 200);
await row('5th: over the cap', call('/v1/look', { image: IMG }), s => s === 429);
await row('someone else', call('/v1/look', { image: IMG }, { ip: '5.6.7.8' }), s => s === 200);
mf = make({ ...base, LOCAL_URL: '', ALL_DAILY: '5', PER_IP_DAILY: '30' });
const burst = await Promise.all([...Array(10)].map((_, i) => call('/v1/look', { image: IMG }, { ip: '10.0.0.' + i }).then(r => r.status)));
console.log(`${burst.filter(x => x === 200).length === 5 ? 'ok  ' : 'FAIL'} 10 at once, 5 left for everyone: ${burst.join(' ')}`);
mf = make({ ...base }); computer = 'fast'; ai = 'ok';
const st = await (await call('/v1/status', null, { method: 'GET' })).json(), probe = await (await call('/v1/status?probe=1', null, { method: 'GET' })).json();
console.log(`${st.cloud === 'Gemma 4 on Workers AI' && st.backup === 'not set up' && /answered in/.test(probe.computer) && /answered in/.test(probe.cloud) && probe.ok ? 'ok  ' : 'FAIL'} status: ${JSON.stringify(st)}\n     probe: ${JSON.stringify(probe)}`);
ai = 'paid'; const probe2 = await (await call('/v1/status?probe=1', null, { method: 'GET' }, { ip: '3.3.3.3' })).json();
console.log(`${!probe2.ok && /Paid plan/.test(probe2.cloud) ? 'ok  ' : 'FAIL'} probe when the model needs a paid plan: ${probe2.cloud}`);
ai = 'ok';
await row('not a photo', call('/v1/look', { image: 'data:text/html;base64,PHNjcmlwdD4=' }), s => s === 400);
await row('plate with no readings', call('/v1/plate', { image: IMG, cands: [] }), s => s === 400);
await row('wrong path', call('/v1/admin', { image: IMG }), s => s === 404);
mf = make({ ...base, LOCAL_URL: '' }, false);
await row('no Workers AI and no key', call('/v1/look', { image: IMG }), s => s === 502);
const { LOCAL_TIMEOUT_MS, ...noLimit } = base; mf = make({ ...noLimit, ALL_DAILY: '100' }); computer = 'slow';
await row('real default: computer silent 10 s', call('/v1/look', { image: IMG }, { ip: '9.9.9.9' }), (s, j) => j.tier === 'cloud' && j.fallback === 'timeout');
await mf.dispose(); pc.close(); ctl.close();
console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
