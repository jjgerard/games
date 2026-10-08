// Part 2: Mixed-effects models. Same controller contract as part1.js.
// Fits shown in tables (printouts, shrinkage, standard errors) come from POOLS, made with real lme4 by tools/make-pools.R.

const PEOPLE = [
  { shape: 'circle', col: 'var(--p1)', cls: 'pc1', name: 'P1' }, { shape: 'sq', col: 'var(--p2)', cls: 'pc2', name: 'P2' },
  { shape: 'tri', col: 'var(--p3)', cls: 'pc3', name: 'P3' }, { shape: 'dia', col: 'var(--p4)', cls: 'pc4', name: 'P4' },
];
const personMarker = (i, r = 7) => marker(PEOPLE[i].shape, r, 'person ' + PEOPLE[i].cls);
const personIcon = (i, size = 22) => `<svg width="${size}" height="${size}" viewBox="-12 -12 24 24" aria-hidden="true">${personMarker(i, 8).outerHTML}</svg>`;
const poolPick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Level 8: Why not just average?
// ---------------------------------------------------------------------------
function buildAvgTutM(ctx) {
  ctx.setPrompt('Each row is one person; each dot is one answer. Tap the flashing person.');
  const rows = PersonRows([{ label: 'P1', n: 5 }, { label: 'P2', n: 5 }, { label: 'P3', n: 5 }], { flashIdx: 1, only: 1, onPick: i => { if (i === 1) ctx.complete('Those five dots all came from one person. They are not five independent pieces of evidence about people.'); } });
  ctx.stage.append(rows.el);
  return { solve: () => rows.rows[1].click() };
}
function buildUnits(ctx) {
  const rng = ctx.rng, nA = U.int(rng, 2, 3), nB = U.int(rng, 2, 3), grp = U.pick(rng, ['A', 'B']);
  const people = [...Array.from({ length: nA }, (_, i) => ({ label: 'P' + (i + 1), n: U.int(rng, 3, 8), group: 'A' })), ...Array.from({ length: nB }, (_, i) => ({ label: 'P' + (nA + i + 1), n: U.int(rng, 3, 8), group: 'B' }))];
  const target = grp === 'A' ? nA : nB, dots = people.filter(p => p.group === grp).reduce((s, p) => s + p.n, 0);
  ctx.setPrompt(`Each row is one person. How many <b>independent people</b> are in group ${grp === 'A' ? 'A (orange circles)' : 'B (blue squares)'}?`);
  const rows = PersonRows(people), st = Stepper({ value: 0, min: 0, max: 40, label: `People in group ${grp}`, onChange: () => ctx.setReady(true) });
  ctx.stage.append(rows.el, st.el);
  return {
    check() { const ok = st.v === target; st.lock(); return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `Group ${grp} has ${target} people but ${dots} dots. The dots from one person move together, so the number of people is the number of independent units.` }; },
    solve() { st.set(target, true); }, solveWrong() { st.set(dots, true); }, info: { target, dots },
  };
}
function simpsonData(rng) {
  for (let t = 0; t < 400; t++) {
    const beta = U.pick(rng, [0.8, 1, 1.2]), gamma = U.uni(rng, 1.1, 1.5), cs = [2, 4, 6, 8], pts = [];
    cs.forEach((c, i) => { const level = 12 - gamma * c + U.normal(rng) * 0.3; const xs = [c - 1.5, c - 0.75, c, c + 0.75, c + 1.5]; pts.push({ x: xs, y: xs.map(x => level + beta * (x - c) + U.normal(rng) * 0.35) }); });
    const allx = pts.flatMap(p => p.x), ally = pts.flatMap(p => p.y), pooled = U.lm(allx, ally).b1;
    const within = U.mean(pts.map(p => U.lm(p.x, p.y).b1));
    if (Math.abs(within - pooled) >= 1.0) return { pts, pooled, within, allx, ally };
  }
}
function buildSimpson(ctx) {
  const D = simpsonData(ctx.rng);
  ctx.setPrompt('Four people, five points each. Drag the line\'s end to the trend that holds <b>within each person</b>.');
  const lo = Math.floor(Math.min(...D.ally) - 1), hi = Math.ceil(Math.max(...D.ally) + 1);
  const ch = Plot(ctx, { h: roomH(ctx, 0, 190, 300), left: 36, right: 14, top: 10, bottom: 32, xr: [0, 10], yr: [lo, hi], label: 'Points from four people against dose, and a line you tilt' });
  ch.axisY(gridTicks(lo, hi, 4)); ch.axisX([[0, '0'], [5, '5'], [10, '10']]);
  D.pts.forEach((p, i) => p.x.forEach((x, k) => { const g = ch.add(sv('g', { transform: `translate(${ch.X(x)},${ch.Y(p.y[k])})` }), ch.over); g.append(personMarker(i, 6)); }));
  const cx = U.mean(D.allx), cy = U.mean(D.ally), ln = ch.add(sv('line', { class: 'fitln' }));
  const out = ch.text(ch.left + 10, ch.top + 20, '', 'tx tb', 'start', ch.over);
  const yEnd = s => cy + s * (10 - cx);
  const h = hy(ch, ch.X(10), { name: 'Right end of the line', v: yEnd(0), min: lo + 0.5, max: hi - 0.5, step: 0.1, fmt: v => `slope ${f1((v - cy) / (10 - cx))}`,
    onChange: (v, u) => { const s = (v - cy) / (10 - cx); ln.setAttribute('x1', ch.X(0)); ln.setAttribute('y1', ch.Y(cy - s * cx)); ln.setAttribute('x2', ch.X(10)); ln.setAttribute('y2', ch.Y(v)); out.textContent = `slope ${f1(s)}`; if (u) ctx.setReady(true); } });
  ctx.stage.append(ch.svg); h.set(h.v);
  const tol = 0.3;
  return {
    check() {
      const s = (h.v - cy) / (10 - cx), ok = Math.abs(s - D.within) <= tol; h.lock();
      D.pts.forEach((p, i) => { const f = U.lm(p.x, p.y); ch.add(sv('line', { class: 'ownln', x1: ch.X(p.x[0]), x2: ch.X(p.x[4]), y1: ch.Y(f.b0 + f.b1 * p.x[0]), y2: ch.Y(f.b0 + f.b1 * p.x[4]), stroke: PEOPLE[i].col })); });
      const pl = U.lm(D.allx, D.ally); ch.add(sv('line', { class: 'avgln', x1: ch.X(0), x2: ch.X(10), y1: ch.Y(pl.b0), y2: ch.Y(pl.b0 + pl.b1 * 10) }));
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `Within each person the trend is about ${f1(D.within)} (thin lines). Pooling all dots as if independent gives ${f1(D.pooled)} (dashed): it mixes people up.` };
    },
    solve() { h.set(yEnd(D.within), true); }, solveWrong() { h.set(M.clamp(yEnd(D.pooled), lo + 0.5, hi - 0.5), true); }, info: { within: D.within, pooled: D.pooled, tol, start: yEnd(0), pts: D.pts },
  };
}

// ---------------------------------------------------------------------------
// Level 9: Design tables
// ---------------------------------------------------------------------------
const FACTOR_NAMES = [['Group', 'Task', 'G', 'T'], ['Section', 'Test', 'S', 'T'], ['Version', 'Time', 'V', 'T']];
// A design: which cells (person, column) hold data. Factors are 'within' or 'between'.
function makeDesign(rng, kind) {
  // columns for two factors: [F1L1 F2L1, F1L1 F2L2, F1L2 F2L1, F1L2 F2L2]; for one factor: [L1, L2]
  const two = kind !== 'one-within' && kind !== 'one-between';
  const cells = new Set(), P = 4;
  if (!two) {
    for (let p = 0; p < P; p++) if (kind === 'one-within') { cells.add(p + ':0'); cells.add(p + ':1'); } else cells.add(p + ':' + (p < 2 ? 0 : 1));
    return { two, cells, P, F1: kind === 'one-within' ? 'within' : 'between' };
  }
  const f1w = kind === 'both-within' || kind === 'f1-within', f2w = kind === 'both-within' || kind === 'f2-within';
  for (let p = 0; p < P; p++) {
    const g = p < 2 ? 0 : 1, t = p % 2;  // between factors: group by block, task alternating
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if ((f1w || a === g) && (f2w || b === t)) cells.add(p + ':' + (a * 2 + b));
  }
  return { two, cells, P, F1: f1w ? 'within' : 'between', F2: f2w ? 'within' : 'between' };
}
function describeDesign(D, names, kind) {
  const [A, B] = names;
  if (!D.two) return D.F1 === 'within' ? `Everyone does both levels of ${A}.` : `${A}: P1, P2 do level 1; P3, P4 do level 2.`;
  const part1 = D.F1 === 'within' ? `${A} is <b>within</b> people.` : `${A} is <b>between</b> people (P1, P2 in 1; P3, P4 in 2).`;
  const part2 = D.F2 === 'within' ? `${B} is <b>within</b> people.` : `${B} is <b>between</b> people (P1, P3 do 1; P2, P4 do 2).`;
  return `${part1} ${part2}`;
}
function gridSpec(D, names) {
  const [A, B, a, b] = names;
  if (!D.two) return { cols: [`${a}1`, `${a}2`], colGroups: null, label: A };
  return { cols: [`${b}1`, `${b}2`, `${b}1`, `${b}2`], colGroups: [{ label: `${a}1`, span: 2 }, { label: `${a}2`, span: 2 }] };
}
function buildGridTut(ctx) {
  ctx.setPrompt('A design table: a row per person, a column per condition. Tap the flashing cell: P1 was tested in condition A.');
  const g = DesignGrid({ rows: ['P1', 'P2'], cols: ['A', 'B'], tap: true, flashCell: [0, 0], tapOnly: [0, 0], caption: 'Design table', onTap: () => { g.lock(); ctx.complete('A filled cell means that person has data in that condition. P1 in both A and B would mean the condition is within people.'); } });
  ctx.stage.append(g.el);
  return { solve: () => g.toggle(0, 0, true) };
}
const DESIGN_KINDS = ['one-within', 'one-between', 'f1-within', 'f2-within', 'both-within', 'both-between'];
function buildGridFill(ctx) {
  const rng = ctx.rng, kind = U.pick(rng, DESIGN_KINDS), names = U.pick(rng, FACTOR_NAMES), D = makeDesign(rng, kind), spec = gridSpec(D, names);
  const desc = describeDesign(D, names, kind);
  ctx.setPrompt(`${desc} Tap every cell that holds data.`);
  const rows = ['P1', 'P2', 'P3', 'P4'];
  const g = DesignGrid({ rows, cols: spec.cols, colGroups: spec.colGroups, tap: true, caption: 'Design table to fill in', onTap: () => ctx.setReady(g.filled().length > 0) });
  ctx.stage.append(g.el);
  const want = [...D.cells];
  return {
    check() {
      const got = g.filled(), ok = got.length === want.length && want.every(k => got.includes(k)); g.lock();
      for (const k of want) { const [r, c] = k.split(':').map(Number); if (!got.includes(k)) g.mark(r, c, 'wrongc'); else g.mark(r, c, 'right'); }
      for (const k of got) if (!want.includes(k)) { const [r, c] = k.split(':').map(Number); g.mark(r, c, 'wrongc'); }
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + 'A within-people factor puts one person in several of its levels. A between-people factor puts each person in only one.' };
    },
    solve() { for (const k of want) { const [r, c] = k.split(':').map(Number); if (!g.state[k]) g.toggle(r, c, true); } },
    solveWrong() { const k = want[0]; const [r, c] = k.split(':').map(Number); for (const w of want) { const [r2, c2] = w.split(':').map(Number); if (w !== k && !g.state[w]) g.toggle(r2, c2, true); } if (g.state[k]) g.toggle(r, c, true); },
    info: { kind, want },
  };
}
function buildGridLabel(ctx) {
  const rng = ctx.rng, kind = U.pick(rng, DESIGN_KINDS), names = U.pick(rng, FACTOR_NAMES), D = makeDesign(rng, kind), spec = gridSpec(D, names);
  ctx.setPrompt('Here is who has data where. For each factor: <b>within</b> people or <b>between</b> people?');
  const g = DesignGrid({ rows: ['P1', 'P2', 'P3', 'P4'], cols: spec.cols, colGroups: spec.colGroups, dots: (r, c) => D.cells.has(r + ':' + c) ? 1 : 0, cell: D.two ? 40 : 56, cellH: 32, caption: 'Observed design' });
  const facs = D.two ? [names[0], names[1]] : [names[0]], truth = D.two ? [D.F1, D.F2] : [D.F1], picks = [];
  // picking a label tints that factor's headers in the grid (blue = within, orange = between; the words are on the buttons too)
  const heads = D.two ? [[...g.el.querySelectorAll('.dg-grp')], [...g.el.querySelectorAll('.dg-col')]] : [[...g.el.querySelectorAll('.dg-col')]];
  const tint = (i, k) => heads[i].forEach(h => { h.classList.toggle('hw', k === 'within'); h.classList.toggle('hb', k === 'between'); });
  const rowsEl = facs.map((f, i) => { const c = Choices([{ key: 'within', label: 'Within' }, { key: 'between', label: 'Between' }], { cols: 2, onPick: k => { picks[i] = k; tint(i, k); ctx.setReady(facs.every((_, j) => picks[j])); } }); return { f, c, el: el('div', { class: 'facrow' }, el('span', { class: 'facname' }, f), c.el) }; });
  ctx.stage.append(g.el, ...rowsEl.map(r => r.el));
  return {
    check() {
      let all = true; rowsEl.forEach((r, i) => { const ok = picks[i] === truth[i]; all = all && ok; r.c.lock(); r.c.mark(truth[i], 'right'); if (!ok) r.c.mark(picks[i], 'wrongc'); });
      return { correct: all, message: (all ? 'Yes. ' : 'Not quite. ') + 'If a person has data under more than one level of a factor, it is within people. If each person sits in one level only, it is between.' };
    },
    solve() { rowsEl.forEach((r, i) => r.c.pick(truth[i], true)); }, solveWrong() { rowsEl.forEach((r, i) => r.c.pick(i === 0 ? (truth[0] === 'within' ? 'between' : 'within') : truth[i], true)); }, info: { kind, truth },
  };
}
// nested vs crossed: three small grids
function nestPatterns() {
  const R = 2, C = 6, mk = f => Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => f(r, c)));
  return { nested: mk((r, c) => (c < 3 ? r === 0 : r === 1)), crossed: mk(() => true), partial: mk((r, c) => r === 0 ? c < 4 : c > 1) };
}
const NEST_PAIRS = [['schools', 'classrooms'], ['hospitals', 'wards'], ['people', 'items'], ['people', 'sessions']];
function buildNest(ctx) {
  const rng = ctx.rng, [A, B] = U.pick(rng, NEST_PAIRS), pat = nestPatterns(), ask = U.pick(rng, ['nested', 'crossed']);
  const order = U.shuffle(rng, ['nested', 'crossed', 'partial']);
  ctx.setPrompt(`Rows are <b>${A}</b>, columns are <b>${B}</b>. Tap the grid where ${B} are <b>${ask}</b> ${ask === 'nested' ? 'in' : 'with'} ${A}.`);
  const wrap = el('div', { class: 'nestwrap', role: 'group', 'aria-label': 'Three grids' });
  const btns = {};
  order.forEach((k, i) => {
    const m = pat[k], b = el('button', { class: 'nestbtn', 'aria-pressed': 'false', 'aria-label': `Grid ${'ABC'[i]}: ${m.map((r, ri) => `row ${ri + 1} has data in columns ${r.map((v, c) => v ? c + 1 : null).filter(Boolean).join(', ')}`).join('; ')}`, onclick: () => pick(k) },
      el('span', { class: 'nestlet' }, 'ABC'[i]), el('span', { class: 'nestgrid', 'aria-hidden': 'true' }, ...m.flat().map(v => el('i', { class: v ? 'nc on' : 'nc' }))));
    wrap.append(b); btns[k] = b;
  });
  let chosen = null; const pick = k => { chosen = k; for (const [kk, b] of Object.entries(btns)) { b.classList.toggle('on', kk === k); b.setAttribute('aria-pressed', String(kk === k)); } ctx.setReady(true); };
  ctx.stage.append(wrap);
  return {
    check() { const ok = chosen === ask; for (const b of Object.values(btns)) b.disabled = true; btns[ask].classList.add('right'); if (!ok) btns[chosen].classList.add('wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + { nested: `Nested: each ${B.slice(0, -1)} appears under only one of the ${A}, so the blocks sit apart.`, crossed: `Crossed: every ${A.slice(0, -1)} is paired with every ${B.slice(0, -1)}, so the grid is full.` }[ask] + ' The third grid is partly crossed: neither.' }; },
    solve() { pick(ask); }, solveWrong() { pick(order.find(k => k !== ask)); }, info: { ask, order },
  };
}

// ---------------------------------------------------------------------------
// Level 10: Random intercepts and shrinkage
// ---------------------------------------------------------------------------
function interceptData(rng, n) {
  for (let t = 0; t < 400; t++) {
    const b = U.pick(rng, [0.6, 0.8, -0.6, -0.8]), offs = U.shuffle(rng, [-3.2, -1.1, 1.0, 3.1].slice(0, n === 1 ? 1 : n === 3 ? 4 : 4)).slice(0, n).map(v => v + U.uni(rng, -0.25, 0.25));
    const pts = offs.map(a => { const xs = [0.7, 1.9, 3.1, 4.3]; return { x: xs, y: xs.map(x => 5 + a + b * x + U.normal(rng) * 0.35) }; });
    // common slope by the within-person estimator (what lm(y ~ x + id) gives), then each person's own offset
    let sxy = 0, sxx = 0; pts.forEach(p => { const mx = U.mean(p.x), my = U.mean(p.y); p.x.forEach((x, i) => { sxy += (x - mx) * (p.y[i] - my); sxx += (x - mx) ** 2; }); });
    const bh = sxy / sxx, own = pts.map(p => U.mean(p.y) - bh * U.mean(p.x)), grand = U.mean(own);
    if (n === 1 || own.every((a, i) => own.every((c, j) => i === j || Math.abs(a - c) > 1.6))) return { pts, bh, own, grand };
  }
}
function personChart(ctx, pts, { bh, grand, lo, hi, h = roomH(ctx, 0, 190, 300), n = pts.length, labels = true } = {}) {
  const ch = Plot(ctx, { h, left: 36, right: 40, top: 10, bottom: 32, xr: [0, 5], yr: [lo, hi], label: 'People\'s points against x, with the group line' });
  ch.axisY(gridTicks(lo, hi, 4)); ch.axisX([[0, '0'], [2, '2'], [4, '4']]);
  ch.line(0, grand, 5, grand + bh * 5, 'groupln');
  pts.forEach((p, i) => p.x.forEach((x, k) => { const g = ch.add(sv('g', { transform: `translate(${ch.X(x)},${ch.Y(p.y[k])})` }), ch.over); g.append(personMarker(i, 6)); }));
  return ch;
}
function buildRITut(ctx) {
  const D = { pts: [{ x: [0.7, 1.9, 3.1, 4.3], y: [8.2, 8.9, 9.8, 10.6] }], bh: 0.7, grand: 6.2 }; D.own = [D.pts[0].y.reduce((a, b) => a + b) / 4 - 0.7 * 2.5];
  ctx.setPrompt('This person sits above the group line. Drag the flashing handle up until their line runs through their points.');
  const ch = personChart(ctx, D.pts, { bh: D.bh, grand: D.grand, lo: 4, hi: 12 });
  const ln = ch.add(sv('line', { class: 'ownln thick', stroke: PEOPLE[0].col })), tol = 0.5;
  const h = hy(ch, ch.X(5), { name: 'Person P1 line height', v: D.grand + D.bh * 5, min: 4.5, max: 11.5, step: 0.1, pulse: true, fmt: v => `height ${f1(v)}`,
    onChange: v => { const a = v - D.bh * 5; ln.setAttribute('x1', ch.X(0)); ln.setAttribute('y1', ch.Y(a)); ln.setAttribute('x2', ch.X(5)); ln.setAttribute('y2', ch.Y(v)); if (Math.abs(a - D.own[0]) <= tol) { h.lock(); ctx.complete('That is a random intercept: one person\'s whole line sits higher or lower than the group line, with the same slope.'); } } });
  ctx.stage.append(ch.svg); h.set(h.v);
  return { solve: () => h.set(D.own[0] + D.bh * 5, true) };
}
function buildRIMatch(ctx) {
  const rng = ctx.rng, D = interceptData(rng, 3), n = 3;
  ctx.setPrompt('Each person gets their own starting height, with the same slope. Drag each line\'s end to run through that person\'s points.');
  const ys = D.pts.flatMap(p => p.y), lo = Math.floor(Math.min(...ys, D.grand) - 2), hi = Math.ceil(Math.max(...ys, D.grand + D.bh * 5) + 2);
  const ch = personChart(ctx, D.pts, { bh: D.bh, grand: D.grand, lo, hi });
  const hs = [], lns = [];
  const startOff = U.shuffle(rng, [-2.6, 0, 2.6]);
  D.pts.forEach((p, i) => {
    const ln = ch.add(sv('line', { class: 'ownln thick', stroke: PEOPLE[i].col })); lns.push(ln);
    const a0 = D.grand + startOff[i];
    hs.push(hy(ch, ch.X(5) + 0, { name: `Person ${PEOPLE[i].name} line`, v: a0 + D.bh * 5, min: lo + 0.5, max: hi - 0.5, step: 0.1, anywhere: false, shape: personMarker(i, 11), fmt: v => `height ${f1(v)}`,
      onChange: (v, u) => { const a = v - D.bh * 5; ln.setAttribute('x1', ch.X(0)); ln.setAttribute('y1', ch.Y(a)); ln.setAttribute('x2', ch.X(5)); ln.setAttribute('y2', ch.Y(v)); if (u && hs.every(x => x.touched)) ctx.setReady(true); } }));
  });
  ctx.stage.append(ch.svg); hs.forEach(h => h.set(h.v));
  const tol = 0.8;
  return {
    check() { const ok = hs.every((h, i) => Math.abs(h.v - D.bh * 5 - D.own[i]) <= tol); hs.forEach(h => h.lock()); D.own.forEach((a, i) => ch.add(sv('circle', { class: 'ringm good', r: 15, cx: ch.X(5), cy: ch.Y(a + D.bh * 5) }), ch.over));
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + 'Each person\'s own intercept is how far their line sits from the group line. A random-intercept model treats these gaps as draws from one spread of people.' }; },
    solve() { hs.forEach((h, i) => h.set(D.own[i] + D.bh * 5, true)); }, solveWrong() { hs.forEach((h, i) => h.set(M.clamp(D.grand + D.bh * 5, lo + 0.5, hi - 0.5) + (i === 0 ? 0 : 0), true)); },
    info: { own: D.own, grand: D.grand, bh: D.bh, tol, starts: startOff, pts: D.pts },
  };
}
function buildPull(ctx) {
  const rng = ctx.rng, S = poolPick(rng, POOLS.shrink), order = U.shuffle(rng, [0, 1, 2, 3]); // order[k] = which stored person is shown as person k
  const people = order.map(i => ({ pts: S.pts[i], own: S.own[i], blup: S.blup[i], n: S.n[i], i }));
  const ys = people.flatMap(p => p.pts.y), lo = Math.floor(Math.min(...ys, S.a) - 1), hi = Math.ceil(Math.max(...ys, S.a + S.b * 5) + 1);
  ctx.setPrompt('Slide to <b>Mixed model</b>. Then tap the person whose line <b>moved the most</b>.');
  const hh = roomH(ctx, 64 + 48 + 24, 130, 250);
  const ch = Plot(ctx, { h: hh, left: 34, right: 12, top: 8, bottom: 28, xr: [0, 5], yr: [lo, hi], label: 'People\'s points and lines; the slider moves each line from their own data toward the mixed model' });
  ch.axisY(gridTicks(lo, hi, 4)); ch.axisX([[0, '0'], [2, '2'], [4, '4']]);
  ch.line(0, S.a, 5, S.a + S.b * 5, 'groupln');
  const lns = people.map((p, k) => { p.pts.x.forEach((x, j) => { const g = ch.add(sv('g', { transform: `translate(${ch.X(x)},${ch.Y(p.pts.y[j])})` }), ch.over); g.append(personMarker(k, 6)); }); return ch.add(sv('line', { class: 'ownln thick', stroke: PEOPLE[k].col })); });
  const paint = t => people.forEach((p, k) => { const a = p.own + t * (p.blup - p.own); lns[k].setAttribute('x1', ch.X(0)); lns[k].setAttribute('y1', ch.Y(a)); lns[k].setAttribute('x2', ch.X(5)); lns[k].setAttribute('y2', ch.Y(a + S.b * 5)); });
  let picked = null; const upd = () => ctx.setReady(sl.get() >= 0.95 && picked != null);
  const sl = RangeSlider({ min: 0, max: 1, step: 0.01, value: 0, label: 'From own data only to mixed model', left: 'Own data only', right: 'Mixed model', onChange: v => { paint(v); upd(); }, flash: false });
  const tiles = Choices(people.map((p, k) => ({ key: String(k), html: `${personIcon(k)} ${PEOPLE[k].name}`, aria: `${PEOPLE[k].name}, ${p.n} points` })), { cols: 4, onPick: k => { picked = +k; upd(); } });
  ctx.stage.append(ch.svg, sl.el, tiles.el); paint(0);
  const moves = people.map(p => Math.abs(p.blup - p.own)), ans = order.indexOf(S.ans);
  return {
    check() {
      const ok = picked === ans; sl.set(1); sl.lock(); tiles.lock(); tiles.mark(String(ans), 'right'); if (!ok) tiles.mark(String(picked), 'wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `${PEOPLE[ans].name} had ${people[ans].n} point${people[ans].n > 1 ? 's' : ''}. A person with few points that sit far from the group is pulled hardest: the model trusts the group more than a few noisy points.` };
    },
    solve() { sl.set(1); tiles.pick(String(ans), true); }, solveWrong() { sl.set(1); tiles.pick(String((ans + 1) % 4), true); },
    info: { ans, n: people.map(p => p.n), far: people.map(p => Math.abs(p.own - S.a)), moves },
  };
}

// ---------------------------------------------------------------------------
// Level 11: Random-effects notation
// ---------------------------------------------------------------------------
const FORM_PREFIX = 'y ~ cond +';
function buildFormTut(ctx) {
  ctx.setPrompt('Participants (<code>subj</code>) differ in baseline. Tap the flashing tile to say so in the formula.');
  const tb = TileBuilder({ pool: [{ key: 'a', text: '(1 | subj)' }], prefix: FORM_PREFIX, flashKey: 'a', label: 'Formula', onChange: c => { if (c.length) { tb.lock(); ctx.complete('(1 | subj) reads: an intercept (1) that varies by (|) subj. Everyone gets their own baseline.'); } } });
  ctx.stage.append(tb.el, note('<b>1</b> is the intercept. After the bar <b>|</b> comes the thing that gets its own value.'));
  return { solve: () => tb.add('a', true) };
}
const BUILD_BANK = [
  { d: 'Participants (<code>subj</code>) differ in baseline.', tiles: ['(1 | subj)', '(1 | cond)', '(subj | 1)', '(1 | subj:cond)'], want: ['(1 | subj)'] },
  { d: 'Everyone reads every <b>item</b>. Participants (<code>subj</code>) and items both differ in baseline.', tiles: ['(1 | subj)', '(1 | item)', '(1 | subj:item)', '(subj | item)'], want: ['(1 | subj)', '(1 | item)'] },
  { d: '<b>cond</b> is within people. People differ in baseline and in cond effect; the two may be related.', tiles: ['(1 + cond | subj)', '(1 | subj)', '(0 + cond | subj)', '(1 | cond)'], want: ['(1 + cond | subj)'] },
  { d: 'As before, but baseline and effect of cond are <b>unrelated</b> across people.', tiles: ['(1 | subj)', '(0 + cond | subj)', '(1 + cond | subj)', '(1 | cond)'], want: ['(1 | subj)', '(0 + cond | subj)'] },
  { d: '<b>Classrooms</b> nest in <b>schools</b> (class labels repeat in every school). Both differ in baseline.', tiles: ['(1 | school)', '(1 | school:classroom)', '(1 | classroom)', '(1 | school/classroom)'], want: ['(1 | school)', '(1 | school:classroom)'], alt: [['(1 | school/classroom)']] },
  { d: '<b>cond</b> is within people and items. Both differ in baseline and in cond effect.', tiles: ['(1 + cond | subj)', '(1 + cond | item)', '(1 | subj)', '(cond | subj:item)'], want: ['(1 + cond | subj)', '(1 + cond | item)'] },
];
function buildFormBuild(ctx) {
  const rng = ctx.rng, B = U.pick(rng, BUILD_BANK), tiles = U.shuffle(rng, B.tiles);
  ctx.setPrompt(`${B.d} Build the formula.`);
  const tb = TileBuilder({ pool: tiles.map(t => ({ key: t, text: t })), prefix: FORM_PREFIX, onChange: c => ctx.setReady(c.length > 0), label: 'Formula' });
  ctx.stage.append(tb.el);
  const isRight = c => U.sameFormula(c, B.want) || (B.alt || []).some(a => U.sameFormula(c, a));
  return {
    check() { const ok = isRight(tb.chosen); tb.lock(); const keep = tb.chosen.slice();
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `Needed: ${B.want.join(' + ')}${B.alt ? ' (or (1 | school/classroom), which means the same)' : ''}. A random term is (what varies | what it varies by).` }; },
    solve() { tb.set(B.want); }, solveWrong() { tb.set(B.want.length > 1 ? B.want.slice(0, 1) : [B.tiles.find(t => !B.want.includes(t))]); }, info: { want: B.want, tiles: B.tiles, shown: tiles },
  };
}
// formula -> which variance components does it create
const READ_BANK = [
  ['(1 | subj)', '(1 | item)'], ['(1 + cond | subj)', '(1 | item)'], ['(1 | subj)', '(1 | subj:item)'], ['(1 + cond | subj)', '(1 + cond | item)'],
  ['(1 | subj)', '(0 + cond | subj)'], ['(1 | subj)', '(1 | item)', '(1 | subj:item)'], ['(cond | subj)'],
];
const COMPONENTS = [
  { key: 'pi', label: 'Participant baselines' }, { key: 'ii', label: 'Item baselines' }, { key: 'pii', label: 'Participant × item baselines' },
  { key: 'ps', label: 'Participant effects of cond' }, { key: 'is', label: 'Item effects of cond' },
];
function componentsOf(terms) {
  const set = new Set();
  for (const t of terms) for (const c of U.parseTerm(t)) {
    const [g, tt] = c.split('::'), parts = tt.split(',');
    if (g === 'subj') { if (parts.includes('1')) set.add('pi'); if (parts.includes('cond')) set.add('ps'); }
    if (g === 'item') { if (parts.includes('1')) set.add('ii'); if (parts.includes('cond')) set.add('is'); }
    if (g === 'subj:item') { if (parts.includes('1')) set.add('pii'); }
  }
  return [...set].sort();
}
function buildFormRead(ctx) {
  const rng = ctx.rng, terms = U.pick(rng, READ_BANK), want = componentsOf(terms);
  ctx.setPrompt(`<code>y ~ cond + ${terms.join(' + ')}</code><br>Tick every <b>source of variation</b> it gives the model.`);
  const chips = ChipSet(COMPONENTS.map(c => ({ key: c.key, label: c.label })), { cols: 1, label: 'Variance components', onChange: () => ctx.setReady(true) });
  ctx.stage.append(chips.el);
  return {
    check() { const got = chips.keys().sort(), ok = JSON.stringify(got) === JSON.stringify(want); chips.lock(); for (const k of want) chips.btns[k].classList.add('right'); for (const k of got) if (!want.includes(k)) chips.btns[k].classList.add('wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + 'Each term (what varies | what it varies by) adds one variance per thing after the bar, plus a correlation when two things share a bar.' }; },
    solve() { chips.setAll(Object.fromEntries(want.map(k => [k, true]))); }, solveWrong() { chips.setAll(Object.fromEntries(COMPONENTS.map(c => [c.key, !want.includes(c.key)]))); }, info: { want, terms },
  };
}
const TYPO_BANK = [
  { bad: '(subj | 1)', why: 'The two sides are swapped. What varies goes before the bar, what it varies by goes after: (1 | subj). lme4 stops with a cryptic error.' },
  { bad: '(1, cond | subj)', why: 'A comma is not allowed there: R cannot even read it. Join terms with +: (1 + cond | subj).' },
  { bad: '1 | subj', why: 'Without brackets the bar splits the whole formula, so cond becomes random-only and its fixed effect disappears. R does not stop you. Write (1 | subj).' },
  { bad: '(1 | cond)', why: 'cond has two levels you chose, and it is already a fixed effect. A random effect is for many sampled levels like subj. lme4 warns the fit is not uniquely determined.' },
  { bad: '(1 * cond | subj)', why: 'R reads 1 * cond as just 1, so the random slope silently vanishes: no error, only an intercept. Write (1 + cond | subj).' },
];
const GOOD_TERMS = ['(1 | subj)', '(1 + cond | subj)', '(1 | item)', '(0 + cond | subj)'];
function buildTypo(ctx) {
  const rng = ctx.rng, T = U.pick(rng, TYPO_BANK), good = U.pick(rng, GOOD_TERMS);
  const rest = U.shuffle(rng, [{ t: good, bad: false }, { t: T.bad, bad: true }]), parts = [{ t: 'y ~ cond', bad: false }, ...rest];
  ctx.setPrompt('A model is its parts added together. One part is <b>wrong</b>. Tap it.');
  const tiles = Choices(parts.map((p, i) => ({ key: String(i), label: p.t })), { cols: 1, cls: 'mono left', onPick: () => ctx.setReady(true) });
  const ans = parts.findIndex(p => p.bad);
  ctx.stage.append(tiles.el);
  return {
    check() { const ok = +tiles.key === ans; tiles.lock(); tiles.mark(String(ans), 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc'); return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + T.why }; },
    solve() { tiles.pick(String(ans), true); }, solveWrong() { tiles.pick(String((ans + 1) % 3), true); }, info: { ans, bad: T.bad, parts: parts.map(x => x.t) },
  };
}
// random-effects table: which row does a term make?
const VC_FORMS = [
  { f: ['(1 + cond | subj)', '(1 | item)'], rows: [['subj', 'Intercept', 0], ['', 'cond', 1], ['item', 'Intercept', 2], ['Residual', '', -1]], terms: [[0, [0, 1]], [1, [2]]] },
  { f: ['(1 | subj)', '(1 | item)'], rows: [['subj', 'Intercept', 0], ['item', 'Intercept', 1], ['Residual', '', -1]], terms: [[0, [0]], [1, [1]]] },
  { f: ['(1 | subj)', '(0 + cond | subj)'], rows: [['subj', 'Intercept', 0], ['', 'cond', 1], ['Residual', '', -1]], terms: [[0, [0]], [1, [1]]] },
  { f: ['(1 + cond | subj)'], rows: [['subj', 'Intercept', 0], ['', 'cond', 1], ['Residual', '', -1]], terms: [[0, [0, 1]]] },
];
function buildVCTable(ctx) {
  const rng = ctx.rng, V = U.pick(rng, VC_FORMS), askResid = rng() < 0.22, ti = U.int(rng, 0, V.terms.length - 1), term = V.terms[ti];
  const hasCorr = V.f.some(t => t.includes('1 + cond'));
  const sds = V.rows.map(() => M.round(U.uni(rng, 0.3, 3.2), 2)), corr = M.round(U.pick(rng, [-1, 1]) * U.uni(rng, 0.2, 0.7), 2);
  const form = V.f.map((t, i) => (!askResid && i === ti) ? `<u>${t}</u>` : t).join(' + ');
  ctx.setPrompt(`<code>y ~ cond + ${form}</code><br>` + (askResid ? 'Which row is made by <b>no term</b> in the formula?' : 'Tap the row the <u>underlined</u> term makes.'));
  const cols = [{ label: 'Name' }, { label: 'SD', aria: 'Standard deviation' }, ...(hasCorr ? [{ label: 'Corr', aria: 'Correlation' }] : [])];
  const tb = ModelTable({ cols, rows: V.rows.map((r, i) => ({ name: r[0], aria: `${r[0] || 'same group'} ${r[1] || 'residual'}`, cells: [r[1], f2(sds[i]), ...(hasCorr ? [r[1] === 'cond' && r[0] === '' && V.f.some(t => t.includes('1 + cond')) ? f2(corr) : ''] : [])] })), mode: 'row', caption: 'Random effects', widths: hasCorr ? [24, 30, 20, 26] : [24, 36, 40], can: (ri, ci) => ci >= 0, onTap: () => ctx.setReady(true) });
  ctx.stage.append(tb.el);
  const want = askResid ? [V.rows.length - 1] : term[1].map(i => V.rows.findIndex(r => r[2] === i && r[1] !== ''));
  return {
    check() { const ok = want.includes(tb.sel[0]); tb.lock(); want.forEach(r => tb.markRow(r, 'right'));
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (askResid ? 'The Residual row is the leftover noise within a person. No random term makes it.' : 'A term that puts two things before the bar makes a row for each, plus a correlation. A term with one thing makes one row.') }; },
    solve() { tb.pick(want[0], 0); }, solveWrong() { tb.pick([...V.rows.keys()].find(r => !want.includes(r)), 0); }, info: { want, askResid, nrows: V.rows.length },
  };
}

// ---------------------------------------------------------------------------
// Level 12: Estimable or not?
// ---------------------------------------------------------------------------
function buildEstTut(ctx) {
  ctx.setPrompt('One answer per person per item. Tap <b>Run each cell twice</b> and watch the chip.');
  const holder = el('div', { class: 'holder' }); let twice = false;
  const chip = el('div', { class: 'estchip off' }), draw = () => {
    holder.replaceChildren(DesignGrid({ rows: ['P1', 'P2', 'P3'], cols: ['I1', 'I2', 'I3'], dots: () => (twice ? 2 : 1), cell: 52, caption: 'Participant by item design' }).el);
    chip.className = 'estchip ' + (twice ? 'on' : 'off'); chip.innerHTML = `<code>(1 | subj:item)</code> ${twice ? '✓ can be estimated' : '✗ cannot be estimated'}`;
  };
  const btn = el('button', { class: 'bigbtn flash', style: 'align-self:center', onclick: () => { twice = true; draw(); btn.disabled = true; btn.classList.remove('flash'); ctx.complete('With one answer per cell, "participant by item" is just the leftover noise: nothing repeats to measure it. Repeats inside a cell make it estimable.'); } }, 'Run each cell twice');
  ctx.stage.append(holder, chip, btn); draw();
  return { solve: () => btn.click() };
}
// designs as a counts matrix [person][item]
function estDesign(rng) {
  const kind = U.pick(rng, ['one', 'two', 'unique', 'oneper']);
  let m, P, I;
  if (kind === 'one' || kind === 'two') { P = U.int(rng, 3, 4); I = U.int(rng, 3, 4); m = Array.from({ length: P }, () => Array(I).fill(kind === 'one' ? 1 : 2)); }
  else if (kind === 'unique') { P = 3; I = 6; m = Array.from({ length: P }, (_, p) => Array.from({ length: I }, (_, i) => (Math.floor(i / 2) === p ? 1 : 0))); }
  else { P = 4; I = 2; m = Array.from({ length: P }, (_, p) => Array.from({ length: I }, (_, i) => (i === (p < 2 ? 0 : 1) ? 1 : 0))); }
  return { kind, m, P, I };
}
const estFor = m => {
  const rows = m.map(r => M.sum(r)).filter(x => x > 0), cols = m[0].map((_, c) => M.sum(m.map(r => r[c]))).filter(x => x > 0), cells = m.flat().filter(x => x > 0);
  return { p: U.groupingOK(rows), i: U.groupingOK(cols), pi: U.groupingOK(cells) };
};
function buildEstCells(ctx) {
  const rng = ctx.rng, D = estDesign(rng), est = estFor(D.m);
  ctx.setPrompt('Rows are participants, columns items, dots answers. Tick every term this design <b>can estimate</b>.');
  const cell = Math.floor(Math.min(46, (stagePad(ctx.stage) - 40 - 4 * (D.I - 1)) / D.I));
  const g = DesignGrid({ rows: Array.from({ length: D.P }, (_, i) => 'P' + (i + 1)), cols: Array.from({ length: D.I }, (_, i) => 'I' + (i + 1)), dots: (r, c) => D.m[r][c], cell, cellH: 30, rowW: 36, caption: 'Participant by item design' });
  const chips = ChipSet([{ key: 'p', label: '(1 | subj)' }, { key: 'i', label: '(1 | item)' }, { key: 'pi', label: '(1 | subj:item)' }], { cols: 1, label: 'Terms', onChange: () => ctx.setReady(true) });
  chips.el.classList.add('monochips');
  ctx.stage.append(g.el, chips.el);
  const want = Object.keys(est).filter(k => est[k]).sort();
  return {
    check() { const got = chips.keys().sort(), ok = JSON.stringify(got) === JSON.stringify(want); chips.lock(); for (const k of ['p', 'i', 'pi']) chips.btns[k].classList.add(est[k] ? 'right' : 'wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + 'A term needs some group seen more than once. Otherwise groups equal answers and lme4 refuses.' }; },
    solve() { chips.setAll(Object.fromEntries(want.map(k => [k, true]))); }, solveWrong() { chips.setAll(Object.fromEntries(['p', 'i', 'pi'].map(k => [k, !est[k]]))); }, info: { kind: D.kind, est, want, m: D.m },
  };
}
function buildEstSlope(ctx) {
  const rng = ctx.rng, kind = U.pick(rng, ['within2', 'within3', 'within1', 'between']), P = 4;
  const counts = Array.from({ length: P }, (_, p) => kind === 'between' ? [p % 2 === 0 ? 3 : 0, p % 2 === 0 ? 0 : 3] : (n => [n, n])(kind === 'within1' ? 1 : kind === 'within2' ? 2 : 3));
  ctx.setPrompt('Rows are participants, columns are the two levels of <b>condition</b>. Tick every term this design <b>can estimate</b>.');
  const g = DesignGrid({ rows: ['P1', 'P2', 'P3', 'P4'], cols: ['cond A', 'cond B'], dots: (r, c) => counts[r][c], cell: 70, cellH: 38, rowW: 40, caption: 'Participant by condition design' });
  const chips = ChipSet([{ key: 'int', label: '(1 | subj)' }, { key: 'slope', label: '(1 + cond | subj)' }], { cols: 1, label: 'Terms', onChange: () => ctx.setReady(true) });
  chips.el.classList.add('monochips');
  ctx.stage.append(g.el, chips.el);
  const est = { int: true, slope: kind === 'within2' || kind === 'within3' }, want = Object.keys(est).filter(k => est[k]).sort();
  return {
    check() { const got = chips.keys().sort(), ok = JSON.stringify(got) === JSON.stringify(want); chips.lock(); for (const k of ['int', 'slope']) chips.btns[k].classList.add(est[k] ? 'right' : 'wrongc');
      const why = { within2: 'Each person has repeats in both conditions, so both their baseline and their condition effect can be measured.', within3: 'Each person has repeats in both conditions, so both their baseline and their condition effect can be measured.', within1: 'One answer per person per condition: a person\'s effect and the noise are the same thing. lme4 stops: observations <= random effects.', between: 'Each person is in one condition only, so no one has an effect of condition to vary. lme4 may still fit it, but the slope variance means nothing.' }[kind];
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + why }; },
    solve() { chips.setAll(Object.fromEntries(want.map(k => [k, true]))); }, solveWrong() { chips.setAll(Object.fromEntries(['int', 'slope'].map(k => [k, !est[k]]))); }, info: { kind, est, want, counts },
  };
}

// ---------------------------------------------------------------------------
// Level 13: Random slopes
// ---------------------------------------------------------------------------
function buildSlopeTut(ctx) {
  const D = { pts: [{ x: [0.8, 1.8, 2.8, 3.8, 4.6], y: [5.4, 7.1, 8.3, 10.2, 11.1] }] };
  const a = 5, bgrp = 0.6, bown = 1.4, lo = 2, hi = 14;
  ctx.setPrompt('This person\'s effect of x is bigger than the group\'s. Drag the flashing handle to tilt their line through their points.');
  const ch = Plot(ctx, { h: roomH(ctx, 0, 190, 280), left: 36, right: 14, top: 10, bottom: 32, xr: [0, 5], yr: [lo, hi], label: 'One person\'s points and the group line' });
  ch.axisY(gridTicks(lo, hi, 4)); ch.axisX([[0, '0'], [2, '2'], [4, '4']]); ch.line(0, a, 5, a + bgrp * 5, 'groupln');
  D.pts[0].x.forEach((x, k) => { const g = ch.add(sv('g', { transform: `translate(${ch.X(x)},${ch.Y(D.pts[0].y[k])})` }), ch.over); g.append(personMarker(0, 6)); });
  const ln = ch.add(sv('line', { class: 'ownln thick', stroke: PEOPLE[0].col }));
  const h = hy(ch, ch.X(5), { name: 'Person P1 line height at x = 5', v: a + bgrp * 5, min: 3, max: 13.5, step: 0.1, pulse: true, fmt: v => `slope ${f1((v - a) / 5)}`,
    onChange: v => { ln.setAttribute('x1', ch.X(0)); ln.setAttribute('y1', ch.Y(a)); ln.setAttribute('x2', ch.X(5)); ln.setAttribute('y2', ch.Y(v)); if (Math.abs((v - a) / 5 - bown) <= 0.2) { h.lock(); ctx.complete('That is a random slope: this person\'s effect of x is steeper than the group\'s. The model lets each person tilt.'); } } });
  ctx.stage.append(ch.svg); h.set(h.v);
  return { solve: () => h.set(a + bown * 5, true) };
}
function buildSlopeShape(ctx) {
  const rng = ctx.rng, kind = U.pick(rng, ['int', 'slope', 'both']), n = 5, b = 0.8;
  const lines = Array.from({ length: n }, (_, i) => { const z = i - 2; return kind === 'int' ? { a: 6 + z * 1.3, s: b } : kind === 'slope' ? { a: 6, s: b + z * 0.4 } : { a: 6 + [1.4, -1.3, 0.6, -0.5, 1.6][i], s: b + [-0.7, 0.5, -0.2, 0.8, 0][i] }; });
  ctx.setPrompt('Each thin line is one person. <b>What varies from person to person?</b> Tap the matching random term.');
  const lo = 2, hi = 15, ch = Plot(ctx, { h: roomH(ctx, 3 * 54 + 8, 140, 230), left: 36, right: 14, top: 8, bottom: 30, xr: [0, 5], yr: [lo, hi], label: `Five people's lines against x: ${{ int: 'parallel, different heights', slope: 'all start at the same height, different slopes', both: 'different heights and different slopes' }[kind]}` });
  ch.axisY([[4, '4'], [8, '8'], [12, '12']]); ch.axisX([[0, '0'], [2, '2'], [4, '4']]);
  lines.forEach((l, i) => ch.add(sv('line', { class: 'ownln', stroke: 'var(--ink2)', x1: ch.X(0), y1: ch.Y(l.a), x2: ch.X(5), y2: ch.Y(l.a + l.s * 5) })));
  ch.line(0, 6, 5, 6 + b * 5, 'groupln');
  const tiles = Choices([{ key: 'int', label: '(1 | subj)' }, { key: 'slope', label: '(0 + x | subj)' }, { key: 'both', label: '(1 + x | subj)' }], { cols: 1, cls: 'mono', onPick: () => ctx.setReady(true) });
  ctx.stage.append(ch.svg, tiles.el);
  return {
    check() { const ok = tiles.key === kind; tiles.lock(); tiles.mark(kind, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + { int: 'Parallel lines at different heights: only the intercepts vary.', slope: 'All lines start together at x = 0 and fan out: only the slopes vary.', both: 'Both heights and tilts differ: a random intercept and a random slope, which may be correlated.' }[kind] }; },
    solve() { tiles.pick(kind, true); }, solveWrong() { tiles.pick(kind === 'int' ? 'both' : 'int', true); }, info: { kind },
  };
}
function buildSlopeCost(ctx) {
  const rng = ctx.rng, wantKind = rng() < 0.5 ? 'wider' : 'same', C = poolPick(rng, POOLS.cost.filter(c => c.kind === wantKind)), A = { name: '(1 | id)', se: C.se1 }, B = { name: '(1 + cond | id)', se: C.se2 };
  const rowsOrder = rng() < 0.5 ? [A, B] : [B, A];
  ctx.setPrompt('Same data, two models. Each bar is the condition effect ± 2 standard errors. <b>Which would you trust</b>?');
  const mse = Math.max(C.se1, C.se2), lo = Math.floor(Math.min(0, C.eff - 2 * mse) - 0.5), hi = Math.ceil(C.eff + 2 * mse + 0.5);
  const ch = Plot(ctx, { h: 150, left: 14, right: 14, top: 4, bottom: 30, xr: [lo, hi], yr: [0, 1], label: `Two intervals for the same effect: ${A.name} gives ${f1(C.eff - 2 * A.se)} to ${f1(C.eff + 2 * A.se)}, ${B.name} gives ${f1(C.eff - 2 * B.se)} to ${f1(C.eff + 2 * B.se)}` });
  ch.axisX(gridTicks(lo, hi, hi - lo > 12 ? 4 : hi - lo > 6 ? 2 : 1), { y: 120 });
  ch.pline(ch.X(0), 6, ch.X(0), 120, 'zero');
  rowsOrder.forEach((r, i) => { const y = 24 + i * 52; ch.text(ch.left, y - 6, r.name, 'tx mono', 'start'); ch.pline(ch.X(C.eff - 2 * r.se), y + 12, ch.X(C.eff + 2 * r.se), y + 12, 'ci'); ch.pline(ch.X(C.eff - 2 * r.se), y + 3, ch.X(C.eff - 2 * r.se), y + 21, 'ci'); ch.pline(ch.X(C.eff + 2 * r.se), y + 3, ch.X(C.eff + 2 * r.se), y + 21, 'ci'); ch.add(sv('circle', { class: 'fixm', r: 7, cx: ch.X(C.eff), cy: y + 12 })); });
  const tiles = Choices([{ key: '0', label: 'Top bar' }, { key: '1', label: 'Bottom bar' }, { key: 'same', label: 'Same' }], { cols: 3, onPick: () => ctx.setReady(true) });
  ctx.stage.append(ch.svg, tiles.el, note('The vertical dashed line is 0: no effect.'));
  const ans = C.kind === 'same' ? 'same' : String(rowsOrder.indexOf(B));
  return {
    check() { const ok = tiles.key === ans; tiles.lock(); tiles.mark(ans, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (C.kind === 'same' ? 'Here people hardly differ in their effect, so the two models agree. A slope you do not need costs little.' : 'People differ in their effect of condition, and only the model with the random slope knows it. Without it the bar is too short and p-values look better than they should. Costly for this claim.') }; },
    solve() { tiles.pick(ans, true); }, solveWrong() { tiles.pick(ans === '0' ? '1' : '0', true); }, info: { kind: C.kind, ans, ratio: C.se2 / C.se1 },
  };
}

// ---------------------------------------------------------------------------
// Level 14: When the fit goes wrong
// ---------------------------------------------------------------------------
function reTable(entry, { onTap = () => {}, mode = 'cell', flash = null, tappable = (ri, ci) => ci >= 1, caption = 'Random effects' } = {}) {
  const rows = [], hasCorr = entry.re.length > 1;
  entry.re.forEach((r, i) => rows.push({ name: i === 0 ? r.grp : '', aria: `${r.grp} ${r.name}`, cells: [r.name, f2(r.sd), ...(hasCorr ? [i === 1 && r.corr != null ? (typeof r.corr === 'string' ? r.corr : f2(r.corr)) : ''] : [])] }));
  if (entry.resid != null) rows.push({ name: 'Residual', cells: ['', f2(entry.resid), ...(hasCorr ? [''] : [])] });
  const cols = [{ label: 'Name' }, { label: 'SD', aria: 'Standard deviation' }, ...(hasCorr ? [{ label: 'Corr', aria: 'Correlation' }] : [])];
  return ModelTable({ cols, rows, mode, flash, can: tappable, onTap, caption, widths: hasCorr ? [24, 30, 20, 26] : [26, 38, 36] });
}
function singularCell(entry) { // [row, col] to tap
  if (entry.why === 'corr') return [1, 2];
  const i = entry.re.findIndex(r => r.sd === 0); return [i, 1];
}
function buildSingTut(ctx) {
  const E = POOLS.outs.find(o => o.singular && o.why === 'corr' && o.re.length === 2 && typeof o.re[1].corr === 'number');
  ctx.setPrompt('R says: <b>boundary (singular) fit</b>. Tap the flashing number that shows why.');
  const tb = reTable(E, { flash: [1, 2], tappable: (ri, ci) => ri === 1 && ci === 2, onTap: () => { tb.lock(); ctx.complete(`A correlation of ${f2(E.re[1].corr)} between intercept and slope is on the edge of what is possible: the model has more parts than the data can support.`); } });
  ctx.stage.append(tb.el, el('div', { class: 'rmsg' }, 'boundary (singular) fit: see help(\'isSingular\')'));
  return { solve: () => tb.pick(1, 2) };
}
function buildSingular(ctx) {
  const rng = ctx.rng, sing = rng() < 0.5, E = poolPick(rng, POOLS.outs.filter(o => o.kind === 'lmer' && o.re.length === 2 && o.singular === sing));
  ctx.setPrompt('No warning is shown. Tap the number that would make lme4 call this fit <b>singular</b>, or tap "Nothing wrong".');
  const tb = reTable(E, { onTap: () => { none.classList.remove('on'); picked = 'cell'; ctx.setReady(true); }, tappable: (ri, ci) => ci >= 1 && ri < 2 && !(ci === 2 && ri === 0) });
  let picked = null; const none = el('button', { class: 'choice', onclick: () => { picked = 'none'; tb.sel = null; for (const b of Object.values(tb.cells)) { b.classList.remove('on'); } none.classList.add('on'); ctx.setReady(true); } }, 'Nothing wrong');
  ctx.stage.append(tb.el, none);
  const cell = sing ? singularCell(E) : null;
  const isRight = () => sing ? picked === 'cell' && tb.sel && (tb.sel[0] === cell[0] && tb.sel[1] === cell[1] || (E.why === 'var' && E.re[tb.sel[0]] && E.re[tb.sel[0]].sd === 0 && tb.sel[1] === 1)) : picked === 'none';
  return {
    check() { const ok = !!isRight(); tb.lock(); none.disabled = true; if (sing) tb.mark(cell[0], cell[1], 'right'); else none.classList.add('right');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (sing ? (E.why === 'corr' ? 'A correlation of ±1 means the intercept and slope are perfectly tied: the data cannot support both. That is singular.' : 'A variance of 0 is on the boundary: this part of the model found no variation. That is singular.') : 'Every SD is clearly above 0 and the correlation is not near ±1. Nothing here is on the boundary.') }; },
    solve() { if (sing) tb.pick(cell[0], cell[1]); else none.click(); }, solveWrong() { if (sing) none.click(); else tb.pick(0, 1); }, info: { sing, why: E.why },
  };
}
// the empty-cell hunt
function buildEmpty(ctx) {
  const rng = ctx.rng, nEmpty = U.pick(rng, [1, 2]), all = Array.from({ length: 8 }, (_, i) => i);
  const empties = U.shuffle(rng, all).slice(0, nEmpty).sort((a, b) => a - b);
  // index i: a = i >> 2 (0/1), c = (i >> 1) & 1, b = i & 1 ; columns order: C1B1, C1B2, C2B1, C2B2 -> col = c * 2 + b ; row = a
  const pos = i => ({ r: i >> 2, c: ((i >> 1) & 1) * 2 + (i & 1) });
  const cnt = Array.from({ length: 2 }, () => Array(4).fill(0)); all.forEach(i => { const { r, c } = pos(i); cnt[r][c] = empties.includes(i) ? 0 : U.int(rng, 4, 9); });
  ctx.setPrompt(`Counts of answers in each A × B × C cell. Tap the ${nEmpty > 1 ? '<b>empty cells</b>' : '<b>empty cell</b>'}.`);
  const g = DesignGrid({ rows: ['A1', 'A2'], cols: ['B1', 'B2', 'B1', 'B2'], colGroups: [{ label: 'C1', span: 2 }, { label: 'C2', span: 2 }], label: (r, c) => String(cnt[r][c]), dots: (r, c) => cnt[r][c], tap: true, caption: 'Counts per cell', onTap: () => ctx.setReady(g.filled().length > 0), cell: 56 });
  ctx.stage.append(g.el);
  const want = empties.map(i => { const { r, c } = pos(i); return r + ':' + c; });
  return {
    check() { const got = g.filled(), ok = got.length === want.length && want.every(k => got.includes(k)); g.lock(); want.forEach(k => { const [r, c] = k.split(':').map(Number); g.mark(r, c, 'right'); }); got.filter(k => !want.includes(k)).forEach(k => { const [r, c] = k.split(':').map(Number); g.mark(r, c, 'wrongc'); });
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `With an empty cell, a model with every interaction has nothing to estimate for it: R reports "NA" for ${nEmpty} coefficient${nEmpty > 1 ? 's' : ''} (rank deficient). Look at the counts before adding terms.` }; },
    solve() { want.forEach(k => { const [r, c] = k.split(':').map(Number); if (!g.state[k]) g.toggle(r, c, true); }); },
    solveWrong() { const k = '0:0'; const w = want.includes(k) ? '1:1' : k; const [r, c] = w.split(':').map(Number); g.toggle(r, c, true); },
    info: { empties, cnt, nEmpty },
  };
}
const SCENARIOS = [
  { msg: 'number of levels of each grouping factor must be < number of observations (problems: p:i)', best: 'Count answers in each cell', others: ['Add more random slopes', 'Ignore it: the fixed effects are fine'], why: 'One answer per participant \u00d7 item: that term cannot be told from noise. Inspect the design before adding terms.' },
  { msg: 'boundary (singular) fit: see help(\'isSingular\')', best: 'Drop the slope or the correlation', others: ['Add more random slopes', 'Ignore it: it only looks scary'], why: 'A singular fit says the random structure is richer than the data can support. Simplify, or check that the design can estimate it.' },
  { msg: 'fixed-effect model matrix is rank deficient so dropping 1 column / coefficient', best: 'Look for an empty cell', others: ['Raise the iteration limit', 'Change the optimiser, then refit'], why: 'A dropped column means two fixed terms say the same thing, usually because a cell is empty. Random terms do not fix that.' },
  { msg: 'number of observations (=24) <= number of random effects (=24) for term (1 + cond | id)', best: 'Check repeats per person and cond', others: ['Increase the iteration limit', 'Add a second random slope for cond'], why: 'One answer per person per condition: a person\'s effect cannot be told from noise. A design problem, not an optimiser one.' },
];
function buildWhat(ctx) {
  const rng = ctx.rng, S = U.pick(rng, SCENARIOS), opts = U.shuffle(rng, [S.best, ...S.others]);
  ctx.setPrompt('lme4 prints this. What do you do <b>first</b>?');
  const tiles = Choices(opts.map(o => ({ key: o, label: o })), { cols: 1, onPick: () => ctx.setReady(true) });
  ctx.stage.append(el('div', { class: 'rmsg' }, S.msg), tiles.el);
  return {
    check() { const ok = tiles.key === S.best; tiles.lock(); tiles.mark(S.best, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc'); return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + S.why }; },
    solve() { tiles.pick(S.best, true); }, solveWrong() { tiles.pick(S.others[0], true); }, info: { best: S.best, opts },
  };
}

// ---------------------------------------------------------------------------
// Level 15: Reading lmer and glmer output
// ---------------------------------------------------------------------------
function printoutTables(E, { onTap, flash = null, only = null } = {}) {
  const glm = E.kind === 'glmer', cols = glm ? [{ label: 'Est.', aria: 'Estimate' }, { label: 'SE', aria: 'Standard error' }, { label: 'z', aria: 'z value' }] : [{ label: 'Est.', aria: 'Estimate' }, { label: 'SE', aria: 'Standard error' }, { label: 't', aria: 't value' }];
  const re = ModelTable({ cols: [{ label: 'SD', aria: 'Standard deviation' }], rows: [{ name: E.re[0].grp, aria: 'participant intercept', cells: [f2(E.re[0].sd)] }, ...(E.resid != null ? [{ name: 'Residual', cells: [f2(E.resid)] }] : [])], mode: 'cell', caption: 'Random effects', onTap: (r, c) => onTap('re', r, c), flash: flash && flash[0] === 're' ? [flash[1], flash[2]] : null, can: (r, c) => !only || (only[0] === 're' && only[1] === r && only[2] === c) });
  const fe = ModelTable({ cols, rows: E.fe.map(f => ({ name: f.name, cells: [f2(f.est), f2(f.se), f2(f.stat)] })), mode: 'cell', caption: 'Fixed effects', onTap: (r, c) => onTap('fe', r, c), flash: flash && flash[0] === 'fe' ? [flash[1], flash[2]] : null, can: (r, c) => !only || (only[0] === 'fe' && only[1] === r && only[2] === c) });
  const obs = el('button', { class: 'obsline', 'aria-label': `Number of observations ${E.n}, groups participant, ${E.ngroups}`, onclick: () => onTap('obs', 0, 0) }, `Obs: ${E.n}, `, el('span', { class: 'ng' }, `${E.re[0].grp}: ${E.ngroups}`));
  if (only) obs.disabled = !(only[0] === 'obs');
  const wrap = el('div', { class: 'printout' }, el('div', { class: 'ptitle' }, 'Random effects'), re.el, el('div', { class: 'ptitle' }, 'Fixed effects'), fe.el, obs);
  return { el: wrap, re, fe, obs };
}
function buildOutTut(ctx) {
  const E = POOLS.outs.find(o => o.kind === 'lmer' && !o.slope && !o.singular);
  ctx.setPrompt('A mixed-model printout. Tap the flashing number: the <b>average baseline</b> (all predictors at their reference).');
  const t = printoutTables(E, { flash: ['fe', 0, 0], only: ['fe', 0, 0], onTap: () => { t.fe.lock(); ctx.complete('The Intercept row of the fixed effects is the average person in the reference condition: the group-level baseline.'); } });
  ctx.stage.append(t.el);
  return { solve: () => t.fe.pick(0, 0) };
}
const OUT_KINDS = [
  { k: 'sd', q: 'Tap how much <b>people differ</b> in baseline (their SD).', at: ['re', 0, 0], when: () => true, why: 'The random-effects SD for participant is the spread of people\'s baselines around the group average.' },
  { k: 'eff', q: 'Tap the <b>average effect</b> of condition.', at: ['fe', 1, 0], when: () => true, why: 'The fixed-effect estimate for condition is the average difference between conditions, across people.' },
  { k: 'se', q: 'Tap how <b>uncertain</b> the condition effect is (its standard error).', at: ['fe', 1, 1], when: () => true, why: 'The standard error of the fixed effect says how precisely the average effect is known.' },
  { k: 'stat', q: 'Tap the condition effect in <b>standard-error units</b>.', at: ['fe', 1, 2], when: () => true, why: 'It is the estimate divided by its standard error (z in glmer, t in lmer).' },
  { k: 'base', q: 'Tap the <b>average baseline</b>: the Intercept estimate.', at: ['fe', 0, 0], when: () => true, why: 'The Intercept is the average person in the reference condition, on the model\'s scale.' },
  { k: 'resid', q: 'Tap the <b>leftover noise</b> within a person (Residual SD).', at: ['re', 1, 0], when: E => E.kind === 'lmer', why: 'The residual SD is how much one person\'s answers scatter around their own line.' },
  { k: 'ng', q: 'Tap how many <b>participants</b> there are.', at: ['obs', 0, 0], when: () => true, why: 'The "participant: N" count is the number of groups. It is not the number of observations.' },
];
function buildOutTap(ctx) {
  const rng = ctx.rng, E = poolPick(rng, POOLS.outs.filter(o => !o.slope && !o.singular)), K = U.pick(rng, OUT_KINDS.filter(k => k.when(E)));
  ctx.setPrompt(K.q + (E.kind === 'glmer' ? ' (log-odds model)' : ''));
  let sel = null; const t = printoutTables(E, { onTap: (w, r, c) => { sel = [w, r, c]; if (w !== 're') t.re.cells && Object.values(t.re.cells).forEach(b => b.classList.remove('on')); if (w !== 'fe') Object.values(t.fe.cells).forEach(b => b.classList.remove('on')); t.obs.classList.toggle('on', w === 'obs'); ctx.setReady(true); } });
  ctx.stage.append(t.el);
  const right = () => sel && sel[0] === K.at[0] && sel[1] === K.at[1] && sel[2] === K.at[2];
  const markRight = () => { if (K.at[0] === 'obs') t.obs.classList.add('right'); else (K.at[0] === 're' ? t.re : t.fe).mark(K.at[1], K.at[2], 'right'); };
  return {
    check() { const ok = !!right(); t.re.lock(); t.fe.lock(); t.obs.disabled = true; markRight(); return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + K.why }; },
    solve() { if (K.at[0] === 'obs') t.obs.click(); else (K.at[0] === 're' ? t.re : t.fe).pick(K.at[1], K.at[2]); },
    solveWrong() { if (K.at[0] === 'obs') t.fe.pick(0, 0); else if (K.at[0] === 'fe' && K.at[1] === 0 && K.at[2] === 0) t.fe.pick(1, 0); else t.fe.pick(0, 0); },
    info: { kind: K.k, at: K.at, E },
  };
}
// the typical person vs the average of people
function typicalCase(rng) {
  for (;;) {
    const mu = M.round(U.pick(rng, [-1, 1]) * U.uni(rng, 1.2, 2.4), 1), sd = M.round(U.uni(rng, 1.2, 2.2), 1), n = 15;
    const z = Array.from({ length: n }, (_, i) => U.qnorm((i + 0.5) / n)), ps = z.map(v => U.plogis(mu + sd * v)), med = U.plogis(mu), mean = U.mean(ps);
    if (Math.abs(mean - med) >= 0.07 && Math.abs(med - 0.5) >= 0.12 && Math.abs(mean - 0.5) >= 0.05) return { mu, sd, ps, med, mean };
  }
}
function buildTypical(ctx) {
  const rng = ctx.rng, C = typicalCase(rng);
  ctx.setPrompt(`Fifteen people's own probabilities (dots). The model says Intercept = <b>${f1(C.mu)}</b> log-odds. Drag the marker to <b>plogis(Intercept)</b>.`);
  const ch = Plot(ctx, { h: 154, left: 14, right: 14, top: 4, bottom: 30, xr: [0, 1], yr: [0, 1], label: `Fifteen people's probabilities on a 0 to 1 line, from ${prob(Math.min(...C.ps))} to ${prob(Math.max(...C.ps))}` });
  ch.axisX([[0, '0'], [0.5, '.5'], [1, '1']], { y: 84 });
  const bins = {}; C.ps.forEach(p => { const k = Math.round(ch.X(p) / 11); bins[k] = (bins[k] || 0) + 1; ch.add(sv('circle', { class: 'datadot', r: 5.2, cx: ch.X(p), cy: 72 - (bins[k] - 1) * 11 }), ch.over); });
  const start = C.mu > 0 ? 0.3 : 0.7;
  const h = hx(ch, 134, { name: 'Marker for plogis(Intercept)', v: start, min: 0.02, max: 0.98, step: 0.01, fmt: v => `probability ${f2(v)}`, onChange: (v, u) => { if (u) ctx.setReady(true); } });
  ctx.stage.append(ch.svg, note(`People differ (SD ${f1(C.sd)} on the log-odds scale).`));
  const tol = 0.04;
  return {
    check() { const ok = Math.abs(h.v - C.med) <= tol; h.lock(); ch.add(sv('circle', { class: 'ringm good', r: 15, cx: ch.X(C.med), cy: 134 }), ch.over); const g = ch.add(marker('dia', 8, 'mkhollow'), ch.over); g.setAttribute('transform', `translate(${ch.X(C.mean)},134)`);
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + `plogis(${f1(C.mu)}) = ${prob(C.med)} is the typical (middle) person. The average of everyone's probabilities is ${prob(C.mean)} (hollow diamond), pulled toward .5.` }; },
    solve() { h.set(C.med, true); }, solveWrong() { h.set(M.clamp(C.mean, 0.02, 0.98), true); }, info: { med: C.med, mean: C.mean, tol, start, mu: C.mu, sd: C.sd, ps: C.ps },
  };
}

// ---------------------------------------------------------------------------
// Level 16: Writing it up
// ---------------------------------------------------------------------------
function reportCase(rng) {
  const b0 = M.round(U.pick(rng, [-1, 1]) * U.uni(rng, 0.4, 1.6), 2), b1 = M.round(U.pick(rng, [-1, 1]) * U.uni(rng, 0.5, 1.4), 2), kind = U.pick(rng, ['int-lo', 'int-p', 'b-or', 'b-lo', 'b-p']);
  const fmtP = v => prob(v), E = { 'int-lo': b0, 'int-p': U.plogis(b0), 'b-or': Math.exp(b1), 'b-lo': b1, 'b-p': U.plogis(b0 + b1) };
  const T = {
    'int-lo': { s: 'For the baseline group, the <b>log-odds</b> of success were ___.', t: [['Intercept', f2(b0), b0], ['exp(Intercept)', f2(Math.exp(b0)), Math.exp(b0)], ['plogis(Intercept)', fmtP(U.plogis(b0)), U.plogis(b0)]] },
    'int-p': { s: 'For the baseline group, the <b>probability</b> of success was ___.', t: [['Intercept', f2(b0), b0], ['exp(Intercept)', f2(Math.exp(b0)), Math.exp(b0)], ['plogis(Intercept)', fmtP(U.plogis(b0)), U.plogis(b0)]] },
    'b-or': { s: 'Group B\'s <b>odds</b> of success were ___ times the baseline odds.', t: [['groupB', f2(b1), b1], ['exp(groupB)', f2(Math.exp(b1)), Math.exp(b1)], ['plogis(groupB)', fmtP(U.plogis(b1)), U.plogis(b1)]] },
    'b-lo': { s: 'Group B differed from baseline by ___ in <b>log-odds</b>.', t: [['groupB', f2(b1), b1], ['exp(groupB)', f2(Math.exp(b1)), Math.exp(b1)], ['plogis(groupB)', fmtP(U.plogis(b1)), U.plogis(b1)]] },
    'b-p': { s: 'Group B\'s <b>probability</b> of success was about ___.', t: [['plogis(Intercept + groupB)', fmtP(U.plogis(b0 + b1)), U.plogis(b0 + b1)], ['plogis(groupB)', fmtP(U.plogis(b1)), U.plogis(b1)], ['Intercept + groupB', f2(b0 + b1), b0 + b1]] },
  }[kind];
  const ans = { 'int-lo': 0, 'int-p': 2, 'b-or': 1, 'b-lo': 0, 'b-p': 0 }[kind];
  return { b0, b1, kind, T, ans };
}
function buildWriteTut(ctx) {
  ctx.setPrompt('Group B\'s <b>odds</b> of success were ___ times the baseline odds. Tap the flashing number that fills the blank.');
  const tb = ModelTable({ cols: [{ label: 'Est.' }], rows: [{ name: 'Intercept', cells: ['0.40'] }, { name: 'groupB', cells: ['0.69'] }], mode: 'none', compact: true, caption: 'Estimates' });
  const tiles = Choices([{ key: 'ok', label: 'exp(groupB) = 2.00' }], { cols: 1, flashKey: 'ok', cls: 'mono', onPick: () => { tiles.lock(); ctx.complete('The table gives log-odds (0.69). exp() turns it into an odds ratio: B\'s odds were 2 times baseline.'); } });
  ctx.stage.append(tb.el, tiles.el);
  return { solve: () => tiles.pick('ok', true) };
}
function buildWriteSlots(ctx) {
  const rng = ctx.rng, C = reportCase(rng);
  ctx.setPrompt(C.T.s + ' Tap the right call.');
  const tb = ModelTable({ cols: [{ label: 'Est.', aria: 'Estimate' }], rows: [{ name: 'Intercept', cells: [f2(C.b0)] }, { name: 'groupB', cells: [f2(C.b1)] }], mode: 'none', compact: true, caption: 'Logistic model estimates (log-odds)' });
  const order = U.shuffle(rng, [0, 1, 2]);
  const tiles = Choices(order.map(i => ({ key: String(i), label: `${C.T.t[i][0]} = ${C.T.t[i][1]}` })), { cols: 1, cls: 'mono', onPick: () => ctx.setReady(true) });
  ctx.stage.append(tb.el, tiles.el);
  return {
    check() { const ok = +tiles.key === C.ans; tiles.lock(); tiles.mark(String(C.ans), 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc');
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + 'The table is in log-odds. Report log-odds as they are, odds ratios with exp(), and probabilities with plogis() of the whole sum.' }; },
    solve() { tiles.pick(String(C.ans), true); }, solveWrong() { tiles.pick(String((C.ans + 1) % 3), true); }, info: { kind: C.kind, ans: C.ans, b0: C.b0, b1: C.b1, values: C.T.t.map(t => t[2]) },
  };
}
const INTERCEPT_BANK = [
  { ctx: 'condition coded \u2212\u00bd / +\u00bd; participant random intercept', right: 'Average of both conditions, for the typical person', wrong: ['The baseline condition only', 'A probability of about .8 for everyone'], why: 'With balanced \u2212\u00bd/+\u00bd coding, 0 sits halfway between the conditions, so the intercept is their average (on the log-odds scale, for the typical person).' },
  { ctx: 'condition coded 0 / 1; participant random intercept', right: 'The baseline condition, in log-odds', wrong: ['The average of both conditions, as a probability', 'A probability: about .8 for everyone'], why: 'With 0/1 coding the intercept is the reference condition only. It is a log-odds, not a probability.' },
  { ctx: 'age in months, not centred; no random effects', right: 'The prediction at age 0', wrong: ['The average score of all the children', 'The score at the typical age'], why: 'Without centring, the intercept is read at x = 0, far outside the data. Report it as an anchor, not as a finding about the children.' },
  { ctx: 'age centred at its mean; participant random intercept', right: 'A typical child at the average age', wrong: ['The prediction at age 0', 'The average of the children\'s probabilities'], why: 'After centring, 0 on the model\'s age scale is the average age. The random-intercept model describes the typical (middle) person.' },
];
function buildWriteInt(ctx) {
  const rng = ctx.rng, B = U.pick(rng, INTERCEPT_BANK), est = M.round(U.uni(rng, 0.8, 2.2), 2), opts = U.shuffle(rng, [B.right, ...B.wrong]);
  ctx.setPrompt('What does the <b>Intercept</b> mean here? Pick the fair way to report it.');
  const tb = ModelTable({ cols: [{ label: 'Est.', aria: 'Estimate' }], rows: [{ name: 'Intercept', cells: [f2(est)] }], mode: 'none', compact: true, caption: 'Model estimate' });
  const tiles = Choices(opts.map(o => ({ key: o, label: o })), { cols: 1, onPick: () => ctx.setReady(true) });
  ctx.stage.append(note(`Model: ${B.ctx}`), tb.el, tiles.el);
  return {
    check() { const ok = tiles.key === B.right; tiles.lock(); tiles.mark(B.right, 'right'); if (!ok) tiles.mark(tiles.key, 'wrongc'); return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + B.why }; },
    solve() { tiles.pick(B.right, true); }, solveWrong() { tiles.pick(B.wrong[0], true); }, info: { right: B.right, opts },
  };
}

const PART2 = [
  { title: 'Why not just average?', part: 2, intro: 'Answers from one person move together. Treating every dot as independent counts one person many times.', subs: [
    { id: 'm-tut', name: 'One person', blurb: 'Tap the dots that go together', help: 'Tap the flashing person.', ...TUT, build: buildAvgTutM },
    { id: 'm-units', name: 'Dots or people?', blurb: 'Count the independent people', help: 'Each row is one person. Set the counter to the number of independent people in the group asked about.', ...S5, build: buildUnits },
    { id: 'm-simpson', name: 'Trend within people', blurb: 'Pooled dots can lie', help: 'Four people each show a trend. Tilt the line to the trend that holds within each person, not across the pooled dots.', ...S5, build: buildSimpson },
  ] },
  { title: 'Design tables', part: 2, intro: 'A within factor repeats in the same person; a between factor does not. Crossed or nested says how groups overlap.', subs: [
    { id: 'd-tut', name: 'First cell', blurb: 'Record one person in one condition', help: 'Tap the flashing cell.', ...TUT, build: buildGridTut },
    { id: 'd-fill', name: 'Fill the table', blurb: 'From a description to cells', help: 'Tap every cell that holds data. A within factor puts a person in several levels; a between factor in one.', ...S5, build: buildGridFill },
    { id: 'd-label', name: 'Within or between?', blurb: 'From cells to the label', help: 'Look at who has data where, then set each factor to within or between.', ...S10, build: buildGridLabel },
    { id: 'd-nest', name: 'Crossed or nested?', blurb: 'Which grid is it', help: 'Crossed: every row meets every column. Nested: each column belongs to one row.', ...S5, build: buildNest },
  ] },
  { title: 'Random intercepts and shrinkage', part: 2, intro: 'Each person gets their own baseline, drawn from a spread. With little data, the model pulls them toward the group.', subs: [
    { id: 'r-tut', name: 'Lift a line', blurb: 'One person\'s own height', help: 'Drag the flashing handle until the line runs through the points.', ...TUT, build: buildRITut },
    { id: 'r-match', name: 'Match each person', blurb: 'Three heights, one slope', help: 'Drag each person\'s handle so their line runs through their points.', ...S5, build: buildRIMatch },
    { id: 'r-pull', name: 'Pulled toward the group', blurb: 'Who moves the most?', help: 'Slide to Mixed model to see lines move from each person\'s own data toward the group line (real lme4 fits). Then tap the person who moved the most.', ...S10, build: buildPull },
  ] },
  { title: 'Random-effects notation', part: 2, intro: '(what varies | what it varies by). Build it, read it, and spot what is broken.', subs: [
    { id: 'n-tut', name: 'First tile', blurb: 'Say "people differ in baseline"', help: 'Tap the flashing tile.', ...TUT, build: buildFormTut },
    { id: 'n-build', name: 'Build the formula', blurb: 'From a design description', help: 'Tap tiles to build the random part. Tap a tile in the line to remove it.', ...S5, build: buildFormBuild },
    { id: 'n-read', name: 'What does it create?', blurb: 'Formula to variance components', help: 'Tick every source of variation the formula gives the model.', ...S5, build: buildFormRead },
    { id: 'n-typo', name: 'Spot the slip', blurb: 'One part is wrong', help: 'Tap the one wrong part of the formula.', ...S5, build: buildTypo },
    { id: 'n-table', name: 'Which row is mine?', blurb: 'Formula term to table row', help: 'A random-effects table has one row per variance. Tap the row the underlined term makes.', ...S5, build: buildVCTable },
  ] },
  { title: 'Estimable or not?', part: 2, intro: 'A random term needs repeats. Look at the design before blaming the software.', subs: [
    { id: 'e-tut', name: 'Run it twice', blurb: 'See repeats make a term estimable', help: 'Tap the flashing button.', ...TUT, build: buildEstTut },
    { id: 'e-cells', name: 'Which terms?', blurb: 'Participants × items', help: 'Tick the terms the design can estimate. A group factor needs some group seen more than once.', ...S10, build: buildEstCells },
    { id: 'e-slope', name: 'Which slopes?', blurb: 'Repeats inside each condition', help: 'A random slope needs each person to have repeats in each condition.', ...S5, build: buildEstSlope },
  ] },
  { title: 'Random slopes', part: 2, intro: 'A random slope lets the effect of x differ from person to person.', subs: [
    { id: 'v-tut', name: 'Tilt a line', blurb: 'One person\'s own effect', help: 'Drag the flashing handle until the line runs through the points.', ...TUT, build: buildSlopeTut },
    { id: 'v-shape', name: 'What varies?', blurb: 'Heights, tilts, or both', help: 'Look at the thin lines and tap the random term that matches.', ...S5, build: buildSlopeShape },
    { id: 'v-cost', name: 'What does it cost?', blurb: 'Leaving the slope out', help: 'Two models, same data, two interval bars. Tap the one to trust.', ...S5, build: buildSlopeCost },
  ] },
  { title: 'When the fit goes wrong', part: 2, intro: 'Warnings are information about the design. Inspect before you add.', subs: [
    { id: 'f-tut', name: 'First warning', blurb: 'Find the singular number', help: 'Tap the flashing number.', ...TUT, build: buildSingTut },
    { id: 'f-sing', name: 'Singular or fine?', blurb: 'Spot the boundary', help: 'A variance of 0, or a correlation of ±1, means the fit is singular. Otherwise tap "Nothing wrong".', ...S5, build: buildSingular },
    { id: 'f-empty', name: 'The empty cell', blurb: 'Why a coefficient drops', help: 'Tap the cell (or cells) with no data.', ...S5, build: buildEmpty },
    { id: 'f-what', name: 'What first?', blurb: 'Read the message, choose the move', help: 'Each message is a fact about the design or the model. Pick the best first move.', ...S5, build: buildWhat },
  ] },
  { title: 'Reading lmer and glmer output', part: 2, intro: 'Random effects first, then fixed effects. On a glmer, every number is on the log-odds scale.', subs: [
    { id: 'o-tut', name: 'First printout', blurb: 'Tap the Intercept', help: 'Tap the flashing number.', ...TUT, build: buildOutTut },
    { id: 'o-tap', name: 'Find the number', blurb: 'Random or fixed part?', help: 'Tap the number the question asks for. Fits shown are real lme4 output.', ...S10, build: buildOutTap },
    { id: 'o-typical', name: 'Typical person', blurb: 'plogis(Intercept) vs the average', help: 'Drag the marker to where plogis(Intercept) lands: the middle person, not the mean of the dots.', ...S5, build: buildTypical },
  ] },
  { title: 'Writing it up', part: 2, intro: 'Say which scale each number is on, and do not read the intercept as more than it is.', subs: [
    { id: 'w-tut', name: 'First sentence', blurb: 'Fill one blank', help: 'Tap the flashing tile.', ...TUT, build: buildWriteTut },
    { id: 'w-slots', name: 'Fill the blank', blurb: 'The right scale for the sentence', help: 'The table is in log-odds. Pick the call that gives what the sentence says.', ...S10, build: buildWriteSlots },
    { id: 'w-int', name: 'The intercept', blurb: 'Report it fairly', help: 'Pick the fair reading of the intercept for this model.', ...S5, build: buildWriteInt },
  ] },
];
