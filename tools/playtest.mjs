// playtest.mjs — play ECHOKEEPER with real input events in headless
// Chromium: begin, move + fire for a kill, cast an echo with E, pause/resume.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchPage } from './cdp.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const PORT = 8902;
const server = spawn('node', [join(here, 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const checks = [];
const check = (name, ok, extra = '') => { checks.push([name, ok]); console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : '')); };
try {
  const page = await launchPage(PORT);
  await page.navigate(`http://localhost:${PORT}/?seed=11`);
  await page.waitFor('!!window.__game');
  await new Promise((r) => setTimeout(r, 400));
  check('title screen shown', await page.evaluate('window.__game.world.screen') === 'title');
  // click BEGIN THE NIGHT (640, 556)
  await page.mouse('mousePressed', 640, 556); await page.mouse('mouseReleased', 640, 556);
  await new Promise((r) => setTimeout(r, 350));
  check('run starts on click', await page.evaluate('window.__game.world.screen') === 'play');
  // hold D and fire toward the right edge for ~4 seconds of real time
  await page.key('keyDown', 'KeyD', 68);
  await page.mouse('mouseMoved', 1200, 360);
  await page.mouse('mousePressed', 1200, 360, 'left', 1);
  await new Promise((r) => setTimeout(r, 4200));
  await page.mouse('mouseReleased', 1200, 360);
  await page.key('keyUp', 'KeyD', 68);
  const moved = await page.evaluate('window.__game.world.player.x');
  check('keeper moved with D', moved > 660, 'player.x=' + Math.round(moved));
  const kills = await page.evaluate('window.__game.world.stats.kills');
  const score = await page.evaluate('window.__game.world.score');
  check('fire kills and scores', kills >= 1 && score > 0, `kills=${kills} score=${score}`);
  // if the wave ended, click FACE WAVE like a player would
  if (await page.evaluate('window.__game.world.screen') === 'shop') {
    await page.mouse('mousePressed', 640, 635); await page.mouse('mouseReleased', 640, 635);
    await new Promise((r) => setTimeout(r, 300));
  }
  check('back in play for the echo test', await page.evaluate('window.__game.world.screen') === 'play');
  // memory should be filling; force-cast readiness is proven headlessly, here
  // we verify the E key path creates an echo once memory is long enough:
  await page.evaluate('window.__game.world.memory.length = 0'); // reset, then refill
  await page.mouse('mouseMoved', 200, 200);
  await page.mouse('mousePressed', 200, 200, 'left', 1);
  // wait until the memory is full, clicking through any shop that opens
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const s = await page.evaluate('window.__game.world.screen');
    if (s === 'shop') {
      await page.mouse('mouseReleased', 200, 200);
      await page.mouse('mousePressed', 640, 635); await page.mouse('mouseReleased', 640, 635);
      await page.mouse('mouseMoved', 200, 200);
      await page.mouse('mousePressed', 200, 200, 'left', 1);
    }
    if (s === 'play' && (await page.evaluate('window.__game.world.memory.length')) >= 360) break;
  }
  await page.mouse('mouseReleased', 200, 200);
  check('memory refilled to 6 s in live play', (await page.evaluate('window.__game.world.memory.length')) >= 360);
  await page.key('keyDown', 'KeyE', 69); await page.key('keyUp', 'KeyE', 69);
  await new Promise((r) => setTimeout(r, 400));
  const echoes = await page.evaluate('window.__game.world.echoes.length');
  check('E casts a replaying echo', echoes >= 1, 'echoes=' + echoes);
  // pause and resume with P
  await page.key('keyDown', 'KeyP', 80); await page.key('keyUp', 'KeyP', 80);
  await new Promise((r) => setTimeout(r, 250));
  check('P pauses', await page.evaluate('window.__game.world.paused') === true);
  await page.key('keyDown', 'KeyP', 80); await page.key('keyUp', 'KeyP', 80);
  await new Promise((r) => setTimeout(r, 250));
  check('P resumes', await page.evaluate('window.__game.world.paused') === false);
  check('zero console errors', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  check('zero external requests', page.external.length === 0, page.external.slice(0, 3).join(' | '));
  await page.close();
} finally { server.kill('SIGKILL'); }
const failed = checks.filter(([, ok]) => !ok).length;
console.log(`playtest: ${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
