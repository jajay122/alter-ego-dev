import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCalorieStore, validateEntry, validDate } from '../lib/calories.mjs';
import { createApp } from '../server.mjs';

const password = 'calorie-test-password-only';
const entry = overrides => ({ operationId: randomUUID(), date: '2026-11-07', name: 'Yaourt', kcal: 125, meal: 'breakfast', ...overrides });
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'alter-ego-calories-'));
  t.after(() => rm(dir, { force: true, recursive: true }));
  return dir;
}
async function app(t, dataDir) {
  let modelCalls = 0;
  const server = createApp({ config: { password, origin: '', model: 'test', modelUrl: 'http://127.0.0.1:8081', dataDir }, fetchImpl: async () => { modelCalls++; throw new Error('No AI needed'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  async function req(path, method = 'GET', body, headers = {}) {
    return fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: base }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function login() {
    const r = await req('/api/login', 'POST', { password }); assert.equal(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
  }
  return { req, login, server, get modelCalls() { return modelCalls; } };
}

test('le journal démarre vide sans objectif inventé et sépare les journées', async t => {
  const store = createCalorieStore(await directory(t));
  assert.deepEqual(await store.day('2026-11-07'), { date: '2026-11-07', entries: [], total: 0, goal: null, mealTotals: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 } });
  await store.add(entry());
  await store.add(entry({ date: '2026-11-08', kcal: 900 }));
  assert.equal((await store.day('2026-11-07')).total, 125);
  assert.equal((await store.day('2026-11-08')).total, 900);
});

test('les sommes décimales et totaux par repas restent exacts', async t => {
  const store = createCalorieStore(await directory(t));
  for (const [kcal, meal] of [[0.1, 'breakfast'], [0.2, 'breakfast'], [10.5, 'lunch'], [0, 'snack']]) await store.add(entry({ kcal, meal }));
  const day = await store.day('2026-11-07');
  assert.equal(day.total, 10.8);
  assert.equal(day.mealTotals.breakfast, 0.3);
  assert.equal(day.mealTotals.lunch, 10.5);
});

test('un ajout rejoué après perte de réponse ne crée pas un doublon', async t => {
  const store = createCalorieStore(await directory(t));
  const food = entry();
  const [first, second] = await Promise.all([store.add(food), store.add(food)]);
  assert.equal(first.id, second.id);
  assert.equal((await store.day(food.date)).entries.length, 1);
  await assert.rejects(store.add({ ...food, kcal: 999 }), { code: 'OPERATION_CONFLICT' });
});

test('des écritures concurrentes dans un seul processus ne perdent pas d’entrées', async t => {
  const store = createCalorieStore(await directory(t));
  await Promise.all(Array.from({ length: 12 }, (_, i) => store.add(entry({ name: `Aliment de test ${i}`, kcal: i }))));
  const day = await store.day('2026-11-07');
  assert.equal(day.entries.length, 12);
  assert.equal(day.total, 66);
});

test('modifier et supprimer vérifient la version pour éviter d’écraser un autre onglet', async t => {
  const store = createCalorieStore(await directory(t));
  const food = entry(); const saved = await store.add(food);
  const updated = await store.update(saved.id, { ...food, kcal: 150, version: 1 });
  assert.equal(updated.version, 2);
  await assert.rejects(store.update(saved.id, { ...food, kcal: 300, version: 1 }), { code: 'VERSION_CONFLICT' });
  await assert.rejects(store.remove(saved.id, 1), { code: 'VERSION_CONFLICT' });
  assert.equal((await store.day(food.date)).total, 150);
  await store.remove(saved.id, 2);
  assert.equal((await store.day(food.date)).total, 0);
});

test('le journal et le repère quotidien persistent dans un nouveau magasin', async t => {
  const dir = await directory(t); const store = createCalorieStore(dir);
  await store.add(entry()); await store.setGoal(1500);
  const reopened = createCalorieStore(dir);
  assert.equal((await reopened.day('2026-11-07')).total, 125);
  assert.equal((await reopened.day('2026-11-07')).goal, 1500);
  await reopened.setGoal(null);
  assert.equal((await reopened.day('2026-11-07')).goal, null);
  assert.equal((await stat(join(dir, 'calories.json'))).mode & 0o777, 0o600);
});

test('un fichier corrompu est signalé et jamais remplacé par un journal vide', async t => {
  const dir = await directory(t); const data = 'fichier volontairement corrompu pour ce test';
  await writeFile(join(dir, 'calories.json'), data);
  const store = createCalorieStore(dir);
  await assert.rejects(store.snapshot(), { code: 'STORAGE_UNAVAILABLE' });
  await assert.rejects(store.add(entry()), { code: 'STORAGE_UNAVAILABLE' });
  assert.equal(await readFile(join(dir, 'calories.json'), 'utf8'), data);
});

test('les entrées et dates invalides sont refusées avant stockage', async t => {
  assert.equal(validDate('2024-02-29'), true);
  for (const date of ['2023-02-29', '2026-02-30', '07/11/2026', null]) assert.equal(validDate(date), false);
  for (const patch of [{ name: ' ' }, { meal: 'invalid' }, { kcal: -1 }, { kcal: 1.234 }, { kcal: '125' }, { kcal: null }, { kcal: Infinity }]) assert.throws(() => validateEntry(entry(patch)));
  const store = createCalorieStore(await directory(t));
  assert.throws(() => store.setGoal(0), { code: 'INVALID_GOAL' });
  assert.throws(() => store.setGoal(-1), { code: 'INVALID_GOAL' });
  assert.throws(() => store.add(entry({ operationId: '../private' })), { code: 'INVALID_OPERATION' });
});

test('les API de journal, de modification et d’export exigent une session', async t => {
  const h = await app(t, await directory(t));
  for (const path of ['/api/calories/day?date=2026-11-07', '/api/calories/export']) assert.equal((await h.req(path)).status, 401);
  assert.equal((await h.req('/api/calories/entries', 'POST', entry())).status, 401);
  assert.equal((await h.req('/api/calories/goal', 'PUT', { goal: 1500 })).status, 401);
  await h.login();
  assert.equal((await h.req('/api/calories/entries', 'POST', entry(), { Origin: 'https://other.example' })).status, 403);
});

test('le parcours HTTP complet fonctionne sans aucun appel au modèle', async t => {
  const h = await app(t, await directory(t)); await h.login();
  let r = await h.req('/api/calories/entries', 'POST', entry()); assert.equal(r.status, 201);
  const food = await r.json();
  r = await h.req(`/api/calories/entries/${food.id}`, 'PUT', { ...entry(), kcal: 140, version: 1 }); assert.equal(r.status, 200);
  await h.req('/api/calories/goal', 'PUT', { goal: 1500 });
  r = await h.req('/api/calories/day?date=2026-11-07'); assert.equal(r.status, 200);
  const day = await r.json(); assert.equal(day.total, 140); assert.equal(day.goal, 1500);
  r = await h.req('/api/calories/export'); assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /attachment/);
  assert.equal((await r.json()).entries.length, 1);
  r = await h.req(`/api/calories/entries/${food.id}`, 'DELETE', { version: 2 }); assert.equal(r.status, 200);
  assert.equal((await (await h.req('/api/calories/day?date=2026-11-07')).json()).total, 0);
  assert.equal(h.modelCalls, 0);
});

test('le stockage inaccessible ne produit pas de fausse confirmation', async t => {
  const dir = await directory(t); await writeFile(join(dir, 'not-a-directory'), 'untouched');
  const h = await app(t, join(dir, 'not-a-directory')); await h.login();
  const r = await h.req('/api/calories/entries', 'POST', entry());
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'STORAGE_UNAVAILABLE');
  assert.equal(await readFile(join(dir, 'not-a-directory'), 'utf8'), 'untouched');
});

test('une nouvelle instance de serveur conserve le journal mais refuse l’ancienne session', async t => {
  const dir = await directory(t); const first = await app(t, dir); await first.login();
  await first.req('/api/calories/entries', 'POST', entry());
  await new Promise(resolve => { first.server.closeAllConnections(); first.server.close(resolve); });
  const second = await app(t, dir);
  assert.equal((await second.req('/api/calories/day?date=2026-11-07')).status, 401);
  await second.login();
  assert.equal((await (await second.req('/api/calories/day?date=2026-11-07')).json()).total, 125);
});
