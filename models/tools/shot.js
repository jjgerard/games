// Screenshot one sub-level: node tools/shot.js <sub-id> <w> <h> <out.png> [reveal|wrong] [seed]
const { chromium } = require('playwright');
(async () => {
  const [id, w, h, out, mode, seed] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8203/index.html?seed=' + (seed || 5)); await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.evaluate((id) => { openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
  await p.waitForSelector('#stage > *');
  if (mode === 'wrong') await p.evaluate(() => __run.ctrl.solveWrong()); else await p.evaluate(() => __run.ctrl.solve());
  if (mode === 'reveal' || mode === 'wrong') { await p.click('#quiz-action'); }
  await p.screenshot({ path: out });
  const fit = await p.evaluate(() => { const b = document.getElementById('quiz-body'); return { over: b.scrollHeight - b.clientHeight, st: document.getElementById('stage').scrollHeight - document.getElementById('stage').clientHeight }; });
  console.log(id, JSON.stringify(fit), errs.join('|'));
  await b.close();
})();
