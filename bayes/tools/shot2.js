const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = [];
  for (const [id, w, h, wait] of [['u0-draw', 360, 640, 330], ['u0-several', 320, 568, 0], ['u0-several', 360, 640, 0]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.goto('http://localhost:8123/index.html?seed=5'); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.evaluate(id => openActivity(UNITS[0].subs.find(s => s.id === id)), id); await p.waitForSelector('#stage > *');
    if (wait) await p.waitForTimeout(wait);
    const f = `/tmp/d-${id}-${w}.png`; await p.screenshot({ path: f }); out.push(f);
  }
  await b.close(); console.log(out.join(' '));
})();
