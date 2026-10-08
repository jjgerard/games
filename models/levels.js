// The order of the whole game, and the short placement test.
// jsonlite writes a one-element vector as a bare number: make every list an array again
POOLS.shrink.forEach(s => s.pts.forEach(p => { p.x = [].concat(p.x); p.y = [].concat(p.y); }));
const UNITS = [...PART1, ...PART2];
const PLACEMENT = [
  { id: 'p-line', build: buildLineRead, unlocks: [0, 1] },
  { id: 'p-fn', build: buildScaleFn, unlocks: [2] },
  { id: 'p-avg', build: buildAvgWhich, unlocks: [3] },
  { id: 'p-tab', build: buildTabTap, unlocks: [4, 5, 6] },
  { id: 'p-design', build: buildGridLabel, unlocks: [7, 8] },
];
