// Runs the Worker in Cloudflare's own runtime (workerd, via Miniflare) against a fake computer and a fake OpenRouter.
//   npm i -D miniflare && node test.mjs        (takes about 15 seconds; the last case waits the real 10 s)
import { Miniflare } from 'miniflare';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
const WORKER = process.argv[2] || fileURLToPath(new URL('./worker.js', import.meta.url));
let computer = 'fast', cloud = 'ok'; const seen = [];
const server = handler => new Promise(res => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => res(s)); });
const read = req => new Promise(res => { let b = ''; req.on('data', c => b += c); req.on('end', () => res(b)); });
const send = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const pc = await server(async (req, res) => {
  const body = JSON.parse(await read(req)); seen.push('computer');
  if (req.headers.authorization !== 'Bearer tok') return send(res, 401, { error: 'token' });
  if (computer === 'slow') return setTimeout(() => { try { send(res, 200, {}); } catch {} }, 12000);
  if (computer === 'broken') return send(res, 500, { error: 'model crashed' });
  const q = body.questions, first = q.plate_text && Object.keys(q.plate_text.criteria)[0];
  send(res, 200, { answers: q.plate_text ? { plate_text: { choice: first, probabilities: { [first]: 0.91 } } } : { violation: { choice: 'hydrant', probabilities: { hydrant: 0.88 } }, plate_visible: { noul: 0.9 } } });
});
const or = await server(async (req, res) => {
  const body = JSON.parse(await read(req)); seen.push('cloud ' + body.model);
  if (req.headers.authorization !== 'Bearer sk-or-test') return send(res, 401, { error: { message: 'bad key' } });
  if (cloud === 'broke') return send(res, 402, { error: { message: 'Insufficient credits' } });
  if (req.url.endsWith('/alpha/decisions')) {
    const q = body.questions, second = q.plate_text && Object.keys(q.plate_text.criteria)[1];
    return send(res, 200, { answers: q.plate_text ? { plate_text: { choice: second, probabilities: { [second]: 0.87 } } } : { violation: { choice: 'crosswalk', probabilities: { crosswalk: 0.93 } }, plate_visible: { noul: 0.95 }, plate_box: { box: { left: 0.2, top: 0.5, right: 0.3, bottom: 0.55 } } }, usage: { cost: 0.00006 } });
  }
  send(res, 200, { choices: [{ message: { content: '{"violation":"bike_lane","confidence":0.8,"plate":"kxy-4821","plate_state":"nj","plate_box":[200,500,300,550]}' } }], usage: { cost: 0.0002 } });
});
const base = { OPENROUTER_KEY: 'sk-or-test', LOCAL_TOKEN: 'tok', LOCAL_URL: `http://127.0.0.1:${pc.address().port}`, OPENROUTER_BASE: `http://127.0.0.1:${or.address().port}`, PER_IP_DAILY: '3', ALL_DAILY: '6', LOCAL_TIMEOUT_MS: '1500' };
const make = bindings => new Miniflare({ modules: true, scriptPath: WORKER, modulesRoot: WORKER.replace(/\/[^/]*$/, ''), compatibilityDate: '2026-07-01', durableObjects: { LIMITS: { className: 'Limits', useSQLite: true } }, bindings });
let mf = make(base);
const IMG = 'data:image/jpeg;base64,' + '/9j/'.repeat(3000);
const SITE = 'https://samueljwebber.github.io';
const call = (path, body, { ip = '1.2.3.4', origin = SITE, method = 'POST' } = {}) => mf.dispatchFetch('https://tattletale-ai.example.workers.dev' + path, { method, headers: { Origin: origin, 'CF-Connecting-IP': ip, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
const row = async (label, p) => { seen.length = 0; const t0 = Date.now(); const r = await p; const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch { j = txt; }
  const short = typeof j === 'object' && j ? (j.error ? `error: ${j.error}` : `${j.tier}/${j.model} ${j.violation ? j.violation.choice + ' ' + j.violation.p : j.choice + ' ' + j.p}${j.plate ? ' plate ' + j.plate + ' ' + j.plateState : ''}${j.box ? ' box' : ''}${j.fallback ? ' (computer ' + j.fallback + ')' : ''}`) : String(j).slice(0, 60);
  console.log(label.padEnd(40), String(r.status).padEnd(4), short.padEnd(58), `${String(Date.now() - t0).padStart(5)} ms`, seen.join(' > ')); };
console.log('preflight from the app:', (await call('/v1/look', null, { method: 'OPTIONS' })).status, '| from another site:', (await call('/v1/look', { image: IMG }, { origin: 'https://evil.example' })).status);
computer = 'fast';   await row('computer answers', call('/v1/look', { image: IMG }));
computer = 'slow';   await row('computer too slow (1.5 s test limit)', call('/v1/look', { image: IMG }));
computer = 'broken'; await row('computer errors', call('/v1/look', { image: IMG }));
computer = 'fast';   await row('plate check on the computer', call('/v1/plate', { image: IMG, cands: ['84535NG', '84S35NG'] }));
computer = 'broken'; await row('plate check in the cloud', call('/v1/plate', { image: IMG, cands: ['84535NG', '84S35NG'] }));
await row('4th cloud answer, same person', call('/v1/look', { image: IMG }));
await row('someone else', call('/v1/look', { image: IMG }, { ip: '5.6.7.8' }));
computer = 'fast';   await row('computer answers past the cap', call('/v1/look', { image: IMG }));
computer = 'broken'; await row('3 more people (everyone cap is 6)', Promise.all(['9.9.9.1', '9.9.9.2'].map(ip => call('/v1/look', { image: IMG }, { ip }))).then(() => call('/v1/look', { image: IMG }, { ip: '9.9.9.3' })));
const burst = await Promise.all([...Array(10)].map((_, i) => call('/v1/look', { image: IMG }, { ip: '10.0.0.' + i }).then(r => r.status)));
console.log('10 at once after the cap:'.padEnd(40), burst.join(' '));
await row('not a photo', call('/v1/look', { image: 'data:text/html;base64,PHNjcmlwdD4=' }));
await row('plate with no readings', call('/v1/plate', { image: IMG, cands: [] }));
await row('wrong path', call('/v1/admin', { image: IMG }));
mf = make({ ...base, ALL_DAILY: '100', CLOUD_MODEL: 'qwen', LOCAL_URL: '' });
await row('no computer set, cloud model Qwen', call('/v1/look', { image: IMG }));
cloud = 'broke'; await row('OpenRouter out of credit', call('/v1/look', { image: IMG }, { ip: '2.2.2.2' }));
cloud = 'ok'; mf = make({ ...base, ALL_DAILY: '5', PER_IP_DAILY: '30' }); computer = 'broken';
const edge = await Promise.all([...Array(10)].map((_, i) => call('/v1/look', { image: IMG }, { ip: '172.16.0.' + i }).then(r => r.status)));
console.log('10 at once, 5 left for everyone:'.padEnd(40), edge.join(' '), '->', edge.filter(x => x === 200).length, 'answered');
const { LOCAL_TIMEOUT_MS, ...noLimit } = base; mf = make({ ...noLimit, ALL_DAILY: '100' });
computer = 'slow'; await row('real default: computer silent 10 s', call('/v1/look', { image: IMG }));
console.log('day key (NYC):', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()));
await mf.dispose(); pc.close(); or.close(); process.exit(0);
