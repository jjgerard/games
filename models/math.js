// The maths behind every question, kept apart from the screens so it can be
// tested on its own (tools/check-math.js dumps these functions' answers and
// tools/check-math.R compares them with real R: lm, glm, lme4). Nothing here
// is shown to the player as a calculation. These functions only decide what
// the right answer IS, and make the generators' data.
(function (root) {
  const MM = {};

  // ---- seeded random numbers (?seed=123 in the URL makes a run repeatable)
  MM.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  MM.pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  MM.int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1)); // inclusive
  MM.uni = (rng, lo, hi) => lo + rng() * (hi - lo);
  MM.shuffle = (rng, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  MM.clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  MM.round = (x, d = 0) => { const k = Math.pow(10, d); return Math.round(x * k) / k; };
  MM.normal = rng => { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  MM.sum = a => a.reduce((x, y) => x + y, 0);
  MM.mean = a => MM.sum(a) / a.length;

  // ---- the three scales
  MM.plogis = x => 1 / (1 + Math.exp(-x));
  MM.qlogis = p => Math.log(p / (1 - p));
  MM.odds = p => p / (1 - p);
  MM.probFromOdds = o => o / (1 + o);

  // normal distribution (Abramowitz & Stegun 26.2.17, error < 1e-7)
  MM.pnorm = z => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-z * z / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
  };
  // inverse normal (Acklam), used for evenly spaced "people" on a bell curve
  MM.qnorm = p => {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const lo = 0.02425; let q, r;
    if (p < lo) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - lo) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };

  // ---- a model-table row as glm prints it: z = estimate / SE, p = 2 * P(Z > |z|)
  MM.tableRow = (est, se) => { const z = est / se; return { est, se, z, p: 2 * MM.pnorm(-Math.abs(z)) }; };
  MM.fmt = (x, d = 2) => { const s = Math.abs(x) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : x.toFixed(d); return s.replace('-', '−'); };
  MM.fmtP = p => p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, '');

  // ---- straight-line least squares: what lm(y ~ x) returns
  MM.lm = (xs, ys) => {
    const mx = MM.mean(xs), my = MM.mean(ys);
    let sxy = 0, sxx = 0; for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const b1 = sxy / sxx; return { b0: my - b1 * mx, b1 };
  };
  // ---- logistic regression on grouped counts: what glm(cbind(k, n - k) ~ x, binomial) returns (IRLS)
  MM.glm = (xs, ks, ns) => {
    let b0 = 0, b1 = 0;
    for (let it = 0; it < 50; it++) {
      let s00 = 0, s01 = 0, s11 = 0, t0 = 0, t1 = 0;
      for (let i = 0; i < xs.length; i++) {
        const eta = b0 + b1 * xs[i], p = MM.plogis(eta), w = ns[i] * p * (1 - p);
        const z = eta + (ks[i] / ns[i] - p) / (p * (1 - p));
        s00 += w; s01 += w * xs[i]; s11 += w * xs[i] * xs[i]; t0 += w * z; t1 += w * z * xs[i];
      }
      const det = s00 * s11 - s01 * s01, n0 = (s11 * t0 - s01 * t1) / det, n1 = (s00 * t1 - s01 * t0) / det;
      const done = Math.abs(n0 - b0) + Math.abs(n1 - b1) < 1e-10; b0 = n0; b1 = n1; if (done) break;
    }
    return { b0, b1 };
  };

  // ---- partial pooling with a random intercept: the share of a person's own
  // mean that the mixed model keeps (lme4 BLUP = lambda * (own mean - population mean))
  MM.lambda = (sdPerson, sdNoise, n) => { const u = sdPerson * sdPerson; return u / (u + sdNoise * sdNoise / n); };

  // ---- coding: the numbers a two-level factor gets, and what the coefficients then mean
  MM.CODINGS = {
    trtA: { name: 'A = 0, B = 1', a: 0, b: 1 },
    trtB: { name: 'A = 1, B = 0', a: 1, b: 0 },
    half: { name: 'A = −½, B = +½', a: -0.5, b: 0.5 },
    one:  { name: 'A = −1, B = +1', a: -1, b: 1 },
  };
  // intercept = line height at code 0, slope = change per 1 step of code; the line goes through both group means
  MM.coefs = (cod, mA, mB) => { const slope = (mB - mA) / (cod.b - cod.a); return { slope, intercept: mA - slope * cod.a }; };

  // ---- 2 x 2 interaction: means m[a][b] with a = level of A (0,1), b = level of B (0,1)
  MM.riseB = (m, b) => m[1][b] - m[0][b];          // effect of A at level b of B (a simple effect)
  MM.interaction = m => MM.riseB(m, 1) - MM.riseB(m, 0); // difference of differences

  // ---- random-effects formulas: reduce a list of terms to a canonical set so equivalent spellings match
  // (1 | a/b) is (1 | a) + (1 | a:b); (x | g) is (1 + x | g). (1 + x | g) differs from (1 | g) + (0 + x | g): correlated or not.
  MM.parseTerm = s => {
    const m = s.trim().match(/^\(\s*(.+?)\s*\|\s*([^|]+?)\s*\)$/); if (!m) return null;
    let lhs = m[1].split('+').map(x => x.trim()), grp = m[2];
    const noInt = lhs.includes('0'); lhs = lhs.filter(x => x !== '0' && x !== '1');
    const terms = (noInt ? [] : ['1']).concat(lhs).sort();
    const groups = grp.includes('/') ? (() => { const [a, b] = grp.split('/').map(x => x.trim()); return [a, a + ':' + b]; })() : [grp];
    // with a slash only the intercept is nested: (x | a/b) means (x | a) + (x | a:b)
    return groups.map(g => g + '::' + terms.join(','));
  };
  MM.canon = terms => { const out = []; for (const t of terms) { const p = MM.parseTerm(t); if (!p) return null; out.push(...p); } return out.sort(); };
  MM.sameFormula = (a, b) => { const x = MM.canon(a), y = MM.canon(b); return !!x && !!y && JSON.stringify(x) === JSON.stringify(y); };

  // ---- can lme4 fit a grouping factor? Only if some level has two or more rows (levels < observations)
  MM.groupingOK = counts => counts.length < MM.sum(counts);

  root.MM = MM;
  if (typeof module !== 'undefined') module.exports = MM;
})(typeof window !== 'undefined' ? window : globalThis);
