// The order of the whole game, and the short placement test.
const UNITS = [...PART1, ...PART2];
const PLACEMENT = [
  { id: 'p-line', build: buildLineRead, unlocks: [0, 1] },
  { id: 'p-fn', build: buildScaleFn, unlocks: [2] },
  { id: 'p-avg', build: buildAvgWhich, unlocks: [3] },
  { id: 'p-tab', build: buildTabTap, unlocks: [4, 5, 6] },
];
