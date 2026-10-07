// Seeded randomness, so the demo data is the same on every load and in tests.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rnd) {
  const u = Math.max(rnd(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

export function poisson(rnd, mean) {
  const l = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do { k++; p *= rnd(); } while (p > l);
  return k - 1;
}

export function pickWeighted(rnd, pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let x = rnd() * total;
  for (const [v, w] of pairs) { if ((x -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
