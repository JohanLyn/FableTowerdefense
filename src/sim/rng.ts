/** Mulberry32 step. Takes and returns state explicitly so game state stays plain data. */
export function nextRandom(holder: { rngState: number }): number {
  let t = (holder.rngState = (holder.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
