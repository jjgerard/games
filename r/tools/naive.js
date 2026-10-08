// How often would a tempting wrong strategy pass? Every engine offers "random" plus named strategies
// (always the first option, everything selected, same rows as the input, ...). Reported per sub-level over many questions.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/naive.js [questions=150] [port=8202]
const { chromium } = require('playwright');
const N = Number(process.argv[2] || 150), PORT = process.argv[3] || 8202;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  await p.goto(`http://localhost:${PORT}/index.html?seed=${Date.now() % 100000}`); await p.evaluate(() => localStorage.clear()); await p.reload();
  const subs = await p.evaluate(() => UNITS.flatMap(u => u.subs).filter(s => s.kind === 'streak').map(s => ({ id: s.id, target: s.target, hearts: s.hearts })));
  let flagged = 0;
  for (const s of subs) {
    await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(x => x.id === id)); }, s.id);
    const tally = {}, total = {};
    for (let i = 0; i < N; i++) {
      await p.waitForSelector('#stage > *');
      const res = await p.evaluate(() => { const c = __run.ctrl, out = {}; for (const [name, f] of Object.entries(c.naive || {})) { let hit = 0; const reps = name === 'random' ? 12 : 1; for (let k = 0; k < reps; k++) { try { f(); if (c.judge()) hit++; } catch (e) { return { error: name + ': ' + e.message }; } } out[name] = [hit, reps]; } return out; });
      if (res.error) { console.log('ERROR', s.id, res.error); break; }
      for (const [k, [h, r]] of Object.entries(res)) { tally[k] = (tally[k] || 0) + h; total[k] = (total[k] || 0) + r; }
      await p.evaluate(() => __run.ctrl.solve()); await p.evaluate(() => document.getElementById('quiz-action').click());
      if (await p.evaluate(() => __run.finished)) await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(x => x.id === id)); }, s.id); else await p.evaluate(() => document.getElementById('quiz-action').click());
    }
    const rows = Object.keys(tally).map(k => [k, tally[k] / total[k]]); const worst = rows.reduce((m, r) => r[1] > m[1] ? r : m, ['-', 0]);
    // chance of passing a whole sub-level (target in a row, with the hearts) by the worst strategy, roughly p^target
    const pAll = Math.pow(worst[1], s.target);
    const bad = worst[1] > 0.5; if (bad) flagged++;
    console.log(`${s.id.padEnd(14)} worst "${worst[0]}" passes ${(worst[1] * 100).toFixed(0)}% of questions (~${(pAll * 100).toExponential(0)}% a whole run)${bad ? '   <-- HIGH' : ''}   ${rows.map(r => r[0] + ' ' + (r[1] * 100).toFixed(0) + '%').join(', ')}`);
  }
  console.log(flagged ? `${flagged} sub-level(s) with a naive strategy above 50%` : 'no naive strategy passes more than half the questions anywhere'); await b.close(); process.exit(flagged ? 1 : 0);
})();
