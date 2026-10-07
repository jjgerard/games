// Measures every screen and every sub-level (question and answer states) against size and accessibility
// rules, at three phone sizes. Prints a summary of what fails; exits non-zero if anything does.
//   NODE_PATH=/opt/node22/lib/node_modules node tools/audit.js [--verbose]
//
// Rules (WCAG 2.2 AA unless noted):
//  targets   every enabled control is at least 44x44 CSS px on 360x640 and larger phones (the AAA "enhanced"
//            size, and what thumbs need). On the smallest phone (320x568) at least 36px, and never below the
//            24x24 AA minimum anywhere.
//  pictures  a bag that you must read is at least 80px wide (64px on the 320 phone); the shapes inside it, which
//            you count, are at least 9px across (8px on the 320 phone); grid shapes at least 34px.
//  fonts     no text (in pictures too) smaller than the question text, 17px.
//  contrast  text 4.5:1 (3:1 for large or bold-large text); decorative/disabled text exempt.
//  names     every control has an accessible name; every informative graphic has a text alternative.
//  focus     every keyboard-focusable control shows a visible focus indicator.
const { chromium } = require('playwright');
const VERBOSE = process.argv.includes('--verbose');
const SIZES = [[360, 640], [320, 568], [414, 800]];
const URL = 'http://localhost:8123/index.html?seed=31';

const inPage = () => {
  const out = { targets: [], pictures: [], contrast: [], names: [], graphics: [], fonts: [] };
  const scope = (() => { const o = [...document.querySelectorAll('.overlay')].filter(x => !x.classList.contains('hidden')); return o.length ? o[o.length - 1] : document.body; })();
  const shown = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[aria-hidden="true"]') && !e.closest('.hidden'); };
  const sig = e => { let s = e.tagName.toLowerCase(); const c = (e.getAttribute('class') || '').split(/\s+/).filter(Boolean).filter(x => !/^(on|off|bad|right|locked|done|flash|pulse)$/.test(x)); if (c.length) s += '.' + c.slice(0, 2).join('.'); const p = e.closest('[id]'); return s + (p && p !== e ? ` in #${p.id}` : ''); };
  const nameOf = e => {
    const lab = e.getAttribute('aria-label'); if (lab) return lab.trim();
    const lb = e.getAttribute('aria-labelledby'); if (lb) return lb.split(/\s+/).map(i => (document.getElementById(i) || {}).textContent || '').join(' ').trim();
    const t = (e.textContent || '').trim().replace(/\s+/g, ' '); if (t) return t;
    return (e.getAttribute('title') || e.getAttribute('alt') || '').trim();
  };
  // ---- targets and names
  const sel = 'button, a[href], input, select, textarea, [role="slider"], [role="button"], [tabindex]:not([tabindex="-1"])';
  for (const e of scope.querySelectorAll(sel)) {
    if (!shown(e) || e.disabled || e.getAttribute('aria-disabled') === 'true') continue;
    const r = e.getBoundingClientRect(); out.targets.push({ sig: sig(e), w: Math.round(r.width), h: Math.round(r.height), name: nameOf(e) });
    if (!nameOf(e)) out.names.push({ sig: sig(e), what: 'control has no accessible name' });
  }
  // ---- pictures
  const pics = [['.bagbox svg', 'bag'], ['.kindhead svg.bag-sm', 'bag'], ['.chipcol svg.bag-sm', 'bag'], ['.fgrid svg', 'gridshape'], ['.tray svg', 'tray'], ['.shelf svg', 'shelf'], ['.drawnbox svg', 'tray'], ['.bigshape svg', 'tray']];
  for (const [q, kind] of pics) for (const e of scope.querySelectorAll(q)) {
    if (!shown(e)) continue; const r = e.getBoundingClientRect();
    let shapeMin = null; if (kind === 'bag') { const sh = [...e.querySelectorAll('circle.sh, rect.sh')]; if (sh.length) shapeMin = Math.min(...sh.map(s => { const b = s.getBoundingClientRect(); return Math.min(b.width, b.height); })); }
    out.pictures.push({ sig: sig(e), kind, w: Math.round(r.width), shape: shapeMin == null ? null : Math.round(shapeMin * 10) / 10 });
  }
  // ---- graphics need a text alternative (themselves, or a labelled container)
  for (const e of scope.querySelectorAll('svg')) {
    if (!shown(e)) continue;
    const labelled = e.getAttribute('role') === 'img' && nameOf(e) || e.closest('[role="img"][aria-label], button, [aria-label], [role="slider"]') || e.closest('.tile');
    if (!labelled) out.graphics.push({ sig: sig(e), what: 'graphic with no text alternative' });
  }
  // ---- containers that show information must say it in words
  for (const q of ['.tray', '.tally', '.tallyrow', '.fgrid', '.freq', '.barsrow', '.curveview', '.shelf', '.shelfstrip', '.bagwrap', '.bagbox', '.kindhead']) for (const e of scope.querySelectorAll(q)) {
    if (!shown(e) || !e.children.length) continue;
    const has = e.getAttribute('aria-label') || (e.textContent || '').trim() || e.querySelector('.sr-only') || e.querySelector('[role="img"][aria-label]') || e.querySelector('[aria-label]') || e.closest('[aria-label]') || e.closest('button');
    if (!has) out.graphics.push({ sig: sig(e), what: 'shows information with no text alternative' });
  }
  // ---- fonts: no text smaller than the question text (17px), including text drawn inside pictures
  const FONT_MIN = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const fseen = new Set();
  for (const t of (() => { const a = [], w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) if (n.textContent.trim()) a.push(n); return a; })()) {
    const e = t.parentElement; if (!e || !shown(e) || e.closest('.sr-only') || e.closest('button:disabled')) continue;
    let px = parseFloat(getComputedStyle(e).fontSize);
    const svg = e.closest('svg'); if (svg && e instanceof SVGElement) { const m = e.getScreenCTM(); if (m) px *= Math.hypot(m.a, m.b); }
    px = Math.round(px * 10) / 10; if (px < FONT_MIN - 0.05) { const k = sig(e) + px; if (!fseen.has(k)) { fseen.add(k); out.fonts.push({ sig: sig(e), text: t.textContent.trim().slice(0, 20), px, min: FONT_MIN }); } }
  }
  // ---- contrast
  const parse = c => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] == null ? 1 : m[3] }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = e => { const layers = []; for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) layers.push(c); if (c.a >= 1) break; } let bg = { r: 246, g: 244, b: 239, a: 1 }; for (const l of layers.reverse()) bg = blend(l, bg); return bg; };
  const seen = new Set();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    if (!t.textContent.trim()) continue; const e = t.parentElement; if (!e || !shown(e) || e.closest('button:disabled, [aria-disabled="true"]')) continue;
    if (e.closest('svg')) continue; // tick labels etc. are checked separately by design
    const cs = getComputedStyle(e); let op = 1; for (let n = e; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity); if (op < 0.99) continue; // decorative / dimmed
    const fg = parse(cs.color), bg = bgOf(e), f = blend(fg, bg);
    const L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700, large = px >= 24 || (bold && px >= 18.66), need = large ? 3 : 4.5;
    const key = sig(e) + '|' + Math.round(ratio * 10); if (seen.has(key)) continue; seen.add(key);
    if (ratio < need) out.contrast.push({ sig: sig(e), text: t.textContent.trim().slice(0, 24), ratio: Math.round(ratio * 100) / 100, need, px: Math.round(px) });
  }
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const findings = new Map(); let states = 0;
  const add = (kind, sig, detail, where) => { const k = kind + '|' + sig + '|' + detail; if (!findings.has(k)) findings.set(k, { kind, sig, detail, where: new Set() }); findings.get(k).where.add(where); };
  for (const [w, h] of SIZES) {
    const small = w < 340, tag = `${w}x${h}`;
    const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL); await page.evaluate(() => localStorage.clear()); await page.reload();
    const measure = async (label) => {
      states++; await page.waitForTimeout(40);
      const d = await page.evaluate(() => { const open = [...document.querySelectorAll('.overlay')].filter(o => !o.classList.contains('hidden')); if (!open.length) return null; const top = open[open.length - 1];
        const dlg = top.matches('[role="dialog"],[role="alertdialog"]') ? top : top.querySelector('[role="dialog"],[role="alertdialog"]');
        const name = dlg && (dlg.getAttribute('aria-label') || (dlg.getAttribute('aria-labelledby') || '').split(' ').map(i => (document.getElementById(i) || {}).textContent || '').join(' ').trim());
        return { role: !!dlg, modal: !!dlg && dlg.getAttribute('aria-modal') === 'true', name: !!name, focusInside: top.contains(document.activeElement), appInert: document.getElementById('app').inert }; });
      if (d) { if (!d.role) add('DIALOG', 'overlay', 'no dialog role', tag + ' ' + label); if (!d.modal) add('DIALOG', 'overlay', 'not marked aria-modal', tag + ' ' + label); if (!d.name) add('DIALOG', 'overlay', 'no accessible name', tag + ' ' + label); if (!d.focusInside) add('DIALOG', 'overlay', 'focus not moved into the dialog', tag + ' ' + label); if (!d.appInert) add('DIALOG', 'overlay', 'page behind is not inert', tag + ' ' + label); }
      const r = await page.evaluate(inPage);
      const minT = small ? 36 : 44;
      for (const t of r.targets) { const m = Math.min(t.w, t.h); if (m < 24) add('TARGET<24', t.sig, `${t.w}x${t.h} "${t.name.slice(0, 18)}"`, tag + ' ' + label); else if (m < minT) add(`TARGET<${minT}`, t.sig, `${t.w}x${t.h} "${t.name.slice(0, 18)}"`, tag + ' ' + label); }
      for (const p of r.pictures) {
        if (p.kind === 'bag') { if (p.w < (small ? 64 : 80)) add('PICTURE', p.sig, `bag ${p.w}px wide (need ${small ? 64 : 80})`, tag + ' ' + label); if (p.shape != null && p.shape < (small ? 8 : 9)) add('PICTURE', p.sig, `shapes inside only ${p.shape}px across (need ${small ? 8 : 9})`, tag + ' ' + label); }
        else if (p.kind === 'gridshape' && p.w < 34) add('PICTURE', p.sig, `${p.w}px`, tag + ' ' + label);
        else if (p.kind === 'tray' && p.w < 20) add('PICTURE', p.sig, `${p.w}px`, tag + ' ' + label);
      }
      for (const c of r.contrast) add('CONTRAST', c.sig, `"${c.text}" ${c.ratio}:1 (need ${c.need}, ${c.px}px)`, tag + ' ' + label);
      for (const f of r.fonts) add('FONT', f.sig, `"${f.text}" ${f.px}px (need ${f.min})`, tag + ' ' + label);
      for (const n of r.names) add('NAME', n.sig, n.what, tag + ' ' + label);
      for (const g of r.graphics) add('ALT', g.sig, g.what, tag + ' ' + label);
      // keyboard focus: Tab through the open overlay (or page) and check each stop shows an indicator
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
          return { sig: e.tagName.toLowerCase() + (e.getAttribute('class') ? '.' + e.getAttribute('class').split(/\s+/)[0] : ''), ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none', vis: r.width > 0 }; });
        if (f && f.vis && !f.ring) add('FOCUS', f.sig, 'no visible focus indicator', tag + ' ' + label);
      }
    };
    // screens and dialogs
    await measure('home');
    await page.evaluate(() => { state.started = true; save(); goUnits(); }); await measure('units');
    await page.evaluate(() => { state.done = UNITS[0].subs.map(s => s.id); save(); renderUnits(); openUnit(UNITS[0]); }); await measure('unit 0 sub-levels');
    await page.evaluate(() => { openUnit(UNITS[1]); }); await measure('unit 1 sub-levels');
    for (const [name, fn] of [['menu', () => document.getElementById('btn-menu').click()], ['help', () => showHelp('How to play', HELP.general)], ['confirm', () => confirmDialog('Erase?', 'This removes progress.', () => {})]]) {
      await page.evaluate(fn); await measure(name); await page.evaluate(() => { for (const id of ['menu-overlay', 'help-overlay', 'confirm-overlay']) closeOverlay(id); });
    }
    // every sub-level, before and after answering
    const ids = await page.evaluate(() => UNITS.flatMap(u => u.subs).map(s => ({ id: s.id, kind: s.kind })));
    for (const s of ids) {
      for (let q = 0; q < 3; q++) { // a few random questions each: layouts vary
        await page.evaluate(id => { closeActivity(); openActivity(UNITS.flatMap(u => u.subs).find(x => x.id === id)); }, s.id);
        await page.waitForSelector('#stage > *'); await measure(`${s.id} question`);
        if (s.kind === 'tutorial' && q === 0) { await page.evaluate(() => __run.ctrl.solve()); await measure(`${s.id} done`); }
        else if (s.kind !== 'tutorial') { await page.evaluate(() => __run.ctrl.solve()); await page.evaluate(() => document.getElementById('quiz-action').click()); await measure(`${s.id} answered`); }
      }
    }
    await page.evaluate(() => { closeActivity(); startPlacement(); });
    for (let i = 0; i < 5; i++) { await page.waitForSelector('#stage > *'); await measure(`placement ${i + 1}`); await page.evaluate(() => __run.ctrl.solve()); await page.evaluate(() => document.getElementById('quiz-action').click()); await page.evaluate(() => document.getElementById('quiz-action').click()); }
    if (errs.length) add('ERROR', 'page', errs.join('|'), tag);
    await page.context().close();
  }
  await browser.close();
  const order = ['ERROR', 'TARGET<24', 'TARGET<36', 'TARGET<44', 'PICTURE', 'FONT', 'CONTRAST', 'NAME', 'ALT', 'DIALOG', 'FOCUS'];
  const list = [...findings.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.sig.localeCompare(b.sig));
  console.log(`${states} states measured at ${SIZES.map(s => s.join('x')).join(', ')}`);
  const byKind = {}; for (const f of list) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
  console.log(list.length ? 'ISSUES: ' + JSON.stringify(byKind) : 'no issues');
  for (const f of list) console.log(`${f.kind.padEnd(10)} ${f.sig} :: ${f.detail}  [${[...f.where].slice(0, VERBOSE ? 99 : 2).join('; ')}${!VERBOSE && f.where.size > 2 ? ` +${f.where.size - 2} more` : ''}]`);
  process.exit(list.length ? 1 : 0);
})();
