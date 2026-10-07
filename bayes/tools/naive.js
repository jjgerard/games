// How often would a tempting wrong strategy be accepted? Low numbers are good.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  await p.goto('http://localhost:8123/index.html?seed=' + (Date.now() % 99999)); await p.evaluate(() => localStorage.clear()); await p.reload();
  const run = async (id, n, f) => {
    await p.evaluate(id => openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)), id);
    const out = []; for (let i = 0; i < n; i++) { await p.waitForSelector('#stage > *'); out.push(await p.evaluate(f)); await p.evaluate(() => __run.ctrl.solve()); await p.evaluate(() => document.getElementById('quiz-action').click());
      if (await p.evaluate(() => __run.finished)) await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id); else await p.evaluate(() => document.getElementById('quiz-action').click()); }
    return out;
  };
  const rate = a => (100 * a.filter(Boolean).length / a.length).toFixed(0) + '%';
  const l1 = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);
  const prod = await run('u1-product', 300, () => { const i = __run.ctrl.info; const u = i.expected.map(() => 2.5);
    return { prior: l1(i.prior.map(x => Math.round(x)), i.expected) <= 3, lik: l1(i.lik.map(x => Math.round(x)), i.expected) <= 3, uniform: l1(u, i.expected) <= 3 }; });
  for (const k of ['prior', 'lik', 'uniform']) console.log(`u1-product: "${k === 'prior' ? 'follow only the shelf' : k === 'lik' ? 'follow only the draw' : 'spread chips evenly'}" would be accepted ${rate(prod.map(x => x[k]))} of the time`);
  const pri = await run('u1-prior', 300, () => { const i = __run.ctrl.info; return l1(i.expected.map(() => 2.5), i.expected) <= 2; });
  console.log(`u1-prior: "spread chips evenly" accepted ${rate(pri)}`);
  const sh = await run('u1-shift', 300, () => { const i = __run.ctrl.info; return { half: Math.abs(0.5 - i.mean) <= 0.06, prior: Math.abs(i.priorMean - i.mean) <= 0.06, real: Math.abs(i.realShare - i.mean) <= 0.06 }; });
  for (const k of ['half', 'prior', 'real']) console.log(`u1-shift: "${k === 'half' ? 'just say 50%' : k === 'prior' ? 'ignore the real draws' : 'ignore the imagined shapes'}" accepted ${rate(sh.map(x => x[k]))}`);
  const im = await run('u1-imagine', 300, () => { const i = __run.ctrl.info; return Math.abs(BM.betaMean(i.ta, i.tb) - 0.5) <= 0.06; });
  console.log(`u1-imagine: "leave it flat" accepted ${rate(im)}`);
  await b.close();
})();
