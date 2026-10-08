// Collects the R-check records (rcheck) of many random questions per sub-level, for tools/check-r.R.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/collect.js [perSub=30] [out=/tmp/claude-0/rchecks.json] [port=8202]
const { chromium } = require('playwright'); const fs = require('fs');
const N = Number(process.argv[2] || 30), OUT = process.argv[3] || '/tmp/claude-0/rchecks.json', PORT = process.argv[4] || 8202;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  await p.goto(`http://localhost:${PORT}/index.html?seed=${Date.now() % 100000}`); await p.evaluate(() => localStorage.clear()); await p.reload();
  const ids = await p.evaluate(() => UNITS.flatMap(u => u.subs).map(s => ({ id: s.id, kind: s.kind })));
  const all = [];
  for (const { id, kind } of ids) {
    await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
    for (let i = 0; i < (kind === 'tutorial' ? 1 : N); i++) {
      await p.waitForSelector('#stage > *');
      const rc = await p.evaluate(() => __run.ctrl.rcheck || []); for (const r of rc) all.push({ sub: id, ...r });
      if (kind === 'tutorial') break;
      await p.evaluate(() => __run.ctrl.solve()); await p.evaluate(() => document.getElementById('quiz-action').click());
      if (await p.evaluate(() => __run.finished)) await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id); else await p.evaluate(() => document.getElementById('quiz-action').click());
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(all)); console.log(`${all.length} R checks from ${ids.length} sub-levels -> ${OUT}`); await b.close();
})();
