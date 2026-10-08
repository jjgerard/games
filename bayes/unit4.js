// Unit 4: hierarchical models and partial pooling. Apple trees are the groups
// and branches are the measurements. A group's own average is noisy when it
// rests on few branches, so the model pulls it toward the average of all
// trees. Dots slide along a number line; nothing is calculated by the player.
// Keys: pooled = mu + w (m - mu), w = tau^2 / (tau^2 + sigma^2 / n), checked
// against R (and against lme4's random-intercept fit for balanced groups).

const AX4 = [0, 40], MU4 = 20, TK4 = [0, 10, 20, 30, 40];
const tick4 = () => TickRow({ xd: AX4, ticks: TK4, label: 'Apples per branch, 0 to 40' });
// n values with mean exactly 0 and spread exactly 1 (no wild outliers), so a tree's dots honestly show its spread
function zset(rng, n) { for (;;) { const z = Array.from({ length: n }, () => BM.randn(rng)), m = BM.mean(z), s = BM.sd(z), zz = z.map(x => (x - m) / s); if (Math.max(...zz.map(Math.abs)) <= 2.1) return zz; } }
const treeObs = (rng, m, sigma, n) => zset(rng, n).map(z => r1(m + sigma * z));
const pooledAt = (m, n, sigma, tau) => BM.pooled(m, MU4, BM.shrinkW(tau, sigma, n));
const treeLabel = (i, n, m) => `Tree ${i}: ${n} branches measured, average about ${Math.round(m)} apples`;

// (sigma, tau, n) triples where a tree's own data count for roughly a third or two thirds of its estimate
const LAND_SETS = (() => { const out = []; for (const s of [3, 4, 5]) for (const t of [1.5, 2, 3, 4, 5]) for (const n of [2, 3, 4, 5, 6, 8, 9, 12]) { const w = BM.shrinkW(t, s, n); if ((w >= 0.25 && w <= 0.35) || (w >= 0.65 && w <= 0.75)) out.push({ s, t, n, w }); } return out; })();

// ---------------------------------------------------------------------------
// 4.0 tutorial: slide the pooling
// ---------------------------------------------------------------------------
function buildPoolTut(ctx) {
  const rng = ctx.rng, spec = [[3, 11], [8, 17], [5, 27], [12, 31]];
  ctx.setPrompt('Grey dots are an apple tree’s branches, the green dot is the model’s estimate for the tree. Drag the flashing slider to the right.');
  const rows = spec.map(([n, m], i) => ShrinkStrip({ m, obs: treeObs(rng, m, 4, n), mu: MU4, pooled: m, H: 42, label: treeLabel(i + 1, n, m) }));
  const slider = AxisSlider({ values: [0], labels: ['Pooling, from none at the left to complete at the right'], step: 0.05, onChange: (v, user) => { rows.forEach((r, i) => r.set(spec[i][1] + v[0] * (MU4 - spec[i][1]))); if (v[0] >= 0.9) ctx.complete('The green dots slid to the average of all trees. No pooling keeps each tree’s own average; complete pooling treats all trees as one.'); } });
  slider.el.querySelector('.as-thumb').classList.add('flash');
  ctx.stage.append(...rows.map(r => r.el), tick4().el, slider.el, Ends('none pooling', 'complete pooling'));
  return { solve() { slider.set(0, 1, true); } };
}

// ---------------------------------------------------------------------------
// 4.1 where does one tree land?
// ---------------------------------------------------------------------------
function buildLand(ctx) {
  const rng = ctx.rng, c = BM.pick(rng, LAND_SETS), d = r1(7 + rng() * 3) * (rng() < 0.5 ? -1 : 1), m = MU4 + d;
  const obs = treeObs(rng, m, c.s, c.n), truth = BM.pooled(m, MU4, c.w), tol = 0.12 * Math.abs(d);
  ctx.setPrompt('Few branches, or trees that are alike, pull a tree toward the average of all trees. Drag the green dot to where the model puts this tree.');
  const strip = ShrinkStrip({ m, obs, mu: MU4, pooled: m, tau: c.t, H: 84, r: 10, label: `One tree, ${c.n} branches measured, average ${Math.round(m)} apples; all trees average 20; trees usually differ by about ${c.t} apples` });
  const slider = AxisSlider({ values: [m / 40], labels: ['Where the model puts this tree, apples per branch'], step: 0.025, onChange: v => { strip.set(v[0] * 40); ctx.setReady(slider.touched()); } });
  const legend = Legend([['ring', 'own average'], ['dash', 'all trees’ average'], ['band', 'trees usually differ']]);
  dragOnStrip(strip.el, slider);
  ctx.stage.append(strip.el, tick4().el, slider.el, legend);
  return {
    check() {
      const v = slider.get()[0] * 40, ok = Math.abs(v - truth) <= tol + 1e-9; slider.lock();
      strip.set(truth); strip.el.setAttribute('aria-label', `Model puts the tree at about ${Math.round(truth)} apples`);
      const lean = c.w < 0.5 ? `Few branches next to how alike trees are: its own average counts for only about ${pct(c.w)}%, so the model leans on the other trees.` : `Plenty of branches next to how much trees differ: its own average counts for about ${pct(c.w)}%, so the model mostly trusts it.`;
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${lean}` };
    },
    solve() { slider.set(0, truth / 40, true); },
    solveWrong() { slider.set(0, m / 40, true); },
    info: { m, mu: MU4, sigma: c.s, tau: c.t, n: c.n, w: c.w, truth, tol, obs },
  };
}

// ---------------------------------------------------------------------------
// 4.2 which tree moves the most?
// ---------------------------------------------------------------------------
const MOST_S = 4, MOST_T = 3;
function mostCase(rng) {
  const kind = BM.pick(rng, ['A', 'B', 'C']);   // chosen once, so the three kinds stay equally common
  for (let t = 0; t < 4000; t++) {
    const ns = BM.shuffle(rng, [2, 3, 4, 6, 9, 12]).slice(0, 3);
    const rows = ns.map(n => { const d = BM.int(rng, 3, 10), sgn = rng() < 0.5 ? -1 : 1, m = MU4 + sgn * d; return { n, d, m, p: pooledAt(m, n, MOST_S, MOST_T), move: d * (1 - BM.shrinkW(MOST_T, MOST_S, n)) }; });
    const moves = rows.map(r => r.move), win = argmax(moves), sorted = moves.slice().sort((a, b) => b - a);
    if (sorted[0] < 1.25 * sorted[1] || sorted[0] < 2.5) continue;
    const far = argmax(rows.map(r => r.d)), few = argmax(rows.map(r => -r.n));
    const okKind = kind === 'A' ? win === few && win !== far : kind === 'B' ? win === far && win !== few : win !== far && win !== few;
    if (!okKind) continue;
    if (new Set(rows.map(r => r.d)).size < 3) continue;
    return { rows, win, kind, far, few };
  }
  throw new Error('no most case');
}
function buildMost(ctx) {
  const rng = ctx.rng, c = mostCase(rng);
  ctx.setPrompt('The model pulls each tree’s own average (ring) toward the average of all trees. Tap the tree pulled the most.');
  const strips = c.rows.map((r, i) => ShrinkStrip({ m: r.m, obs: treeObs(rng, r.m, MOST_S, r.n), mu: MU4, pooled: null, tau: MOST_T, H: 56, label: treeLabel(i + 1, r.n, r.m) }));
  let chosen = null; const btns = strips.map((s, i) => el('button', { class: 'rowpick', 'aria-label': `Tree ${i + 1}: ${c.rows[i].n} branches, average ${Math.round(c.rows[i].m)}`, onclick: () => { chosen = i; btns.forEach((x, j) => x.classList.toggle('on', j === i)); ctx.setReady(true); } }, el('div', { class: 'barsline' }, el('span', { class: 'rownum' }, i + 1), s.el)));
  const tk = el('div', { class: 'barsline' }, el('span', { class: 'rownum', style: 'visibility:hidden' }), tick4().el);
  ctx.stage.append(...btns, tk, Legend([['ring', 'own average'], ['dash', 'all trees’ average'], ['band', 'trees usually differ']]));
  return {
    check() {
      const ok = chosen === c.win; btns.forEach((b, i) => { b.disabled = true; b.classList.remove('on'); if (i === c.win) b.classList.add('right'); else if (i === chosen) b.classList.add('bad'); });
      strips.forEach((s, i) => s.set(c.rows[i].p));
      const w = c.rows[c.win];
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}Tree ${c.win + 1} moves the most (${w.n} branches, ${w.d} apples from the average): far away and few branches mean a big pull.` };
    },
    solve() { btns[c.win].click(); },
    solveWrong() { btns[(c.win + 1) % 3].click(); },
    info: { rows: c.rows.map(r => ({ n: r.n, m: r.m, p: r.p, move: r.move })), win: c.win, far: c.far, few: c.few, kind: c.kind, mu: MU4, sigma: MOST_S, tau: MOST_T },
  };
}

// ---------------------------------------------------------------------------
// 4.3 how much pooling do these data call for?
// ---------------------------------------------------------------------------
function amountCase(rng) {
  for (let t = 0; t < 4000; t++) {
    const alike = rng() < 0.5, G = 4, n = 5, tau = alike ? 1 : 6, sigma = alike ? 5 : 3;
    const groups = Array.from({ length: G }, () => { const th = MU4 + tau * BM.randn(rng); return treeObs(rng, th, sigma, n); });
    if (groups.some(g => g.some(v => v < 1 || v > 39))) continue;
    const a = BM.anovaPool(groups), s = 1 - a.w;
    if (alike ? s < 0.75 : s > 0.2) continue;
    return { groups, a, s, alike };
  }
  throw new Error('no amount case');
}
function buildAmount(ctx) {
  const c = amountCase(ctx.rng), a = c.a;
  ctx.setPrompt('Do these four trees really differ, or only look different by branch luck? Slide the pooling: low if they really differ, high if luck.');
  const strips = c.groups.map((g, i) => ShrinkStrip({ m: a.means[i], obs: g, mu: a.grand, pooled: a.means[i], H: 42, r: 7, label: `Tree ${i + 1}: five branches, average ${Math.round(a.means[i])} apples` }));
  const slider = AxisSlider({ values: [0], labels: ['Pooling, from none at the left to complete at the right'], step: 0.05, onChange: v => { strips.forEach((s, i) => s.set(a.means[i] + v[0] * (a.grand - a.means[i]))); ctx.setReady(slider.touched()); } });
  ctx.stage.append(...strips.map(s => s.el), tick4().el, slider.el, Ends('none pooling', 'complete pooling'));
  return {
    check() {
      const v = slider.get()[0], ok = Math.abs(v - c.s) <= 0.2 + 1e-9; slider.lock();
      strips.forEach((s, i) => s.set(a.means[i] + c.s * (a.grand - a.means[i])));
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}${c.alike ? 'The averages differ only about as much as branch luck would make them: pool heavily.' : 'The averages differ far more than branch luck explains: the trees really differ, so barely pool.'}` };
    },
    solve() { slider.set(0, c.s, true); },
    solveWrong() { slider.set(0, c.alike ? 0 : 1, true); },
    info: { groups: c.groups, s: c.s, w: a.w, alike: c.alike },
  };
}

// ---------------------------------------------------------------------------
// 4.4 name the picture
// ---------------------------------------------------------------------------
const WHICH_NAMES = { none: 'No pooling', partial: 'Partial pooling', complete: 'Complete pooling' };
const WHICH_ASK = { none: 'trees stay on their rings (<b>no pooling</b>)', partial: 'trees move part way to the average (<b>partial pooling</b>)', complete: 'all trees sit at the average (<b>complete pooling</b>)' };
function buildWhichPool(ctx) {
  const rng = ctx.rng, ns = BM.shuffle(rng, [2, 6, 16]);
  const ms = ns.map(() => MU4 + (rng() < 0.5 ? -1 : 1) * BM.int(rng, 6, 11));
  if (new Set(ms.map(m => Math.sign(m - MU4))).size < 2) ms[0] = MU4 + (ms[1] > MU4 ? -1 : 1) * Math.abs(ms[0] - MU4);
  const pos = { none: ms, complete: ms.map(() => MU4), partial: ms.map((m, i) => pooledAt(m, ns[i], MOST_S, MOST_T)) };
  const order = BM.shuffle(rng, ['none', 'partial', 'complete']), ask = BM.pick(rng, ['none', 'partial', 'complete']);
  ctx.setPrompt(`Rings: each tree’s own average. Green dots: the model’s estimates. Tap the picture where ${WHICH_ASK[ask]}.`);
  let chosen = null; const btns = order.map((k, i) => {
    const strips = ms.map((m, j) => ShrinkStrip({ m, obs: [], mu: MU4, pooled: pos[k][j], H: 23, r: 6, label: '' }));
    const desc = k === 'none' ? 'green dots sit on the rings' : k === 'complete' ? 'all green dots sit on the dashed line' : 'green dots sit between the rings and the dashed line';
    return el('button', { class: 'rowpick', 'aria-label': `Picture ${i + 1}: ${desc}`, onclick: () => { chosen = i; btns.forEach((x, q) => x.classList.toggle('on', q === i)); ctx.setReady(true); } }, el('div', { class: 'barsline' }, el('span', { class: 'rownum' }, i + 1), el('div', { class: 'ssgroup', role: 'img', 'aria-label': `Three trees, ${desc}` }, strips.map(s => s.el))));
  });
  const tk = el('div', { class: 'barsline' }, el('span', { class: 'rownum', style: 'visibility:hidden' }), tick4().el);
  ctx.stage.append(...btns, tk);
  const answer = order.indexOf(ask);
  return {
    check() {
      const ok = chosen === answer; btns.forEach((b, i) => { b.disabled = true; b.classList.remove('on'); if (i === answer) b.classList.add('right'); else if (i === chosen) b.classList.add('bad'); b.prepend(el('div', { class: 'rowname' }, WHICH_NAMES[order[i]])); });
      return { correct: ok, message: `${ok ? 'Yes. ' : 'Not quite. '}A hierarchical model does partial pooling: it learns from the other trees, yet trees may differ.` };
    },
    solve() { btns[answer].click(); },
    solveWrong() { btns[(answer + 1) % 3].click(); },
    info: { ask, order, answer },
  };
}

UNITS[4] = {
  id: 'u4', title: 'Unit 4: Groups and pooling',
  intro: 'When data come in groups, a group’s own average is noisy. A hierarchical model lets groups borrow strength from each other: partial pooling.',
  subs: [
    { id: 'u4-pool-tut', name: 'Slide to pool', blurb: 'Dots slide to the average.', kind: 'tutorial', build: buildPoolTut, help: 'Drag the flashing slider to the right and watch the green dots. That is the only thing you can do here.' },
    { id: 'u4-land', name: 'Where does it land?', blurb: 'Pull one tree toward the rest.', kind: 'streak', target: 5, hearts: 2, build: buildLand,
      help: 'The ring is one tree’s own average. The dashed line is the average of all trees. The model puts the tree somewhere between them: closer to its own average when it has many branches and trees differ a lot, closer to the all-trees average when it has few branches or trees are alike. Drag the dot there.' },
    { id: 'u4-most', name: 'Who moves most?', blurb: 'Few branches, far away.', kind: 'streak', target: 5, hearts: 2, build: buildMost,
      help: 'A tree moves more when it is far from the average and when its own average rests on few branches. Tap the tree you expect to move most.' },
    { id: 'u4-amount', name: 'How much pooling?', blurb: 'Let the data decide.', kind: 'streak', target: 5, hearts: 2, build: buildAmount,
      help: 'If the tree averages differ about as little as branch-to-branch luck would make them, slide far toward pooling. If they differ far more than that, barely pool. Slide the dots to where you think the model puts them.' },
    { id: 'u4-which', name: 'Name the picture', blurb: 'None, partial or complete.', kind: 'streak', target: 5, hearts: 2, build: buildWhichPool,
      help: 'Each picture shows rings (a tree’s own average) and green dots (where a model puts the tree). Tap the one matching the description.' },
  ],
};
