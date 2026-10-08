// Unit 3: regression the Bayesian way. An intercept-only model (one typical
// value and a spread), then a slope, noise, a prior on the slope, reading a
// brms-style table, the fuzz of posterior lines, and centring x. Plants and
// dough, nothing contested. Every key is a least-squares or normal-curve
// fact, checked against R's lm() and qnorm() by tools/check-keys.js.

const U3C = {
  seed: { name: 'seedlings', xName: 'days', yName: 'cm', unit: 'day', xd: [0, 40], yd: [0, 40], xt: [0, 10, 20, 30, 40], yt: [0, 10, 20, 30, 40], xr: [10, 30], a: [4, 10], b: [0.5, 0.9], s: [1.6, 2.6], m: 1, per: 'cm per day', thing: 'Seedling height' },
  dough: { name: 'dough', xName: 'min', yName: 'cm', unit: 'minute', xd: [0, 80], yd: [0, 40], xt: [0, 20, 40, 60, 80], yt: [0, 10, 20, 30, 40], xr: [20, 60], a: [3, 8], b: [0.25, 0.45], s: [1.6, 2.6], m: 0.5, per: 'cm per min', thing: 'Dough height' },
};
const u3ctx = rng => U3C[BM.pick(rng, ['seed', 'dough'])];
const uni = (rng, [lo, hi]) => lo + rng() * (hi - lo);

// Twelve (or n) plants measured at spread-out times, from a hidden true line.
function genXY(rng, c, { n = 12, xr = c.xr, ydom = c.yd } = {}) {
  for (let t = 0; t < 500; t++) {
    const a = uni(rng, c.a), b = uni(rng, c.b), s = uni(rng, c.s);
    const xs = Array.from({ length: n }, (_, i) => r1(xr[0] + (i + 0.05 + rng() * 0.9) / n * (xr[1] - xr[0])));
    const ys = xs.map(x => r1(a + b * x + s * BM.randn(rng)));
    if (ys.some(y => y < 2 || y > ydom[1] - 2)) continue;
    const fit = BM.ols(xs, ys); if (fit.b < 0.8 * b) continue;
    return { xs, ys, fit, a, b, s };
  }
  throw new Error('no line data');
}
const fitY = (f, x) => f.a + f.b * x;
function linePlot(c, { xd = c.xd, yd = c.yd, H = 232, label = '' } = {}) {
  return Plot({ H, xd, yd, xticks: c.xt, yticks: c.yt, xTitle: c.xName, yTitle: c.yName, label, grid: true });
}
const ptsDraw = (pl, xs, ys, cls = 'pdot grey', r = 5) => xs.map((x, i) => S.dot(pl.sx(x), pl.sy(ys[i]), r, cls));
const lineDraw = (pl, y0, y1, cls = 'pline', x0 = pl.xd[0], x1 = pl.xd[1]) => S.line(pl.sx(x0), pl.sy(y0), pl.sx(x1), pl.sy(y1), cls);
const lineAt = (pl, a, b, cls) => lineDraw(pl, a + b * pl.xd[0], a + b * pl.xd[1], cls);

// dots piled up above a number line
function dotStack(pl, vals, { r = 6.5, dy = 13, cls = 'pdot grey' } = {}) {
  const rows = {};
  return vals.map(v => { const k = Math.round(v); rows[k] = (rows[k] || 0) + 1; return S.dot(pl.sx(k), pl.sy(0) - r - 2 - (rows[k] - 1) * dy, r, cls); });
}

// ---------------------------------------------------------------------------
// 3.0 / 3.1 intercept-only: one typical value and its spread
// ---------------------------------------------------------------------------
const MEAN_XD = [0, 40], MEAN_TICKS = [0, 10, 20, 30, 40];
function meanStrip() { return Strip({ xd: MEAN_XD, ticks: MEAN_TICKS, H: 132, label: '' }); }
function buildMeanTut(ctx) {
  const rng = ctx.rng, vals = Array.from({ length: 15 }, () => Math.round(18 + 3.2 * BM.randn(rng)));
  ctx.setPrompt('Fifteen seedlings, each a dot at its height in cm. One marker is the model’s single guess for a typical height. Drag the flashing marker.');
  const pl = meanStrip(); pl.setLabel(`Fifteen seedling heights between ${Math.min(...vals)} and ${Math.max(...vals)} centimetres`);
  const label = el('div', { class: 'livelabel' });
  const draw = m => { pl.draw([...dotStack(pl, vals), S.line(pl.sx(m), pl.sy(1), pl.sx(m), pl.sy(0), 'pline dash')]); label.textContent = `Guess for a typical height: ${Math.round(m)} cm`; };
  const slider = AxisSlider({ values: [0.075], labels: ['Typical height'], step: 0.025, onChange: (v, user) => { draw(toUnits(v[0], MEAN_XD)); if (user && Math.abs(v[0] - 0.075) > 0.1) ctx.complete('That marker is the model’s whole idea of a seedling: one typical value. It is called the intercept.'); } });
  slider.el.querySelector('.as-thumb').classList.add('flash');
  draw(toUnits(0.075, MEAN_XD)); ctx.stage.append(pl.el, slider.el, label);
  return { solve() { slider.set(0, 0.45, true); } };
}

function meanCase(rng) {
  for (let t = 0; t < 500; t++) {
    const m = uni(rng, [13, 27]), sd = uni(rng, [3.5, 6]);
    if (Math.abs(m - 20) < 4) continue;
    const vals = Array.from({ length: 15 }, () => Math.round(m + sd * BM.randn(rng)));
    if (vals.some(v => v < 1 || v > 39)) continue;
    const mean = BM.mean(vals), s = BM.sd(vals); if (Math.abs(mean - 20) < 4 || s < 3.3) continue;
    return { vals, mean, sd: s };
  }
  throw new Error('no mean case');
}
function buildMean(ctx) {
  const c = meanCase(ctx.rng);
  ctx.setPrompt('Drag the left handle to where the dots balance. Drag the right handle so the shaded band holds about 2 in 3 of the dots.');
  const pl = meanStrip(); pl.setLabel(`Fifteen seedling heights, most between ${Math.round(c.mean - c.sd)} and ${Math.round(c.mean + c.sd)} centimetres`);
  const label = el('div', { class: 'livelabel' });
  const get = () => { const [a, b] = slider.get().map(v => toUnits(v, MEAN_XD)); return { mu: a, sigma: b - a }; };
  const draw = () => { const { mu, sigma } = get(); const inside = c.vals.filter(v => Math.abs(v - mu) <= sigma).length;
    pl.draw([S.rect(pl.sx(mu - sigma), pl.sy(1), pl.sx(mu + sigma) - pl.sx(mu - sigma), pl.sy(0) - pl.sy(1), 'pband'), ...dotStack(pl, c.vals), S.line(pl.sx(mu), pl.sy(1), pl.sx(mu), pl.sy(0), 'pline dash')]);
    label.textContent = `Typical ${Math.round(mu)} cm, spread ${Math.round(sigma)} cm: the band holds ${inside} of 15 dots`; ctx.setReady(slider.touched()); };
  const slider = AxisSlider({ values: [0.45, 0.6], labels: ['Typical height', 'One spread above it'], step: 0.025, minGap: 0.02, onChange: draw });
  draw(); ctx.stage.append(pl.el, slider.el, label);
  return {
    check() {
      const { mu, sigma } = get(), okM = Math.abs(mu - c.mean) <= 1.5 + 1e-9, okS = Math.abs(sigma - c.sd) <= 0.3 * c.sd + 0.3 + 1e-9, ok = okM && okS; slider.lock();
      const why = ok ? '' : !okM ? ' Typical: where the dots balance.' : sigma < c.sd ? ' The band is too narrow.' : ' The band is too wide.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}Typical ${fmtNum(c.mean)} cm, spread ${fmtNum(c.sd)} cm: the intercept and sigma, the model’s two numbers.` };
    },
    solve() { const a = toShare(c.mean, MEAN_XD), b = toShare(c.mean + c.sd, MEAN_XD); if (a > slider.get()[1]) { slider.set(1, b, true); slider.set(0, a, true); } else { slider.set(0, a, true); slider.set(1, b, true); } },
    solveWrong() { const w = c.mean > 20 ? c.mean - 8 : c.mean + 8, a = toShare(w, MEAN_XD), b = toShare(w + c.sd, MEAN_XD); if (w > c.mean) { slider.set(1, b, true); slider.set(0, a, true); } else { slider.set(0, a, true); slider.set(1, b, true); } },
    info: c,
  };
}

// ---------------------------------------------------------------------------
// 3.2 / 3.3 a line through points
// ---------------------------------------------------------------------------
function buildLineTut(ctx) {
  const rng = ctx.rng, c = U3C.seed, d = genXY(rng, c);
  ctx.setPrompt('Each dot is a seedling: its age in days and its height. Tilt the line: drag the flashing handle up or down.');
  const pl = linePlot(c, { label: `Twelve seedlings: older ones are taller, rising from about ${Math.round(d.ys[0])} to ${Math.round(d.ys[11])} centimetres` });
  const x0 = c.xr[0], x1 = c.xr[1], yLeft = fitY(d.fit, x0);
  let h;
  const draw = () => { const y1 = h ? h.get() : fitY(d.fit, x1) - 10, slope = (y1 - yLeft) / (x1 - x0); pl.draw([...ptsDraw(pl, d.xs, d.ys), lineAt(pl, yLeft - slope * x0, slope)]); };
  h = pl.handle({ axis: 'y', x: x1, y: yLeft + 0, min: 0, max: 40, step: 0.5, label: 'Right end of the line, height in cm', fmt: v => `${v} cm`, onChange: (v, user) => { draw(); if (user && Math.abs(v - yLeft) > 4) ctx.complete('A line has two numbers: where it starts (the intercept) and how steeply it rises (the slope). Tilting it changed the slope.'); } });
  h.flash(true); ctx.stage.append(pl.el);
  return { solve() { h.set(fitY(d.fit, x1), true); } };
}

function buildFit(ctx) {
  const rng = ctx.rng, c = u3ctx(rng), d = genXY(rng, c), f = d.fit, [x0, x1] = c.xr;
  ctx.setPrompt(`${c.thing} against ${c.xName}. Drag the two handles so the line runs through the middle of the dots.`);
  const pl = linePlot(c, { label: `${c.thing} rises with ${c.unit}s: twelve dots from about ${Math.round(f.a + f.b * x0)} to ${Math.round(f.a + f.b * x1)} centimetres` });
  const yMean = BM.mean(d.ys), st = { a: yMean, b: yMean };
  const draw = () => { const slope = (st.b - st.a) / (x1 - x0); pl.draw([...ptsDraw(pl, d.xs, d.ys), lineAt(pl, st.a - slope * x0, slope)]); };
  const ha = pl.handle({ axis: 'y', x: x0, y: yMean, min: 0, max: 40, step: 0.5, label: 'Left end of the line, height in cm', fmt: v => `${v} cm`, onChange: (v, user) => { st.a = v; draw(); if (user) ctx.setReady(true); } });
  const hb = pl.handle({ axis: 'y', x: x1, y: yMean, min: 0, max: 40, step: 0.5, label: 'Right end of the line, height in cm', fmt: v => `${v} cm`, onChange: (v, user) => { st.b = v; draw(); if (user) ctx.setReady(true); } });
  ctx.stage.append(pl.el);
  const tol = 3;
  return {
    check() {
      const ea = Math.abs(ha.get() - fitY(f, x0)), eb = Math.abs(hb.get() - fitY(f, x1)), ok = ea <= tol + 1e-9 && eb <= tol + 1e-9;
      ha.lock(); hb.lock(); const slope = (hb.get() - ha.get()) / (x1 - x0);
      pl.draw([...ptsDraw(pl, d.xs, d.ys), lineAt(pl, f.a, f.b, 'pline good'), lineAt(pl, ha.get() - slope * x0, slope, 'pline dash')]);
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}The best line starts at ${fmtNum(f.a)} cm at ${c.unit} 0 (the intercept) and rises ${fmtNum(f.b, 2)} ${c.per} (the slope).` };
    },
    solve() { ha.set(fitY(f, x0), true); hb.set(fitY(f, x1), true); },
    solveWrong() { ha.set(yMean, true); hb.set(yMean, true); },
    info: { xs: d.xs, ys: d.ys, a: f.a, b: f.b, sigma: f.sigma, xr: c.xr, tol },
  };
}

// ---------------------------------------------------------------------------
// 3.4 the line is not the data: add the noise
// ---------------------------------------------------------------------------
function buildNoise(ctx) {
  const rng = ctx.rng, c = u3ctx(rng);
  let d; do { d = genXY(rng, c, { n: 40 }); } while (d.fit.sigma < 1.5 || d.fit.sigma > 4.5);
  const f = d.fit, zs = d.xs.map(() => BM.randn(rng)), SMAX = 8;
  ctx.setPrompt('Hollow dots are real plants around the fixed line. Slide sigma until the red simulated dots scatter as much as the real ones.');
  const pl = linePlot(c, { H: 214, label: `Forty real plants scattered around a fitted line, with simulated plants beside them` });
  const label = el('div', { class: 'livelabel' });
  const draw = s => { pl.draw([lineAt(pl, f.a, f.b, 'pline good'), ...ptsDraw(pl, d.xs, d.ys, 'pdot ghostdot', 4.5), ...d.xs.map((x, i) => S.dot(pl.sx(x), pl.sy(fitY(f, x) + s * zs[i]), 4, 'pdot sim'))]); label.textContent = `Sigma, the scatter: ${fmtNum(s)} cm`; };
  const slider = AxisSlider({ values: [0], labels: ['Sigma, the scatter around the line, in cm'], step: 0.025, onChange: v => { draw(v[0] * SMAX); ctx.setReady(slider.touched()); } });
  draw(0); ctx.stage.append(pl.el, label, slider.el);
  return {
    check() {
      const s = slider.get()[0] * SMAX, ok = Math.abs(s - f.sigma) <= 0.3 * f.sigma + 0.3 + 1e-9; slider.lock();
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}The real scatter is about ${fmtNum(f.sigma)} cm. Simulated data is the line plus noise of size sigma.` };
    },
    solve() { slider.set(0, f.sigma / SMAX, true); },
    solveWrong() { slider.set(0, f.sigma > 3 ? 0.04 : 0.8, true); },
    info: { sigma: f.sigma, xs: d.xs, ys: d.ys, a: f.a, b: f.b },
  };
}

// ---------------------------------------------------------------------------
// 3.5 a prior on the slope: a fan of lines
// ---------------------------------------------------------------------------
const PRIOR_VARIANTS = [
  { xd: [0, 40], yd: [0, 40], xt: [0, 10, 20, 30, 40], xName: 'days', yName: 'cm', per: 'cm per day', m: 1 },
  { xd: [0, 80], yd: [0, 40], xt: [0, 20, 40, 60, 80], xName: 'min', yName: 'cm', per: 'cm per min', m: 0.5 },
  { xd: [0, 20], yd: [0, 40], xt: [0, 5, 10, 15, 20], xName: 'days', yName: 'cm', per: 'cm per day', m: 2 },
];
const PRIOR_QS = Array.from({ length: 25 }, (_, i) => BM.normQuantile((i + 0.5) / 25));
function buildSlopePrior(ctx) {
  const v = BM.pick(ctx.rng, PRIOR_VARIANTS), m = v.m, SMAX = 1.6 * m;
  ctx.setPrompt('Each line is a slope the prior allows. Plants cannot go below 0 or above 40 cm. Slide until nearly all lines stay in the frame.');
  const pl = Plot({ H: 214, xd: v.xd, yd: v.yd, xticks: v.xt, yticks: [0, 10, 20, 30, 40], xTitle: v.xName, yTitle: v.yName, grid: true, label: 'A fan of 25 possible lines through the middle of the frame' });
  const mx = (v.xd[0] + v.xd[1]) / 2, my = 20, label = el('div', { class: 'livelabel' });
  const draw = (s, flag = false) => { pl.draw(PRIOR_QS.map(z => { const slope = z * s, out = Math.abs(slope) > m; return lineDraw(pl, my + slope * (v.xd[0] - mx), my + slope * (v.xd[1] - mx), 'pline fine' + (flag && out ? ' circ' : '')); })); label.textContent = `Prior spread of the slope: ${fmtNum(s, 2)} ${v.per}`; };
  const slider = AxisSlider({ values: [0.5], labels: ['Prior spread of the slope'], step: 0.02, onChange: x => { draw(x[0] * SMAX); ctx.setReady(slider.touched()); } });
  draw(0.5 * SMAX); ctx.stage.append(pl.el, label, slider.el);
  const mass = s => 2 * BM.normCdf(m / s) - 1, lo = m / BM.normQuantile(0.995), hi = m / BM.normQuantile(0.95);
  return {
    check() {
      const s = slider.get()[0] * SMAX, ok = s >= lo - 1e-9 && s <= hi + 1e-9; slider.lock(); draw(s, true);
      const inside = PRIOR_QS.filter(z => Math.abs(z * s) <= m).length;
      const why = ok ? '' : s < lo ? ' Too tight: nearly flat lines only.' : ' Too loose: many lines leave the frame.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}${inside} of 25 lines stay in. A spread of ${fmtNum(lo, 2)} to ${fmtNum(hi, 2)} ${v.per} keeps nearly all in.` };
    },
    solve() { slider.set(0, (lo + hi) / 2 / SMAX, true); },
    solveWrong() { slider.set(0, 0.75, true); },
    info: { m, smax: SMAX, lo, hi, mass },
  };
}

// ---------------------------------------------------------------------------
// 3.6 reading a brms-style table
// ---------------------------------------------------------------------------
const TABLE_ASKS = [
  { id: 'slopeEst', text: (c) => `Tap the best guess for how much taller a seedling gets per extra ${c.unit}.`, cell: [1, 0] },
  { id: 'slopeHi', text: () => 'Tap the highest value the slope could plausibly have (the upper end of its 95% interval).', cell: [1, 2] },
  { id: 'sigma', text: () => 'Tap the number for how far a typical dot sits from the line.', cell: [2, 0] },
  { id: 'intLo', text: (c) => `Tap the lowest plausible value of the intercept, the height at ${c.xName} 0.`, cell: [0, 1] },
];
function tableRows(f) {
  const z = 1.96, row = (e, se) => [fmtNum(e, 2), fmtNum(e - z * se, 2), fmtNum(e + z * se, 2)];
  return [{ name: 'Intercept', cells: row(f.a, f.seA) }, { name: 'slope', cells: row(f.b, f.seB) }, { name: 'sigma', cells: row(f.sigma, f.seSigma) }];
}
function buildTable(ctx) {
  const rng = ctx.rng, c = U3C.seed;
  const d = genXY(rng, c, { n: 30 }), f = d.fit, rows = tableRows(f); rows[1].name = 'days';
  const ask = BM.pick(rng, TABLE_ASKS);
  ctx.setPrompt(ask.text(c));
  const tbl = ParamTable({ cols: ['Est.', 'l-95%', 'u-95%'], rows, mode: 'cell', onPick: () => ctx.setReady(true), label: 'Model summary, as brms prints it: estimate and the two ends of the 95 percent interval for the intercept, the slope and sigma' });
  ctx.stage.append(tbl.el, el('div', { class: 'stage-note' }, 'Est. = estimate. l-95% and u-95% = lower and upper end of the 95% interval.'));
  return {
    check() {
      const p = tbl.get(), ok = p.r === ask.cell[0] && p.c === ask.cell[1]; tbl.reveal({ r: ask.cell[0], c: ask.cell[1] }, ok ? null : p);
      const tail = { slopeEst: 'The estimate is the middle of the posterior.', slopeHi: 'The interval l-95% to u-95% holds 95% of the posterior.', sigma: 'sigma is the typical scatter around the line.', intLo: 'The intercept is the height at x = 0, here before the first measurement, so it is quite uncertain.' }[ask.id];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${tail}` };
    },
    solve() { tbl.pick(ask.cell[0], ask.cell[1]); },
    solveWrong() { tbl.pick((ask.cell[0] + 1) % 3, ask.cell[1]); },
    info: { ask: ask.id, cell: ask.cell, xs: d.xs, ys: d.ys, table: rows.map(r => r.cells), est: [f.a, f.b, f.sigma], se: [f.seA, f.seB, f.seSigma] },
  };
}

// ---------------------------------------------------------------------------
// 3.7 the fuzz of posterior lines: where is the line surest?
// ---------------------------------------------------------------------------
function fuzzCase(rng) {
  const c = U3C.seed, side = BM.pick(rng, ['left', 'right']), xr = side === 'right' ? [22, 38] : [2, 18];
  for (let t = 0; t < 500; t++) {
    const d = genXY(rng, { ...c, xr, a: [4, 8], b: [0.35, 0.65] }, { n: 14, ydom: [0, 50] }), lines = BM.lineDraws(rng, d.fit, 40);
    if (lines.some(l => l.a < -20 || l.a + 40 * l.b > 70)) continue;
    return { d, lines, side, xr, ask: BM.pick(rng, ['most', 'least']) };
  }
  throw new Error('no fuzz case');
}
function buildFuzz(ctx) {
  const k = fuzzCase(ctx.rng), c = U3C.seed, f = k.d.fit, farEnd = k.side === 'right' ? 0 : 40;
  ctx.setPrompt(k.ask === 'most' ? 'Each faint line is a possible fit given the data. Drag the marker to where the lines disagree the most about the height.' : 'Each faint line is a possible fit given the data. Drag the marker to where the lines agree the most about the height.');
  const pl = Plot({ H: 232, xd: [0, 40], yd: [0, 50], xticks: [0, 10, 20, 30, 40], yticks: [0, 10, 20, 30, 40, 50], xTitle: 'days', yTitle: 'cm', grid: true, label: `Dots from ${k.xr[0]} to ${k.xr[1]} days and forty faint possible lines; the lines fan out far from the dots and pinch together near them` });
  const draw = x => pl.draw([...k.lines.map(l => lineAt(pl, l.a, l.b, 'pline fine')), ...ptsDraw(pl, k.d.xs, k.d.ys, 'pdot grey', 4.5), S.line(pl.sx(x), pl.sy(0), pl.sx(x), pl.sy(50), 'pline dash')]);
  const h = pl.handle({ axis: 'x', x: 20, y: 4, min: 0, max: 40, step: 1, label: 'Marker position, in days', fmt: v => `${v} days`, onChange: (v, user) => { draw(v); if (user) ctx.setReady(true); } });
  draw(20); ctx.stage.append(pl.el);
  const okAt = x => (k.ask === 'most' ? Math.abs(x - farEnd) <= 6 : Math.abs(x - f.xb) <= 5);
  return {
    check() {
      const x = h.get(), ok = okAt(x); h.lock();
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}The lines pinch together near the middle of the data (day ${Math.round(f.xb)}) and fan out the further you go, most at day ${farEnd}.` };
    },
    solve() { h.set(k.ask === 'most' ? farEnd : f.xb, true); },
    solveWrong() { h.set(k.ask === 'most' ? f.xb : farEnd, true); },
    info: { ask: k.ask, side: k.side, xb: f.xb, far: farEnd, xs: k.d.xs, sigma: f.sigma, sxx: f.sxx, n: f.n },
  };
}

// ---------------------------------------------------------------------------
// 3.8 centring: where should x be zero?
// ---------------------------------------------------------------------------
function buildCentre(ctx) {
  const rng = ctx.rng, c = U3C.seed, xr = BM.pick(rng, [[16, 36], [4, 24]]), d = genXY(rng, { ...c, xr, a: [4, 8], b: [0.5, 0.8] }, { n: 12 }), f = d.fit, yb = BM.mean(d.ys);
  ctx.setPrompt('Drag the vertical marker to the day where the green line is as high as the dashed average height of all the plants.');
  const pl = Plot({ H: 214, xd: [0, 40], yd: [0, 40], xticks: [0, 10, 20, 30, 40], yticks: [0, 10, 20, 30, 40], xTitle: 'days', yTitle: 'cm', grid: true, label: `Twelve seedlings from ${xr[0]} to ${xr[1]} days with their line and a dashed line at their average height` });
  const label = el('div', { class: 'livelabel' });
  const draw = x => { pl.draw([S.line(pl.sx(0), pl.sy(yb), pl.sx(40), pl.sy(yb), 'pline dash grey'), lineAt(pl, f.a, f.b, 'pline good'), ...ptsDraw(pl, d.xs, d.ys, 'pdot grey', 4.5), S.line(pl.sx(x), pl.sy(0), pl.sx(x), pl.sy(40), 'pline'), S.dot(pl.sx(x), pl.sy(fitY(f, x)), 7, 'pdot hollow')]); label.textContent = `Line height at day ${Math.round(x)}: ${fmtNum(fitY(f, x))} cm. Average: ${fmtNum(yb)} cm`; };
  const h = pl.handle({ axis: 'x', x: 0, y: 4, min: 0, max: 40, step: 1, label: 'Where x is zero, in days', fmt: v => `day ${v}`, onChange: (v, user) => { draw(v); if (user) ctx.setReady(true); } });
  draw(0); ctx.stage.append(pl.el, label);
  return {
    check() {
      const x = h.get(), ok = Math.abs(x - f.xb) <= 2 + 1e-9; h.lock();
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}The line passes through (average day, average height): day ${Math.round(f.xb)}. Counting days from there makes the intercept the typical height.` };
    },
    solve() { h.set(Math.round(f.xb), true); },
    solveWrong() { h.set(f.xb > 20 ? 2 : 38, true); },
    info: { xs: d.xs, ys: d.ys, xb: f.xb, yb },
  };
}

UNITS[3] = {
  id: 'u3', title: 'Unit 3: Lines and noise',
  intro: 'A model for one typical value, then for a line. Dots, handles, a table to read, and a fan of possible lines.',
  subs: [
    { id: 'u3-mean-tut', name: 'First marker', blurb: 'One typical value.', kind: 'tutorial', build: buildMeanTut, help: 'Drag the flashing marker along the line of dots. That is the only thing you can do here.' },
    { id: 'u3-mean', name: 'Typical and spread', blurb: 'An intercept and a sigma.', kind: 'streak', target: 5, hearts: 2, build: buildMean,
      help: 'Put the left handle where the dots balance. Move the right handle until the shaded band holds about two thirds of the dots; the label counts them for you. The distance between the handles is the spread, called sigma.' },
    { id: 'u3-line-tut', name: 'First line', blurb: 'Tilt a line.', kind: 'tutorial', build: buildLineTut, help: 'Drag the flashing handle up or down. That is the only thing you can do here.' },
    { id: 'u3-fit', name: 'Fit by eye', blurb: 'A line through the dots.', kind: 'streak', target: 5, hearts: 2, build: buildFit,
      help: 'Drag the two handles so the line runs through the middle of the dots. Pressing anywhere on the plot moves the nearer handle. Within about 3 cm at both ends counts as right.' },
    { id: 'u3-noise', name: 'Add the noise', blurb: 'A line is not the data.', kind: 'streak', target: 5, hearts: 2, build: buildNoise,
      help: 'The line only gives the average. To simulate plants, add scatter of size sigma. Slide sigma until the red simulated dots spread as much as the real hollow ones.' },
    { id: 'u3-prior', name: 'Tame the slope', blurb: 'A prior for the slope.', kind: 'streak', target: 5, hearts: 2, build: buildSlopePrior,
      help: 'Each line is one slope the prior allows. Too tight and the prior says there is no slope. Too loose and it allows plants taller than the frame. Slide until nearly all lines stay inside, and no tighter.' },
    { id: 'u3-table', name: 'Read the table', blurb: 'Estimate, interval, sigma.', kind: 'streak', target: 5, hearts: 2, build: buildTable,
      help: 'This is how brms prints a fit: one row per unknown, with its estimate and the lower and upper end of its 95% interval. Tap the cell you are asked for.' },
    { id: 'u3-fuzz', name: 'The fuzz', blurb: 'Where is the line surest?', kind: 'streak', target: 5, hearts: 2, build: buildFuzz,
      help: 'Every faint line is a possible fit. Where they bunch together the model is sure about the height; where they fan out it is not. Drag the marker as asked.' },
    { id: 'u3-centre', name: 'Centre x', blurb: 'Make the intercept mean something.', kind: 'streak', target: 5, hearts: 2, build: buildCentre,
      help: 'Move the marker along the days until the line’s height there matches the dashed average height. That day is where x should count as 0.' },
  ],
};
