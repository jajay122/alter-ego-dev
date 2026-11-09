const meals = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Collation' };
const format = n => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (date, n) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return localDate(d); };
const pretty = date => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const translations = { banane: 'banana', pomme: 'apple', riz: 'rice', poulet: 'chicken', oeuf: 'egg', œuf: 'egg', lait: 'milk', pain: 'bread', avoine: 'oats', saumon: 'salmon', carotte: 'carrot', pomme_de_terre: 'potato', yaourt: 'yogurt', fromage: 'cheese', beurre: 'butter', tomate: 'tomato', cuit: 'cooked', cuite: 'cooked', cru: 'raw', crue: 'raw' };
function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function button(text, action, variant = 'secondary') { const b = el('button', text, `button button-${variant}`); b.type = 'button'; b.addEventListener('click', action); return b; }
function field(label, input) { const wrap = el('label', undefined, 'field'); wrap.append(el('span', label), input); return wrap; }
function input(type, value = '') { const n = el('input', undefined, 'input'); n.type = type; n.value = value; return n; }
function select(options, value) { const n = el('select', undefined, 'input'); for (const [key, label] of Object.entries(options)) { const o = el('option', label); o.value = key; n.append(o); } if (value !== undefined) n.value = value; return n; }
function link(text, url) { const a = el('a', text); try { const u = new URL(url); if (u.protocol !== 'https:') return el('span', text); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; } catch { return el('span', text); } return a; }
function sourceText(n) { return `${format(n.quantity)} ${n.unit === 'serving' ? 'portion(s)' : n.unit} · ${n.provider === 'usda' ? `USDA ${n.dataset || ''} ${n.release || ''} · CC0` : n.provider === 'web' ? `Web · ${n.servingLabel}` : 'Open Food Facts · ODbL'}${n.retrievedAt ? ` · consulté le ${new Date(n.retrievedAt).toLocaleDateString('fr-FR')}` : ''}`; }

export function mountCalories({ root, api, toast = () => {} }) {
  let disposed = false, date = localDate(), data, revision = 0, mutation = false, editor, searchRevision = 0, photoController;
  const controllers = new Set();
  const request = async (path, options = {}) => { const controller = new AbortController(); controllers.add(controller); try { return await api(path, { ...options, signal: controller.signal }); } finally { controllers.delete(controller); } };
  const page = el('div', undefined, 'stack');
  const heading = el('div', undefined, 'section-heading'); heading.append(el('div', 'MON QUOTIDIEN', 'eyebrow'), el('h1', 'Journal alimentaire'), el('p', 'Des portions vérifiées, un suivi à votre rythme.', 'muted'));
  const status = el('p', '', 'notice'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.hidden = true;
  const report = (message, error = false) => { if (disposed) return; status.hidden = !message; status.textContent = message; status.className = `notice${error ? ' notice-error' : ''}`; };
  async function act(action, trigger) { if (mutation || disposed) return; mutation = true; if (trigger) trigger.disabled = true; try { await action(); } catch (error) { report(error.message || 'Cette action a échoué.', true); } finally { mutation = false; if (trigger?.isConnected) trigger.disabled = false; } }
  const nav = el('div', undefined, 'row'); const dateInput = input('date', date); dateInput.setAttribute('aria-label', 'Jour du journal');
  const chooseDay = next => { if (!next || mutation) { dateInput.value = date; return; } date = next; dateInput.value = next; closeEditor(); load(); };
  nav.append(button('←', () => chooseDay(shift(date, -1))), dateInput, button('→', () => chooseDay(shift(date, 1))), button('Aujourd’hui', () => chooseDay(localDate())), button('Actualiser', () => load(), 'ghost'));
  nav.firstChild.setAttribute('aria-label', 'Jour précédent'); nav.children[2].setAttribute('aria-label', 'Jour suivant'); dateInput.addEventListener('change', () => chooseDay(dateInput.value));
  const summary = el('section', undefined, 'card stack'); const list = el('section', undefined, 'stack');
  const editorHost = el('section', undefined, 'stack'); const extras = el('div', undefined, 'stack');
  const tools = el('div', undefined, 'row'); const add = button('Ajouter un aliment', () => openEditor(), 'primary');
  tools.append(add, button('Exporter le journal', event => act(async () => { const snapshot = await request('/api/calories/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })); const a = el('a'); a.href = url; a.download = `alter-ego-calories-${localDate()}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); report('Export téléchargé.'); }, event.currentTarget), 'ghost'));
  page.append(heading, nav, status, summary, tools, editorHost, list, extras); root.replaceChildren(page);
  const week = el('details', undefined, 'panel stack'); week.append(el('summary', 'Ma semaine')); const weekContent = el('div', undefined, 'stack'); week.append(weekContent); week.addEventListener('toggle', () => { if (week.open) loadWeek(); });
  const favorites = el('details', undefined, 'panel stack'); favorites.append(el('summary', 'Mes favoris')); const favoriteContent = el('div', undefined, 'stack'); favorites.append(favoriteContent); favorites.addEventListener('toggle', () => { if (favorites.open) loadFavorites(); }); extras.append(week, favorites);

  async function load() {
    const id = ++revision; summary.replaceChildren(el('p', 'Chargement du journal…', 'muted')); list.replaceChildren(); data = undefined;
    try { const result = await request(`/api/calories/day?date=${encodeURIComponent(date)}`); if (disposed || id !== revision) return; data = result; render(); if (week.open) loadWeek(); }
    catch (error) { if (!disposed && id === revision && error.name !== 'AbortError') { summary.replaceChildren(el('p', 'Journal indisponible. Utilisez Actualiser pour réessayer.', 'notice notice-error')); report(error.message, true); } }
  }
  function render() {
    summary.replaceChildren(el('p', pretty(data.date), 'muted'), el('h2', `${format(data.total)} kcal enregistrées`));
    summary.append(el('p', data.entries.length ? `${data.entries.length} entrée(s) · ${data.goal == null ? 'Aucun objectif défini' : `Repère personnel : ${format(data.goal)} kcal`}` : 'Journée non renseignée. Le total ne décrit pas votre consommation réelle.', 'muted'));
    if (data.goal != null) { const progress = el('progress'); progress.max = data.goal; progress.value = Math.min(data.total, data.goal); progress.setAttribute('aria-label', `${format(data.total)} kcal enregistrées sur un repère de ${format(data.goal)} kcal`); summary.append(progress); }
    summary.append(button(data.goal == null ? 'Définir un repère personnel' : 'Modifier mon repère', openGoal, 'ghost'));
    list.replaceChildren();
    if (!data.entries.length) { const empty = el('div', undefined, 'empty-state'); empty.append(el('h2', 'Votre journée commence ici'), el('p', 'Ajoutez un aliment manuellement ou choisissez une fiche nutritionnelle.')); list.append(empty); return; }
    for (const [meal, label] of Object.entries(meals)) {
      const entries = data.entries.filter(entry => entry.meal === meal); if (!entries.length) continue;
      const section = el('section', undefined, 'card stack'); section.append(el('h2', `${label} · ${format(entries.reduce((sum, entry) => sum + entry.kcal, 0))} kcal`));
      for (const entry of entries) {
        const row = el('article', undefined, 'list-item stack'); row.append(el('h3', entry.name), el('strong', `${format(entry.kcal)} kcal`));
        if (entry.nutrition) row.append(link(sourceText(entry.nutrition), entry.nutrition.sourceUrl));
        const actions = el('div', undefined, 'row');
        actions.append(button('Modifier', () => openEditor(entry), 'ghost'), button('Copier', () => copyEntry(entry), 'ghost'), button('Favori', event => act(async () => { await request('/api/calories/favorites', { method: 'POST', body: { entryId: entry.id } }); report('Aliment ajouté aux favoris.'); if (favorites.open) loadFavorites(); }, event.currentTarget), 'ghost'), button('Supprimer', () => confirmDelete(entry), 'danger'));
        row.append(actions); section.append(row);
      }
      list.append(section);
    }
  }
  function closeEditor() { photoController?.abort(); photoController = undefined; searchRevision++; editor = undefined; editorHost.replaceChildren(); }
  function makeEditor(title) { closeEditor(); editor = el('div', undefined, 'panel stack'); editor.append(el('h2', title)); editorHost.append(editor); return editor; }
  function openGoal() {
    if (mutation) return; const panel = makeEditor('Votre repère quotidien, facultatif'); const form = el('form', undefined, 'stack'); const goal = input('number', data?.goal ?? ''); goal.min = '1'; goal.max = '20000'; goal.step = '1';
    form.append(field('Objectif en kcal (vide pour le retirer)', goal), el('p', 'Un repère que vous choisissez, sans recommandation automatique.', 'muted'));
    const save = el('button', 'Enregistrer', 'button button-primary'); const cancel = button('Annuler', closeEditor, 'ghost'); form.append(save, cancel); panel.append(form);
    form.addEventListener('submit', event => { event.preventDefault(); act(async () => { await request('/api/calories/goal', { method: 'PUT', body: { goal: goal.value === '' ? null : Number(goal.value) } }); closeEditor(); await load(); report('Repère enregistré.'); }, save); }); goal.focus();
  }
  function confirmDelete(entry) {
    if (mutation) return; const panel = makeEditor('Supprimer cette entrée ?'); panel.append(el('p', entry.name));
    panel.append(button('Confirmer la suppression', event => act(async () => { await request(`/api/calories/entries/${entry.id}`, { method: 'DELETE', body: { version: entry.version } }); closeEditor(); await load(); report('Entrée supprimée.'); }, event.currentTarget), 'danger'), button('Annuler', closeEditor, 'ghost'));
  }
  function copyEntry(entry, favorite = false) {
    if (mutation) return; const panel = makeEditor(favorite ? 'Ajouter ce favori' : 'Copier cette entrée'); panel.append(el('p', `${entry.name} · ${format(entry.kcal ?? entry.tenths / 10)} kcal`));
    const form = el('form', undefined, 'stack'); const target = input('date', date); target.required = true; const meal = select(meals, entry.meal || 'breakfast'); const operationId = crypto.randomUUID(); const save = el('button', 'Ajouter à ce jour', 'button button-primary');
    form.append(field('Date', target), field('Repas', meal), save, button('Annuler', closeEditor, 'ghost')); panel.append(form);
    form.addEventListener('submit', event => { event.preventDefault(); act(async () => { await request('/api/calories/entries', { method: 'POST', body: { [favorite ? 'favoriteId' : 'copyEntryId']: entry.id, date: target.value, meal: meal.value, operationId } }); date = target.value; dateInput.value = date; closeEditor(); await load(); report('Entrée ajoutée.'); }, save); });
  }
  async function loadWeek() {
    const current = date; const dayOfWeek = new Date(`${current}T12:00:00`).getDay(); const start = shift(current, -((dayOfWeek + 6) % 7)); weekContent.replaceChildren(el('p', 'Chargement…', 'muted'));
    const results = await Promise.allSettled(Array.from({ length: 7 }, (_, i) => request(`/api/calories/day?date=${shift(start, i)}`)));
    if (disposed || current !== date) return; weekContent.replaceChildren(); let reported = 0, total = 0;
    results.forEach((result, i) => { const day = shift(start, i); let label = 'indisponible'; if (result.status === 'fulfilled') { const d = result.value; if (d.entries.length) { label = `${format(d.total)} kcal · ${d.entries.length} entrée(s)`; reported++; total += d.total; } else label = 'non renseigné'; } weekContent.append(button(`${pretty(day)} · ${label}`, () => chooseDay(day), 'ghost')); });
    weekContent.prepend(el('p', `${reported} jour(s) renseigné(s) · ${format(total)} kcal enregistrées. Aucun total consommé n’est déduit des jours vides.`, 'muted'));
  }
  async function loadFavorites() {
    favoriteContent.replaceChildren(el('p', 'Chargement…', 'muted'));
    try { const response = await request('/api/calories/favorites'); if (disposed) return; const items = Array.isArray(response) ? response : response.favorites || []; favoriteContent.replaceChildren(); if (!items.length) favoriteContent.append(el('p', 'Ajoutez une entrée aux favoris pour retrouver sa portion ici.', 'muted'));
      for (const item of items) { const row = el('div', undefined, 'list-item stack'); row.append(el('strong', item.name), el('p', `${format(item.kcal ?? item.tenths / 10)} kcal`)); if (item.nutrition) row.append(link(sourceText(item.nutrition), item.nutrition.sourceUrl)); row.append(button('Ajouter', () => copyEntry(item, true)), button('Retirer des favoris', event => act(async () => { await request(`/api/calories/favorites/${item.id}`, { method: 'DELETE', body: {} }); await loadFavorites(); }, event.currentTarget), 'ghost')); favoriteContent.append(row); }
    } catch (error) { if (!disposed) favoriteContent.replaceChildren(el('p', error.message, 'notice notice-error')); }
  }
  function openEditor(entry) {
    if (mutation) return; const panel = makeEditor(entry ? 'Modifier une entrée' : 'Ajouter un aliment');
    const search = el('details', undefined, 'stack'); search.open = !entry; search.append(el('summary', 'Rechercher dans une source nutritionnelle'));
    const source = select({ usda: 'USDA · aliments courants', openfoodfacts: 'Open Food Facts · produits emballés', web: 'Page web compatible' }, 'usda');
    const query = input('search'); query.placeholder = 'banana, rice cooked…'; const url = input('url'); url.placeholder = 'https://…'; url.hidden = true;
    const help = el('p', 'USDA : noms anglais, valeurs pour 100 g. Vérifiez toujours l’état cru/cuit.', 'muted');
    const translation = el('p', '', 'muted'); const searchStatus = el('p', '', 'muted'); searchStatus.setAttribute('role', 'status'); const results = el('div', undefined, 'stack');
    const searchForm = el('form', undefined, 'stack'); const queryField = field('Nom ou code-barres', query); const urlField = field('Adresse de la recette', url); urlField.hidden = true;
    const searchSubmit = el('button', 'Rechercher', 'button button-secondary'); searchForm.append(field('Source', source), queryField, urlField, help, translation, searchSubmit); search.append(searchForm, searchStatus, results); panel.append(search);
    const form = el('form', undefined, 'stack'); const name = input('text', entry?.name || ''); name.maxLength = 120; name.required = true; const kcal = input('number', entry?.kcal ?? ''); kcal.min = '0'; kcal.max = '10000'; kcal.step = '0.1'; kcal.required = true;
    const meal = select(meals, entry?.meal || 'breakfast'); const target = input('date', entry?.date || date); target.required = true;
    const selectedInfo = el('div', undefined, 'notice'); selectedInfo.hidden = true; const portion = el('div', undefined, 'form-grid'); portion.hidden = true;
    const quantity = input('number'); quantity.min = '0.1'; quantity.max = '10000'; quantity.step = '0.1'; const unit = select({ '': 'Choisir l’unité' }); portion.append(field('Quantité consommée', quantity), field('Unité de référence', unit));
    const fields = el('div', undefined, 'form-grid'); fields.append(field('Aliment ou plat', name), field('Énergie de la portion (kcal)', kcal), field('Repas', meal), field('Date', target));
    const save = el('button', entry ? 'Enregistrer les modifications' : 'Ajouter au journal', 'button button-primary'); const formStatus = el('p', '', 'notice notice-error'); formStatus.hidden = true; formStatus.setAttribute('role', 'alert');
    form.append(selectedInfo, portion, fields); if (entry?.nutrition) form.append(el('p', 'La source est conservée si le nom et les kcal restent identiques. Pour une autre quantité, recherchez à nouveau la fiche.', 'muted'));
    let selected, operationId = crypto.randomUUID();
    const manual = button('Passer en saisie manuelle', () => { selected = undefined; selectedInfo.hidden = portion.hidden = true; name.readOnly = kcal.readOnly = false; quantity.required = unit.required = false; kcal.value = ''; name.focus(); }, 'ghost'); form.append(manual, formStatus, save, button('Annuler', closeEditor, 'ghost')); panel.append(form);
    function calculate() { if (!selected) return; const n = Number(quantity.value); kcal.value = n > 0 && unit.value ? Math.round((selected.provider === 'web' ? selected.kcalPerServing * n : selected.kcalPer100 * n / 100) * 10) / 10 : ''; }
    quantity.addEventListener('input', calculate); unit.addEventListener('change', calculate);
    source.addEventListener('change', () => { searchRevision++; searchSubmit.disabled = false; const web = source.value === 'web'; queryField.hidden = web; urlField.hidden = !web; url.hidden = !web; query.placeholder = source.value === 'usda' ? 'banana, rice cooked…' : 'Nom du produit ou code-barres'; help.textContent = web ? 'Recettes compatibles : BBC Good Food, Skinnytaste et Jamie Oliver. Une portion explicite doit figurer dans la page.' : source.value === 'usda' ? 'USDA : noms anglais, valeurs pour 100 g. Vérifiez toujours l’état cru/cuit.' : 'Confirmez g ou ml sur l’étiquette. Aucune conversion entre poids et volume.'; searchSubmit.textContent = web ? 'Lire la page source' : 'Rechercher'; translation.textContent = ''; results.replaceChildren(); });
    searchForm.addEventListener('submit', async event => {
      event.preventDefault(); const id = ++searchRevision; const searchPanel = panel; searchSubmit.disabled = true; results.replaceChildren(); searchStatus.textContent = 'Recherche en cours…'; translation.textContent = '';
      let term = query.value.trim();
      if (source.value === 'usda') { const translated = term.toLowerCase().replace(/pomme de terre/g, 'pomme_de_terre').split(/\s+/).map(word => translations[word] || word).join(' '); if (translated !== term.toLowerCase()) { translation.textContent = `Aide de recherche français → anglais : « ${term} » → « ${translated} ». Les noms des fiches restent ceux de la source.`; term = translated; } }
      try {
        const response = source.value === 'web' ? await request('/api/nutrition/web', { method: 'POST', body: { url: url.value } }) : await request(`/api/nutrition/search?source=${source.value}&q=${encodeURIComponent(term)}`);
        if (disposed || id !== searchRevision || editor !== searchPanel) return;
        const products = response.products || []; searchStatus.textContent = [response.warning, products.length ? `${products.length} résultat(s). Vérifiez la description avant de choisir.` : 'Aucun résultat. Essayez un autre nom ou la saisie manuelle.'].filter(Boolean).join(' ');
        for (const product of products) {
          const card = el('article', undefined, 'card stack'); const web = product.provider === 'web'; card.append(el('strong', product.name));
          card.append(el('p', web ? `${format(product.kcalPerServing)} kcal · ${product.servingLabel}` : `${product.brand ? `${product.brand} · ` : ''}${product.kcalPer100 == null ? 'Énergie non renseignée' : `${format(product.kcalPer100)} kcal / ${product.provider === 'usda' ? '100 g' : '100 g ou 100 ml (voir étiquette)'}`}`, 'muted'));
          card.append(link(web ? 'Voir la recette et sa portion' : `${product.provider === 'usda' ? `USDA ${product.dataset || ''} ${product.release || ''} · CC0` : 'Open Food Facts · ODbL'} · fiche ${product.code}`, product.sourceUrl));
          const choose = button('Choisir cette fiche', () => {
            selected = product; name.value = product.name.slice(0, 120); name.readOnly = kcal.readOnly = true; kcal.value = ''; quantity.value = ''; quantity.required = unit.required = true; unit.replaceChildren();
            const options = web ? { '': 'Confirmer la portion', serving: 'Portion de référence' } : product.provider === 'usda' ? { '': 'Confirmer l’unité', g: 'Grammes (g)' } : { '': 'Confirmer selon l’étiquette', g: 'Grammes (g)', ml: 'Millilitres (ml)' };
            for (const [key, value] of Object.entries(options)) { const o = el('option', value); o.value = key; unit.append(o); }
            selectedInfo.replaceChildren(el('strong', product.name), el('p', web ? `Une portion = ${product.servingLabel}. Aucune conversion en g ou ml.` : product.provider === 'usda' ? 'Quantité en grammes uniquement. Confirmez la description cru/cuit.' : 'Choisissez g ou ml selon l’étiquette. Aucune conversion implicite.'), link('Source nutritionnelle', product.sourceUrl)); selectedInfo.hidden = portion.hidden = false; results.replaceChildren(); search.open = false; quantity.focus();
          }); choose.disabled = !web && product.kcalPer100 == null; card.append(choose); results.append(card);
        }
      } catch (error) { if (!disposed && id === searchRevision) searchStatus.textContent = error.message; }
      finally { if (id === searchRevision) searchSubmit.disabled = false; }
    });
    form.addEventListener('submit', event => {
      event.preventDefault(); if (mutation) return;
      const body = { name: name.value, kcal: Number(kcal.value), date: target.value, meal: meal.value, ...(entry ? { version: entry.version, preserveNutrition: !selected } : { operationId }) };
      if (selected) body.catalogPortion = { provider: selected.provider, revision: selected.revision, code: selected.code, retrievedAt: selected.retrievedAt, quantity: Number(quantity.value), unit: unit.value, basisConfirmed: true };
      mutation = true; save.disabled = true; formStatus.hidden = true;
      request(entry ? `/api/calories/entries/${entry.id}` : '/api/calories/entries', { method: entry ? 'PUT' : 'POST', body }).then(async () => { if (disposed) return; date = body.date; dateInput.value = date; closeEditor(); await load(); report('Entrée enregistrée.'); toast('Entrée enregistrée.'); }).catch(error => { if (!disposed) { formStatus.hidden = false; formStatus.textContent = error.message; } }).finally(() => { mutation = false; save.disabled = false; });
    });
    const photo = el('details', undefined, 'stack'); photo.append(el('summary', 'Identifier un aliment sur une photo'));
    const photoStatus = el('p', 'Facultatif : le premier lancement télécharge environ 173 Mio pour le modèle et son tokenizer, plus environ 21 Mio de moteur. La photo est traitée sur votre appareil et n’est pas envoyée à un service d’IA. Le chargement peut être lent ou échouer sur Android. Le modèle texte sera déchargé ; une génération en cours doit être terminée avant de basculer.', 'muted');
    const photoProgress = el('p', '', 'muted'); photoProgress.setAttribute('role', 'status'); photoProgress.setAttribute('aria-live', 'polite');
    const file = input('file'); file.accept = 'image/jpeg,image/png,image/webp';
    const preview = el('img'); preview.hidden = true; preview.alt = 'Photo préparée pour vérification'; preview.style.maxWidth = '100%'; preview.style.maxHeight = '240px';
    const candidate = input('text'); candidate.maxLength = 120; candidate.placeholder = 'Ex. : riz cuit'; const suggestions = el('div', undefined, 'stack');
    let photoRevision = 0, imageData;
    const useCandidate = value => { candidate.value = value; query.value = value; source.value = 'usda'; source.dispatchEvent(new Event('change')); search.open = true; searchStatus.textContent = 'Vérifiez ou corrigez le nom proposé et l’état cru/cuit, puis lancez explicitement la recherche. Aucune calorie n’est estimée par le modèle.'; query.focus(); };
    const analyze = button('Télécharger le modèle photo (~173 Mio) et analyser', async () => {
      if (!imageData || analyze.disabled) return;
      const generation = photoRevision; const controller = new AbortController(); photoController = controller; controllers.add(controller);
      analyze.disabled = true; file.disabled = true; stop.hidden = false; suggestions.replaceChildren(); photoProgress.textContent = 'Chargement du modèle photo sur cet appareil…';
      try {
        const { describePhoto, getModelState } = await import('./model-client.js');
        if (controller.signal.aborted || disposed || editor !== panel) return;
        const state = getModelState(); if (state.status === 'generating') throw new Error('Le modèle rédige déjà une réponse dans l’atelier. Attendez la fin de cette réponse avant d’analyser une photo.');
        const result = await describePhoto(imageData, { signal: controller.signal, onProgress(progress) {
          if (disposed || editor !== panel || generation !== photoRevision || controller.signal.aborted) return;
          if (progress?.status === 'progress' && Number.isFinite(progress.progress)) photoProgress.textContent = `Téléchargement du modèle : ${Math.round(progress.progress)} % du fichier en cours…`;
          else if (progress?.message) photoProgress.textContent = progress.message;
          else if (progress?.status === 'ready' || progress?.status === 'done') photoProgress.textContent = 'Modèle chargé. Analyse locale en cours…';
        } });
        if (disposed || editor !== panel || generation !== photoRevision || controller.signal.aborted) return;
        photoProgress.textContent = 'Propositions à vérifier. La photo ne détermine ni le poids de votre portion ni ses calories.';
        if (typeof result.description === 'string' && result.description.trim()) suggestions.append(el('p', result.description));
        const candidates = Array.isArray(result.candidates) ? result.candidates.filter(value => typeof value === 'string' && value.trim()).slice(0, 3) : [];
        for (const value of candidates) suggestions.append(button(`Vérifier « ${value} »`, () => useCandidate(value.trim().slice(0, 120)), 'secondary'));
        if (!candidates.length) suggestions.append(el('p', 'Aucun nom exploitable. Saisissez votre propre description ci-dessous.', 'muted'));
      } catch (error) {
        if (!disposed && editor === panel && generation === photoRevision) photoProgress.textContent = error.name === 'AbortError' ? 'Analyse annulée. Vous pouvez toujours saisir le nom vous-même.' : `${error.message || 'Le modèle photo est indisponible.'} Vous pouvez saisir le nom manuellement.`;
      } finally {
        controllers.delete(controller); if (photoController === controller) photoController = undefined;
        if (!disposed && editor === panel) { analyze.disabled = !imageData; analyze.textContent = 'Analyser la photo sur cet appareil'; file.disabled = false; stop.hidden = true; }
      }
    }, 'secondary'); analyze.disabled = true;
    const stop = button('Annuler l’analyse', () => photoController?.abort(), 'ghost'); stop.hidden = true;
    photo.append(photoStatus, field('Photo (JPEG local, 512 pixels maximum)', file), preview, analyze, stop, photoProgress, suggestions, field('Nom à vérifier et corriger', candidate), button('Préparer la recherche de ce nom', () => { if (candidate.value.trim()) useCandidate(candidate.value.trim()); else { photoProgress.textContent = 'Indiquez un nom d’aliment avant de préparer la recherche.'; candidate.focus(); } }, 'secondary'));
    file.addEventListener('change', async () => {
      const generation = ++photoRevision; imageData = undefined; analyze.disabled = true; preview.hidden = true; suggestions.replaceChildren(); photoProgress.textContent = '';
      const f = file.files?.[0]; if (!f) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 10 * 1024 * 1024) { photoProgress.textContent = 'Choisissez une image JPEG, PNG ou WebP de moins de 10 Mo.'; return; }
      let bitmap;
      try {
        bitmap = await createImageBitmap(f); if (disposed || editor !== panel || generation !== photoRevision) return;
        const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); imageData = canvas.toDataURL('image/jpeg', 0.8); preview.src = imageData; preview.hidden = false; analyze.disabled = false;
        photoProgress.textContent = `JPEG préparé localement (${canvas.width} × ${canvas.height}). Cliquez sur Analyser pour lancer le modèle, ou saisissez directement un nom.`;
      } catch { photoProgress.textContent = 'Cette image ne peut pas être lue. Essayez un autre fichier.'; }
      finally { bitmap?.close(); }
    });
    panel.append(photo); name.focus();
  }

  function migration() {
    let legacy; try { const raw = localStorage.getItem('alter-ego-preview-journal-v1'); if (!raw) return; legacy = JSON.parse(raw); } catch { const note = el('p', 'Un ancien journal local existe mais ne peut pas être lu. Il reste conservé dans ce navigateur.', 'notice notice-error'); extras.prepend(note); return; }
    if (!Array.isArray(legacy.entries) || (!legacy.entries.length && !Number.isInteger(legacy.goal))) return;
    const box = el('section', undefined, 'panel stack'); box.append(el('h2', 'Retrouver votre ancien journal'), el('p', `${legacy.entries.length} entrée(s) détectée(s) dans ce navigateur. Importez-les explicitement dans votre journal privé. La copie locale restera conservée.`));
    const result = el('p', '', 'muted'); result.setAttribute('role', 'status');
    const importButton = button('Importer mon ancien journal', event => act(async () => {
      let count = 0;
      try {
        if (!legacy.entries.length) await request('/api/calories/import', { method: 'POST', body: { entries: [], goal: legacy.goal } });
        for (let i = 0; i < legacy.entries.length; i += 100) {
          const entries = legacy.entries.slice(i, i + 100).map(entry => ({ ...entry, kcal: entry.kcal ?? entry.tenths / 10 }));
          await request('/api/calories/import', { method: 'POST', body: { entries, ...(i === 0 && (legacy.goal === null || Number.isInteger(legacy.goal)) ? { goal: legacy.goal } : {}) } });
          count += entries.length; if (!disposed) result.textContent = `${count} / ${legacy.entries.length} entrée(s) traitée(s)…`;
        }
      } catch (error) {
        if (!disposed) result.textContent = `Import interrompu après ${count} entrée(s) confirmée(s). Les lots précédents restent enregistrés. Votre copie locale est intacte ; vous pouvez réessayer sans dupliquer les identifiants déjà importés.`;
        throw error;
      }
      if (disposed) return; result.textContent = 'Import terminé et confirmé par le serveur. Votre ancien journal local est conservé. Un nouvel import des mêmes identifiants ne crée pas de doublons.'; importButton.hidden = true; await load();
    }, event.currentTarget), 'primary'); box.append(importButton, result); extras.prepend(box);
  }
  migration(); load();
  return () => { disposed = true; revision++; searchRevision++; for (const controller of controllers) controller.abort(); root.replaceChildren(); };
}
