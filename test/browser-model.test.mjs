import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../public/v2/ai.js';

class WorkerDouble {
  static instances = [];
  constructor(url, options) { this.url = url; this.options = options; this.messages = []; WorkerDouble.instances.push(this); }
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  emit(message) { this.onmessage({ data: message }); }
}
async function client(t) {
  const original = globalThis.Worker;
  globalThis.Worker = WorkerDouble;
  WorkerDouble.instances.length = 0;
  t.after(() => { globalThis.Worker = original; });
  return import(`../public/v2/model-client.js?test=${Math.random()}`);
}

test('arithmetic uses precedence and parentheses, rejects code and nonfinite values', () => {
  assert.equal(calculate('200 × (52 / 100)'), 104);
  assert.equal(calculate('2,5 + -3 * 2'), -3.5);
  for (const input of ['1/0', 'globalThis.process.exit()', '2..3', '(1+2', '2 3+']) assert.throws(() => calculate(input));
});

test('import and rejected generation/photo never download a model', async t => {
  const model = await client(t);
  assert.equal(model.getModelState().status, 'idle');
  await assert.rejects(model.generateText('Bonjour'), /Activez/);
  await assert.rejects(model.describePhoto('https://example.com/photo.jpg'), /Photo attendue/);
  assert.equal(WorkerDouble.instances.length, 0);
});

test('explicit activation shares a single load, streams chunks, returns text', async t => {
  const model = await client(t);
  const progress = [];
  const first = model.initModel(value => progress.push(value));
  assert.equal(first, model.initModel());
  const worker = WorkerDouble.instances[0];
  assert.equal(worker.options.type, 'module');
  const id = worker.messages[0].id;
  worker.emit({ id, type: 'progress', progress: { status: 'progress', progress: 50 } });
  worker.emit({ id, type: 'done', device: 'wasm' });
  await first;
  assert.equal(progress.length, 1);
  const chunks = [];
  const response = model.generateText('Bonjour', { onToken: chunk => chunks.push(chunk), maxNewTokens: 999 });
  const request = worker.messages[1];
  assert.equal(request.maxNewTokens, 512);
  await assert.rejects(model.generateText('Autre tâche'), /déjà/);
  worker.emit({ id: request.id, type: 'token', text: 'Bonjour ' });
  worker.emit({ id: request.id, type: 'done', text: 'Bonjour !' });
  assert.equal(await response, 'Bonjour !');
  assert.deepEqual(chunks, ['Bonjour ']);
  assert.equal(model.getModelState().status, 'ready');
});

test('cancel load then immediate reload preserves single flight and ignores late reply', async t => {
  const model = await client(t);
  const oldLoad = model.initModel();
  const rejected = assert.rejects(oldLoad, { name: 'AbortError' });
  const oldWorker = WorkerDouble.instances[0];
  model.cancelGeneration();
  const newLoad = model.initModel();
  await rejected;
  assert.equal(newLoad, model.initModel());
  oldWorker.emit({ id: oldWorker.messages[0].id, type: 'done', device: 'webgpu' });
  assert.equal(model.getModelState().status, 'loading');
  const worker = WorkerDouble.instances[1];
  assert.equal(worker.messages.length, 1);
  worker.emit({ id: worker.messages[0].id, type: 'done', device: 'wasm' });
  await newLoad;
  const controller = new AbortController();
  const generation = model.generateText('Bonjour', { signal: controller.signal });
  const aborted = assert.rejects(generation, { name: 'AbortError' });
  controller.abort();
  await aborted;
  assert.equal(worker.terminated, true);
  assert.equal(model.getModelState().status, 'idle');
});

test('profile is explicit and switching terminates prior runtime', async t => {
  const model = await client(t);
  const init = model.initModel();
  const worker = WorkerDouble.instances[0];
  worker.emit({ id: worker.messages[0].id, type: 'done', device: 'wasm' });
  await init;
  const french = model.initModel(undefined, { profile: 'french' });
  assert.equal(worker.terminated, true);
  const second = WorkerDouble.instances[1];
  assert.equal(second.messages[0].profile, 'french');
  second.emit({ id: second.messages[0].id, type: 'error', phase: 'init', error: 'shader-f16 requis' });
  await assert.rejects(french, /shader-f16/);
  assert.equal(model.getModelState().status, 'error');
  assert.equal(model.getModelState().supportsVision, false);
});

test('photo is a separate opt-in model, unloads text and returns only unconfirmed candidates', async t => {
  const model = await client(t);
  const init = model.initModel();
  const textWorker = WorkerDouble.instances[0];
  textWorker.emit({ id: textWorker.messages[0].id, type: 'done', device: 'wasm' });
  await init;
  const progress = [];
  const resultPromise = model.describePhoto(new Blob(['image'], { type: 'image/jpeg' }), { onProgress: data => progress.push(data) });
  assert.equal(textWorker.terminated, true);
  const worker = WorkerDouble.instances[1];
  assert.equal(worker.messages[0].profile, 'vision');
  assert.equal(model.getModelState().profile, 'vision');
  assert.equal(model.getModelState().supportsVision, false);
  worker.emit({ id: worker.messages[0].id, type: 'progress', progress: { status: 'progress', progress: 30 } });
  worker.emit({ id: worker.messages[0].id, type: 'done', device: 'wasm' });
  await Promise.resolve();
  const photo = worker.messages[1];
  assert.equal(photo.type, 'photo');
  assert.ok(photo.image instanceof Blob);
  worker.emit({ id: photo.id, type: 'done', result: { description: 'apple; banana', candidates: ['apple', 'banana'], requiresConfirmation: true, model: 'HuggingFaceTB/SmolVLM-256M-Instruct' } });
  const result = await resultPromise;
  assert.deepEqual(result.candidates, ['apple', 'banana']);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(progress.length, 1);
  assert.equal(model.getModelState().supportsVision, true);
  await assert.rejects(model.generateText('Bonjour'), /modèle photo/);
  const restoreText = model.initModel();
  const restored = WorkerDouble.instances[2];
  assert.equal(restored.messages[0].profile, 'light');
  restored.emit({ id: restored.messages[0].id, type: 'done', device: 'wasm' });
  await restoreText;
});

test('photo validates input and pre-aborted signal before any download', async t => {
  const model = await client(t);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(model.describePhoto(new Blob(['photo'], { type: 'image/jpeg' }), { signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(model.describePhoto(new Blob(['photo'], { type: 'image/svg+xml' })), /Choisissez une photo/);
  await assert.rejects(model.describePhoto(new Blob([],{ type: 'image/jpeg' })), /Choisissez une photo/);
  assert.equal(WorkerDouble.instances.length, 0);
});

test('aborting photo activation terminates worker and ignores late initialization', async t => {
  const model = await client(t);
  const controller = new AbortController();
  const promise = model.describePhoto('data:image/jpeg;base64,aW1hZ2U=', { signal: controller.signal });
  const aborted = assert.rejects(promise, { name: 'AbortError' });
  const worker = WorkerDouble.instances[0];
  controller.abort();
  await aborted;
  worker.emit({ id: worker.messages[0].id, type: 'done', device: 'wasm' });
  assert.equal(worker.terminated, true);
  assert.equal(model.getModelState().status, 'idle');
  assert.equal(model.getModelState().supportsVision, false);
  assert.equal(worker.messages.length, 1);
});

test('vision worker uses the pinned three-component model and never treats candidates as confirmed', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../public/v2/model-worker.js', import.meta.url), 'utf8');
  const messages = [];
  const loads = [];
  const processor = async (prompt, images, options) => {
    assert.equal(images.length, 1);
    assert.equal(options.do_image_splitting, false);
    return { input_ids: { dims: [1, 42] }, pixel_values: 'pixels' };
  };
  processor.image_processor = {};
  processor.tokenizer = {};
  processor.apply_chat_template = () => 'image prompt';
  processor.batch_decode = () => ['apple; 200 kcal; unknown; banana'];
  const model = { generate: async options => {
    assert.equal(options.pixel_values, 'pixels');
    assert.equal(options.max_new_tokens, 64);
    return { slice: (dimension, range) => { assert.equal(range[0], 42); return 'generated IDs after prompt'; } };
  } };
  const testLibrary = {
    env: { backends: { onnx: { wasm: {} } } },
    AutoProcessor: { from_pretrained: async (id, options) => { loads.push({ id, options }); return processor; } },
    AutoModelForVision2Seq: { from_pretrained: async (id, options) => { loads.push({ id, options }); return model; } },
    RawImage: { fromCanvas: () => ({ rgb() { return this; } }) },
    TextStreamer: class {},
  };
  class CanvasDouble { constructor(width, height) { assert.ok(width <= 512 && height <= 512); } getContext() { return { drawImage() {} }; } }
  const self = {
    navigator: {}, postMessage: message => messages.push(message), OffscreenCanvas: CanvasDouble,
    createImageBitmap: async () => ({ width: 512, height: 320, close() {} }),
  };
  runInNewContext(source + '\nlibrary = testLibrary;', { self, testLibrary, Blob, OffscreenCanvas: CanvasDouble });
  await self.onmessage({ data: { id: 1, type: 'init', profile: 'vision' } });
  assert.equal(messages.at(-1).type, 'done');
  assert.equal(loads[1].id, 'HuggingFaceTB/SmolVLM-256M-Instruct');
  assert.equal(loads[1].options.revision, '7e3e67edbbed1bf9888184d9df282b700a323964');
  assert.equal(JSON.stringify(loads[1].options.dtype), JSON.stringify({ embed_tokens: 'q8', vision_encoder: 'q4', decoder_model_merged: 'q4' }));
  assert.equal(processor.image_processor.size.longest_edge, 512);
  await self.onmessage({ data: { id: 2, type: 'photo', image: new Blob(['image'], { type: 'image/jpeg' }) } });
  const result = messages.at(-1).result;
  assert.equal(JSON.stringify(result.candidates), JSON.stringify(['apple', 'banana']));
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.calories, undefined);
});

test('vision initialization rejects missing Worker image APIs before loading any library', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../public/v2/model-worker.js', import.meta.url), 'utf8');
  const messages = [];
  const self = { navigator: {}, postMessage: message => messages.push(message) };
  runInNewContext(source, { self });
  await self.onmessage({ data: { id: 1, type: 'init', profile: 'vision' } });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'error');
  assert.match(messages[0].error, /ne peut pas décoder les photos/);
});
