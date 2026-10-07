// Unit 1: prior, likelihood, posterior. Built from what Unit 0 taught (shares,
// kinds of bag, spreading chips of belief). Still nothing to calculate: every
// answer is something you move, count or tap, judged against a tolerance, and
// the names (prior, likelihood, posterior) arrive only AFTER you have built
// each piece, in the explanation, the way the Mystery Level in Shapes works.

const U1_PS = [0.2, 0.4, 0.6, 0.8];
const sumOf = a => a.reduce((x, y) => x + y, 0);
const l1 = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);

// Five bags on a shelf, spread over the four kinds: at least two kinds, and
// one kind that is clearly commoner.
function randomShelf(rng, kinds = 4, total = 5) {
  for (;;) {
    const c = Array(kinds).fill(0);
    for (let i = 0; i < total; i++) c[BM.int(rng, 0, kinds - 1)]++;
    if (c.filter(x => x > 0).length >= 2 && Math.max(...c) >= 2 && Math.max(...c) <= 3) return c;
  }
}
const kindsFor = (seedBase = 40) => U1_PS.map((p, i) => ({ p, seed: seedBase + i }));
const drawsFrom = (rng, p, n) => Array.from({ length: n }, () => BM.drawShape(rng, p));

// ---------------------------------------------------------------------------
// 1.1 Before any draw: your belief should follow how common each kind is
// ---------------------------------------------------------------------------
function buildPrior(ctx) {
  const rng = ctx.rng, counts = randomShelf(rng), expected = counts.map(c => c / 5 * 10);
  ctx.setPrompt('One bag is picked from the shelf, unseen. Bet your <b>10 chips</b> on its kind.');
  const panel = BagChips({ kinds: kindsFor(), total: 10, onChange: c => ctx.setReady(sumOf(c) === 10) });
  ctx.stage.append(ShelfStrip(counts, U1_PS), panel.el, panel.status);
  return {
    check() {
      const dev = l1(panel.chips, expected), ok = dev <= 2 + 1e-9; panel.lock(expected);
      const top = U1_PS[counts.indexOf(Math.max(...counts))];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}Belief should follow the shelf: the ${pct(top)}% kind fills ${Math.max(...counts)} of 5 bags, so it gets ${Math.max(...expected)} of 10 chips. That is the prior.` };
    },
    solve() { panel.set(expected); },
    solveWrong() { const w = counts.indexOf(Math.min(...counts)); panel.set(counts.map((_, i) => i === w ? 10 : 0)); },
    info: { expected, counts },
  };
}

// ---------------------------------------------------------------------------
// 1.2 How well does each kind explain the shape that was drawn?
// ---------------------------------------------------------------------------
function buildLikelihood(ctx) {
  const rng = ctx.rng, shape = BM.pick(rng, ['c', 's']);
  const expected = U1_PS.map(p => shape === 'c' ? BM.circlesPerTen(p) : 10 - BM.circlesPerTen(p));
  ctx.setPrompt(`Drawn: <b>${iconWord(shape)}</b>. Out of 10 draws from each bag, how many show it?`);
  const panel = BagChips({ kinds: kindsFor(), total: null, perMax: 10, noun: 'draw', onChange: c => ctx.setReady(c.every(x => x >= 1)) });
  ctx.stage.append(panel.el, panel.status);
  return {
    check() {
      const dev = l1(panel.chips, expected), ok = dev <= 2 + 1e-9 && panel.chips.every((c, i) => Math.abs(c - expected[i]) <= 1);
      panel.lock(expected);
      const best = U1_PS[expected.indexOf(Math.max(...expected))], worst = U1_PS[expected.indexOf(Math.min(...expected))];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}The ${shape === 'c' ? 'circle' : 'square'} turns up in ${Math.max(...expected)} of 10 draws from the ${pct(best)}% bag, but only ${Math.min(...expected)} of 10 from the ${pct(worst)}% bag. How well each kind explains what you saw is called the likelihood.` };
    },
    solve() { panel.set(expected); },
    solveWrong() { panel.set(expected.map(e => 10 - e)); },
  };
}

// ---------------------------------------------------------------------------
// 1.3 Put them together: the shelf AND the draw
// ---------------------------------------------------------------------------
function buildProduct(ctx) {
  const rng = ctx.rng, counts = randomShelf(rng), n = BM.int(rng, 1, 2);
  let draws, pieces;
  for (let t = 0; t < 300; t++) {
    const trueKind = U1_PS[BM.pick(rng, counts.flatMap((c, i) => Array(c).fill(i)))];
    draws = drawsFrom(rng, trueKind, n); pieces = BM.threePieces(U1_PS, counts, draws);
    // Following only the shelf, or only the draw, must clearly miss the answer:
    // at least 4 chips of 10 away from the right belief either way.
    const likShare = pieces.lik.map(x => x / sumOf(pieces.lik));
    if (l1(pieces.prior, pieces.post) >= 0.4 && l1(likShare, pieces.post) >= 0.4) break;
  }
  const expected = pieces.post.map(x => x * 10);
  ctx.setPrompt(`A bag from the shelf gave <b>${draws.map(d => iconWord(d)).join(' ')}</b>. Bet your <b>10 chips</b> on its kind.`);
  const panel = BagChips({ kinds: kindsFor(), total: 10, onChange: c => ctx.setReady(sumOf(c) === 10) });
  ctx.stage.append(ShelfStrip(counts, U1_PS), panel.el, panel.status);
  return {
    check() {
      const dev = l1(panel.chips, expected), ok = dev <= 3 + 1e-9; panel.lock(expected);
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}Belief now depends on BOTH: how common each kind is on the shelf, and how well it explains the draw. A common kind that explains the draw badly, or a rare kind that explains it well, can each lose out.` };
    },
    reveal() {
      const cap = (t) => t;
      const rows = el('div', { class: 'trail' },
        BarsRow(pieces.prior, { cls: '', height: 30, caption: 'Prior: the shelf' }),
        BarsRow(pieces.lik, { cls: 'lik', height: 30, caption: 'Likelihood: fits the draw' }),
        BarsRow(pieces.post, { cls: 'post', height: 30, caption: 'Posterior: both together' }),
        el('div', { class: 'barsline' }, el('span', { class: 'bcap' }), el('div', { class: 'barsrow', style: 'border:0;height:auto' }, U1_PS.map(p => el('div', { class: 'bcol stage-note', style: 'justify-content:center' }, pct(p) + '%')))));
      panel.el.replaceWith(rows); panel.status.remove();
    },
    solve() { panel.set(expected.map(Math.round).map((c, i, a) => (i === a.indexOf(Math.max(...a)) ? c + (10 - sumOf(a)) : c))); },
    solveWrong() { const w = pieces.post.indexOf(Math.min(...pieces.post)); panel.set(pieces.post.map((_, i) => i === w ? 10 : 0)); },
    info: { expected, prior: pieces.prior.map(x => x * 10), lik: (() => { const t = sumOf(pieces.lik); return pieces.lik.map(x => x / t * 10); })() },
  };
}

// ---------------------------------------------------------------------------
// 1.4 Which is which? Name the three rows
// ---------------------------------------------------------------------------
const TERMS = {
  prior: 'the <b>prior</b>: what you believed before anything was drawn',
  lik: 'the <b>likelihood</b>: how well each kind explains the shape drawn',
  post: 'the <b>posterior</b>: what you believe after the draw',
};
function buildNames(ctx) {
  const rng = ctx.rng, n = BM.int(rng, 1, 2);
  let counts, draws, pieces;
  for (let t = 0; t < 200; t++) {
    counts = randomShelf(rng); draws = drawsFrom(rng, BM.pick(rng, U1_PS), n); pieces = BM.threePieces(U1_PS, counts, draws);
    const norm = v => { const m = Math.max(...v); return v.map(x => x / m); };
    const [a, b, c] = [norm(pieces.prior), norm(pieces.lik), norm(pieces.post)];
    if (Math.min(l1(a, b), l1(a, c), l1(b, c)) >= 0.5) break;
  }
  const rows = BM.shuffle(rng, [{ key: 'prior', v: pieces.prior }, { key: 'lik', v: pieces.lik }, { key: 'post', v: pieces.post }]);
  const ask = BM.pick(rng, ['prior', 'lik', 'post']);
  ctx.setPrompt(`Which row is ${TERMS[ask]}? Tap it.`);
  const tray = Tray(); draws.forEach(d => tray.add(d));
  const kinds = el('div', { class: 'barsline' }, el('span', { class: 'rownum', style: 'visibility:hidden' }),
    el('div', { class: 'barsrow', style: 'border:0;height:auto' }, U1_PS.map((p, i) => el('div', { class: 'bcol', style: 'justify-content:center;align-items:flex-start' }, KindLabel(p, counts[i])))));
  let chosen = null; const btns = [];
  const rowEls = rows.map((r, i) => {
    const b = el('button', { class: 'rowpick', 'aria-label': `Row ${i + 1}`, onclick: () => { chosen = i; btns.forEach((x, j) => x.classList.toggle('on', j === i)); ctx.setReady(true); } },
      el('div', { class: 'barsline' }, el('span', { class: 'rownum' }, i + 1), BarsRow(r.v, { height: 30 })));
    btns.push(b); return b;
  });
  ctx.stage.append(el('div', { class: 'bigshape' }, 'Drawn:', tray.el), kinds, ...rowEls);
  const answer = rows.findIndex(r => r.key === ask);
  const NAMES = { prior: 'Prior', lik: 'Likelihood', post: 'Posterior' };
  return {
    check() {
      const ok = chosen === answer;
      btns.forEach((b, i) => { b.disabled = true; b.classList.remove('on'); if (i === answer) b.classList.add('right'); else if (i === chosen) b.classList.add('bad'); b.querySelector('.rownum').textContent = NAMES[rows[i].key]; b.querySelector('.rownum').style.cssText = 'width:auto;height:auto;border-radius:6px;padding:2px 5px;flex:0 0 auto;font-size:.65rem'; });
      const how = { prior: 'It matches the shelf: the commoner the kind, the taller the bar.', lik: 'It is tallest for the kind that best explains the shape drawn, whatever is on the shelf.', post: 'It combines the two: the shelf and the draw together.' }[ask];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${how}` };
    },
    solve() { btns[answer].click(); },
    solveWrong() { btns[(answer + 1) % 3].click(); },
  };
}

// ---------------------------------------------------------------------------
// 1.5 Imagine shapes: a belief as a curve built from imaginary draws
// ---------------------------------------------------------------------------
// The flat curve is "no idea", which counts as one imagined circle and one
// imagined square. Each imagined shape you add tilts and sharpens the curve.
function ImagineKit(ctx, { allowSquare = true, target = null, flashCircle = false }) {
  let a = 1, b = 1;
  const cv = CurveView({ a, b }); if (target) cv.update({ target });
  const tray = Tray(); tray.el.classList.add('wrap');
  const MAXN = 12;
  const redraw = () => {
    tray.clear(); for (let i = 0; i < a; i++) tray.add('c', { size: 20, cls: 'imag' }); for (let i = 0; i < b; i++) tray.add('s', { size: 20, cls: 'imag' });
    cv.update({ a, b }); count.textContent = `${a} imagined circle${a === 1 ? '' : 's'} and ${b} imagined square${b === 1 ? '' : 's'}`; onChange();
  };
  const count = el('div', { class: 'stage-note' });
  let onChange = () => {};
  const addC = el('button', { class: 'bigbtn circ' + (flashCircle ? ' flash small' : ''), onclick: () => { if (a + b < MAXN) { a++; addC.classList.remove('flash'); redraw(); } } }, '+ circle');
  const addS = el('button', { class: 'bigbtn sq', onclick: () => { if (a + b < MAXN) { b++; redraw(); } } }, '+ square');
  const reset = el('button', { class: 'bigbtn alt', onclick: () => { a = 1; b = 1; redraw(); } }, 'Start again');
  const row = el('div', { class: 'btnrow' }, addC, ...(allowSquare ? [addS, reset] : []));
  ctx.stage.append(cv.el, tray.el, count, row);
  redraw();
  return { cv, get a() { return a; }, get b() { return b; }, set(x, y) { a = x; b = y; redraw(); }, onChange(f) { onChange = f; }, addC, redraw };
}

function buildImagineTut(ctx) {
  ctx.setPrompt('A flat curve means no idea: it counts as one imagined circle and one imagined square. Imagine one more circle: tap the flashing button.');
  const kit = ImagineKit(ctx, { allowSquare: false, flashCircle: true });
  kit.onChange(() => { if (kit.a > 1) ctx.complete('One imagined circle tilted the belief toward circles.'); });
  return { solve: () => kit.addC.click() };
}

function buildImagine(ctx) {
  const rng = ctx.rng; let ta, tb;
  do { ta = BM.int(rng, 1, 9); tb = BM.int(rng, 1, 9); } while (ta + tb < 4 || ta + tb > 12 || Math.abs(BM.betaMean(ta, tb) - 0.5) < 0.12);
  ctx.setPrompt('Match the <b>dashed</b> curve. Build your belief out of imagined shapes: each one is a draw you only imagined.');
  const kit = ImagineKit(ctx, { target: [ta, tb] });
  kit.onChange(() => ctx.setReady(kit.a + kit.b > 2));
  return {
    check() {
      const dm = Math.abs(BM.betaMean(kit.a, kit.b) - BM.betaMean(ta, tb)), ds = Math.abs(kit.a + kit.b - (ta + tb)), ok = dm <= 0.06 && ds <= 2;
      let why = '';
      if (!ok) why = dm > 0.06 ? ' Your curve leans the wrong amount: more circles pull it right, more squares pull it left.' : ' Your curve is the wrong width: more imagined shapes make it narrower, because you are surer.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}The target was ${ta} imagined circles and ${tb} imagined squares. The more shapes you imagine, the narrower the curve: a surer belief.` };
    },
    solve() { kit.set(ta, tb); },
    solveWrong() { kit.set(tb, ta); },
    info: { ta, tb },
  };
}

// ---------------------------------------------------------------------------
// 1.6 Real draws join the imagined ones
// ---------------------------------------------------------------------------
function buildShift(ctx) {
  const rng = ctx.rng;
  const a0 = BM.int(rng, 1, 8), b0 = BM.int(rng, 1, 8), n = BM.int(rng, 3, 9);
  const trueP = BM.pick(rng, [0.2, 0.3, 0.7, 0.8]);
  let k = 0, tries = 0; do { k = drawsFrom(rng, trueP, n).filter(d => d === 'c').length; tries++; } while (tries < 200 && (Math.abs((a0 + k) / (a0 + b0 + n) - a0 / (a0 + b0)) < 0.08 || Math.abs((a0 + k) / (a0 + b0 + n) - 0.5) < 0.12 || Math.abs(k / n - (a0 + k) / (a0 + b0 + n)) < 0.08));
  const a1 = a0 + k, b1 = b0 + (n - k), mean = BM.betaMean(a1, b1);
  ctx.setPrompt('You started with the faint imagined shapes, then really drew the bright ones. Drag the marker to where your belief will average out now.');
  const cv = CurveView({ a: a0, b: b0 });
  const tray = Tray(); tray.el.classList.add('wrap');
  for (let i = 0; i < a0; i++) tray.add('c', { size: 20, cls: 'imag' }); for (let i = 0; i < b0; i++) tray.add('s', { size: 20, cls: 'imag' });
  for (let i = 0; i < k; i++) tray.add('c', { size: 20 }); for (let i = 0; i < n - k; i++) tray.add('s', { size: 20 });
  const slider = AxisSlider({ values: [0.5], labels: ['Where the belief averages out'], onChange: () => ctx.setReady(slider.touched()) });
  ctx.stage.append(cv.el, slider.el, tray.el);
  return {
    check() {
      const m = slider.get()[0], ok = Math.abs(m - mean) <= 0.06 + 1e-9;
      slider.lock(); slider.mark(mean); cv.update({ a: a1, b: b1, ghost: [a0, b0], markers: [{ x: mean, cls: 'truth' }] });
      const strong = (a0 + b0) >= 2 * n ? 'Your imagined shapes outnumber the real ones, so belief barely moved.' : n >= 2 * (a0 + b0) ? 'The real draws outnumber the imagined ones, so the data wins.' : 'Imagined and real shapes count the same, so belief ends up between them.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}Just pool them: ${a1} circles and ${b1} squares in all, so about ${pct(mean)}% circles. ${strong}` };
    },
    solve() { slider.set(0, mean, true); },
    solveWrong() { slider.set(0, mean > 0.5 ? 0.15 : 0.85, true); },
    info: { mean, priorMean: BM.betaMean(a0, b0), realShare: k / n },
  };
}

// ---------------------------------------------------------------------------
// 1.7 Bracket the middle 90% of a belief (a credible interval)
// ---------------------------------------------------------------------------
function buildInterval(ctx) {
  const rng = ctx.rng; let a, b;
  do { a = BM.int(rng, 3, 15); b = BM.int(rng, 3, 15); } while (a + b < 10 || a + b > 24 || Math.abs(BM.betaMean(a, b) - 0.5) > 0.25);
  const [elo, ehi] = BM.betaInterval(a, b, 0.9), ew = ehi - elo;
  ctx.setPrompt('Bracket the middle <b>90%</b> of this belief: the range where the true share most likely is. Drag both handles until the label says about 90%, as narrow as you can.');
  const cv = CurveView({ a, b });
  const label = el('div', { class: 'livelabel' });
  const upd = () => { const [lo, hi] = slider.get(), m = BM.betaMassBetween(lo, hi, a, b); cv.update({ shade: [lo, hi] }); label.textContent = `Your bracket covers ${pct(m)}% of the belief`; ctx.setReady(slider.touched()); };
  const slider = AxisSlider({ values: [0.1, 0.9], labels: ['Lower end', 'Upper end'], onChange: upd });
  ctx.stage.append(cv.el, slider.el, label); upd();
  return {
    check() {
      const [lo, hi] = slider.get(), m = BM.betaMassBetween(lo, hi, a, b), w = hi - lo;
      const covOk = m >= 0.85 && m <= 0.95, narrowOk = w <= ew * 1.2 + 0.02, ok = covOk && narrowOk;
      slider.lock(); slider.mark(elo); slider.mark(ehi); cv.update({ markers: [{ x: elo, cls: 'truth' }, { x: ehi, cls: 'truth' }] });
      const why = !covOk ? (m < 0.85 ? ' Your bracket is too narrow: it leaves out too much of the belief.' : ' Your bracket covers more than it needs to.') : !narrowOk ? ' That covers about 90%, but a narrower bracket would do it.' : '';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}The middle 90% runs from about ${pct(elo)}% to ${pct(ehi)}% circles. A range like this, holding 90% of your belief, is called a credible interval.` };
    },
    solve() { slider.set(0, Math.round(elo * 100) / 100, true); slider.set(1, Math.round(ehi * 100) / 100, true); },
    solveWrong() { slider.set(0, 0.02, true); slider.set(1, 0.98, true); },
  };
}

UNITS[1] = {
  id: 'u1', title: 'Unit 1: Prior, likelihood, posterior',
  intro: 'The three pieces of every Bayesian update. You will build each one yourself before it gets a name.',
  subs: [
    { id: 'u1-prior', name: 'Before the draw', blurb: 'Belief follows the shelf.', kind: 'streak', target: 5, hearts: 2, build: buildPrior,
      help: 'There are four kinds of bag, shown by how many circles they hold. The small bags under each kind show how many of the five bags on the shelf are that kind. You pick one at random, without looking inside. Use + and − to bet your 10 chips on which kind it is: the more of the shelf a kind fills, the more chips it should get. For example, a kind that is 2 of the 5 bags should get 4 of the 10 chips.' },
    { id: 'u1-lik', name: 'What fits the draw?', blurb: 'How well each bag explains it.', kind: 'streak', target: 5, hearts: 2, build: buildLikelihood,
      help: 'For each kind of bag, build a stack showing how many of 10 draws from that bag would show the shape. Count the matching shapes in the picture.' },
    { id: 'u1-product', name: 'Put them together', blurb: 'The shelf and the draw.', kind: 'streak', target: 5, hearts: 2, build: buildProduct,
      help: 'You picked a bag from the shelf and drew the shape(s) shown. Bet your 10 chips on which kind of bag it is. Think about both how common each kind is on the shelf and how well it explains what you drew.' },
    { id: 'u1-names', name: 'Which is which?', blurb: 'Name the three rows.', kind: 'streak', target: 5, hearts: 2, build: buildNames,
      help: 'Three rows of bars: one is what you believed before, one is how well each kind explains the draw, one is what you believe after. Tap the row you are asked for.' },
    { id: 'u1-imagine-tut', name: 'First imagined shape', blurb: 'Tilt a flat belief.', kind: 'tutorial', build: buildImagineTut,
      help: 'Tap the flashing button. That is the only thing you can do here.' },
    { id: 'u1-imagine', name: 'Imagined draws', blurb: 'Build a belief as a curve.', kind: 'streak', target: 5, hearts: 2, build: buildImagine,
      help: 'Tap + circle and + square to add imagined shapes until your curve matches the dashed one. Each imagined shape tilts the curve, and more shapes make it narrower.' },
    { id: 'u1-shift', name: 'Real draws join in', blurb: 'Where does belief move to?', kind: 'streak', target: 5, hearts: 2, build: buildShift,
      help: 'Imagined and real shapes simply pool together. Drag the marker to the share of circles among all of them.' },
    { id: 'u1-interval', name: 'Bracket the belief', blurb: 'The middle 90%.', kind: 'streak', target: 5, hearts: 2, build: buildInterval,
      help: 'Drag the two handles so the shaded part holds about 90% of the belief, as narrow as you can make it. The label shows how much you cover.' },
  ],
};
