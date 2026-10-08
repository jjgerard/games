// Unit 5: contrast coding. Two feeds, A and B. The same two group averages give
// different intercepts and slopes depending on the numbers used to code the
// groups. The picture is the real regression picture: code on the x axis,
// height on the y axis, a line through the two group averages. The intercept
// is where that line is at code 0; the slope is how much it rises per +1 of code.
// Keys are checked against R's lm() with numeric codes and with contrasts.

const CODINGS = [
  { id: 'trt-A', name: 'A = 0, B = 1', cA: 0, cB: 1 },
  { id: 'trt-B', name: 'A = 1, B = 0', cA: 1, cB: 0 },
  { id: 'sum', name: 'A = −1, B = +1', cA: -1, cB: 1 },
  { id: 'half', name: 'A = −0.5, B = +0.5', cA: -0.5, cB: 0.5 },
  { id: 'num', name: 'A = 1, B = 2', cA: 1, cB: 2 },
];
const SUMS = ['trt-A', 'trt-B', 'sum', 'half', 'num'];
const codingOf = id => CODINGS.find(c => c.id === id);
const minus = v => (v < 0 ? '−' + (-v) : String(v));
function coefs(cd, mA, mB) { const slope = (mB - mA) / (cd.cB - cd.cA); return { slope, int: mA - slope * cd.cA }; }
function codeCase(rng, allowed = SUMS) {
  for (let t = 0; t < 4000; t++) {
    const cd = codingOf(BM.pick(rng, allowed)), mA = r1(10 + rng() * 20), gap = (rng() < 0.5 ? -1 : 1) * r1(12 + rng() * 6), mB = r1(mA + gap);
    const { slope, int } = coefs(cd, mA, mB), h1 = int + slope;
    if ([mA, mB, int, h1].some(v => v < 4 || v > 36)) continue;
    return { cd, mA, mB, gap: mB - mA, slope, int, h1 };
  }
  throw new Error('no code case');
}
function codePlot(label) { return Plot({ H: 226, xd: [-1.5, 2.5], yd: [0, 40], xticks: [-1, 0, 1, 2], xfmt: minus, yticks: [0, 10, 20, 30, 40], xTitle: 'code', yTitle: 'cm', grid: true, label }); }
const lblY = (pl, m) => (pl.sy(m) - 14 < pl.T + 12 ? pl.sy(m) + 26 : pl.sy(m) - 14);
const groupDots = (pl, cd, mA, mB) => [S.dot(pl.sx(cd.cA), pl.sy(mA), 8, 'pdot'), S.text(pl.sx(cd.cA), lblY(pl, mA), 'A'), S.dot(pl.sx(cd.cB), pl.sy(mB), 8, 'pdot'), S.text(pl.sx(cd.cB), lblY(pl, mB), 'B')];
const zeroLine = pl => S.line(pl.sx(0), pl.sy(0), pl.sx(0), pl.sy(40), 'pline dash grey');
const codeLabel = (cd, mA, mB) => `Feed A averages ${Math.round(mA)} cm and sits at code ${minus(cd.cA)}. Feed B averages ${Math.round(mB)} cm and sits at code ${minus(cd.cB)}.`;

// ---------------------------------------------------------------------------
// 5.0 tutorial: switch the coding
// ---------------------------------------------------------------------------
function buildSwitchTut(ctx) {
  const mA = 14, mB = 28; let cd = codingOf('trt-A');
  ctx.setPrompt('Each feed has a code on the bottom axis. The ring is where the line crosses code 0. Tap the flashing button to recode the feeds.');
  const pl = codePlot(''); const note = el('div', { class: 'stage-note' });
  const draw = () => { const { slope, int } = coefs(cd, mA, mB); pl.draw([zeroLine(pl), S.line(pl.sx(-1.5), pl.sy(int - 1.5 * slope), pl.sx(2.5), pl.sy(int + 2.5 * slope), 'pline good'), ...groupDots(pl, cd, mA, mB), S.dot(pl.sx(0), pl.sy(int), 8, 'pdot hollow')]); pl.setLabel(`${codeLabel(cd, mA, mB)} The line crosses code 0 at ${Math.round(int)} cm.`); note.textContent = `Coding: ${cd.name}`; };
  draw();
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center' }, 'Switch coding');
  ctx.stage.append(pl.el, note, btn);
  btn.addEventListener('click', () => { cd = codingOf('sum'); draw(); btn.disabled = true; btn.classList.remove('flash'); ctx.complete('The averages did not move but the ring did. The intercept is the line’s height at code 0, so it depends on the coding.'); });
  return { solve: () => btn.click() };
}

// ---------------------------------------------------------------------------
// 5.1 where is the intercept?
// ---------------------------------------------------------------------------
function buildIntercept(ctx) {
  const c = codeCase(ctx.rng);
  ctx.setPrompt('Drag the handle on the dashed code-0 line to where a line through A and B would cross it. That height is the intercept.');
  const pl = codePlot(`${codeLabel(c.cd, c.mA, c.mB)} Coding ${c.cd.name}.`);
  const draw = y => pl.draw([zeroLine(pl), ...groupDots(pl, c.cd, c.mA, c.mB), S.line(pl.sx(-1.5), pl.sy(y), pl.sx(2.5), pl.sy(y), 'pline fine dash')]);
  const h = pl.handle({ axis: 'y', x: 0, y: 20, min: 0, max: 40, step: 0.5, label: 'Intercept, height in cm at code 0', fmt: v => `${v} cm`, onChange: (v, user) => { draw(v); if (user) ctx.setReady(true); } });
  draw(20); ctx.stage.append(pl.el, el('div', { class: 'stage-note' }, `Codes: ${c.cd.name}`));
  return {
    check() {
      const ok = Math.abs(h.get() - c.int) <= 3 + 1e-9; h.lock();
      pl.draw([zeroLine(pl), S.line(pl.sx(-1.5), pl.sy(c.int - 1.5 * c.slope), pl.sx(2.5), pl.sy(c.int + 2.5 * c.slope), 'pline good'), ...groupDots(pl, c.cd, c.mA, c.mB)]);
      const where = { 'trt-A': 'Code 0 is feed A, so the intercept is A’s average.', 'trt-B': 'Code 0 is feed B, so the intercept is B’s average.', sum: 'Code 0 is exactly between the feeds, so the intercept is the average of the two averages.', half: 'Code 0 is exactly between the feeds, so the intercept is the average of the two averages.', num: 'Code 0 is not a feed at all: it lies one step beyond A, so the line has to be extended backwards.' }[c.cd.id];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${where}` };
    },
    solve() { h.set(c.int, true); },
    solveWrong() { h.set(c.int > 20 ? 6 : 34, true); },
    info: { coding: c.cd.id, cA: c.cd.cA, cB: c.cd.cB, mA: c.mA, mB: c.mB, int: c.int, slope: c.slope },
  };
}

// ---------------------------------------------------------------------------
// 5.2 how much does the line rise per +1 of code?
// ---------------------------------------------------------------------------
function buildSlope(ctx) {
  const c = codeCase(ctx.rng);
  ctx.setPrompt('The ring is the intercept. Drag the handle on the code-1 line to where the line would be there. The rise from the ring is the slope.');
  const pl = codePlot(`${codeLabel(c.cd, c.mA, c.mB)} Coding ${c.cd.name}.`);
  const draw = y => pl.draw([zeroLine(pl), S.line(pl.sx(1), pl.sy(0), pl.sx(1), pl.sy(40), 'pline dash grey'), ...groupDots(pl, c.cd, c.mA, c.mB), S.line(pl.sx(0), pl.sy(c.int), pl.sx(1), pl.sy(y), 'pline dash'), S.dot(pl.sx(0), pl.sy(c.int), 8, 'pdot hollow')]);
  const h = pl.handle({ axis: 'y', x: 1, y: c.int, min: 0, max: 40, step: 0.5, label: 'Height of the line at code 1, in cm', fmt: v => `${v} cm`, onChange: (v, user) => { draw(v); if (user) ctx.setReady(true); } });
  draw(c.int); ctx.stage.append(pl.el, el('div', { class: 'stage-note' }, `Codes: ${c.cd.name}`));
  return {
    check() {
      const ok = Math.abs(h.get() - c.h1) <= 0.2 * Math.abs(c.gap) + 1e-9; h.lock();
      pl.draw([zeroLine(pl), S.line(pl.sx(1), pl.sy(0), pl.sx(1), pl.sy(40), 'pline dash grey'), S.line(pl.sx(-1.5), pl.sy(c.int - 1.5 * c.slope), pl.sx(2.5), pl.sy(c.int + 2.5 * c.slope), 'pline good'), ...groupDots(pl, c.cd, c.mA, c.mB), S.dot(pl.sx(0), pl.sy(c.int), 8, 'pdot hollow')]);
      const how = { 'trt-A': 'One step of code is the whole way from A to B: the slope is the full difference, B minus A.', 'trt-B': 'One step of code goes from B down to A, so the slope is A minus B: here its sign is the opposite of B minus A.', sum: 'A and B are two steps of code apart, so one step is half the difference: the slope is half of B minus A.', half: 'A and B are one step of code apart, so the slope is the whole difference, B minus A.', num: 'A and B are one step apart, so the slope is the full difference, B minus A.' }[c.cd.id];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${how}` };
    },
    solve() { h.set(c.h1, true); },
    solveWrong() { h.set(c.cd.id === 'sum' ? Math.min(40, c.int + c.gap) : c.int - c.slope, true); },
    info: { coding: c.cd.id, cA: c.cd.cA, cB: c.cd.cB, mA: c.mA, mB: c.mB, int: c.int, slope: c.slope, h1: c.h1, gap: c.gap },
  };
}

// ---------------------------------------------------------------------------
// 5.3 which coding was used?
// ---------------------------------------------------------------------------
function buildNameCoding(ctx) {
  const rng = ctx.rng, c = codeCase(rng, ['trt-A', 'trt-B', 'sum', 'half']);
  ctx.setPrompt('A model gave this intercept (dashed line) and slope (arrow: the rise per +1 of code). Which coding gives both?');
  const pl = Plot({ H: 190, xd: [0, 4.4], yd: [0, 40], xticks: [], yticks: [0, 10, 20, 30, 40], yTitle: 'cm', grid: true, label: `Feed A averages ${Math.round(c.mA)} cm and feed B ${Math.round(c.mB)} cm. The reported intercept is ${Math.round(c.int)} cm and the slope is ${fmtNum(c.slope)} cm.` });
  const ax = pl.sx(3.7), y0 = pl.sy(c.int), y1 = pl.sy(c.int + c.slope), dir = y1 < y0 ? 1 : -1;
  pl.draw([S.line(pl.sx(0.2), y0, pl.sx(4.2), y0, 'pline good dash'), S.dot(pl.sx(1.3), pl.sy(c.mA), 8, 'pdot'), S.text(pl.sx(1.3), pl.sy(c.mA) - 14, 'A'), S.dot(pl.sx(2.5), pl.sy(c.mB), 8, 'pdot'), S.text(pl.sx(2.5), pl.sy(c.mB) - 14, 'B'),
    S.line(ax, y0, ax, y1 + dir * 6, 'pline good'), `<path d="M${ax - 8} ${y1 + dir * 12} L${ax} ${y1} L${ax + 8} ${y1 + dir * 12} Z" class="pfill good"/>`]);
  const opts = CODINGS.filter(k => k.id !== 'num');
  let chosen = null; const pick = PickButtons(opts.map(o => ({ aria: o.name, html: `A = ${minus(o.cA)}<br>B = ${o.cB > 0 && o.cA < 0 ? '+' : ''}${minus(o.cB)}` })), i => { chosen = i; ctx.setReady(true); }, 'two');
  pick.btns.forEach(b => b.classList.add('two-line'));
  ctx.stage.append(pl.el, pick.el);
  const answer = opts.findIndex(o => o.id === c.cd.id);
  return {
    check() {
      const ok = chosen === answer; pick.reveal(answer, chosen);
      const why = { 'trt-A': 'The intercept sits at A’s average and the arrow spans the whole gap: A is code 0.', 'trt-B': 'The intercept sits at B’s average and the arrow points from B to A: B is code 0.', sum: 'The intercept is midway and the arrow is half the gap: the codes are 2 apart.', half: 'The intercept is midway and the arrow is the whole gap: the codes are 1 apart.' }[c.cd.id];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${why}` };
    },
    solve() { pick.btns[answer].click(); },
    solveWrong() { pick.btns[(answer + 1) % 4].click(); },
    info: { coding: c.cd.id, mA: c.mA, mB: c.mB, int: c.int, slope: c.slope },
  };
}

// ---------------------------------------------------------------------------
// 5.4 a prior for the slope depends on the coding
// ---------------------------------------------------------------------------
function buildCodePrior(ctx) {
  const rng = ctx.rng, cd = codingOf(BM.pick(rng, ['trt-A', 'sum', 'half'])), D = BM.pick(rng, [10, 20, 30]), c = Math.abs(1 / (cd.cB - cd.cA)), target = c * D;
  ctx.setPrompt('How big a slope could this coding give? Slide the spread until the shaded middle 95% just reaches that slope.');
  const XD = [-1.5 * D, 1.5 * D], pl = Strip({ xd: XD, ticks: [-D, 0, D], H: 150, xfmt: minus, label: '' });
  const cur = el('div', { class: 'livelabel' });
  const draw = s => {
    const pts = [], n = 120, yTop = pl.sy(1), yBase = pl.sy(0); let d = '';
    for (let i = 0; i <= n; i++) { const x = XD[0] + (XD[1] - XD[0]) * i / n, y = Math.exp(-0.5 * (x / s) ** 2); d += `${i ? 'L' : 'M'}${pl.sx(x).toFixed(1)} ${(yBase - y * (yBase - yTop - 4)).toFixed(1)} `; pts.push([x, y]); }
    const lo = Math.max(XD[0], -1.96 * s), hi = Math.min(XD[1], 1.96 * s); let sh = `M${pl.sx(lo)} ${yBase} `;
    for (let i = 0; i <= 60; i++) { const x = lo + (hi - lo) * i / 60; sh += `L${pl.sx(x).toFixed(1)} ${(yBase - Math.exp(-0.5 * (x / s) ** 2) * (yBase - yTop - 4)).toFixed(1)} `; }
    pl.draw([S.path(sh + `L${pl.sx(hi)} ${yBase} Z`, 'pband good'), S.path(d, 'cv-line')]);
    cur.textContent = `Prior spread: ${fmtNum(s)} cm per code step`;
  };
  const slider = AxisSlider({ values: [0.1], labels: ['Prior spread of the slope'], step: 0.02, onChange: v => { draw(Math.max(0.3, v[0] * D)); ctx.setReady(slider.touched()); } });
  pl.setLabel('Shape of the prior for the slope, a bell curve centred on zero, with its middle 95 percent shaded');
  const legend = el('div', { class: 'stage-note' }, `Feeds differ by at most ${D} cm.`, el('br'), `Codes: ${cd.name}`);
  draw(0.1 * D); ctx.stage.append(legend, pl.el, cur, slider.el);
  const lo = target / BM.normQuantile(0.995), hi = target / BM.normQuantile(0.95), mass = s => 2 * BM.normCdf(target / s) - 1;
  return {
    check() {
      const s = Math.max(0.3, slider.get()[0] * D), ok = s >= lo - 1e-9 && s <= hi + 1e-9; slider.lock();
      const why = ok ? '' : s < lo ? ' Too tight.' : ' Too loose.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}The biggest slope here is ${fmtNum(target)} cm, so a spread of about ${fmtNum(lo)} to ${fmtNum(hi)} fits.${ok ? ' Another coding needs another prior.' : ''}` };
    },
    solve() { slider.set(0, (lo + hi) / 2 / D, true); },
    solveWrong() { slider.set(0, cd.id === 'sum' ? 0.8 : 0.1, true); },
    info: { coding: cd.id, D, c, target, lo, hi, mass },
  };
}

UNITS[5] = {
  id: 'u5', title: 'Unit 5: Coding groups',
  intro: 'The same two group averages give different intercepts and slopes under different codings. Read them off the line.',
  subs: [
    { id: 'u5-switch-tut', name: 'Switch the coding', blurb: 'The dot moves, the averages do not.', kind: 'tutorial', build: buildSwitchTut, help: 'Tap the flashing button. That is the only thing you can do here.' },
    { id: 'u5-intercept', name: 'Find the intercept', blurb: 'The height at code 0.', kind: 'streak', target: 5, hearts: 2, build: buildIntercept,
      help: 'The intercept is the line’s height at code 0 (the dashed vertical line). Work out where code 0 sits among the feeds, then drag the dot to that height. Within 3 cm counts as right.' },
    { id: 'u5-slope', name: 'Find the slope', blurb: 'The rise per step of code.', kind: 'streak', target: 5, hearts: 2, build: buildSlope,
      help: 'The slope is how much the line rises when the code goes up by 1. Drag the handle at code 1 to the line’s height there; the dashed segment from the dot shows the slope.' },
    { id: 'u5-name', name: 'Which coding?', blurb: 'Read it from the picture.', kind: 'streak', target: 5, hearts: 2, build: buildNameCoding,
      help: 'Look at where the dashed intercept line sits relative to A and B, and how long the slope arrow is compared with the gap between A and B. Tap the coding that explains both.' },
    { id: 'u5-prior', name: 'Prior for a slope', blurb: 'Depends on the coding.', kind: 'streak', target: 5, hearts: 2, build: buildCodePrior,
      help: 'Work out the biggest slope this coding could give for the stated gap between feeds (the slope is not always the whole gap). Slide until the shaded middle 95% of the prior just reaches it, no further.' },
  ],
};
