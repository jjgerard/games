// How often would a tempting wrong strategy be accepted? Low numbers are good (anything above 60% is a failure,
// and a strategy that is always right for a 2-way choice should sit near 50%).
//   NODE_PATH=... node tools/naive.js [questions=300]
const { chromium } = require('playwright'); const fs = require('fs');
const N = Number(process.argv[2] || 300), ONLY = process.argv.slice(3);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  await p.goto('http://localhost:8203/index.html?seed=' + (Date.now() % 99999)); await p.evaluate(() => localStorage.clear()); await p.reload();
  const info = {};
  const grab = async id => { const out = []; for (let i = 0; i < N; i++) { await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id); out.push(await p.evaluate(() => JSON.parse(JSON.stringify(__run.ctrl.info || null)))); } return out; };
  const ids = ['l-read', 'l-zero', 'b-break', 's-set', 's-fn', 'a-mid', 'a-which', 'a-lever', 't-tap', 't-group', 'c-int', 'c-coef', 'c-which', 'i-goal', 'i-gap', 'i-three', 'm-units', 'm-simpson', 'd-fill', 'd-label', 'd-nest', 'r-match', 'r-pull', 'n-build', 'n-read', 'n-typo', 'n-table', 'e-cells', 'e-slope', 'v-shape', 'v-cost', 'f-sing', 'f-empty', 'f-what', 'o-tap', 'o-typical', 'w-slots', 'w-int'];
  for (const id of ids.filter(i => !ONLY.length || ONLY.includes(i))) info[id] = await grab(id);
  await b.close();
  const R = (arr, f) => arr.filter(f).length / arr.length;
  const within = (v, t, tol) => Math.abs(v - t) <= tol;
  const arrEq = (a, c) => a.length === c.length && a.every(x => c.includes(x));
  const S = {
    'l-read': { 'leave the dot where it starts': q => within(q.start, q.target, q.tol), 'always y at x=0 (the intercept) for the "y at x" kind': q => false },
    'l-zero': { 'always 0': q => within(0, q.target, q.tol), 'always the mean age': q => within(q.mean, q.target, q.tol), 'leave the marker': q => within(q.start, q.target, q.tol) },
    'b-break': { 'slide to the right end': q => within(12, q.xc, q.tol), 'leave it at 3': q => within(3, q.xc, q.tol), 'the middle, 6': q => within(6, q.xc, q.tol) },
    's-set': { 'leave the marker where it starts': q => { const R = { P: v => v, O: v => v / (1 + v), L: v => 1 / (1 + Math.exp(-v)) }; return false; }, 'p = .5': q => Math.abs(0.5 - q.pt) <= 0.04 },
    's-fn': { 'always plogis': q => q.C.fn === 'plogis', 'always exp': q => q.C.fn === 'exp', 'always log': q => q.C.fn === 'log', 'always qlogis': q => q.C.fn === 'qlogis' },
    'a-mid': { 'qlogis(mean of the probabilities)': q => within(q.mp, q.m, q.tol), 'midrange': q => within(q.mid, q.m, q.tol), 'median': q => within(q.median, q.m, q.tol), 'zero (50%)': q => within(0, q.m, q.tol) },
    'a-which': { 'pick the larger probability': q => Math.max(q.pm, q.pl) === q.pl, 'pick the smaller': q => Math.min(q.pm, q.pl) === q.pl, 'pick the one farther from .5': q => Math.abs(q.pl - .5) > Math.abs(q.pm - .5), 'pick the one closer to .5': q => Math.abs(q.pl - .5) < Math.abs(q.pm - .5), 'always X': q => q.ans === 'X', 'always Y': q => q.ans === 'Y' },
    'a-lever': { 'leave the bar where it starts': q => Math.abs(q.start - q.need) <= 1.0 },
    't-tap': { 'always the Intercept estimate': q => q.at && q.at[0] === 0 && q.at[1] === 0, 'always the first row': q => q.row === 0 || (q.at && q.at[0] === 0), 'always the p column of group B': q => q.at && q.at[0] === 1 && q.at[1] === 3 },
    't-group': { 'ignore the group change (baseline only)': q => within(q.b0, q.T, q.tol), 'type the change only': q => within(q.b1, q.T, q.tol), 'leave the marker': q => within(q.start, q.T, q.tol) },
    'c-int': { 'always the mean of the two groups': q => within((q.mA + q.mB) / 2, q.K.intercept, q.tol), 'always the mean of A': q => within(q.mA, q.K.intercept, q.tol), 'always the mean of B': q => within(q.mB, q.K.intercept, q.tol), 'leave the dot': q => within(q.start, q.K.intercept, q.tol) },
    'c-coef': { 'full gap B minus A': q => within(q.K.intercept + (q.mB - q.mA), q.target, q.tol), 'half gap': q => within(q.K.intercept + (q.mB - q.mA) / 2, q.target, q.tol), 'flat (leave it)': q => within(q.start, q.target, q.tol) },
    'c-which': { 'always 0/1': q => q.key === 'trtA', 'always -1/+1': q => q.key === 'one', 'always -1/2,+1/2': q => q.key === 'half', 'always 1/0': q => q.key === 'trtB' },
    'i-goal': { 'leave it': q => Math.abs(q.start - q.target) <= q.tol },
    'i-gap': { 'always orange': q => q.ans === 'orange', 'always blue': q => q.ans === 'blue', 'always average': q => q.ans === 'avg' },
    'i-three': { 'always none': q => q.kind === 'none', 'always same': q => q.kind === 'same', 'always differ': q => q.kind === 'differ' },
    'm-units': { 'count the dots': q => q.dots === q.target },
    'm-simpson': { 'the pooled slope': q => Math.abs(q.pooled - q.within) <= q.tol, 'flat line': q => Math.abs(0 - q.within) <= q.tol, 'leave it': q => Math.abs(q.within) <= q.tol },
    'd-fill': { 'fill every cell': q => q.want.length === 16, 'fill the whole diagonal-ish half (8 cells)': q => q.want.length === 8 },
    'd-label': { 'all within': q => q.truth.every(t => t === 'within'), 'all between': q => q.truth.every(t => t === 'between'), 'first within, second between': q => q.truth[0] === 'within' && (q.truth.length === 1 || q.truth[1] === 'between') },
    'd-nest': { 'always the first grid': q => q.order[0] === q.ask, 'always the second': q => q.order[1] === q.ask, 'always the third': q => q.order[2] === q.ask },
    'r-match': { 'leave the lines on the group line': q => q.own.every((a, i) => Math.abs(a - q.grand) <= q.tol), 'leave them where they start': q => q.own.every((a, i) => Math.abs(q.grand + q.starts[i] - a) <= q.tol) },
    'r-pull': { 'the person farthest from the group': q => q.far.indexOf(Math.max(...q.far)) === q.ans, 'the person with the fewest points': q => q.n.indexOf(Math.min(...q.n)) === q.ans, 'always P1': q => q.ans === 0, 'always P4': q => q.ans === 3 },
    'n-build': { 'one tile only (the longest)': q => arrEq([q.shown.slice().sort((a, b) => b.length - a.length)[0]], q.want), 'all tiles': q => arrEq(q.shown, q.want), 'the first two tiles shown': q => arrEq(q.shown.slice(0, 2), q.want), 'the first tile shown': q => arrEq(q.shown.slice(0, 1), q.want) },
    'n-read': { 'tick all five': q => q.want.length === 5, 'tick nothing': q => q.want.length === 0, 'tick participant baseline only': q => arrEq(['pi'], q.want) },
    'n-typo': { 'always the first part': q => q.ans === 0, 'always the second': q => q.ans === 1, 'always the third': q => q.ans === 2, 'the longest part': q => q.parts.indexOf(q.parts.slice().sort((a, b) => b.length - a.length)[0]) === q.ans },
    'n-table': { 'always the first row': q => q.want.includes(0), 'the last (Residual) row': q => q.want.includes(q.nrows - 1) },
    'e-cells': { 'tick all three': q => q.want.length === 3, 'tick none': q => q.want.length === 0, 'tick only (1 | subj)': q => arrEq(['p'], q.want), 'tick the first two': q => arrEq(['p', 'i'], q.want) },
    'e-slope': { 'tick both': q => q.want.length === 2, 'tick only the intercept': q => arrEq(['int'], q.want), 'tick none': q => q.want.length === 0 },
    'v-shape': { 'always both': q => q.kind === 'both', 'always intercept only': q => q.kind === 'int', 'always slope only': q => q.kind === 'slope' },
    'v-cost': { 'always trust the wider bar': q => q.kind === 'wider', 'always say same': q => q.kind === 'same' },
    'f-sing': { 'always "nothing wrong"': q => !q.sing, 'always tap something': q => q.sing },
    'f-empty': { 'tap the first cell': q => q.empties.includes(0), 'tap the last cell': q => q.empties.includes(7), 'tap one cell, not two': q => q.nEmpty === 1 },
    'f-what': { 'the longest option': q => q.opts.slice().sort((a, b) => b.length - a.length)[0] === q.best, 'the first option': q => q.opts[0] === q.best, 'the last option': q => q.opts[2] === q.best },
    'o-tap': { 'always the Intercept estimate': q => q.at[0] === 'fe' && q.at[1] === 0 && q.at[2] === 0, 'always the condition estimate': q => q.at[0] === 'fe' && q.at[1] === 1 && q.at[2] === 0 },
    'o-typical': { 'the mean of the dots': q => Math.abs(q.mean - q.med) <= q.tol, '.5': q => Math.abs(0.5 - q.med) <= q.tol, 'leave the marker': q => Math.abs(q.start - q.med) <= q.tol },
    'w-slots': { 'always the raw table number': q => q.kind === 'int-lo' || q.kind === 'b-lo', 'always exp()': q => q.kind === 'b-or', 'always plogis()': q => q.kind === 'int-p' || q.kind === 'b-p', 'always the first tile shown': q => false },
    'w-int': { 'the longest option': q => q.opts.slice().sort((a, b) => b.length - a.length)[0] === q.right, 'the first option': q => q.opts[0] === q.right },
  };
  let bad = 0;
  for (const [id, strat] of Object.entries(S)) for (const [name, f] of Object.entries(strat)) {
    if (!info[id]) continue;
    const arr = info[id].filter(Boolean); let rate; try { rate = R(arr, f); } catch (e) { rate = NaN; }
    const flag = rate > 0.6 ? 'FAIL' : 'ok  '; if (rate > 0.6) bad++;
    console.log(`${flag} ${id.padEnd(10)} "${name}" would be accepted ${(rate * 100).toFixed(0)}% of the time`);
  }
  console.log(bad ? `${bad} strategies above 60%` : 'no naive strategy above 60%'); process.exit(bad ? 1 : 0);
})();
