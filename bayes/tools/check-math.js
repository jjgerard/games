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
console.log(JSON.stringify(out));
