// Reusable pieces. Each one is something you look at, move or tap. Pictures
// are drawn at 1 unit = 1 screen pixel, so the 17px text inside them stays 17px.
// Colour never carries meaning alone: group A is an orange circle, group B a
// blue square, and people have their own marker shapes and letters.
const NS = 'http://www.w3.org/2000/svg';

function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
}
function sv(tag, props, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(props || {})) if (v !== false && v != null) e.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
}
const M = MM;
const f1 = x => M.fmt(x, 1), f2 = x => M.fmt(x, 2), f0 = x => M.fmt(x, 0);
const stagePad = stage => { const cs = getComputedStyle(stage); return stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); };

// Height for a picture: what is left of the stage, keeping 70px back for the answer's explanation to grow into.
const roomH = (ctx, other = 0, min = 170, max = 320) => Math.round(M.clamp(ctx.stage.clientHeight - 82 - other, min, max));

// A marker shape as an SVG node, centred on (0,0). Shapes differ by form, not only colour.
function marker(shape, r = 8, cls = '') {
  const c = 'mk ' + cls;
  if (shape === 'sq') return sv('rect', { class: c, x: -r, y: -r, width: 2 * r, height: 2 * r, rx: 2 });
  if (shape === 'tri') return sv('polygon', { class: c, points: `0,${-r * 1.15} ${r * 1.1},${r * .85} ${-r * 1.1},${r * .85}` });
  if (shape === 'dia') return sv('polygon', { class: c, points: `0,${-r * 1.25} ${r * 1.1},0 0,${r * 1.25} ${-r * 1.1},0` });
  return sv('circle', { class: c, r });
}

// ---------------------------------------------------------------------------
// Plot: an SVG chart with data-to-pixel scales and a handle machine.
// ---------------------------------------------------------------------------
function Plot(ctx, { h = 240, left = 44, right = 14, top = 12, bottom = 34, xr = [0, 1], yr = [0, 1], label = 'Chart', w } = {}) {
  const W = w || Math.round(stagePad(ctx.stage)), H = h;
  const svg = sv('svg', { class: 'plot', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': label });
  const under = sv('g'), over = sv('g'); svg.append(under, over);
  const ch = { svg, W, H, under, over, handles: [], left, right, top, bottom, xr, yr };
  ch.X = v => left + (v - xr[0]) / (xr[1] - xr[0]) * (W - left - right);
  ch.Y = v => H - bottom - (v - yr[0]) / (yr[1] - yr[0]) * (H - top - bottom);
  ch.xv = px => xr[0] + (px - left) / (W - left - right) * (xr[1] - xr[0]);
  ch.yv = py => yr[0] + (H - bottom - py) / (H - top - bottom) * (yr[1] - yr[0]);
  ch.add = (n, layer = under) => { layer.append(n); return n; };
  ch.line = (x1, y1, x2, y2, cls = 'ln', layer = under) => ch.add(sv('line', { class: cls, x1: ch.X(x1), y1: ch.Y(y1), x2: ch.X(x2), y2: ch.Y(y2) }), layer);
  ch.pline = (x1, y1, x2, y2, cls = 'ln', layer = under) => ch.add(sv('line', { class: cls, x1, y1, x2, y2 }), layer);
  ch.text = (px, py, s, cls = 'tx', anchor = 'start', layer = under) => ch.add(sv('text', { class: cls, x: px, y: py, 'text-anchor': anchor }, s), layer);
  ch.axisX = (ticks, { y = H - bottom, grid = false } = {}) => {
    ch.pline(left, y, W - right, y, 'axis');
    for (const [v, s] of ticks) { const px = ch.X(v); if (grid) ch.pline(px, top, px, y, 'grid'); ch.pline(px, y, px, y + 5, 'axis'); ch.text(px, y + 24, s, 'tx tick', 'middle'); }
  };
  ch.axisY = (ticks, { x = left, grid = true } = {}) => {
    ch.pline(x, top, x, H - bottom, 'axis');
    for (const [v, s] of ticks) { const py = ch.Y(v); if (grid) ch.pline(x, py, W - right, py, 'grid'); ch.pline(x - 5, py, x, py, 'axis'); ch.text(x - 8, py + 6, s, 'tx tick', 'end'); }
  };
  ch.at = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };
  // press anywhere on the picture: the nearest handle that allows it jumps to the finger and follows it
  svg.addEventListener('pointerdown', e => {
    const live = ch.handles.filter(x => !x.locked); if (!live.length) return;
    let hd = live.find(x => x.g.contains(e.target));
    if (!hd) { const [px, py] = ch.at(e); const any = live.filter(x => x.anywhere); if (!any.length) return; hd = any.reduce((b, x) => { const [a, c] = x.pos(x.v); const d = Math.hypot(a - px, c - py); return !b || d < b.d ? { x, d } : b; }, null).x; }
    e.preventDefault(); svg.setPointerCapture(e.pointerId); ch.active = hd; hd.g.focus({ preventScroll: true }); hd.fromPointer(e);
  });
  svg.addEventListener('pointermove', e => { if (ch.active && !ch.active.locked) ch.active.fromPointer(e); });
  const end = () => { ch.active = null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  return ch;
}

// A handle you drag along one direction. `pos(v)` gives its pixel position, `read(px,py)` turns a
// pointer position back into a value. Arrow keys move it by `step` (like any slider).
function Handle(ch, { name, v, min, max, step = 1, pos, read, fmt = x => String(x), glyph = 'h', cls = '', onChange = () => {}, pulse = false, anywhere = true, shape = null, r = 13 }) {
  const g = sv('g', { class: 'handle ' + cls + (pulse ? ' pulse' : ''), tabindex: 0, role: 'slider', 'aria-label': name, 'aria-valuemin': min, 'aria-valuemax': max });
  g.append(sv('circle', { class: 'hit', r: 22 }));
  g.append(shape || sv('circle', { class: 'hbody', r }));
  const a = glyph === 'h' ? 'M-9,0 l5,-4 v8 z M9,0 l-5,-4 v8 z' : 'M0,-9 l-4,5 h8 z M0,9 l-4,-5 h8 z';
  g.append(sv('path', { class: 'hglyph', d: a }));
  const api = { g, v, min, max, locked: false, anywhere, pos, touched: false };
  api.set = (x, fromUser = false, silent = false) => {
    api.v = M.clamp(Math.round(x / step) * step, min, max); api.v = Math.round(api.v * 1e6) / 1e6;
    const [px, py] = pos(api.v); g.setAttribute('transform', `translate(${px},${py})`);
    g.setAttribute('aria-valuenow', api.v); g.setAttribute('aria-valuetext', fmt(api.v));
    if (fromUser) { api.touched = true; g.classList.remove('pulse'); }
    if (!silent) onChange(api.v, fromUser);
  };
  api.fromPointer = e => { const [px, py] = ch.at(e); api.set(read(px, py), true); };
  api.lock = () => { api.locked = true; g.classList.add('locked'); g.removeAttribute('tabindex'); g.setAttribute('aria-disabled', 'true'); };
  api.unlock = () => { api.locked = false; g.classList.remove('locked'); g.tabIndex = 0; g.removeAttribute('aria-disabled'); };
  g.addEventListener('keydown', e => {
    if (api.locked) return; const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
    if (d) { e.preventDefault(); api.set(api.v + d * step * (e.shiftKey ? 5 : 1), true); }
    else if (e.key === 'Home') { e.preventDefault(); api.set(min, true); } else if (e.key === 'End') { e.preventDefault(); api.set(max, true); }
  });
  ch.add(g, ch.over); ch.handles.push(api); api.set(v, false, true);
  return api;
}
// handle on a horizontal / vertical track in data coordinates
const hx = (ch, py, o) => Handle(ch, { ...o, glyph: 'h', pos: v => [ch.X(v), typeof py === 'function' ? py(v) : py], read: px => ch.xv(px) });
const hy = (ch, px, o) => Handle(ch, { ...o, glyph: 'v', pos: v => [typeof px === 'function' ? px(v) : px, ch.Y(v)], read: (x, py) => ch.yv(py) });

// ---------------------------------------------------------------------------
// Three linked scales: probability, odds, log-odds. One state (p), three number lines.
// ---------------------------------------------------------------------------
const SCALE_ROWS = {
  P: { name: 'Probability', lo: 0, hi: 1, ticks: [[0, '0'], [0.5, '.5'], [1, '1']], land: 0.5, get: p => p, set: v => v },
  O: { name: 'Odds', lo: 0, hi: 10, ticks: [[0, '0'], [1, '1'], [5, '5'], [10, '10']], land: 1, get: p => M.odds(p), set: v => M.probFromOdds(v) },
  L: { name: 'Log-odds', lo: -4, hi: 4, ticks: [[-4, '−4'], [-2, '−2'], [0, '0'], [2, '2'], [4, '4']], land: 0, get: p => M.qlogis(p), set: v => M.plogis(v) },
};
const SCALE_FMT = { P: v => ((v >= 0.995 || v <= 0.005) && v > 0 && v < 1 ? M.fmt(v, 3) : M.fmt(v, 2)).replace(/^0\./, '.'), O: v => v >= 100 ? f0(v) : v >= 10 ? f1(v) : f2(v), L: v => f1(v) };
function Scales3(ctx, { p = 0.5, order = ['P', 'O', 'L'], drag = ['P', 'O', 'L'], onChange = () => {}, pulse = null, label = 'Probability, odds and log-odds number lines', pitch = 68 } = {}) {
  const ch = Plot(ctx, { h: pitch * order.length - 4, left: 14, right: 14, top: 0, bottom: 0, label });
  const api = { ch, p, rows: {}, rings: {}, locked: false };
  const L = ch.W - 28;
  order.forEach((key, i) => {
    const R = SCALE_ROWS[key], y0 = i * pitch, ay = y0 + 38;
    const X = v => 14 + (v - R.lo) / (R.hi - R.lo) * L;
    const row = { R, ay, X, label: ch.text(14, y0 + 17, '', 'tx tb') };
    ch.pline(14, ay, 14 + L, ay, 'axis');
    ch.pline(X(R.land), ay - 12, X(R.land), ay + 12, 'land');
    for (const [v, s] of R.ticks) { ch.pline(X(v), ay, X(v), ay + 6, 'axis'); ch.text(X(v), ay + 24, s, 'tx tick', v === R.lo ? 'start' : v === R.hi ? 'end' : 'middle'); }
    row.ghost = ch.add(sv('circle', { class: 'ringm', r: 15, cy: ay, cx: 0, style: 'display:none' }), ch.over);
    if (drag.includes(key)) {
      const lim = key === 'P' ? [0.02, 0.98] : key === 'L' ? [-3.9, 3.9] : [0.05, 10];
      row.h = Handle(ch, { name: `${R.name} marker`, v: R.get(p), min: lim[0], max: lim[1], step: key === 'P' ? 0.01 : key === 'L' ? 0.1 : 0.05, glyph: 'h', pulse: pulse === key,
        pos: v => [X(v), ay], read: px => R.lo + (px - 14) / L * (R.hi - R.lo), fmt: v => `${R.name} ${SCALE_FMT[key](v)}`,
        onChange: (v, u) => { if (u) api.setP(R.set(v), true); } });
    } else row.dot = ch.add(sv('circle', { class: 'fixm', r: 9, cy: ay, cx: 0 }), ch.over);
    api.rows[key] = row;
  });
  api.setP = (pp, fromUser = false) => {
    api.p = M.clamp(pp, 0.005, 0.995);
    for (const [key, row] of Object.entries(api.rows)) {
      const R = row.R, v = R.get(api.p), shown = M.clamp(v, R.lo, R.hi), off = v > R.hi + 1e-9 || v < R.lo - 1e-9;
      if (row.h) row.h.set(M.clamp(v, row.h.min, row.h.max), false, true);
      if (row.dot) row.dot.setAttribute('cx', row.X(shown));
      row.label.textContent = `${R.name}  ${SCALE_FMT[key](v)}${off ? '  (off the end)' : ''}`;
    }
    onChange(api.p, fromUser);
  };
  // a hollow ring on one row: where a function's answer lands
  api.ring = (key, value) => { const row = api.rows[key]; if (value == null || !isFinite(value)) { row.ghost.style.display = 'none'; return; } row.ghost.style.display = ''; row.ghost.setAttribute('cx', row.X(M.clamp(value, row.R.lo, row.R.hi))); row.ghost.classList.toggle('edge', value > row.R.hi || value < row.R.lo); };
  api.clearRings = () => Object.values(api.rows).forEach(r => { r.ghost.style.display = 'none'; });
  api.lock = () => { api.locked = true; Object.values(api.rows).forEach(r => r.h && r.h.lock()); };
  api.touched = () => Object.values(api.rows).some(r => r.h && r.h.touched);
  api.setP(p);
  ctx.stage.append(ch.svg);
  return api;
}

// ---------------------------------------------------------------------------
// Bars on the log-odds axis, with the means. Each bar is a cell's log-odds; its probability is the label.
// ---------------------------------------------------------------------------
function LogitBars(ctx, { vals, names = ['A', 'B', 'C', 'D'], drag = [], pulse = -1, means = true, range = [-7.5, 7.5], pitch = 34, label = 'Bars on the log-odds axis' }) {
  const n = vals.length, tickH = 54, topPad = 22, H = topPad + n * pitch + tickH;
  const ch = Plot(ctx, { h: H, left: 70, right: 12, top: topPad, bottom: tickH, xr: range, yr: [0, 1], label });
  const api = { ch, vals: vals.slice(), bars: [], handles: [] };
  const y0 = topPad;
  const lt = []; for (let t = Math.ceil(range[0] / 3) * 3; t <= range[1]; t += 3) lt.push([t, f0(t)]);
  const pt = [[M.qlogis(0.01), '.01'], [M.qlogis(0.1), '.1'], [0, '.5'], [M.qlogis(0.9), '.9'], [M.qlogis(0.99), '.99']].filter(([v]) => v > range[0] && v < range[1]);
  const ay = y0 + n * pitch;
  ch.pline(ch.X(range[0]), ay, ch.X(range[1]), ay, 'axis');
  for (const [v, s] of lt) { ch.pline(ch.X(v), ay, ch.X(v), ay + 5, 'axis'); ch.text(ch.X(v), ay + 22, s, 'tx tick', 'middle'); }
  ch.text(6, ay + 22, 'log-odds', 'tx tick');
  ch.pline(ch.left - 4, ay + 25, ch.W - ch.right, ay + 25, 'axis faint');
  for (const [v, s] of pt) { ch.pline(ch.X(v), ay + 25, ch.X(v), ay + 30, 'axis'); ch.text(ch.X(v), ay + 50, s, 'tx tick', 'middle'); }
  ch.text(6, ay + 50, 'prob.', 'tx tick');
  ch.pline(ch.X(0), y0 - 2, ch.X(0), ay, 'zero');
  vals.forEach((v, i) => {
    const yc = y0 + i * pitch + pitch / 2;
    const lab = ch.text(4, yc + 6, '', 'tx tb'); const bar = sv('rect', { class: 'bar' + (drag.includes(i) ? ' live' : ''), y: yc - 10, height: 20, rx: 3 }); ch.add(bar);
    api.bars.push({ lab, bar, yc });
    if (drag.includes(i)) api.handles[i] = hx(ch, yc, { name: `Cell ${names[i]} log-odds`, v, min: -6.9, max: 6.9, step: 0.1, pulse: pulse === i, fmt: x => `${f1(x)} log-odds, probability ${f2(M.plogis(x))}`, onChange: (x, u) => { api.set(i, x, u); } });
  });
  const mk = (cls, glyph) => { const g = sv('g', { class: 'meanmk ' + cls }); g.append(sv('line', { class: 'ml', x1: 0, x2: 0, y1: 8, y2: ay - y0 + topPad }), glyph); ch.add(g, ch.over); return g; };
  api.m1 = means ? mk('m-logit', marker('circle', 8, 'mkfill')) : null;
  api.m2 = means === 'both' ? mk('m-prob', marker('dia', 8, 'mkhollow')) : null;
  api.names = names;
  api.meanLogit = () => M.mean(api.vals);
  api.meanProbAsLogit = () => M.qlogis(M.mean(api.vals.map(M.plogis)));
  api.set = (i, x, fromUser) => {
    api.vals[i] = x; paint(); if (api.onChange) api.onChange(api.vals, fromUser, i);
  };
  function paint() {
    api.vals.forEach((x, i) => {
      const b = api.bars[i], x0 = ch.X(0), x1 = ch.X(x);
      b.bar.setAttribute('x', Math.min(x0, x1)); b.bar.setAttribute('width', Math.max(1, Math.abs(x1 - x0)));
      b.lab.textContent = `${api.names[i]} ${SCALE_FMT.P(M.plogis(x))}`;
      if (api.handles[i]) api.handles[i].set(x, false, true);
    });
    const place = (g, v) => g && g.setAttribute('transform', `translate(${ch.X(M.clamp(v, range[0], range[1]))},${y0 - 6})`);
    place(api.m1, api.meanLogit()); if (api.m2) place(api.m2, api.meanProbAsLogit());
  }
  api.paint = paint;
  api.addMarker = (v, cls) => { const g = sv('g', { class: 'meanmk ' + cls }); g.append(sv('line', { class: 'ml', x1: 0, x2: 0, y1: 8, y2: ay - y0 + topPad }), marker('dia', 8, 'mkhollow')); ch.add(g, ch.over); g.setAttribute('transform', `translate(${ch.X(M.clamp(v, range[0], range[1]))},${y0 - 6})`); return g; };
  api.target = v => { const t = ch.pline(ch.X(v), y0, ch.X(v), ay, 'targetln'); ch.text(ch.X(v), y0 - 8, '★', 'tx tb', 'middle'); return t; };
  ctx.stage.append(ch.svg); paint();
  return api;
}

// ---------------------------------------------------------------------------
// A drawn model table. Cells (or whole rows) are buttons when it is a tapping question.
// ---------------------------------------------------------------------------
function ModelTable({ cols, rows, mode = 'cell', onTap = () => {}, caption = 'Model table', flash = null, only = null, can = null, compact = false, hot = null, widths = null }) {
  const t = el('table', { class: 'mt' + (compact ? ' compact' : ''), role: 'grid', 'aria-label': caption });
  const head = el('tr', {}, el('th', { scope: 'col' }, ''), ...cols.map(c => el('th', { scope: 'col', 'aria-label': c.aria || c.label }, c.label)));
  if (widths) t.classList.add('cg');
  if (widths) t.append(el('colgroup', {}, ...widths.map(w => el('col', { style: `width:${w}%` }))));
  t.append(el('thead', {}, head));
  const tb = el('tbody'); t.append(tb);
  const api = { el: t, cells: {}, sel: null, locked: false };
  rows.forEach((r, ri) => {
    const tr = el('tr', { class: r.cls || '' }); tb.append(tr);
    tr.append(el('th', { scope: 'row', class: 'mtname' }, r.name));
    cols.forEach((c, ci) => {
      const text = r.cells[ci];
      const td = el('td', {});
      if (mode === 'none' || text == null || r.dead || (only && !(only[0] === ri && only[1] === ci)) || (can && !can(ri, ci))) td.textContent = text == null ? '' : text;
      else {
        const b = el('button', { class: 'mtcell', 'aria-label': `${r.aria || r.name}, ${c.aria || c.label}: ${text}` + (r.sub ? '' : ''), onclick: () => { if (api.locked) return; api.pick(ri, ci); } }, text);
        if (flash && flash[0] === ri && flash[1] === ci) b.classList.add('flash');
        td.append(b); api.cells[ri + ':' + ci] = b;
      }
      tr.append(td);
    });
  });
  api.pick = (ri, ci) => {
    api.sel = [ri, ci];
    for (const [k, b] of Object.entries(api.cells)) { const [r, c] = k.split(':').map(Number); b.classList.toggle('on', mode === 'row' ? r === ri : r === ri && c === ci); b.setAttribute('aria-pressed', String(mode === 'row' ? r === ri : r === ri && c === ci)); b.classList.remove('flash'); }
    onTap(ri, ci);
  };
  api.mark = (ri, ci, cls) => { const b = api.cells[ri + ':' + ci]; if (b) b.classList.add(cls); };
  api.markRow = (ri, cls) => { cols.forEach((_, ci) => api.mark(ri, ci, cls)); };
  api.lock = () => { api.locked = true; for (const b of Object.values(api.cells)) b.disabled = true; };
  return api;
}

// A few short options as big buttons. onPick(key). `cols` columns.
function Choices(opts, { cols = opts.length <= 2 ? opts.length : opts.length === 4 ? 2 : 1, onPick = () => {}, cls = '', flashKey = null } = {}) {
  const root = el('div', { class: 'choices ' + cls, role: 'group', style: `grid-template-columns:repeat(${cols},1fr)` });
  const api = { el: root, key: null, btns: {}, locked: false };
  for (const o of opts) {
    const b = el('button', { class: 'choice' + (flashKey === o.key ? ' flash' : ''), 'aria-pressed': 'false', 'aria-label': o.aria || null, onclick: () => { if (api.locked) return; api.pick(o.key, true); } });
    if (o.html) b.innerHTML = o.html; else b.textContent = o.label;
    root.append(b); api.btns[o.key] = b;
  }
  api.pick = (key, user) => { api.key = key; for (const [k, b] of Object.entries(api.btns)) { b.classList.toggle('on', k === key); b.setAttribute('aria-pressed', String(k === key)); b.classList.remove('flash'); } onPick(key, user); };
  api.mark = (key, cls) => api.btns[key] && api.btns[key].classList.add(cls);
  api.lock = () => { api.locked = true; for (const b of Object.values(api.btns)) b.disabled = true; };
  return api;
}

// A counter you set with - and +.
function Stepper({ value = 0, min = 0, max = 99, label = 'Count', onChange = () => {}, flash = false }) {
  const out = el('output', { class: 'stepval', 'aria-live': 'polite' }, String(value));
  const api = { v: value, el: null, locked: false };
  const set = (x, user) => { api.v = M.clamp(x, min, max); out.textContent = String(api.v); onChange(api.v, user); };
  const minus = el('button', { class: 'stepbtn', 'aria-label': `${label}: one fewer`, onclick: () => { if (!api.locked) set(api.v - 1, true); } }, '−');
  const plus = el('button', { class: 'stepbtn' + (flash ? ' flash' : ''), 'aria-label': `${label}: one more`, onclick: () => { if (!api.locked) set(api.v + 1, true); } }, '+');
  api.el = el('div', { class: 'stepper', role: 'group', 'aria-label': label }, minus, out, plus);
  api.set = set; api.lock = () => { api.locked = true; minus.disabled = plus.disabled = true; };
  return api;
}

// Chips you switch on and off (a set answer).
function ChipSet(items, { onChange = () => {}, cols = 2, states = ['', 'on'], label = 'Options' } = {}) {
  const root = el('div', { class: 'chipset', role: 'group', 'aria-label': label, style: `grid-template-columns:repeat(${cols},1fr)` });
  const api = { el: root, on: {}, btns: {}, locked: false };
  for (const it of items) {
    const b = el('button', { class: 'chip2', 'aria-pressed': 'false', onclick: () => { if (api.locked) return; api.toggle(it.key, true); } }, el('span', { class: 'tick', 'aria-hidden': 'true' }), it.label);
    root.append(b); api.btns[it.key] = b; api.on[it.key] = false;
  }
  api.toggle = (k, user) => { api.on[k] = !api.on[k]; api.paint(); onChange(api.on, user); };
  api.setAll = o => { for (const k of Object.keys(api.on)) api.on[k] = !!o[k]; api.paint(); onChange(api.on, false); };
  api.paint = () => { for (const k of Object.keys(api.on)) { api.btns[k].classList.toggle('on', api.on[k]); api.btns[k].setAttribute('aria-pressed', String(api.on[k])); api.btns[k].firstChild.textContent = api.on[k] ? '✓' : ''; } };
  api.lock = () => { api.locked = true; for (const b of Object.values(api.btns)) b.disabled = true; };
  api.keys = () => Object.keys(api.on).filter(k => api.on[k]);
  return api;
}

// A grid of cells, rows x columns. `dots(r,c)` is how many observations sit in the cell. Tap to toggle when `tap`.
function DesignGrid({ rows, cols, dots = () => 0, label = null, tap = false, onTap = () => {}, colGroups = null, caption = 'Design table', cell = 44, cellH = 44, flashCell = null, rowW = 0 }) {
  const root = el('div', { class: 'dgrid', role: 'group', 'aria-label': caption });
  const api = { el: root, btns: {}, locked: false, state: {} };
  const tpl = `${rowW || 52}px repeat(${cols.length}, ${cell}px)`;
  root.style.gridTemplateColumns = tpl; root.style.setProperty('--cellh', cellH + 'px');
  if (colGroups) { root.append(el('div', { class: 'dg-corner' })); for (const g of colGroups) root.append(el('div', { class: 'dg-grp', style: `grid-column: span ${g.span}` }, g.label)); }
  root.append(el('div', { class: 'dg-corner' })); for (const c of cols) root.append(el('div', { class: 'dg-col' }, c));
  rows.forEach((rl, r) => {
    root.append(el('div', { class: 'dg-row' }, rl));
    cols.forEach((cl, c) => {
      const n = dots(r, c), k = r + ':' + c; api.state[k] = !!(tap ? false : n);
      const b = el(tap ? 'button' : 'div', { class: 'dg-cell' + (tap ? ' tap' : '') + (flashCell && flashCell[0] === r && flashCell[1] === c ? ' flash' : ''), 'aria-label': `${rl}, ${cl}: ${n ? n + ' observation' + (n > 1 ? 's' : '') : 'empty'}`, ...(tap ? { 'aria-pressed': 'false' } : {}) });
      if (label) b.append(el('span', { class: 'dgn' }, label(r, c)));
      else { b.append(...Array.from({ length: Math.min(n, 4) }, () => el('i', { class: 'dgdot', 'aria-hidden': 'true' }))); if (n > 4) b.append(el('span', { class: 'dgn' }, String(n))); }
      if (tap) b.addEventListener('click', () => { if (api.locked) return; api.toggle(r, c, true); });
      root.append(b); api.btns[k] = b;
    });
  });
  api.toggle = (r, c, user) => {
    const k = r + ':' + c; api.state[k] = !api.state[k]; const b = api.btns[k];
    b.classList.toggle('filled', api.state[k]); b.setAttribute('aria-pressed', String(api.state[k])); b.classList.remove('flash');
    if (!label) b.replaceChildren(...(api.state[k] ? [el('i', { class: 'dgdot', 'aria-hidden': 'true' }), el('i', { class: 'dgdot', 'aria-hidden': 'true' })] : []));
    onTap(r, c, api.state[k], user);
  };
  api.filled = () => Object.keys(api.state).filter(k => api.state[k]);
  api.mark = (r, c, cls) => api.btns[r + ':' + c].classList.add(cls);
  api.lock = () => { api.locked = true; for (const b of Object.values(api.btns)) if (b.tagName === 'BUTTON') b.disabled = true; };
  return api;
}

// Tiles you assemble into a line. `pool` is [{key, text}]; tapping moves a tile to the line and back.
function TileBuilder({ pool, prefix = '', suffix = '', onChange = () => {}, flashKey = null, label = 'Formula' }) {
  const line = el('div', { class: 'tline', role: 'group', 'aria-label': label + ' being built' });
  const bin = el('div', { class: 'tpool', role: 'group', 'aria-label': 'Tiles to choose from' });
  const root = el('div', { class: 'tbuilder' }, line, bin);
  const api = { el: root, chosen: [], btns: {}, locked: false };
  const draw = (notify = true) => {
    line.replaceChildren(el('span', { class: 'tfix' }, prefix), ...[...api.chosen.flatMap((k, i) => [el('button', { class: 'tile2 inline', 'aria-label': `${pool.find(p => p.key === k).text}, remove`, onclick: () => { if (!api.locked) api.remove(k, true); } }, pool.find(p => p.key === k).text), i < api.chosen.length - 1 ? el('span', { class: 'tfix' }, '+') : null])].filter(Boolean), el('span', { class: 'tfix' }, suffix));
    for (const p of pool) api.btns[p.key].classList.toggle('used', api.chosen.includes(p.key));
    for (const p of pool) api.btns[p.key].disabled = api.locked || api.chosen.includes(p.key);
    if (notify) onChange(api.chosen.slice());
  };
  for (const p of pool) { const b = el('button', { class: 'tile2' + (flashKey === p.key ? ' flash' : ''), onclick: () => api.add(p.key, true) }, p.text); bin.append(b); api.btns[p.key] = b; }
  api.add = (k, user) => { if (api.locked || api.chosen.includes(k)) return; api.chosen.push(k); api.btns[k].classList.remove('flash'); draw(); };
  api.remove = (k, user) => { api.chosen = api.chosen.filter(x => x !== k); draw(); };
  api.lock = () => { api.locked = true; draw(false); };
  api.set = keys => { api.chosen = keys.slice(); draw(); };
  draw();
  return api;
}

// A slider you drag (native range input, so it works with keys and screen readers).
function RangeSlider({ min = 0, max = 1, step = 0.01, value = 0, label = 'Slider', left = '', right = '', onChange = () => {}, flash = false, valueText = null }) {
  const inp = el('input', { type: 'range', class: 'nslider' + (flash ? ' flashrange' : ''), min, max, step, value, 'aria-label': label });
  const api = { el: el('div', { class: 'rangewrap' }, el('div', { class: 'rangelab' }, el('span', {}, left), el('span', {}, right)), inp), inp, touched: false };
  const upd = u => { if (u) { api.touched = true; inp.classList.remove('flashrange'); } if (valueText) inp.setAttribute('aria-valuetext', valueText(+inp.value)); onChange(+inp.value, u); };
  inp.addEventListener('input', () => upd(true));
  api.set = v => { inp.value = v; upd(false); };
  api.get = () => +inp.value; api.lock = () => { inp.disabled = true; };
  return api;
}

// Rows of dots, one row per person: each row's dots are one person's observations.
function PersonRows(people, { onPick = null, flashIdx = -1, caption = 'Observations by person' } = {}) {
  const root = el('div', { class: 'prows', role: 'group', 'aria-label': caption });
  const api = { el: root, rows: [] };
  people.forEach((p, i) => {
    const row = el(onPick ? 'button' : 'div', { class: 'prow' + (flashIdx === i ? ' flash' : ''), 'aria-label': `${p.label}: ${p.n} observations${p.group ? ', group ' + p.group : ''}`, ...(onPick ? { onclick: () => { api.rows.forEach((r, j) => r.classList.toggle('on', j === i)); onPick(i); } } : {}) },
      el('span', { class: 'plabel' }, p.label), el('span', { class: 'pdots', 'aria-hidden': 'true' }, ...Array.from({ length: p.n }, () => el('i', { class: 'pd ' + (p.group === 'B' ? 'pdb' : p.group === 'A' ? 'pda' : '') }))));
    root.append(row); api.rows.push(row);
  });
  return api;
}
