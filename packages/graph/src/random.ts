/* ============================================================================
   RANDOM

   The one source of seeded randomness in the package. Physics draws its
   initial scatter from it; GraphCanvas draws the per-node and per-edge shader
   seeds (flicker phase, packet offset) from a second, independent stream, so
   changing how many visual seeds get drawn can never shift the layout.
   ========================================================================== */

/**
 * mulberry32 — 32 bits of state, one multiply-xorshift round. Chosen for
 * being short enough to read and verify in place; this seeds a layout, it is
 * not a source of randomness anything depends on for secrecy or for
 * statistical quality beyond "looks scattered".
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A 32-bit seed derived from a set of node ids: FNV-1a over the ids, sorted,
 * so the same set of ids gives the same seed whatever order the array lists
 * them in. Ids are compared as strings, so `1` and `"1"` hash alike — they
 * can't both be present anyway, since GraphCanvas rejects duplicate ids only
 * by strict equality, and a consumer mixing the two would already be asking
 * for trouble elsewhere.
 *
 * This is what makes "the same data draws the same picture on every visit"
 * the default rather than something a consumer has to opt into.
 */
export function seedFromIds(ids: Iterable<string | number>): number {
  const keys = Array.from(ids, String).sort();
  let h = 0x811c9dc5;
  for (const key of keys) {
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // Separator, so ["ab", "c"] and ["a", "bc"] don't collide.
    h ^= 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
