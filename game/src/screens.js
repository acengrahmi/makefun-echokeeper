// screens.js — the geometry and summaries of every non-play screen.
// One small job: say where the title cards, shop cards and buttons sit, and
// turn a finished run into the stars, rank and stat lines the end screens
// show. Render draws them; main routes clicks through the same rectangles.

import { UPGRADES } from './upgrades.js';
import { starRating, rankFor } from './upgrades.js';

export function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export const TITLE_LAYOUT = {
  difficultyCards: [0, 1, 2].map((i) => ({ x: 290 + i * 240, y: 396, w: 220, h: 104 })),
  beginButton: { x: 490, y: 528, w: 300, h: 56 },
};

export const SHOP_LAYOUT = {
  cards: UPGRADES.map((u, i) => ({
    id: u.id, x: 64 + (i % 4) * 292, y: 178 + Math.floor(i / 4) * 196, w: 272, h: 176,
  })),
  nextButton: { x: 440, y: 606, w: 400, h: 58 },
};

export const END_LAYOUT = {
  againButton: { x: 490, y: 592, w: 300, h: 54 },
};

export function victorySummary(w) {
  const acc = w.stats.shotsFired ? Math.round((w.stats.shotsHit / w.stats.shotsFired) * 100) : 0;
  const mins = Math.floor(w.stats.timeSec / 60), secs = Math.floor(w.stats.timeSec % 60);
  return {
    stars: starRating(w.lantern.hp / w.lantern.maxHp),
    rank: rankFor(w.score, w.diff.mult),
    lines: [
      ['SCORE', String(w.score)],
      ['FOES FELLED', String(w.stats.kills)],
      ['TIME', mins + ':' + String(secs).padStart(2, '0')],
      ['DEW GATHERED', String(w.stats.dewEarned)],
      ['ECHOES CAST', String(w.stats.echoesMade)],
      ['BEST STREAK', 'x' + w.stats.bestStreak],
      ['FLAWLESS WAVES', String(w.stats.flawlessWaves)],
      ['BOLT ACCURACY', acc + '%'],
    ],
  };
}

export function defeatSummary(w) {
  return {
    lines: [
      ['SURVIVED TO', 'WAVE ' + w.wave + ' / 12'],
      ['SCORE', String(w.score)],
      ['FOES FELLED', String(w.stats.kills)],
      ['ECHOES CAST', String(w.stats.echoesMade)],
    ],
  };
}
