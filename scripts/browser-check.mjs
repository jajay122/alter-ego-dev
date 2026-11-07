const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
await mkdir(root + '/artifacts', { recursive: true });
await writeFile(root + '/artifacts/red.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAA0klEQVR4nO3QsREAEADAQOy/MxtISfE/QS5zD27W64DfGRQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBgUDAoGBQMCgYFg4JBwaBwAAu8Ab/pmXzXAAAAAElFTkSuQmCC', 'base64'));
const password = randomBytes(24).toString('hex');
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, ASSISTANT_PASSWORD: password, PORT: '3300', HOST: '127.0.0.1', MODEL_URL: 'http://127.0.0.1:8081', NODE_USE_ENV_PROXY: '1' }, stdio: ['ignore', 'ignore', 'pipe'] });
server.stderr.on('data', () => {});
let browser;
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch('http://127.0.0.1:3300/')).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3300/assistant');
  await page.locator('#password').fill('incorrect');
  await page.getByRole('button', { name: /Entrer/ }).click();
  await page.getByText('Le mot de passe est incorrect.').waitFor();
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /Entrer/ }).click();
  await page.getByRole('button', { name: 'Question', exact: true }).waitFor();
  await page.getByText('◎ Modèle prêt', { exact: true }).waitFor();
  await page.locator('#prompt').fill('What is 2 + 2? Reply with only the number.');
  await page.locator('#submit').click();
  await page.locator('#result:not([hidden])').waitFor({ timeout: 70_000 });
  const textAnswer = await page.locator('#answer').innerText();
  if (!textAnswer.includes('4')) throw new Error('Unexpected real text answer');
  await page.getByRole('button', { name: 'Photo', exact: true }).click();
  await page.locator('#photo').setInputFiles(root + '/artifacts/red.png');
  await page.locator('#preview:not([hidden])').waitFor();
  await page.locator('#prompt').fill('What color is this image? Answer in one word.');
  await page.locator('#submit').click();
  await page.locator('#result:not([hidden])').waitFor({ timeout: 70_000 });
  const photoAnswer = await page.locator('#answer').innerText();
  if (!/red|rouge/i.test(photoAnswer)) throw new Error('Unexpected real photo answer');
  await page.screenshot({ path: root + '/artifacts/mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal scroll on Android-sized screen');
  await page.getByRole('button', { name: 'Internet', exact: true }).click();
  await page.locator('#prompt').fill('panneau solaire');
  await page.locator('#submit').click();
  await page.locator('#result:not([hidden])').waitFor({ timeout: 70_000 });
  const sources = await page.locator('#sources a').count();
  if (sources < 1) throw new Error('Missing real sources');
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.screenshot({ path: root + '/artifacts/desktop.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal scroll on desktop');
  await page.getByRole('button', { name: /Verrouiller/ }).click();
  await page.locator('#login-panel:not([hidden])').waitFor();
  if (!await page.locator('#result').isHidden()) throw new Error('Private result remains visible');
  if (errors.length) throw new Error(JSON.stringify(errors));
  const summary = { realTextAnswer: textAnswer, realPhotoAnswer: photoAnswer, realWebSources: sources, mobileWidth: 360, desktopWidth: 1365, horizontalOverflow: false, logoutClearsResults: true, pageErrors: errors };
  await writeFile(root + '/artifacts/browser-check.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
