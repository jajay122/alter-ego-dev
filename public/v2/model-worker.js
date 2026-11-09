// Dependency and model revision are pinned. This module runs only in a dedicated Worker.
const PROFILES = {
  light: { model: 'onnx-community/SmolLM2-135M-Instruct-ONNX', revision: 'b8a5c0f183b78c55955a5364f610c36668b5e681', dtype: 'q8' },
  vision: { model: 'HuggingFaceTB/SmolVLM-256M-Instruct', revision: '7e3e67edbbed1bf9888184d9df282b700a323964', dtype: { embed_tokens: 'q8', vision_encoder: 'q4', decoder_model_merged: 'q4' } },
  french: { model: 'onnx-community/Qwen2.5-0.5B-Instruct', revision: '22942cb7d7ba4cc81bb4673549ca4d4614469b5e', dtype: 'q4f16' },
};
let engine;
let library;
let processor;
let visionModel;
let device;
let busy = false;
const send = (id, type, extra = {}) => self.postMessage({ id, type, ...extra });
async function initialize(id, profile) {
  const config = PROFILES[profile];
  if (!config) throw new Error('Profil inconnu');
  if (profile === 'vision' && (typeof self.createImageBitmap !== 'function' || typeof self.OffscreenCanvas !== 'function')) throw new Error('Ce navigateur ne peut pas décoder les photos dans un Worker. Utilisez le nom ou le code-barres');
  let adapter;
  try { adapter = await self.navigator.gpu?.requestAdapter(); } catch { /* CPU fallback. */ }
  if (profile === 'french' && !adapter?.features.has('shader-f16')) throw new Error('Le profil français demande WebGPU avec shader-f16. Choisissez le profil léger sur cet appareil');
  if (engine || visionModel) return;
  library ||= await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
  library.env.allowLocalModels = false;
  library.env.useBrowserCache = true;
  // A single WASM thread works without cross-origin isolation on public hosting.
  library.env.backends.onnx.wasm.numThreads = 1;
  const options = {
    revision: config.revision, dtype: config.dtype,
    progress_callback: progress => send(id, 'progress', { progress }),
  };
  const create = async target => {
    if (profile === 'vision') {
      processor ||= await library.AutoProcessor.from_pretrained(config.model, { revision: config.revision, progress_callback: options.progress_callback });
      // Avoid the default 2048px preprocessing allocation before the single 512px patch.
      processor.image_processor.size = { longest_edge: 512 };
      visionModel = await library.AutoModelForVision2Seq.from_pretrained(config.model, { ...options, device: target });
    } else engine = await library.pipeline('text-generation', config.model, { ...options, device: target });
  };
  if (adapter) {
    try {
      device = 'webgpu';
      await create(device);
      return;
    } catch (error) {
      if (profile === 'french') throw error;
      send(id, 'progress', { progress: { status: 'fallback', message: 'WebGPU indisponible pour ce modèle : essai sur processeur (WASM).' } });
    }
  }
  device = 'wasm';
  await create(device);
}
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  if (busy) { send(id, 'error', { phase: type, error: 'Le moteur est déjà occupé.' }); return; }
  busy = true;
  try {
    if (type === 'init') {
      await initialize(id, data.profile);
      send(id, 'done', { device });
    } else if (type === 'generate') {
      if (!engine) throw new Error('Le modèle doit être activé avant de répondre.');
      const streamer = new library.TextStreamer(engine.tokenizer, {
        skip_prompt: true, callback_function: text => send(id, 'token', { text }),
      });
      const messages = [
        { role: 'system', content: 'Tu es Alter Ego, assistant francophone. Réponds en français, brièvement et honnêtement. Signale tes incertitudes. Ne prétends pas avoir navigué, exécuté du code ou consulté des données personnelles. Ne donne pas de diagnostic médical ni de chiffres nutritionnels inventés. ' + data.systemPrompt },
        { role: 'user', content: data.prompt },
      ];
      const output = await engine(messages, { max_new_tokens: data.maxNewTokens, do_sample: false, repetition_penalty: 1.15, streamer });
      const generated = output[0]?.generated_text;
      const text = typeof generated === 'string' ? generated : generated?.at(-1)?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('Le modèle n’a pas produit de réponse.');
      send(id, 'done', { text: text.trim(), device });
    } else if (type === 'photo') {
      if (!visionModel || !processor) throw new Error('Activez le modèle photo avant cette demande.');
      if (!(data.image instanceof Blob)) throw new Error('Photo locale attendue.');
      if (typeof self.createImageBitmap !== 'function' || typeof self.OffscreenCanvas !== 'function') throw new Error('Ce navigateur ne peut pas décoder les photos dans un Worker. Saisissez le nom de l’aliment.');
      // Limit decoding dimensions before creating pixel buffers in the model runtime.
      const bitmap = await self.createImageBitmap(data.image, { resizeWidth: 512, resizeQuality: 'medium' });
      let image;
      try {
        const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
        const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        image = library.RawImage.fromCanvas(canvas).rgb();
      } finally { bitmap.close(); }
      const messages = [{ role: 'user', content: [
        { type: 'image' },
        { type: 'text', text: 'Name only the clearly visible foods in this image. Return at most three short food names separated by semicolons. If uncertain or no food is visible, say unknown. Do not give amounts, calories, nutrition, recipes or medical advice.' },
      ] }];
      const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
      const inputs = await processor(prompt, [image], { do_image_splitting: false });
      const streamer = new library.TextStreamer(processor.tokenizer, { skip_prompt: true, callback_function: text => send(id, 'token', { text }) });
      const generated = await visionModel.generate({ ...inputs, max_new_tokens: 64, do_sample: false, repetition_penalty: 1.15, streamer });
      const description = processor.batch_decode(generated.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true })[0]?.trim();
      if (!description) throw new Error('Le modèle n’a pas proposé de nom. Saisissez un nom à vérifier.');
      const candidates = [...new Set(description.split(/[;\n,]/).map(value => value.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(value => value.length > 1 && value.length <= 60 && !/unknown|uncertain|no food|cannot|not sure|calori|kcal|\d/i.test(value)))].slice(0, 3);
      send(id, 'done', { device, result: { description, candidates, requiresConfirmation: true, model: PROFILES.vision.model } });
    } else throw new Error('Action du moteur inconnue.');
  } catch (error) {
    send(id, 'error', { phase: type, error: `Échec ${type === 'init' ? 'du chargement' : 'de la génération'} : ${String(error.message || error).slice(0, 400)}. Sur mobile, libérez de la mémoire ou réessayez sur un appareil plus puissant.` });
  } finally { busy = false; }
};
