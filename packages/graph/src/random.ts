/** Seeded PRNG returning [0, 1). Good enough to scatter a layout; not for secrecy. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit FNV-1a seed over the sorted ids, so array order doesn't matter; `1` and `"1"` hash alike. */
export function seedFromIds(ids: Iterable<string | number>): number {
  const keys = Array.from(ids, String).sort();
  let hash = 0x811c9dc5;
  for (const key of keys) {
    for (let i = 0; i < key.length; i++) {
      hash ^= key.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // Separator, so ["ab", "c"] and ["a", "bc"] don't collide.
    hash ^= 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
