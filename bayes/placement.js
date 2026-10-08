// Placement: ten pictures, no teaching, no feedback. Each tests the idea one
// or a few sub-levels build, so the first one missed is where to start. When a
// picture is passed, every sub-level in its `unlocks` is marked done, in the
// order of UNITS (a later item never counts once an earlier one is missed).
// Unit 6 (trusting the fit) is not placed: it is short and always opens after Unit 5.
const PLACEMENT = [
  { id: 'u0-share', unlocks: ['u0-draw', 'u0-slide', 'u0-share', 'u0-many'], build: ctx => buildShare(ctx, 'bag') },
  { id: 'u0-flip', unlocks: ['u0-flip'], build: ctx => buildInside(ctx, true) },
  { id: 'u0-rare', unlocks: ['u0-two', 'u0-several', 'u0-rare'], build: ctx => buildTwoBags(ctx, true) },
  { id: 'u1-product', unlocks: ['u0-chips', 'u1-prior', 'u1-lik', 'u1-product', 'u1-names'], build: ctx => buildProduct(ctx) },
  { id: 'u1-shift', unlocks: ['u1-imagine-tut', 'u1-imagine', 'u1-shift', 'u1-interval'], build: ctx => buildShift(ctx) },
  { id: 'u2-count', unlocks: ['u2-chop', 'u2-peak', 'u2-sample-tut', 'u2-count'], build: ctx => buildCount(ctx) },
  { id: 'u2-predict', unlocks: ['u2-steps-tut', 'u2-predict', 'u2-which', 'u2-blowup-tut', 'u2-move'], build: ctx => buildPredict(ctx) },
  { id: 'u3-table', unlocks: ['u3-mean-tut', 'u3-mean', 'u3-line-tut', 'u3-fit', 'u3-noise', 'u3-prior', 'u3-table', 'u3-fuzz', 'u3-centre'], build: ctx => buildTable(ctx) },
  { id: 'u4-land', unlocks: ['u4-pool-tut', 'u4-land', 'u4-most', 'u4-amount', 'u4-which'], build: ctx => buildLand(ctx) },
  { id: 'u5-intercept', unlocks: ['u5-switch-tut', 'u5-intercept', 'u5-slope', 'u5-name', 'u5-prior'], build: ctx => buildIntercept(ctx) },
];
