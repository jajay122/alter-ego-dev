import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createWorker } from '../hosted/worker.mjs';

function fixture(fetchImpl, catalogue = []) {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('../hosted/schema.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) {
    const prepared = sqlite.prepare(sql); let args = [];
    return { bind(...values) { args = values; return this; }, async first() { return prepared.get(...args) ?? null; }, async all() { return { results: prepared.all(...args) }; }, async run() { const r = prepared.run(...args); return { meta: { changes: r.changes } }; } };
  }, async batch(statements) { sqlite.exec('BEGIN'); try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };
  let worker = createWorker({ assets: { '/': { body: '<html></html>', type: 'text/html' }, '/catalogue/usda.json': { body: JSON.stringify(catalogue), type: 'application/json' } }, fetchImpl });
  async function call(path, { user = 'alice', method = 'GET', body, origin = 'https://example.test' } = {}) {
    const headers = {}; if (user) headers['oai-authenticated-user-id'] = user;
    if (method !== 'GET') { headers.origin = origin; headers['content-type'] = 'application/json'; }
    const response = await worker.fetch(new Request(`https://example.test${path}`, { method, headers, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }), { DB });
    return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() };
  }
  return { call, close: () => sqlite.close(), sqlite, restart: () => { worker = createWorker({ assets: { '/catalogue/usda.json': { body: JSON.stringify(catalogue), type: 'application/json' } }, fetchImpl }); } };
}
const id = '00000000-0000-4000-8000-000000000001';
const id2 = '00000000-0000-4000-8000-000000000002';
const food = { name: 'Pomme', date: '2026-11-09', meal: 'snack', kcal: 54.5, operationId: id };

test('Sites identity, origin and bounded JSON required', async () => {
  const f = fixture(); try {
    assert.equal((await f.call('/', { user: null })).status, 401);
    assert.equal((await f.call('/api/session')).data.hosted, true);
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', origin: 'null', body: food })).status, 403);
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', body: 'x'.repeat(17000) })).status, 413);
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', body: '{}' })).status, 400);
    assert.equal((await f.call('/api/assist', { method: 'POST', body: {} })).data.code, 'CLIENT_MODEL_REQUIRED');
  } finally { f.close(); }
});

test('durable owner isolation, idempotency and optimistic concurrency', async () => {
  const f = fixture(); try {
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', body: food })).status, 201);
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', body: food })).status, 201);
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', body: { ...food, kcal: 55 } })).status, 409);
    assert.equal((await f.call('/api/calories/day?date=2026-11-09')).data.total, 54.5);
    assert.equal((await f.call('/api/calories/export', { user: 'bob' })).data.entries.length, 0);
    assert.equal((await f.call(`/api/calories/entries/${id}`, { user: 'bob', method: 'PUT', body: { ...food, version: 1 } })).status, 404);
    assert.equal((await f.call(`/api/calories/entries/${id}`, { user: 'bob', method: 'DELETE', body: { version: 1 } })).status, 200);
    assert.equal((await f.call(`/api/calories/entries/${id}`, { method: 'PUT', body: { ...food, version: 0 } })).status, 400);
    assert.equal((await f.call(`/api/calories/entries/${id}`, { method: 'PUT', body: { ...food, version: 1, kcal: 56 } })).data.version, 2);
    assert.equal((await f.call(`/api/calories/entries/${id}`, { method: 'DELETE', body: { version: 1 } })).status, 409);
    assert.equal((await f.call('/api/calories/export')).data.entries.length, 1);
  } finally { f.close(); }
});

test('favorites preserve snapshots after entry edits and are owner scoped', async () => {
  const f = fixture(); try {
    await f.call('/api/calories/entries', { method: 'POST', body: food });
    assert.equal((await f.call('/api/calories/favorites', { method: 'POST', body: { entryId: id } })).status, 201);
    await f.call(`/api/calories/entries/${id}`, { method: 'PUT', body: { ...food, version: 1, kcal: 99 } });
    assert.equal((await f.call('/api/calories/favorites', { user: 'bob' })).data.favorites.length, 0);
    assert.equal((await f.call('/api/calories/entries', { user: 'bob', method: 'POST', body: { favoriteId: id, date: food.date, meal: 'lunch', operationId: id2 } })).status, 404);
    const copy = await f.call('/api/calories/entries', { method: 'POST', body: { favoriteId: id, date: food.date, meal: 'lunch', operationId: id2 } });
    assert.equal(copy.data.kcal, 54.5);
    await f.call(`/api/calories/favorites/${id}`, { user: 'bob', method: 'DELETE', body: {} });
    assert.equal((await f.call('/api/calories/favorites')).data.favorites.length, 1);
  } finally { f.close(); }
});

test('v1 imports merge atomically, replay without duplicates and never overwrite goals', async () => {
  const f = fixture(); try {
    const legacy = { id, name: food.name, date: food.date, meal: food.meal, tenths: 545, version: 1, createdAt: '2026-11-09T00:00:00Z' };
    const imported = await f.call('/api/calories/import', { method: 'POST', body: { entries: [legacy], goal: 1800 } });
    assert.equal(imported.data.imported, 1);
    assert.equal((await f.call('/api/calories/import', { method: 'POST', body: { entries: [legacy], goal: 2000 } })).data.skipped, 1);
    assert.equal((await f.call('/api/calories/export')).data.goal, 1800);
    assert.equal((await f.call('/api/calories/export', { user: 'bob' })).data.goal, null);
    const conflict = await f.call('/api/calories/import', { method: 'POST', body: { entries: [{ ...legacy, id: id2 }, { ...legacy, tenths: 1 }] } });
    assert.equal(conflict.status, 409);
    assert.equal((await f.call('/api/calories/export')).data.entries.length, 1);
    assert.equal((await f.call('/api/calories/import', { method: 'POST', body: { entries: [{ ...legacy, id: id2 }, { ...legacy, date: '2026-02-30' }] } })).status, 400);
    assert.equal((await f.call('/api/calories/export')).data.entries.length, 1);
  } finally { f.close(); }
});

test('schema aborts conflicting inserts inside a D1 batch', async () => {
  const f = fixture(); try {
    await f.call('/api/calories/entries', { method: 'POST', body: food });
    f.sqlite.exec('BEGIN');
    try {
      f.sqlite.prepare('INSERT INTO profiles(owner,goal) VALUES(?,?)').run('alice', 2000);
      assert.throws(() => f.sqlite.prepare('INSERT OR IGNORE INTO entries(owner,id,date,meal,name,tenths,created_at) VALUES(?,?,?,?,?,?,?)').run('alice', id, food.date, food.meal, 'Different', 1, 'now'), /ENTRY_CONTENT_CONFLICT/);
    } finally { f.sqlite.exec('ROLLBACK'); }
    assert.equal((await f.call('/api/calories/export')).data.goal, null);
  } finally { f.close(); }
});

test('encyclopedia uses real fixed upstream source and validates query', async () => {
  const targets = []; const f = fixture(async url => { targets.push(String(url)); return Response.json({ query: { search: [{ title: 'Pomme', snippet: '<b>Fruit</b>', pageid: 12 }] } }); });
  try {
    const result = await f.call('/api/assistant/search?q=pomme');
    assert.equal(result.data.sources[0].url, 'https://fr.wikipedia.org/?curid=12');
    assert.equal(result.data.sources[0].excerpt, 'Fruit');
    assert.ok(targets[0].startsWith('https://fr.wikipedia.org/w/api.php?'));
    assert.equal((await f.call('/api/assistant/search?q=x')).status, 400);
  } finally { f.close(); }
});

test('Open Food Facts portions are derived from server records and copied with provenance', async () => {
  const f = fixture(async () => Response.json({ products: [{ code: '3017620422003', product_name_fr: 'Crème', nutriments: { 'energy-kcal_100g': 530 }, last_modified_t: 1700000000 }] }));
  try {
    const result = await f.call('/api/nutrition/search?q=creme');
    assert.equal(result.status, 200);
    const product = result.data.products[0];
    assert.equal(product.kcalPer100, 530);
    const catalogPortion = { provider: product.provider, code: product.code, retrievedAt: product.retrievedAt, quantity: 20, unit: 'g', basisConfirmed: true };
    const added = await f.call('/api/calories/entries', { method: 'POST', body: { ...food, catalogPortion } });
    assert.equal(added.data.kcal, 106);
    assert.equal(added.data.nutrition.sourceUrl, 'https://world.openfoodfacts.org/product/3017620422003');
    const copy = await f.call('/api/calories/entries', { method: 'POST', body: { copyEntryId: id, operationId: id2, date: food.date, meal: 'lunch' } });
    assert.deepEqual(copy.data.nutrition, added.data.nutrition);
    assert.equal((await f.call('/api/calories/entries', { user: 'bob', method: 'POST', body: { ...food, catalogPortion } })).status, 409);
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', body: { ...food, operationId: id2, nutrition: added.data.nutrition } })).status, 400);
  } finally { f.close(); }
});

test('recipe sources reject private URLs and search quotas persist across requests', async () => {
  let calls = 0;
  const f = fixture(async () => { calls++; return Response.json({ query: { search: [] } }); });
  try {
    assert.equal((await f.call('/api/nutrition/web', { method: 'POST', body: { url: 'http://127.0.0.1/private' } })).status, 400);
    assert.equal(calls, 0);
    for (let i = 0; i < 12; i++) assert.equal((await f.call('/api/assistant/search?q=pomme')).status, 200);
    assert.equal((await f.call('/api/assistant/search?q=pomme')).status, 429);
    assert.equal(calls, 12);
    assert.equal((await f.call('/api/assistant/search?q=pomme', { user: 'bob' })).status, 200);
  } finally { f.close(); }
});

test('USDA v1 import retains validated provenance after a new Worker instance', async () => {
  const f = fixture(); try {
    const nutrition = { provider: 'usda', code: '171688', sourceUrl: 'https://fdc.nal.usda.gov/food-details/171688/nutrients', license: 'CC0-1.0', dataset: 'SR Legacy', release: '2018-04', revision: 'a'.repeat(64), energyNutrientId: 1008, sourceUpdatedAt: null, retrievedAt: '2026-11-09T00:00:00Z', kcalPer100: 109, quantity: 50, unit: 'g', basisConfirmed: true };
    assert.equal((await f.call('/api/calories/import', { method: 'POST', body: { entries: [{ id, name: 'Food USDA', date: food.date, meal: 'lunch', tenths: 545, nutrition }] } })).data.imported, 1);
    f.restart();
    const exported = await f.call('/api/calories/export');
    assert.deepEqual(exported.data.entries[0].nutrition, nutrition);
    assert.equal(exported.data.entries[0].kcal, 54.5);
    const rejected = await f.call('/api/calories/import', { method: 'POST', body: { entries: [{ id: id2, name: 'Forged source', date: food.date, meal: 'lunch', tenths: 545, nutrition: { ...nutrition, sourceUrl: 'https://example.com/fake' } }] } });
    assert.equal(rejected.status, 400);
    assert.equal((await f.call('/api/calories/export')).data.entries.length, 1);
  } finally { f.close(); }
});

test('OFF normalization converts kJ and leaves absent energy unavailable', async () => {
  const f = fixture(async () => Response.json({ products: [
    { code: '12345678', product_name: 'Energy', nutriments: { 'energy-kj_100g': 418.4 } },
    { code: '87654321', product_name: 'Unknown', nutriments: {} }
  ] }));
  try {
    const products = (await f.call('/api/nutrition/search?q=energy')).data.products;
    assert.equal(products[0].kcalPer100, 100);
    assert.equal(products[0].energyMethod, 'converted-kj');
    assert.equal(products[1].kcalPer100, null);
    assert.equal((await f.call('/api/nutrition/search?q=energy&local=1', { user: 'bob' })).data.products.length, 0);
    const bad = await f.call('/api/calories/entries', { method: 'POST', body: { ...food, catalogPortion: { provider: 'openfoodfacts', code: products[1].code, retrievedAt: products[1].retrievedAt, quantity: 100, unit: 'g', basisConfirmed: true } } });
    assert.equal(bad.data.code, 'MISSING_ENERGY');
  } finally { f.close(); }
});

test('web recipe extraction and portion calculations preserve source snapshots', async () => {
  const html = '<html><script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeYield":"4 servings","nutrition":{"calories":"210 kcal","servingSize":"1 bowl"}}</script></html>';
  const f = fixture(async target => {
    assert.equal(String(target), 'https://www.skinnytaste.com/soup/');
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  });
  try {
    const read = await f.call('/api/nutrition/web', { method: 'POST', body: { url: 'https://www.skinnytaste.com/soup/' } });
    assert.equal(read.status, 200);
    const product = read.data.products[0];
    assert.equal(product.kcalPerServing, 210);
    assert.equal(product.servingLabel, '1 bowl');
    const catalogPortion = { provider: 'web', code: product.code, retrievedAt: product.retrievedAt, quantity: 1.5, unit: 'serving', basisConfirmed: true };
    const added = await f.call('/api/calories/entries', { method: 'POST', body: { ...food, catalogPortion } });
    assert.equal(added.status, 201);
    assert.equal(added.data.kcal, 315);
    assert.equal(added.data.nutrition.sourceUrl, 'https://www.skinnytaste.com/soup/');
    assert.equal(added.data.nutrition.basisMethod, 'serving-size');
    const changed = await f.call('/api/calories/entries', { method: 'POST', body: { ...food, operationId: id2, catalogPortion: { ...catalogPortion, retrievedAt: '2000-01-01T00:00:00Z' } } });
    assert.equal(changed.status, 409);
    const unconfirmed = await f.call('/api/calories/entries', { method: 'POST', body: { ...food, operationId: id2, catalogPortion: { ...catalogPortion, basisConfirmed: false } } });
    assert.equal(unconfirmed.status, 400);
    const copied = await f.call('/api/calories/entries', { method: 'POST', body: { operationId: id2, copyEntryId: id, date: food.date, meal: 'dinner' } });
    assert.deepEqual(copied.data.nutrition, added.data.nutrition);
  } finally { f.close(); }
});

test('USDA portions use bundled revision and energy, reject forged revision', async () => {
  const product = { provider: 'usda', code: '171688', name: 'Food USDA', sourceUrl: 'https://fdc.nal.usda.gov/food-details/171688/nutrients', license: 'CC0-1.0', dataset: 'SR Legacy', release: '2018-04', revision: 'a'.repeat(64), energyNutrientId: 1008, sourceUpdatedAt: null, retrievedAt: '2026-11-09T00:00:00Z', kcalPer100: 109 };
  const f = fixture(undefined, [product]);
  try {
    assert.equal((await f.call('/api/nutrition/search?source=usda&q=food')).data.products[0].code, product.code);
    const catalogPortion = { provider: 'usda', code: product.code, revision: product.revision, retrievedAt: product.retrievedAt, quantity: 50, unit: 'g', basisConfirmed: true, kcalPer100: 1 };
    const added = await f.call('/api/calories/entries', { method: 'POST', body: { ...food, catalogPortion } });
    assert.equal(added.status, 201);
    assert.equal(added.data.kcal, 54.5);
    assert.equal(added.data.nutrition.kcalPer100, 109);
    const invalid = await f.call('/api/calories/entries', { method: 'POST', body: { ...food, operationId: id2, catalogPortion: { ...catalogPortion, revision: 'b'.repeat(64) } } });
    assert.equal(invalid.status, 409);
    assert.equal((await f.call('/api/nutrition/catalogs')).data.usda.count, 1);
  } finally { f.close(); }
});

test('goal-only migration is supported and impossible dates never persist', async () => {
  const f = fixture(); try {
    assert.equal((await f.call('/api/calories/import', { method: 'POST', body: { entries: [], goal: 1900 } })).data.goal, 1900);
    assert.equal((await f.call('/api/calories/entries', { method: 'POST', body: { ...food, date: '2026-02-30' } })).status, 400);
    assert.equal((await f.call('/api/calories/day?date=2026-02-30')).status, 400);
    assert.equal((await f.call('/api/calories/export')).data.entries.length, 0);
  } finally { f.close(); }
});
