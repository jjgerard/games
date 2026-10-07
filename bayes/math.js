// The maths behind every question, kept separate from the screens so it can
// be tested on its own (tools/check-math.js compares it with R). Nothing
// here is shown to the player as a calculation: the game never asks anyone
// to multiply. These functions only decide what the right answer IS.
(function (root) {
  const BM = {};

  // Seeded random numbers, so a run can be replayed (?seed=123 in the URL).
  BM.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  BM.pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  BM.int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // inclusive
  BM.shuffle = (rng, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  BM.clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // Two kinds of bag, A and B. pA and pB are the chance of a circle from
  // each; nA and nB say how many bags of each kind are on the shelf (the
  // prior, as counts). `shapes` is the evidence: 'c' or 's' per draw.
  // Returns the probability the bag in your hand is kind A.
  BM.posteriorA = function (pA, pB, nA, nB, shapes) {
    let a = nA, b = nB;
    for (const s of shapes) {
      a *= s === 'c' ? pA : 1 - pA;
      b *= s === 'c' ? pB : 1 - pB;
    }
    return a / (a + b);
  };

  // Several candidate bags with circle-chances `ps`; k circles seen in n
  // draws. Returns the posterior over the candidates (flat prior unless given).
  BM.gridPosterior = function (ps, k, n, prior) {
    prior = prior || ps.map(() => 1 / ps.length);
    const w = ps.map((p, i) => prior[i] * Math.pow(p, k) * Math.pow(1 - p, n - k));
    const t = w.reduce((x, y) => x + y, 0);
    return w.map(x => x / t);
  };

  // Chance that a share measured from n draws lands within `band` of the
  // true share p (exact binomial, no simulation).
  BM.coverage = function (p, n, band) {
    let pmf = Math.pow(1 - p, n), total = 0;
    for (let k = 0; k <= n; k++) {
      if (Math.abs(k / n - p) <= band + 1e-9) total += pmf;
      pmf *= ((n - k) / (k + 1)) * (p / (1 - p));
    }
    return total;
  };

  // One draw from a bag with circle-chance p.
  BM.drawShape = (rng, p) => (rng() < p ? 'c' : 's');

  // Frequencies for the "imagine many draws" picture: for each bag kind,
  // how many of its 10 draws are circles (p is always a multiple of .1).
  BM.circlesPerTen = p => Math.round(p * 10);

  // Natural-frequency form of the two-bag answer, used by the reveal:
  // of all draws showing `shape` across the whole shelf, how many came
  // from kind-A bags. Always agrees with posteriorA for one draw.
  BM.shelfCounts = function (pA, pB, nA, nB, shape) {
    const perBagA = BM.circlesPerTen(shape === 'c' ? pA : 1 - pA);
    const perBagB = BM.circlesPerTen(shape === 'c' ? pB : 1 - pB);
    return { fromA: nA * perBagA, fromB: nB * perBagB };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BM;
  else root.BM = BM;
})(typeof window !== 'undefined' ? window : globalThis);
