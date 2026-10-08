// Collects the inputs and the answer key of many generated questions from the running game
// (Units 2-6) and prints them as JSON, for tools/check-keys.R to recompute independently in R.
//   PORT=8201 NODE_PATH=/opt/node22/lib/node_modules node tools/check-keys.js [per-level=40] | Rscript tools/check-keys.R
const { chromium } = require('playwright');
const N = Number(process.argv[2] || 40);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  await p.goto('http://localhost:' + (process.env.PORT || 8123) + '/index.html?seed=' + (Date.now() % 99999));
  const ids = await p.evaluate(() => UNITS.slice(2).flatMap(u => u.subs).filter(s => s.kind === 'streak').map(s => s.id));
  const out = {};
  for (const id of ids) {
    await p.evaluate(id => openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)), id); out[id] = [];
    for (let i = 0; i < N; i++) {
      await p.waitForSelector('#stage > *');
      out[id].push(await p.evaluate(() => JSON.parse(JSON.stringify(__run.ctrl.info || null))));
      await p.evaluate(() => __run.ctrl.solve()); await p.evaluate(() => document.getElementById('quiz-action').click());
      if (await p.evaluate(() => __run.finished)) await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
      else await p.evaluate(() => document.getElementById('quiz-action').click());
    }
  }
  console.log(JSON.stringify(out)); await b.close();
})();
