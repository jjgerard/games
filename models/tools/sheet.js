// Contact sheet: question + answered state of several sub-levels. node tools/sheet.js out.png w h id1 id2 ...
const { chromium } = require('playwright'); const { execSync } = require('child_process'); const fs = require('fs');
(async () => {
  const [out, w, h, ...ids] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const files = [];
  for (const id of ids) for (const mode of ['q', 'a']) {
    const p = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8203/index.html?seed=' + (process.env.SEED || 11)); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.evaluate(id => openActivity(UNITS.flatMap(u => u.subs).find(s => s.id === id)), id); await p.waitForSelector('#stage > *');
    if (mode === 'a') { await p.evaluate(() => __run.ctrl.solve()); if (__kind(id)) {} await p.evaluate(() => { const b = document.getElementById('quiz-action'); if (!b.disabled && __run.phase === 'answering') b.click(); }); }
    const f = `/tmp/sh_${id}_${mode}.png`; await p.screenshot({ path: f }); files.push(f);
    const fit = await p.evaluate(() => { const b = document.getElementById('quiz-body'); return b.scrollHeight - b.clientHeight; });
    if (fit > 1 || errs.length) console.log(id, mode, 'OVERFLOW', fit, errs.join('|'));
    await p.context().close();
  }
  await b.close();
  execSync(`python3 -c "from PIL import Image; import sys; fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; W=sum(i.width for i in ims[:int(sys.argv[1])]); cols=int(sys.argv[1]); rows=(len(ims)+cols-1)//cols; w,h=ims[0].size; S=Image.new('RGB',(w*cols,h*rows),'white'); [S.paste(im,((k%cols)*w,(k//cols)*h)) for k,im in enumerate(ims)]; S.save('${out}')" 6 ${files.join(' ')}`);
})();
function __kind() { return false; }
