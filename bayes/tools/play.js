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
    const bar = document.querySelector('#stage .sharebar'), bb = document.querySelector('#stage .beliefbar'); const squashed = (bar && bar.getBoundingClientRect().height < 40) || (bb && bb.getBoundingClientRect().height < 68) ? 1 : 0;
    return { v: b.scrollHeight - b.clientHeight, stage: s.scrollHeight - s.clientHeight, h: document.documentElement.scrollWidth - innerWidth, over: over + squashed };
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
        await page.evaluate(() => document.getElementById('quiz-action').click());
      } else {
        // one deliberate miss first: costs a heart, run goes on
        await page.evaluate(() => __run.ctrl.solveWrong());
        ok(`${tag} ${sub.id} check enabled when answered`, await page.isEnabled('#quiz-action'));
        await page.evaluate(() => document.getElementById('quiz-action').click());
        const wrong = await page.evaluate(() => ({ cls: document.getElementById('quiz-feedback').className, hearts: __run.game.missesLeft, streak: __run.game.streak }));
        ok(`${tag} ${sub.id} wrong answer marked wrong, heart used`, wrong.cls.includes('bad') && wrong.hearts === 1 && wrong.streak === 0, JSON.stringify(wrong));
        await checkFit(page, `${tag} ${sub.id} after wrong answer`);
        await page.evaluate(() => document.getElementById('quiz-action').click());
        for (let k = 0; k < 5; k++) {
          await page.evaluate(() => __run.ctrl.solve());
          await checkFit(page, `${tag} ${sub.id} q${k + 1} ready`);
          await page.evaluate(() => document.getElementById('quiz-action').click());
          const good = await page.evaluate(() => document.getElementById('quiz-feedback').className);
          if (!good.includes('good')) ok(`${tag} ${sub.id} right answer accepted (q${k + 1})`, false, document.title);
          await checkFit(page, `${tag} ${sub.id} q${k + 1} revealed`);
          if (k < 4) await page.evaluate(() => document.getElementById('quiz-action').click());
        }
        ok(`${tag} ${sub.id} finished after 5 right`, await page.evaluate(() => __run.finished));
        await page.evaluate(() => document.getElementById('quiz-action').click());
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
    await page.click('#sub-grid .tile:nth-child(1)'); await page.evaluate(() => __run.ctrl.solve()); await page.evaluate(() => document.getElementById('quiz-action').click());
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
    await page.evaluate(() => document.getElementById('quiz-action').click()); await page.click('#sub-grid .tile:nth-child(3)');
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
      await page.evaluate(() => __run.ctrl.solve()); await page.evaluate(() => document.getElementById('quiz-action').click());
      if (!(await page.$eval('#quiz-feedback', e => e.className.includes('good')))) bad++;
      const f2 = await fits(page); if (f2.v > 1 || f2.stage > 1 || f2.over) misfit++;
      if (await page.evaluate(() => __run.finished)) await page.evaluate(id => { closeActivity(); openActivity(UNITS[0].subs.find(s => s.id === id)); }, id);
      else await page.evaluate(() => document.getElementById('quiz-action').click());
    }
    ok(`${id}: all 8 group/property questions appear`, seen.size === 8, [...seen].join(' '));
    ok(`${id}: never the same question twice in a row`, repeats === 0, String(repeats));
    ok(`${id}: every variant fits 320x568 (before and after checking)`, misfit === 0, String(misfit));
    ok(`${id}: correct answers accepted for every variant`, bad === 0, String(bad));
    ok(`${id}: no page errors`, errors.length === 0, errors.join('|'));
    await ctx.close();
  }

  // Rare bags: a small shelf (4 or 5 bags) with a genuinely rare kind.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=13'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.evaluate(() => openActivity(UNITS[0].subs.find(s => s.id === 'u0-rare')));
    const sizes = new Set(); let rareOk = true, misfit = 0;
    for (let i = 0; i < 60; i++) {
      await page.waitForSelector('.shelf');
      const s = await page.$$eval('.shelf svg', n => ({ A: n.filter(x => x.getAttribute('aria-label') === 'bag A').length, B: n.filter(x => x.getAttribute('aria-label') === 'bag B').length }));
      sizes.add(s.A + s.B); if (s.A + s.B > 5 || s.A < 1 || s.B < 1 || Math.min(s.A, s.B) > 2) rareOk = false;
      const f = await fits(page); if (f.v > 1 || f.stage > 1 || f.over) misfit++;
      await page.evaluate(() => __run.ctrl.solve()); await page.evaluate(() => document.getElementById('quiz-action').click());
      if (await page.evaluate(() => __run.finished)) await page.evaluate(() => { closeActivity(); openActivity(UNITS[0].subs.find(s => s.id === 'u0-rare')); });
      else await page.evaluate(() => document.getElementById('quiz-action').click());
    }
    ok('rare bags: shelf never has more than 5 bags, always one rare kind (1 or 2)', rareOk, [...sizes].join(','));
    ok('rare bags: both 4- and 5-bag shelves occur', sizes.has(4) && sizes.has(5), [...sizes].join(','));
    ok('rare bags: every shelf fits', misfit === 0, String(misfit));
    ok('rare bags: no page errors', errors.length === 0, errors.join('|'));
    await ctx.close();
  }

  // "Which bag?": the 150% bags stay inside their columns and centred, and keep their size, on every phone shape.
  for (const id of ['u0-two', 'u0-rare']) {
    const bad = [];
    for (const [w, h] of [[320, 568], [360, 640], [360, 800], [375, 667], [390, 844], [412, 915], [414, 800], [768, 1024], [1280, 800]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(URL + '?seed=4'); await page.evaluate(() => localStorage.clear()); await page.reload();
      await page.evaluate(id => openActivity(UNITS[0].subs.find(s => s.id === id)), id); await page.waitForSelector('.bags-row.big svg');
      const m = await page.evaluate(() => {
        const row = document.querySelector('.bags-row.big').getBoundingClientRect();
        const boxes = [...document.querySelectorAll('.bags-row.big .bagbox')].map(b => b.getBoundingClientRect());
        const svgs = [...document.querySelectorAll('.bags-row.big .bagbox svg')].map(s => s.getBoundingClientRect());
        return { w: svgs[0].width, spillL: Math.max(...svgs.map((s, i) => boxes[i].left - s.left)), spillR: Math.max(...svgs.map((s, i) => s.right - boxes[i].right)),
          off: ((svgs[0].left + svgs[1].right) / 2) - (row.left + row.width / 2), gap: (svgs[0].left - row.left) - (row.right - svgs[1].right), sizeDiff: Math.abs(svgs[0].width - svgs[1].width),
          shelf: document.querySelector('.shelf.big svg').getBoundingClientRect().width };
      });
      const old = Math.min(120, 0.17 * h), want = Math.min(box => 0, 1);
      const fine = m.spillL <= 0.5 && m.spillR <= 0.5 && Math.abs(m.off) <= 1 && Math.abs(m.gap) <= 1 && m.sizeDiff <= 0.5 && m.w >= old * 1.2 && m.shelf >= 24 * 1.2;
      if (!fine) bad.push(`${w}x${h} ${JSON.stringify(m)}`);
      await ctx.close();
    }
    ok(`${id}: bags centred, inside their columns and at least 120% of the old size on every phone shape`, bad.length === 0, bad.join(' | '));
  }

  // Belief bar: dragging toward a kind means MORE sure of that kind.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=9'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.evaluate(() => openActivity(UNITS[0].subs.find(s => s.id === 'u0-two'))); await page.waitForSelector('.bb-track');
    const tr = await (await page.$('.bb-track')).boundingBox();
    const val = () => page.evaluate(() => Number(document.querySelector('.bb-track').getAttribute('aria-valuenow')));
    const widthA = () => page.evaluate(() => document.querySelector('.bb-seg.bar-A').getBoundingClientRect().width / document.querySelector('.bb-bar').getBoundingClientRect().width);
    const y = tr.y + tr.height / 2;
    await page.mouse.move(tr.x + tr.width * .5, y); await page.mouse.down();
    await page.mouse.move(tr.x + tr.width * .2, y, { steps: 6 });
    ok('dragging the thumb toward A (left) makes you MORE sure of A', (await val()) >= 75 && (await val()) <= 85, String(await val()));
    const wl = await widthA();
    ok('and the A part of the bar gets bigger', wl > 0.7 && wl < 0.9, String(wl));
    const thumbLeft = await page.evaluate(() => { const r = document.querySelector('.bb-thumb').getBoundingClientRect(), t = document.querySelector('.bb-track').getBoundingClientRect(); return (r.left + r.width / 2 - t.left) / t.width; });
    ok('the thumb sits toward A\'s end', thumbLeft < 0.3, String(thumbLeft));
    await page.mouse.move(tr.x + tr.width * .9, y, { steps: 6 }); await page.mouse.up();
    ok('dragging toward B (right) makes you more sure of B', (await val()) <= 15, String(await val()));
    ok('and the B part of the bar gets bigger', (await widthA()) < 0.2, String(await widthA()));
    const before = await val();
    await page.focus('.bb-track'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    ok('Left arrow moves toward A (more sure of A)', (await val()) === before + 10, `${before} -> ${await val()}`);
    ok('belief bar: no page errors', errors.length === 0, errors.join('|'));
    await ctx.close();
  }

  // The first sub-level's Draw button flashes red (like the scissors in Shapes) until it is tapped.
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=3'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.evaluate(() => openActivity(UNITS[0].subs[0]));
    await page.waitForSelector('.bigbtn.flash');
    ok('the only button is Draw', (await page.$$eval('#stage button', b => b.map(x => x.textContent.trim()))).join() === 'Draw');
    const samples = []; for (let i = 0; i < 44; i++) { samples.push(await page.evaluate(() => getComputedStyle(document.querySelector('#stage .bigbtn')).backgroundColor)); await page.waitForTimeout(50); }
    const parse = c => c.match(/\d+/g).map(Number); const redish = c => { const [r, g] = parse(c); return r > 170 && g < 110; }; const indigo = c => { const [r, , b] = parse(c); return r < 90 && b > 80; };
    const redShare = samples.filter(redish).length / samples.length, restShare = samples.filter(indigo).length / samples.length;
    ok('Draw flashes red for over a quarter of the time', redShare > 0.25, String(redShare));
    ok('Draw rests in its normal colour for over a quarter of the time', restShare > 0.25, String(restShare));
    ok('tapping Draw puts one shape in the tray and completes the sub-level', await (async () => { await page.click('#stage .bigbtn'); await page.waitForFunction(() => __run.finished); return (await page.$$('.tray svg')).length === 1; })());
    ok('the flash stops after the tap', !(await page.$eval('#stage .bigbtn', e => e.classList.contains('flash'))));
    // keyboard: Enter on the focused button (native button behaviour)
    await page.evaluate(() => { closeActivity(); openActivity(UNITS[0].subs[0]); });
    await page.waitForSelector('.bigbtn.flash'); await page.focus('#stage .bigbtn'); await page.keyboard.press('Enter');
    ok('Enter on the focused Draw button draws', await page.evaluate(() => __run.finished));
    // later levels use the same normal buttons: closed-bag share level, three taps of Draw 1
    let found = false;
    for (let tries = 0; tries < 12 && !found; tries++) { await page.evaluate(() => { closeActivity(); openActivity(UNITS[0].subs[2]); }); found = !!(await page.$('text=Draw 1')); }
    ok('closed-bag share level reachable', found);
    for (let i = 0; i < 3; i++) await page.click('text=Draw 1');
    ok('three taps of Draw 1 put three shapes in the tally', (await page.$$('.tallyrow svg')).length === 3);
    await page.click('text=Draw 5');
    ok('Draw 5 adds five more', (await page.$$('.tallyrow svg')).length === 8);
    await page.click('text=Draw 5');
    ok('drawing stops at 12 shapes and the buttons turn off', (await page.$$('.tallyrow svg')).length === 12 && await page.isDisabled('text=Draw 1'));
    ok('draw tests: no page errors', errors.length === 0, errors.join('|'));
    await ctx.close();
  }

  // ---------------- Unit 1 ----------------
  {
    const U0 = ['u0-draw', 'u0-slide', 'u0-share', 'u0-many', 'u0-inside', 'u0-flip', 'u0-two', 'u0-several', 'u0-rare', 'u0-chips'];
    const ctx0 = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const p0 = await ctx0.newPage(); await p0.goto(URL + '?seed=2'); await p0.evaluate(() => localStorage.clear()); await p0.reload();
    await p0.click('#btn-start');
    ok('Unit 1 is locked until Unit 0 is finished', await p0.$$eval('#unit-grid .tile', t => t[1].disabled));
    await ctx0.close();
    for (const [w, h] of SIZES) {
      const tag = `U1 ${w}x${h}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL + '?seed=17'); await page.evaluate(done => localStorage.setItem('bayes:v1', JSON.stringify({ points: 500, started: true, done })), U0); await page.reload();
      await page.click('#btn-continue');
      ok(`${tag} Unit 1 opens once Unit 0 is done`, await page.$$eval('#unit-grid .tile', t => !t[1].disabled));
      await page.click('#unit-grid .tile:nth-child(2)');
      const subs = await page.$$eval('#sub-grid .tile', t => t.length);
      ok(`${tag} unit 1 has 8 sub-levels`, subs === 8, String(subs));
      for (let i = 0; i < subs; i++) {
        await page.click(`#sub-grid .tile:nth-child(${i + 1})`);
        const sub = await page.evaluate(() => ({ id: __run.sub.id, kind: __run.sub.kind }));
        await page.waitForSelector('#stage > *'); await checkFit(page, `${tag} ${sub.id} start`);
        if (sub.kind === 'tutorial') {
          await page.evaluate(() => __run.ctrl.solve()); await page.waitForFunction(() => __run.finished);
          await checkFit(page, `${tag} ${sub.id} done`); await page.evaluate(() => document.getElementById('quiz-action').click());
        } else {
          await page.evaluate(() => __run.ctrl.solveWrong());
          ok(`${tag} ${sub.id} check enabled when answered wrongly`, await page.isEnabled('#quiz-action'));
          await page.evaluate(() => document.getElementById('quiz-action').click());
          const wrong = await page.evaluate(() => ({ cls: document.getElementById('quiz-feedback').className, hearts: __run.game.missesLeft }));
          ok(`${tag} ${sub.id} wrong answer marked wrong, heart used`, wrong.cls.includes('bad') && wrong.hearts === 1, JSON.stringify(wrong));
          await checkFit(page, `${tag} ${sub.id} after wrong answer`);
          await page.evaluate(() => document.getElementById('quiz-action').click());
          for (let k = 0; k < 5; k++) {
            await page.evaluate(() => __run.ctrl.solve()); await checkFit(page, `${tag} ${sub.id} q${k + 1} ready`);
            ok(`${tag} ${sub.id} q${k + 1} check enabled`, await page.isEnabled('#quiz-action'));
            await page.evaluate(() => document.getElementById('quiz-action').click());
            const good = await page.evaluate(() => document.getElementById('quiz-feedback').className);
            ok(`${tag} ${sub.id} q${k + 1} right answer accepted`, good.includes('good'), await page.textContent('#quiz-feedback'));
            await checkFit(page, `${tag} ${sub.id} q${k + 1} revealed`);
            if (k < 4) await page.evaluate(() => document.getElementById('quiz-action').click());
          }
          await page.evaluate(() => document.getElementById('quiz-action').click());
        }
        await page.waitForSelector('#quiz-overlay.hidden', { state: 'attached' });
        ok(`${tag} ${sub.id} marked done`, (await page.$$eval('#sub-grid .tile.done', t => t.length)) === i + 1);
      }
      ok(`${tag} no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    // real interaction on the new controls
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL + '?seed=5'); await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.evaluate(() => openActivity(UNITS[1].subs.find(s => s.id === 'u1-imagine-tut'))); await page.waitForSelector('.bigbtn.flash');
    ok('imagine tutorial: only + circle, flashing', (await page.$$eval('#stage button', b => b.map(x => x.textContent.trim()))).join() === '+ circle');
    const a0 = await page.$$eval('.tray svg', s => s.length);
    await page.click('#stage .bigbtn'); await page.waitForFunction(() => __run.finished);
    ok('tapping + circle adds an imagined circle (flat pair 2 -> 3 shapes)', a0 === 2 && (await page.$$eval('.tray svg', s => s.length)) === 3, String(a0));
    await page.evaluate(() => { closeActivity(); openActivity(UNITS[1].subs.find(s => s.id === 'u1-imagine')); }); await page.waitForSelector('.curveview svg');
    const beforeMean = await page.textContent('.stage-note');
    await page.click('text=+ circle'); await page.click('text=+ circle'); await page.click('text=+ square');
    ok('imagine: counts update (3 circles, 2 squares)', /3 imagined circles and 2 imagined squares/.test(await page.textContent('.stage-note')), await page.textContent('.stage-note'));
    await page.click('text=Start again');
    ok('imagine: Start again returns to the flat pair', /1 imagined circle and 1 imagined square/.test(await page.textContent('.stage-note')));
    // marker drag on the shift level
    await page.evaluate(() => { closeActivity(); openActivity(UNITS[1].subs.find(s => s.id === 'u1-shift')); }); await page.waitForSelector('.as-thumb');
    const tr = await (await page.$('.as-track')).boundingBox();
    await page.mouse.move(tr.x + tr.width * 0.5, tr.y + tr.height / 2); await page.mouse.down(); await page.mouse.move(tr.x + tr.width * 0.8, tr.y + tr.height / 2, { steps: 6 }); await page.mouse.up();
    const mv = await page.$eval('.as-thumb', e => Number(e.getAttribute('aria-valuenow')));
    ok('dragging the marker moves it to 80%', mv >= 78 && mv <= 82, String(mv));
    // two handles: pressing near the right handle moves only the right one
    await page.evaluate(() => { closeActivity(); openActivity(UNITS[1].subs.find(s => s.id === 'u1-interval')); }); await page.waitForSelector('.as-thumb.t1');
    const tr2 = await (await page.$('.as-track')).boundingBox();
    await page.mouse.move(tr2.x + tr2.width * 0.9, tr2.y + tr2.height / 2); await page.mouse.down(); await page.mouse.move(tr2.x + tr2.width * 0.7, tr2.y + tr2.height / 2, { steps: 6 }); await page.mouse.up();
    const vals = await page.$$eval('.as-thumb', e => e.map(x => Number(x.getAttribute('aria-valuenow'))));
    ok('interval: the nearer (right) handle moved, the left stayed', vals[0] === 10 && vals[1] >= 68 && vals[1] <= 72, vals.join());
    ok('interval: label shows the covered share', /covers \d+% of the belief/.test(await page.textContent('.livelabel')));
    await page.focus('.as-thumb.t0'); await page.keyboard.press('ArrowRight');
    ok('interval: arrow keys move a handle', (await page.$eval('.as-thumb.t0', e => Number(e.getAttribute('aria-valuenow')))) === 12);
    ok('unit 1 controls: no page errors', errors.length === 0, errors.join('|'));
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
      await page.evaluate(() => document.getElementById('quiz-action').click()); await checkFit(page, `placement ${plan} item ${i + 1} after`);
      await page.evaluate(() => document.getElementById('quiz-action').click());
    }
    const txt = await page.textContent('#stage');
    ok(`placement ${plan} result shown`, plan === 'allright' ? /every picture right/.test(txt) : /Flip it/.test(txt), txt);
    await page.evaluate(() => document.getElementById('quiz-action').click());
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
