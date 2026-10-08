// A playthrough through the real interface at three phone sizes, plus real pointer / keyboard tests of each interaction.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/play.js [port=8202]
const { chromium } = require('playwright');
const PORT = process.argv[2] || 8202, URL = `http://localhost:${PORT}/index.html`;
let fails = 0; const ok = (name, cond, detail = '') => { if (!cond) fails++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };
const click = (page, id) => page.evaluate(id => document.getElementById(id).click(), id);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ---- 1. full playthrough via the UI, all sub-levels, in order
  for (const [w, h, full] of [[360, 640, true], [320, 568, false], [414, 800, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=1'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.click('#btn-start'); await page.waitForSelector('#unit-grid .tile');
    const nUnits = await page.evaluate(() => UNITS.length);
    const locked0 = await page.evaluate(() => [...document.querySelectorAll('#unit-grid .tile.locked')].length);
    ok(`${w}x${h}: only unit 0 open at the start`, locked0 === nUnits - 1, `${locked0} locked of ${nUnits}`);
    const unitList = full ? [...Array(nUnits).keys()] : [0, 10];
    let problems = 0;
    for (const ui of unitList) {
      if (!full && ui === 10) await page.evaluate(() => { state.done = UNITS.slice(0, 10).flatMap(u => u.subs.map(s => s.id)); save(); renderUnits(); });
      await page.evaluate(() => { renderUnits(); showScreen('units'); });
      await page.evaluate(i => document.querySelectorAll('#unit-grid .tile:not(.part-head)')[i].click(), ui);
      const subs = await page.evaluate(() => currentUnit.subs.map(s => ({ id: s.id, kind: s.kind, target: s.target })));
      for (let k = 0; k < subs.length; k++) {
        const s = subs[k];
        const lockedNext = await page.evaluate(k => [...document.querySelectorAll('#sub-grid .tile')].map(t => t.classList.contains('locked')), k);
        if (lockedNext[k]) { problems++; console.log('  sub-level locked unexpectedly', s.id); break; }
        if (k + 1 < subs.length && !lockedNext[k + 1]) { problems++; console.log('  next sub-level open too early', s.id); }
        await page.click(`#sub-grid .tile:nth-child(${k + 1})`); await page.waitForSelector('#stage > *');
        const n = s.kind === 'tutorial' ? 1 : s.target;
        for (let q = 0; q < n; q++) {
          await page.evaluate(() => __run.ctrl.solve());
          if (s.kind === 'tutorial') break;
          await click(page, 'quiz-action'); // Check
          const good = await page.$eval('#quiz-feedback', e => e.className.includes('good'));
          if (!good) { problems++; console.log('  right answer refused', s.id, await page.$eval('#quiz-feedback', e => e.textContent)); }
          const fin = await page.evaluate(() => __run.finished);
          if (q < n - 1) { await click(page, 'quiz-action'); await page.waitForSelector('#stage > *'); }
        }
        const fin = await page.evaluate(() => __run.finished); if (!fin) { problems++; console.log('  not finished', s.id); }
        await click(page, 'quiz-action'); // back to sub-levels
        await page.waitForSelector('#sub-grid .tile');
      }
      const doneUnit = await page.evaluate(i => UNITS[i].subs.every(s => isDone(s.id)), ui); if (!doneUnit) problems++;
    }
    ok(`${w}x${h}: ${full ? 'every' : 'first of each part'} sub-level completes through the UI, locks and unlocks in order`, problems === 0, `${problems} problems`);
    if (full) { const pts = await page.evaluate(() => state.points), done = await page.evaluate(() => state.done.length); ok('progress and points saved', pts === done * 50, `${done} done, ${pts} pts`); await page.reload(); const d2 = await page.evaluate(() => state.done.length); ok('progress survives reload', d2 === done); }
    ok(`${w}x${h}: no page errors`, errors.length === 0, errors.join('|'));
    await ctx.close();
  }

  // ---- 2. real pointer and keyboard interaction
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: false }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=5'); await page.evaluate(() => localStorage.clear()); await page.reload();
    const open = async id => { await page.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id); await page.waitForSelector('#stage > *'); };
    const box = async sel => { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    // tap-to-assemble: tapping a tile fills the next gap, tapping the gap returns it
    await open('u3-call');
    const tiles = await page.$$eval('.ctile', ts => ts.map(t => t.textContent));
    await page.click('.ctile:has-text("sum")'); await page.waitForTimeout(50);
    const s1 = await page.$$eval('.slot', ss => ss.map(s => s.textContent));
    ok('tap a tile: it drops into the first empty gap', s1[0] === 'sum', JSON.stringify(s1));
    await page.click('.slot >> nth=0'); const s2 = await page.$$eval('.slot', ss => ss.map(s => s.textContent));
    ok('tap a filled gap: the tile goes back', s2[0] === '', JSON.stringify(s2));
    // drag a tile into the 2nd gap
    const tilePos = await box('.ctile:has-text("(")'), gap2 = await page.locator('.slot').nth(1).boundingBox();
    await page.mouse.move(tilePos.x, tilePos.y); await page.mouse.down(); await page.mouse.move(gap2.x + gap2.width / 2, gap2.y + gap2.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(50);
    const s3 = await page.$$eval('.slot', ss => ss.map(s => s.textContent));
    ok('drag a tile to a chosen gap', s3[1] === '(' && s3[0] === '', JSON.stringify(s3));
    ok('a drag does not also count as a tap', (await page.$$eval('.slot.full', s => s.length)) === 1);
    // keyboard: Tab to a tile, Enter
    await open('u3-call'); await page.focus('.ctile >> nth=0'); await page.keyboard.press('Enter'); await page.waitForTimeout(30);
    ok('keyboard: Enter on a tile places it', (await page.$$eval('.slot.full', s => s.length)) === 1);
    // fill: tap tile then cells; drag tile to cell
    await open('u6-frame');
    const t0 = await page.$$eval('.ctile', ts => ts.map(t => t.textContent));
    await page.click('.ctile >> nth=0'); await page.click('.gc.blank >> nth=0'); await page.waitForTimeout(30);
    ok('fill: tap a value tile then a cell', (await page.$$eval('.gc.fill', c => c.length)) === 1);
    const tp = await box('.ctile >> nth=1'), cell = await page.locator('.gc.blank').first().boundingBox();
    await page.mouse.move(tp.x, tp.y); await page.mouse.down(); await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(30);
    ok('fill: drag a value tile onto a cell', (await page.$$eval('.gc.fill', c => c.length)) === 2);
    await page.click('.gc.fill >> nth=0'); await page.waitForTimeout(30);
    ok('fill: tapping a filled cell clears it', (await page.$$eval('.gc.fill', c => c.length)) === 1);
    // pick: tap toggles; selected cells show a tick and a pressed state
    await open('u5-many'); await page.click('.gc >> nth=0'); await page.waitForTimeout(30);
    ok('pick: a tapped cell is marked selected (not colour alone)', (await page.$eval('.gc >> nth=0', e => e.classList.contains('sel') && e.getAttribute('aria-pressed') === 'true')));
    // count: + and -
    await open('t5-alone'); await page.click('.stepbtn >> nth=1'); await page.click('.stepbtn >> nth=1'); await page.click('.stepbtn >> nth=0');
    ok('count: plus, plus, minus gives 1 row', (await page.textContent('.binwrap .count')) === '1 row');
    // sort: tap chip then box, and drag a chip into a box
    await open('t5-boxes');
    await page.click('.rowchip2 >> nth=0'); await page.click('.boxbtn >> nth=0'); await page.waitForTimeout(30);
    const used1 = await page.$$eval('.rowchip2.used', c => c.length);
    const cp = await box('.rowchip2:not(.used) >> nth=0'), bp = await page.locator('.boxbtn').nth(1).boundingBox();
    await page.mouse.move(cp.x, cp.y); await page.mouse.down(); await page.mouse.move(bp.x + bp.width / 2, bp.y + bp.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(30);
    ok('sort: tap a row then a box; drag a row into a box', used1 === 1 && (await page.$$eval('.rowchip2.used', c => c.length)) === 2);
    // match
    await open('t10-translate'); await page.click('.mbtn >> nth=0'); await page.click('.mbtn >> nth=4'); await page.waitForTimeout(30);
    ok('match: tap one on each side links them with a number', (await page.$$eval('.mbtn .badge', b => b.length)) === 2);
    // belt tutorial and fold tutorial
    await open('t6-first'); await page.click('.runbtn'); await page.waitForTimeout(30); await page.click('.runbtn');
    await page.waitForFunction(() => __run.finished); ok('belt: run each step to finish', true);
    await open('t9-first'); await page.click('.runbtn'); await page.waitForFunction(() => __run.finished); ok('fold: one press finishes', true);
    // back button inside an activity returns to the sub-level list
    await page.evaluate(() => { closeActivity(); state.started = true; goUnits(); }); await page.click('#unit-grid .tile:not(.locked)'); await page.click('#sub-grid .tile:nth-child(1)'); await page.waitForSelector('#stage > *');
    await page.goBack(); await page.waitForTimeout(100);
    ok('browser Back leaves the activity', await page.evaluate(() => document.getElementById('quiz-overlay').classList.contains('hidden')));
    ok('no page errors in interaction tests', errors.length === 0, errors.join('|'));
    await ctx.close();
  }

  // ---- 3. help, menu, placement
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=9'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.click('.link-btn[data-help]'); ok('help dialog opens with focus inside', await page.evaluate(() => document.getElementById('help-overlay').contains(document.activeElement))); await page.keyboard.press('Escape');
    ok('Escape closes the dialog', await page.evaluate(() => document.getElementById('help-overlay').classList.contains('hidden')));
    // placement: all right -> last unit; first wrong -> unit 0
    await page.click('#btn-placement'); const np = await page.evaluate(() => PLACEMENT.length);
    for (let i = 0; i < np; i++) { await page.waitForSelector('#stage > *'); await page.evaluate(() => __run.ctrl.solve()); await click(page, 'quiz-action'); await click(page, 'quiz-action'); }
    await page.waitForFunction(() => __run.phase === 'result'); await click(page, 'quiz-action'); await page.waitForTimeout(100);
    const done1 = await page.evaluate(() => state.done.length), tot = await page.evaluate(() => UNITS.flatMap(u => u.subs).length), lastUnit = await page.evaluate(() => UNITS[UNITS.length - 1].subs.length);
    ok(`placement: all ${np} right starts at the last unit, earlier units marked done`, done1 === tot - lastUnit, `${done1} of ${tot}`);
    await page.evaluate(() => { state = { points: 0, done: [], started: false }; save(); goHome(); closeActivity(); });
    await page.click('#btn-placement');
    for (let i = 0; i < np; i++) { await page.waitForSelector('#stage > *'); await page.evaluate(i => i === 0 ? __run.ctrl.solveWrong() : __run.ctrl.solve(), i); await click(page, 'quiz-action'); await click(page, 'quiz-action'); }
    await page.waitForFunction(() => __run.phase === 'result'); await click(page, 'quiz-action'); await page.waitForTimeout(100);
    ok('placement: a first miss starts at unit 0 and marks nothing done', (await page.evaluate(() => state.done.length)) === 0);
    await page.evaluate(() => { state = { points: 0, done: [], started: false }; save(); goHome(); closeActivity(); });
    await page.click('#btn-placement');
    for (let i = 0; i < np; i++) { await page.waitForSelector('#stage > *'); await page.evaluate(i => i === 3 ? __run.ctrl.solveWrong() : __run.ctrl.solve(), i); await click(page, 'quiz-action'); await click(page, 'quiz-action'); }
    await page.waitForFunction(() => __run.phase === 'result'); await click(page, 'quiz-action'); await page.waitForTimeout(100);
    const exp = await page.evaluate(() => PLACEMENT[3].unit), got = await page.evaluate(() => UNITS.findIndex(u => !u.subs.every(s => isDone(s.id))));
    ok('placement: missing the 4th item starts at its (conservative) unit', exp === got, `expected unit ${exp}, first unfinished ${got}`);
    // hearts: wrong twice allowed, third wrong resets the streak
    await page.evaluate(() => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === 'u1-kind')); }); await page.waitForSelector('#stage > *');
    const seq = []; for (let i = 0; i < 4; i++) { await page.evaluate(() => __run.ctrl.solveWrong()); await click(page, 'quiz-action'); seq.push(await page.evaluate(() => __run.game.missesLeft + '/' + __run.game.streak)); await click(page, 'quiz-action'); await page.waitForSelector('#stage > *'); }
    ok('two hearts: misses 1 and 2 are forgiven, the 3rd resets', seq.join(',') === '1/0,0/0,2/0,1/0', seq.join(','));
    ok('no page errors in placement / help tests', errors.length === 0, errors.join('|'));
    await ctx.close();
  }
  await browser.close(); console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
})();
