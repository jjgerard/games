// Plays the whole game in a real browser at phone sizes. Run from models/:
//   (python3 -m http.server 8203 &) ; NODE_PATH=/opt/node22/lib/node_modules node tools/play.js
const { chromium } = require('playwright');
const SIZES = [[360, 640], [320, 568], [414, 800]];
const URL = 'http://localhost:8203/index.html';
let failures = 0;
const ok = (label, cond, extra = '') => { if (!cond) failures++; console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${cond ? '' : ' ' + extra}`); };

// Does the whole question, answer state and Check button fit on the screen with no scrolling?
async function fits(page) {
  return page.evaluate(() => {
    const b = document.getElementById('quiz-body'), s = document.getElementById('stage'), act = document.getElementById('quiz-action').getBoundingClientRect();
    let low = 0, wide = 0; for (const e of s.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0) { low = Math.max(low, r.bottom); if (r.right > innerWidth + 1 || r.left < -1) wide++; } }
    return { v: b.scrollHeight - b.clientHeight, stage: s.scrollHeight - s.clientHeight, h: document.documentElement.scrollWidth - innerWidth, under: Math.round(low - act.top), wide, act: Math.round(act.bottom - innerHeight) };
  });
}
async function checkFit(page, label) {
  const f = await fits(page);
  ok(`fits ${label}`, f.v <= 1 && f.stage <= 1 && f.h <= 0 && f.under <= 0 && f.wide === 0 && f.act <= 0, JSON.stringify(f));
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
    ok(`${tag} levels screen`, await page.isVisible('#screen-levels, #screen-units'));
    const units = await page.evaluate(() => UNITS.map(u => ({ n: u.subs.length, title: u.title })));
    ok(`${tag} ${units.length} levels in two parts`, units.length === 16 && (await page.$$eval('#unit-grid .part-head', t => t.length)) === 2);
    ok(`${tag} only the first level is open`, (await page.$$eval('#unit-grid .tile:not(.locked)', t => t.length)) === 1);
    let total = 0;
    for (let u = 0; u < units.length; u++) {
      await page.click(`#unit-grid .tile:not(.locked) >> nth=${u}`);
      const subs = await page.$$eval('#sub-grid .tile', t => t.length);
      ok(`${tag} level ${u + 1} has ${units[u].n} sub-levels`, subs === units[u].n, String(subs));
      ok(`${tag} level ${u + 1}: only the first sub-level is open`, (await page.$$eval('#sub-grid .tile:not(.locked)', t => t.length)) === 1);
      for (let i = 0; i < subs; i++) {
        await page.click(`#sub-grid .tile:nth-child(${i + 1})`);
        const sub = await page.evaluate(() => ({ id: __run.sub.id, kind: __run.sub.kind, target: __run.sub.target }));
        await page.waitForSelector('#stage > *');
        await checkFit(page, `${tag} ${sub.id} start`);
        if (sub.kind === 'tutorial') {
          await page.evaluate(() => __run.ctrl.solve());
          await page.waitForFunction(() => __run.finished);
          await checkFit(page, `${tag} ${sub.id} done`);
          await page.evaluate(() => document.getElementById('quiz-action').click());
        } else {
          await page.evaluate(() => __run.ctrl.solveWrong());
          if (!(await page.isEnabled('#quiz-action'))) ok(`${tag} ${sub.id} check enabled when answered`, false);
          await page.evaluate(() => document.getElementById('quiz-action').click());
          const wrong = await page.evaluate(() => ({ cls: document.getElementById('quiz-feedback').className, hearts: __run.game.missesLeft, streak: __run.game.streak }));
          ok(`${tag} ${sub.id} wrong answer marked wrong, heart used`, wrong.cls.includes('bad') && wrong.hearts === 1 && wrong.streak === 0, JSON.stringify(wrong));
          await checkFit(page, `${tag} ${sub.id} after wrong answer`);
          await page.evaluate(() => document.getElementById('quiz-action').click());
          for (let k = 0; k < sub.target; k++) {
            await page.evaluate(() => __run.ctrl.solve());
            await checkFit(page, `${tag} ${sub.id} q${k + 1} ready`);
            await page.evaluate(() => document.getElementById('quiz-action').click());
            const good = await page.evaluate(() => document.getElementById('quiz-feedback').className);
            if (!good.includes('good')) ok(`${tag} ${sub.id} right answer accepted (q${k + 1})`, false, await page.textContent('#quiz-feedback'));
            await checkFit(page, `${tag} ${sub.id} q${k + 1} revealed`);
            if (k < sub.target - 1) await page.evaluate(() => document.getElementById('quiz-action').click());
          }
          ok(`${tag} ${sub.id} finished after ${sub.target} right`, await page.evaluate(() => __run.finished));
          await page.evaluate(() => document.getElementById('quiz-action').click());
        }
        await page.waitForSelector('#quiz-overlay.hidden', { state: 'attached' });
        const done = await page.$$eval('#sub-grid .tile.done', t => t.length);
        if (done !== i + 1) ok(`${tag} ${sub.id} marked done (${done}/${i + 1})`, false);
        total++;
      }
      await page.click('#screen-unit [data-back]');
      const doneUnits = await page.$$eval('#unit-grid .tile.done', t => t.length);
      if (doneUnits !== u + 1) ok(`${tag} level ${u + 1} marked done`, false, String(doneUnits));
    }
    ok(`${tag} all ${total} sub-levels played`, total === units.reduce((s, x) => s + x.n, 0));
    ok(`${tag} points awarded`, (await page.evaluate(() => JSON.parse(localStorage.getItem('models:v1')).points)) === 50 * total);
    ok(`${tag} no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // Real pointer and keyboard interaction.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL + '?seed=1'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.click('#btn-start'); await page.click('#unit-grid .tile:not(.locked)');
    await page.click('#sub-grid .tile:nth-child(1)'); await page.waitForSelector('#stage .handle');
    const g = await page.$('#stage .handle'); let box = await g.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const svg = await (await page.$('#stage svg.plot')).boundingBox();
    await page.mouse.move(svg.x + svg.width * 0.6, box.y + box.height / 2, { steps: 6 });
    const mid = await page.evaluate(() => Number(document.querySelector('#stage .handle').getAttribute('aria-valuenow')));
    ok('pointer drag moves the handle', mid > 3 && mid < 7.4, String(mid));
    await page.mouse.move(svg.x + svg.width * 0.97, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
    ok('dragging to the end finishes the tutorial', await page.evaluate(() => __run.finished));
    // keyboard: second sub-level, arrow keys on the handle
    await page.click('#quiz-action'); await page.click('#sub-grid .tile:nth-child(2)'); await page.waitForSelector('#stage .handle');
    await page.focus('#stage .handle'); const before = await page.evaluate(() => Number(document.querySelector('#stage .handle').getAttribute('aria-valuenow')));
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
    const after = await page.evaluate(() => Number(document.querySelector('#stage .handle').getAttribute('aria-valuenow')));
    ok('arrow keys move the handle', Math.abs(after - before) > 0.05, `${before} -> ${after}`);
    ok('Check enabled after moving', await page.isEnabled('#quiz-action'));
    ok('no page errors (pointer test)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  // A real tap on a table cell and a choice button.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL + '?seed=2'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.evaluate(() => { openActivity(UNITS[4].subs[0]); }); await page.waitForSelector('#stage .mtcell.flash');
    await page.click('#stage .mtcell.flash');
    ok('tapping the flashing table cell finishes the tutorial', await page.evaluate(() => __run.finished));
    await page.evaluate(() => { closeActivity(); openActivity(UNITS[2].subs[2]); }); await page.waitForSelector('#stage .choice');
    await page.click('#stage .choice >> nth=0');
    ok('tapping a choice enables Check', await page.isEnabled('#quiz-action'));
    ok('no page errors (tap test)', errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  // The placement test, once all-right and once with a first miss.
  for (const mode of ['right', 'wrong']) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL + '?seed=3'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.click('#btn-placement');
    const n = await page.evaluate(() => PLACEMENT.length);
    for (let i = 0; i < n; i++) {
      await page.waitForSelector('#stage > *'); await checkFit(page, `placement ${mode} item ${i + 1}`);
      await page.evaluate(([m, i]) => m === 'right' || i > 0 ? __run.ctrl.solve() : __run.ctrl.solveWrong(), [mode, i]);
      await page.click('#quiz-action'); await page.click('#quiz-action');
    }
    const txt = await page.textContent('#stage');
    ok(`placement ${mode}: result shown`, /right|Everything/.test(txt), txt.slice(0, 80));
    await page.click('#quiz-action');
    const done = await page.$$eval('#unit-grid .tile.done', t => t.length).catch(() => -1);
    const subsDone = await page.evaluate(() => JSON.parse(localStorage.getItem('models:v1')).done.length);
    ok(`placement ${mode}: ${mode === 'right' ? 'skips levels 1-9' : 'starts at level 1'}`, mode === 'right' ? subsDone > 20 : subsDone === 0, String(subsDone));
    ok(`placement ${mode}: no page errors`, errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `${failures} FAILURES` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
