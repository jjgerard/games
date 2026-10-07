// Many random questions per sub-level on the smallest phone: every one must fit,
// and the correct answer (solve) must be accepted while a deliberately wrong one
// (solveWrong) must be refused. Run: NODE_PATH=... node tools/stress.js [questions=60]
const { chromium } = require('playwright');
const N = Number(process.argv[2] || 60);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8123/index.html?seed=' + (Date.now() % 100000)); await page.evaluate(() => localStorage.clear()); await page.reload();
  const ids = await page.evaluate(() => UNITS.flatMap(u => u.subs).filter(s => s.kind === 'streak').map(s => s.id));
  let bad = 0;
  for (const id of ids) {
    let misfit = 0, rejected = 0, accepted = 0, errs = [];
    await page.evaluate(id => openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)), id);
    for (let i = 0; i < N; i++) {
      await page.waitForSelector('#stage > *');
      const fit = async () => page.evaluate(() => { const b = document.getElementById('quiz-body'), s = document.getElementById('stage'); const bar = document.querySelector('#stage .sharebar'), bb = document.querySelector('#stage .beliefbar');
        return b.scrollHeight - b.clientHeight > 1 || s.scrollHeight - s.clientHeight > 1 || document.documentElement.scrollWidth > innerWidth || (bar && bar.getBoundingClientRect().height < 40) || (bb && bb.getBoundingClientRect().height < 68); });
      const wrongThis = i % 4 === 3; // every 4th question: answer wrongly, to check wrong answers are refused
      await page.evaluate(w => w ? __run.ctrl.solveWrong() : __run.ctrl.solve(), wrongThis);
      if (await fit()) misfit++;
      await page.evaluate(() => document.getElementById('quiz-action').click());
      const good = await page.evaluate(() => document.getElementById('quiz-feedback').className.includes('good'));
      if (wrongThis && good) rejected++;      // a wrong answer was accepted
      if (!wrongThis && !good) { accepted++; errs.push(await page.textContent('#quiz-feedback')); }
      if (await fit()) misfit++;
      if (await page.evaluate(() => __run.finished)) await page.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
      else await page.evaluate(() => document.getElementById('quiz-action').click());
    }
    const fail = misfit || rejected || accepted; if (fail) bad++;
    console.log(`${fail ? 'FAIL' : 'PASS'} ${id}: ${N} questions, ${misfit} misfits, ${accepted} correct answers refused, ${rejected} wrong answers accepted${errs[0] ? ' | ' + errs[0] : ''}`);
  }
  console.log(errors.length ? 'page errors: ' + errors.join('|') : 'no page errors'); await browser.close(); process.exit(bad || errors.length ? 1 : 0);
})();
