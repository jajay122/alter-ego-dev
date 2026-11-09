// Downloads require an explicit initModel or describePhoto user action.
export const MODEL_ID = 'onnx-community/SmolLM2-135M-Instruct-ONNX';
export const MODEL_PROFILES = {
  light: { model: MODEL_ID, bytes: 135658354, label: 'Léger · 133 Mio environ avec tokenizer', sizeKnown: true },
  vision: { model: 'HuggingFaceTB/SmolVLM-256M-Instruct', bytes: 178733712, label: 'Photo · 174 Mio environ avec tokenizer', sizeKnown: true },
  french: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', bytes: 483003582, label: 'Français renforcé · 468 Mio environ avec tokenizer', sizeKnown: true },
};
let worker;
let nextId = 0;
let loading;
let state = { status: 'idle', model: MODEL_ID, device: null, error: null, profile: 'light', sizeKnown: true, bytes: 135658354, supportsVision: false };
const pending = new Map();
const abortError = () => new DOMException('Opération annulée. Le modèle sera rechargé depuis le cache à la prochaine activation.', 'AbortError');
export function getModelState() { return { ...state }; }
function failWorker(error) {
  worker?.terminate(); worker = undefined; loading = undefined;
  state = { ...state, status: 'error', error: error.message, device: null, supportsVision: false };
  for (const task of pending.values()) task.reject(error);
  pending.clear();
}
function ensureWorker() {
  if (worker) return;
  worker = new Worker(new URL('./model-worker.js', import.meta.url), { type: 'module' });
  const instance = worker;
  worker.onerror = () => { if (worker !== instance) return; failWorker(new Error('Le moteur navigateur a échoué. Vérifiez la mémoire disponible, le réseau et réessayez.')); };
  worker.onmessage = ({ data }) => {
    const task = pending.get(data.id);
    if (!task) return;
    if (data.type === 'progress') { task.progress?.(data.progress); return; }
    if (data.type === 'token') { task.onToken?.(data.text); return; }
    pending.delete(data.id);
    if (data.type === 'error') {
      state = { ...state, status: data.phase === 'init' ? 'error' : 'ready', error: data.error, supportsVision: data.phase !== 'init' && state.profile === 'vision' };
      task.reject(new Error(data.error));
    } else {
      state = { ...state, status: 'ready', error: null, device: data.device || state.device, supportsVision: state.profile === 'vision' };
      task.resolve(data.result ?? data.text ?? getModelState());
    }
  };
}
function request(type, payload, callbacks = {}) {
  return new Promise((resolve, reject) => {
    try {
      ensureWorker();
      const id = ++nextId;
      pending.set(id, { resolve, reject, ...callbacks });
      worker.postMessage({ id, type, ...payload });
    } catch (error) { failWorker(error); reject(error); }
  });
}
export function initModel(progressCallback, options = {}) {
  const profile = options.profile || (state.profile === 'vision' ? 'light' : state.profile);
  if (!MODEL_PROFILES[profile]) return Promise.reject(new Error('Profil de modèle inconnu.'));
  if (profile !== state.profile && pending.size) return Promise.reject(new Error('Attendez ou annulez la tâche en cours avant de changer de modèle.'));
  if (profile !== state.profile) {
    worker?.terminate(); worker = undefined;
    state = { ...state, ...MODEL_PROFILES[profile], profile, status: 'idle', device: null, supportsVision: false };
  }
  if (state.status === 'ready' || state.status === 'generating') return Promise.resolve(getModelState());
  if (loading) return loading;
  state = { ...state, status: 'loading', error: null, supportsVision: false };
  const operation = request('init', { profile }, { progress: progressCallback });
  loading = operation;
  operation.then(() => { if (loading === operation) loading = undefined; }, () => { if (loading === operation) loading = undefined; });
  return operation;
}
export async function generateText(prompt, options = {}) {
  if (options.signal?.aborted) throw abortError();
  if (state.status !== 'ready') throw new Error(state.status === 'generating' ? 'Le modèle répond déjà à une autre tâche.' : 'Activez d’abord le modèle dans Assistant IA (téléchargement explicite).');
  if (state.profile === 'vision') throw new Error('Le modèle photo est chargé. Réactivez un modèle texte dans Assistant IA pour discuter ou utiliser Atelier.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 6000) throw new Error('Saisissez un texte entre 1 et 6 000 caractères.');
  state = { ...state, status: 'generating', error: null };
  const abort = () => cancelGeneration();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    return await request('generate', {
      prompt: prompt.trim(), systemPrompt: String(options.systemPrompt || '').slice(0, 2000),
      maxNewTokens: Math.min(512, Math.max(16, Math.floor(Number(options.maxNewTokens) || 192))),
    }, { onToken: options.onToken });
  } finally { options.signal?.removeEventListener('abort', abort); }
}
export function cancelGeneration() {
  if (!worker || !pending.size) return;
  worker.terminate(); worker = undefined; loading = undefined;
  for (const task of pending.values()) task.reject(abortError());
  pending.clear();
  state = { ...state, status: 'idle', device: null, error: null, supportsVision: false };
}
// Calling describePhoto is the explicit opt-in action for the separate vision download.
export async function describePhoto(image, options = {}) {
  if (options.signal?.aborted) throw abortError();
  if (pending.size) throw new Error('Le moteur est occupé. Attendez ou arrêtez la tâche en cours avant une analyse photo.');
  let blob;
  if (image instanceof Blob) blob = image;
  else if (typeof image === 'string') {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
    if (!match || image.length > 14 * 1024 * 1024) throw new Error('Photo attendue : JPEG, PNG ou WebP, 10 Mo maximum.');
    try { blob = new Blob([Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))], { type: match[1] }); }
    catch { throw new Error('Les données de la photo sont invalides.'); }
  }
  if (!blob || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || !blob.size || blob.size > 10 * 1024 * 1024) throw new Error('Choisissez une photo JPEG, PNG ou WebP de 10 Mo maximum.');
  const abort = () => cancelGeneration();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    await initModel(options.onProgress, { profile: 'vision' });
    if (options.signal?.aborted) throw abortError();
    if (state.status !== 'ready' || state.profile !== 'vision') throw new Error('Le modèle photo n’est pas prêt.');
    state = { ...state, status: 'generating', error: null };
    return await request('photo', { image: blob }, { onToken: options.onToken });
  } finally { options.signal?.removeEventListener('abort', abort); }
}
