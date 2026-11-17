// main.js — boot ECHOKEEPER: wire input, audio, simulation and renderer
// into a fixed-step loop, route screen clicks, and stage ?shot= scenes.

import { createWorld, startRun, stepWorld, nextWave, buyUpgrade, worldDigest, DIFFICULTIES } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageScene, autopilotInput } from './director.js';
import { TITLE_LAYOUT, SHOP_LAYOUT, END_LAYOUT, rectContains } from './screens.js';
import { UPGRADES } from './upgrades.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');

const world = createWorld(seed, 'radiant');
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);
let muted = false;

function saveBest() {
  try {
    const best = Number(localStorage.getItem('echokeeper-best') || 0);
    if (world.score > best) localStorage.setItem('echokeeper-best', String(world.score));
  } catch { /* private mode: the night goes unrecorded */ }
}

function drainEvents() {
  for (const ev of world.events) {
    if (ev === 'shoot' && world.tick % 2) continue; // thin out the chatter
    if (ev === 'echoShoot' && world.tick % 3) continue;
    audio.play(ev);
    if (ev === 'win' || ev === 'lose') saveBest();
  }
  world.events.length = 0;
}

function routeClick(f) {
  if (!f.click) return;
  audio.unlock();
  const { clickX: x, clickY: y } = f;
  if (world.screen === 'title') {
    const ids = Object.keys(DIFFICULTIES);
    TITLE_LAYOUT.difficultyCards.forEach((r, i) => { if (rectContains(r, x, y)) world.selectedDiff = ids[i]; });
    if (rectContains(TITLE_LAYOUT.beginButton, x, y)) startRun(world, world.selectedDiff);
  } else if (world.screen === 'shop') {
    for (const card of SHOP_LAYOUT.cards) if (rectContains(card, x, y)) buyUpgrade(world, card.id);
    if (rectContains(SHOP_LAYOUT.nextButton, x, y)) nextWave(world);
  } else if (world.screen === 'victory' || world.screen === 'defeat') {
    if (rectContains(END_LAYOUT.againButton, x, y)) startRun(world, world.selectedDiff);
  }
}

function routeKeys(f) {
  if (f.mute) muted = audio.toggleMute();
  if (f.speed) world.speed = f.speed;
  if (f.confirm) {
    audio.unlock();
    if (world.screen === 'title') startRun(world, world.selectedDiff);
    else if (world.screen === 'shop') nextWave(world);
    else if (world.screen === 'victory' || world.screen === 'defeat') startRun(world, world.selectedDiff);
  }
}

// Screenshot staging: pose the scene, then let it live for a moment so the
// frame shows motion — bolts mid-flight, echoes mid-loop, wings mid-flap.
if (shotName) {
  stageScene(world, shotName);
  const warm = { mx: 0, my: 0, aimX: 640, aimY: 168, fire: true, dash: false, echo: false, pause: false, mute: false, speed: 0, confirm: false, click: false, clickX: 0, clickY: 0 };
  const steps = shotName === 'play' ? 50 : 24;
  for (let i = 0; i < steps; i++) stepWorld(world, shotName === 'play' ? warm : { ...warm, fire: false });
  if (shotName === 'play' && world.bossRef) {
    // re-pin the finale after the warm-up: the boss mid-barrage at the top
    // of the glade, phase 2, unwounded by the posing, banner silent.
    const b = world.bossRef;
    b.x = 640; b.y = 185; b.hp = Math.round(b.maxHp * 0.55); b.phase = 2; b.flash = 0; b.aggroT = 3;
    world.banner = { text: '', sub: '', t: 0 };
    world.ebolts.length = 0;
    for (let i = 0; i < 10; i++) stepWorld(world, warm); // fresh bolts in flight
    b.x = 640; b.y = 185; b.flash = 0;
  }
  world.events.length = 0;
  renderer.draw(world, false);
}

window.__game = { world, stepWorld, startRun, stageScene, autopilotInput, buyUpgrade, nextWave, worldDigest, input, UPGRADES };

let last = performance.now(), acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  acc += Math.min(100, now - last); last = now;
  const stepMs = 1000 / 60;
  let guard = 0;
  while (acc >= stepMs && guard++ < 6) {
    acc -= stepMs;
    const f = input.frame(world.player.x, world.player.y);
    routeKeys(f); routeClick(f);
    const reps = world.screen === 'play' && !world.paused ? world.speed : 1;
    for (let r = 0; r < reps; r++) stepWorld(world, f);
    drainEvents();
  }
  audio.update(Math.min(1, world.enemies.length / 22));
  renderer.draw(world, muted);
}
if (!shotName) requestAnimationFrame(loop);
else window.__shotReady = true;
