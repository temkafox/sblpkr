/** Injectable RNG — domain code never calls `Math.random` directly. */

export interface RandomSource {
  /** Uniform draw in **[0, 1)** — same contract as `Math.random`. */
  readonly next: () => number;
}

/** Deterministic PRNG (mulberry32) seeded from a string or 32‑bit integer. */

export function createSeededRandom(seed: string | number): RandomSource {
  let state = seedToUint32(seed);
  if (state === 0) {
    state = 0x9e3779b9;
  }

  return {
    next(): number {
      let t = (state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function seedToUint32(seed: string | number): number {
  if (typeof seed === 'number') {
    return seed >>> 0;
  }

  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
