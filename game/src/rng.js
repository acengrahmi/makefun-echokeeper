// rng.js — deterministic seeded randomness for ECHOKEEPER.
// One small job: turn a seed into a reproducible stream of numbers so a
// run, a screenshot scene and a headless test always agree with each other.

export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  const nextUint = () => {
    // mulberry32: fast, well-distributed, identical on every platform.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const rng = {
    next: () => nextUint() / 4294967296,
    range: (lo, hi) => lo + rng.next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(rng.next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(rng.next() * arr.length) % arr.length],
    chance: (p) => rng.next() < p,
    state: () => state,
  };
  return rng;
}

export function hashRunDigest(parts) {
  // FNV-1a over a string of run facts; tests compare digests across runs.
  let h = 0x811c9dc5;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
