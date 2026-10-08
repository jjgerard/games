// Pieces for Units 2-6: a plot with draggable handles, bars on a grid of
// possible values, a pile of samples, trace plots, a brms-style table, rows
// of dots that slide toward a shared mean. Same rules as ui.js: every picture
// has a text alternative, nothing smaller than 17px (SVG text is drawn at 19
// units in a 300-wide picture, which is never below 18px on screen), and every
// handle is a 44px target that also works from the arrow keys.
let _uid = 0;
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const fmtNum = (x, d = 1) => { const v = Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x; return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d); };
const clamp = BM.clamp;

// ---------------------------------------------------------------------------
// Plot: a frame with axes. Data layers are SVG strings drawn with draw();
// handles are HTML buttons laid over it so each is a real 44x44 target.
// ---------------------------------------------------------------------------
function Plot({ W = 300, H = 170, xd = [0, 1], yd = [0, 1], L = 46, R = 10, T = 22, B = 34, xticks = [], yticks = [], xfmt = v => v, yfmt = v => v, xTitle = '', yTitle = '', label = '', grid = false } = {}) {
  const id = 'pc' + (++_uid);
  if (xTitle) B += 14; if (yTitle) T += 8;
  const wrap = el('div', { class: 'plotwrap', style: `aspect-ratio:${W}/${H}` });
  const box = el('div', { class: 'plot', role: 'img', 'aria-label': label });
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true');
  box.append(svg); wrap.append(box);
  const sx = x => L + (x - xd[0]) / (xd[1] - xd[0]) * (W - L - R);
  const sy = y => H - B - (y - yd[0]) / (yd[1] - yd[0]) * (H - T - B);
  const ix = px => xd[0] + (px - L) / (W - L - R) * (xd[1] - xd[0]);
  const iy = py => yd[0] + (H - B - py) / (H - T - B) * (yd[1] - yd[0]);
  const tick = (x, y, t, anchor, extra = '') => `<text x="${x.toFixed(1)}" y="${y}" text-anchor="${anchor}" class="pt ${extra}">${t}</text>`;
  let frame = '';
  if (grid) for (const t of yticks) frame += `<line x1="${L}" x2="${W - R}" y1="${sy(t).toFixed(1)}" y2="${sy(t).toFixed(1)}" class="pgrid"/>`;
  frame += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="paxis"/>`;
  if (yticks.length || L > 20) frame += `<line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="paxis"/>`;
  for (const t of xticks) { const s = String(xfmt(t)), half = s.length * 7.4, x = clamp(sx(t), half + 1, W - half - 1); frame += `<line x1="${sx(t).toFixed(1)}" x2="${sx(t).toFixed(1)}" y1="${H - B}" y2="${H - B + 5}" class="paxis"/>` + tick(x, H - B + 24, s, 'middle'); }
  for (const t of yticks) frame += tick(L - 7, sy(t) + 6, yfmt(t), 'end');
  if (xTitle) frame += tick(W - R, H - 3, xTitle, 'end', 'ptitle');
  if (yTitle) frame += tick(4, 17, yTitle, 'start', 'ptitle');
  const defs = `<defs><clipPath id="${id}"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></clipPath></defs>`;
  const api = {
    el: wrap, box, W, H, L, R, T, B, sx, sy, ix, iy, xd, yd,
    draw(inside = [], outside = []) {
      svg.innerHTML = defs + frame + `<g clip-path="url(#${id})">${[].concat(inside).join('')}</g>` + [].concat(outside).join('');
    },
    setLabel(t) { box.setAttribute('aria-label', t); },
    // pointer position -> data units
    toData(e) { const r = box.getBoundingClientRect(); return { x: ix((e.clientX - r.left) / r.width * W), y: iy((e.clientY - r.top) / r.height * H), px: (e.clientX - r.left) / r.width * W, py: (e.clientY - r.top) / r.height * H }; },
    handles: [],
    // A draggable handle. axis 'y' moves it up and down at a fixed x, 'x' left and right at a fixed y.
    handle({ axis = 'y', x = 0, y = 0, min, max, step = 1, label = 'Handle', fmt = v => String(v), onChange = () => {}, cls = '' }) {
      const e = el('div', { class: 'hdl ' + axis + ' ' + cls, tabindex: 0, role: 'slider', 'aria-label': label, 'aria-orientation': axis === 'y' ? 'vertical' : 'horizontal' });
      let pos = { x, y }, locked = false, touched = false;
      const lo = min == null ? (axis === 'y' ? Math.min(...yd) : Math.min(...xd)) : min, hi = max == null ? (axis === 'y' ? Math.max(...yd) : Math.max(...xd)) : max;
      const h = {
        el: e, axis, step, get: () => (axis === 'y' ? pos.y : pos.x), touched: () => touched, pos: () => ({ ...pos }),
        set(v, fromUser = false) {
          v = clamp(Math.round(v / step) * step, lo, hi); v = Math.round(v * 1e6) / 1e6;
          if (axis === 'y') pos.y = v; else pos.x = v;
          if (fromUser) { touched = true; e.classList.remove('flash'); }
          e.style.left = (sx(pos.x) / W * 100) + '%'; e.style.top = (sy(pos.y) / H * 100) + '%';
          e.setAttribute('aria-valuemin', lo); e.setAttribute('aria-valuemax', hi); e.setAttribute('aria-valuenow', v); e.setAttribute('aria-valuetext', fmt(v));
          onChange(v, fromUser, h);
        },
        moveTo(pt) { h.set(axis === 'y' ? pt.y : pt.x, true); },
        lock() { locked = true; e.classList.add('locked'); e.tabIndex = -1; },
        get locked() { return locked; },
        flash(on = true) { e.classList.toggle('flash', on); },
      };
      e.addEventListener('keydown', ev => {
        if (locked) return;
        const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[ev.key];
        if (d) { ev.preventDefault(); h.set(h.get() + d * step, true); }
        else if (ev.key === 'Home') { ev.preventDefault(); h.set(lo, true); } else if (ev.key === 'End') { ev.preventDefault(); h.set(hi, true); }
      });
      wrap.append(e); api.handles.push(h); h.set(axis === 'y' ? y : x);
      return h;
    },
  };
  // pressing anywhere on the plot moves the nearest handle there, and dragging carries on with it
  let active = null;
  const nearest = pt => { let best = null, bd = 1e9; for (const h of api.handles) { if (h.locked) continue; const p = h.pos(); const d = h.axis === 'y' ? Math.abs(sx(p.x) - pt.px) : Math.abs(sy(p.y) - pt.py); if (d < bd) { bd = d; best = h; } } return best; };
  wrap.addEventListener('pointerdown', e => { if (!api.handles.length) return; const pt = api.toData(e); active = nearest(pt); if (!active) return; wrap.setPointerCapture(e.pointerId); active.moveTo(pt); });
  wrap.addEventListener('pointermove', e => { if (active) active.moveTo(api.toData(e)); });
  const end = () => { active = null; };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
  api.draw();
  return api;
}
// a short caption above a picture, in real text (never drawn over bars)
const Cap = (t, cls = '') => el('div', { class: 'cap ' + cls }, t);
// the two ends of a slider, so the direction is plain: Ends('none', 'complete')
const Ends = (a, b) => el('div', { class: 'ends', 'aria-hidden': 'true' }, el('span', {}, a), el('span', {}, b));
// a key for a picture: Legend([['dash', 'average of all trees'], ['ring', 'its own average']])
function Legend(items) {
  const sw = { dash: '<line x1="13" y1="1" x2="13" y2="19" stroke="#2b2620" stroke-width="2" stroke-dasharray="4 3"/>', band: '<rect x="3" y="1" width="20" height="18" fill="rgba(46,125,79,.3)"/>', ring: '<circle cx="13" cy="10" r="7" fill="none" stroke="#34306b" stroke-width="3"/>', dot: '<circle cx="13" cy="10" r="7" fill="#2e7d4f" stroke="#14502d" stroke-width="1.5"/>', obs: '<circle cx="13" cy="10" r="4.6" fill="#6a645b"/>' };
  return el('div', { class: 'legend2', 'aria-hidden': 'true' }, ...items.map(([k, t]) => el('span', { class: 'lg' }, el('span', { html: `<svg viewBox="0 0 26 20" width="26" height="20">${sw[k]}</svg>` }), t)));
}
// make a whole picture drag a slider that lines up with its axis (10..290 of 300)
function dragOnStrip(root, slider, onUser) {
  let down = false; const at = e => { const r = root.getBoundingClientRect(); return ((e.clientX - r.left) / r.width * 300 - 10) / 280; };
  root.style.touchAction = 'none'; root.style.cursor = 'ew-resize';
  root.addEventListener('pointerdown', e => { if (slider.el.classList.contains('locked')) return; down = true; root.setPointerCapture(e.pointerId); slider.set(0, at(e), true); });
  root.addEventListener('pointermove', e => { if (down && !slider.el.classList.contains('locked')) slider.set(0, at(e), true); });
  const end = () => { down = false; }; root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
}
// svg string helpers for data layers
const S = {
  dot: (x, y, r = 5, cls = 'pdot') => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="${cls}"/>`,
  line: (x1, y1, x2, y2, cls = 'pline') => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}"/>`,
  rect: (x, y, w, h, cls = '') => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" class="${cls}"/>`,
  text: (x, y, t, cls = '', anchor = 'middle') => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" class="pt ${cls}">${t}</text>`,
  path: (d, cls = 'pline') => `<path d="${d}" class="${cls}"/>`,
};

// Under-the-plot readout: a number line with units, lined up with an AxisSlider
// (both use 10/300 padding), so dragging the slider matches what is drawn.
function Strip({ xd, ticks, H = 96, xfmt = v => v, label = '', xTitle = '', T = 6 }) {
  return Plot({ W: 300, H, xd, yd: [0, 1], L: 10, R: 10, T, B: 30, xticks: ticks, xfmt, label, xTitle });
}
// ticks only, for sliders on their own
function TickRow({ xd, ticks, xfmt = v => v, label = '' }) {
  const p = Plot({ W: 300, H: 28, xd, yd: [0, 1], L: 10, R: 10, T: 0, B: 28, xticks: ticks, xfmt, label });
  p.box.removeAttribute('role'); p.box.setAttribute('aria-hidden', 'true');
  return p;
}
// map between slider shares (0..1) and real units
const toUnits = (v, xd) => xd[0] + v * (xd[1] - xd[0]);
const toShare = (u, xd) => (u - xd[0]) / (xd[1] - xd[0]);

// ---------------------------------------------------------------------------
// BarStrip: bars at m evenly spaced candidate shares 0..1 (the "grid"), as a
// belief, a likelihood or a posterior. Heights are scaled to the tallest.
// ---------------------------------------------------------------------------
function BarStrip({ m = 11, values = [], cls = '', caption = '', H = 58, ticks = false, hi = null, mark = null, curve = null, label = '', xfmt = v => Math.round(v * 100) + '%', xticks = [0, 0.5, 1], xlabels = null }) {
  const W = 300, extra = ticks ? 28 : 0, root = el('div', { class: 'barstrip ' + cls, role: 'img', 'aria-label': label });
  const api = {
    el: root, values,
    set(v, o = {}) {
      Object.assign(api, o); values = v; api.values = v;
      const mx = Math.max(...v, 1e-12), step = 280 / (m - 1), bw = Math.min(22, step * 0.78), hs = [].concat(api.hi == null ? [] : api.hi);
      let s = `<svg viewBox="0 0 ${W} ${H + extra}" aria-hidden="true">`;
      if (curve) { let d = ''; const cm = Math.max(...Array.from({ length: 101 }, (_, i) => curve(i / 100)), 1e-12); for (let i = 0; i <= 120; i++) { const x = i / 120, y = curve(x); d += `${i ? 'L' : 'M'}${(10 + 280 * x).toFixed(1)} ${(H - 4 - y / cm * (H - 10)).toFixed(1)} `; } s += `<path d="${d}" class="bs-curve"/>`; }
      v.forEach((x, i) => { const h = Math.max(1.5, x / mx * (H - 10)), cx = 10 + step * i; s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(H - 4 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" class="bs-bar${hs.includes(i) ? ' hi' : ''}" rx="2"/>`; });
      if (api.mark != null) s += `<line x1="${10 + 280 * api.mark}" x2="${10 + 280 * api.mark}" y1="2" y2="${H - 2}" class="bs-mark"/>`;
      s += `<line x1="4" x2="296" y1="${H - 3}" y2="${H - 3}" class="paxis"/>`;
      if (caption) s += `<text x="5" y="20" class="pt bs-cap">${caption}</text>`;
      if (ticks) xticks.forEach((t, k) => { const lab = xlabels ? xlabels[k] : xfmt(t), half = String(lab).length * 7.4, x = clamp(10 + 280 * t, half + 1, W - half - 1); s += `<text x="${x.toFixed(1)}" y="${H + 22}" text-anchor="middle" class="pt">${lab}</text>`; });
      root.innerHTML = s + '</svg>';
    },
  };
  api.hi = hi; api.mark = mark; api.set(values);
  return api;
}

// ---------------------------------------------------------------------------
// Pile: samples stacked into bars. `cut` colours the two sides differently.
// ---------------------------------------------------------------------------
function Pile({ bins = 25, samples = [], cut = null, H = 96, label = '', lo = 0, hi = 1, xticks = [0, 0.5, 1], xfmt = v => Math.round(v * 100) + '%', cutLabel = true }) {
  const W = 300, root = el('div', { class: 'pile', role: 'img', 'aria-label': label });
  const api = {
    el: root, samples,
    set(sm, o = {}) {
      Object.assign(api, o); api.samples = sm;
      const counts = Array(bins).fill(0); sm.forEach(x => { counts[clamp(Math.floor((x - lo) / (hi - lo) * bins), 0, bins - 1)]++; });
      const mx = Math.max(...counts, 1), bw = 280 / bins;
      let s = `<svg viewBox="0 0 ${W} ${H + 28}" aria-hidden="true">`;
      counts.forEach((c, i) => { const h = c / mx * (H - 8), x0 = 10 + i * bw, mid = lo + (i + 0.5) / bins * (hi - lo); const side = api.cut == null ? '' : mid < api.cut ? ' left' : ' right'; s += `<rect x="${(x0 + 0.6).toFixed(1)}" y="${(H - 2 - h).toFixed(1)}" width="${(bw - 1.2).toFixed(1)}" height="${h.toFixed(1)}" class="pile-bar${side}"/>`; });
      s += `<line x1="4" x2="296" y1="${H - 1}" y2="${H - 1}" class="paxis"/>`;
      if (api.cut != null) s += `<line x1="${10 + 280 * (api.cut - lo) / (hi - lo)}" x2="${10 + 280 * (api.cut - lo) / (hi - lo)}" y1="2" y2="${H}" class="pile-cut"/>`;
      xticks.forEach(t => { const lab = xfmt(t), half = lab.length * 7.4, x = clamp(10 + 280 * (t - lo) / (hi - lo), half + 1, W - half - 1); s += `<text x="${x.toFixed(1)}" y="${H + 22}" text-anchor="middle" class="pt">${lab}</text>`; });
      root.innerHTML = s + '</svg>';
    },
  };
  api.cut = cut; api.set(samples);
  return api;
}

// ---------------------------------------------------------------------------
// TracePlot: several chains wandering over iterations (a small picture, used inside buttons).
// ---------------------------------------------------------------------------
const CHAIN_DASH = ['', '6 3', '2 3', '10 3 2 3'];
function TracePlot({ chains, H = 64, ylim, label = '' }) {
  const W = 300, [y0, y1] = ylim, root = el('div', { class: 'trace', role: 'img', 'aria-label': label });
  let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" class="trace-bg"/>`;
  chains.forEach((c, k) => { const pts = c.map((v, i) => `${(4 + i / (c.length - 1) * (W - 8)).toFixed(1)},${(H - 4 - (clamp(v, y0, y1) - y0) / (y1 - y0) * (H - 8)).toFixed(1)}`).join(' '); s += `<polyline points="${pts}" class="trace-line c${k}" stroke-dasharray="${CHAIN_DASH[k % 4]}"/>`; });
  root.innerHTML = s + '</svg>'; return root;
}

// ---------------------------------------------------------------------------
// ParamTable: a brms-style summary. Tap a cell (mode 'cell') or a whole row (mode 'row').
// ---------------------------------------------------------------------------
function ParamTable({ cols, rows, mode = 'cell', onPick = () => {}, label = 'Model summary table' }) {
  const root = el('div', { class: 'ptable ' + mode, role: 'group', 'aria-label': label, style: `--cols:${cols.length}` });
  root.append(el('div', { class: 'pth blank', 'aria-hidden': 'true' }), ...cols.map(c => el('div', { class: 'pth' }, c)));
  let picked = null; const cells = [];
  const sel = (r, c, b) => { cells.forEach(x => x.b.classList.remove('on')); picked = { r, c }; (mode === 'row' ? cells.filter(x => x.r === r) : [{ b }]).forEach(x => x.b.classList.add('on')); onPick(picked); };
  rows.forEach((row, r) => {
    root.append(el('div', { class: 'ptn' }, row.name));
    row.cells.forEach((txt, c) => {
      const b = el('button', { class: 'ptc', 'aria-label': mode === 'row' ? `Row ${row.name}, ${cols.map((cc, i) => cc + ' ' + row.cells[i]).join(', ')}` : `${row.name}, ${cols[c]}: ${txt}`, onclick: () => sel(r, c, b) }, txt);
      cells.push({ r, c, b }); root.append(b);
    });
  });
  return {
    el: root, get: () => picked, cells,
    pick(r, c) { cells.find(x => x.r === r && (mode === 'row' || x.c === c)).b.click(); },
    reveal(good, bad = null) { cells.forEach(x => { x.b.disabled = true; x.b.classList.remove('on'); const g = mode === 'row' ? x.r === good.r : x.r === good.r && x.c === good.c; if (g) x.b.classList.add('right'); else if (bad && (mode === 'row' ? x.r === bad.r : x.r === bad.r && x.c === bad.c)) x.b.classList.add('wrong'); }); },
  };
}

// ---------------------------------------------------------------------------
// ShrinkStrip: one group on a number line. Small dots are its own measurements,
// the ring is their average, the filled dot is where the model puts the group
// after pooling, the dashed line is the all-groups average.
// ---------------------------------------------------------------------------
function ShrinkStrip({ m, obs = [], mu, pooled = null, axis = [0, 40], H = 44, tau = null, label = '', showMean = true, r = 8, rObs = 4.6 }) {
  const W = 300, sx = x => 10 + (x - axis[0]) / (axis[1] - axis[0]) * 280, mid = H / 2;
  const root = el('div', { class: 'shrinkstrip', role: 'img', 'aria-label': label });
  const api = {
    el: root,
    set(p) {
      let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
      if (tau != null) s += `<rect x="${sx(mu - tau)}" y="2" width="${sx(mu + tau) - sx(mu - tau)}" height="${H - 4}" class="ss-band"/>`;
      s += `<line x1="${sx(mu)}" x2="${sx(mu)}" y1="0" y2="${H}" class="ss-mu"/>`;
      obs.forEach((o, i) => { s += `<circle cx="${sx(o).toFixed(1)}" cy="${(mid + (i % 2 ? H * 0.16 : -H * 0.16)).toFixed(1)}" r="${rObs}" class="ss-obs"/>`; });
      if (p != null && Math.abs(sx(p) - sx(m)) > 1) s += `<line x1="${sx(m)}" x2="${sx(p)}" y1="${mid}" y2="${mid}" class="ss-link"/>`;
      if (showMean) s += `<circle cx="${sx(m).toFixed(1)}" cy="${mid}" r="${r + 3}" class="ss-ring"/>`;
      if (p != null) s += `<circle cx="${sx(p).toFixed(1)}" cy="${mid}" r="${r}" class="ss-pool"/>`;
      root.innerHTML = s + '</svg>';
    },
  };
  api.set(pooled); return api;
}

// ---------------------------------------------------------------------------
// Chips of text a player can pick between (few, short) : used where naming is unavoidable.
// ---------------------------------------------------------------------------
function PickButtons(options, onPick, cls = '') {
  const root = el('div', { class: 'pickrow ' + cls, role: 'group' });
  const btns = options.map((o, i) => el('button', { class: 'pickbtn', 'aria-label': o.aria || o.text, onclick: () => { btns.forEach((b, j) => b.classList.toggle('on', j === i)); onPick(i); } }, o.html ? el('span', { html: o.html }) : o.text));
  root.append(...btns); return { el: root, btns, reveal(good, bad) { btns.forEach((b, i) => { b.disabled = true; b.classList.remove('on'); if (i === good) b.classList.add('right'); else if (i === bad) b.classList.add('wrong'); }); } };
}
