// autopilot.mjs — the playability proof: the policy pilot, which itself
// choreographs echoes, must WIN the full game on normal (Radiant).
import { createWorld, startRun, stepWorld, nextWave } from '../game/src/world.js';
import { autopilotInput, autopilotShop } from '../game/src/director.js';

const seeds = (process.argv[2] || '3,7,11').split(',').map(Number);
let wins = 0;
for (const seed of seeds) {
  const w = createWorld(seed, process.argv[3] || 'radiant');
  startRun(w);
  let ticks = 0;
  const MAX = 60 * 60 * 14; // 14 minutes of game time, hard cap
  while (!w.over && ticks < MAX) {
    if (w.screen === 'play') { stepWorld(w, autopilotInput(w)); ticks++; }
    else if (w.screen === 'shop') {
      let bought = true, guard = 0;
      while (bought && guard++ < 40) bought = autopilotShop(w);
      nextWave(w);
    } else break;
  }
  const mins = (w.stats.timeSec / 60).toFixed(1);
  console.log(`seed ${seed}: ${w.screen.toUpperCase()} wave=${w.wave} score=${w.score} kills=${w.stats.kills} echoes=${w.stats.echoesMade} time=${mins}m lantern=${Math.max(0, Math.round(w.lantern.hp))}/${w.lantern.maxHp} keeper=${Math.max(0, Math.round(w.player.hp))}`);
  if (w.screen === 'victory') wins++;
}
console.log(`autopilot: ${wins}/${seeds.length} wins on ${process.argv[3] || 'radiant'}`);
if (wins < seeds.length) process.exit(1);
