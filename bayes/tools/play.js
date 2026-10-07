// Plays the whole game in a real browser at phone sizes. Run from bayes/:
//   (python3 -m http.server 8123 &) ; NODE_PATH=/opt/node22/lib/node_modules node tools/play.js
const { chromium } = require('playwright');
const SIZES = [[360, 640], [320, 568], [414, 800]];
const URL = 'http://localhost:8123/index.html';
let failures = 0;
const ok = (label, cond, extra = '') => { if (!cond) failures++; console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${cond ? '' : ' ' + extra}`); };

async function fits(page) {
  return page.evaluate(() => {
    const b = document.getElementById('quiz-body'), s = document.getElementById('stage');
    const over = [...b.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).length;
    return { v: b.scrollHeight - b.clientHeight, stage: s.scrollHeight - s.clientHeight, h: document.documentElement.scrollWidth - innerWidth, over };
  });
}
async function checkFit(page, label) {
  const f = await fits(page);
  ok(`fits ${label}`, f.v <= 1 && f.stage <= 1 && f.h <= 0 && f.over === 0, JSON.stringify(f));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: false });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(URL + '?seed=42'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.click('#btn-start');
    ok(`${tag} units screen`, await page.isVisible('#screen-units'));
    await page.click('#unit-grid .tile:not(.locked)');
    const subs = await page.$$eval('#sub-grid .tile', t => t.length);
    ok(`${tag} unit has 10 sub-levels`, subs === 10, String(subs));
    ok(`${tag} only the first sub-level is open`, (await page.$$eval('#sub-grid .tile:not(.locked)', t => t.length)) === 1);

    for (let i = 0; i < subs; i++) {
      await page.click(`#sub-grid .tile:nth-child(${i + 1})`);
      const sub = await page.evaluate(() => ({ id: __run.sub.id, kind: __run.sub.kind, name: __run.sub.name }));
      await page.waitForSelector('#stage > *');
      await checkFit(page, `${tag} ${sub.id} start`);
      if (sub.kind === 'tutorial') {
        await page.evaluate(() => __run.ctrl.solve());
        await page.waitForFunction(() => __run.finished);
        await checkFit(page, `${tag} ${sub.id} done`);
        await page.click('#quiz-action');
      } else {
        // one deliberate miss first: costs a heart, run goes on
        await page.evaluate(() => __run.ctrl.solveWrong());
        ok(`${tag} ${sub.id} check enabled when answered`, await page.isEnabled('#quiz-action'));
        await page.click('#quiz-action');
        const wrong = await page.evaluate(() => ({ cls: document.getElementById('quiz-feedback').className, hearts: __run.game.missesLeft, streak: __run.game.streak }));
        ok(`${tag} ${sub.id} wrong answer marked wrong, heart used`, wrong.cls.includes('bad') && wrong.hearts === 1 && wrong.streak === 0, JSON.stringify(wrong));
        await checkFit(page, `${tag} ${sub.id} after wrong answer`);
        await page.click('#quiz-action');
        for (let k = 0; k < 5; k++) {
          await page.evaluate(() => __run.ctrl.solve());
          await checkFit(page, `${tag} ${sub.id} q${k + 1} ready`);
          await page.click('#quiz-action');
          const good = await page.evaluate(() => document.getElementById('quiz-feedback').className);
          if (!good.includes('good')) ok(`${tag} ${sub.id} right answer accepted (q${k + 1})`, false, document.title);
          await checkFit(page, `${tag} ${sub.id} q${k + 1} revealed`);
          if (k < 4) await page.click('#quiz-action');
        }
        ok(`${tag} ${sub.id} finished after 5 right`, await page.evaluate(() => __run.finished));
        await page.click('#quiz-action');
      }
      await page.waitForSelector('#quiz-overlay.hidden', { state: 'attached' });
      const done = await page.$$eval('#sub-grid .tile.done', t => t.length);
      ok(`${tag} ${sub.id} marked done (${done}/${subs})`, done === i + 1);
    }
    ok(`${tag} points awarded`, (await page.evaluate(() => JSON.parse(localStorage.getItem('bayes:v1')).points)) === 500);
    ok(`${tag} no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // Real pointer interaction: drag the divider on the tutorial bar.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); await page.goto(URL + '?seed=1'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.click('#btn-start'); await page.click('#unit-grid .tile:not(.locked)');
    // the second tile unlocks once the first is done
    await page.click('#sub-grid .tile:nth-child(1)'); await page.evaluate(() => __run.ctrl.solve()); await page.click('#quiz-action');
    await page.click('#sub-grid .tile:nth-child(2)');
    const bar = await page.$('.sharebar'); const box = await bar.boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 5 });
    const mid = await page.evaluate(() => Number(document.querySelector('.sharebar').getAttribute('aria-valuenow')));
    ok('pointer drag moves the divider', mid >= 75 && mid <= 85, String(mid));
    await page.mouse.move(box.x + box.width * 0.99, box.y + box.height / 2, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(() => __run.finished);
    ok('dragging to the end completes the tutorial', true);
    // keyboard
    await page.click('#quiz-action'); await page.click('#sub-grid .tile:nth-child(3)');
    await page.focus('.sharebar'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    ok('arrow keys move the divider', (await page.evaluate(() => Number(document.querySelector('.sharebar').getAttribute('aria-valuenow')))) === 60);
    await ctx.close();
  }

  // Placement: all right, then a miss on the third.
  for (const plan of ['allright', 'missthird']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=7'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.click('#btn-placement');
    for (let i = 0; i < 6; i++) {
      await page.waitForSelector('#stage > *');
      await page.evaluate((wrong) => wrong ? __run.ctrl.solveWrong() : __run.ctrl.solve(), plan === 'missthird' && i === 2);
      await checkFit(page, `placement ${plan} item ${i + 1}`);
      await page.click('#quiz-action'); await checkFit(page, `placement ${plan} item ${i + 1} after`);
      await page.click('#quiz-action');
    }
    const txt = await page.textContent('#stage');
    ok(`placement ${plan} result shown`, plan === 'allright' ? /every picture right/.test(txt) : /Flip it/.test(txt), txt);
    await page.click('#quiz-action');
    await page.waitForSelector('#screen-unit:not(.hidden)');
    const doneCount = await page.$$eval('#sub-grid .tile.done', t => t.length);
    ok(`placement ${plan} marks skipped sub-levels done`, plan === 'allright' ? doneCount === 10 : doneCount === 5, String(doneCount));
    ok(`placement ${plan} awards no points`, (await page.evaluate(() => JSON.parse(localStorage.getItem('bayes:v1')).points)) === 0);
    ok(`placement ${plan} no page errors`, errors.length === 0, errors.join('|'));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
