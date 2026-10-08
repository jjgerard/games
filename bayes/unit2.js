// Unit 2: grid approximation, samples from a posterior, simulating data
// (prior and posterior predictive) and why MCMC exists. Same bag-of-shapes
// world as Units 0-1. Still nothing to calculate: bars you read, piles you
// count, brackets you drag. Every answer key is checked against R
// (tools/check-keys.js + check-keys.R).

const GRID = Array.from({ length: 11 }, (_, i) => i / 10); // candidate shares 0, 0.1, ... 1
const betaAt = (x, a, b) => BM.betaPdf(clamp(x, 1e-4, 1 - 1e-4), a, b);
const argmax = v => v.reduce((bi, x, i) => (x > v[bi] ? i : bi), 0);
const countIcons = (k, n, size = 20) => { const t = Tray(); t.el.classList.add('wrap'); for (let i = 0; i < k; i++) t.add('c', { size }); for (let i = 0; i < n - k; i++) t.add('s', { size }); return t; };

// ---------------------------------------------------------------------------
// 2.0 tutorial: a smooth curve becomes bars
// ---------------------------------------------------------------------------
function buildChop(ctx) {
  const a = 5, b = 3, curve = x => betaAt(x, a, b);
  ctx.setPrompt('A belief can be a smooth curve, or bars with one bar per candidate share. Tap the flashing button to chop it into more bars.');
  const mk = m => BarStrip({ m, values: Array.from({ length: m }, (_, i) => betaAt(i / (m - 1), a, b)), curve, H: 150, ticks: true, label: `Belief about the share of circles, chopped into ${m} bars that follow a smooth curve` });
  let strip = mk(5);
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center' }, 'Chop finer');
  const note = el('div', { class: 'stage-note' }, '5 bars');
  ctx.stage.append(strip.el, note, btn);
  btn.addEventListener('click', () => {
    btn.disabled = true; btn.classList.remove('flash'); const s2 = mk(21); strip.el.replaceWith(s2.el); strip = s2; note.textContent = '21 bars';
    ctx.complete('21 bars follow the curve closely. Bars on a row of candidate values are called a grid approximation.');
  });
  return { solve: () => btn.click() };
}

// ---------------------------------------------------------------------------
// 2.1 which bar of the posterior is tallest?
// ---------------------------------------------------------------------------
function peakCase(rng) {
  for (let t = 0; t < 2000; t++) {
    const a0 = BM.int(rng, 2, 8), b0 = BM.int(rng, 2, 8), n = BM.int(rng, 4, 12), k = BM.int(rng, 0, n);
    const prior = GRID.map(p => betaAt(p, a0, b0)), lik = GRID.map(p => BM.binomPmf(k, n, p));
    const post = prior.map((x, i) => x * lik[i]), tot = sumOf(post), pn = post.map(x => x / tot);
    const ip = argmax(post), i0 = argmax(prior), il = argmax(lik);
    const sorted = pn.slice().sort((x, y) => y - x);
    if (sorted[0] < 1.15 * sorted[1]) continue;                 // a clear winner
    if (Math.abs(i0 - il) < 4 || Math.abs(ip - i0) < 1 || Math.abs(ip - il) < 1) continue; // prior and data disagree, and the winner is neither
    if (Math.abs(ip - (i0 + il) / 2) < 1) continue;            // not just halfway between them
    return { a0, b0, n, k, prior, lik, post: pn, ip, i0, il };
  }
  throw new Error('no peak case');
}
function buildPeak(ctx) {
  const c = peakCase(ctx.rng);
  ctx.setPrompt('After the draws above, posterior = prior × likelihood, bar by bar. Drag the marker to the tallest posterior bar.');
  const seen = countIcons(c.k, c.n, 20); seen.el.setAttribute('role', 'img'); seen.el.setAttribute('aria-label', `The draws: ${c.k} circle${c.k === 1 ? '' : 's'} in ${c.n}`);
  const pr = BarStrip({ values: c.prior, H: 42, label: `Prior bars over shares 0 to 100 percent, tallest at ${c.i0 * 10} percent` });
  const lk = BarStrip({ values: c.lik, H: 42, cls: 'lik', label: `Likelihood bars, tallest at ${c.il * 10} percent` });
  const po = BarStrip({ values: GRID.map(() => 0), H: 42, cls: 'post', ticks: true, mark: 0.5, label: 'Posterior bars, hidden until you check' });
  const slider = AxisSlider({ values: [0.5], labels: ['Tallest posterior bar, share of circles'], step: 0.1, onChange: v => { po.set(po.values, { mark: v[0] }); ctx.setReady(slider.touched()); } });
  ctx.stage.append(seen.el, Cap('Prior'), pr.el, Cap('Likelihood'), lk.el, Cap('Posterior: where is it tallest?'), po.el, slider.el);
  return {
    check() {
      const v = slider.get()[0], ok = Math.abs(v - c.ip / 10) <= 0.06 + 1e-9; slider.lock();
      po.set(c.post, { hi: c.ip, mark: c.ip / 10 });
      const why = ok ? '' : Math.abs(v - c.i0 / 10) < 0.06 ? ' That is just the prior’s peak.' : Math.abs(v - c.il / 10) < 0.06 ? ' That is just the likelihood’s peak.' : '';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}It is tallest at ${c.ip * 10}%: multiply each pair of bars, then rescale. Neither peak wins alone.` };
    },
    solve() { slider.set(0, c.ip / 10, true); },
    solveWrong() { slider.set(0, c.ip >= 5 ? 0.1 : 0.9, true); },
    info: c,
  };
}

// ---------------------------------------------------------------------------
// 2.2 tutorial: draw samples, the pile takes the curve's shape
// ---------------------------------------------------------------------------
function buildSampleTut(ctx) {
  const a = 8, b = 4, m = 21;
  ctx.setPrompt('Samples are random picks from the bars: taller bars are picked more often. Tap the flashing button to take 150 samples.');
  const bars = BarStrip({ m, values: Array.from({ length: m }, (_, i) => betaAt(i / (m - 1), a, b)), H: 96, label: 'Posterior bars: the share of circles is probably between 45 and 85 percent' });
  const pile = Pile({ bins: 21, samples: [], H: 96, label: 'Pile of samples, empty so far' });
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center' }, 'Take 150 samples');
  ctx.stage.append(Cap('Belief as bars'), bars.el, Cap('Samples picked from it'), pile.el, btn);
  btn.addEventListener('click', () => {
    btn.disabled = true; btn.classList.remove('flash'); const draw = BM.betaSampler(a, b), sm = Array.from({ length: 150 }, () => draw(ctx.rng));
    pile.set(sm); pile.el.setAttribute('aria-label', 'Pile of 150 samples, the same shape as the bars: most between 50 and 85 percent');
    ctx.complete('The pile has the same shape as the bars. Any question about the belief can now be answered by counting samples.');
  });
  return { solve: () => btn.click() };
}

// ---------------------------------------------------------------------------
// 2.3 count the samples on one side of a line
// ---------------------------------------------------------------------------
function countCase(rng) {
  for (let t = 0; t < 2000; t++) {
    const a = BM.int(rng, 3, 14), b = BM.int(rng, 3, 14), cut = BM.pick(rng, [0.3, 0.4, 0.5, 0.6, 0.7]);
    if (Math.abs(BM.betaMean(a, b) - 0.5) > 0.2) continue;
    const left = BM.betaCdf(cut, a, b);
    if (Math.abs(left - 0.5) < 0.17 || left < 0.12 || left > 0.88) continue;
    return { a, b, cut, left };
  }
  throw new Error('no count case');
}
function buildCount(ctx) {
  const c = countCase(ctx.rng), draw = BM.betaSampler(c.a, c.b), sm = Array.from({ length: 300 }, () => draw(ctx.rng));
  ctx.setPrompt('The pile is 300 samples. What share of them is left of the black line? Slide the divider to that share.');
  const pile = Pile({ bins: 25, samples: sm, cut: c.cut, H: 132, label: `Pile of 300 samples, split by a line at ${pct(c.cut)} percent` });
  const bar = ShareBar({ value: 0.5, leftClass: 'bar-acc', rightClass: 'bar-or', leftText: 'left', rightText: 'right', label: 'Share of samples left of the line' });
  ctx.stage.append(pile.el, bar.el);
  bar.el.addEventListener('pointerup', () => ctx.setReady(bar.touched())); bar.el.addEventListener('keyup', () => ctx.setReady(bar.touched()));
  return {
    check() {
      const v = bar.get(), ok = Math.abs(v - c.left) <= 0.1 + 1e-9; bar.lock(); bar.ghost(c.left);
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}About ${pct(c.left)}% are left of the line, so the share is above ${pct(c.cut)}% about ${100 - pct(c.left)}% of the time. Counting answers it.` };
    },
    solve() { bar.set(c.left, true); ctx.setReady(true); },
    solveWrong() { bar.set(c.left < 0.5 ? c.left + 0.4 : c.left - 0.4, true); ctx.setReady(true); },
    info: c,
  };
}

// ---------------------------------------------------------------------------
// 2.4 tutorial: simulating is two steps
// ---------------------------------------------------------------------------
function buildTwoSteps(ctx) {
  const a = 7, b = 4, rng = ctx.rng;
  ctx.setPrompt('To simulate: pick a share from the belief curve, then draw ten shapes from a bag with that share. Tap the flashing button.');
  const cv = CurveView({ a, b, height: 130 });
  const tray = Tray(); tray.el.classList.add('wrap');
  const note = el('div', { class: 'stage-note' }, 'Step 1: pick a share');
  const b1 = el('button', { class: 'bigbtn flash' }, '1. Pick a share'), b2 = el('button', { class: 'bigbtn', disabled: true }, '2. Draw 10');
  ctx.stage.append(cv.el, note, el('div', { class: 'btnrow' }, b1, b2), tray.el);
  let theta = 0;
  b1.addEventListener('click', () => { theta = Math.round(BM.betaSampler(a, b)(rng) * 20) / 20; cv.update({ markers: [{ x: theta, cls: 'truth' }] }); b1.disabled = true; b1.classList.remove('flash'); b2.disabled = false; b2.classList.add('flash'); note.textContent = `Picked a share of ${pct(theta)}%`; });
  b2.addEventListener('click', () => { b2.disabled = true; b2.classList.remove('flash'); let k = 0; for (let i = 0; i < 10; i++) { const s = BM.drawShape(rng, theta); if (s === 'c') k++; tray.add(s, { size: 28 }); } note.textContent = `Picked ${pct(theta)}% and drew ${k} circles in 10`; ctx.complete('That is one simulated data set. Repeat both steps many times to see what the belief predicts.'); });
  return { solve() { b1.click(); b2.click(); } };
}

// ---------------------------------------------------------------------------
// 2.5 bracket the next ten draws (prior or posterior predictive)
// ---------------------------------------------------------------------------
const PMF10 = (a, b) => Array.from({ length: 11 }, (_, k) => BM.betaBinomPmf(k, 10, a, b));
function predictCase(rng) {
  for (let t = 0; t < 4000; t++) {
    const a0 = BM.pick(rng, [1, 2]), b0 = a0, n = rng() < 0.2 ? 0 : BM.pick(rng, [2, 4, 6, 8]), k = BM.int(rng, 0, n);
    const a = a0 + k, b = b0 + n - k, mean = BM.betaMean(a, b);
    if (n === 0 && a0 === 1) continue;
    if (mean < 0.22 || mean > 0.78) continue;
    const P = PMF10(a, b), [lo, hi] = BM.pmfBracket(P);
    if (hi - lo > 8) continue;                               // not just "anything from 0 to 10"
    const plug = Array.from({ length: 11 }, (_, j) => BM.binomPmf(j, 10, mean)), [pl, ph] = BM.pmfBracket(plug);
    if (BM.pmfMass(P, pl, ph) > 0.87) continue;             // ignoring the uncertainty in the share must clearly fail
    return { a0, b0, n, k, a, b, P, lo, hi, plug: [pl, ph] };
  }
  throw new Error('no predict case');
}
function buildPredict(ctx) {
  const c = predictCase(ctx.rng);
  ctx.setPrompt(c.n === 0 ? 'This is your belief before any draws. Ten draws are coming: bracket the count of circles you expect 9 times in 10.' : 'This is your belief after the draws above. Ten more are coming: bracket the count of circles you expect 9 times in 10.');
  const cv = CurveView({ a: c.a, b: c.b, height: 120 });
  const seen = c.n ? countIcons(c.k, c.n, 22) : null;
  const label = el('div', { class: 'livelabel' });
  const slider = AxisSlider({ values: [0.2, 0.8], labels: ['Fewest circles', 'Most circles'], step: 0.1, minGap: 0.02, onChange: () => { snap(); } });
  const ticks = TickRow({ xd: [0, 10], ticks: [0, 2, 4, 6, 8, 10], label: 'Count of circles, 0 to 10' });
  const counts = () => slider.get().map(v => Math.round(v * 10));
  function snap() {
    const v = slider.get(), s = v.map(x => Math.round(x * 10) / 10);
    if (s.some((x, i) => Math.abs(x - v[i]) > 1e-9)) { slider.set(0, s[0]); slider.set(1, s[1]); return; }
    const [lo, hi] = counts(); label.textContent = `Your bracket: ${lo} to ${hi} circles in 10`; ctx.setReady(slider.touched());
  }
  ctx.stage.append(...(seen ? [seen.el] : []), cv.el, label, slider.el, ticks.el); snap();
  return {
    check() {
      const [lo, hi] = counts(), mass = BM.pmfMass(c.P, lo, hi), ok = mass >= 0.9 - 1e-9 && hi - lo <= c.hi - c.lo + 1;
      slider.lock();
      const bars = BarStrip({ values: c.P, H: 96, ticks: true, hi: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), xticks: [0, 0.2, 0.4, 0.6, 0.8, 1], xlabels: ['0', '2', '4', '6', '8', '10'], label: `Predicted counts of circles in 10 draws; the middle 90 percent runs from ${c.lo} to ${c.hi}` });
      cv.el.replaceWith(bars.el); ticks.el.remove();
      const why = ok ? '' : mass < 0.9 ? ' Too narrow: it misses more than 1 time in 10.' : ' Wider than needed.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}The middle 90% is ${c.lo} to ${c.hi} circles: wide, as the share and the luck of ten draws both vary.` };
    },
    solve() { slider.set(0, c.lo / 10, true); slider.set(1, c.hi / 10, true); snap(); },
    solveWrong() { slider.set(1, c.plug[1] / 10, true); slider.set(0, c.plug[0] / 10, true); snap(); },
    info: c,
  };
}

// ---------------------------------------------------------------------------
// 2.6 which simulation is which?
// ---------------------------------------------------------------------------
function simulateCounts(rng, pmf, N = 400) {
  const cum = []; pmf.reduce((s, x, i) => (cum[i] = s + x), 0);
  const out = Array(pmf.length).fill(0);
  for (let i = 0; i < N; i++) { const u = rng(); let k = 0; while (k < pmf.length - 1 && cum[k] < u) k++; out[k]++; }
  return out;
}
function buildWhich(ctx) {
  const rng = ctx.rng, a0 = 2, b0 = 2;
  let n, k, post, prior, plug;
  for (let t = 0; t < 400; t++) {
    n = BM.int(rng, 3, 5); k = rng() < 0.5 ? n : 0; if (n >= 4 && rng() < 0.5) k = rng() < 0.5 ? n - 1 : 1;
    post = PMF10(a0 + k, b0 + n - k); prior = PMF10(a0, b0); plug = Array.from({ length: 11 }, (_, j) => BM.binomPmf(j, 10, k / n));
    const wd = p => { const [l, h] = BM.pmfBracket(p); return h - l; };
    if (wd(plug) < wd(post) && wd(post) < wd(prior)) break;
  }
  const rows = BM.shuffle(rng, [{ key: 'prior', pmf: prior }, { key: 'post', pmf: post }, { key: 'plug', pmf: plug }]);
  const ask = BM.pick(rng, ['prior', 'post', 'plug']);
  const ASK = { prior: 'the <b>prior predictive</b>: simulated before any draws.', post: 'the <b>posterior predictive</b>: simulated after the draws above.', plug: 'the one that treats the draws’ average as the exact share.' };
  ctx.setPrompt(`Each picture is 400 simulated runs of ten more draws. Tap ${ASK[ask]}`);
  const seen = countIcons(k, n, 22); seen.el.setAttribute('role', 'img'); seen.el.setAttribute('aria-label', `The draws seen: ${k} circles in ${n}`);
  let chosen = null; const btns = [];
  const els = rows.map((r, i) => {
    const sim = simulateCounts(rng, r.pmf), [l, h] = BM.pmfBracket(sim.map(x => x / 400));
    const strip = BarStrip({ values: sim, H: 56, label: `Simulation ${i + 1}: counts of circles in ten draws, mostly between ${l} and ${h}` });
    const b = el('button', { class: 'rowpick', 'aria-label': `Simulation ${i + 1}, mostly ${l} to ${h} circles`, onclick: () => { chosen = i; btns.forEach((x, j) => x.classList.toggle('on', j === i)); ctx.setReady(true); } }, el('div', { class: 'barsline' }, el('span', { class: 'rownum' }, i + 1), strip.el));
    btns.push(b); return b;
  });
  const ticks = TickRow({ xd: [0, 10], ticks: [0, 5, 10], label: 'Count of circles in ten draws, 0 to 10' });
  const tickWrap = el('div', { class: 'barsline' }, el('span', { class: 'rownum', style: 'visibility:hidden' }), ticks.el);
  ctx.stage.append(seen.el, ...els, tickWrap);
  const answer = rows.findIndex(r => r.key === ask), NAMES = { prior: 'Prior predictive', post: 'Posterior predictive', plug: 'Average only (too narrow)' };
  return {
    check() {
      const ok = chosen === answer;
      btns.forEach((b, i) => { b.disabled = true; b.classList.remove('on'); if (i === answer) b.classList.add('right'); else if (i === chosen) b.classList.add('bad'); b.prepend(el('div', { class: 'rowname' }, NAMES[rows[i].key])); });
      const how = { prior: 'It is the widest, centred on 50%: before any draws nearly anything is possible.', post: 'It leans toward the draws but stays wider than the average-only picture.', plug: 'Trusting the average as exact ignores the uncertainty, so it is the narrowest.' }[ask];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${how}` };
    },
    solve() { btns[answer].click(); },
    solveWrong() { btns[(answer + 1) % 3].click(); },
    info: { n, k, a0, b0, ask, answer, order: rows.map(r => r.key) },
  };
}

// ---------------------------------------------------------------------------
// 2.7 tutorial: a grid explodes
// ---------------------------------------------------------------------------
function buildBlowup(ctx) {
  ctx.setPrompt('One unknown with 7 candidate values needs 7 cells. Real models have more unknowns. Tap the flashing button to add a second one.');
  const cell = 28, gap = 3;
  const draw = rows => { let s = `<svg viewBox="0 0 300 ${rows * (cell + gap) + 2}" aria-hidden="true">`; for (let r = 0; r < rows; r++) for (let c = 0; c < 7; c++) s += `<rect x="${(300 - (7 * (cell + gap) - gap)) / 2 + c * (cell + gap)}" y="${r * (cell + gap) + 2}" width="${cell}" height="${cell}" rx="3" class="bs-bar"/>`; return s + '</svg>'; };
  const pic = el('div', { class: 'barstrip', role: 'img', 'aria-label': '1 unknown: a row of 7 cells', html: draw(1) });
  const note = el('div', { class: 'stage-note' }, '1 unknown: 7 cells');
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center' }, '+ one more unknown');
  ctx.stage.append(pic, note, btn);
  btn.addEventListener('click', () => { btn.disabled = true; btn.classList.remove('flash'); pic.innerHTML = draw(7); pic.setAttribute('aria-label', '2 unknowns: a 7 by 7 square of 49 cells'); note.textContent = '2 unknowns: 49 cells';
    ctx.complete('Each extra unknown multiplies the cells by 7: ten unknowns need over 280 million. We need a smarter way to sample.'); });
  return { solve: () => btn.click() };
}

// ---------------------------------------------------------------------------
// 2.8 / 2.9 MCMC: a walker on the curve that moves or stays
// ---------------------------------------------------------------------------
function walkerPlot(a, b, cur, prop, label) {
  const pk = Math.max(...Array.from({ length: 100 }, (_, i) => betaAt((i + 0.5) / 100, a, b)));
  const plot = Plot({ H: 170, xd: [0, 1], yd: [0, pk * 1.12], L: 10, R: 10, T: 10, B: 30, xticks: [0, 0.5, 1], xfmt: v => Math.round(v * 100) + '%', label });
  const f = x => betaAt(x, a, b);
  let d = ''; for (let i = 0; i <= 100; i++) d += `${i ? 'L' : 'M'}${plot.sx(i / 100).toFixed(1)} ${plot.sy(f(i / 100)).toFixed(1)} `;
  plot.show = (walker, proposal = null, link = false) => plot.draw([S.path(d, 'cv-line'),
    ...(proposal != null ? [S.line(plot.sx(proposal), plot.sy(0), plot.sx(proposal), plot.sy(f(proposal)), 'cv-mark'), S.dot(plot.sx(proposal), plot.sy(f(proposal)), 10, 'pdot hollow')] : []),
    ...(link ? [S.line(plot.sx(cur), plot.sy(f(cur)), plot.sx(prop), plot.sy(f(prop)), 'pline dash')] : []),
    S.line(plot.sx(walker), plot.sy(0), plot.sx(walker), plot.sy(f(walker)), 'cv-mark'), S.dot(plot.sx(walker), plot.sy(f(walker)), 10, 'pdot')]);
  return plot;
}
function buildWalkTut(ctx) {
  const a = 6, b = 3, cur = 0.35, prop = 0.6;
  ctx.setPrompt('To sample from a curve, a walker (●) stands on it and proposes jumps. Tap the flashing button to propose a jump.');
  const plot = walkerPlot(a, b, cur, prop, 'Belief curve with a walker at 35 percent');
  plot.show(cur);
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center' }, 'Propose a jump');
  const note = el('div', { class: 'stage-note' }, 'The walker stands at ●');
  ctx.stage.append(plot.el, note, btn);
  btn.addEventListener('click', () => {
    btn.disabled = true; btn.classList.remove('flash'); plot.show(cur, prop); note.textContent = 'Proposed ○ is higher: the walker moves'; plot.setLabel('The walker at 35 percent proposes a jump to a higher spot at 60 percent');
    setTimeout(() => { plot.show(prop, null, true); plot.setLabel('The walker moved up the curve to 60 percent'); }, 600);
    ctx.complete('It moved, because ○ was higher. A jump to a much lower spot is usually refused.');
  });
  return { solve: () => btn.click() };
}
function moveCase(rng) {
  for (let t = 0; t < 2000; t++) {
    const a = BM.int(rng, 3, 12), b = BM.int(rng, 3, 12), kind = rng() < 0.5 ? 'up' : 'down';
    const cur = BM.int(rng, 3, 17) / 20, prop = BM.int(rng, 3, 17) / 20;
    if (Math.abs(cur - prop) < 0.15) continue;
    const ratio = betaAt(prop, a, b) / betaAt(cur, a, b);
    if (kind === 'up' ? ratio < 1.5 : ratio > 0.25) continue;
    return { a, b, cur, prop, ratio, kind };
  }
  throw new Error('no move case');
}
function buildMove(ctx) {
  const c = moveCase(ctx.rng);
  ctx.setPrompt('The walker ● proposes a jump to ○. It goes to higher spots and rarely to far lower ones. What does it do?');
  const plot = walkerPlot(c.a, c.b, c.cur, c.prop, `Belief curve with the walker at ${pct(c.cur)} percent and a proposed jump to ${pct(c.prop)} percent, which is ${c.kind === 'up' ? 'higher' : 'far lower'}`);
  plot.show(c.cur, c.prop);
  const pick = PickButtons([{ text: 'It moves' }, { text: 'It stays' }], () => ctx.setReady(true));
  ctx.stage.append(plot.el, pick.el);
  const answer = c.kind === 'up' ? 0 : 1; let got = null; pick.btns.forEach((b, i) => b.addEventListener('click', () => { got = i; }));
  return {
    check() {
      const ok = got === answer; pick.reveal(answer, got);
      const why = c.kind === 'up' ? '○ is higher, so the walker always goes.' : '○ is far lower, so the walker usually stays.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${why} Over many steps its visits pile up in the shape of the curve.` };
    },
    solve() { pick.btns[answer].click(); },
    solveWrong() { pick.btns[1 - answer].click(); },
    info: c,
  };
}

UNITS[2] = {
  id: 'u2', title: 'Unit 2: Grids, samples and simulated data',
  intro: 'Get answers from a posterior without calculus: chop it into bars, take samples, simulate data, and see why bigger models need a walker.',
  subs: [
    { id: 'u2-chop', name: 'Chop a curve', blurb: 'Bars instead of a curve.', kind: 'tutorial', build: buildChop, help: 'Tap the flashing button. That is the only thing you can do here.' },
    { id: 'u2-peak', name: 'Tallest bar', blurb: 'Prior times likelihood.', kind: 'streak', target: 5, hearts: 2, build: buildPeak,
      help: 'Each posterior bar is the prior bar times the likelihood bar above it, then rescaled. Drag the marker to the tallest posterior bar. It is not the prior’s peak and not the likelihood’s peak: look for where both are reasonably tall.' },
    { id: 'u2-sample-tut', name: 'First samples', blurb: 'A pile in the curve’s shape.', kind: 'tutorial', build: buildSampleTut, help: 'Tap the flashing button to take samples from the bars.' },
    { id: 'u2-count', name: 'Count the pile', blurb: 'How much is left of a line?', kind: 'streak', target: 5, hearts: 2, build: buildCount,
      help: 'The pile holds 300 samples. Slide the divider so the bar splits the same way as the pile: the part of the pile left of the line against the part right of it. Within one tenth counts as right.' },
    { id: 'u2-steps-tut', name: 'Two steps', blurb: 'Pick a share, draw shapes.', kind: 'tutorial', build: buildTwoSteps, help: 'Tap the flashing button, then the next one that flashes.' },
    { id: 'u2-predict', name: 'Predict ten draws', blurb: 'Bracket the next count.', kind: 'streak', target: 5, hearts: 2, build: buildPredict,
      help: 'Drag the two handles to bracket the number of circles you expect among ten more draws, 9 times in 10. Two things are uncertain: the share (the curve) and the luck of the draws. Predictions are wider than you would get by just trusting the average.' },
    { id: 'u2-which', name: 'Which simulation?', blurb: 'Prior, posterior or average only.', kind: 'streak', target: 5, hearts: 2, build: buildWhich,
      help: 'Each picture is 400 simulated runs of ten draws. The prior predictive comes from the belief before any draws (wide, centred on 50%). The posterior predictive comes from the belief after the draws. A third picture treats the draws’ average as the exact share, ignoring how unsure it is, so it is too narrow. You are asked for one of the three.' },
    { id: 'u2-blowup-tut', name: 'Too many cells', blurb: 'Why grids stop working.', kind: 'tutorial', build: buildBlowup, help: 'Tap the flashing button to add a second unknown.' },
    { id: 'u2-walk-tut', name: 'A walker', blurb: 'Propose a jump.', kind: 'tutorial', build: buildWalkTut, help: 'Tap the flashing button. That is the only thing you can do here.' },
    { id: 'u2-move', name: 'Move or stay?', blurb: 'A walker samples the curve.', kind: 'streak', target: 5, hearts: 2, build: buildMove,
      help: 'The walker stands at the filled dot and proposes the hollow one. If the proposal is higher it always goes. If it is far lower it nearly always stays. Choose what it does.' },
  ],
};
