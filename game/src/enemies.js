// enemies.js — the gloom's creatures and the three great bosses.
// One small job: define every foe's body and behaviour. Seven kinds with
// distinct movement brains, plus bosses that duel the keeper for the lantern.

export const ENEMY_KINDS = {
  moth:    { hp: 12, speed: 62,  radius: 13, damage: 6,  dew: 1, score: 40,  color: '#c9a86a', name: 'Moth' },
  wisp:    { hp: 8,  speed: 96,  radius: 10, damage: 5,  dew: 1, score: 55,  color: '#7fe3ff', name: 'Wisp' },
  shade:   { hp: 26, speed: 54,  radius: 15, damage: 16, dew: 2, score: 90,  color: '#8f7bff', name: 'Shade' },
  spitter: { hp: 20, speed: 44,  radius: 14, damage: 8,  dew: 2, score: 110, color: '#ff9d5c', name: 'Spitter' },
  splitter:{ hp: 30, speed: 50,  radius: 17, damage: 10, dew: 2, score: 100, color: '#7dff9a', name: 'Splitter' },
  veil:    { hp: 34, speed: 46,  radius: 15, damage: 12, dew: 3, score: 140, color: '#ffd75c', name: 'Veil' },
  darter:  { hp: 16, speed: 78,  radius: 11, damage: 12, dew: 2, score: 120, color: '#ff6b9d', name: 'Darter' },
  brute:   { hp: 95, speed: 30,  radius: 24, damage: 24, dew: 5, score: 260, color: '#b06a4f', name: 'Brute' },
};

export const BOSSES = {
  4:  { name: 'MOTHMOTHER',    hp: 540,  radius: 40, speed: 30, color: '#e8c87a', score: 1500 },
  8:  { name: 'THE VEILWARDEN', hp: 1050, radius: 46, speed: 27, color: '#ffe27a', score: 3000 },
  12: { name: 'GLOAMHEART',    hp: 2050, radius: 54, speed: 24, color: '#ff8a5c', score: 6000 },
};

let enemySeq = 1;

export function spawnEnemy(kind, x, y, hpScale) {
  const base = ENEMY_KINDS[kind];
  return {
    id: enemySeq++, kind, x, y, vx: 0, vy: 0,
    hp: Math.round(base.hp * hpScale), maxHp: Math.round(base.hp * hpScale),
    speed: base.speed, radius: base.radius, damage: base.damage,
    dew: base.dew, score: base.score, color: base.color,
    state: 'chase', stateT: 0, shootT: 1.2 + (enemySeq % 7) * 0.23,
    shield: kind === 'veil' ? 16 * hpScale : 0, shieldMax: kind === 'veil' ? 16 * hpScale : 0,
    shieldRegenT: 0, wobble: (enemySeq * 47) % 628 / 100, flash: 0, aggroT: 0,
    boss: false, phase: 1,
  };
}

export function spawnBoss(wave, x, y, hpScale) {
  const base = BOSSES[wave];
  const b = spawnEnemy('brute', x, y, 1);
  b.kind = 'boss'; b.boss = true; b.name = base.name;
  b.hp = b.maxHp = Math.round(base.hp * hpScale);
  b.radius = base.radius; b.speed = base.speed; b.color = base.color;
  b.score = base.score; b.dew = 40; b.damage = 30; b.wave = wave;
  b.shield = wave === 8 ? 200 : 0; b.shieldMax = b.shield;
  return b;
}

// One behaviour brain per kind. Writes velocity intent into e.vx/e.vy and
// returns 'shoot' when a ranged foe wants to fire this tick.
export function steerEnemy(e, world, dt) {
  const L = world.lantern;
  const P = world.player;
  // Bosses and taunted foes hunt the keeper; the rest hunger for the lantern.
  const huntPlayer = e.boss ? e.aggroT > 0 : (e.kind === 'darter' && e.state === 'lunge');
  const tx = huntPlayer ? P.x : L.x, ty = huntPlayer ? P.y : L.y;
  const dx = tx - e.x, dy = ty - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist, uy = dy / dist;
  e.stateT -= dt;
  let wantShoot = false;

  switch (e.kind) {
    case 'moth': { // flutters straight in, wobbling
      const w = Math.sin(world.tick * 0.11 + e.wobble) * 0.55;
      e.vx = (ux - uy * w) * e.speed; e.vy = (uy + ux * w) * e.speed; break;
    }
    case 'wisp': { // fast, drifts in a slow sine weave
      const w = Math.sin(world.tick * 0.05 + e.wobble) * 0.4;
      e.vx = (ux - uy * w) * e.speed; e.vy = (uy + ux * w) * e.speed; break;
    }
    case 'shade': { // stalks, winds up, then lunges in a straight line
      if (e.state === 'chase' && dist < 190) { e.state = 'windup'; e.stateT = 0.55; }
      if (e.state === 'windup') { e.vx = ux * 12; e.vy = uy * 12; if (e.stateT <= 0) { e.state = 'lunge'; e.stateT = 0.42; e.vx = ux * 330; e.vy = uy * 330; } }
      else if (e.state === 'lunge') { if (e.stateT <= 0) { e.state = 'chase'; } }
      else { e.vx = ux * e.speed; e.vy = uy * e.speed; }
      break;
    }
    case 'spitter': { // keeps its distance and spits gloom bolts
      if (dist > 300) { e.vx = ux * e.speed; e.vy = uy * e.speed; }
      else if (dist < 220) { e.vx = -ux * e.speed; e.vy = -uy * e.speed; }
      else { e.vx = -uy * e.speed * 0.6; e.vy = ux * e.speed * 0.6; }
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < 380) { e.shootT = 2.3; wantShoot = true; }
      break;
    }
    case 'darter': { // circles its target, then darts through it
      if (e.state === 'chase' && dist < 240) { e.state = 'circle'; e.stateT = 0.9; }
      if (e.state === 'circle') {
        e.vx = (-uy + ux * 0.25) * e.speed * 1.25; e.vy = (ux + uy * 0.25) * e.speed * 1.25;
        if (e.stateT <= 0) { e.state = 'lunge'; e.stateT = 0.36; }
      } else if (e.state === 'lunge') {
        e.vx = ux * 360; e.vy = uy * 360;
        if (e.stateT <= 0) e.state = 'chase';
      } else { e.vx = ux * e.speed; e.vy = uy * e.speed; }
      break;
    }
    case 'boss': { // grinds toward its target; patterns live in the world step
      e.vx = ux * e.speed; e.vy = uy * e.speed;
      e.shootT -= dt;
      if (e.shootT <= 0) { e.shootT = e.phase === 3 ? 1.8 : 2.1; wantShoot = true; }
      break;
    }
    default: { // splitter, veil, brute: honest pressure toward the light
      e.vx = ux * e.speed; e.vy = uy * e.speed;
    }
  }
  return wantShoot;
}

// Wave recipe: which kinds pour in, and how the night escalates.
export function waveComposition(wave) {
  const list = [];
  const add = (kind, n) => { for (let i = 0; i < n; i++) list.push(kind); };
  add('moth', 4 + wave);
  add('wisp', wave >= 2 ? 2 + wave : 0);
  add('shade', wave >= 3 ? wave - 1 : 0);
  add('spitter', wave >= 4 ? Math.floor(wave / 2) : 0);
  add('splitter', wave >= 5 ? Math.floor((wave - 3) / 1.5) : 0);
  add('veil', wave >= 6 ? Math.floor((wave - 4) / 2) : 0);
  add('darter', wave >= 7 ? wave - 5 : 0);
  add('brute', wave >= 9 ? wave - 8 : 0);
  if (BOSSES[wave]) list.push('boss:' + wave);
  return list;
}

export function waveHpScale(wave, difficultyHp) {
  return (1 + (wave - 1) * 0.16) * difficultyHp;
}
