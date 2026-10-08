// How often would a tempting wrong strategy be accepted? Low numbers are good.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  await p.goto('http://localhost:' + (process.env.PORT || 8123) + '/index.html?seed=' + (Date.now() % 99999)); await p.evaluate(() => localStorage.clear()); await p.reload();
  const run = async (id, n, f) => {
    await p.evaluate(id => openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)), id);
    const out = []; for (let i = 0; i < n; i++) { await p.waitForSelector('#stage > *'); out.push(await p.evaluate(f)); await p.evaluate(() => __run.ctrl.solve()); await p.evaluate(() => document.getElementById('quiz-action').click());
      if (await p.evaluate(() => __run.finished)) await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id); else await p.evaluate(() => document.getElementById('quiz-action').click()); }
    return out;
  };
  const rate = a => (100 * a.filter(Boolean).length / a.length).toFixed(0) + '%';
  const l1 = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);
  const prod = await run('u1-product', 300, () => { const i = __run.ctrl.info; const u = i.expected.map(() => 2.5);
    return { prior: l1(i.prior.map(x => Math.round(x)), i.expected) <= 2, lik: l1(i.lik.map(x => Math.round(x)), i.expected) <= 2, uniform: l1(u, i.expected) <= 2 }; });
  for (const k of ['prior', 'lik', 'uniform']) console.log(`u1-product: "${k === 'prior' ? 'follow only the shelf' : k === 'lik' ? 'follow only the draw' : 'spread chips evenly'}" would be accepted ${rate(prod.map(x => x[k]))} of the time`);
  const pri = await run('u1-prior', 300, () => { const i = __run.ctrl.info; return l1(i.expected.map(() => 2.5), i.expected) <= 2; });
  console.log(`u1-prior: "spread chips evenly" accepted ${rate(pri)}`);
  const sh = await run('u1-shift', 300, () => { const i = __run.ctrl.info; return { half: Math.abs(0.5 - i.mean) <= 0.06, prior: Math.abs(i.priorMean - i.mean) <= 0.06, real: Math.abs(i.realShare - i.mean) <= 0.06 }; });
  for (const k of ['half', 'prior', 'real']) console.log(`u1-shift: "${k === 'half' ? 'just say 50%' : k === 'prior' ? 'ignore the real draws' : 'ignore the imagined shapes'}" accepted ${rate(sh.map(x => x[k]))}`);
  const im = await run('u1-imagine', 300, () => { const i = __run.ctrl.info; return Math.abs(BM.betaMean(i.ta, i.tb) - 0.5) <= 0.06; });
  console.log(`u1-imagine: "leave it flat" accepted ${rate(im)}`);

  // ---------------- Units 2-6 ----------------
  const show = (id, rows, labels) => { for (const k of Object.keys(labels)) console.log(`${id}: "${labels[k]}" accepted ${rate(rows.map(x => x[k]))}`); };
  show('u2-peak', await run('u2-peak', 300, () => { const i = __run.ctrl.info; return { prior: i.i0 === i.ip, lik: i.il === i.ip, mid: Math.round((i.i0 + i.il) / 2) === i.ip, centre: i.ip === 5 }; }),
    { prior: 'the prior\u2019s peak', lik: 'the likelihood\u2019s peak', mid: 'halfway between them', centre: '50%' });
  show('u2-count', await run('u2-count', 300, () => { const i = __run.ctrl.info; return { half: Math.abs(0.5 - i.left) <= 0.1 }; }), { half: 'an even split' });
  show('u2-predict', await run('u2-predict', 300, () => { const i = __run.ctrl.info, ok = (lo, hi) => BM.pmfMass(i.P, lo, hi) >= 0.9 - 1e-9 && hi - lo <= i.hi - i.lo + 1; return { plug: ok(...i.plug), full: ok(0, 10), mid: ok(2, 8) }; }),
    { plug: 'plug in the average (ignore the uncertain share)', full: 'bracket everything, 0 to 10', mid: 'always 2 to 8' });
  show('u2-which', await run('u2-which', 300, () => { const i = __run.ctrl.info; return { first: i.answer === 0, widest: i.order[i.answer] === 'prior', narrow: i.order[i.answer] === 'plug' }; }),
    { first: 'always the first picture', widest: 'always the widest picture', narrow: 'always the narrowest picture' });
  show('u2-move', await run('u2-move', 300, () => ({ move: __run.ctrl.info.kind === 'up', stay: __run.ctrl.info.kind === 'down' })), { move: 'always move', stay: 'always stay' });
  show('u3-mean', await run('u3-mean', 300, () => { const i = __run.ctrl.info; return { centre: Math.abs(20 - i.mean) <= 1.5 && Math.abs(1 - i.sd) <= 0.3 * i.sd + 0.3, muOnly: Math.abs(1 - i.sd) <= 0.3 * i.sd + 0.3 }; }),
    { centre: 'leave it centred with the default spread', muOnly: 'get the typical value but leave the spread alone' });
  show('u3-fit', await run('u3-fit', 300, () => { const i = __run.ctrl.info, ym = i.ys.reduce((a, b) => a + b, 0) / i.ys.length, f = x => i.a + i.b * x; return { flat: Math.abs(ym - f(i.xr[0])) <= i.tol && Math.abs(ym - f(i.xr[1])) <= i.tol }; }), { flat: 'a flat line at the average' });
  show('u3-noise', await run('u3-noise', 300, () => { const s = __run.ctrl.info.sigma, ok = x => Math.abs(x - s) <= 0.3 * s + 0.3; return { zero: ok(0), mid: ok(4) }; }), { zero: 'sigma 0 (just the line)', mid: 'sigma in the middle of the slider' });
  show('u3-prior', await run('u3-prior', 300, () => { const i = __run.ctrl.info, ok = s => s >= i.lo && s <= i.hi; return { start: ok(0.8 * i.m), tight: ok(0.1 * i.m) }; }), { start: 'leave the slider where it starts', tight: 'a very tight prior' });
  show('u3-table', await run('u3-table', 300, () => { const i = __run.ctrl.info; return { est: i.ask === 'slopeEst', first: i.cell[0] === 0 }; }), { est: 'always tap the slope estimate', first: 'always tap the first row' });
  show('u3-fuzz', await run('u3-fuzz', 300, () => { const i = __run.ctrl.info, at = x => i.ask === 'most' ? Math.abs(x - i.far) <= 6 : Math.abs(x - i.xb) <= 5; return { left: at(0), right: at(40), mid: at(20) }; }), { left: 'always the far left', right: 'always the far right', mid: 'always the middle' });
  show('u3-centre', await run('u3-centre', 300, () => { const i = __run.ctrl.info; return { zero: Math.abs(0 - i.xb) <= 2, mid: Math.abs(20 - i.xb) <= 2 }; }), { zero: 'leave the marker at day 0', mid: 'the middle of the axis' });
  show('u4-land', await run('u4-land', 300, () => { const i = __run.ctrl.info, ok = x => Math.abs(x - i.truth) <= i.tol; return { raw: ok(i.m), half: ok((i.m + i.mu) / 2), all: ok(i.mu) }; }), { raw: 'leave the dot on the ring (no pooling)', half: 'halfway to the average', all: 'on the average (complete pooling)' });
  show('u4-most', await run('u4-most', 300, () => { const i = __run.ctrl.info; return { far: i.win === i.far, few: i.win === i.few, first: i.win === 0 }; }), { far: 'the tree farthest from the average', few: 'the tree with fewest branches', first: 'the first tree' });
  show('u4-amount', await run('u4-amount', 300, () => { const i = __run.ctrl.info, ok = x => Math.abs(x - i.s) <= 0.2; return { none: ok(0), all: ok(1), half: ok(0.5) }; }), { none: 'no pooling', all: 'complete pooling', half: 'half way' });
  show('u4-which', await run('u4-which', 300, () => ({ first: __run.ctrl.info.answer === 0 })), { first: 'always the first picture' });
  show('u5-intercept', await run('u5-intercept', 300, () => { const i = __run.ctrl.info, ok = y => Math.abs(y - i.int) <= 3; return { mid: ok((i.mA + i.mB) / 2), a: ok(i.mA), b: ok(i.mB) }; }), { mid: 'midway between the groups', a: 'feed A\u2019s average', b: 'feed B\u2019s average' });
  show('u5-slope', await run('u5-slope', 300, () => { const i = __run.ctrl.info, ok = h => Math.abs(h - i.h1) <= 0.2 * Math.abs(i.gap); return { gap: ok(i.int + i.gap), flat: ok(i.int), half: ok(i.int + i.gap / 2) }; }), { gap: 'slope = B minus A, whatever the coding', flat: 'no slope', half: 'always half the difference' });
  show('u5-name', await run('u5-name', 300, () => { const c = __run.ctrl.info.coding; return { sum: c === 'sum', trtA: c === 'trt-A' }; }), { sum: 'always the \u22121/+1 coding', trtA: 'always A = 0, B = 1' });
  show('u5-prior', await run('u5-prior', 300, () => { const i = __run.ctrl.info, ok = s => s >= i.lo && s <= i.hi; return { ignore: ok(0.5 * i.D / 1.96 * 1.0), start: ok(0.1 * i.D) }; }), { ignore: 'size the prior on the full difference, ignoring the coding', start: 'leave the slider at the start' });
  show('u6-trace', await run('u6-trace', 300, () => ({ first: __run.ctrl.info.answer === 0 })), { first: 'always the first plot' });
  show('u6-rhat', await run('u6-rhat', 300, () => ({ first: __run.ctrl.info.badRow === 0 })), { first: 'always the first row' });
  show('u6-share', await run('u6-share', 300, () => ({ half: Math.abs(0.5 - __run.ctrl.info.w) <= 0.1 })), { half: 'an even split' });
  show('u6-outgrow', await run('u6-outgrow', 300, () => { const i = __run.ctrl.info; return { few: 5 >= i.nStar && 5 <= i.nStar + 5, many: 60 >= i.nStar && 60 <= i.nStar + 5 }; }), { few: 'the fewest draws', many: 'the most draws' });
  await b.close();
})();
