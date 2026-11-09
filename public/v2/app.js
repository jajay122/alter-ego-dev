import { mountCalories } from './calories.js';
import { mountAssistant } from './ai.js';
import { mountWorkshop } from './workshop.js';

const routes = {
  '/': { label: 'Accueil', subtitle: 'Vue d’ensemble', icon: 'home', title: 'Votre espace personnel' },
  '/calories': { label: 'Nutrition', subtitle: 'Suivi nutritionnel', icon: 'nutrition', title: 'Votre journal nutritionnel', mount: mountCalories },
  '/assistant': { label: 'Assistant', subtitle: 'Assistant personnel', icon: 'assistant', title: 'Votre assistant', mount: mountAssistant },
  '/atelier': { label: 'Atelier', subtitle: 'Créateur d’applications', icon: 'workshop', title: 'Votre atelier', mount: mountWorkshop },
};
const symbols = {
  home: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  nutrition: '<path d="M12 21c-7-4-10-10-7-13 2-2 5-1 7 1 2-2 5-3 7-1 3 3 0 9-7 13Z"/><path d="M12 9c-1-4 1-6 4-6"/>',
  assistant: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  workshop: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M8 5V3m8 2V3m-4 10v4m-2-2h4"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.home}</svg>`; }
const main = document.querySelector('#main');
let dispose;
let pageController;
let currentPath;
let sessionController;
let toastTimer;

export async function api(path, { method = 'GET', body, signal } = {}) {
  if (typeof path !== 'string' || !path.startsWith('/api/')) throw new Error('Adresse API non valide.');
  let response;
  try {
    response = await fetch(path, { method, signal, credentials: 'same-origin', headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    const failure = new Error('Connexion impossible. Vérifiez votre réseau et réessayez.'); failure.code = 'NETWORK_ERROR'; failure.status = 0; throw failure;
  }
  let data;
  try { data = response.status === 204 ? {} : await response.json(); }
  catch { const failure = new Error('La réponse du serveur est illisible. Réessayez.'); failure.code = 'INVALID_RESPONSE'; failure.status = response.status; throw failure; }
  if (!response.ok) {
    const detail = typeof data?.error === 'object' ? data.error : data;
    const failure = new Error(detail?.message || (typeof data?.error === 'string' ? data.error : 'Cette action n’a pas abouti. Réessayez.'));
    failure.status = response.status; failure.code = detail?.code || `HTTP_${response.status}`;
    if (response.status === 401) showSignedOut();
    throw failure;
  }
  return data;
}
function signInPath() { return `/signin-with-chatgpt?return_to=${encodeURIComponent(location.pathname + location.search)}`; }
function showSignedOut() {
  const state = document.querySelector('#session-state');
  const link = document.createElement('a'); link.href = signInPath(); link.target = '_top'; link.textContent = 'Se connecter avec ChatGPT';
  state.replaceChildren(link); state.classList.remove('is-connected');
}
async function refreshSession() {
  sessionController?.abort(); sessionController = new AbortController();
  try {
    const session = await api('/api/session', { signal: sessionController.signal });
    if (!session.authenticated) { showSignedOut(); return; }
    const state = document.querySelector('#session-state'); state.textContent = 'Connecté avec ChatGPT'; state.classList.add('is-connected');
  } catch (error) {
    if (error.name === 'AbortError' || error.status === 401) return;
    const state = document.querySelector('#session-state');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'session-retry'; button.textContent = 'Connexion à vérifier ↻'; button.addEventListener('click', refreshSession); state.replaceChildren(button);
  }
}
export function toast(message, type = 'info') {
  clearTimeout(toastTimer); const region = document.querySelector('#toast-region');
  region.textContent = String(message); region.className = `toast-region is-visible ${type === 'error' ? 'toast-error' : ''}`;
  toastTimer = setTimeout(() => { region.className = 'toast-region'; region.textContent = ''; }, 6000);
}
function renderNavigation() {
  const links = Object.entries(routes).map(([path, route]) => `<a href="${path}" data-nav${path === currentPath ? ' aria-current="page"' : ''}>${icon(route.icon)}<span>${route.label}</span>${path === currentPath ? '<span class="nav-dot" aria-hidden="true"></span>' : ''}</a>`).join('');
  document.querySelector('.desktop-nav').innerHTML = links; document.querySelector('.mobile-nav').innerHTML = links;
}
function dateLocale() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function mountHome(signal) {
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  main.innerHTML = `<section class="home-hero" aria-labelledby="home-title"><div class="hero-copy"><p class="eyebrow">VOTRE QUOTIDIEN, AUGMENTÉ</p><h1 id="home-title">Un peu plus vous.<br><span>Un peu plus loin.</span></h1><p class="hero-description">Un journal pour prendre soin de vous. Un assistant pour avancer. Un atelier pour donner vie à vos idées.</p><a class="button button-dark" href="/atelier" data-nav>Donner vie à une idée <span aria-hidden="true">↗</span></a></div><div class="hero-emblem" aria-hidden="true"><span class="emblem-orbit"></span><span class="emblem-orbit orbit-two"></span><span class="emblem-letter">ae<span>↗</span></span><span class="emblem-caption">À VOTRE IMAGE.</span></div></section>
    <section class="apps-section" aria-labelledby="apps-title"><div class="section-heading"><div><p class="eyebrow">FAITES PLACE À L’ESSENTIEL</p><h2 id="apps-title">Vos applications</h2></div><span class="chip">3 espaces, un seul endroit</span></div><div class="app-grid">
    <a class="app-card nutrition-card" href="/calories" data-nav><div class="app-card-top"><span class="app-icon">${icon('nutrition')}</span><span class="card-index">01 / QUOTIDIEN</span><span class="card-arrow" aria-hidden="true">↗</span></div><h3>Suivi nutritionnel</h3><p>Vos repas, vos portions et vos repères. Un journal qui suit votre rythme.</p><div class="app-card-bottom"><span class="module-state" id="home-day-state">Ouvrir mon journal</span><span aria-hidden="true">→</span></div></a>
    <a class="app-card assistant-card" href="/assistant" data-nav><div class="app-card-top"><span class="app-icon">${icon('assistant')}</span><span class="card-index">02 / INSPIRATION</span><span class="card-arrow" aria-hidden="true">↗</span></div><h3>Assistant personnel</h3><p>Une question, un document, une idée à clarifier. Prenez le temps d’échanger.</p><div class="app-card-bottom"><span>Commencer une conversation</span><span aria-hidden="true">→</span></div></a>
    <a class="app-card workshop-card" href="/atelier" data-nav><div class="app-card-top"><span class="app-icon">${icon('workshop')}</span><span class="card-index">03 / CRÉATION</span><span class="card-arrow" aria-hidden="true">↗</span></div><h3>Atelier d’applications</h3><p>Transformez une envie en projet. Imaginez et construisez vos propres outils.</p><div class="app-card-bottom"><span>Explorer mon atelier</span><span aria-hidden="true">→</span></div></a></div></section>
    <section class="today-strip" aria-label="Votre espace aujourd’hui"><div class="today-title"><span class="today-dot" aria-hidden="true"></span><div><p class="eyebrow">AUJOURD’HUI</p><p class="today-date"></p></div></div><p>Votre prochain pas commence ici.</p><a href="/calories" data-nav class="text-link" id="home-catalog-state">Retrouver mes repères <span aria-hidden="true">→</span></a></section>`;
  main.querySelector('.today-date').textContent = date;
  api(`/api/calories/day?date=${encodeURIComponent(dateLocale())}`, { signal }).then(day => {
    const state = document.querySelector('#home-day-state'); if (!state || signal.aborted) return;
    if (Array.isArray(day.entries)) state.textContent = day.entries.length ? `${day.entries.length} ${day.entries.length > 1 ? 'entrées' : 'entrée'} aujourd’hui${Number.isFinite(day.total) ? ` · ${new Intl.NumberFormat('fr-FR').format(day.total)} kcal` : ''}` : 'Ajouter mon premier repas du jour';
  }).catch(() => {});
  api('/api/nutrition/catalogs', { signal }).then(data => {
    const state = document.querySelector('#home-catalog-state');
    if (!state || signal.aborted) return;
    if (data.usda?.available && Number.isInteger(data.usda.count) && data.usda.count > 0) state.textContent = `${new Intl.NumberFormat('fr-FR').format(data.usda.count)} aliments USDA à explorer →`;
    else if (data.openfoodfacts?.networkConfigured) state.textContent = 'Explorer Open Food Facts →';
  }).catch(() => {});
}
function render({ focus = false } = {}) {
  dispose?.(); dispose = undefined; pageController?.abort(); pageController = new AbortController();
  currentPath = location.pathname.replace(/\/$/, '') || '/'; const route = routes[currentPath];
  renderNavigation();
  document.querySelector('#location-label').textContent = route?.subtitle || 'Page introuvable';
  document.title = `${route?.title || 'Page introuvable'} — ALTER EGO`;
  main.replaceChildren();
  if (!route) main.innerHTML = '<section class="empty-state"><p class="eyebrow">404</p><h1>Ce chemin ne mène nulle part.</h1><p>Retrouvez vos applications depuis votre espace personnel.</p><a class="button button-primary" href="/" data-nav>Revenir à l’accueil</a></section>';
  else if (route.mount) {
    try { dispose = route.mount({ root: main, api, toast }); }
    catch { main.innerHTML = '<section class="empty-state"><h1>Cette application n’a pas pu s’ouvrir.</h1><p>Rechargez la page pour réessayer.</p><button class="button button-primary" type="button" id="retry-module">Réessayer</button></section>'; main.querySelector('#retry-module').addEventListener('click', () => render()); }
  } else mountHome(pageController.signal);
  if (focus) { main.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
}
document.addEventListener('click', event => {
  const anchor = event.target.closest?.('a[data-nav]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute('download')) return;
  const url = new URL(anchor.href); if (url.origin !== location.origin) return;
  event.preventDefault(); if (url.pathname !== location.pathname || url.search !== location.search) history.pushState({}, '', url.pathname + url.search + url.hash);
  render({ focus: true });
});
window.addEventListener('popstate', () => render({ focus: true }));
render(); refreshSession();
