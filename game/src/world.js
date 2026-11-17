// world.js — the deterministic simulation of ECHOKEEPER. DOM-free.
// One small job: own every rule of the night — movement, bolts, echoes,
// enemies, waves, bosses, the dew economy and the win/lose conditions.

import { createRng, hashRunDigest } from './rng.js';
import { UPGRADES, priceOf, freshLevels, derivedStats, freshRunStats } from './upgrades.js';
import { pushMemory, memoryFrame, castEcho, stepEchoes } from './echoes.js';
import { spawnEnemy, spawnBoss, steerEnemy, waveComposition, waveHpScale, BOSSES } from './enemies.js';

export const WORLD_W = 1280, WORLD_H = 720;
export const DIFFICULTIES = {
  ember:   { id: 'ember',   name: 'EMBER',   mult: 1.0, hp: 0.85, dmg: 0.8,  note: 'a gentler night' },
  radiant: { id: 'radiant', name: 'RADIANT', mult: 1.5, hp: 1.0,  dmg: 1.0,  note: 'the true night' },
  eclipse: { id: 'eclipse', name: 'ECLIPSE', mult: 2.2, hp: 1.22, dmg: 1.25, note: 'for the fearless' },
};
const DT = 1 / 60;

export function createWorld(seed, difficultyId = 'radiant') {
  const w = {
    seed, rng: createRng(seed), tick: 0, time: 0,
    screen: 'title', paused: false, speed: 1, over: false,
    diff: DIFFICULTIES[difficultyId] || DIFFICULTIES.radiant,
    player: { x: 640, y: 470, hp: 120, maxHp: 120, fireTimer: 0, dashT: 0, dashCd: 0, invulnT: 0, aim: -Math.PI / 2, face: 1 },
    lantern: { x: 640, y: 360, hp: 380, maxHp: 380, hurtThisWave: false },
    enemies: [], bolts: [], ebolts: [], orbs: [], particles: [], texts: [], echoes: [],
    memory: [], levels: freshLevels(), stats: freshRunStats(),
    dew: 0, score: 0, streak: 0, streakT: 0,
    wave: 0, spawnQueue: [], spawnT: 0, bossRef: null,
    banner: { text: '', sub: '', t: 0 }, trauma: 0, events: [],
    selectedDiff: difficultyId in DIFFICULTIES ? difficultyId : 'radiant',
  };
  return w;
}

export function startRun(w, difficultyId) {
  const fresh = createWorld(w.seed, difficultyId || w.selectedDiff);
  const keepSeed = w.seed;
  Object.assign(w, fresh);
  w.seed = keepSeed;
  w.screen = 'play';
  beginWave(w, 1);
  w.events.push('wave');
  return w;
}

function beginWave(w, wave) {
  w.wave = wave;
  w.lantern.hurtThisWave = false;
  w.spawnQueue = waveComposition(wave).slice();
  // shuffle the pour order with the run's own stream
  for (let i = w.spawnQueue.length - 1; i > 0; i--) {
    const j = Math.floor(w.rng.next() * (i + 1));
    [w.spawnQueue[i], w.spawnQueue[j]] = [w.spawnQueue[j], w.spawnQueue[i]];
  }
  w.spawnT = 0.5;
  w.banner = { text: 'WAVE ' + wave, sub: wave === 12 ? 'the last dark' : BOSSES[wave] ? 'something vast approaches' : '', t: 2.2 };
  if (BOSSES[wave]) w.events.push('boss');
}

export function nextWave(w) {
  if (w.screen !== 'shop') return false;
  w.screen = 'play';
  beginWave(w, w.wave + 1);
  w.events.push('wave');
  return true;
}

export function buyUpgrade(w, id) {
  const up = UPGRADES.find((u) => u.id === id);
  if (!up) return false;
  const lvl = w.levels[id];
  if (lvl >= up.max) return false;
  const price = priceOf(up, lvl);
  if (w.dew < price) { w.events.push('deny'); return false; }
  w.dew -= price; w.stats.dewSpent += price; w.levels[id] = lvl + 1;
  if (id === 'ward') { w.lantern.maxHp += 40; w.lantern.hp = Math.min(w.lantern.maxHp, w.lantern.hp + 25 + 40); }
  if (id === 'vitality') { w.player.maxHp += 20; w.player.hp = Math.min(w.player.maxHp, w.player.hp + 20); }
  w.events.push('buy');
  return true;
}

function spawnFromQueue(w) {
  const item = w.spawnQueue.shift();
  const side = w.rng.int(0, 3);
  const m = 30;
  let x, y;
  if (side === 0) { x = w.rng.range(m, WORLD_W - m); y = -m; }
  else if (side === 1) { x = w.rng.range(m, WORLD_W - m); y = WORLD_H + m; }
  else if (side === 2) { x = -m; y = w.rng.range(m, WORLD_H - m); }
  else { x = WORLD_W + m; y = w.rng.range(m, WORLD_H - m); }
  const scale = waveHpScale(w.wave, w.diff.hp);
  if (item.startsWith('boss:')) {
    const b = spawnBoss(w.wave, 640, -60, w.diff.hp);
    b.wobble = w.rng.range(0, 6.28); b.shootT = 1.4;
    w.enemies.push(b); w.bossRef = b;
    w.banner = { text: b.name, sub: 'taunt it with your bolts — draw it off the lantern', t: 3 };
  } else {
    const e = spawnEnemy(item, x, y, scale);
    // per-run stream decides the flutter, so a seed fully determines a run
    e.wobble = w.rng.range(0, 6.28); e.shootT = 1.2 + w.rng.range(0, 1.6);
    w.enemies.push(e);
  }
}

function fireBolts(w, x, y, angle, damage, isEcho, hue) {
  const st = derivedStats(w.levels);
  const n = isEcho ? 1 : st.bolts;
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 0.13;
    const a = angle + spread;
    w.bolts.push({ x, y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, damage, r: 5, life: 1.1, echo: !!isEcho, hue: hue || 45 });
  }
  if (!isEcho) w.stats.shotsFired += n;
}

function burst(w, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = w.rng.range(0, Math.PI * 2), s = w.rng.range(speed * 0.3, speed);
    w.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: w.rng.range(0.25, 0.6), t: 0, color, r: w.rng.range(1.5, 3.5) });
  }
}

function floatText(w, x, y, text, color) {
  w.texts.push({ x, y, text, color, t: 0, life: 0.9 });
}

function killEnemy(w, e) {
  w.stats.kills++;
  w.streak++; w.streakT = 3;
  if (w.streak > w.stats.bestStreak) w.stats.bestStreak = w.streak;
  if (w.streak > 0 && w.streak % 10 === 0) { floatText(w, e.x, e.y - 24, 'STREAK x' + w.streak, '#ffe27a'); w.events.push('streak'); }
  const gained = Math.round(e.score * w.diff.mult * (1 + Math.min(0.5, w.streak * 0.01)));
  w.score += gained;
  const drops = e.boss ? 36 : e.dew;
  for (let i = 0; i < drops; i++) {
    const a = w.rng.range(0, Math.PI * 2), d = w.rng.range(2, 20);
    w.orbs.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, value: 1 });
  }
  burst(w, e.x, e.y, e.color, e.boss ? 42 : 10, 170);
  w.events.push('kill');
  if (e.kind === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const child = spawnEnemy('wisp', e.x + (i ? 14 : -14), e.y + (i ? -8 : 8), waveHpScale(w.wave, w.diff.hp));
      child.wobble = w.rng.range(0, 6.28);
      w.enemies.push(child);
    }
  }
  if (e.boss) {
    w.bossRef = null; w.trauma = Math.min(1, w.trauma + 0.5);
    floatText(w, e.x, e.y - 40, e.name + ' FALLS', '#ffe27a');
  }
}

function bossPhaseCheck(w, b) {
  const frac = b.hp / b.maxHp;
  const want = frac <= 0.33 ? 3 : frac <= 0.66 ? 2 : 1;
  if (want > b.phase) {
    b.phase = want;
    w.events.push('phase'); w.trauma = Math.min(1, w.trauma + 0.45);
    w.banner = { text: b.name + (want === 3 ? ' — ENRAGED' : ' — PHASE ' + want), sub: 'its pattern changes', t: 1.8 };
    // phase break: a radial ring the keeper must dash or weave through
    const n = 12 + want * 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      w.ebolts.push({ x: b.x, y: b.y, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, r: 6, damage: 8 * w.diff.dmg, life: 2.6 });
    }
    if (w.wave >= 8) { // later bosses call the gloom to them
      for (let i = 0; i < 3; i++) {
        const s = spawnEnemy(i === 0 ? 'veil' : 'moth', b.x + w.rng.range(-70, 70), b.y + w.rng.range(-70, 70), waveHpScale(w.wave, w.diff.hp));
        s.wobble = w.rng.range(0, 6.28);
        w.enemies.push(s);
      }
    }
  }
}

export function stepWorld(w, input) {
  w.tick++;
  if (w.banner.t > 0) w.banner.t -= DT;
  if (w.screen !== 'play') return w;
  if (input.pause) { w.paused = !w.paused; return w; }
  if (w.paused) return w;

  const st = derivedStats(w.levels);
  const P = w.player, L = w.lantern;
  w.time += DT; w.stats.timeSec += DT;
  w.trauma = Math.max(0, w.trauma - DT * 1.6);
  if (w.streakT > 0) { w.streakT -= DT; if (w.streakT <= 0) w.streak = 0; }

  // --- keeper movement and dash
  P.dashCd = Math.max(0, P.dashCd - DT);
  P.invulnT = Math.max(0, P.invulnT - DT);
  let mvx = input.mx, mvy = input.my;
  if (input.dash && P.dashCd <= 0) {
    P.dashT = 0.16; P.dashCd = st.dashCooldown; P.invulnT = Math.max(P.invulnT, 0.28);
    w.events.push('dash');
  }
  const dashing = P.dashT > 0; P.dashT = Math.max(0, P.dashT - DT);
  const spd = st.moveSpeed * (dashing ? 3.1 : 1);
  if (mvx === 0 && mvy === 0 && dashing) { mvx = Math.cos(P.aim); mvy = Math.sin(P.aim); }
  P.x = Math.min(WORLD_W - 18, Math.max(18, P.x + mvx * spd * DT));
  P.y = Math.min(WORLD_H - 18, Math.max(18, P.y + mvy * spd * DT));
  P.aim = Math.atan2(input.aimY - P.y, input.aimX - P.x);
  if (input.aimX !== P.x) P.face = input.aimX >= P.x ? 1 : -1;

  // --- memory and echoes: the keeper is always being remembered
  pushMemory(w.memory, memoryFrame(P.x, P.y, P.aim, input.fire));
  if (input.echo) {
    const e = castEcho(w.memory, st.echoCap, w.echoes, st.echoPower);
    if (e) { w.echoes.push(e); w.stats.echoesMade++; w.events.push('echo'); burst(w, e.x, e.y, '#7dffd4', 14, 120); }
    else w.events.push('echoFail');
  }
  for (const order of stepEchoes(w.echoes, st.fireInterval)) {
    fireBolts(w, order.x, order.y, order.angle, st.damage * order.power, true, order.hue);
    w.events.push('echoShoot');
  }

  // --- keeper fire
  P.fireTimer -= DT;
  if (input.fire && P.fireTimer <= 0) {
    P.fireTimer = st.fireInterval;
    fireBolts(w, P.x, P.y, P.aim, st.damage, false);
    w.events.push('shoot');
  }

  // --- spawning
  if (w.spawnQueue.length) {
    w.spawnT -= DT;
    if (w.spawnT <= 0) { spawnFromQueue(w); w.spawnT = Math.max(0.28, 0.95 - w.wave * 0.045); }
  }

  // --- enemies
  for (const e of w.enemies) {
    if (e.flash > 0) e.flash -= DT;
    if (e.aggroT > 0) e.aggroT -= DT;
    if (e.kind === 'veil' || (e.boss && e.shieldMax > 0)) {
      e.shieldRegenT -= DT;
      if (e.shieldRegenT <= 0 && e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + 14 * DT);
    }
    const wantsShot = steerEnemy(e, w, DT);
    e.x += e.vx * DT; e.y += e.vy * DT;
    if (wantsShot) {
      if (e.boss) {
        const n = 7 + e.phase * 2;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + w.tick * 0.02;
          w.ebolts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 6, damage: 8 * w.diff.dmg, life: 2.6 });
        }
        if (e.phase >= 2) { // aimed volley at the keeper
          const a = Math.atan2(P.y - e.y, P.x - e.x);
          for (let k = -1; k <= 1; k++) w.ebolts.push({ x: e.x, y: e.y, vx: Math.cos(a + k * 0.16) * 230, vy: Math.sin(a + k * 0.16) * 230, r: 6, damage: 8 * w.diff.dmg, life: 3 });
        }
      } else {
        const a = Math.atan2(P.y - e.y, P.x - e.x);
        w.ebolts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 215, vy: Math.sin(a) * 215, r: 6, damage: 9 * w.diff.dmg, life: 3 });
      }
    }
    // reach the lantern?
    const dL = Math.hypot(L.x - e.x, L.y - e.y);
    if (dL < e.radius + 34) {
      if (e.boss) {
        e.touchT = (e.touchT || 0) - DT;
        if (e.touchT <= 0) { e.touchT = 0.55; L.hp -= 9; L.hurtThisWave = true; w.events.push('lanternHit'); w.trauma = Math.min(1, w.trauma + 0.22); }
        e.x -= (L.x - e.x) * 0.02; e.y -= (L.y - e.y) * 0.02;
      } else {
        e.hp = 0; L.hp -= e.damage * w.diff.dmg; L.hurtThisWave = true;
        w.events.push('lanternHit'); w.trauma = Math.min(1, w.trauma + 0.18);
        burst(w, e.x, e.y, '#ff9d5c', 8, 130);
      }
    }
    // reach the keeper?
    const dP = Math.hypot(P.x - e.x, P.y - e.y);
    if (dP < e.radius + 15 && P.invulnT <= 0) {
      e.touchT = (e.touchT || 0) - DT;
      if (e.touchT <= 0) {
        e.touchT = 0.7; P.hp -= e.damage * w.diff.dmg; P.invulnT = 0.45;
        w.events.push('hurt'); w.trauma = Math.min(1, w.trauma + 0.2);
        burst(w, P.x, P.y, '#ff6b6b', 8, 140);
      }
    } else if (e.touchT > 0) e.touchT -= DT;
  }
  // gentle separation so swarms read as individuals
  for (let i = 0; i < w.enemies.length; i++) for (let j = i + 1; j < w.enemies.length; j++) {
    const a = w.enemies[i], b = w.enemies[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.radius + b.radius;
    if (d > 0 && d < min) { const push = (min - d) * 0.5; const ux = dx / d, uy = dy / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
  }

  // --- bolts vs enemies
  for (const bolt of w.bolts) {
    bolt.x += bolt.vx * DT; bolt.y += bolt.vy * DT; bolt.life -= DT;
    if (bolt.life <= 0) continue;
    for (const e of w.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - bolt.x, e.y - bolt.y) < e.radius + bolt.r) {
        bolt.life = 0;
        if (!bolt.echo) w.stats.shotsHit++;
        let dmg = bolt.damage;
        if (e.shield > 0) { const absorbed = Math.min(e.shield, dmg); e.shield -= absorbed; dmg -= absorbed; e.shieldRegenT = 2.5; }
        if (dmg > 0) { e.hp -= dmg; e.flash = 0.09; }
        if (e.boss && !bolt.echo) e.aggroT = 3.5; // taunt: bolts draw the boss onto the keeper
        w.events.push('hit');
        if (e.hp <= 0) killEnemy(w, e);
        else if (e.boss) bossPhaseCheck(w, e);
        break;
      }
    }
  }
  w.bolts = w.bolts.filter((b) => b.life > 0 && b.x > -30 && b.x < WORLD_W + 30 && b.y > -30 && b.y < WORLD_H + 30);
  w.enemies = w.enemies.filter((e) => e.hp > 0);
  if (w.bossRef && w.bossRef.hp <= 0) w.bossRef = null;

  // --- enemy bolts vs keeper
  for (const b of w.ebolts) {
    b.x += b.vx * DT; b.y += b.vy * DT; b.life -= DT;
    if (b.life > 0 && P.invulnT <= 0 && Math.hypot(P.x - b.x, P.y - b.y) < 15 + b.r) {
      b.life = 0; P.hp -= b.damage; P.invulnT = 0.4;
      w.events.push('hurt'); w.trauma = Math.min(1, w.trauma + 0.16);
    }
  }
  w.ebolts = w.ebolts.filter((b) => b.life > 0 && b.x > -40 && b.x < WORLD_W + 40 && b.y > -40 && b.y < WORLD_H + 40);

  // --- dew orbs drift home
  for (const o of w.orbs) {
    const d = Math.hypot(P.x - o.x, P.y - o.y);
    if (d < 175) { o.vx += ((P.x - o.x) / (d || 1)) * 700 * DT; o.vy += ((P.y - o.y) / (d || 1)) * 700 * DT; }
    o.vx *= 0.92; o.vy *= 0.92;
    o.x += o.vx * DT + (d < 175 ? (P.x - o.x) * 2.4 * DT : 0);
    o.y += o.vy * DT + (d < 175 ? (P.y - o.y) * 2.4 * DT : 0);
    if (d < 22) { o.got = true; w.dew += o.value; w.stats.dewEarned += o.value; w.events.push('dew'); }
  }
  w.orbs = w.orbs.filter((o) => !o.got);

  // --- particles and floating text
  for (const p of w.particles) { p.t += DT; p.x += p.vx * DT; p.y += p.vy * DT; p.vx *= 0.94; p.vy *= 0.94; }
  w.particles = w.particles.filter((p) => p.t < p.life);
  for (const t of w.texts) { t.t += DT; t.y -= 34 * DT; }
  w.texts = w.texts.filter((t) => t.t < t.life);

  // --- win / lose / wave flow
  if (L.hp <= 0 || P.hp <= 0) {
    L.hp = Math.max(0, L.hp); P.hp = Math.max(0, P.hp);
    w.screen = 'defeat'; w.over = true;
    w.events.push('lose');
    return w;
  }
  if (!w.spawnQueue.length && w.enemies.length === 0 && !w.bossRef) {
    w.stats.wavesCleared = w.wave;
    if (!L.hurtThisWave) { w.stats.flawlessWaves++; w.score += 250; floatText(w, L.x, L.y - 60, 'FLAWLESS WAVE +250', '#7dffd4'); }
    if (w.wave >= 12) {
      w.screen = 'victory'; w.over = true; w.score += Math.round(L.hp * 2);
      w.events.push('win');
    } else {
      const wage = 10 + w.wave * 3;
      w.dew += wage; w.stats.dewEarned += wage;
      // a held wave mends the keeper: chip damage must not be a death sentence
      P.hp = Math.min(P.maxHp, P.hp + 35);
      w.screen = 'shop';
      w.banner = { text: 'WAVE ' + w.wave + ' HELD', sub: 'the dew shop opens — wage +' + wage + ' dew', t: 2 };
    }
  }
  return w;
}

export function worldDigest(w) {
  return hashRunDigest([
    w.tick, w.score, w.stats.kills, Math.round(w.player.x), Math.round(w.player.y),
    Math.round(w.lantern.hp), w.enemies.length, w.echoes.length, w.dew, w.wave,
  ]);
}
