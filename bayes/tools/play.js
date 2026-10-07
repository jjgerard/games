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

  // "Inside a group" varies: all eight (group, property) questions appear, never the same one twice running, and each fits.
  for (const id of ['u0-inside', 'u0-flip']) {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=11'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.evaluate(id => { openActivity(UNITS[0].subs.find(s => s.id === id)); }, id);
    const seen = new Set(); let repeats = 0, last = null, misfit = 0, bad = 0;
    for (let i = 0; i < 70; i++) {
      const pair = await page.evaluate(() => __run.ctrl.pair.join());
      if (pair === last) repeats++; last = pair;
      if (!seen.has(pair)) { seen.add(pair); const f = await fits(page); if (f.v > 1 || f.stage > 1 || f.over) misfit++; }
      await page.evaluate(() => __run.ctrl.solve()); await page.click('#quiz-action');
      if (!(await page.$eval('#quiz-feedback', e => e.className.includes('good')))) bad++;
      const f2 = await fits(page); if (f2.v > 1 || f2.stage > 1 || f2.over) misfit++;
      if (await page.evaluate(() => __run.finished)) await page.evaluate(id => { closeActivity(); openActivity(UNITS[0].subs.find(s => s.id === id)); }, id);
      else await page.click('#quiz-action');
    }
    ok(`${id}: all 8 group/property questions appear`, seen.size === 8, [...seen].join(' '));
    ok(`${id}: never the same question twice in a row`, repeats === 0, String(repeats));
    ok(`${id}: every variant fits 320x568 (before and after checking)`, misfit === 0, String(misfit));
    ok(`${id}: correct answers accepted for every variant`, bad === 0, String(bad));
    ok(`${id}: no page errors`, errors.length === 0, errors.join('|'));
    await ctx.close();
  }

  // Drawing is a drag out of the bag, and the tile flashes until picked up.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=3'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.evaluate(() => openActivity(UNITS[0].subs[0]));
    await page.waitForSelector('.peek');
    // flash: sample the real background across two cycles, as for the scissors
    const samples = []; for (let i = 0; i < 44; i++) { samples.push(await page.evaluate(() => getComputedStyle(document.querySelector('.peek')).backgroundColor)); await page.waitForTimeout(50); }
    const parse = c => c.match(/\d+/g).map(Number); const redish = c => { const [r, g] = parse(c); return r > 170 && g < 110; }; const grey = c => { const [r, g] = parse(c); return r > 190 && g > 180; };
    const redShare = samples.filter(redish).length / samples.length, greyShare = samples.filter(grey).length / samples.length;
    ok('tile flashes red for over a quarter of the time', redShare > 0.25, String(redShare));
    ok('tile rests grey for over a quarter of the time', greyShare > 0.25, String(greyShare));
    const box = async sel => (await page.$(sel)).boundingBox();
    const peek = await box('.peek'), bag = await box('.bagdraw svg');
    // a plain tap does not draw
    await page.mouse.click(peek.x + peek.width / 2, peek.y + peek.height / 2);
    ok('a tap does not draw', !(await page.evaluate(() => __run.finished)));
    ok('a tap explains what to do', /Drag/.test(await page.textContent('.draghint')));
    ok('flash stops once picked up', !(await page.$eval('.peek', e => e.classList.contains('flash'))));
    // dropping back inside the bag does not draw
    await page.mouse.move(peek.x + peek.width / 2, peek.y + peek.height / 2); await page.mouse.down();
    await page.mouse.move(bag.x + bag.width / 2, bag.y + bag.height * 0.7, { steps: 6 });
    ok('a ghost tile follows the pointer', await page.$('.drag-ghost') !== null);
    await page.mouse.up();
    ok('dropping it back inside the bag does not draw', !(await page.evaluate(() => __run.finished)) && await page.$('.drag-ghost') === null);
    // dragging out and letting go outside draws
    await page.mouse.move(peek.x + peek.width / 2, peek.y + peek.height / 2); await page.mouse.down();
    await page.mouse.move(bag.x + bag.width / 2, bag.y + bag.height + 60, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => __run.finished);
    ok('dragging it out of the bag draws a shape', (await page.$$('.tray svg')).length === 1);
    ok('drawing the first shape completes the tutorial', true);
    // keyboard: Enter on the tile draws (second visit)
    await page.evaluate(() => { closeActivity(); openActivity(UNITS[0].subs[0]); });
    await page.waitForSelector('.peek'); await page.focus('.peek'); await page.keyboard.press('Enter');
    ok('Enter on the focused tile draws', await page.evaluate(() => __run.finished));
    // share level, closed bag: drag several out and the tally fills
    await page.evaluate(() => { closeActivity(); seedCounter = 0; openActivity(UNITS[0].subs[2]); });
    for (let tries = 0; tries < 6 && !(await page.$('.peek')); tries++) await page.evaluate(() => { closeActivity(); openActivity(UNITS[0].subs[2]); });
    if (await page.$('.peek')) {
      for (let i = 0; i < 3; i++) {
        const p = await box('.peek'), b = await box('.bagdraw svg');
        await page.mouse.move(p.x + p.width / 2, p.y + p.height / 2); await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height + 40, { steps: 6 }); await page.mouse.up();
      }
      ok('three drags put three shapes in the tally', (await page.$$('.tallycol svg')).length === 3);
    } else ok('closed-bag variant reachable', false);
    ok('drag tests: no page errors', errors.length === 0, errors.join('|'));
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
