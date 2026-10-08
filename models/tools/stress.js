// Many random questions per sub-level on the smallest phone: every one must fit, the correct answer (solve)
// must be accepted and a deliberately wrong one (solveWrong) refused.
//   NODE_PATH=... node tools/stress.js [questions=60] [only-id]
const { chromium } = require('playwright');
const N = Number(process.argv[2] || 60), ONLY = process.argv[3];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8203/index.html?seed=' + (Date.now() % 100000)); await page.evaluate(() => localStorage.clear()); await page.reload();
  const ids = await page.evaluate(() => UNITS.flatMap(u => u.subs).filter(s => s.kind === 'streak').map(s => s.id));
  let bad = 0;
  for (const id of ids.filter(i => !ONLY || i === ONLY)) {
    let misfit = 0, rejected = 0, accepted = 0, errs = [], why = [];
    await page.evaluate(id => openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)), id);
    for (let i = 0; i < N; i++) {
      await page.waitForSelector('#stage > *');
      const fit = async () => page.evaluate(() => { const b = document.getElementById('quiz-body'), s = document.getElementById('stage'), act = document.getElementById('quiz-action').getBoundingClientRect();
        let low = 0, wide = 0; for (const e of s.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { low = Math.max(low, r.bottom); if (r.right > innerWidth + 1 || r.left < -1) wide++; } }
        const o = b.scrollHeight - b.clientHeight > 1 || s.scrollHeight - s.clientHeight > 1 || document.documentElement.scrollWidth > innerWidth || low > act.top || wide > 0;
        return o ? { low: Math.round(low - act.top), wide, sh: s.scrollHeight - s.clientHeight } : null; });
      const wrongThis = i % 4 === 3;
      await page.evaluate(w => w ? __run.ctrl.solveWrong() : __run.ctrl.solve(), wrongThis);
      let f = await fit(); if (f) { misfit++; why.push('ready ' + JSON.stringify(f)); }
      await page.evaluate(() => document.getElementById('quiz-action').click());
      const good = await page.evaluate(() => document.getElementById('quiz-feedback').className.includes('good'));
      if (wrongThis && good) rejected++;
      if (!wrongThis && !good) { accepted++; errs.push(await page.textContent('#quiz-feedback')); }
      f = await fit(); if (f) { misfit++; why.push('answered ' + JSON.stringify(f)); }
      if (await page.evaluate(() => __run.finished)) await page.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
      else await page.evaluate(() => document.getElementById('quiz-action').click());
    }
    const fail = misfit || rejected || accepted; if (fail) bad++;
    console.log(`${fail ? 'FAIL' : 'PASS'} ${id}: ${N} questions, ${misfit} misfits, ${accepted} correct answers refused, ${rejected} wrong answers accepted${errs[0] ? ' | ' + errs[0] : ''}${why[0] ? ' | ' + why[0] : ''}`);
  }
  console.log(errors.length ? 'page errors: ' + errors.join('|') : 'no page errors'); await browser.close(); process.exit(bad || errors.length ? 1 : 0);
})();
