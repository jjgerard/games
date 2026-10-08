// Screenshot one sub-level: PORT=8201 node tools/shot.js <sub-id> <w> <h> <out.png> [reveal] [seed]
// Prints whether the stage overflows (the no-scroll rule) before and after checking.
const { chromium } = require('playwright');
(async () => {
  const [id, w, h, out, reveal, seed] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await p.goto('http://localhost:' + (process.env.PORT || 8123) + '/index.html?seed=' + (seed || 5)); await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.evaluate((id) => { openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
  await p.waitForSelector('#stage > *'); await p.evaluate(() => __run.ctrl.solve());
  const over = () => p.evaluate(() => { const s = document.getElementById('stage'), q = document.getElementById('quiz-body'); return { stageOver: s.scrollHeight - s.clientHeight, bodyOver: q.scrollHeight - q.clientHeight, stageH: Math.round(s.clientHeight) }; });
  console.log('before check', JSON.stringify(await over()));
  if (reveal) { await p.click('#quiz-action'); console.log('after check', JSON.stringify(await over()), await p.textContent('#quiz-feedback')); }
  await p.screenshot({ path: out }); await b.close();
})();
