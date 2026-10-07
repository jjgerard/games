// Every sub-level. Each `build(ctx)` makes ONE question on the stage and
// returns a controller:
//   check()   -> { correct, message }   called when the player presses Check
//   reveal()  -> (optional) redraw the stage to show the picture behind the answer
//   solve()   -> put the stage into the right answer (used by the test suite)
//   solveWrong() -> deliberately wrong (also tests)
// ctx gives it: stage, rng, setPrompt(html), setReady(bool), complete(msg)
// (tutorials only). Nothing here asks anyone to multiply: answers are given
// by moving a divider or tapping, and judged against a tolerance.

const pct = x => Math.round(x * 100);
const TOL_SHARE = 0.1;   // a share is right if it's within one shape in ten
const TOL_BELIEF = 0.15; // a belief is right if it's within 15 points

// ---------------------------------------------------------------------------
// Tutorials: one thing on screen and one possible move.
// ---------------------------------------------------------------------------
function buildTutDraw(ctx) {
  ctx.setPrompt('Pull one shape out of the bag. <b>Drag</b> the flashing tile out of the bag and let go.');
  const tray = Tray();
  const drawer = BagDrawer({ nC: 10, nS: 0, seed: 3, size: 'lg', sealed: false, flash: true,
    onDraw: () => { drawer.setDisabled(true); tray.add('c', { size: 40 }); ctx.complete('That is one draw. Every draw gives you one shape.'); } });
  ctx.stage.append(drawer.el, el('div', { class: 'draghint', id: 'drawhint' }), tray.el);
  return { solve: () => drawer.drawNow(), drawer };
}

function buildTutSlide(ctx) {
  ctx.setPrompt('These shapes were drawn. Slide the divider so the bar matches them.');
  const tray = Tray();
  for (let i = 0; i < 4; i++) tray.add('c');
  const bar = ShareBar({ value: 0.5, leftText: 'Circles', rightText: 'Squares', label: 'Share of circles', pulse: true,
    onChange: (v) => { if (v >= 0.95) { bar.lock(); ctx.complete('All four are circles, so the whole bar is circles.'); } } });
  ctx.stage.append(tray.el, bar.el, el('div', { class: 'stage-note' }, 'Drag the white divider all the way to the right'));
  return { solve: () => bar.set(1, true) };
}

// ---------------------------------------------------------------------------
// 0.1 Share of circles
// ---------------------------------------------------------------------------
function buildShare(ctx, forceVariant) {
  const rng = ctx.rng;
  const nC = BM.int(rng, 1, 9);
  const variant = forceVariant || (rng() < 0.5 ? 'draw' : 'bag');
  const bar = ShareBar({ value: 0.5, leftText: 'Circles', rightText: 'Squares', label: 'Share of circles' });
  const bagSeed = BM.int(rng, 1, 999);
  let tally = null, drawer = null;
  const bagEl = variant === 'bag' ? el('div', { class: 'bagbox', style: 'margin:0 auto', html: bagSVG(nC, 10 - nC, { seed: bagSeed, size: 190 }) }) : null;
  const update = () => ctx.setReady(bar.touched() && (variant === 'bag' || tally.counts.c + tally.counts.s >= 6));
  bar.el.addEventListener('pointerup', update); bar.el.addEventListener('keyup', update);
  const draws = (k) => {
    for (let i = 0; i < k; i++) tally.add(BM.drawShape(rng, nC / 10));
    count.textContent = `${tally.counts.c + tally.counts.s} drawn`; update();
  };
  const count = el('div', { class: 'stage-note' }, '0 drawn');
  if (variant === 'bag') {
    ctx.setPrompt('Look at the bag. Slide the divider to show what share of the shapes are <b>circles</b>.');
    ctx.stage.append(bagEl, bar.el);
  } else {
    ctx.setPrompt('The bag is closed. Drag at least 6 shapes out of it, then slide the divider to match your tally.');
    tally = Tally();
    drawer = BagDrawer({ nC, nS: 10 - nC, seed: bagSeed, size: 'lg', sealed: true, onDraw: () => draws(1), label: 'Draw a shape' });
    const b5 = el('button', { class: 'bigbtn alt', onclick: () => draws(5) }, 'Draw 5 at once');
    ctx.stage.append(drawer.el, tally.el, count, el('div', { class: 'btnrow' }, b5), bar.el);
  }
  const target = () => variant === 'bag' ? nC / 10 : tally.counts.c / (tally.counts.c + tally.counts.s);
  return {
    check() {
      const t = target(), ok = Math.abs(bar.get() - t) <= TOL_SHARE + 1e-9;
      bar.lock(); bar.ghost(t);
      const msg = variant === 'bag'
        ? `${nC} of the 10 shapes are circles, which is ${pct(t)}%.`
        : `You drew ${tally.counts.c} circles and ${tally.counts.s} squares, so ${pct(t)}% were circles.`;
      return { correct: ok, message: ok ? `Yes. ${msg}` : `Not quite. ${msg} The green mark shows where the divider should be.` };
    },
    solve() { if (variant === 'draw') draws(6); bar.set(target(), true); update(); },
    solveWrong() { if (variant === 'draw') draws(6); bar.set(1 - target() > .5 ? 0.97 : 0.03, true); if (Math.abs(bar.get() - target()) <= TOL_SHARE) bar.set(.5 > target() ? .97 : .03, true); update(); },
  };
}

// ---------------------------------------------------------------------------
// 0.2 How many draws?
// ---------------------------------------------------------------------------
const HOWMANY = [
  { p: 0.5, band: 0.2 }, { p: 0.5, band: 0.15 }, { p: 0.3, band: 0.15 },
  { p: 0.7, band: 0.15 }, { p: 0.4, band: 0.1 }, { p: 0.6, band: 0.12 },
];
function buildHowMany(ctx) {
  const rng = ctx.rng, cfg = BM.pick(rng, HOWMANY), PLAYERS = 20, NEED = 0.95;
  ctx.setPrompt(`Twenty people each draw some shapes from a bag that is <b>${pct(cfg.p)}% circles</b> and report their share. Choose how many draws each person gets, so nearly everyone lands in the <b>green band</b>.`);
  const strip = el('div', { class: 'dotstrip', role: 'img', 'aria-label': 'Where twenty people\'s shares landed' });
  const band = el('div', { class: 'band', style: `left:${(cfg.p - cfg.band) * 100}%;width:${cfg.band * 200}%` });
  strip.append(band, el('div', { class: 'truth', style: `left:${cfg.p * 100}%` }));
  const slider = el('input', { type: 'range', class: 'nslider', min: 5, max: 200, step: 5, value: 10, 'aria-label': 'Draws per person' });
  const nlabel = el('div', { class: 'nlabel' });
  const result = el('div', { class: 'stage-note' }, 'Press Run to see where everyone lands');
  let ran = false;
  const n = () => Number(slider.value);
  const showN = () => { nlabel.textContent = `${n()} draws each`; };
  slider.addEventListener('input', showN); showN();
  function run() {
    strip.querySelectorAll('.pdot').forEach(d => d.remove());
    let inside = 0;
    for (let i = 0; i < PLAYERS; i++) {
      let c = 0; for (let j = 0; j < n(); j++) if (rng() < cfg.p) c++;
      const share = c / n(), ok = Math.abs(share - cfg.p) <= cfg.band + 1e-9; if (ok) inside++;
      strip.append(el('div', { class: 'pdot' + (ok ? '' : ' out'), style: `left:${BM.clamp(share, .01, .99) * 100}%;top:${12 + (i % 5) * 11}px` }));
    }
    result.textContent = `${inside} of ${PLAYERS} landed in the band`;
    ran = true; ctx.setReady(true);
  }
  const runBtn = el('button', { class: 'bigbtn', onclick: run }, 'Run 20 people');
  ctx.stage.append(strip, el('div', { class: 'axis-note' }, el('span', {}, '0% circles'), el('span', {}, '100%')), nlabel, slider, el('div', { class: 'btnrow' }, runBtn), result);
  return {
    check() {
      const cov = BM.coverage(cfg.p, n(), cfg.band), ok = cov >= NEED;
      slider.disabled = true; runBtn.disabled = true;
      let need = 5; while (BM.coverage(cfg.p, need, cfg.band) < NEED && need < 400) need += 5;
      return { correct: ok, message: ok
        ? `Yes. With ${n()} draws each, about ${pct(cov)}% of people land in the band. More draws squeeze the shares together.`
        : `With ${n()} draws each, only about ${pct(cov)}% land in the band. You need roughly ${need} draws each for nearly everyone.` };
    },
    solve() { let need = 5; while (BM.coverage(cfg.p, need, cfg.band) < NEED) need += 5; slider.value = need; showN(); run(); },
    solveWrong() { slider.value = 5; showN(); run(); },
  };
}

// ---------------------------------------------------------------------------
// 0.3 / 0.4 Inside a group (conditional shares), and flipping the condition
// ---------------------------------------------------------------------------
// 12 shapes (a 4x3 grid), each a circle or a square and either dotted or
// plain. Few enough to eyeball, and every cell is a whole number of twelfths
// for when joint probability arrives. Every group you could pick from has at
// least three shapes, so a share is never a trivial one-of-one.
const GRID_SIZE = 12;
function makeCondGrid(rng, needFlip) {
  for (let tries = 0; tries < 2000; tries++) {
    const cd = BM.int(rng, 1, 6), cp = BM.int(rng, 1, 6), sd = BM.int(rng, 1, 6);
    const sp = GRID_SIZE - cd - cp - sd; if (sp < 1 || sp > 6) continue;
    if (Math.min(cd + cp, sd + sp, cd + sd, cp + sp) < 3) continue;
    const pDotGivenC = cd / (cd + cp), pCGivenDot = cd / (cd + sd);
    if (needFlip && Math.abs(pDotGivenC - pCGivenDot) < 0.25) continue;
    return { cd, cp, sd, sp };
  }
  return { cd: 4, cp: 2, sd: 2, sp: 4 };
}
const GROUPS = {
  c: { label: 'circles', test: s => s.t === 'c' },
  s: { label: 'squares', test: s => s.t === 's' },
  d: { label: 'dotted', test: s => s.d },
  p: { label: 'plain', test: s => !s.d },
};
function buildInside(ctx, flip) {
  const rng = ctx.rng;
  const counts = makeCondGrid(rng, flip);
  const items = BM.shuffle(rng, [
    ...Array(counts.cd).fill({ t: 'c', d: true }), ...Array(counts.cp).fill({ t: 'c', d: false }),
    ...Array(counts.sd).fill({ t: 's', d: true }), ...Array(counts.sp).fill({ t: 's', d: false })]);
  // The question: pick from `given`, how likely is it `want`?
  const shapeFirst = flip ? rng() < 0.5 : true;
  const shapeKey = rng() < 0.5 ? 'c' : 's';
  const given = shapeFirst ? shapeKey : 'd';     // group to look inside
  const want = shapeFirst ? 'd' : shapeKey;      // property to measure
  const inGiven = items.filter(GROUPS[given].test), truth = inGiven.filter(GROUPS[want].test).length / inGiven.length;
  const txt = k => k === 'd' ? 'dotted' : k === 'c' ? 'circles' : 'squares';
  const nm = k => k === 'd' ? 'a dotted shape' : k === 'c' ? 'a circle' : 'a square';
  ctx.setPrompt(`Pick one at random from the <b>${txt(given)}</b>. How likely is it to be <b>${nm(want)}</b>? First tap the group you are looking inside, then slide.`);
  const grid = el('div', { class: 'fgrid', role: 'img', 'aria-label': '12 shapes: circles and squares, some dotted' });
  const nodes = items.map(s => { const n = shapeNode(s.t, { size: 40, dot: s.d }); grid.append(n); return n; });
  let lens = null;
  const lensBtns = {};
  const lensRow = el('div', { class: 'lens', role: 'group', 'aria-label': 'Which group are you looking inside?' });
  for (const k of ['c', 's', 'd', 'p']) {
    const icon = k === 'd' ? `<svg viewBox="0 0 30 30" width="20" height="20"><circle cx="15" cy="15" r="13" fill="#8a847a"/><circle cx="15" cy="15" r="4.2" fill="#fff"/></svg>`
      : k === 'p' ? `<svg viewBox="0 0 30 30" width="20" height="20"><circle cx="15" cy="15" r="13" fill="#8a847a"/></svg>`
      : shapeSVG(k, { size: 20 });
    const b = el('button', { class: 'lensbtn', 'aria-pressed': 'false', onclick: () => pick(k) }, el('span', { html: icon }), GROUPS[k].label);
    lensBtns[k] = b; lensRow.append(b);
  }
  const bar = ShareBar({ value: 0.5, leftText: want === 'd' ? 'Dotted' : want === 'c' ? 'Circles' : 'Squares',
    rightText: want === 'd' ? 'Plain' : want === 'c' ? 'Squares' : 'Circles', leftClass: 'bar-acc', rightClass: 'bar-grey', label: 'Share' });
  function pick(k) {
    lens = k;
    for (const [kk, b] of Object.entries(lensBtns)) { b.classList.toggle('on', kk === k); b.setAttribute('aria-pressed', kk === k); }
    items.forEach((s, i) => nodes[i].classList.toggle('dim', !GROUPS[k].test(s)));
    update();
  }
  const update = () => ctx.setReady(lens !== null && bar.touched());
  bar.el.addEventListener('pointerup', update); bar.el.addEventListener('keyup', update);
  ctx.stage.append(grid, lensRow, bar.el);
  const fmt = (k, w) => `${items.filter(GROUPS[k].test).filter(GROUPS[w].test).length} of ${items.filter(GROUPS[k].test).length}`;
  return {
    check() {
      const lensOk = lens === given, shareOk = Math.abs(bar.get() - truth) <= TOL_SHARE + 1e-9;
      bar.lock(); bar.ghost(truth);
      if (!lensOk) { lensBtns[lens].classList.add('bad'); pick(given); }
      let msg = `Inside the ${txt(given)}: ${fmt(given, want)} are ${txt(want)} (${pct(truth)}%).`;
      if (flip) {
        const back = items.filter(GROUPS[want === 'd' ? 'd' : want].test);
        const truthBack = back.filter(GROUPS[given].test).length / back.length;
        msg += ` The other way round, inside the ${txt(want)}: ${pct(truthBack)}% are ${txt(given)}. Not the same!`;
      }
      const ok = lensOk && shareOk;
      return { correct: ok, message: ok ? `Yes. ${msg}` : (!lensOk ? `You looked inside the wrong group. ${msg}` : `Close, but not quite. ${msg}`) };
    },
    solve() { pick(given); bar.set(truth, true); update(); },
    solveWrong() { pick(given === 'c' ? 's' : 'c'); bar.set(truth, true); update(); },
  };
}

// ---------------------------------------------------------------------------
// 0.5 / 0.7 Which bag? One draw (equal shelf, then a rare kind of bag)
// ---------------------------------------------------------------------------
function makeTwoBags(rng, rare) {
  const pA = BM.pick(rng, [0.7, 0.8, 0.9]);
  const pB = rng() < 0.5 ? Math.round((1 - pA) * 10) / 10 : BM.pick(rng, [0.1, 0.2, 0.3]);
  let nA = 5, nB = 5;
  if (rare) { const r = BM.pick(rng, [1, 2, 3]); if (rng() < 0.5) { nA = r; nB = 10 - r; } else { nB = r; nA = 10 - r; } }
  let shape = BM.pick(rng, ['c', 's']);
  if (rare && rng() < 0.8) {
    // show the shape that points towards the RARE kind, so the obvious
    // guess and the right answer disagree.
    const rareIsA = nA < nB;
    const lA = shape => (shape === 'c' ? pA : 1 - pA), lB = shape => (shape === 'c' ? pB : 1 - pB);
    const favours = s => (rareIsA ? lA(s) > lB(s) : lB(s) > lA(s));
    shape = ['c', 's'].find(favours) || shape;
  }
  return { pA, pB, nA, nB, shape };
}
function buildTwoBags(ctx, rare) {
  const rng = ctx.rng, q = makeTwoBags(rng, rare);
  const truth = BM.posteriorA(q.pA, q.pB, q.nA, q.nB, [q.shape]);
  ctx.setPrompt(`One bag is picked from the shelf and one shape is drawn: <b>${iconWord(q.shape)}</b>. How sure are you it is kind <b>A</b>?`);
  const bags = el('div', { class: 'bags-row' },
    el('div', { class: 'bagbox', html: bagSVG(BM.circlesPerTen(q.pA), 10 - BM.circlesPerTen(q.pA), { seed: 11, badge: 'A', size: 120 }) }),
    el('div', { class: 'bagbox', html: bagSVG(BM.circlesPerTen(q.pB), 10 - BM.circlesPerTen(q.pB), { seed: 12, badge: 'B', size: 120 }) }));
  const shelf = Shelf(q.nA, q.nB);
  const drawn = el('div', { class: 'bigshape' }, 'Drawn:', shapeNode(q.shape, { size: 44 }));
  const bar = ShareBar({ value: 0.5, leftText: 'A', rightText: 'B', leftClass: 'bar-A', rightClass: 'bar-B', label: 'How sure it is kind A' });
  const upd = () => ctx.setReady(bar.touched());
  bar.el.addEventListener('pointerup', upd); bar.el.addEventListener('keyup', upd);
  ctx.stage.append(bags, el('div', { class: 'stage-note' }, 'The shelf (each bag is kind A or B)'), shelf, drawn, bar.el);
  return {
    check() {
      const ok = Math.abs(bar.get() - truth) <= TOL_BELIEF + 1e-9;
      bar.lock(); bar.ghost(truth);
      const c = BM.shelfCounts(q.pA, q.pB, q.nA, q.nB, q.shape);
      const msg = `Imagine ten draws from every bag on the shelf. ${c.fromA + c.fromB} of those draws show ${q.shape === 'c' ? 'a circle' : 'a square'}: ${c.fromA} from kind-A bags and ${c.fromB} from kind-B bags. So ${pct(truth)}% for A.`;
      return { correct: ok, message: ok ? `Yes. ${msg}` : `Not quite. ${msg}` };
    },
    reveal() { bags.remove(); shelf.previousSibling.remove(); shelf.replaceWith(FreqGrid(q.pA, q.pB, q.nA, q.nB, q.shape)); },
    solve() { bar.set(truth, true); upd(); },
    solveWrong() { bar.set(truth > 0.5 ? 0.04 : 0.96, true); upd(); },
  };
}

// ---------------------------------------------------------------------------
// 0.6 Which bag? Several draws, updating as you go
// ---------------------------------------------------------------------------
function buildSeveral(ctx) {
  const rng = ctx.rng, pA = BM.pick(rng, [0.7, 0.8, 0.9]), pB = Math.round((1 - pA) * 10) / 10;
  const N = BM.int(rng, 2, 4), trueIsA = rng() < 0.5;
  const draws = Array.from({ length: N }, () => BM.drawShape(rng, trueIsA ? pA : pB));
  const truth = BM.posteriorA(pA, pB, 5, 5, draws);
  ctx.setPrompt(`A bag, kind <b>A</b> or <b>B</b> (equally common), is picked. Drag ${N} shapes out one at a time. After each, slide to show how sure you are it is A.`);
  const tray = Tray(); let k = 0;
  let drawer = null;
  const bags = el('div', { class: 'bags-row' },
    el('div', { class: 'bagbox', html: bagSVG(BM.circlesPerTen(pA), 10 - BM.circlesPerTen(pA), { seed: 11, badge: 'A', size: 70 }) }),
    el('div', { class: 'bagbox' }),
    el('div', { class: 'bagbox', html: bagSVG(BM.circlesPerTen(pB), 10 - BM.circlesPerTen(pB), { seed: 12, badge: 'B', size: 70 }) }));
  const bar = ShareBar({ value: 0.5, leftText: 'A', rightText: 'B', leftClass: 'bar-A', rightClass: 'bar-B', label: 'How sure it is kind A' });
  const left = el('div', { class: 'stage-note' }, `Drag ${N} shapes out of the closed bag`);
  const upd = () => ctx.setReady(k === N && bar.touched());
  function draw() {
    if (k >= N) return;
    tray.add(draws[k]); k++;
    left.textContent = k === N ? 'All drawn' : `${N - k} to go`; if (k === N) drawer.setDisabled(true); upd();
  }
  drawer = BagDrawer({ nC: 5, nS: 5, seed: 31, size: 'md', sealed: true, onDraw: draw });
  bags.children[1].append(drawer.el);
  bar.el.addEventListener('pointerup', upd); bar.el.addEventListener('keyup', upd);
  const trail = el('div', { class: 'trail' });
  ctx.stage.append(bags, left, tray.el, bar.el, trail);
  return {
    check() {
      const ok = Math.abs(bar.get() - truth) <= TOL_BELIEF + 1e-9;
      bar.lock(); bar.ghost(truth);
      const seen = draws.map(d => d === 'c' ? 'circle' : 'square').join(', ');
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}You saw: ${seen}. Each draw nudges the belief, and a circle then a square can cancel out. The answer is ${pct(truth)}% for A.` };
    },
    reveal() {
      bags.remove(); trail.innerHTML = '';
      for (let i = 0; i <= N; i++) {
        const p = BM.posteriorA(pA, pB, 5, 5, draws.slice(0, i));
        trail.append(el('div', { class: 'trailrow' },
          i === 0 ? el('div', { class: 'tl' }) : el('div', { class: 'tl', html: shapeSVG(draws[i - 1], { size: 24 }) }),
          el('div', { class: 'mini' }, el('div', { class: 'bar-A', style: `width:${p * 100}%` }), el('div', { class: 'bar-B', style: `width:${(1 - p) * 100}%` }))));
      }
    },
    solve() { while (k < N) draw(); bar.set(truth, true); upd(); },
    solveWrong() { while (k < N) draw(); bar.set(truth > 0.5 ? 0.04 : 0.96, true); upd(); },
  };
}

// ---------------------------------------------------------------------------
// 0.8 Many possible bags: spread ten chips of belief
// ---------------------------------------------------------------------------
function buildChips(ctx) {
  const rng = ctx.rng;
  const ps = BM.pick(rng, [[0.2, 0.4, 0.6, 0.8], [0.1, 0.3, 0.5, 0.7, 0.9]]);
  const N = BM.int(rng, 1, 3), trueP = BM.pick(rng, ps);
  const draws = Array.from({ length: N }, () => BM.drawShape(rng, trueP));
  const k = draws.filter(d => d === 'c').length;
  const post = BM.gridPosterior(ps, k, N).map(x => x * 10);
  ctx.setPrompt(`These shapes were drawn from one bag. Spread your <b>10 chips</b> over the kinds of bag that could have made them.`);
  const tray = Tray(); draws.forEach(d => tray.add(d));
  const chips = ps.map(() => 0);
  const left = el('div', { class: 'chipleft' });
  const grid = el('div', { class: 'chipgrid' });
  const stacks = [], counts = [];
  ps.forEach((p, i) => {
    const stack = el('div', { class: 'chipstack' });
    stacks.push(stack);
    const nc = BM.circlesPerTen(p);
    const col = el('div', { class: 'chipcol' },
      el('div', { html: bagSVG(nc, 10 - nc, { seed: 20 + i, size: 64 }) }),
      el('div', { class: 'stage-note' }, `${pct(p)}% circles`),
      el('div', { class: 'stacks' }, stack),
      el('div', { class: 'chipbtns' },
        el('button', { 'aria-label': `Remove a chip from the ${pct(p)}% bag`, onclick: () => move(i, -1) }, '−'),
        el('button', { 'aria-label': `Add a chip to the ${pct(p)}% bag`, onclick: () => move(i, 1) }, '+')));
    grid.append(col);
  });
  const total = () => chips.reduce((a, b) => a + b, 0);
  function paint() {
    stacks.forEach((s, i) => { s.innerHTML = ''; for (let j = 0; j < chips[i]; j++) s.append(el('div', { class: 'chip' })); });
    left.textContent = total() === 10 ? 'All 10 chips placed' : `${10 - total()} chips left`;
    ctx.setReady(total() === 10);
  }
  function move(i, d) { if (d > 0 && total() >= 10) return; if (d < 0 && chips[i] === 0) return; chips[i] += d; paint(); }
  ctx.stage.append(el('div', { class: 'bigshape' }, 'Drawn:', tray.el), grid, left); paint();
  const dev = () => chips.reduce((a, c, i) => a + Math.abs(c - post[i]), 0);
  return {
    check() {
      const ok = dev() <= 3 + 1e-9;
      stacks.forEach((s, i) => { const t = Math.round(post[i]); const tr = el('div', { class: 'chipstack' }); for (let j = 0; j < t; j++) tr.append(el('div', { class: 'chip truth' })); s.parentNode.append(tr); });
      const best = ps[post.indexOf(Math.max(...post))];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}You saw ${k} circle${k === 1 ? '' : 's'} in ${N} draw${N === 1 ? '' : 's'}. The green chips show where belief belongs: most on the ${pct(best)}% bag, and some on every kind that could still have made this.` };
    },
    solve() { chips.fill(0); const r = post.map(Math.round); let diff = 10 - r.reduce((a, b) => a + b, 0); r[r.indexOf(Math.max(...r))] += diff; r.forEach((c, i) => chips[i] = Math.max(0, c)); paint(); },
    solveWrong() { chips.fill(0); const worst = post.indexOf(Math.min(...post)); chips[worst] = 10; paint(); },
  };
}

// ---------------------------------------------------------------------------
// The unit: sub-levels in order. `kind` 'tutorial' completes on one action;
// 'streak' needs `target` right in a row, with `hearts` allowed misses.
// ---------------------------------------------------------------------------
const UNITS = [
  {
    id: 'u0', title: 'Unit 0: Shapes and counting',
    intro: 'Before any formulas: draw shapes from bags, look at shares, and learn to change your mind when evidence arrives.',
    subs: [
      { id: 'u0-draw', name: 'First draw', blurb: 'Pull one shape out of a bag.', kind: 'tutorial', build: buildTutDraw,
        help: 'Drag the flashing tile out of the bag and let go. That is the only thing you can do here. (With a keyboard, press Enter on it.)' },
      { id: 'u0-slide', name: 'First slide', blurb: 'Make a bar match the shapes.', kind: 'tutorial', build: buildTutSlide,
        help: 'Drag the white divider along the bar. Left is circles, right is squares.' },
      { id: 'u0-share', name: 'Share of circles', blurb: 'Slide a divider to a share.', kind: 'streak', target: 5, hearts: 2, build: buildShare,
        help: 'Slide the divider to show what share of the shapes are circles. Sometimes you look at the bag; sometimes you drag shapes out of a closed bag and match your tally. Within one shape in ten counts as right.' },
      { id: 'u0-many', name: 'How many draws?', blurb: 'Fewer draws wobble more.', kind: 'streak', target: 5, hearts: 2, build: buildHowMany,
        help: 'Pick how many draws each person gets and press Run to see where twenty people land. Press Check when you think nearly everyone will land inside the green band.' },
      { id: 'u0-inside', name: 'Just the circles', blurb: 'Look inside a group.', kind: 'streak', target: 5, hearts: 2, build: ctx => buildInside(ctx, false),
        help: 'First tap the group you are picking from (the others fade). Then slide to show what share of that group has the property.' },
      { id: 'u0-flip', name: 'Flip it', blurb: 'Not the same the other way.', kind: 'streak', target: 5, hearts: 2, build: ctx => buildInside(ctx, true),
        help: 'Same as before, but the question can be either way round. Always tap the group you are picking from first.' },
      { id: 'u0-two', name: 'Which bag?', blurb: 'One draw, two kinds of bag.', kind: 'streak', target: 5, hearts: 2, build: ctx => buildTwoBags(ctx, false),
        help: 'A bag is picked at random from the shelf and one shape is drawn. Slide to show how sure you are it is kind A. After you check, you will see ten imagined draws from every bag.' },
      { id: 'u0-several', name: 'More draws', blurb: 'Change your mind as you go.', kind: 'streak', target: 5, hearts: 2, build: buildSeveral,
        help: 'Drag one shape at a time out of the closed bag and slide after each. A circle then a square can cancel out.' },
      { id: 'u0-rare', name: 'Rare bags', blurb: 'Some bags are scarcer.', kind: 'streak', target: 5, hearts: 2, build: ctx => buildTwoBags(ctx, true),
        help: 'Look at the shelf: one kind of bag is rare. The shape you see may point at the rare kind, but rare is still rare.' },
      { id: 'u0-chips', name: 'Many bags', blurb: 'Spread ten chips of belief.', kind: 'streak', target: 5, hearts: 2, build: buildChips,
        help: 'Use + and − to place all ten chips across the kinds of bag. Put more chips where you believe more.' },
    ],
  },
  { id: 'u1', title: 'Unit 1', locked: true, subs: [] },
  { id: 'u2', title: 'Unit 2', locked: true, subs: [] },
  { id: 'u3', title: 'Unit 3', locked: true, subs: [] },
];

// ---------------------------------------------------------------------------
// Placement: six pictures, no teaching, no feedback. Each tests the idea one
// sub-level builds, so the first one missed is where to start.
// ---------------------------------------------------------------------------
const PLACEMENT = [
  { id: 'u0-share', unlocks: ['u0-draw', 'u0-slide', 'u0-share', 'u0-many'], build: ctx => buildShare(ctx, 'bag') },
  { id: 'u0-inside', unlocks: ['u0-inside'], build: ctx => buildInside(ctx, false) },
  { id: 'u0-flip', unlocks: ['u0-flip'], build: ctx => buildInside(ctx, true) },
  { id: 'u0-two', unlocks: ['u0-two', 'u0-several'], build: ctx => buildTwoBags(ctx, false) },
  { id: 'u0-rare', unlocks: ['u0-rare'], build: ctx => buildTwoBags(ctx, true) },
  { id: 'u0-chips', unlocks: ['u0-chips'], build: buildChips },
];
