// Screenshot one sub-level: node tools/shot.js <sub-id> <w> <h> <out.png> [reveal]
const { chromium } = require('playwright');
(async () => {
  const [id, w, h, out, reveal] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
  await p.goto('http://localhost:8123/index.html?seed=5'); await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.evaluate((id) => { openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
  await p.waitForSelector('#stage > *'); await p.evaluate(() => __run.ctrl.solve());
  if (reveal) { await p.click('#quiz-action'); }
  await p.screenshot({ path: out }); await b.close();
})();
