// logic.test.mjs — headless checks of ECHOKEEPER's rules (node, no DOM).
import { createWorld, startRun, stepWorld, buyUpgrade, nextWave, worldDigest } from '../game/src/world.js';
import { autopilotInput, stageScene } from '../game/src/director.js';
import { spawnBoss, spawnEnemy } from '../game/src/enemies.js';
import { priceOf, UPGRADES } from '../game/src/upgrades.js';

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('PASS ' + name + (extra ? ' — ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}
const IDLE = { mx: 0, my: 0, aimX: 900, aimY: 300, fire: false, dash: false, echo: false, pause: false, mute: false, speed: 0, confirm: false, click: false, clickX: 0, clickY: 0 };
const inp = (over = {}) => ({ ...IDLE, ...over });

// 1. seeded determinism: same seed + same inputs -> identical digest
{
  const run = () => {
    const w = createWorld(42, 'radiant'); startRun(w);
    for (let i = 0; i < 900; i++) stepWorld(w, autopilotInput(w));
    return worldDigest(w) + ':' + w.score + ':' + w.stats.kills;
  };
  const a = run(), b = run();
  check('seeded determinism (900 autopilot ticks)', a === b, a);
}
// 2. title -> run start
{
  const w = createWorld(5);
  check('boots to title', w.screen === 'title');
  startRun(w, 'ember');
  check('startRun enters play at wave 1', w.screen === 'play' && w.wave === 1 && w.diff.id === 'ember');
}
// 3. echo record/replay: fight in a circle for 6 s, cast, the ghost replays it
{
  const w = createWorld(9, 'radiant'); startRun(w);
  w.spawnQueue = []; // a quiet glade so the pattern is purely the keeper's
  const pin = spawnEnemy('moth', 70, 70, 1); pin.speed = 0; pin.hp = 100000; pin.maxHp = 100000;
  w.enemies.push(pin); // one pinned witness keeps the wave "in progress"
  for (let i = 0; i < 360; i++) {
    const a = i * 0.05;
    stepWorld(w, inp({ mx: Math.cos(a), my: Math.sin(a), aimX: w.player.x + Math.cos(a + 1.2) * 200, aimY: w.player.y + Math.sin(a + 1.2) * 200, fire: i % 2 === 0 }));
  }
  check('memory holds a full 6 s', w.memory.length === 360, 'len=' + w.memory.length);
  stepWorld(w, inp({ echo: true }));
  check('E casts an echo', w.echoes.length === 1 && w.stats.echoesMade === 1);
  const e = w.echoes[0];
  check('echo loop is the recorded 360 frames', e.frames.length === 360);
  let sawEchoBolt = false, followed = true;
  for (let i = 0; i < 90; i++) {
    stepWorld(w, inp());
    if (Math.abs(e.x - e.frames[e.cursor].x) > 0.01 || Math.abs(e.y - e.frames[e.cursor].y) > 0.01) followed = false;
    if (w.bolts.some((b) => b.echo)) sawEchoBolt = true;
  }
  check('echo follows its recorded path exactly', followed);
  check('echo fires the recorded pattern (echo bolts fly)', sawEchoBolt);
  // chorus cap: cap is 1 at base, a second cast must fail
  stepWorld(w, inp({ echo: true }));
  check('echo cap enforced at base level', w.echoes.length === 1);
}
// 4. shop: buy, refusal when poor, refusal when maxed
{
  const w = createWorld(3, 'radiant'); startRun(w); w.screen = 'shop'; w.dew = 500;
  const price = priceOf(UPGRADES.find((u) => u.id === 'damage'), 0);
  check('buy damage succeeds', buyUpgrade(w, 'damage') === true && w.levels.damage === 1 && w.dew === 500 - price);
  w.dew = 0;
  check('buy refused when poor', buyUpgrade(w, 'firerate') === false && w.levels.firerate === 0);
  w.dew = 9999; w.levels.damage = 5;
  check('buy refused when maxed', buyUpgrade(w, 'damage') === false);
  const before = w.lantern.maxHp;
  check('ward raises lantern max and mends', buyUpgrade(w, 'ward') === true && w.lantern.maxHp === before + 40);
}
// 5. wave flow: clearing a wave opens the shop; shop advances the wave
{
  const w = createWorld(4, 'radiant'); startRun(w);
  w.spawnQueue = []; w.enemies = [];
  stepWorld(w, inp());
  check('cleared wave opens shop', w.screen === 'shop' && w.stats.wavesCleared === 1);
  check('nextWave starts wave 2 in play', nextWave(w) === true && w.wave === 2 && w.screen === 'play');
}
// 6. boss phases break at 66% and taunt draws aggro
{
  const w = createWorld(6, 'radiant'); startRun(w); w.spawnQueue = [];
  const boss = spawnBoss(4, 700, 300, 1); w.enemies.push(boss); w.bossRef = boss;
  boss.hp = Math.floor(boss.maxHp * 0.6);
  w.bolts.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, damage: 1, r: 6, life: 1, echo: false, hue: 45 });
  stepWorld(w, inp());
  check('boss phase breaks at 66%', boss.phase === 2, 'phase=' + boss.phase);
  check('player bolts taunt the boss (aggro set)', boss.aggroT > 0);
}
// 7. defeat by lantern
{
  const w = createWorld(7, 'radiant'); startRun(w); w.spawnQueue = [];
  w.lantern.hp = 5;
  w.enemies.push(spawnEnemy('moth', w.lantern.x + 20, w.lantern.y, 1));
  for (let i = 0; i < 40 && w.screen === 'play'; i++) stepWorld(w, inp());
  check('defeat when the lantern falls', w.screen === 'defeat');
}
// 8. defeat by keeper
{
  const w = createWorld(8, 'radiant'); startRun(w); w.spawnQueue = [];
  w.player.hp = 5;
  w.enemies.push(spawnEnemy('brute', w.player.x + 10, w.player.y, 1));
  for (let i = 0; i < 60 && w.screen === 'play'; i++) stepWorld(w, inp());
  check('defeat when the keeper falls', w.screen === 'defeat');
}
// 9. pause freezes the simulation
{
  const w = createWorld(10, 'radiant'); startRun(w);
  for (let i = 0; i < 120; i++) stepWorld(w, autopilotInput(w));
  stepWorld(w, inp({ pause: true }));
  const px = w.player.x, ex = w.enemies.length ? w.enemies[0].x : -1, score = w.score;
  for (let i = 0; i < 30; i++) stepWorld(w, inp());
  check('pause freezes play', w.paused === true && w.player.x === px && (w.enemies.length === 0 || w.enemies[0].x === ex) && w.score === score);
}
// 10. dash grants i-frames
{
  const w = createWorld(12, 'radiant'); startRun(w); w.spawnQueue = [];
  stepWorld(w, inp({ mx: 1, dash: true }));
  check('dash grants invulnerability frames', w.player.invulnT > 0.15, 'invulnT=' + w.player.invulnT.toFixed(2));
}
// 11. staged scenes land on the right screens
{
  const w = createWorld(7, 'radiant');
  stageScene(w, 'title'); check('scene title -> title screen', w.screen === 'title');
  stageScene(w, 'shop'); check('scene shop -> shop with purse + levels', w.screen === 'shop' && w.dew === 167 && w.levels.echocap === 1);
  stageScene(w, 'victory'); check('scene victory -> victory screen', w.screen === 'victory');
  stageScene(w, 'play');
  check('scene play -> boss fight with a 3-echo chorus', w.screen === 'play' && !!w.bossRef && w.echoes.length === 3 && w.streak === 23);
}
// 12. victory path exists at wave 12
{
  const w = createWorld(13, 'radiant'); startRun(w);
  w.wave = 12; w.spawnQueue = []; w.enemies = []; w.bossRef = null;
  stepWorld(w, inp());
  check('clearing wave 12 wins the night', w.screen === 'victory');
}

console.log(`\nlogic: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
