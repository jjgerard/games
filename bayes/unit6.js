// Unit 6: can I trust the answer? Reading trace plots and R-hat, and checking
// how much the prior matters. Short, and every item is a picture or a slider.
// Keys: the pseudo-count share (a+b)/(a+b+n) is the weight the prior mean gets
// in the posterior mean; the "outgrown" sample size comes from the gap between
// two Beta posterior means. Both are checked against R by tools/check-keys.js.

const CHAIN_LEN = 90;
function chainsOf(rng, kind) {
  const mk = (mean, phi, sd, drift = 0) => { let x = mean + (rng() - 0.5) * sd; return Array.from({ length: CHAIN_LEN }, (_, i) => { x = mean + drift * i / CHAIN_LEN + phi * (x - mean - drift * (i - 1) / CHAIN_LEN) + sd * BM.randn(rng) * Math.sqrt(1 - phi * phi); return x; }); };
  if (kind === 'ok') return [0, 1, 2, 3].map(() => mk(0, 0.4, 1));
  if (kind === 'apart') return [-3, -1, 1, 3].map(m => mk(m, 0.4, 0.45));
  if (kind === 'drift') return [0, 1, 2, 3].map(() => { let x = (rng() - 0.5) * 2, v = []; for (let i = 0; i < CHAIN_LEN; i++) { x += 0.35 * BM.randn(rng); v.push(x); } return v; });
  return [0, 1, 2, 3].map(i => (i === 3 ? mk(3.2, 0.4, 0.5) : mk(0, 0.4, 1)));  // 'stray'
}
const TRACE_NAMES = { ok: 'Healthy', apart: 'Chains disagree', drift: 'Still drifting', stray: 'One stray chain' };
const TRACE_ALT = { ok: 'four chains overlapping like a fuzzy caterpillar', apart: 'four chains sitting at different heights', drift: 'four chains wandering slowly without settling', stray: 'three chains overlapping and one sitting apart' };

function buildChainsTut(ctx) {
  const rng = ctx.rng; ctx.setPrompt('A walker like the one in Unit 2 can start four times, from four places. Tap the flashing button to run four walkers (chains).');
  const holder = TracePlot({ chains: [], H: 120, ylim: [-5, 5], label: 'Empty trace plot' });
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center' }, 'Run 4 chains');
  ctx.stage.append(holder, btn);
  btn.addEventListener('click', () => { btn.disabled = true; btn.classList.remove('flash'); const t = TracePlot({ chains: chainsOf(rng, 'ok'), H: 120, ylim: [-5, 5], label: TRACE_ALT.ok }); holder.replaceWith(t);
    ctx.complete('Each line is one chain’s value over time. When all four overlap like a fuzzy caterpillar, they agree: that is what a healthy trace plot looks like.'); });
  return { solve: () => btn.click() };
}

function buildTrace(ctx) {
  const rng = ctx.rng, bad = BM.shuffle(rng, ['apart', 'drift', 'stray']).slice(0, 2), kinds = BM.shuffle(rng, ['ok', ...bad]);
  ctx.setPrompt('Four chains each, three parameters. Tap the trace plot you can trust: the healthy fuzzy caterpillar.');
  let chosen = null; const btns = kinds.map((k, i) => el('button', { class: 'rowpick', 'aria-label': `Plot ${i + 1}: ${TRACE_ALT[k]}`, onclick: () => { chosen = i; btns.forEach((x, j) => x.classList.toggle('on', j === i)); ctx.setReady(true); } }, TracePlot({ chains: chainsOf(rng, k), H: 76, ylim: [-5, 5], label: '' })));
  ctx.stage.append(...btns);
  const answer = kinds.indexOf('ok');
  return {
    check() {
      const ok = chosen === answer; btns.forEach((b, i) => { b.disabled = true; b.classList.remove('on'); if (i === answer) b.classList.add('right'); else if (i === chosen) b.classList.add('bad'); b.prepend(el('div', { class: 'rowname' }, TRACE_NAMES[kinds[i]])); });
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}Healthy chains overlap and wander around one level. Chains that sit apart, drift or stray disagree about the answer.` };
    },
    solve() { btns[answer].click(); },
    solveWrong() { btns[(answer + 1) % 3].click(); },
    info: { kinds, answer },
  };
}

function buildRhat(ctx) {
  const rng = ctx.rng, badRow = BM.int(rng, 0, 2), names = ['Intercept', 'slope', 'sigma'];
  const rows = names.map((nm, i) => { const bad = i === badRow, rhat = bad ? r2(1.12 + rng() * 0.45) : r2(1 + rng() * 0.01), ess = bad ? BM.int(rng, 12, 70) : BM.int(rng, 1400, 3900), est = i === 2 ? r1(1 + rng() * 3) : r1(rng() * 20 - 5); return { name: nm, cells: [fmtNum(est), fmtNum(rhat, 2), String(ess)], rhat, ess }; });
  ctx.setPrompt('Part of a brms-style summary. Rhat compares the chains (1.00 means they agree); ESS says how many independent draws you really have. Tap the row you should not trust yet.');
  const tbl = ParamTable({ cols: ['Est.', 'Rhat', 'ESS'], rows, mode: 'row', onPick: () => ctx.setReady(true), label: 'Model summary with estimate, Rhat and effective sample size per parameter' });
  ctx.stage.append(tbl.el);
  return {
    check() {
      const p = tbl.get(), ok = p.r === badRow; tbl.reveal({ r: badRow }, ok ? null : p);
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${names[badRow]} has Rhat ${rows[badRow].cells[1]} and only ${rows[badRow].cells[2]} effective draws. Rhat should be about 1.00 (under 1.01), and ESS should be in the hundreds or thousands.` };
    },
    solve() { tbl.pick(badRow, 0); },
    solveWrong() { tbl.pick((badRow + 1) % 3, 0); },
    info: { badRow, rhat: rows.map(r => r.rhat), ess: rows.map(r => r.ess) },
  };
}

function shareCase(rng) {
  for (let t = 0; t < 2000; t++) {
    const a0 = BM.int(rng, 2, 7), b0 = BM.int(rng, 2, 7), n = BM.int(rng, 3, 24), w = BM.priorShare(a0, b0, n);
    if (a0 + b0 < 4 || a0 + b0 > 12 || Math.abs(w - 0.5) < 0.17) continue;
    return { a0, b0, n, k: BM.int(rng, 0, n), w };
  }
  throw new Error('no share case');
}
function buildPriorShare(ctx) {
  const c = shareCase(ctx.rng);
  ctx.setPrompt('Faint shapes are imagined (the prior), bright ones are real draws. Slide the divider to the share of the final belief that comes from the prior.');
  const t = Tray(); t.el.classList.add('wrap');
  for (let i = 0; i < c.a0; i++) t.add('c', { size: 18, cls: 'imag' }); for (let i = 0; i < c.b0; i++) t.add('s', { size: 18, cls: 'imag' });
  for (let i = 0; i < c.k; i++) t.add('c', { size: 18 }); for (let i = 0; i < c.n - c.k; i++) t.add('s', { size: 18 });
  const bar = ShareBar({ value: 0.5, leftClass: 'bar-acc', rightClass: 'bar-or', leftText: 'prior', rightText: 'data', label: 'Share of the belief from the prior' });
  bar.el.addEventListener('pointerup', () => ctx.setReady(bar.touched())); bar.el.addEventListener('keyup', () => ctx.setReady(bar.touched()));
  ctx.stage.append(t.el, bar.el);
  return {
    check() {
      const ok = Math.abs(bar.get() - c.w) <= 0.1 + 1e-9; bar.lock(); bar.ghost(c.w);
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${c.a0 + c.b0} imagined shapes against ${c.n} real ones: the prior supplies about ${pct(c.w)}%. ${c.w > 0.5 ? 'Here the prior outweighs the data.' : 'Here the data outweigh the prior.'}` };
    },
    solve() { bar.set(c.w, true); ctx.setReady(true); },
    solveWrong() { bar.set(c.w < 0.5 ? c.w + 0.4 : c.w - 0.4, true); ctx.setReady(true); },
    info: c,
  };
}

const OUT_GAP = 0.03;
function outgrowCase(rng) {
  for (let t = 0; t < 2000; t++) {
    const m = BM.pick(rng, [3, 4, 5, 6]), a = m, b = m, p = BM.pick(rng, [0.2, 0.8]);
    let nStar = null; for (let n = 5; n <= 60; n += 5) if (BM.meanGap(a, b, n, p) <= OUT_GAP) { nStar = n; break; }
    if (nStar && nStar >= 15 && nStar <= 40) return { a, b, p, nStar };
  }
  throw new Error('no outgrow case');
}
function buildOutgrow(ctx) {
  const c = outgrowCase(ctx.rng), nOf = v => 5 + 5 * Math.round(v * 11);
  ctx.setPrompt(`Two people start from different priors: a flat one and a firm one (${c.a + c.b - 2} imagined shapes, half circles). Real draws are ${pct(c.p)}% circles. How few draws make their beliefs agree to within 3 points?`);
  const cv = CurveView({ a: 2, b: 2, height: 100 }), label = el('div', { class: 'livelabel' });
  const draw = () => { const n = nOf(slider.get()[0]), k = Math.round(c.p * n); cv.update({ a: 1 + k, b: 1 + n - k, ghost: [c.a + k, c.b + n - k] }); label.textContent = `${n} draws: the two beliefs differ by ${Math.round(BM.meanGap(c.a, c.b, n, c.p) * 100)} points`; ctx.setReady(slider.touched()); };
  const slider = AxisSlider({ values: [0], labels: ['Number of real draws'], step: 1 / 11, onChange: draw });
  const ticks = TickRow({ xd: [5, 60], ticks: [5, 20, 40, 60], label: 'Number of draws, 5 to 60' });
  ctx.stage.append(cv.el, label, slider.el, ticks.el); draw();
  return {
    check() {
      const n = nOf(slider.get()[0]), ok = n >= c.nStar && n <= c.nStar + 5; slider.lock();
      const why = ok ? '' : n < c.nStar ? ' Too few: the priors still pull the two beliefs apart.' : ' More than needed.';
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite.' + why + ' '}About ${c.nStar} draws are enough. With few data the prior matters; with enough data different priors lead to nearly the same answer.` };
    },
    solve() { slider.set(0, (c.nStar - 5) / 55, true); },
    solveWrong() { slider.set(0, c.nStar > 25 ? 0 : 1, true); },
    info: c,
  };
}

UNITS[6] = {
  id: 'u6', title: 'Unit 6: Can I trust it?',
  intro: 'Two checks before believing a fitted model: did the chains agree, and does the prior still matter?',
  subs: [
    { id: 'u6-chains-tut', name: 'Run the chains', blurb: 'Four walkers at once.', kind: 'tutorial', build: buildChainsTut, help: 'Tap the flashing button. That is the only thing you can do here.' },
    { id: 'u6-trace', name: 'Fuzzy caterpillar', blurb: 'Pick the healthy trace.', kind: 'streak', target: 5, hearts: 2, build: buildTrace,
      help: 'Each picture shows four chains over time. Trust the one where all four lines overlap and wander around one level. Distrust chains that sit apart, drift slowly, or have one stray line.' },
    { id: 'u6-rhat', name: 'Rhat and ESS', blurb: 'Which row is not ready?', kind: 'streak', target: 5, hearts: 2, build: buildRhat,
      help: 'Rhat should be about 1.00: above 1.05 the chains disagree. ESS is the number of effectively independent draws: tiny values mean the estimate is shaky. Tap the row that fails.' },
    { id: 'u6-share', name: 'How much is prior?', blurb: 'Imagined against real.', kind: 'streak', target: 5, hearts: 2, build: buildPriorShare,
      help: 'The prior acts like imagined draws added to the real ones. Compare the faint shapes with the bright ones and slide the divider to the prior’s share of all the shapes.' },
    { id: 'u6-outgrow', name: 'Outgrow the prior', blurb: 'How many draws until priors agree?', kind: 'streak', target: 5, hearts: 2, build: buildOutgrow,
      help: 'Slide the number of real draws. The solid curve starts from a flat prior and the dashed one from a firm prior. Find the fewest draws that bring the labels’ gap to 3 points or less.' },
  ],
};
