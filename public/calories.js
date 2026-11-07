import { createFoodPhoto } from './food-photo.js';
const $ = id => document.getElementById(id);
const meals = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Collation' };
const symbols = { breakfast: '☀', lunch: '◒', dinner: '☾', snack: '✳' };
const number = value => Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
let dayData;
let draft;
let deleting;
let busy = false;
let loadId = 0;
let loadController;
let selectedProduct;
let searchController;
let searchId = 0;

const foodPhoto = createFoodPhoto({ request, onCandidate(candidate) {
  resetSearch({ keepPhoto: true });
  $('photo-panel').open = false;
  $('food-name').value = ''; $('food-kcal').value = '';
  if (draft) draft.preserveNutrition = false;
  $('food-query').value = candidate;
  $('search-status').textContent = 'Vérifiez ou corrigez ce nom, puis appuyez sur Rechercher. Aucun aliment n’a été ajouté.';
  $('food-query').focus();
} });

function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function prettyDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function session(authenticated) {
  $('journal').hidden = !authenticated;
  $('login-panel').hidden = authenticated;
  $('logout').hidden = !authenticated;
  if (!authenticated) {
    resetSearch();
    loadController?.abort();
    loadId++;
    dayData = undefined;
    $('food-list').replaceChildren();
    $('total').textContent = '—';
    $('entry-count').textContent = '—';
    $('goal-progress').hidden = true;
    $('summary-detail').textContent = '';
    $('goal-label').textContent = '';
    for (const meal of Object.keys(meals)) $(`meal-${meal}`).textContent = '—';
    for (const id of ['food-dialog', 'goal-dialog', 'delete-dialog']) if ($(id).open) $(id).close();
    $('food-form').reset();
    $('goal-form').reset();
    $('delete-name').textContent = '';
    draft = deleting = undefined;
  }
}
async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, { method, signal, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) session(false);
    const error = new Error(data.error || 'Impossible de joindre le journal.');
    error.code = data.code;
    throw error;
  }
  return data;
}
function setBusy(value) {
  busy = value;
  foodPhoto.setLocked(value);
  for (const id of ['day', 'previous-day', 'next-day', 'today', 'add-food', 'first-food', 'set-goal', 'reload', 'export', 'save-food', 'save-goal', 'confirm-delete', 'close-food', 'cancel-food', 'close-goal', 'cancel-goal', 'cancel-delete']) $(id).disabled = value;
  document.querySelectorAll('#food-form input, #food-form select, #goal-form input, .row-actions button').forEach(el => { el.disabled = value; });
}
function render(data) {
  dayData = data;
  $('total').textContent = number(data.total);
  $('summary-detail').textContent = `Suivi du ${prettyDate(data.date)}.`;
  $('entry-count').textContent = `${data.entries.length} entrée${data.entries.length > 1 ? 's' : ''}`;
  for (const meal of Object.keys(meals)) $(`meal-${meal}`).textContent = number(data.mealTotals[meal]);
  $('goal-label').textContent = data.goal === null ? 'Aucun objectif défini' : `Repère personnel : ${number(data.goal)} kcal`;
  $('set-goal').textContent = data.goal === null ? 'Définir un objectif' : 'Modifier mon objectif';
  $('goal-progress').hidden = data.goal === null;
  if (data.goal !== null) {
    $('goal-progress').max = data.goal;
    $('goal-progress').value = Math.min(data.total, data.goal);
    $('goal-progress').setAttribute('aria-valuetext', `${number(data.total)} kcal enregistrées, objectif personnel ${number(data.goal)} kcal`);
  }
  $('food-list').replaceChildren();
  $('empty-state').hidden = data.entries.length > 0;
  for (const entry of [...data.entries].reverse()) {
    const row = document.createElement('li'); row.className = 'food-row';
    const icon = document.createElement('span'); icon.className = 'food-icon'; icon.textContent = symbols[entry.meal]; icon.setAttribute('aria-hidden', 'true');
    const info = document.createElement('div'); info.className = 'food-info';
    const title = document.createElement('h3'); title.textContent = entry.name;
    const meal = document.createElement('p'); meal.textContent = meals[entry.meal];
    info.append(title, meal);
    if (entry.nutrition) {
      const source = document.createElement('a');
      source.className = 'entry-source'; source.href = entry.nutrition.sourceUrl; source.target = '_blank'; source.rel = 'noopener noreferrer';
      source.textContent = `${number(entry.nutrition.quantity)} ${entry.nutrition.unit} · Open Food Facts (ODbL)`;
      info.append(source);
    }
    const energy = document.createElement('span'); energy.className = 'food-energy'; energy.textContent = number(entry.kcal);
    const unit = document.createElement('small'); unit.textContent = 'kcal'; energy.append(unit);
    const actions = document.createElement('div'); actions.className = 'row-actions';
    const edit = document.createElement('button'); edit.textContent = 'Modifier'; edit.setAttribute('aria-label', `Modifier ${entry.name}`); edit.addEventListener('click', () => openFood(entry));
    const remove = document.createElement('button'); remove.textContent = 'Supprimer'; remove.setAttribute('aria-label', `Supprimer ${entry.name}`); remove.addEventListener('click', () => {
      deleting = entry;
      $('delete-name').textContent = entry.name;
      $('delete-error').textContent = '';
      $('delete-dialog').showModal();
      $('cancel-delete').focus();
    });
    actions.append(edit, remove); row.append(icon, info, energy, actions); $('food-list').append(row);
  }
}
async function loadDay() {
  const id = ++loadId;
  loadController?.abort();
  loadController = new AbortController();
  $('journal').setAttribute('aria-busy', 'true');
  try {
    const data = await request(`/api/calories/day?date=${encodeURIComponent($('day').value)}`, { signal: loadController.signal });
    if (id !== loadId) return;
    render(data);
  } catch (error) {
    if (error.name === 'AbortError' || id !== loadId) return;
    dayData = undefined;
    $('total').textContent = '—';
    $('summary-detail').textContent = 'Données indisponibles. Essayez d’actualiser.';
    $('entry-count').textContent = '—';
    $('food-list').replaceChildren();
    $('empty-state').hidden = true;
    $('goal-progress').hidden = true;
    for (const meal of Object.keys(meals)) $(`meal-${meal}`).textContent = '—';
    status(error.message, true);
  } finally { if (id === loadId) $('journal').setAttribute('aria-busy', 'false'); }
}
function changeDay(offset) {
  const date = new Date(`${$('day').value}T12:00:00`);
  date.setDate(date.getDate() + offset);
  $('day').value = localDate(date);
  status(''); loadDay();
}
function openFood(entry) {
  if (busy) return;
  resetSearch();
  draft = entry ? { id: entry.id, version: entry.version, date: entry.date, preserveNutrition: Boolean(entry.nutrition) } : { id: crypto.randomUUID(), date: $('day').value, isNew: true };
  $('food-dialog-title').textContent = entry ? 'Modifier une entrée' : 'Ajouter un aliment';
  $('entry-date').textContent = prettyDate(draft.date);
  $('food-name').value = entry?.name || '';
  $('food-kcal').value = entry?.kcal ?? '';
  $('food-meal').value = entry?.meal || 'breakfast';
  $('food-error').textContent = '';
  if (entry?.nutrition) $('search-status').textContent = 'La source sera conservée si le nom et les calories restent inchangés. Pour changer la portion, recherchez le produit.';
  $('food-dialog').showModal();
  $('food-name').focus();
}

$('day').value = localDate();
$('previous-day').addEventListener('click', () => changeDay(-1));
$('next-day').addEventListener('click', () => changeDay(1));
$('day').addEventListener('change', () => { status(''); loadDay(); });
$('today').addEventListener('click', () => { $('day').value = localDate(); status(''); loadDay(); });
$('reload').addEventListener('click', () => { status(''); loadDay(); });
for (const id of ['add-food', 'first-food']) $(id).addEventListener('click', () => openFood());
for (const id of ['close-food', 'cancel-food']) $(id).addEventListener('click', () => $('food-dialog').close());
for (const id of ['close-goal', 'cancel-goal']) $(id).addEventListener('click', () => $('goal-dialog').close());
$('cancel-delete').addEventListener('click', () => $('delete-dialog').close());
for (const id of ['food-dialog', 'goal-dialog', 'delete-dialog']) $(id).addEventListener('cancel', event => { if (busy) event.preventDefault(); });

$('food-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !draft) return;
  const body = { name: $('food-name').value, kcal: Number($('food-kcal').value), meal: $('food-meal').value, date: draft.date,
    ...(draft.isNew ? { operationId: draft.id } : { version: draft.version, preserveNutrition: draft.preserveNutrition }),
    ...(selectedProduct ? { catalogPortion: { code: selectedProduct.code, retrievedAt: selectedProduct.retrievedAt,
      quantity: Number($('portion-quantity').value), unit: $('portion-unit').value, basisConfirmed: true } } : {}) };
  if (selectedProduct && (!['g', 'ml'].includes($('portion-unit').value) || !$('portion-quantity').value)) { $('food-error').textContent = 'Confirmez la quantité et l’unité de l’étiquette.'; return; }
  setBusy(true); $('food-error').textContent = '';
  try {
    await request(draft.isNew ? '/api/calories/entries' : `/api/calories/entries/${draft.id}`, { method: draft.isNew ? 'POST' : 'PUT', body });
    $('food-dialog').close();
    await loadDay();
    if (dayData) status('Entrée enregistrée sur votre serveur.');
    draft = undefined;
  } catch (error) { $('food-error').textContent = error.message; }
  finally { setBusy(false); }
});
$('confirm-delete').addEventListener('click', async () => {
  if (busy || !deleting) return;
  setBusy(true);
  try {
    await request(`/api/calories/entries/${deleting.id}`, { method: 'DELETE', body: { version: deleting.version } });
    $('delete-dialog').close(); deleting = undefined;
    await loadDay(); if (dayData) status('Entrée supprimée.');
  } catch (error) { $('delete-error').textContent = error.message; }
  finally { setBusy(false); }
});
$('set-goal').addEventListener('click', () => {
  $('goal-input').value = dayData?.goal ?? '';
  $('goal-error').textContent = '';
  $('goal-dialog').showModal();
});
$('goal-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  setBusy(true); $('goal-error').textContent = '';
  try {
    await request('/api/calories/goal', { method: 'PUT', body: { goal: $('goal-input').value === '' ? null : Number($('goal-input').value) } });
    $('goal-dialog').close(); await loadDay(); if (dayData) status('Votre repère quotidien est enregistré.');
  } catch (error) { $('goal-error').textContent = error.message; }
  finally { setBusy(false); }
});
$('export').addEventListener('click', async () => {
  setBusy(true);
  try {
    const data = await request('/api/calories/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'alter-ego-calories.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Export téléchargé. Il contient vos données personnelles.');
  } catch (error) { status(error.message, true); }
  finally { setBusy(false); }
});
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('login-submit').disabled = true;
  try {
    await request('/api/login', { method: 'POST', body: { password: $('password').value } });
    $('password').value = ''; session(true); status(''); await loadDay();
  } catch (error) { status(error.message, true); }
  finally { $('login-submit').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  if (busy) return;
  try { await request('/api/logout', { method: 'POST', body: {} }); session(false); status('Votre journal est verrouillé.'); $('password').focus(); }
  catch (error) { status(error.message, true); }
});
async function init() {
  try {
    const state = await request('/api/session');
    session(state.authenticated);
    $('password').disabled = $('login-submit').disabled = !state.passwordConfigured;
    if (!state.passwordConfigured) status('Première installation : configurez un mot de passe privé côté serveur.');
    else if (state.authenticated) await loadDay();
  } catch (error) { status(error.message, true); }
}
init();


function resetSearch({ keepPhoto = false } = {}) {
  if (!keepPhoto) foodPhoto.reset();
  searchController?.abort(); searchId++;
  selectedProduct = undefined;
  $('selected-product').hidden = true;
  $('search-results').replaceChildren();
  $('search-status').textContent = '';
  $('food-query').value = '';
  $('portion-quantity').value = '';
  $('portion-unit').value = '';
  $('portion-quantity').required = false;
  $('portion-unit').required = false;
  $('food-name').readOnly = false;
  $('food-kcal').readOnly = false;
  $('search-food').disabled = false;
}
function calculatePortion() {
  if (!selectedProduct) return;
  const qty = Number($('portion-quantity').value);
  $('food-kcal').value = qty > 0 && ['g', 'ml'].includes($('portion-unit').value)
    ? Math.round(selectedProduct.kcalPer100 * qty / 100 * 10) / 10 : '';
}
$('portion-quantity').addEventListener('input', calculatePortion);
$('portion-unit').addEventListener('change', calculatePortion);
$('manual-food').addEventListener('click', () => {
  if (busy) return;
  resetSearch(); $('food-kcal').value = '';
  if (draft) draft.preserveNutrition = false;
  $('food-name').focus();
});
$('food-dialog').addEventListener('close', resetSearch);
$('search-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  searchController?.abort();
  const id = ++searchId;
  searchController = new AbortController();
  $('search-food').disabled = true;
  $('search-status').textContent = 'Recherche en cours…';
  $('search-results').replaceChildren();
  try {
    const data = await request(`/api/nutrition/search?q=${encodeURIComponent($('food-query').value)}${$('local-search').checked ? '&local=1' : ''}`, { signal: searchController.signal });
    if (id !== searchId || !$('food-dialog').open) return;
    $('search-status').textContent = data.warning || (data.products.length ? `${data.products.length} produit(s) trouvé(s)${data.mode === 'cache' ? ' dans le cache' : ''}. Choisissez votre produit.` : 'Aucun produit trouvé. Essayez un autre nom ou la saisie manuelle.');
    for (const product of data.products) {
      const li = document.createElement('li');
      const title = document.createElement('strong'); title.textContent = product.name;
      const detail = document.createElement('p');
      detail.textContent = `${product.brand || 'Marque non renseignée'} · ${product.code} · ${product.kcalPer100 === null ? 'Énergie non renseignée' : `${number(product.kcalPer100)} kcal / 100 g ou 100 ml`} · Consulté le ${new Date(product.retrievedAt).toLocaleDateString('fr-FR')}`;
      const choose = document.createElement('button'); choose.type = 'button'; choose.className = 'secondary'; choose.textContent = 'Choisir';
      choose.setAttribute('aria-label', `Choisir ${product.name}`); choose.disabled = product.kcalPer100 === null;
      choose.addEventListener('click', () => {
        if (busy) return;
        selectedProduct = product;
        $('selected-product').hidden = false;
        $('product-detail').textContent = `${product.name} · ${number(product.kcalPer100)} kcal pour 100 g ou 100 ml${product.energyMethod === 'converted-kj' ? ' (conversion depuis les kJ)' : ''}. Vérifiez l’étiquette.`;
        $('product-source').href = product.sourceUrl;
        $('food-name').value = product.name; $('food-name').readOnly = true;
        $('food-kcal').value = ''; $('food-kcal').readOnly = true;
        $('portion-quantity').value = ''; $('portion-unit').value = '';
        $('portion-quantity').required = true; $('portion-unit').required = true;
        $('search-results').replaceChildren(); $('search-status').textContent = 'Produit choisi. Confirmez maintenant la quantité et l’unité.';
        $('portion-quantity').focus();
      });
      li.append(title, detail, choose); $('search-results').append(li);
    }
  } catch (error) { if (error.name !== 'AbortError' && id === searchId) $('search-status').textContent = error.message; }
  finally { if (id === searchId) $('search-food').disabled = false; }
});
