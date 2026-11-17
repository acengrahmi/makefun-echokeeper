// director.js — the autopilot policy and the staged screenshot scenes.
// One small job: prove the game is winnable by playing it with a policy
// (which itself choreographs echoes), and pose the four dossier scenes.

import { derivedStats } from './upgrades.js';
import { spawnEnemy, spawnBoss } from './enemies.js';
import { startRun, buyUpgrade } from './world.js';

const IDLE = { mx: 0, my: 0, aimX: 640, aimY: 200, fire: false, dash: false, echo: false, pause: false, mute: false, speed: 0, confirm: false, click: false, clickX: 0, clickY: 0 };

// The policy: guard the lantern from its threatened side, keep a firing
// distance, harvest dew when safe, dash out of trouble — and RECORD echoes:
// after six seconds of fighting it casts a ghost, then repositions and
// records the next, building a chorus the way a good player would.
export function autopilotInput(w) {
  if (w.screen !== 'play' || w.paused) return { ...IDLE };
  const P = w.player, L = w.lantern, st = derivedStats(w.levels);
  const f = { ...IDLE };
  // nearest foe and the centroid of the swarm
  let near = null, nd = 1e9, cx = 0, cy = 0;
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - P.x, e.y - P.y);
    if (d < nd) { nd = d; near = e; }
    cx += e.x; cy += e.y;
  }
  if (w.enemies.length) { cx /= w.enemies.length; cy /= w.enemies.length; }
  // stand on the lantern's threatened side, at guard distance
  let gx = L.x + 150, gy = L.y + 90;
  if (w.enemies.length) {
    const a = Math.atan2(cy - L.y, cx - L.x);
    const gd = w.bossRef ? 195 : 165;
    gx = L.x + Math.cos(a) * gd; gy = L.y + Math.sin(a) * gd;
  }
  let mx = gx - P.x, my = gy - P.y;
  // flee anything point blank, sidestep incoming bolts
  if (near && nd < 85) { mx += (P.x - near.x) * 2.2; my += (P.y - near.y) * 2.2; }
  // lungers telegraph: a winding-up shade or a circling darter near the
  // guard post means the lantern line is about to be crossed — dash clear.
  for (const e of w.enemies) {
    if ((e.state === 'windup' || e.state === 'circle' || e.state === 'lunge') && Math.hypot(e.x - P.x, e.y - P.y) < 170) {
      mx += (P.x - e.x) * 2.6; my += (P.y - e.y) * 2.6; f.dash = true;
    }
  }
  for (const b of w.ebolts) {
    const d = Math.hypot(b.x - P.x, b.y - P.y);
    if (d < 80) { mx += -(b.vy) * 0.02 * (80 - d); my += (b.vx) * 0.02 * (80 - d); if (d < 60) f.dash = true; }
  }
  // a boss about to loose a radial ring: back straight off to open a gap
  if (w.bossRef && w.bossRef.shootT < 0.3) {
    const bx = P.x - w.bossRef.x, by = P.y - w.bossRef.y, bl = Math.hypot(bx, by) || 1;
    mx += (bx / bl) * 200; my += (by / bl) * 200;
  }
  // harvest dew when the coast is clear
  if ((!near || nd > 260) && w.orbs.length) {
    let orb = null, od = 1e9;
    for (const o of w.orbs) { const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < od) { od = d; orb = o; } }
    if (orb) { mx = orb.x - P.x; my = orb.y - P.y; }
  }
  // constant orbital drift around the lantern: a moving keeper is hard for
  // radial rings and lungers to line up on, and it sweeps the guard arc.
  if (w.enemies.length) {
    const ox = P.x - L.x, oy = P.y - L.y, ol = Math.hypot(ox, oy) || 1;
    mx += (-oy / ol) * 120; my += (ox / ol) * 120;
  }
  const ml = Math.hypot(mx, my);
  if (ml > 12) { f.mx = mx / ml; f.my = my / ml; }
  // target priority: whatever is about to reach the lantern dies first;
  // then a boss must be taunted off the lantern with steady bolt fire.
  let leak = null, leakD = 1e9;
  for (const e of w.enemies) { const d = Math.hypot(e.x - L.x, e.y - L.y); if (d < leakD) { leakD = d; leak = e; } }
  const aimTarget = (leak && leakD < 170 && leak !== w.bossRef) ? leak : (w.bossRef && nd > 110) ? w.bossRef : near;
  if (aimTarget) {
    const td = Math.hypot(aimTarget.x - P.x, aimTarget.y - P.y);
    const lead = Math.min(0.35, td / 560);
    f.aimX = aimTarget.x + aimTarget.vx * lead; f.aimY = aimTarget.y + aimTarget.vy * lead;
    f.fire = td < 600;
    if (nd < 62) f.dash = true;
  } else { f.aimX = P.x + 40; f.aimY = P.y - 120; }
  // the signature move: cast an echo whenever the chorus has room and the
  // memory is full — roughly every six seconds of real fighting.
  if (w.memory.length >= 360 && w.echoes.length < st.echoCap && w.tick % 37 === 0) f.echo = true;
  return f;
}

// Shop policy: a sensible shopping list, echoes first — they multiply us.
export function autopilotShop(w) {
  const order = ['echocap', 'echopower', 'damage', 'ward', 'vitality', 'firerate', 'multishot', 'dash'];
  for (const id of order) {
    if (buyUpgrade(w, id)) return id;
  }
  return null;
}

function syntheticEcho(cx, cy, radius, aimX, aimY, phase, power, hue) {
  const frames = [];
  for (let i = 0; i < 360; i++) {
    const a = phase + i * 0.016;
    const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius * 0.72;
    frames.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, a: Math.round(Math.atan2(aimY - y, aimX - x) * 1000) / 1000, f: i % 5 === 4 ? 0 : 1 });
  }
  return { frames, cursor: Math.floor(phase * 100) % 360, x: frames[0].x, y: frames[0].y, aim: frames[0].a, firing: true, power, fireTimer: 0, age: 0, hue };
}

// Pose a named scene deterministically; main.js ?shot= uses these, and the
// logic tests assert each lands on the screen it claims to show.
export function stageScene(w, name) {
  if (name === 'title') { w.screen = 'title'; return w; }
  startRun(w, 'radiant');
  if (name === 'shop') {
    w.wave = 7; w.screen = 'shop';
    w.dew = 167; w.stats.dewEarned = 320; w.stats.kills = 141; w.score = 12480;
    w.levels.damage = 2; w.levels.firerate = 1; w.levels.echocap = 1; w.levels.echopower = 1;
    w.lantern.hp = 244;
    return w;
  }
  if (name === 'victory') {
    w.screen = 'victory'; w.over = true;
    w.wave = 12; w.score = 31280; w.dew = 512;
    w.stats.kills = 231; w.stats.timeSec = 547; w.stats.dewEarned = 640; w.stats.bestStreak = 38;
    w.stats.flawlessWaves = 5; w.stats.shotsFired = 1240; w.stats.shotsHit = 533; w.stats.echoesMade = 14;
    w.lantern.hp = 205; w.lantern.maxHp = 380;
    return w;
  }
  // 'play': the finale — Gloamheart in phase 2, a chorus of three echoes
  // firing in formation, a live streak, the full HUD burning bright.
  w.wave = 12; w.score = 19377; w.dew = 86; w.streak = 23; w.streakT = 3;
  w.stats.kills = 208; w.levels.damage = 3; w.levels.firerate = 2; w.levels.echocap = 2; w.levels.echopower = 2; w.levels.multishot = 1;
  w.lantern.hp = 212;
  const boss = spawnBoss(12, 640, 168, 1.0);
  boss.hp = Math.round(boss.maxHp * 0.55); boss.phase = 2; boss.aggroT = 3;
  w.enemies.push(boss); w.bossRef = boss;
  const kinds = ['moth', 'moth', 'wisp', 'wisp', 'veil', 'darter', 'spitter', 'shade', 'splitter'];
  const spots = [[210, 150], [1060, 130], [150, 420], [1110, 430], [420, 110], [880, 120], [300, 600], [990, 610], [520, 640]];
  kinds.forEach((k, i) => { const e = spawnEnemy(k, spots[i][0], spots[i][1], 2.4); w.enemies.push(e); });
  w.player.x = 470; w.player.y = 478; w.player.hp = 78;
  w.echoes.push(syntheticEcho(640, 360, 128, 640, 168, 0.4, 0.85, 168));
  w.echoes.push(syntheticEcho(640, 360, 196, 640, 168, 2.6, 0.85, 204));
  w.echoes.push(syntheticEcho(640, 360, 92, 640, 168, 4.4, 0.85, 240));
  for (let i = 0; i < 14; i++) w.orbs.push({ x: 300 + i * 52, y: 560 + (i % 3) * 26, vx: 0, vy: 0, value: 1 });
  w.banner = { text: '', sub: '', t: 0 };
  return w;
}
