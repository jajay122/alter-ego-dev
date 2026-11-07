import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { askLocalModel, buildMessages, modelBase, searchWeb, validateInput } from '../lib/assistant.mjs';

const config = { password: 'test-password-for-tests-only', modelUrl: 'http://127.0.0.1:8081', model: 'SmolVLM-256M', origin: '' };
const modelAnswer = { choices: [{ message: { content: 'Réponse du fournisseur simulé pour ce test.' }, finish_reason: 'stop' }] };
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ioAAAAASUVORK5CYII=';
const jsonResponse = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

async function harness(t, fetchImpl = async () => jsonResponse(modelAnswer), overrides = {}) {
  const server = createApp({ config: { ...config, ...overrides }, fetchImpl });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  let cookie = '';
  async function post(path, body, extra = {}) {
    const response = await fetch(base + path, { method: 'POST', headers: {
      Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra,
    }, body: JSON.stringify(body) });
    return response;
  }
  async function login() {
    const response = await post('/api/login', { password: config.password });
    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly; SameSite=Strict/);
    cookie = setCookie.split(';')[0];
  }
  return { server, base, post, login, get cookie() { return cookie; } };
}

test('les opérations restent privées et une session est révoquée à la déconnexion', async t => {
  let calls = 0;
  const h = await harness(t, async () => { calls++; return jsonResponse(modelAnswer); });
  assert.equal((await h.post('/api/assist', { mode: 'text', prompt: 'Bonjour' })).status, 401);
  assert.equal((await h.post('/api/login', { password: 'incorrect' })).status, 401);
  await h.login();
  const result = await h.post('/api/assist', { mode: 'text', prompt: 'Bonjour' });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).answer, modelAnswer.choices[0].message.content);
  assert.equal(calls, 1);
  assert.equal((await h.post('/api/logout', {})).status, 200);
  assert.equal((await h.post('/api/assist', { mode: 'text', prompt: 'Encore' })).status, 401);
});

test('aucune session ne peut être créée avec une configuration sans mot de passe', async t => {
  const h = await harness(t, undefined, { password: '' });
  const r = await h.post('/api/login', { password: '' });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'PASSWORD_REQUIRED');
});

test('l’origine et le type de contenu sont vérifiés avant toute opération', async t => {
  const h = await harness(t);
  assert.equal((await h.post('/api/login', { password: config.password }, { Origin: 'https://autre.example' })).status, 403);
  assert.equal((await h.post('/api/login', { password: config.password }, { 'Content-Type': 'text/plain' })).status, 415);
});

test('les tentatives de mot de passe sont limitées', async t => {
  const h = await harness(t);
  for (let i = 0; i < 10; i++) assert.equal((await h.post('/api/login', { password: 'wrong' })).status, 401);
  assert.equal((await h.post('/api/login', { password: config.password })).status, 429);
});

test('le statut ne confond pas configuration et moteur réellement disponible', async t => {
  const h = await harness(t, async () => { throw new Error('offline'); });
  let r = await fetch(h.base + '/api/status');
  assert.equal((await r.json()).modelReady, null);
  await h.login();
  r = await fetch(h.base + '/api/status', { headers: { Cookie: h.cookie } });
  assert.equal((await r.json()).modelReady, false);
});

test('les entrées incorrectes et images déguisées sont refusées', () => {
  assert.throws(() => validateInput(null), { code: 'INVALID_MODE' });
  assert.throws(() => validateInput({ mode: 'shell', prompt: 'ls' }), { code: 'INVALID_MODE' });
  assert.throws(() => validateInput({ mode: 'text', prompt: ' ' }), { code: 'INVALID_PROMPT' });
  assert.throws(() => validateInput({ mode: 'photo', prompt: 'Lis', image: { mimeType: 'image/png', data: Buffer.from('<script>test</script>').toString('base64') } }), { code: 'INVALID_IMAGE' });
  assert.throws(() => validateInput({ mode: 'photo', prompt: 'Lis', image: { mimeType: 'image/svg+xml', data: png } }), { code: 'INVALID_IMAGE' });
  assert.throws(() => validateInput({ mode: 'text', prompt: 'Lis', image: {} }), { code: 'UNEXPECTED_IMAGE' });
  assert.equal(validateInput({ mode: 'photo', prompt: 'Décris', image: { mimeType: 'image/png', data: png } }).image.data, png);
});

test('une photo à la limite de taille est validée sans débordement de pile', () => {
  const bytes = Buffer.alloc(3 * 1024 * 1024);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  const image = { mimeType: 'image/png', data: bytes.toString('base64') };
  assert.equal(validateInput({ mode: 'photo', prompt: 'Test de taille uniquement', image }).image.data.length, image.data.length);
  assert.throws(() => validateInput({ mode: 'photo', prompt: 'Trop grand', image: { ...image, data: image.data + 'AAAA' } }), { code: 'INVALID_IMAGE' });
});

test('une image n’est envoyée qu’au moteur local et sans API distante', async () => {
  const requests = [];
  const input = validateInput({ mode: 'photo', prompt: 'Décris', image: { mimeType: 'image/png', data: png } });
  const result = await askLocalModel(input, config, async (url, options) => { requests.push({ url: String(url), body: JSON.parse(options.body) }); return jsonResponse(modelAnswer); });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:8081/v1/chat/completions');
  assert.equal(requests[0].body.messages[0].content[1].image_url.url, `data:image/png;base64,${png}`);
  assert.equal(result.sources.length, 0);
});

test('un moteur externe est refusé et les erreurs restent explicites', async () => {
  for (const url of ['https://api.example.com', 'http://evil.example', 'http://localhost@evil.example', 'http://127.0.0.1/private']) {
    assert.throws(() => modelBase({ modelUrl: url }), { code: 'MODEL_URL_INVALID' });
  }
  await assert.rejects(askLocalModel({ mode: 'text', prompt: 'Bonjour' }, config, async () => { throw new Error('private error secret'); }), { code: 'MODEL_OFFLINE' });
  await assert.rejects(askLocalModel({ mode: 'text', prompt: 'Bonjour' }, config, async () => new Response('upstream secret', { status: 500 })), { code: 'MODEL_ERROR' });
});

test('la recherche utilise de vraies références d’encyclopédie et n’invente aucun lien', async () => {
  const urls = [];
  const fetchImpl = async (url, options) => {
    urls.push(String(url));
    if (String(url).startsWith('https://fr.wikipedia.org/')) return jsonResponse({ query: { search: [{ pageid: 123, title: 'Panneau solaire', snippet: 'De l’énergie <b>solaire</b>.' }] } });
    assert.match(JSON.parse(options.body).messages[0].content, /De l’énergie solaire/);
    return jsonResponse(modelAnswer);
  };
  const result = await askLocalModel({ mode: 'web', prompt: 'Panneau solaire' }, config, fetchImpl);
  assert.equal(urls.length, 2);
  assert.equal(result.sources[0].url, 'https://fr.wikipedia.org/?curid=123');
  assert.equal(result.sources[0].excerpt, 'De l’énergie solaire.');
  await assert.rejects(searchWeb('absent', async () => jsonResponse({ query: { search: [] } })), { code: 'NO_SOURCES' });
});

test('une deuxième tâche simultanée est refusée, sans doublon de calcul', async t => {
  let release;
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const h = await harness(t, async () => { started(); await new Promise(resolve => { release = resolve; }); return jsonResponse(modelAnswer); });
  await h.login();
  const first = h.post('/api/assist', { mode: 'text', prompt: 'Première' });
  await startedPromise;
  assert.equal((await h.post('/api/assist', { mode: 'text', prompt: 'Deuxième' })).status, 429);
  release();
  assert.equal((await first).status, 200);
});

test('la limite de travail locale est appliquée', async t => {
  const h = await harness(t);
  await h.login();
  for (let i = 0; i < 20; i++) assert.equal((await h.post('/api/assist', { mode: 'text', prompt: 'Test' })).status, 200);
  const r = await h.post('/api/assist', { mode: 'text', prompt: 'Encore' });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).code, 'LOCAL_LIMIT');
});

test('les chemins non autorisés ne permettent pas de lire les fichiers du serveur', async t => {
  const h = await harness(t);
  for (const path of ['/.env.local', '/server.mjs', '/lib/assistant.mjs']) {
    assert.equal((await fetch(h.base + path)).status, 404);
  }
  const r = await fetch(h.base + '/');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('la demande reste bornée et une réponse tronquée est signalée', async () => {
  assert.throws(() => validateInput({ mode: 'text', prompt: 'a'.repeat(4001) }), { code: 'INVALID_PROMPT' });
  const message = buildMessages({ mode: 'text', prompt: 'Simple' });
  assert.equal(message.length, 1);
  const r = await askLocalModel({ mode: 'text', prompt: 'Test' }, config, async () => jsonResponse({ choices: [{ message: { content: 'Début' }, finish_reason: 'length' }] }));
  assert.equal(r.truncated, true);
});
