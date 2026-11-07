import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError, askLocalModel, modelHealth, validateInput } from './lib/assistant.mjs';
import { createCalorieStore } from './lib/calories.mjs';
import { createNutritionCatalog } from './lib/nutrition.mjs';
import { validateFoodPhoto, foodCandidates } from './lib/food-photo.mjs';

const staticFiles = new Map([
  ['/', ['portal.html', 'text/html; charset=utf-8']],
  ['/portal.css', ['portal.css', 'text/css; charset=utf-8']],
  ['/portal.js', ['portal.js', 'text/javascript; charset=utf-8']],
  ['/calories', ['calories.html', 'text/html; charset=utf-8']],
  ['/assistant', ['index.html', 'text/html; charset=utf-8']],
  ['/calories.js', ['calories.js', 'text/javascript; charset=utf-8']],
  ['/food-photo.js', ['food-photo.js', 'text/javascript; charset=utf-8']],
  ['/calories.css', ['calories.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
]);
const digest = value => createHash('sha256').update(value).digest();

export function readConfig(env = process.env) {
  return {
    modelUrl: env.MODEL_URL || 'http://127.0.0.1:8081',
    model: 'SmolVLM-256M',
    password: env.ASSISTANT_PASSWORD || '',
    origin: env.PUBLIC_ORIGIN || '',
    host: env.HOST || '127.0.0.1',
    port: Number(env.PORT || 3000),
    dataDir: env.CALORIES_DATA_DIR || fileURLToPath(new URL('./.data/', import.meta.url)),
  };
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let rejected = false;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        if (!rejected) reject(new AppError(413, 'TOO_LARGE', 'La demande dépasse la taille autorisée.'));
        rejected = true;
        chunks.length = 0;
      } else if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new AppError(400, 'INVALID_JSON', 'La demande est illisible.')); }
    });
    req.on('error', () => reject(new AppError(400, 'REQUEST_ERROR', 'La demande a été interrompue.')));
  });
}

export function createApp({ config = readConfig(), fetchImpl = fetch } = {}) {
  const calorieStore = createCalorieStore(config.dataDir || fileURLToPath(new URL('./.data/', import.meta.url)));
  const nutritionCatalog = createNutritionCatalog(config.dataDir || fileURLToPath(new URL('./.data/', import.meta.url)), { fetchImpl });
  const sessions = new Map();
  const loginAttempts = new Map();
  const calls = [];
  let busy = false;
  const secure = config.origin.startsWith('https://');
  const cookieName = secure ? '__Host-alter_session' : 'alter_session';
  const sessionLifetime = 60 * 60 * 1000;
  const sessionCookie = (value, maxAge) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'");
    const json = (status, value) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, 'http://local.invalid');
      const path = url.pathname;
      const now = Date.now();
      for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
      for (const [key, value] of loginAttempts) if (value.reset < now) loginAttempts.delete(key);
      const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      const session = token ? sessions.get(token) : null;

      if (req.method === 'GET' && staticFiles.has(path)) {
        const [file, type] = staticFiles.get(path);
        const content = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type });
        return res.end(content);
      }
      if (req.method === 'GET' && path === '/api/status') {
        return json(200, { authenticated: Boolean(session), passwordConfigured: config.password.length >= 12,
          modelReady: session ? await modelHealth(config, fetchImpl) : null, model: config.model });
      }
      if (req.method === 'GET' && path === '/api/session') {
        return json(200, { authenticated: Boolean(session), passwordConfigured: config.password.length >= 12 });
      }
      if (req.method === 'GET' && ['/api/calories/day', '/api/calories/export'].includes(path)) {
        if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Connecte-toi pour accéder à ton journal.');
        if (path === '/api/calories/export') {
          res.setHeader('Content-Disposition', 'attachment; filename="alter-ego-calories.json"');
          return json(200, await calorieStore.snapshot());
        }
        return json(200, await calorieStore.day(url.searchParams.get('date')));
      }
      if (req.method === 'GET' && path === '/api/nutrition/search') {
        if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Connecte-toi pour rechercher un aliment.');
        return json(200, await nutritionCatalog.search(url.searchParams.get('q'), { localOnly: url.searchParams.get('local') === '1' }));
      }
      const entryPath = /^\/api\/calories\/entries\/([a-f0-9-]{36})$/i.exec(path);
      const calorieMutation = (path === '/api/calories/entries' && req.method === 'POST')
        || (path === '/api/calories/goal' && req.method === 'PUT')
        || (entryPath && ['PUT', 'DELETE'].includes(req.method));
      if (!calorieMutation && (req.method !== 'POST' || !['/api/login', '/api/logout', '/api/assist', '/api/nutrition/photo'].includes(path))) {
        throw new AppError(404, 'NOT_FOUND', 'Cette page n’existe pas.');
      }
      const origin = config.origin || `http://${req.headers.host}`;
      if (req.headers.origin !== origin) throw new AppError(403, 'INVALID_ORIGIN', 'Origine de la demande refusée.');
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        throw new AppError(415, 'CONTENT_TYPE', 'Le format JSON est requis.');
      }
      if (path === '/api/login') {
        if (config.password.length < 12) throw new AppError(503, 'PASSWORD_REQUIRED', 'Un mot de passe privé d’au moins 12 caractères doit être configuré côté serveur.');
        const ip = req.socket.remoteAddress;
        const limit = loginAttempts.get(ip) || { count: 0, reset: now + 10 * 60_000 };
        if (limit.count >= 10) throw new AppError(429, 'LOGIN_LIMIT', 'Trop de tentatives. Attends dix minutes.');
        if (loginAttempts.size >= 1000 && !loginAttempts.has(ip)) throw new AppError(429, 'LOGIN_LIMIT', 'Réessaie plus tard.');
        limit.count += 1;
        loginAttempts.set(ip, limit);
        const body = await readJson(req, 2048);
        if (typeof body?.password !== 'string' || !timingSafeEqual(digest(body.password), digest(config.password))) {
          throw new AppError(401, 'WRONG_PASSWORD', 'Le mot de passe est incorrect.');
        }
        loginAttempts.delete(ip);
        if (sessions.size >= 20) sessions.delete(sessions.keys().next().value);
        const id = randomBytes(32).toString('hex');
        sessions.set(id, { expires: now + sessionLifetime });
        res.setHeader('Set-Cookie', sessionCookie(id, sessionLifetime / 1000));
        return json(200, { authenticated: true });
      }
      if (!session) throw new AppError(401, 'UNAUTHORIZED', 'Connecte-toi pour accéder à ton espace.');
      if (path === '/api/logout') {
        sessions.delete(token);
        res.setHeader('Set-Cookie', sessionCookie('', 0));
        return json(200, { authenticated: false });
      }
      if (calorieMutation) {
        const body = await readJson(req, 4096);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, 'INVALID_ENTRY', 'Le format de cette entrée est invalide.');
        if ('nutrition' in body) throw new AppError(400, 'INVALID_NUTRITION', 'Choisis une fiche dans la recherche ou utilise la saisie manuelle.');
        if (body.catalogPortion && (path === '/api/calories/entries' || (entryPath && req.method === 'PUT'))) Object.assign(body, await nutritionCatalog.portion(body.catalogPortion));
        if (path === '/api/calories/entries') return json(201, await calorieStore.add(body));
        if (path === '/api/calories/goal') return json(200, await calorieStore.setGoal(body.goal));
        if (req.method === 'PUT') return json(200, await calorieStore.update(entryPath[1], body));
        return json(200, await calorieStore.remove(entryPath[1], body.version));
      }
      if (busy) throw new AppError(429, 'BUSY', 'Une tâche est déjà en cours. Attends sa fin.');
      const photoSearch = path === '/api/nutrition/photo';
      const body = await readJson(req, 4_300_000);
      const input = photoSearch ? validateFoodPhoto(body) : validateInput(body);
      while (calls.length && calls[0] < now - 60 * 60_000) calls.shift();
      if (calls.length >= 20) throw new AppError(429, 'LOCAL_LIMIT', 'La limite locale de 20 demandes par heure est atteinte.');
      // Cette seconde vérification couvre deux requêtes ayant lu leur corps simultanément.
      if (busy) throw new AppError(429, 'BUSY', 'Une tâche est déjà en cours. Attends sa fin.');
      busy = true;
      const abort = new AbortController();
      res.on('close', () => { if (!res.writableEnded) abort.abort(); });
      try {
        calls.push(Date.now());
        const result = await askLocalModel(input, config, fetchImpl, abort.signal);
        if (photoSearch) return json(200, { candidates: foodCandidates(result.answer, result.truncated), truncated: result.truncated });
        return json(200, { answer: result.answer, sources: result.sources, truncated: result.truncated });
      } finally { busy = false; }
    } catch (error) {
      const known = error instanceof AppError;
      json(known ? error.status : 500, { error: known ? error.message : 'Une erreur interne est survenue.', code: known ? error.code : 'INTERNAL_ERROR' });
    }
  });
  server.requestTimeout = 70_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  const config = readConfig();
  if (config.host !== '127.0.0.1' && (!config.origin.startsWith('https://') || config.password.length < 12)) {
    console.error('Un accès distant exige PUBLIC_ORIGIN en HTTPS et ASSISTANT_PASSWORD (12 caractères minimum).');
    process.exitCode = 1;
  } else {
    const server = createApp({ config });
    server.listen(config.port, config.host, () => console.log(`ALTER EGO prêt sur http://${config.host}:${config.port} — aucun secret affiché.`));
    server.on('error', () => { console.error('Impossible de démarrer le serveur sur cette adresse.'); process.exitCode = 1; });
  }
}
