// Part 1: Regression and scales. Each build(ctx) makes ONE question on the stage and returns
//   check()      -> { correct, message }  (called when the player presses Check; locks the controls)
//   reveal()     -> optional: draw the picture behind the answer
//   solve()      -> put the controls into the right answer (used by the test tools)
//   solveWrong() -> deliberately wrong (also tests)
//   info         -> numbers the naive-strategy test reads
// ctx: stage, rng, setPrompt(html), setReady(bool), complete(msg) (tutorials only).
// Nothing asks the player to calculate: answers are dragged or tapped and judged against a tolerance.

const U = MM;
const prob = p => SCALE_FMT.P(p);
const gridTicks = (lo, hi, step) => { const t = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push([v, f0(v)]); return t; };
const note = (html, cls = '') => el('div', { class: 'stage-note ' + cls, html });
const GA = 'var(--ga-dark)', GB = 'var(--gb-dark)';

// ---------------------------------------------------------------------------
// Unit 1: A line makes predictions
// ---------------------------------------------------------------------------
function lineSetup(rng, { xmax = 8 } = {}) {
  for (;;) {
    const b1 = U.pick(rng, [-1, -0.5, 0.5, 1, 1.5, 2]);
    const b0 = b1 < 0 ? U.int(rng, 7, 10) : U.int(rng, 1, 6);
    const ys = [b0, b0 + b1 * xmax]; const lo = Math.floor(Math.min(0, ...ys) / 2) * 2, hi = Math.ceil(Math.max(...ys) / 2) * 2 + 2;
    if (hi - lo <= 22) return { b0, b1, lo, hi, step: hi - lo > 14 ? 4 : 2 };
  }
}
const lineChart = (ctx, S, xmax = 8, h = roomH(ctx, 56, 190, 330)) => {
  const ch = Plot(ctx, { h, left: 36, right: 14, top: 12, bottom: 32, xr: [0, xmax], yr: [S.lo, S.hi], label: `A straight line starting at ${S.b0} on the y axis, changing ${S.b1} per step of x` });
  ch.axisY(gridTicks(S.lo, S.hi, S.step)); ch.axisX(gridTicks(0, xmax, 2));
  ch.line(0, S.b0, xmax, S.b0 + S.b1 * xmax, 'fitln');
  ctx.stage.append(ch.svg); return ch;
};

function buildLineTut(ctx) {
  const S = { b0: 2, b1: 1.5, lo: 0, hi: 16, step: 4 };
  ctx.setPrompt('Slide the flashing dot to the right end. The line gives a height for every x.');
  const ch = lineChart(ctx, S);
  const out = ch.text(ch.left + 8, ch.top + 20, '', 'tx tb');
  const h = hx(ch, v => ch.Y(S.b0 + S.b1 * v), { name: 'x position on the line', v: 1, min: 0, max: 8, step: 0.1, pulse: true, fmt: v => `x ${f1(v)}, line height ${f1(S.b0 + S.b1 * v)}`,
    onChange: v => { out.textContent = `x = ${f1(v)}  →  y = ${f1(S.b0 + S.b1 * v)}`; if (v >= 7.5) { h.lock(); ctx.complete('Every x has one height on the line. That height is the prediction.'); } } });
  out.textContent = `x = 1.0  →  y = ${f1(S.b0 + S.b1)}`;
  return { solve: () => h.set(8, true) };
}

function buildLineRead(ctx) {
  const rng = ctx.rng, S = lineSetup(rng), kind = U.pick(rng, ['y', 'y', 'int', 'x']), xmax = 8;
  const ch = lineChart(ctx, S);
  const yAt = x => S.b0 + S.b1 * x, tol = Math.max(0.5, 0.045 * (S.hi - S.lo));
  let h, target, ghost, prompt;
  const slopeTxt = `${S.b1 > 0 ? 'rises' : 'falls'} ${Math.abs(S.b1)} per step`;
  if (kind === 'x') {
    const xt = U.int(rng, 2, 7), Y = yAt(xt); target = xt;
    ch.line(0, Y, xmax, Y, 'guide');
    const start = xt > 4 ? 1 : 7;
    h = hx(ch, ch.Y(Y), { name: 'x position', v: start, min: 0, max: xmax, step: 0.1, fmt: v => `x ${f1(v)}`, onChange: () => ctx.setReady(true) });
    prompt = `Slide the dot along the guide to where the line reaches <b>y = ${f0(Y)}</b>.`;
    ghost = () => ch.add(sv('circle', { class: 'ringm good', r: 15, cx: ch.X(xt), cy: ch.Y(Y) }), ch.over);
    var okf = () => Math.abs(h.v - target) <= 0.55;
  } else {
    const xt = kind === 'int' ? 0 : U.int(rng, 2, 7); target = yAt(xt);
    ch.line(xt, S.lo, xt, S.hi, 'guide');
    const start = target > (S.lo + S.hi) / 2 ? S.lo + 0.12 * (S.hi - S.lo) : S.hi - 0.12 * (S.hi - S.lo);
    h = hy(ch, ch.X(xt), { name: `Height at x = ${xt}`, v: start, min: S.lo, max: S.hi, step: 0.1, fmt: v => `y ${f1(v)}`, onChange: () => ctx.setReady(true) });
    prompt = kind === 'int' ? 'Drag the dot to where the line meets <b>x = 0</b>. That height is the <b>intercept</b>.' : `Drag the dot to the height the line gives at <b>x = ${xt}</b>.`;
    ghost = () => ch.add(sv('circle', { class: 'ringm good', r: 15, cx: ch.X(xt), cy: ch.Y(target) }), ch.over);
    var okf = () => Math.abs(h.v - target) <= tol;
  }
  ctx.setPrompt(prompt);
  ctx.stage.append(note(`The line starts at ${S.b0} and ${slopeTxt}.`));
  return {
    check() {
      const ok = okf(); h.lock(); ghost();
      return { correct: ok, message: ok ? `Yes. The intercept ${S.b0} is the height at x = 0; each step of x adds the slope, ${S.b1}.` : `Not quite. Read the line itself: it starts at ${S.b0} at x = 0 and ${slopeTxt}. The green ring is where it should be.` };
    },
    solve() { h.set(target, true); }, solveWrong() { h.set(kind === 'x' ? (target > 4 ? target - 3 : target + 3) : (target > (S.lo + S.hi) / 2 ? target - 6 : target + 6), true); },
    info: { start: h.v, target, tol: kind === 'x' ? 0.55 : tol, kind },
  };
}

function buildZero(ctx) {
  const rng = ctx.rng, centred = rng() < 0.5, xmax = 110;
  const n = 12, xs = Array.from({ length: n }, (_, i) => U.uni(rng, 62, 98)), slope = U.uni(rng, 0.3, 0.5), mean0 = U.uni(rng, 20, 40);
  const mx = U.mean(xs), ys = xs.map(x => mean0 + slope * (x - mx) + U.normal(rng) * 2.2);
  const fit = U.lm(xs, ys), yAt = x => fit.b0 + fit.b1 * x;
  const lo = Math.floor(Math.min(yAt(0), ...ys) / 10) * 10 - 10, hi = Math.ceil(Math.max(...ys) / 10) * 10 + 5;
  ctx.setPrompt(centred ? 'This model used <b>age minus the average age</b>. Drag the marker to the age where the intercept is read.' : 'This model used <b>age as it is</b>. Drag the marker to the age where the intercept is read.');
  const ch = Plot(ctx, { h: roomH(ctx, 56, 190, 300), left: 44, right: 22, top: 22, bottom: 32, xr: [0, xmax], yr: [lo, hi], label: 'Scores against age in months, with the fitted line extended back to age 0' });
  ch.axisY(gridTicks(lo, hi, 20)); ch.axisX([[0, '0'], [50, '50'], [100, '100']]);
  ch.line(0, yAt(0), xmax, yAt(xmax), 'fitln');
  xs.forEach((x, i) => ch.add(sv('circle', { class: 'datadot', cx: ch.X(x), cy: ch.Y(ys[i]), r: 5 })));
  const dot = ch.add(sv('circle', { class: 'pdot', r: 7 }), ch.over), vline = ch.add(sv('line', { class: 'guide', y1: ch.top, y2: ch.H - ch.bottom }), ch.over);
  const out = note('Move the marker: the line\'s height there appears here.');
  const target = centred ? mx : 0, tol = 7;
  const h = hx(ch, 10, { name: 'Age where the intercept is read', v: centred ? 20 : 55, min: 0, max: xmax, step: 1, fmt: v => `age ${f0(v)}`,
    onChange: (v, u) => { dot.setAttribute('cx', ch.X(v)); dot.setAttribute('cy', ch.Y(yAt(v))); vline.setAttribute('x1', ch.X(v)); vline.setAttribute('x2', ch.X(v)); out.textContent = `The line at age ${f0(v)} says ${f1(yAt(v))}.`; if (u) ctx.setReady(true); } });
  h.set(h.v);
  ctx.stage.append(ch.svg, out);
  return {
    check() {
      const ok = Math.abs(h.v - target) <= tol; h.lock(); ch.add(sv('circle', { class: 'ringm good', r: 15, cx: ch.X(target), cy: ch.Y(yAt(target)) }), ch.over);
      return { correct: ok, message: ok ? (centred ? `Yes. After centring, 0 on the model's age scale is the average age, so the intercept is the predicted score at the average age (${f0(mx)}).` : `Yes. Age 0 is the model's zero. It is far outside the data (62 to 98), so this intercept is an extrapolation (${f1(yAt(0))}).`)
        : (centred ? `Not quite. Centred age is 0 at the average age, ${f0(mx)} months, so that is where the intercept is read.` : 'Not quite. Without centring, the intercept is read at age 0, far to the left of the data.') };
    },
    solve() { h.set(target, true); }, solveWrong() { h.set(centred ? 0 : mx, true); }, info: { centred, target, tol, mean: mx, start: h.v, xs, ys, b0: fit.b0, b1: fit.b1 },
  };
}

// ---------------------------------------------------------------------------
// Unit 2: Bounded outcomes
// ---------------------------------------------------------------------------
function boundedSetup(rng, rising) {
  for (let t = 0; t < 500; t++) {
    const n = 20, xs = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5];
    const mid = U.uni(rng, 0.4, 0.55), s = U.uni(rng, 0.05, 0.085) * (rising ? 1 : -1);
    const ks = xs.map(x => Math.round(M.clamp(mid + s * (x - 4) + U.normal(rng) * 0.03, 0.04, 0.96) * n));
    const prop = ks.map(k => k / n), fit = U.lm(xs, prop); if (fit.b1 * s <= 0) continue;
    const xc = ((rising ? 1 : 0) - fit.b0) / fit.b1;
    if (xc >= 7.8 && xc <= 10.6 && Math.abs(fit.b0 + fit.b1 * 0 - 0.5) < 3) return { xs, ks, n, prop, fit, xc, rising };
  }
  return boundedSetup(rng, rising);
}
function boundedChart(ctx, S) {
  const ch = Plot(ctx, { h: roomH(ctx, 0, 190, 320), left: 52, right: 14, top: 10, bottom: 32, xr: [0, 12], yr: [-0.35, 1.35], label: 'Proportion correct against practice, with a straight line and the allowed band from 0% to 100%' });
  ch.add(sv('rect', { class: 'band', x: ch.left, y: ch.Y(1), width: ch.W - ch.left - ch.right, height: ch.Y(0) - ch.Y(1) }));
  ch.axisY([[0, '0%'], [0.5, '50%'], [1, '100%']], {}); ch.axisX([[0, '0'], [4, '4'], [8, '8'], [12, '12']]);
  S.xs.forEach((x, i) => ch.add(sv('circle', { class: 'datadot', cx: ch.X(x), cy: ch.Y(S.prop[i]), r: 5 })));
  ch.line(0, S.fit.b0, 12, S.fit.b0 + S.fit.b1 * 12, 'fitln');
  ctx.stage.append(ch.svg); return ch;
}
function boundedHandle(ctx, ch, S, onChange) {
  const yAt = x => S.fit.b0 + S.fit.b1 * x, out = ch.text(ch.W - ch.right - 4, ch.top + 22, '', 'tx tb', 'end', ch.over);
  const h = hx(ch, v => ch.Y(yAt(v)), { name: 'x position on the line', v: 3, min: 0, max: 12, step: 0.1, pulse: !!onChange.pulse, fmt: v => `x ${f1(v)}, line says ${f2(yAt(v))}`,
    onChange: (v, u) => { const y = yAt(v), bad = y > 1.0001 || y < -0.0001; h.g.classList.toggle('bad', bad); out.textContent = bad ? `${f2(y)}: impossible` : `${f2(y)}`; out.classList.toggle('badtx', bad); onChange(v, y, bad, u); } });
  return h;
}
function buildBoundTut(ctx) {
  const S = boundedSetup(ctx.rng, true);
  ctx.setPrompt('Slide the flashing dot to the right. Watch what the straight line says.');
  const ch = boundedChart(ctx, S);
  const cb = (v, y, bad) => { if (bad && y > 1.02) { h.lock(); ctx.complete('Past 100% a straight line still climbs. It predicts a proportion that cannot exist.'); } }; cb.pulse = true;
  const h = boundedHandle(ctx, ch, S, cb);
  return { solve: () => h.set(12, true) };
}
function buildBound(ctx) {
  const rng = ctx.rng, rising = rng() < 0.5, S = boundedSetup(rng, rising);
  ctx.setPrompt(`Slide the dot to the <b>first x</b> where this line ${rising ? 'goes above 100%' : 'drops below 0%'}.`);
  const ch = boundedChart(ctx, S), tol = 0.6;
  const h = boundedHandle(ctx, ch, S, () => ctx.setReady(true));
  return {
    check() {
      const ok = Math.abs(h.v - S.xc) <= tol; h.lock();
      ch.add(sv('circle', { class: 'ringm good', r: 15, cx: ch.X(S.xc), cy: ch.Y(rising ? 1 : 0) }), ch.over);
      const g = U.glm(S.xs, S.ks, S.xs.map(() => S.n)); ch.add(sv('polyline', { class: 'curveln', points: Array.from({ length: 61 }, (_, i) => { const x = i * 0.2; return `${ch.X(x)},${ch.Y(U.plogis(g.b0 + g.b1 * x))}`; }).join(' ') }));
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `The line leaves the band at x = ${f1(S.xc)} (green ring). The dashed logistic S-curve bends and never leaves 0% to 100%.` };
    },
    solve() { h.set(S.xc, true); }, solveWrong() { h.set(S.xc > 9 ? S.xc - 3 : 12, true); }, info: { xc: S.xc, tol, start: 3, xs: S.xs, ks: S.ks, n: S.n, b0: S.fit.b0, b1: S.fit.b1, rising, glm: U.glm(S.xs, S.ks, S.xs.map(() => S.n)) },
  };
}

// ---------------------------------------------------------------------------
// Unit 3: Three scales
// ---------------------------------------------------------------------------
function buildScaleTut(ctx) {
  ctx.setPrompt('Drag the flashing marker to the right. One chance, three ways to write it.');
  const s = Scales3(ctx, { p: 0.2, pulse: 'P', onChange: p => { if (p >= 0.88) { s.lock(); ctx.complete('The same chance has three names: a probability, odds, and log-odds. Moving one moves all three.'); } } });
  return { solve: () => s.setP(0.9, true) };
}
const SET_TARGETS = [
  ...[0.1, 0.2, 0.25, 0.75, 0.8, 0.9].map(v => ({ k: 'P', v })), ...[0.25, 0.5, 2, 3, 4, 9].map(v => ({ k: 'O', v })), ...[-3, -2, -1, 1, 2, 3].map(v => ({ k: 'L', v })),
];
const SET_TOL = { P: () => 0.04, O: v => Math.max(0.2, 0.12 * v), L: () => 0.3 };
const SCALE_WORD = { P: 'Probability', O: 'Odds', L: 'Log-odds' };
function buildScaleSet(ctx) {
  const rng = ctx.rng, T = U.pick(rng, SET_TARGETS), pt = SCALE_ROWS[T.k].set(T.v);
  let p0; do p0 = U.uni(rng, 0.08, 0.92); while (Math.abs(p0 - pt) < 0.25);
  ctx.setPrompt(`Move a marker until <b>${SCALE_WORD[T.k]}</b> reads <b>${SCALE_FMT[T.k](T.v)}</b>.`);
  const s = Scales3(ctx, { p: p0, onChange: () => ctx.setReady(true) });
  const val = () => SCALE_ROWS[T.k].get(s.p);
  const msg = pp => `${prob(pp)} as a probability = odds ${SCALE_FMT.O(U.odds(pp))} = log-odds ${SCALE_FMT.L(U.qlogis(pp))}.`;
  return {
    check() { const ok = Math.abs(val() - T.v) <= SET_TOL[T.k](T.v); s.lock(); s.ring(T.k, T.v); return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + msg(ok ? s.p : pt) }; },
    solve() { s.setP(pt, true); }, solveWrong() { s.setP(M.clamp(pt < 0.5 ? pt + 0.3 : pt - 0.3, 0.05, 0.95), true); }, info: { p0, pt, T },
  };
}
const FN_CASES = [
  { from: 'L', to: 'P', fn: 'plogis' }, { from: 'L', to: 'O', fn: 'exp' }, { from: 'P', to: 'L', fn: 'qlogis' }, { from: 'O', to: 'L', fn: 'log' },
];
const FN_VALUES = { L: [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5], P: [0.2, 0.3, 0.6, 0.7, 0.8, 0.9], O: [0.5, 2, 3, 4, 5] };
const FN_OUT = { plogis: ['P', U.plogis], qlogis: ['L', U.qlogis], exp: ['O', Math.exp], log: ['L', Math.log] };
function buildScaleFn(ctx) {
  const rng = ctx.rng, C = U.pick(rng, FN_CASES), x = U.pick(rng, FN_VALUES[C.from]), p = SCALE_ROWS[C.from].set(x);
  const xs = SCALE_FMT[C.from](x);
  ctx.setPrompt(`You hold <b>${SCALE_WORD[C.from].toLowerCase()} ${xs}</b>. You want the <b>${SCALE_WORD[C.to].toLowerCase()}</b>. Tap the call that gets there.`);
  const s = Scales3(ctx, { p, drag: [], order: [C.from, C.to], label: `Probability, odds and log-odds lines showing ${SCALE_WORD[C.from]} ${xs}` });
  const goal = s.rows[C.to]; goal.label.classList.add('goal');
  const stat = note('Tap a call: its answer lands as a hollow ring.');
  const mk = fn => ({ key: fn, label: `${fn}(${xs})` });
  const tiles = Choices(U.shuffle(rng, ['plogis', 'qlogis', 'exp', 'log']).map(mk), { cols: 2, cls: 'mono', onPick: fn => {
    const [row, f] = FN_OUT[fn], r = f(x); s.clearRings(); if (isFinite(r) && s.rows[row]) s.ring(row, r);
    stat.textContent = isFinite(r) ? `= ${row === 'P' ? prob(r) : SCALE_FMT[row](r)}, ${row === 'O' ? 'odds' : row === 'P' ? 'a probability' : 'log-odds'}${s.rows[row] ? '' : ' (not the row you want)'}` : '= NaN: not a valid input';
    ctx.setReady(true);
  } });
  ctx.stage.append(stat, tiles.el);
  return {
    check() {
      const ok = tiles.key === C.fn; tiles.lock(); tiles.mark(C.fn, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc'); s.clearRings(); s.ring(FN_OUT[C.fn][0], FN_OUT[C.fn][1](x));
      const why = { plogis: 'plogis turns log-odds into a probability', exp: 'exp turns log-odds into odds', qlogis: 'qlogis turns a probability into log-odds', log: 'log turns odds into log-odds' }[C.fn];
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `${why}. Its ring lands exactly on the marker.` };
    },
    solve() { tiles.pick(C.fn); }, solveWrong() { tiles.pick(['plogis', 'qlogis', 'exp', 'log'].find(f => f !== C.fn && !(f === 'qlogis' && C.from === 'L'))); }, info: { C, x, p },
  };
}

// ---------------------------------------------------------------------------
// Unit 4: Averaging on the wrong scale
// ---------------------------------------------------------------------------
const legendBars = () => el('div', { class: 'legend', html: `<span><svg width="18" height="18" aria-hidden="true"><circle class="mkfill" cx="9" cy="9" r="7"/></svg> average of the log-odds</span> <span><svg width="18" height="18" aria-hidden="true"><polygon class="mkhollow" points="9,1 17,9 9,17 1,9"/></svg> average of the probabilities</span>` });
function buildAvgTut(ctx) {
  ctx.setPrompt('Drag the flashing bar to the right. Watch the two averages.');
  const b = LogitBars(ctx, { vals: [-1.4, -1.4, 0.4, 1.1], drag: [3], pulse: 3, means: 'both' });
  ctx.stage.append(legendBars());
  b.onChange = vals => { if (vals[3] >= 5.8) { b.handles[3].lock(); ctx.complete('One cell near 100% drags the log-odds average far to the right. The average of the probabilities hardly moves.'); } };
  return { solve: () => b.handles[3].set(6.6, true) };
}
function avgCase(rng, nCells = 4) {
  for (let t = 0; t < 5000; t++) {
    const kind = U.pick(rng, ['one', 'one', 'one', 'mixhi']); let lg;
    if (kind === 'one') { const s = rng() < 0.5 ? 1 : -1; lg = [...Array(nCells - 1)].map(() => U.uni(rng, -1.8, 1.8)).concat([s * U.uni(rng, 4.2, 6.9)]); }
    else lg = [...Array(nCells - 1)].map(() => U.uni(rng, 1.4, 2.4)).concat([-U.uni(rng, 4.2, 6.9)]);
    lg = U.shuffle(rng, lg).map(v => M.round(v, 1));
    const p = lg.map(U.plogis), m = U.mean(lg), mp = U.qlogis(U.mean(p)), mid = (Math.min(...lg) + Math.max(...lg)) / 2, med = lg.slice().sort((a, b) => a - b);
    const median = (med[Math.floor((nCells - 1) / 2)] + med[Math.ceil((nCells - 1) / 2)]) / 2;
    if (Math.abs(m - mp) >= 0.9 && Math.abs(m - mid) >= 0.7 && Math.abs(m - median) >= 0.7) return { p, lg, m, mp, mid, median, kind };
  }
  throw new Error('no averaging case found');
}
function buildAvgMid(ctx) {
  const rng = ctx.rng, C = avgCase(rng);
  ctx.setPrompt('These bars are four cells on the log-odds axis. Drag the marker to their <b>average</b>.');
  const b = LogitBars(ctx, { vals: C.lg, means: false });
  const topY = 8, len = b.ch.H - b.ch.bottom + 2;
  const startAt = rng() < 0.5 ? -4 : 4;
  const h = hx(b.ch, topY + 4, { name: 'Average of the bars on the log-odds axis', v: startAt, min: -6.7, max: 6.7, step: 0.1, fmt: v => `${f1(v)} log-odds`, onChange: () => ctx.setReady(true) });
  h.g.prepend(sv('line', { class: 'ml', x1: 0, x2: 0, y1: 10, y2: len - topY }));
  ctx.stage.append(note('Each bar is one cell: A to D, with its probability.'));
  const tol = 0.6;
  return {
    check() {
      const ok = Math.abs(h.v - C.m) <= tol; h.lock();
      b.m1 = null; const g1 = b.addMarker(C.m, 'm-logit'), g2 = b.addMarker(C.mp, 'm-prob');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `The average of the log-odds is ${f1(C.m)}, which is probability ${prob(U.plogis(C.m))}. Averaging the probabilities instead gives ${prob(U.mean(C.p))} (hollow marker).` };
    },
    solve() { h.set(C.m, true); }, solveWrong() { h.set(C.mp, true); }, info: { m: C.m, mp: C.mp, mid: C.mid, median: C.median, tol, start: h.v, lg: C.lg, p: C.p },
  };
}
// Which flag is the probability the model reports? (X and Y sit on a probability line)
function buildAvgWhich(ctx) {
  const rng = ctx.rng; let C, pm, pl; for (;;) { C = avgCase(rng, 3); pm = U.mean(C.p); pl = U.plogis(C.m); if (Math.abs(pm - pl) >= 0.13) break; }
  ctx.setPrompt('The model averages the cells on the <b>log-odds</b> scale. Which flag is the probability it reports?');
  const b = LogitBars(ctx, { vals: C.lg, means: false, pitch: 30 });
  const ch = Plot(ctx, { h: 74, left: 14, right: 14, top: 0, bottom: 0, label: 'Probability line with two flags, X and Y' });
  const px = p => 14 + p * (ch.W - 28), ay = 40;
  ch.pline(14, ay, ch.W - 14, ay, 'axis'); for (const [v, s] of [[0, '0'], [0.5, '.5'], [1, '1']]) { ch.pline(px(v), ay, px(v), ay + 6, 'axis'); ch.text(px(v), ay + 26, s, 'tx tick', v === 0 ? 'start' : v === 1 ? 'end' : 'middle'); }
  const flipped = rng() < 0.5, pos = { X: flipped ? pm : pl, Y: flipped ? pl : pm };
  for (const [k, v] of Object.entries(pos)) { ch.pline(px(v), ay - 22, px(v), ay, 'flagpole'); ch.add(sv('circle', { class: 'fixm', r: 9, cx: px(v), cy: ay })); ch.text(px(v), ay - 26, k, 'tx tb', 'middle'); }
  ctx.stage.append(ch.svg);
  const tiles = Choices([{ key: 'X', label: 'Flag X' }, { key: 'Y', label: 'Flag Y' }], { cols: 2, onPick: () => ctx.setReady(true) });
  ctx.stage.append(tiles.el);
  const ans = flipped ? 'Y' : 'X';
  return {
    check() {
      const ok = tiles.key === ans; tiles.lock(); tiles.mark(ans, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc');
      b.addMarker(C.m, 'm-logit'); b.addMarker(U.qlogis(pm), 'm-prob');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `Averaging log-odds gives ${prob(pl)}; averaging the probabilities gives ${prob(pm)}. The cell near ${prob(U.mean([Math.min(...C.p), Math.max(...C.p)]) > 0.5 ? Math.max(...C.p) : Math.min(...C.p))} pulls the log-odds average toward its end.` };
    },
    solve() { tiles.pick(ans); }, solveWrong() { tiles.pick(ans === 'X' ? 'Y' : 'X'); }, info: { pm, pl, p: C.p, ans, flipped },
  };
}
function buildAvgLever(ctx) {
  const rng = ctx.rng, idx = U.int(rng, 0, 3);
  let vals, T;
  for (;;) {
    const sgn = rng() < 0.5 ? 1 : -1, big = sgn * U.uni(rng, 3.8, 6.2);
    const others = [0, 1, 2].map(() => U.uni(rng, -1.8, 1.8)); vals = others.slice(); vals.splice(idx, 0, big);
    T = U.mean(vals); if (Math.abs(T) > 0.7 && Math.abs(T - U.mean(others.concat([0]))) > 1.0) break;
  }
  const start = vals.slice(); start[idx] = U.uni(rng, -0.8, 0.8);
  const names = ['A', 'B', 'C', 'D'];
  ctx.setPrompt(`Drag cell <b>${names[idx]}</b>'s bar until the log-odds average (●) reaches the star.`);
  const b = LogitBars(ctx, { vals: start, names, drag: [idx], means: true });
  b.target(T); ctx.stage.append(note('● is the average of the four bars. ★ is the goal.'));
  b.onChange = () => ctx.setReady(true);
  const need = 4 * T - (U.sum(vals) - vals[idx]);
  return {
    check() {
      const ok = Math.abs(b.meanLogit() - T) <= 0.25; b.handles[idx].lock();
      const mp = U.mean(b.vals.map(U.plogis));
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `Cell ${names[idx]} had to go to ${prob(U.plogis(need))} to move the average that far. Near the ends of the axis a tiny change in probability is a big step in log-odds.` };
    },
    solve() { b.handles[idx].set(need, true); }, solveWrong() { b.handles[idx].set(M.clamp(need > 0 ? need - 3.2 : need + 3.2, -6.7, 6.7), true); }, info: { need, T, start: start[idx], idx, vals: vals.map((v, i) => i === idx ? need : v) },
  };
}

// ---------------------------------------------------------------------------
// Unit 5: Reading a logistic table
// ---------------------------------------------------------------------------
const TCOLS = [{ label: 'Est.', aria: 'Estimate' }, { label: 'SE', aria: 'Standard error' }, { label: 'z', aria: 'z value' }, { label: 'p', aria: 'p value' }];
function tableRows(rng, n = 3) {
  for (let t = 0; t < 400; t++) {
    const names = ['Intercept', 'groupB', 'groupC'].slice(0, n), rows = names.map((name, i) => {
      const est = M.round(U.pick(rng, [-1, 1]) * U.uni(rng, i ? 0.4 : 0.5, i ? 1.5 : 2.0), 2), se = M.round(U.uni(rng, 0.22, 0.55), 2);
      return { name, ...U.tableRow(est, se) };
    });
    const cells = rows.map(r => [f2(r.est), f2(r.se), f2(r.z), U.fmtP(r.p)]);
    const flat = cells.flat();
    if (new Set(flat).size !== flat.length) continue;
    if (rows.some(r => Math.abs(r.z) < 0.7 || Math.abs(r.z) > 3.1)) continue;
    if (n >= 3 && Math.abs(rows[1].est) === Math.abs(rows[2].est)) continue;
    return { rows, cells };
  }
}
function buildTabTut(ctx) {
  const T = { rows: [{ name: 'Intercept', est: 0.85, se: 0.31 }, { name: 'groupB', est: -0.62, se: 0.28 }] }; T.rows = T.rows.map(r => ({ name: r.name, ...U.tableRow(r.est, r.se) }));
  ctx.setPrompt('A model table. Tap the flashing number: the <b>log-odds</b> for the baseline group.');
  const tb = ModelTable({ cols: TCOLS, rows: T.rows.map(r => ({ name: r.name, cells: [f2(r.est), f2(r.se), f2(r.z), U.fmtP(r.p)] })), only: [0, 0], flash: [0, 0], caption: 'Logistic regression table',
    onTap: () => { tb.lock(); ctx.complete('That row, Intercept, is the baseline group, on the log-odds scale. 0.85 is not a probability.'); } });
  ctx.stage.append(tb.el);
  return { solve: () => tb.pick(0, 0) };
}
function tapKinds(rows) {
  const g = i => rows[i].name;
  const kinds = [
    { k: 'int', q: 'Tap the <b>log-odds for the baseline group</b>.', at: [0, 0], why: 'The Intercept estimate is the log-odds when every predictor is at its reference value.' },
    { k: 'b', q: 'Tap the <b>change in log-odds</b> for group B.', at: [1, 0], why: 'A group coefficient is the change in log-odds from baseline, not a probability.' },
    { k: 'c', q: 'Tap the <b>change in log-odds</b> for group C.', at: [2, 0], why: 'A group coefficient is the change in log-odds from baseline, not a probability.' },
    { k: 'se', q: 'Tap how <b>uncertain</b> the group B change is (its standard error).', at: [1, 1], why: 'The standard error says how precisely the estimate is known.' },
    { k: 'zc', q: 'Tap how many <b>standard errors</b> group C is from 0.', at: [2, 2], why: 'z is the estimate divided by its standard error.' },
    { k: 'pb', q: 'Tap the <b>p-value</b> for "is group B different from baseline?"', at: [1, 3], why: 'It tests the coefficient against 0 on the log-odds scale (no difference).' },
    { k: 'pi', q: 'Tap the <b>p-value</b> for "is the baseline log-odds 0?"', at: [0, 3], why: 'The Intercept is tested against 0 log-odds, which is a 50% chance. It is not a test against .5 as a number.' },
  ];
  // row question: the group with the best chance of success (largest total log-odds)
  const tot = [rows[0].est, rows[0].est + rows[1].est, rows[0].est + rows[2].est], best = tot.indexOf(Math.max(...tot));
  kinds.push({ k: 'best', q: 'Tap the <b>row</b> of the group with the <b>highest chance</b> of success.', row: best, why: best === 0 ? 'Baseline wins: both group changes are negative enough to put B and C below the Intercept.' : `Baseline plus ${g(best)}'s change is the largest log-odds of the three groups.` });
  return kinds;
}
function buildTabTap(ctx) {
  const rng = ctx.rng, T = tableRows(rng, 3), K = tapKinds(T.rows), kind = U.pick(rng, K);
  ctx.setPrompt(kind.q);
  const tb = ModelTable({ cols: TCOLS, rows: T.rows.map((r, i) => ({ name: r.name, cells: T.cells[i] })), mode: kind.row != null ? 'row' : 'cell', caption: 'Logistic regression table', onTap: () => ctx.setReady(true) });
  ctx.stage.append(tb.el);
  const right = () => kind.row != null ? tb.sel[0] === kind.row : tb.sel[0] === kind.at[0] && tb.sel[1] === kind.at[1];
  return {
    check() {
      const ok = right(); tb.lock(); if (kind.row != null) tb.markRow(kind.row, 'right'); else tb.mark(kind.at[0], kind.at[1], 'right');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + kind.why };
    },
    solve() { kind.row != null ? tb.pick(kind.row, 0) : tb.pick(kind.at[0], kind.at[1]); },
    solveWrong() { const r = kind.row != null ? (kind.row + 1) % 3 : kind.at[0], c = kind.row != null ? 0 : (kind.at[1] + 1) % 4; tb.pick(kind.row != null ? r : (r + 1) % 3, c); },
    info: { kind: kind.k, at: kind.at, row: kind.row, rows: T.rows },
  };
}
function buildTabGroup(ctx) {
  const rng = ctx.rng; let b0, b1;
  for (;;) { b0 = M.round(U.pick(rng, [-1, 1]) * U.uni(rng, 1.0, 2.2), 1); b1 = M.round(U.pick(rng, [-1, 1]) * U.uni(rng, 0.9, 2.0), 1); const tgt = b0 + b1; if (Math.abs(tgt) < 3.6 && Math.abs(tgt - b0) >= 0.9 && Math.abs(tgt - b1) >= 0.9) { if (rng() < 0.5 && !(b1 < 0 && b0 + b1 > 0)) continue; break; } }
  const T = b0 + b1;
  ctx.setPrompt('Drag the <b>B</b> marker to the log-odds for group B (baseline plus its change).');
  const tb = ModelTable({ cols: [TCOLS[0]], rows: [{ name: 'Intercept', cells: [f1(b0)] }, { name: 'groupB', cells: [f1(b1)] }], mode: 'none', caption: 'Estimates', compact: true });
  ctx.stage.append(tb.el);
  const ch = Plot(ctx, { h: 150, left: 14, right: 14, top: 0, bottom: 0, xr: [-4, 4], yr: [0, 1], label: 'Log-odds line and probability line with the baseline and group B markers' });
  const X = v => ch.X(v), ay = 50, py = 122;
  ch.pline(X(-4), ay, X(4), ay, 'axis'); ch.pline(X(0), ay - 12, X(0), ay + 12, 'land');
  for (const t of [-4, -2, 0, 2, 4]) { ch.pline(X(t), ay, X(t), ay + 6, 'axis'); ch.text(X(t), ay + 28, f0(t), 'tx tick', t === -4 ? 'start' : t === 4 ? 'end' : 'middle'); }
  ch.text(14, 20, 'Log-odds', 'tx tb'); const pl = ch.text(14, py - 10, 'Probability', 'tx tb');
  ch.pline(X(-4), py + 8, X(4), py + 8, 'axis');
  const pp = p => 14 + p * (ch.W - 28);
  ch.add(sv('circle', { class: 'fixm', r: 9, cx: X(b0), cy: ay })); ch.text(X(b0), ay - 16, 'base', 'tx tb', 'middle');
  const baseP = ch.add(sv('circle', { class: 'fixm', r: 9, cy: py + 8, cx: pp(U.plogis(b0)) })), bP = ch.add(sv('rect', { class: 'sqm', width: 16, height: 16, x: -8, y: py, rx: 3 }));
  const h = hx(ch, ay, { name: 'Group B log-odds', v: b0 > 0 ? -0.5 : 0.5, min: -3.9, max: 3.9, step: 0.1, fmt: v => `${f1(v)} log-odds, probability ${f2(U.plogis(v))}`,
    onChange: (v, u) => { bP.setAttribute('transform', `translate(${pp(U.plogis(v))},0)`); pl.textContent = `Probability  base ${prob(U.plogis(b0))}, B ${prob(U.plogis(v))}`; if (u) ctx.setReady(true); } });
  ctx.stage.append(ch.svg); h.set(h.v);
  const tol = 0.45;
  return {
    check() {
      const ok = Math.abs(h.v - T) <= tol; h.lock(); ch.add(sv('circle', { class: 'ringm good', r: 15, cx: X(T), cy: ay }), ch.over);
      const above = T > 0, sign = b1 < 0 ? 'negative' : 'positive';
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `Group B is ${f1(b0)} ${b1 < 0 ? '−' : '+'} ${f1(Math.abs(b1))} = ${f1(T)} log-odds, so ${prob(U.plogis(T))}. A ${sign} coefficient says "lower than baseline", and B is ${above ? 'still above' : 'below'} 50%.` };
    },
    solve() { h.set(T, true); }, solveWrong() { h.set(M.clamp(b1, -3.9, 3.9) === h.v ? b0 : b1, true); }, info: { b0, b1, T, tol, start: h.v },
  };
}

// ---------------------------------------------------------------------------
// Unit 6: Coding
// ---------------------------------------------------------------------------
const CODE_KEYS = ['trtA', 'trtB', 'half', 'one'];
function codingMeans(rng) {
  const mA = U.int(rng, 28, 62), d = U.int(rng, 16, 32) * (rng() < 0.5 ? 1 : -1), mB = M.clamp(mA + d, 12, 90); return [mA, mB];
}
function codingChart(ctx, cod, mA, mB, { line = false, h = roomH(ctx, 0, 190, 320) } = {}) {
  const ch = Plot(ctx, { h, left: 44, right: 14, top: 12, bottom: 34, xr: [-1.5, 1.5], yr: [0, 100], label: `Group means A and B plotted at their codes, ${cod.name}` });
  ch.axisY([[0, '0'], [50, '50'], [100, '100']]);
  const codes = [...new Set([cod.a, cod.b, 0])].sort((x, y) => x - y);
  ch.pline(ch.left, ch.H - ch.bottom, ch.W - ch.right, ch.H - ch.bottom, 'axis');
  for (const c of codes) { ch.pline(ch.X(c), ch.H - ch.bottom, ch.X(c), ch.H - ch.bottom + 5, 'axis'); ch.text(ch.X(c), ch.H - ch.bottom + 26, c === 0.5 ? '+½' : c === -0.5 ? '−½' : c > 0 ? '+' + c : c === 0 ? '0' : '−' + Math.abs(c), 'tx tick', 'middle'); }
  ch.pline(ch.X(0), ch.top, ch.X(0), ch.H - ch.bottom, 'zero');
  if (line) { const c = U.coefs(cod, mA, mB); ch.line(-1.5, c.intercept - 1.5 * c.slope, 1.5, c.intercept + 1.5 * c.slope, 'fitln'); }
  const a = ch.add(marker('circle', 9, 'ga'), ch.over), b = ch.add(marker('sq', 9, 'gb'), ch.over);
  a.setAttribute('transform', `translate(${ch.X(cod.a)},${ch.Y(mA)})`); b.setAttribute('transform', `translate(${ch.X(cod.b)},${ch.Y(mB)})`);
  ch.text(ch.X(cod.a), ch.Y(mA) - 16, 'A', 'tx tb ga', 'middle', ch.over);
  ch.text(ch.X(cod.b), ch.Y(mB) - 16, 'B', 'tx tb gb', 'middle', ch.over);
  ctx.stage.append(ch.svg); return ch;
}
function buildCodeTut(ctx) {
  const mA = 36, mB = 60; let cur = 'trtA', n = 0;
  ctx.setPrompt('Tap the flashing <b>Switch coding</b>. The same two means, a different zero.');
  const holder = el('div', { class: 'holder' }); const info = note('', 'big');
  const draw = () => { holder.replaceChildren(); const saved = ctx.stage; const tmp = { stage: holder, rng: ctx.rng }; const c = codingChart(tmp, MM.CODINGS[cur], mA, mB, { line: true, h: 215 }); const k = U.coefs(MM.CODINGS[cur], mA, mB); c.add(sv('circle', { class: 'ringm', r: 14, cx: c.X(0), cy: c.Y(k.intercept) }), c.over); info.innerHTML = `Codes: ${MM.CODINGS[cur].name}. Intercept (ring) = <b>${f0(k.intercept)}</b>.`; };
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center', onclick: () => { cur = 'half'; draw(); btn.disabled = true; btn.classList.remove('flash'); ctx.complete('Same data. With 0/1 the intercept is the mean of A; with −½/+½ it is halfway between A and B. Zero moved.'); } }, 'Switch coding');
  ctx.stage.append(holder, info, btn); draw();
  return { solve: () => btn.click() };
}
function buildCodeInt(ctx) {
  const rng = ctx.rng, key = U.pick(rng, CODE_KEYS), cod = MM.CODINGS[key], [mA, mB] = codingMeans(rng), K = U.coefs(cod, mA, mB);
  ctx.setPrompt(`Codes: <b>${cod.name}</b>. Drag the dot up or down to the model's <b>intercept</b>, the height at code 0.`);
  const ch = codingChart(ctx, cod, mA, mB);
  const start = K.intercept > 50 ? 12 : 88;
  const h = hy(ch, ch.X(0), { name: 'Intercept', v: start, min: 0, max: 100, step: 1, fmt: v => `intercept ${f0(v)}`, onChange: () => ctx.setReady(true) });
  const tol = 5;
  return {
    check() {
      const ok = Math.abs(h.v - K.intercept) <= tol; h.lock();
      const c2 = U.coefs(cod, mA, mB); ch.line(-1.5, c2.intercept - 1.5 * c2.slope, 1.5, c2.intercept + 1.5 * c2.slope, 'fitln'); ch.add(sv('circle', { class: 'ringm good', r: 15, cx: ch.X(0), cy: ch.Y(K.intercept) }), ch.over);
      const what = key === 'trtA' ? 'the mean of A (A is the reference, code 0)' : key === 'trtB' ? 'the mean of B (B is the reference, code 0)' : 'the point halfway between the two means (the codes are balanced around 0)';
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `With ${cod.name}, the intercept is ${what}: ${f0(K.intercept)}.` };
    },
    solve() { h.set(K.intercept, true); }, solveWrong() { h.set(key === 'trtA' || key === 'trtB' ? (mA + mB) / 2 : mA, true); }, info: { key, K, tol, mA, mB, start },
  };
}
function buildCodeCoef(ctx) {
  const rng = ctx.rng, key = U.pick(rng, CODE_KEYS), cod = MM.CODINGS[key], [mA, mB] = codingMeans(rng), K = U.coefs(cod, mA, mB);
  ctx.setPrompt(`Codes: <b>${cod.name}</b>. Tilt the line (drag the dot at code 1) so it passes through both dots.`);
  const ch = codingChart(ctx, cod, mA, mB);
  const ln = ch.add(sv('line', { class: 'fitln' })), ring = ch.add(sv('circle', { class: 'fixm', r: 7, cx: ch.X(0), cy: ch.Y(K.intercept) }), ch.over);
  const out = ch.text(ch.W - ch.right - 4, ch.top + 20, '', 'tx tb', 'end', ch.over);
  const h = hy(ch, ch.X(1), { name: 'Line height at code 1', v: M.clamp(K.intercept, 5, 95), min: 0, max: 100, step: 1, fmt: v => `height ${f0(v)} at code 1`,
    onChange: (v, u) => { const s = v - K.intercept; ln.setAttribute('x1', ch.X(-1.5)); ln.setAttribute('y1', ch.Y(K.intercept - 1.5 * s)); ln.setAttribute('x2', ch.X(1.5)); ln.setAttribute('y2', ch.Y(K.intercept + 1.5 * s)); out.textContent = `coefficient ${f0(s)}`; if (u) ctx.setReady(true); } });
  h.set(h.v);
  const tol = 5, target = K.intercept + K.slope;
  return {
    check() {
      const ok = Math.abs(h.v - target) <= tol; h.lock();
      const codesApart = cod.b - cod.a;
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (codesApart === 2 ? `The codes are 2 apart, so the coefficient is half the gap: ${f0(K.slope)}.` : `The codes are ${codesApart > 0 ? '1 apart' : '1 apart, B first'}, so the coefficient is ${codesApart > 0 ? 'the whole gap' : 'the gap with its sign flipped'}: ${f0(K.slope)} (B minus A is ${f0(mB - mA)}).`) };
    },
    solve() { h.set(M.clamp(target, 0, 100), true); },
    solveWrong() { const c = [K.intercept - K.slope, K.intercept + 2 * K.slope, K.intercept + (mB - mA)].find(v => v >= 0 && v <= 100 && Math.abs(v - target) > tol + 1); h.set(c == null ? K.intercept : c, true); },
    info: { key, K, tol, target, mA, mB, start: K.intercept },
  };
}
function buildCodeWhich(ctx) {
  const rng = ctx.rng, key = U.pick(rng, CODE_KEYS), cod = MM.CODINGS[key], [mA, mB] = codingMeans(rng), K = U.coefs(cod, mA, mB);
  ctx.setPrompt('These are the real group means. The model table is below. <b>Which coding</b> was used?');
  const ch = Plot(ctx, { h: 124, left: 44, right: 14, top: 8, bottom: 30, xr: [0, 3], yr: [0, 100], label: `Group means: A ${f0(mA)}, B ${f0(mB)}` });
  ch.axisY([[0, '0'], [50, '50'], [100, '100']]); ch.pline(ch.left, ch.H - ch.bottom, ch.W - ch.right, ch.H - ch.bottom, 'axis');
  ch.text(ch.X(1), ch.H - 6, 'A', 'tx tb ga', 'middle'); ch.text(ch.X(2), ch.H - 6, 'B', 'tx tb gb', 'middle');
  const a = ch.add(marker('circle', 9, 'ga'), ch.over), b = ch.add(marker('sq', 9, 'gb'), ch.over);
  a.setAttribute('transform', `translate(${ch.X(1)},${ch.Y(mA)})`); b.setAttribute('transform', `translate(${ch.X(2)},${ch.Y(mB)})`);
  const ra = ch.add(sv('circle', { class: 'ringm', r: 15, cy: 0, cx: ch.X(1), style: 'display:none' }), ch.over), rb = ch.add(sv('rect', { class: 'ringm', width: 30, height: 30, x: ch.X(2) - 15, y: 0, rx: 6, style: 'display:none' }), ch.over);
  ctx.stage.append(ch.svg);
  const tb = ModelTable({ cols: [{ label: 'Est.', aria: 'Estimate' }], rows: [{ name: 'Intercept', cells: [f0(K.intercept)] }, { name: 'x', cells: [f1(K.slope)] }], mode: 'none', caption: 'Model table', compact: true });
  ctx.stage.append(tb.el);
  const tiles = Choices(CODE_KEYS.map(k => ({ key: k, label: MM.CODINGS[k].name })), { cols: 2, onPick: k => {
    const c = MM.CODINGS[k]; ra.style.display = rb.style.display = ''; ra.setAttribute('cy', ch.Y(K.intercept + K.slope * c.a)); rb.setAttribute('y', ch.Y(K.intercept + K.slope * c.b) - 15); ctx.setReady(true); } });
  ctx.stage.append(tiles.el);
  return {
    check() {
      const ok = tiles.key === key; tiles.lock(); tiles.mark(key, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc');
      const c = cod; ra.style.display = rb.style.display = ''; ra.setAttribute('cy', ch.Y(K.intercept + K.slope * c.a)); rb.setAttribute('y', ch.Y(K.intercept + K.slope * c.b) - 15);
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `Only ${cod.name} puts the rings (intercept + slope × code) on both real means.` };
    },
    solve() { tiles.pick(key); }, solveWrong() { tiles.pick(CODE_KEYS.find(k => k !== key)); }, info: { key, K, mA, mB },
  };
}

// ---------------------------------------------------------------------------
// Unit 7: Interactions
// ---------------------------------------------------------------------------
function interPlot(ctx, m, { h = roomH(ctx, 90, 170, 300), drag = null, panel = null, label = 'Interaction plot', ylab = true, pulse = false, onChange = () => {}, w = null, ox = 0 } = {}) {
  const ch = Plot(ctx, { h, left: ylab ? 44 : 12, right: 52, top: 12, bottom: 34, xr: [-0.4, 1.4], yr: [0, 100], label, w });
  if (ylab) ch.axisY([[0, '0'], [50, '50'], [100, '100']]); else ch.pline(ch.left, ch.top, ch.left, ch.H - ch.bottom, 'axis');
  ch.pline(ch.left, ch.H - ch.bottom, ch.W - ch.right, ch.H - ch.bottom, 'axis');
  for (const [v, s] of [[0, 'A1'], [1, 'A2']]) { ch.pline(ch.X(v), ch.H - ch.bottom, ch.X(v), ch.H - ch.bottom + 5, 'axis'); ch.text(ch.X(v), ch.H - ch.bottom + 26, s, 'tx tick', 'middle'); }
  const api = { ch, m, lines: [], pts: [] };
  const draw = () => {
    for (const b of [0, 1]) {
      const l = api.lines[b] || (api.lines[b] = ch.add(sv('line', { class: 'iline ' + (b ? 'gb' : 'ga') })));
      l.setAttribute('x1', ch.X(0)); l.setAttribute('x2', ch.X(1)); l.setAttribute('y1', ch.Y(m[0][b])); l.setAttribute('y2', ch.Y(m[1][b]));
      for (const a of [0, 1]) { const k = a * 2 + b; if (!api.pts[k]) { api.pts[k] = ch.add(marker(b ? 'sq' : 'circle', 8, b ? 'gb' : 'ga'), ch.over); } api.pts[k].setAttribute('transform', `translate(${ch.X(a)},${ch.Y(m[a][b])})`); }
    }
  };
  draw(); api.draw = draw;
  ch.text(ch.X(1) + 26, ch.Y(m[1][0]) + 6, 'B1', 'tx tb ga', 'start'); const t2 = ch.text(ch.X(1) + 26, ch.Y(m[1][1]) + 6, 'B2', 'tx tb gb', 'start');
  api.t1 = ch.svg.querySelector('text.tb.ga');
  api.relabel = () => { api.t1.setAttribute('y', ch.Y(m[1][0]) + 6); t2.setAttribute('y', ch.Y(m[1][1]) + 6); if (Math.abs(ch.Y(m[1][0]) - ch.Y(m[1][1])) < 22) { const up = m[1][0] > m[1][1]; api.t1.setAttribute('y', ch.Y(m[1][0]) + (up ? -4 : 18)); t2.setAttribute('y', ch.Y(m[1][1]) + (up ? 18 : -4)); } };
  api.relabel();
  if (drag) api.h = hy(ch, ch.X(drag.a), { name: drag.name, v: m[drag.a][drag.b], min: 2, max: 98, step: 1, pulse, fmt: v => `mean ${f0(v)}`, shape: marker(drag.b ? 'sq' : 'circle', 11, 'hbodyg ' + (drag.b ? 'gb' : 'ga')), onChange: (v, u) => { m[drag.a][drag.b] = v; draw(); api.relabel(); onChange(v, u); } });
  ctx.stage.append(ch.svg); return api;
}
function interMeans(rng, { mode = 'parallel' } = {}) {
  for (;;) {
    const b1 = U.int(rng, 25, 55), e1 = U.pick(rng, [-1, 1]) * U.int(rng, 12, 28), gap = U.pick(rng, [-1, 1]) * U.int(rng, 15, 30), e2 = e1 + (mode === 'parallel' ? 0 : U.pick(rng, [-1, 1]) * U.int(rng, 14, 30));
    const m = [[b1, b1 + gap], [b1 + e1, b1 + gap + e2]];
    if (m.flat().every(v => v >= 8 && v <= 92) && Math.abs(gap) >= 15) return m;
  }
}
function buildInterTut(ctx) {
  const m = [[30, 55], [50, 75]];
  ctx.setPrompt('Drag the flashing square up or down. Watch the gap between the lines.');
  const readout = el('div', { class: 'stage-note big' });
  const api = interPlot(ctx, m, { drag: { a: 1, b: 1, name: 'Mean for B2 at A2' }, pulse: true, onChange: () => { upd(); if (Math.abs(U.interaction(m)) >= 20) { api.h.lock(); ctx.complete('When the lines stop being parallel, the effect of A depends on B: that is an interaction.'); } } });
  const upd = () => { readout.innerHTML = `Effect of A: orange <b>${m[1][0] - m[0][0] >= 0 ? '+' : '−'}${Math.abs(m[1][0] - m[0][0])}</b>, blue <b>${m[1][1] - m[0][1] >= 0 ? '+' : '−'}${Math.abs(m[1][1] - m[0][1])}</b>`; };
  ctx.stage.append(readout); upd();
  return { solve: () => api.h.set(95, true) };
}
function buildInterGoal(ctx) {
  const rng = ctx.rng, goal = U.pick(rng, ['parallel', 'flat', 'mirror']); let m, e1, target;
  for (;;) { m = interMeans(rng, { mode: 'cross' }); e1 = m[1][0] - m[0][0]; target = goal === 'parallel' ? m[0][1] + e1 : goal === 'flat' ? m[0][1] : m[0][1] - e1; if (target >= 8 && target <= 92 && Math.abs(target - m[1][1]) >= 12) break; }
  const startV = m[1][1];
  const text = { parallel: 'Make the two lines <b>parallel</b> (no interaction).', flat: 'Make the <b>blue</b> line flat: A has no effect when B is B2.', mirror: 'Make blue\'s effect of A the <b>exact opposite</b> of orange\'s.' }[goal];
  ctx.setPrompt('Drag the blue square at A2. ' + text);
  const readout = el('div', { class: 'stage-note big' });
  const api = interPlot(ctx, m, { drag: { a: 1, b: 1, name: 'Mean for B2 at A2' }, onChange: () => { upd(); ctx.setReady(true); } });
  const sg = x => (x >= 0 ? '+' : '−') + Math.abs(x);
  const upd = () => { readout.innerHTML = `Effect of A: orange <b>${sg(m[1][0] - m[0][0])}</b>, blue <b>${sg(m[1][1] - m[0][1])}</b>. Interaction: <b>${sg(U.interaction(m))}</b>`; };
  ctx.stage.append(readout); upd();
  const tol = 4;
  return {
    check() {
      const ok = Math.abs(api.h.v - target) <= tol; api.h.lock();
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + { parallel: 'Parallel lines mean A has the same effect at both levels of B. The interaction (the difference of the two effects) is 0.', flat: 'A flat line means no effect of A at B2, while orange still has one: so they differ, and that difference is the interaction.', mirror: 'Opposite effects: the difference between the two effects is as large as it can be for these lines.' }[goal] };
    },
    solve() { api.h.set(target, true); }, solveWrong() { api.h.set(M.clamp(target + (target > 50 ? -30 : 30), 2, 98), true); }, info: { target, tol, start: startV, goal, e1, m },
  };
}
function buildInterGap(ctx) {
  const rng = ctx.rng, m = interMeans(rng, { mode: 'cross' }), mode = U.pick(rng, ['trt1', 'trt2', 'sum']);
  const e = [m[1][0] - m[0][0], m[1][1] - m[0][1]], avg = (e[0] + e[1]) / 2;
  const codeTxt = { trt1: 'B1 = 0, B2 = 1', trt2: 'B1 = 1, B2 = 0', sum: 'B1 = −½, B2 = +½' }[mode], ans = { trt1: 'orange', trt2: 'blue', sum: 'avg' }[mode];
  ctx.setPrompt(`In <b>y ~ A * B</b> with B coded <b>${codeTxt}</b>, which rise from A1 to A2 is the <b>A coefficient</b>?`);
  const api = interPlot(ctx, m, { label: 'Interaction plot with the orange rise, the blue rise and the average rise' });
  const ch = api.ch, avgL = ch.add(sv('line', { class: 'avgln', x1: ch.X(0), x2: ch.X(1), y1: ch.Y((m[0][0] + m[0][1]) / 2), y2: ch.Y((m[1][0] + m[1][1]) / 2) }));
  const br = {};
  const rise = (key, y0, y1, dx, cls) => { const g = ch.add(sv('g', { class: 'rise ' + cls }), ch.over); g.append(sv('line', { x1: ch.X(1) + dx, x2: ch.X(1) + dx, y1: ch.Y(y0), y2: ch.Y(y1) }), sv('line', { x1: ch.X(1) + dx - 6, x2: ch.X(1) + dx, y1: ch.Y(y0), y2: ch.Y(y0) }), sv('line', { x1: ch.X(1) + dx - 6, x2: ch.X(1) + dx, y1: ch.Y(y1), y2: ch.Y(y1) })); br[key] = g; g.style.display = 'none'; };
  rise('orange', m[0][0], m[1][0], -16, 'ga'); rise('blue', m[0][1], m[1][1], -16, 'gb'); rise('avg', (m[0][0] + m[0][1]) / 2, (m[1][0] + m[1][1]) / 2, -16, 'avgc');
  const tiles = Choices([{ key: 'orange', label: 'Orange rise' }, { key: 'blue', label: 'Blue rise' }, { key: 'avg', label: 'Average rise' }], { cols: 3, onPick: k => { for (const [kk, g] of Object.entries(br)) g.style.display = kk === k ? '' : 'none'; avgL.style.display = k === 'avg' ? '' : 'none'; ctx.setReady(true); } });
  avgL.style.display = 'none'; ctx.stage.append(tiles.el);
  return {
    check() {
      const ok = tiles.key === ans; tiles.lock(); tiles.mark(ans, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc'); for (const [kk, g] of Object.entries(br)) g.style.display = kk === ans ? '' : 'none'; avgL.style.display = ans === 'avg' ? '' : 'none';
      const why = { trt1: 'B1 is the reference (0), so the A coefficient is the effect of A at B1 only: a simple effect.', trt2: 'B2 is the reference (0), so the A coefficient is the effect of A at B2 only.', sum: 'With balanced −½ / +½ codes, 0 is halfway between B1 and B2, so the A coefficient is the average effect of A.' }[mode];
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + why };
    },
    solve() { tiles.pick(ans); }, solveWrong() { tiles.pick(ans === 'orange' ? 'avg' : 'orange'); }, info: { mode, ans, e, avg, m },
  };
}
function buildInterThree(ctx) {
  const rng = ctx.rng, kind = U.pick(rng, ['none', 'same', 'differ']);
  let m1, m2;
  for (let t = 0; t < 300; t++) {
    const base = interMeans(rng, { mode: 'parallel' }), cross = interMeans(rng, { mode: 'cross' });
    if (kind === 'none') { m1 = base; m2 = interMeans(rng, { mode: 'parallel' }); }
    else if (kind === 'same') { m1 = cross; const sh = U.pick(rng, [-12, 0, 12]); m2 = cross.map(r => r.map(v => v + sh)); if (!m2.flat().every(v => v >= 8 && v <= 92)) continue; }
    else { m1 = rng() < 0.5 ? base : cross; m2 = interMeans(rng, { mode: 'cross' }); if (Math.abs(U.interaction(m1) - U.interaction(m2)) < 16) continue; }
    break;
  }
  const d1 = U.interaction(m1), d2 = U.interaction(m2);
  ctx.setPrompt('Two panels, C1 and C2, each show the A × B lines. What does the pair show?');
  const tmp = { stage: document.createElement('div') }; const W = Math.round(stagePad(ctx.stage)); const half = Math.floor(W / 2) - 2;
  const wrap = el('div', { class: 'twopanel' }); ctx.stage.append(wrap);
  const mk = (m, nm) => { const s = { stage: wrap, rng }; const ap = interPlot({ stage: wrap }, m, { h: 150, ylab: false, label: `Panel ${nm}: B1 and B2 lines across A1 and A2`, w: half }); ap.ch.text(ap.ch.left + 2, 18, nm, 'tx tb', 'start'); return ap; };
  const pa = mk(m1, 'C1'), pb = mk(m2, 'C2');
  const key = kind;
  const tiles = Choices([{ key: 'none', label: 'No A × B interaction in either' }, { key: 'same', label: 'Same A × B interaction in both' }, { key: 'differ', label: 'A × B differs: three-way interaction' }], { cols: 1, onPick: () => ctx.setReady(true) });
  ctx.stage.append(tiles.el);
  return {
    check() {
      const ok = tiles.key === key; tiles.lock(); tiles.mark(key, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + { none: 'Both panels have parallel lines, so no A × B and no three-way.', same: `Both panels have the same difference of differences (${f0(d1)}), so the two-way interaction is real but the three-way is 0.`, differ: `The interaction is ${f0(d1)} in C1 and ${f0(d2)} in C2. The three-way interaction is that difference: ${f0(d2 - d1)}.` }[kind] };
    },
    solve() { tiles.pick(key); }, solveWrong() { tiles.pick(key === 'none' ? 'same' : 'none'); }, info: { kind, d1, d2, m1, m2 },
  };
}

// ---------------------------------------------------------------------------
// The units of Part 1
// ---------------------------------------------------------------------------
const S5 = { kind: 'streak', target: 5, hearts: 2 }, S10 = { kind: 'streak', target: 10, hearts: 2 }, TUT = { kind: 'tutorial' };
const PART1 = [
  { title: 'A line makes predictions', part: 1, intro: 'Height of the line at an x: the prediction. The intercept is the height at x = 0.', subs: [
    { id: 'l-tut', name: 'First slide', blurb: 'Ride a dot along a line', help: 'Drag the dot along the line. The height under the dot is the prediction for that x.', ...TUT, build: buildLineTut },
    { id: 'l-read', name: 'Read the line', blurb: 'Drag a dot to the height the line gives', help: 'Read the line, not a number: drag the dot to where the line is at the marked x (or to where it reaches the marked height).', ...S5, build: buildLineRead },
    { id: 'l-zero', name: 'Where is zero?', blurb: 'The intercept is read at the model\'s zero', help: 'The intercept is the prediction where the model\'s x is 0. Without centring that is age 0, far from the data. After centring it is the average.', ...S5, build: buildZero },
  ] },
  { title: 'Bounded outcomes', part: 1, intro: 'A proportion cannot go below 0% or above 100%. A straight line can.', subs: [
    { id: 'b-tut', name: 'Past the edge', blurb: 'Slide until the line says something impossible', help: 'Slide the dot along the line to the right.', ...TUT, build: buildBoundTut },
    { id: 'b-break', name: 'Where it breaks', blurb: 'Find where the line leaves 0% to 100%', help: 'Slide the dot to the first x where the straight line predicts less than 0% or more than 100%.', ...S5, build: buildBound },
  ] },
  { title: 'Three scales', part: 1, intro: 'Probability, odds and log-odds are three names for one chance. Models work on log-odds.', subs: [
    { id: 's-tut', name: 'One chance, three lines', blurb: 'Drag a marker, watch the others', help: 'Drag the flashing marker. The three lines show the same chance.', ...TUT, build: buildScaleTut },
    { id: 's-set', name: 'Set a reading', blurb: 'Move until a scale reads a number', help: 'Move any marker until the named scale reads the number asked for. Read the live numbers above each line.', ...S5, build: buildScaleSet },
    { id: 's-fn', name: 'Which call?', blurb: 'plogis, qlogis, exp or log', help: 'Tap a call to see where its answer lands (hollow ring). The right one lands on the marker in the row you want.', ...S10, build: buildScaleFn },
  ] },
  { title: 'Averaging on the wrong scale', part: 1, intro: 'The average of log-odds is not the log-odds of the average probability. Cells near 0 or 100% pull hard.', subs: [
    { id: 'a-tut', name: 'Pull the bar', blurb: 'One cell near 100% moves the average', help: 'Drag the flashing bar to the right and watch both averages.', ...TUT, build: buildAvgTut },
    { id: 'a-mid', name: 'Middle of the bars', blurb: 'Drag to the log-odds average', help: 'Each bar reaches a cell\'s log-odds. Drag the marker to the average of the bar ends. The hollow marker shows the average of probabilities afterwards.', ...S5, build: buildAvgMid },
    { id: 'a-which', name: 'Which flag?', blurb: 'The probability the model reports', help: 'The model averages log-odds. One flag is the probability that gives; the other is the average of the probabilities.', ...S10, build: buildAvgWhich },
    { id: 'a-lever', name: 'Reach the star', blurb: 'Move one bar to land the average', help: 'Drag the one live bar until the filled marker reaches the star.', ...S5, build: buildAvgLever },
  ] },
  { title: 'Reading a logistic table', part: 1, intro: 'Estimates are on the log-odds scale. Tests are against 0 on that scale, not against .5.', subs: [
    { id: 't-tut', name: 'First tap', blurb: 'Tap the baseline log-odds', help: 'Tap the flashing number.', ...TUT, build: buildTabTut },
    { id: 't-tap', name: 'What does it mean?', blurb: 'Tap the number the question asks for', help: 'Tap the cell (or row) that answers the question. Columns: Est. estimate, SE standard error, z, p.', ...S10, build: buildTabTap },
    { id: 't-group', name: 'Group B on the line', blurb: 'Baseline plus change, then probability', help: 'The B marker is the baseline log-odds plus the group B change. The probability line shows what that is as a chance.', ...S5, build: buildTabGroup },
  ] },
  { title: 'Coding', part: 1, intro: 'Which numbers a factor\'s levels get decides what the intercept and slope mean.', subs: [
    { id: 'c-tut', name: 'Switch the zero', blurb: 'Same means, different coding', help: 'Tap Switch coding.', ...TUT, build: buildCodeTut },
    { id: 'c-int', name: 'Where is the intercept?', blurb: 'Height at code 0', help: 'The intercept is the model line\'s height where the code is 0. Drag the dot there.', ...S5, build: buildCodeInt },
    { id: 'c-coef', name: 'How steep?', blurb: 'The coefficient per 1 step of code', help: 'Drag the dot at code 1 to tilt the line through both group means. The coefficient is the change per 1 step of code.', ...S5, build: buildCodeCoef },
    { id: 'c-which', name: 'Which coding was used?', blurb: 'Read it off the table', help: 'Tap a coding to see the model\'s predicted means as rings. The right coding puts rings on both real means.', ...S10, build: buildCodeWhich },
  ] },
  { title: 'Interactions', part: 1, intro: 'An interaction is a difference of differences: does the effect of A depend on B?', subs: [
    { id: 'i-tut', name: 'Drag a point', blurb: 'Watch the lines come apart', help: 'Drag the flashing square.', ...TUT, build: buildInterTut },
    { id: 'i-goal', name: 'Make it so', blurb: 'Parallel, flat or opposite', help: 'Drag the blue square at A2 to make the lines do what is asked.', ...S5, build: buildInterGoal },
    { id: 'i-gap', name: 'Which rise?', blurb: 'What the A coefficient is, by coding', help: 'Tap a rise to see it on the picture. The A coefficient is the rise at the level of B that has code 0.', ...S10, build: buildInterGap },
    { id: 'i-three', name: 'Two panels', blurb: 'Difference of differences, again', help: 'Compare the A × B pattern in the two panels. A three-way interaction is a difference between them.', ...S5, build: buildInterThree },
  ] },
];
