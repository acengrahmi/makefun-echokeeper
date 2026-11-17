// upgrades.js — the dew shop: eight leveled upgrades and the run's stats.
// One small job: define what dew buys, what each level does, and count
// everything the end screens brag about.

export const UPGRADES = [
  { id: 'damage', name: 'Brighter Bolts', icon: 'DMG', max: 5, base: 22, growth: 1.55,
    blurb: (l) => `bolt damage ${10 + l * 4} -> ${10 + (l + 1) * 4}` },
  { id: 'firerate', name: 'Quick Hands', icon: 'RTE', max: 5, base: 20, growth: 1.55,
    blurb: (l) => `shots /s ${(6 + l * 1.2).toFixed(1)} -> ${(6 + (l + 1) * 1.2).toFixed(1)}` },
  { id: 'multishot', name: 'Split Light', icon: 'MLT', max: 3, base: 55, growth: 1.9,
    blurb: (l) => `${1 + l} bolts per shot -> ${2 + l}` },
  { id: 'echocap', name: 'Echo Chorus', icon: 'ECH', max: 3, base: 45, growth: 1.8,
    blurb: (l) => `${1 + l} echoes at once -> ${2 + l}` },
  { id: 'echopower', name: 'Vivid Echoes', icon: 'VIV', max: 5, base: 20, growth: 1.55,
    blurb: (l) => `echo bolts at ${Math.round((0.55 + l * 0.15) * 100)}% -> ${Math.round((0.55 + (l + 1) * 0.15) * 100)}% strength` },
  { id: 'vitality', name: 'Second Wind', icon: 'VIT', max: 4, base: 24, growth: 1.6,
    blurb: (l) => `keeper max health ${120 + l * 20} -> ${120 + (l + 1) * 20}, mends 20 now` },
  { id: 'ward', name: 'Lantern Ward', icon: 'WRD', max: 4, base: 30, growth: 1.65,
    blurb: (l) => `lantern +${40} ward and mends ${25} now` },
  { id: 'dash', name: 'Phantom Dash', icon: 'DSH', max: 4, base: 20, growth: 1.6,
    blurb: (l) => `dash cooldown ${(1.5 - l * 0.22).toFixed(2)}s -> ${(1.5 - (l + 1) * 0.22).toFixed(2)}s` },
];

export function priceOf(up, level) {
  return Math.round(up.base * Math.pow(up.growth, level));
}

export function freshLevels() {
  const out = {};
  for (const u of UPGRADES) out[u.id] = 0;
  return out;
}

export function derivedStats(levels) {
  return {
    damage: 10 + levels.damage * 4,
    fireInterval: 1 / (6 + levels.firerate * 1.2),
    bolts: 1 + levels.multishot,
    echoCap: 1 + levels.echocap,
    echoPower: 0.55 + levels.echopower * 0.15,
    moveSpeed: 232,
    keeperMaxBonus: levels.vitality * 20,
    lanternMaxBonus: levels.ward * 40,
    dashCooldown: Math.max(0.55, 1.5 - levels.dash * 0.22),
  };
}

export function freshRunStats() {
  return {
    kills: 0, dewEarned: 0, dewSpent: 0, shotsFired: 0, shotsHit: 0,
    bestStreak: 0, flawlessWaves: 0, echoesMade: 0, timeSec: 0, wavesCleared: 0,
  };
}

export function starRating(lanternFrac) {
  if (lanternFrac >= 0.66) return 3;
  if (lanternFrac >= 0.33) return 2;
  if (lanternFrac > 0) return 1;
  return 0;
}

export function rankFor(score, difficultyMult) {
  const s = score / Math.max(1, difficultyMult);
  if (s >= 26000) return 'S';
  if (s >= 20000) return 'A';
  if (s >= 14000) return 'B';
  if (s >= 8000) return 'C';
  return 'D';
}
