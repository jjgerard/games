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


  // ---- Beta distributions (Unit 1) ----------------------------------------
  // A belief about a share, as a curve. Beta(a, b) is what you get from a
  // flat start plus (a-1) imaginary circles and (b-1) imaginary squares.
  function lgamma(x) {
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
    let s = 1.000000000190015; for (const c of g) s += c / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  BM.betaPdf = function (x, a, b) {
    if (x <= 0 || x >= 1) return 0;
    return Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x));
  };
  BM.betaMean = (a, b) => a / (a + b);
  BM.betaMode = (a, b) => (a > 1 && b > 1 ? (a - 1) / (a + b - 2) : a <= 1 && b > 1 ? 0 : a > 1 && b <= 1 ? 1 : 0.5);
  // Area under the curve from 0 to x (Simpson's rule; a, b >= 1 so the curve is smooth).
  BM.betaCdf = function (x, a, b, steps = 400) {
    x = BM.clamp(x, 0, 1); if (x === 0) return 0;
    const h = x / steps; let s = BM.betaPdf(1e-12, a, b) + BM.betaPdf(x - 1e-12, a, b);
    for (let i = 1; i < steps; i++) s += BM.betaPdf(i * h, a, b) * (i % 2 ? 4 : 2);
    return BM.clamp(s * h / 3, 0, 1);
  };
  BM.betaQuantile = function (p, a, b) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (BM.betaCdf(mid, a, b) < p) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  };
  // The middle `mass` of the belief, with equal tails.
  BM.betaInterval = (a, b, mass = 0.9) => [BM.betaQuantile((1 - mass) / 2, a, b), BM.betaQuantile(1 - (1 - mass) / 2, a, b)];
  BM.betaMassBetween = (lo, hi, a, b) => BM.betaCdf(hi, a, b) - BM.betaCdf(lo, a, b);

  // The three pieces for a set of candidate bags: prior (any weights), the
  // likelihood of the shapes seen (as a share of the best, so the biggest is 1),
  // and the posterior (prior x likelihood, rescaled to sum to 1).
  BM.threePieces = function (ps, priorWeights, shapes) {
    const lik = ps.map(p => shapes.reduce((acc, s) => acc * (s === 'c' ? p : 1 - p), 1));
    const prior = priorWeights.map(w => w / priorWeights.reduce((a, b) => a + b, 0));
    const w = prior.map((pr, i) => pr * lik[i]), t = w.reduce((a, b) => a + b, 0);
    return { prior, lik, post: w.map(x => x / t) };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BM;
  else root.BM = BM;
})(typeof window !== 'undefined' ? window : globalThis);
