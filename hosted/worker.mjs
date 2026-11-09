import { handleWorkshop } from './workshop.mjs';
import { assets as bundledAssets } from './assets.generated.mjs';
import { AppError } from '../lib/assistant.mjs';
import { validateNutritionSnapshot } from '../lib/nutrition-validation.mjs';
import { nutritionSourceUrl } from '../lib/web-nutrition-source.mjs';
import { extractWebNutrition } from '../lib/web-nutrition-extract.mjs';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = (status, code, message) => { throw new AppError(status, code, message); };
const normalize = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const goalValue = goal => { if (!(goal === null || Number.isInteger(goal) && goal > 0 && goal <= 20000)) fail(400, 'INVALID_GOAL', 'Objectif entier de 1 à 20 000 kcal, ou null.'); return goal; };
function validateEntry(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) fail(400, 'INVALID_FOOD', 'Aliment requis, 120 caractères maximum.');
  if (!validDate(body.date)) fail(400, 'INVALID_DATE', 'Date invalide.');
  if (!MEALS.includes(body.meal)) fail(400, 'INVALID_MEAL', 'Repas invalide.');
  if (!Number.isFinite(body.kcal) || body.kcal < 0 || body.kcal > 10000 || Math.abs(body.kcal * 10 - Math.round(body.kcal * 10)) > 1e-7) fail(400, 'INVALID_CALORIES', 'Calories entre 0 et 10 000, une décimale maximum.');
  const nutrition = validateNutritionSnapshot(body.nutrition, body.kcal);
  return { name, date: body.date, meal: body.meal, tenths: Math.round(body.kcal * 10), ...(nutrition ? { nutrition } : {}) };
}
function entry(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, date: row.date, meal: row.meal, tenths: row.tenths, kcal: row.tenths / 10,
    version: row.version, createdAt: row.created_at, ...(row.nutrition ? { nutrition: JSON.parse(row.nutrition) } : {}) };
}
async function boundedText(response, limit) {
  const reader = response.body?.getReader(); if (!reader) return '';
  let size = 0; const chunks = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); fail(413, 'TOO_LARGE', 'Contenu trop volumineux.'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
async function readBody(request, limit) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail(415, 'CONTENT_TYPE', 'Le format JSON est requis.');
  let body; try { body = JSON.parse(await boundedText(request, limit)); } catch (error) { if (error instanceof AppError) throw error; fail(400, 'INVALID_JSON', 'JSON invalide.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_BODY', 'Objet JSON requis.');
  return body;
}
const security = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://esm.sh https://cdn.jsdelivr.net; worker-src 'self' blob:; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net https://esm.sh; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'" };
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...security, 'Content-Type': 'application/json; charset=utf-8', ...extra } });

export function createWorker({ assets = bundledAssets, fetchImpl = fetch } = {}) {
  let catalogue;
  function foods() {
    catalogue ??= (() => { const raw = JSON.parse(assets['/catalogue/usda.json']?.body || '{}'); return Array.isArray(raw) ? raw : raw.products || raw.foods || []; })();
    return catalogue;
  }
  return { async fetch(request, env) {
    try {
      const url = new URL(request.url); const path = url.pathname; const method = request.method;
      const owner = request.headers.get('oai-authenticated-user-id');
      if (!owner || owner.length > 512) fail(401, 'UNAUTHORIZED', 'Connecte-toi avec ChatGPT pour accéder à cet espace privé.');
      if (!['GET', 'HEAD'].includes(method) && request.headers.get('origin') !== url.origin) fail(403, 'INVALID_ORIGIN', 'Origine de la demande refusée.');
      if (method === 'GET' && assets[path]) return new Response(assets[path].body, { headers: { ...security, 'Content-Type': assets[path].type } });
      if (method === 'GET' && ['/api/session', '/api/status'].includes(path)) return json({ authenticated: true, passwordConfigured: false, hosted: true, model: 'Navigateur · modèle gratuit', modelReady: false, inference: 'browser' });
      if (method === 'POST' && path === '/api/assist') { await readBody(request, 16384); fail(409, 'CLIENT_MODEL_REQUIRED', 'Le modèle gratuit fonctionne dans le navigateur. Charge-le dans Assistant.'); }
      const db = env.DB;
      if (!db) fail(503, 'STORAGE_UNAVAILABLE', 'Le stockage durable est indisponible.');
      const stmt = (sql, ...args) => db.prepare(sql).bind(...args);
      const rows = async (sql, ...args) => (await stmt(sql, ...args).all()).results;
      const first = (sql, ...args) => stmt(sql, ...args).first();
      const getEntry = async id => entry(await first('SELECT * FROM entries WHERE owner=? AND id=?', owner, id));
      const getGoal = async () => (await first('SELECT goal FROM profiles WHERE owner=?', owner))?.goal ?? null;
      async function reserve(bucket, maximum) {
        const window = Math.floor(Date.now() / 60000);
        const result = await stmt('INSERT INTO request_limits(owner,bucket,window,count) VALUES(?,?,?,1) ON CONFLICT(owner,bucket) DO UPDATE SET window=excluded.window,count=CASE WHEN request_limits.window=excluded.window THEN request_limits.count+1 ELSE 1 END WHERE request_limits.window<>excluded.window OR request_limits.count<?', owner, bucket, window, maximum).run();
        if (!result.meta.changes) fail(429, 'SEARCH_LIMIT', 'Attends une minute avant de rechercher à nouveau.');
      }
      async function upstream(target, type = 'json', limit = 1000000) {
        let response;
        try { response = await fetchImpl(target, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: type === 'json' ? 'application/json' : 'text/html', 'User-Agent': 'AlterEgoDev/0.7 (https://github.com/jajay122/alter-ego-dev)' } }); }
        catch { fail(503, 'SOURCE_OFFLINE', 'La source est momentanément inaccessible.'); }
        if (!response.ok) fail(response.status === 429 ? 429 : 502, 'SOURCE_ERROR', 'La source ne permet pas cette lecture.');
        const text = await boundedText(response, limit);
        if (type !== 'json') { if (!response.headers.get('content-type')?.includes('text/html')) fail(415, 'SOURCE_FORMAT', 'Page HTML requise.'); return text; }
        try { return JSON.parse(text); } catch { fail(502, 'SOURCE_FORMAT', 'Réponse de la source invalide.'); }
      }
      async function cacheProducts(products) {
        if (!products.length) return;
        await db.batch([...products.map(p => stmt('INSERT INTO nutrition_sources(owner,provider,code,data,fetched) VALUES(?,?,?,?,?) ON CONFLICT(owner,provider,code) DO UPDATE SET data=excluded.data,fetched=excluded.fetched', owner, p.provider, p.code, JSON.stringify(p), Date.now())), stmt('DELETE FROM nutrition_sources WHERE owner=? AND rowid NOT IN (SELECT rowid FROM nutrition_sources WHERE owner=? ORDER BY fetched DESC LIMIT 200)', owner, owner)]);
      }
      async function portion(p) {
        if (!p || !['usda', 'openfoodfacts', 'web'].includes(p.provider)) fail(400, 'INVALID_PRODUCT', 'Source invalide.');
        const product = p.provider === 'usda' ? foods().find(f => f.code === p.code) : JSON.parse((await first('SELECT data FROM nutrition_sources WHERE owner=? AND provider=? AND code=?', owner, p.provider, p.code))?.data || 'null');
        if (!product || product.retrievedAt !== p.retrievedAt || p.provider === 'usda' && product.revision !== p.revision || p.provider !== 'usda' && Date.parse(product.retrievedAt) < Date.now() - 14 * 86400000) fail(409, 'PRODUCT_CHANGED', 'Recherche à nouveau cette fiche avant de confirmer.');
        const energy = p.provider === 'web' ? product.kcalPerServing : product.kcalPer100;
        if (!Number.isFinite(energy)) fail(400, 'MISSING_ENERGY', 'Énergie absente de cette fiche.');
        const kcal = Math.round(energy * p.quantity / (p.provider === 'web' ? 1 : 100) * 10) / 10;
        return { name: product.name.slice(0, 120), kcal, nutrition: validateNutritionSnapshot({ ...product, quantity: p.quantity, unit: p.unit, basisConfirmed: p.basisConfirmed }, kcal) };
      }
      const query = () => { const q = url.searchParams.get('q')?.trim(); if (!q || q.length < 2 || q.length > 80 || /\p{C}/u.test(q)) fail(400, 'INVALID_SEARCH', 'Recherche entre 2 et 80 caractères.'); return q; };
      if (method === 'GET' && path === '/api/assistant/search') {
        const q = query(); await reserve('wikipedia', 12);
        const target = new URL('https://fr.wikipedia.org/w/api.php');
        for (const [k, v] of Object.entries({ action: 'query', list: 'search', srsearch: q, srlimit: '5', format: 'json', utf8: '1' })) target.searchParams.set(k, v);
        const data = await upstream(target);
        if (!Array.isArray(data.query?.search)) fail(502, 'SOURCE_FORMAT', 'Recherche encyclopédique invalide.');
        const sources = data.query.search.filter(s => typeof s.title === 'string' && typeof s.snippet === 'string' && Number.isSafeInteger(s.pageid) && s.pageid > 0).slice(0, 5).map(s => ({ title: s.title.slice(0, 200), excerpt: s.snippet.replace(/<[^>]*>/g, '').slice(0, 1500), url: `https://fr.wikipedia.org/?curid=${s.pageid}` }));
        return json({ sources, query: q });
      }
      if (method === 'GET' && path === '/api/nutrition/catalogs') return json({ usda: { count: foods().length, available: foods().length > 0 }, openfoodfacts: { networkConfigured: true } });
      if (method === 'GET' && path === '/api/nutrition/search') {
        const q = query(); const provider = url.searchParams.get('source') || 'openfoodfacts';
        if (provider === 'usda') { const tokens = normalize(q).match(/[\p{L}\p{N}]+/gu)?.slice(0, 6) || []; const products = foods().filter(f => f.code === q || tokens.length && tokens.every(t => normalize(f.name).includes(t))).slice(0, 20); return json({ products, mode: 'local', catalog: { count: foods().length }, warning: 'USDA : noms anglais et valeurs pour 100 g ; vérifie cru/cuit et portion.' }); }
        if (provider !== 'openfoodfacts') fail(400, 'INVALID_PROVIDER', 'Source invalide.');
        if (url.searchParams.get('local') === '1') { const cached = await rows('SELECT data FROM nutrition_sources WHERE owner=? AND provider=? ORDER BY fetched DESC LIMIT 200', owner, provider); return json({ products: cached.map(r => JSON.parse(r.data)).filter(p => normalize(p.name).includes(normalize(q)) || p.code === q).slice(0, 10), mode: 'local', warning: 'Fiches déjà consultées uniquement.' }); }
        const barcode = /^\d+$/.test(q); if (barcode && !/^(?:\d{8}|\d{12,14})$/.test(q)) fail(400, 'INVALID_BARCODE', 'Code-barres invalide.');
        await reserve('off', 8);
        const target = new URL(barcode ? `/api/v3.6/product/${q}.json` : '/cgi/search.pl', 'https://world.openfoodfacts.org');
        target.searchParams.set('fields', 'code,product_name,product_name_fr,brands,nutriments,last_modified_t');
        if (!barcode) for (const [k, v] of Object.entries({ search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '10', lc: 'fr' })) target.searchParams.set(k, v);
        const data = await upstream(target); const numeric = (n, max) => (typeof n === 'number' || typeof n === 'string' && /^\d+(\.\d+)?$/.test(n)) && Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= max ? Number(n) : null;
        const products = (barcode ? [data.product] : Array.isArray(data.products) ? data.products : []).slice(0, 10).filter(p => p && /^(?:\d{8}|\d{12,14})$/.test(p.code) && (!barcode || p.code === q) && typeof (p.product_name_fr || p.product_name) === 'string').map(p => { const n = p.nutriments || {}; const direct = numeric(n['energy-kcal_100g'], 1000); const kj = numeric(n['energy-kj_100g'], 4184) ?? (n.energy_unit === 'kJ' ? numeric(n.energy_100g, 4184) : null); return { provider, code: p.code, name: (p.product_name_fr || p.product_name).trim().slice(0, 120), brand: typeof p.brands === 'string' ? p.brands.slice(0, 120) : '', kcalPer100: direct ?? (kj === null ? null : Math.round(kj / 4.184 * 1000) / 1000), basis: '100g-or-100ml', energyMethod: direct !== null ? 'source-kcal' : kj !== null ? 'converted-kj' : 'missing', sourceUrl: `https://world.openfoodfacts.org/product/${p.code}`, sourceUpdatedAt: Number.isSafeInteger(p.last_modified_t) && p.last_modified_t > 0 && p.last_modified_t < 253402300799 ? new Date(p.last_modified_t * 1000).toISOString() : null, retrievedAt: new Date().toISOString(), license: 'ODbL-1.0' }; }).filter(p => p.name);
        await cacheProducts(products); return json({ products, mode: 'online', warning: null });
      }
      if (method === 'POST' && path === '/api/nutrition/web') { const body = await readBody(request, 2048); const target = nutritionSourceUrl(body.url); await reserve('web-nutrition', 6); const products = await extractWebNutrition(await upstream(target, 'html'), target); await cacheProducts(products); return json({ products, mode: 'web', warning: 'Vérifie la recette et sa portion explicite avant ajout.' }); }
      if (method === 'GET' && path === '/api/calories/day') {
        const date = url.searchParams.get('date'); if (!validDate(date)) fail(400, 'INVALID_DATE', 'Date invalide.');
        const entries = (await rows('SELECT * FROM entries WHERE owner=? AND date=? ORDER BY created_at,id', owner, date)).map(entry);
        return json({ date, entries, total: entries.reduce((s, e) => s + e.tenths, 0) / 10, mealTotals: Object.fromEntries(MEALS.map(m => [m, entries.filter(e => e.meal === m).reduce((s, e) => s + e.tenths, 0) / 10])), goal: await getGoal() });
      }
      if (method === 'GET' && path === '/api/calories/export') return json({ schema: 1, goal: await getGoal(), entries: (await rows('SELECT * FROM entries WHERE owner=? ORDER BY created_at,id', owner)).map(entry) }, 200, { 'Content-Disposition': 'attachment; filename="alter-ego-calories.json"' });
      if (method === 'GET' && path === '/api/calories/favorites') return json({ favorites: (await rows('SELECT * FROM favorites WHERE owner=? ORDER BY created_at,id', owner)).map(r => ({ ...JSON.parse(r.snapshot), id: r.id, createdAt: r.created_at })) });
      const favoritePath = /^\/api\/calories\/favorites\/([a-f0-9-]{36})$/i.exec(path);
      if (method === 'DELETE' && favoritePath) { await readBody(request, 2048); await stmt('DELETE FROM favorites WHERE owner=? AND id=?', owner, favoritePath[1]).run(); return json({ deleted: true }); }
      if (method === 'POST' && path === '/api/calories/favorites') {
        const body = await readBody(request, 2048); if (!UUID.test(body.entryId)) fail(400, 'INVALID_ENTRY', 'Identifiant d’entrée invalide.'); const source = await getEntry(body.entryId); if (!source) fail(404, 'ENTRY_NOT_FOUND', 'Entrée introuvable.');
        const id = source.id; const snapshot = { name: source.name, kcal: source.kcal, tenths: source.tenths, ...(source.nutrition ? { nutrition: source.nutrition } : {}) };
        const existing = await first('SELECT * FROM favorites WHERE owner=? AND id=?', owner, id);
        if (existing) return json({ ...JSON.parse(existing.snapshot), id, createdAt: existing.created_at });
        const createdAt = new Date().toISOString(); const result = await stmt('INSERT OR IGNORE INTO favorites(owner,id,snapshot,created_at) SELECT ?,?,?,? WHERE (SELECT count(*) FROM favorites WHERE owner=?)<200', owner, id, JSON.stringify(snapshot), createdAt, owner).run();
        if (!result.meta.changes) fail(409, 'FAVORITES_FULL', 'Limite de 200 favoris atteinte.'); return json({ ...snapshot, id, createdAt }, 201);
      }
      if (method === 'PUT' && path === '/api/calories/goal') { const body = await readBody(request, 2048); const goal = goalValue(body.goal); await stmt('INSERT INTO profiles(owner,goal) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET goal=excluded.goal', owner, goal).run(); return json({ goal }); }
      const insert = (id, input, createdAt, version = 1) => stmt('INSERT OR IGNORE INTO entries(owner,id,date,meal,name,tenths,nutrition,version,created_at) VALUES(?,?,?,?,?,?,?,?,?)', owner, id, input.date, input.meal, input.name, input.tenths, input.nutrition ? JSON.stringify(input.nutrition) : null, version, createdAt);
      if (method === 'POST' && path === '/api/calories/import') {
        const body = await readBody(request, 2000000);
        if (!Array.isArray(body.entries) || body.entries.length > 100) fail(400, 'IMPORT_LIMIT', 'Importe au maximum 100 entrées par demande.');
        const seen = new Set(); const entries = body.entries.map(e => { if (!e || !UUID.test(e.id) || seen.has(e.id)) fail(400, 'INVALID_IMPORT', 'Identifiants absents, invalides ou dupliqués.'); seen.add(e.id); const input = validateEntry({ ...e, kcal: e.kcal ?? e.tenths / 10 }); return { id: e.id, input, createdAt: typeof e.createdAt === 'string' && Number.isFinite(Date.parse(e.createdAt)) ? e.createdAt : new Date().toISOString() }; });
        if ('goal' in body) goalValue(body.goal);
        for (const e of entries) {
          const existing = await getEntry(e.id);
          if (existing && (Object.entries(e.input).some(([key, value]) => JSON.stringify(existing[key]) !== JSON.stringify(value)) || Boolean(existing.nutrition) !== Boolean(e.input.nutrition))) fail(409, 'IMPORT_CONFLICT', `L’entrée ${e.id} existe avec un contenu différent. Aucun changement dans ce lot.`);
        }
        const count = (await first('SELECT count(*) AS n FROM entries WHERE owner=?', owner)).n;
        const existingIds = new Set((await rows('SELECT id FROM entries WHERE owner=?', owner)).map(e => e.id));
        if (count + entries.filter(e => !existingIds.has(e.id)).length > 20000) fail(409, 'JOURNAL_FULL', 'Ce lot dépasserait la limite de 20 000 entrées.');
        const operations = entries.map(e => insert(e.id, e.input, e.createdAt));
        if ('goal' in body) operations.push(stmt('INSERT OR IGNORE INTO profiles(owner,goal) VALUES(?,?)', owner, body.goal));
        const result = operations.length ? await db.batch(operations) : [];
        const imported = result.slice(0, entries.length).reduce((s, r) => s + r.meta.changes, 0);
        return json({ imported, skipped: entries.length - imported, goal: await getGoal(), limit: 100 });
      }
      const entryPath = /^\/api\/calories\/entries\/([a-f0-9-]{36})$/i.exec(path);
      if (method === 'POST' && path === '/api/calories/entries' || entryPath && ['PUT', 'DELETE'].includes(method)) {
        let body = await readBody(request, 16384);
        if (entryPath && (!Number.isSafeInteger(body.version) || body.version < 1)) fail(400, 'INVALID_VERSION', 'Version de l’entrée invalide.');
        const old = entryPath ? await getEntry(entryPath[1]) : null;
        if (entryPath && method === 'DELETE') { if (!old) return json({ deleted: true }); const result = await stmt('DELETE FROM entries WHERE owner=? AND id=? AND version=?', owner, old.id, body.version ?? -1).run(); if (!result.meta.changes) fail(409, 'VERSION_CONFLICT', 'Entrée modifiée : recharge le journal.'); return json({ deleted: true }); }
        if ('nutrition' in body) fail(400, 'INVALID_NUTRITION', 'Choisis une fiche ou utilise la saisie manuelle.');
        if (body.favoriteId || body.copyEntryId) {
          if (!UUID.test(body.favoriteId || body.copyEntryId)) fail(400, 'INVALID_COPY', 'Identifiant à copier invalide.');
          if (entryPath || body.favoriteId && body.copyEntryId || body.catalogPortion) fail(400, 'INVALID_COPY', 'Choisis une seule source à copier.');
          const source = body.favoriteId ? JSON.parse((await first('SELECT snapshot FROM favorites WHERE owner=? AND id=?', owner, body.favoriteId))?.snapshot || 'null') : await getEntry(body.copyEntryId);
          if (!source) fail(404, 'ENTRY_NOT_FOUND', 'Source à copier introuvable.');
          body = { ...body, name: source.name, kcal: source.kcal, nutrition: source.nutrition };
        } else if (body.catalogPortion) body = { ...body, ...await portion(body.catalogPortion) };
        const input = validateEntry(body);
        if (entryPath) {
          if (!old) fail(404, 'ENTRY_NOT_FOUND', 'Entrée introuvable.');
          if (body.preserveNutrition === true && !input.nutrition && input.name === old.name && input.tenths === old.tenths && old.nutrition) input.nutrition = old.nutrition;
          const result = await stmt('UPDATE entries SET date=?,meal=?,name=?,tenths=?,nutrition=?,version=version+1 WHERE owner=? AND id=? AND version=?', input.date, input.meal, input.name, input.tenths, input.nutrition ? JSON.stringify(input.nutrition) : null, owner, old.id, body.version ?? -1).run();
          if (!result.meta.changes) fail(409, 'VERSION_CONFLICT', 'Entrée modifiée : recharge le journal.'); return json(await getEntry(old.id));
        }
        if (!UUID.test(body.operationId)) fail(400, 'INVALID_OPERATION', 'Identifiant de demande invalide.');
        await insert(body.operationId, input, new Date().toISOString()).run();
        const saved = await getEntry(body.operationId);
        if (!saved) fail(409, 'JOURNAL_FULL', 'Limite de 20 000 entrées atteinte.');
        if (Object.entries(input).some(([k, v]) => JSON.stringify(saved[k]) !== JSON.stringify(v)) || Boolean(saved.nutrition) !== Boolean(input.nutrition)) fail(409, 'OPERATION_CONFLICT', 'Cette demande a déjà été utilisée avec un autre contenu.');
        return json(saved, 201);
      }
      if (path.startsWith('/api/workshop/')) return await handleWorkshop(request, env, { owner, json, readBody, fail, url });
      fail(404, 'NOT_FOUND', 'Page ou action introuvable.');
    } catch (error) { if (/ENTRY_CONTENT_CONFLICT/.test(error.message)) return json({ error: 'Identifiant existant avec un autre contenu ; lot refusé.', code: 'OPERATION_CONFLICT' }, 409); if (/JOURNAL_FULL/.test(error.message)) return json({ error: 'Limite de 20 000 entrées atteinte ; lot refusé.', code: 'JOURNAL_FULL' }, 409); return json({ error: error instanceof AppError ? error.message : 'Une erreur interne est survenue.', code: error instanceof AppError ? error.code : 'INTERNAL_ERROR' }, error instanceof AppError ? error.status : 500); }
  } };
}
export default createWorker();
