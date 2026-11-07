export function createFoodPhoto({ request, onCandidate }) {
  const $ = id => document.getElementById(id);
  let photo;
  let preview;
  let controller;
  let revision = 0;
  let preparing = false;
  let locked = false;
  function controls() {
    $('meal-photo').disabled = locked || preparing;
    $('analyze-photo').disabled = locked || preparing || Boolean(controller) || !photo;
    $('remove-meal-photo').disabled = locked;
    $('cancel-photo').hidden = !controller;
    $('meal-photo-preview').setAttribute('aria-busy', String(Boolean(controller)));
    $('photo-candidates').querySelectorAll('button').forEach(button => { button.disabled = locked; });
  }
  function reset({ collapse = true, clearInput = true } = {}) {
    if (collapse) $('photo-panel').open = false;
    revision++;
    controller?.abort(); controller = undefined;
    preparing = false; photo = undefined;
    if (preview) URL.revokeObjectURL(preview);
    preview = undefined;
    $('meal-photo-image').removeAttribute('src');
    $('meal-photo-preview').hidden = true;
    if (clearInput) $('meal-photo').value = '';
    $('photo-status').textContent = '';
    $('photo-candidates').replaceChildren();
    controls();
  }
  $('meal-photo').addEventListener('change', async event => {
    const file = event.target.files[0]; reset({ collapse: false, clearInput: false });
    if (!file || locked) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      $('photo-status').textContent = 'Choisissez une photo JPEG, PNG ou WebP de 12 Mo maximum.'; return;
    }
    const current = revision;
    let bitmap;
    preparing = true; controls();
    $('photo-status').textContent = 'Préparation de la photo sur votre téléphone…';
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (current !== revision) return;
      if (bitmap.width * bitmap.height > 24_000_000) throw new Error('Choisissez une photo de 24 mégapixels maximum ou réduisez sa résolution.');
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (current !== revision) return;
      if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('La photo réduite est trop volumineuse. Choisissez une autre photo.');
      photo = blob;
      preview = URL.createObjectURL(blob); $('meal-photo-image').src = preview;
      $('meal-photo-preview').hidden = false;
      $('photo-status').textContent = 'Photo prête. Lancez l’analyse pour l’envoyer à votre modèle local.';
    } catch (error) {
      if (current === revision) $('photo-status').textContent = error.message.startsWith('Choisissez') || error.message.startsWith('La photo réduite')
        ? error.message : 'Cette photo est illisible. Essayez une autre image.';
    } finally {
      bitmap?.close();
      if (current === revision) { preparing = false; controls(); }
    }
  });
  $('remove-meal-photo').addEventListener('click', reset);
  $('cancel-photo').addEventListener('click', () => controller?.abort());
  $('analyze-photo').addEventListener('click', async () => {
    if (locked || !photo || controller) return;
    const current = revision;
    controller = new AbortController();
    const active = controller;
    controls(); $('photo-candidates').replaceChildren();
    $('photo-status').textContent = 'Le modèle local examine la photo… Vous pouvez annuler.';
    const timeout = setTimeout(() => active.abort(), 65_000);
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ mimeType: 'image/jpeg', data: String(reader.result).split(',')[1] });
        reader.onerror = () => reject(new Error('Impossible de lire cette photo.'));
        reader.readAsDataURL(photo);
      });
      if (current !== revision) return;
      active.signal.throwIfAborted();
      const result = await request('/api/nutrition/photo', { method: 'POST', body: { image }, signal: active.signal });
      if (current !== revision || !$('food-dialog').open) return;
      $('photo-status').textContent = result.candidates.length
        ? 'Proposition à vérifier. Choisissez un nom, corrigez-le si besoin, puis lancez la recherche alimentaire. Pensez aux sauces et huiles invisibles.'
        : 'Aucun nom d’aliment exploitable. Essayez une photo plus simple ou recherchez l’aliment vous-même.';
      for (const candidate of result.candidates) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary';
        button.textContent = candidate; button.setAttribute('aria-label', `Rechercher ${candidate}`);
        button.addEventListener('click', () => { if (!locked) onCandidate(candidate); });
        $('photo-candidates').append(button);
      }
    } catch (error) {
      if (current === revision) $('photo-status').textContent = error.name === 'AbortError'
        ? 'Analyse annulée ou délai dépassé. Le moteur peut terminer son calcul. La recherche manuelle reste disponible.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (current === revision) { controller = undefined; controls(); }
    }
  });
  controls();
  return { reset, setLocked(value) { locked = value; controls(); } };
}
