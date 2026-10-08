// Many random questions per sub-level on the smallest phone (and the others): every one must fit without scrolling,
// the correct answer (solve) must be accepted and a deliberately wrong one (solveWrong) refused.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/stress.js [questions=40] [port=8202] [onlyId]
const { chromium } = require('playwright');
const N = Number(process.argv[2] || 40), PORT = process.argv[3] || 8202, ONLY = process.argv[4];
const SIZES = [[320, 568], [360, 640], [414, 800]];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let bad = 0;
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/index.html?seed=${Date.now() % 100000}`); await page.evaluate(() => localStorage.clear()); await page.reload();
    const ids = await page.evaluate(() => UNITS.flatMap(u => u.subs).map(s => ({ id: s.id, kind: s.kind })));
    for (const { id, kind } of ids) {
      if (ONLY && id !== ONLY) continue;
      let misfit = 0, rej = 0, acc = 0, errs = [], examples = [];
      const reopen = () => page.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id);
      await reopen();
      const fit = () => page.evaluate(() => { const b = document.getElementById('quiz-body'), s = document.getElementById('stage'), a = document.getElementById('quiz-action').getBoundingClientRect(), o = document.querySelector('#quiz-overlay .editor').getBoundingClientRect();
        if (b.scrollHeight - b.clientHeight > 1) return 'body scrolls by ' + (b.scrollHeight - b.clientHeight);
        if (s.scrollHeight - s.clientHeight > 1) return 'stage scrolls by ' + (s.scrollHeight - s.clientHeight);
        if (document.documentElement.scrollWidth > innerWidth) return 'page wider than screen';
        if (a.bottom > o.bottom + 1) return 'check button off screen';
        const wide = [...s.querySelectorAll('*')].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); });
        return wide ? 'overflows sideways: ' + wide.tagName + '.' + wide.className : ''; });
      const n = kind === 'tutorial' ? 1 : N;
      for (let i = 0; i < n; i++) {
        try {
          await page.waitForSelector('#stage > *', { timeout: 3000 });
          const wrong = kind !== 'tutorial' && i % 4 === 3;
          { const f = await fit(); if (f) { misfit++; if (examples.length < 1) examples.push('before: ' + f); } }
          await page.evaluate(wr => wr ? __run.ctrl.solveWrong() : __run.ctrl.solve(), wrong);
          if (kind === 'tutorial') { const fin = await page.evaluate(() => __run.finished); if (!fin) { errs.push('tutorial did not complete'); } break; }
          const ready = await page.evaluate(() => !document.getElementById('quiz-action').disabled);
          if (!ready) { errs.push('check button not enabled after solve'); await reopen(); continue; }
          const j = await page.evaluate(() => __run.ctrl.judge()); if (j === wrong) errs.push(wrong ? 'wrong answer judged right' : 'right answer judged wrong');
          await page.evaluate(() => document.getElementById('quiz-action').click());
          const good = await page.$eval('#quiz-feedback', e => e.className.includes('good'));
          if (wrong ? good : !good) errs.push(wrong ? 'wrong accepted' : 'right refused: ' + document_msg(await page.$eval('#quiz-feedback', e => e.textContent)));
          wrong ? (good ? 0 : rej++) : (good ? acc++ : 0);
          { const f = await fit(); if (f) { misfit++; if (examples.length < 2) examples.push('after: ' + f); } }
          if (await page.evaluate(() => __run.finished)) await reopen(); else await page.evaluate(() => document.getElementById('quiz-action').click());
        } catch (e) { errs.push(String(e.message).slice(0, 120)); await reopen(); }
      }
      const prob = misfit || errs.length; if (prob) bad++;
      console.log(`${w}x${h} ${id.padEnd(14)} ${prob ? 'FAIL' : 'ok  '} fit-miss ${misfit}${examples.length ? ' (' + examples[0] + ')' : ''} accepted ${acc} refused ${rej}${errs.length ? ' errors: ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''}`);
    }
    if (errors.length) { bad++; console.log('PAGE ERRORS', errors.slice(0, 3)); }
    await ctx.close();
  }
  await browser.close(); console.log(bad ? `${bad} sub-level(s) with problems` : 'all ok'); process.exit(bad ? 1 : 0);
})();
function document_msg(s) { return s.slice(0, 80); }
