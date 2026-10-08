// Screenshot one sub-level: node tools/shot.js <id> [w] [h] [solve|check|wrong] [seed]  -> /tmp/claude-0/shot.png
const { chromium } = require('playwright');
(async () => {
  const [id, w = 320, h = 568, mode = '', seed = 5] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await p.goto(`http://localhost:8202/index.html?seed=${seed}`); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(id => openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)), id);
  await p.waitForSelector('#stage > *');
  if (mode === 'solve' || mode === 'check' || mode === 'wrong') await p.evaluate(m => m === 'wrong' ? __run.ctrl.solveWrong() : __run.ctrl.solve(), mode);
  if (mode === 'check' || mode === 'wrong') await p.evaluate(() => document.getElementById('quiz-action').click());
  await p.waitForTimeout(150);
  const m = await p.evaluate(() => { const s = document.getElementById('stage'), b = document.getElementById('quiz-body'); return { stageH: s.clientHeight, stageScroll: s.scrollHeight, bodyScroll: b.scrollHeight - b.clientHeight }; });
  console.log(JSON.stringify(m));
  await p.screenshot({ path: '/tmp/claude-0/shot.png' }); await b.close();
})();
