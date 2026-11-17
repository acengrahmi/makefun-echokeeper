// capture.mjs — take the four dossier screenshots with headless Chromium.
// Fails loudly on any console error or any request outside localhost.
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchPage } from './cdp.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const PORT = 8901;
const SCENES = [
  ['1-play.jpg', 'play'], ['2-title.jpg', 'title'], ['3-shop.jpg', 'shop'], ['4-victory.jpg', 'victory'],
];

const server = spawn('node', [join(here, 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
let failures = 0;
try {
  await mkdir(join(root, 'screenshots'), { recursive: true });
  for (const [file, scene] of SCENES) {
    const page = await launchPage(PORT);
    await page.navigate(`http://localhost:${PORT}/?shot=${scene}&seed=7`);
    await page.waitFor('window.__shotReady === true');
    await new Promise((r) => setTimeout(r, 350));
    let quality = 84, buf = await page.screenshotJpeg(quality);
    while (buf.length > 250 * 1024 && quality > 40) { quality -= 12; buf = await page.screenshotJpeg(quality); }
    await writeFile(join(root, 'screenshots', file), buf);
    console.log(`${file}: ${buf.length} bytes @q${quality} | console errors: ${page.errors.length} | external: ${page.external.length}`);
    if (page.errors.length) { failures++; console.log('  ERRORS:', page.errors.slice(0, 4)); }
    if (page.external.length) { failures++; console.log('  EXTERNAL:', page.external.slice(0, 4)); }
    await page.close();
  }
} finally { server.kill('SIGKILL'); }
if (failures) { console.error('CAPTURE GATE FAILED'); process.exit(1); }
console.log('capture ok: 4 scenes, 0 console errors, 0 external requests');
