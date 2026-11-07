const $ = id => document.getElementById(id);
let mode = 'text';
let photo;
let previewUrl;
let controller;
let answerText = '';
const descriptions = {
  text: ['Qu’avez-vous en tête ?', 'Explique-moi quelque chose simplement…', 'Traitement sur votre serveur'],
  web: ['Quel sujet explorer ?', 'Exemple : comment fonctionne un panneau solaire ?', 'Recherche dans Wikipédia · Internet requis'],
  photo: ['Que souhaitez-vous savoir ?', 'Décris cette photo et les informations visibles.', 'Analyse locale · La photo quitte votre téléphone pour votre serveur'],
};

function status(message, kind = '') {
  $('status').textContent = message;
  $('status').className = `status ${kind}`;
}
async function api(path, body, signal) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') showSession(false);
    throw new Error(data.error || 'La demande a échoué.');
  }
  return data;
}
function showSession(authenticated) {
  $('login-panel').hidden = authenticated;
  $('assistant-panel').hidden = !authenticated;
  $('logout').hidden = !authenticated;
  if (!authenticated) {
    $('result').hidden = true;
    $('answer').textContent = '';
    $('sources').replaceChildren();
    $('prompt').value = '';
    $('counter').textContent = '0 / 4 000';
    answerText = '';
    removePhoto();
  }
}
async function refresh() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Impossible de lire l’état du serveur.');
    const data = await response.json();
    showSession(data.authenticated);
    $('password').disabled = !data.passwordConfigured;
    $('login-form').querySelector('button').disabled = !data.passwordConfigured;
    if (!data.passwordConfigured) status('Première installation : configurez un mot de passe privé côté serveur pour déverrouiller cet espace.');
    else if (data.authenticated) status(data.modelReady ? 'Prêt. Le modèle local répond sur votre serveur.' : 'Le moteur local ne répond pas encore. Démarrez-le avant une demande.');
    $('model-badge').textContent = data.authenticated ? (data.modelReady ? '◎ Modèle prêt' : '◎ Moteur arrêté') : '◎ Moteur local';
  } catch { status('Impossible de joindre l’application. Réessayez après rechargement.', 'error'); }
}
function setMode(next) {
  mode = next;
  document.querySelectorAll('[data-mode]').forEach(button => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const [label, placeholder, hint] = descriptions[mode];
  $('prompt-label').textContent = label;
  $('prompt').placeholder = placeholder;
  $('mode-hint').textContent = hint;
  $('photo-controls').hidden = mode !== 'photo';
  $('ideas').hidden = mode !== 'text';
  status('');
  if (mode !== 'photo') removePhoto();
}
function removePhoto() {
  photo = undefined;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  $('photo-preview').removeAttribute('src');
  $('preview').hidden = true;
  $('photo').value = '';
}
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ mimeType: file.type, data: String(reader.result).split(',')[1] });
    reader.onerror = () => reject(new Error('Impossible de lire cette photo.'));
    reader.readAsDataURL(file);
  });
}
function setBusy(busy) {
  $('submit').disabled = busy;
  $('cancel').hidden = !busy;
  $('prompt').disabled = busy;
  document.querySelectorAll('[data-mode], [data-example], #photo, #remove-photo').forEach(el => { el.disabled = busy; });
  $('assistant-form').setAttribute('aria-busy', String(busy));
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    await api('/api/login', { password: $('password').value });
    $('password').value = '';
    await refresh();
    $('prompt').focus();
  } catch (error) { status(error.message, 'error'); }
  finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => {
  controller?.abort();
  try { await api('/api/logout', {}); showSession(false); status('Votre espace est verrouillé.'); $('password').focus(); }
  catch (error) { status(error.message, 'error'); }
});
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  $('prompt').value = button.dataset.example;
  $('prompt').dispatchEvent(new Event('input'));
  $('prompt').focus();
}));
$('prompt').addEventListener('input', () => { $('counter').textContent = `${$('prompt').value.length} / 4 000`; });
$('photo').addEventListener('change', event => {
  const file = event.target.files[0];
  removePhoto();
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
    status('Choisissez une image JPEG, PNG ou WebP de 3 Mo maximum.', 'error'); return;
  }
  photo = file;
  previewUrl = URL.createObjectURL(file);
  $('photo-preview').src = previewUrl;
  $('photo-name').textContent = file.name;
  $('preview').hidden = false;
  status('Photo prête. Elle sera envoyée uniquement à votre serveur au moment de la demande.');
});
$('remove-photo').addEventListener('click', removePhoto);
$('cancel').addEventListener('click', () => controller?.abort());
$('assistant-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (controller) return;
  if (mode === 'photo' && !photo) { status('Choisissez d’abord une photo.', 'error'); return; }
  controller = new AbortController();
  setBusy(true);
  $('result').hidden = true;
  status(mode === 'web' ? 'Recherche des sources, puis lecture par votre modèle local…' : 'Le petit modèle réfléchit sur votre serveur…', 'busy');
  try {
    const image = mode === 'photo' ? await readPhoto(photo) : undefined;
    const result = await api('/api/assist', { mode, prompt: $('prompt').value, ...(image ? { image } : {}) }, controller.signal);
    answerText = result.answer;
    $('answer').textContent = result.answer;
    $('truncated').hidden = !result.truncated;
    $('sources').replaceChildren();
    for (const source of result.sources || []) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = source.url;
      link.textContent = source.title;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      li.append(link); $('sources').append(li);
    }
    $('sources-panel').hidden = !result.sources?.length;
    $('result').hidden = false;
    status('Réponse reçue. Un petit modèle peut se tromper, notamment en français ou sur les détails d’une image.');
    $('result').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (error) {
    status(error.name === 'AbortError' ? 'Demande annulée. Le moteur peut terminer le calcul déjà commencé.' : error.message, error.name === 'AbortError' ? '' : 'error');
  } finally { controller = undefined; setBusy(false); }
});
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(answerText); status('Réponse copiée.'); }
  catch { status('La copie n’est pas disponible dans ce navigateur. Sélectionnez le texte pour le copier.', 'error'); }
});
refresh();
