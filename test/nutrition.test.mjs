import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createNutritionCatalog, normalizeProduct } from '../lib/nutrition.mjs';
import { createCalorieStore } from '../lib/calories.mjs';
import { createApp } from '../server.mjs';

const raw = (overrides = {}) => ({ code: '2000000000008', product_name: 'Produit test citron', brands: 'Marque fictive', nutriments: { 'energy-kcal_100g': 123.4 }, last_modified_t: 1700000000, ...overrides });
const response = products => Response.json({ products });
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'alter-ego-nutrition-'));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
const selection = (p, extra = {}) => ({ code: p.code, retrievedAt: p.retrievedAt, quantity: 125, unit: 'g', basisConfirmed: true, ...extra });
const manual = () => ({ operationId: randomUUID(), date: '2026-11-07', meal: 'lunch', name: 'Repas', kcal: 250 });

test('les données manquantes, zéros et kJ sont normalisés sans inventer une unité', () => {
  assert.equal(normalizeProduct(raw({ nutriments: {} })).kcalPer100, null);
  assert.equal(normalizeProduct(raw({ nutriments: { 'energy-kcal_100g': '' } })).kcalPer100, null);
  assert.equal(normalizeProduct(raw({ nutriments: { 'energy-kcal_100g': null } })).kcalPer100, null);
  assert.equal(normalizeProduct(raw({ nutriments: { 'energy-kcal_100g': 0 } })).kcalPer100, 0);
  assert.equal(normalizeProduct(raw({ nutriments: { 'energy-kj_100g': 418.4 } })).kcalPer100, 100);
  assert.equal(normalizeProduct(raw({ nutriments: { energy_100g: 418.4 } })).kcalPer100, null);
  assert.equal(normalizeProduct(raw()).basis, '100g-or-100ml');
  assert.equal(normalizeProduct(raw()).nutrients.proteins, null);
  assert.equal(normalizeProduct(raw({ code: '../../foo' })), null);
});

test('le contrat distant utilise URL fixe, champs bornés, User-Agent et un cache persistant', async t => {
  const dir = await directory(t); let calls = 0;
  const catalog = createNutritionCatalog(dir, { fetchImpl: async (url, options) => {
    calls++; assert.equal(url.origin, 'https://world.openfoodfacts.org'); assert.equal(url.pathname, '/cgi/search.pl');
    assert.equal(url.searchParams.get('search_terms'), 'citron'); assert.equal(url.searchParams.get('page_size'), '10');
    assert.ok(options.headers['User-Agent'].includes('AlterEgoDev')); assert.equal(options.redirect, 'error'); return response([raw()]);
  } });
  const first = await catalog.search('Citron'); assert.equal(first.mode, 'online'); assert.equal(first.products.length, 1);
  assert.equal((await catalog.search('citron')).mode, 'cache'); assert.equal(calls, 1);
  const reopened = createNutritionCatalog(dir, { fetchImpl: () => { throw new Error('offline'); } });
  assert.equal((await reopened.search('CITRON')).products[0].kcalPer100, 123.4);
  assert.equal((await stat(join(dir, 'nutrition.sqlite'))).mode & 0o777, 0o600);
  assert.equal((await reopened.search('cit', { localOnly: true })).products.length, 1);
  assert.equal((await reopened.search('" OR *', { localOnly: true })).products.length, 0);
});

test('une recherche par code-barres ne dépend pas du moteur de texte', async t => {
  const catalog = createNutritionCatalog(await directory(t), { fetchImpl: async url => {
    assert.equal(url.pathname, '/api/v3.6/product/2000000000008.json'); return Response.json({ status: 'success', product: raw() });
  } });
  const result = await catalog.search('2000000000008'); assert.equal(result.products[0].code, '2000000000008');
  await assert.rejects(catalog.search('123'), { code: 'INVALID_BARCODE' });
  await assert.rejects(catalog.search('x'), { code: 'INVALID_SEARCH' });
});

test('le cache est accessible hors ligne et les données périmées sont signalées', async t => {
  const dir = await directory(t); let time = Date.now();
  await createNutritionCatalog(dir, { now: () => time, fetchImpl: async () => response([raw()]) }).search('citron');
  time += 8 * 86400_000;
  let calls = 0;
  const offline = createNutritionCatalog(dir, { now: () => time, fetchImpl: async () => { calls++; throw new Error('offline'); } });
  const local = await offline.search('citr', { localOnly: true }); assert.equal(local.mode, 'local'); assert.equal(calls, 0);
  const fallback = await offline.search('citron'); assert.equal(fallback.mode, 'stale'); assert.ok(fallback.warning.includes('cache'));
  await assert.rejects(offline.search('inconnu'), { code: 'NUTRITION_OFFLINE' });
});

test('un résultat vide ne provoque pas de requêtes répétées et les formats cassés sont refusés', async t => {
  const dir = await directory(t); let calls = 0;
  const empty = createNutritionCatalog(dir, { fetchImpl: async () => { calls++; return response([]); } });
  assert.deepEqual((await empty.search('absent')).products, []); await empty.search('absent'); assert.equal(calls, 1);
  const invalid = createNutritionCatalog(await directory(t), { fetchImpl: async () => Response.json({ not: 'products' }) });
  await assert.rejects(invalid.search('citron'), { code: 'NUTRITION_FORMAT' });
  const large = createNutritionCatalog(await directory(t), { fetchImpl: async () => new Response('x'.repeat(1_000_001)) });
  await assert.rejects(large.search('citron'), { code: 'NUTRITION_FORMAT' });
  const rate = createNutritionCatalog(await directory(t), { fetchImpl: async () => new Response('', { status: 429 }) });
  await assert.rejects(rate.search('citron'), { status: 429 });
});

test('les budgets sont persistants et une seule recherche distante est admise à la fois', async t => {
  const dir = await directory(t); let calls = 0;
  for (let i = 0; i < 8; i++) {
    await createNutritionCatalog(dir, { fetchImpl: async () => { calls++; return response([]); } }).search(`produit ${i}`);
  }
  await assert.rejects(createNutritionCatalog(dir, { fetchImpl: async () => { calls++; return response([]); } }).search('neuvieme'), { code: 'NUTRITION_LIMIT' });
  assert.equal(calls, 8);
  let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const hold = createNutritionCatalog(await directory(t), { fetchImpl: () => { entered(); return new Promise(resolve => { release = () => resolve(response([raw()])); }); } });
  const first = hold.search('citron'); await started;
  await assert.rejects(hold.search('orange'), { code: 'NUTRITION_BUSY' }); release(); await first;
});

test('portion calculée et source figée restent identiques après mise à jour du catalogue', async t => {
  const dir = await directory(t); let time = Date.now(); let energy = 123.4;
  const catalog = createNutritionCatalog(dir, { now: () => time, fetchImpl: async () => response([raw({ nutriments: { 'energy-kcal_100g': energy } })]) });
  const product = (await catalog.search('citron')).products[0];
  const portion = await catalog.portion(selection(product)); assert.equal(portion.kcal, 154.3);
  const store = createCalorieStore(dir); const input = { ...manual(), ...portion };
  const saved = await store.add(input); assert.equal((await store.add(input)).id, saved.id);
  time += 8 * 86400_000; energy = 200;
  await catalog.search('citron');
  await assert.rejects(catalog.portion(selection(product)), { code: 'PRODUCT_CHANGED' });
  const exported = await createCalorieStore(dir).snapshot(); assert.equal(exported.entries[0].tenths, 1543);
  assert.equal(exported.entries[0].nutrition.kcalPer100, 123.4);
  const kept = await store.update(saved.id, { ...manual(), name: saved.name, kcal: 154.3, version: 1, preserveNutrition: true });
  assert.ok(kept.nutrition);
  const changed = await store.update(saved.id, { ...manual(), kcal: 200, version: 2 }); assert.equal(changed.nutrition, undefined);
});

test('une portion exige unité, quantité et confirmation et refuse les fiches sans énergie', async t => {
  const catalog = createNutritionCatalog(await directory(t), { fetchImpl: async () => response([raw()]) });
  const p = (await catalog.search('citron')).products[0];
  for (const extra of [{ unit: '' }, { unit: 'kg' }, { quantity: 0 }, { quantity: null }, { quantity: '125' }, { quantity: 1.123 }, { basisConfirmed: false }]) {
    await assert.rejects(catalog.portion(selection(p, extra)), { code: 'INVALID_NUTRITION' });
  }
  assert.equal((await catalog.portion(selection(p, { unit: 'ml' }))).nutrition.unit, 'ml');
  const missing = createNutritionCatalog(await directory(t), { fetchImpl: async () => response([raw({ nutriments: {} })]) });
  await assert.rejects(missing.portion(selection((await missing.search('citron')).products[0])), { code: 'MISSING_ENERGY' });
});

test('un cache corrompu ne détruit jamais le journal existant', async t => {
  const dir = await directory(t); await createCalorieStore(dir).add(manual());
  const before = await readFile(join(dir, 'calories.json'), 'utf8');
  await writeFile(join(dir, 'nutrition.sqlite'), 'corrupted');
  await assert.rejects(createNutritionCatalog(dir).search('citron'), { code: 'CATALOG_STORAGE' });
  assert.equal(await readFile(join(dir, 'calories.json'), 'utf8'), before);
});

test('API privée, calcul côté serveur, refus de source forgée et export de provenance', async t => {
  const dataDir = await directory(t); let remoteCalls = 0;
  const password = 'test-nutrition-only-password';
  const server = createApp({ config: { dataDir, password, origin: '', model: 'test' }, fetchImpl: async url => {
    remoteCalls++; assert.equal(new URL(url).hostname, 'world.openfoodfacts.org'); return response([raw()]);
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`; let cookie;
  async function request(path, method = 'GET', body) {
    return fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  assert.equal((await request('/api/nutrition/search?q=citron')).status, 401); assert.equal(remoteCalls, 0);
  cookie = (await request('/api/login', 'POST', { password })).headers.get('set-cookie').split(';')[0];
  const product = (await (await request('/api/nutrition/search?q=citron')).json()).products[0];
  const input = { ...manual(), kcal: 999, catalogPortion: selection(product) };
  const r = await request('/api/calories/entries', 'POST', input); assert.equal(r.status, 201);
  const saved = await r.json(); assert.equal(saved.kcal, 154.3); assert.equal(saved.nutrition.kcalPer100, 123.4);
  assert.equal((await request('/api/calories/entries', 'POST', input)).status, 201);
  const exported = await (await request('/api/calories/export')).json(); assert.equal(exported.entries.length, 1);
  assert.equal(exported.entries[0].nutrition.sourceUrl, product.sourceUrl);
  assert.equal((await request('/api/calories/entries', 'POST', { ...manual(), nutrition: saved.nutrition })).status, 400);
  assert.equal(remoteCalls, 1);
});
