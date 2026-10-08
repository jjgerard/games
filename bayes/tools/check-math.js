// Prints worked examples as JSON for tools/check-math.R to verify against
// an independent implementation in R.
const BM = require('../math.js');
const out = {
  posteriorA: [
    [0.8, 0.2, 5, 5, ['c']], [0.8, 0.2, 1, 9, ['c']], [0.7, 0.3, 5, 5, ['c', 's', 'c']],
    [0.9, 0.1, 2, 8, ['s']], [0.8, 0.3, 5, 5, ['c', 'c', 's', 'c']],
  ].map(a => ({ args: a, value: BM.posteriorA(...a) })),
  grid: [[[0.2, 0.4, 0.6, 0.8], 2, 3], [[0.1, 0.3, 0.5, 0.7, 0.9], 1, 1], [[0.2, 0.4, 0.6, 0.8], 0, 2]]
    .map(a => ({ args: a, value: BM.gridPosterior(...a) })),
  coverage: [[0.5, 10, 0.15], [0.5, 75, 0.15], [0.3, 40, 0.1], [0.8, 20, 0.1]]
    .map(a => ({ args: a, value: BM.coverage(...a) })),
  shelf: [[0.8, 0.2, 5, 5, 'c'], [0.8, 0.2, 1, 9, 'c'], [0.7, 0.3, 3, 7, 's']]
    .map(a => ({ args: a, value: BM.shelfCounts(...a), post: BM.posteriorA(...a.slice(0, 4), [a[4]]) })),
};
out.beta = [[1, 1], [3, 2], [8, 4], [2, 6], [5, 5]].map(a => ({
  args: a, pdf: [0.1, 0.3, 0.5, 0.8].map(x => BM.betaPdf(x, ...a)), mean: BM.betaMean(...a), mode: BM.betaMode(...a),
  cdf: [0.2, 0.5, 0.9].map(x => BM.betaCdf(x, ...a)), q: [0.05, 0.5, 0.95].map(p => BM.betaQuantile(p, ...a)),
  mass: BM.betaMassBetween(0.3, 0.7, ...a) }));
out.three = [[[0.2, 0.4, 0.6, 0.8], [2, 2, 1, 0], ['c']], [[0.1, 0.3, 0.5, 0.7, 0.9], [1, 1, 3, 1, 1], ['s', 'c']]]
  .map(a => ({ args: a, value: BM.threePieces(...a) }));
out.norm = { xs: [-2.5, -1, 0, 0.7, 1.96, 3.4], q: [0.001, 0.05, 0.5, 0.9, 0.995] }; out.norm.pdf = out.norm.xs.map(v => BM.normPdf(v, 1, 2)); out.norm.cdf = out.norm.xs.map(v => BM.normCdf(v, 1, 2)); out.norm.quant = out.norm.q.map(v => BM.normQuantile(v, 1, 2));
out.bb = [[10, 2, 2], [10, 7, 4], [10, 1, 1], [10, 3, 9]].map(a => ({ args: a, pmf: Array.from({ length: a[0] + 1 }, (_, k) => BM.betaBinomPmf(k, ...a)), bin: Array.from({ length: a[0] + 1 }, (_, k) => BM.binomPmf(k, a[0], a[1] / (a[1] + a[2]))), bracket: BM.pmfBracket(Array.from({ length: a[0] + 1 }, (_, k) => BM.betaBinomPmf(k, ...a))) }));
{ const x = [12, 15, 18, 21, 24, 27, 30], y = [8.1, 9.7, 12.4, 12.9, 16.2, 17.1, 21.3]; out.ols = { x, y, fit: BM.ols(x, y) }; }
{ const draw = BM.betaSampler(6, 3), rng = BM.mulberry32(5), v = Array.from({ length: 40000 }, () => draw(rng)); out.sampler = { a: 6, b: 3, mean: BM.mean(v), q: [0.1, 0.5, 0.9].map(p => v.slice().sort((u, w) => u - w)[Math.floor(p * v.length)]) }; }
out.anova = { groups: [[10, 12, 11, 13], [18, 17, 20, 19], [14, 15, 13, 16], [9, 11, 10, 8]] }; out.anova.res = BM.anovaPool(out.anova.groups);
out.shrink = [[3, 4, 5], [2, 5, 16]].map(a => ({ args: a, w: BM.shrinkW(...a) }));
console.log(JSON.stringify(out));
