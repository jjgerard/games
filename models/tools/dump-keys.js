// Runs the REAL generators in the browser and writes every answer key (and the numbers behind it) to a JSON file,
// so tools/check-keys.R can recompute them with real R (lm, glm, lme4).
//   NODE_PATH=... node tools/dump-keys.js [out.json] [questions-per-sub=40]
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = process.argv[2] || '/tmp/keys.json', N = Number(process.argv[3] || 40);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 360, height: 640 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8203/index.html?seed=' + (Date.now() % 99999)); await p.evaluate(() => localStorage.clear()); await p.reload();
  const ids = await p.evaluate(() => UNITS.flatMap(u => u.subs).filter(s => s.kind === 'streak').map(s => s.id));
  const out = { subs: {} };
  for (const id of ids) {
    out.subs[id] = [];
    for (let i = 0; i < N; i++) {
      await p.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)); }, id); await p.waitForSelector('#stage > *');
      out.subs[id].push(await p.evaluate(() => JSON.parse(JSON.stringify(__run.ctrl.info || null))));
    }
  }
  out.static = await p.evaluate(() => ({
    nest: nestPatterns(), build: BUILD_BANK, read: READ_BANK.map(t => ({ terms: t, comps: componentsOf(t) })), vc: VC_FORMS, typo: TYPO_BANK, scenarios: SCENARIOS.map(s => s.msg),
    mathSamples: Array.from({ length: 40 }, (_, i) => { const x = -4 + i * 0.2, pp = MM.plogis(x); return { x, p: pp, odds: MM.odds(pp), q: MM.qlogis(pp), z: x, pn: MM.pnorm(x), qn: MM.qnorm(Math.min(0.999, Math.max(0.001, pp))) }; }),
    cod: Object.fromEntries(Object.entries(MM.CODINGS).map(([k, c]) => [k, { ...c, K: MM.coefs(c, 40, 60) }])),
    canon: [['(1 | a/b)'], ['(1 | a)', '(1 | a:b)'], ['(x | g)'], ['(1 + x | g)'], ['(1 | g)', '(0 + x | g)']].map(t => ({ t, c: MM.canon(t) })),
  }));
  fs.writeFileSync(OUT, JSON.stringify(out)); console.log('wrote', OUT, Object.keys(out.subs).length, 'sub-levels', errs.length ? 'ERRORS ' + errs.join('|') : '');
  await b.close();
})();
