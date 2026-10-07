// Reusable pieces: the shapes, the bags, the dividers and grids that every
// activity is built from. Each one is something you look at or move, not a
// list of options. Colour never carries the meaning on its own: circles and
// squares differ in form as well as colour.
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

// A shape as an SVG string. `type` is 'c' (circle) or 's' (square); `dot`
// adds a white spot, used as the second property in the conditional levels.
function shapeSVG(type, { size = 30, dot = false, cls = '' } = {}) {
  const body = type === 'c'
    ? `<circle class="sh sh-c" cx="15" cy="15" r="13"/>`
    : `<rect class="sh sh-s" x="3" y="3" width="24" height="24" rx="4"/>`;
  const spot = dot ? `<circle class="dotmark" cx="15" cy="15" r="4.2"/>` : '';
  return `<svg class="${cls}" viewBox="0 0 30 30" width="${size}" height="${size}" aria-hidden="true">${body}${spot}</svg>`;
}
function shapeNode(type, opts) {
  const t = document.createElement('div');
  t.innerHTML = shapeSVG(type, opts);
  return t.firstChild;
}
function iconWord(type, dot) { // shape icon for use inside a sentence
  return `<span class="iconsentence">${shapeSVG(type, { size: 20, dot })}</span>`;
}

// A bag drawn with its contents showing: `nC` circles and `nS` squares,
// scattered the same way every time for the same seed.
function bagSVG(nC, nS, { seed = 1, badge = null, sealed = false, size = 160 } = {}) {
  const rng = BM.mulberry32(seed * 977 + nC * 31 + nS);
  const total = nC + nS;
  const kinds = BM.shuffle(rng, [...Array(nC).fill('c'), ...Array(nS).fill('s')]);
  const cols = Math.ceil(Math.sqrt(total * 1.3)), rows = Math.ceil(total / cols);
  let inner = '';
  if (!sealed) {
    kinds.forEach((k, i) => {
      const cx = 30 + ((i % cols) + 0.5) * (100 / cols) + (rng() - .5) * 6;
      const cy = 58 + (Math.floor(i / cols) + 0.5) * (74 / rows) + (rng() - .5) * 4;
      const r = Math.min(9, 44 / cols, 37 / rows);
      inner += k === 'c'
        ? `<circle class="sh sh-c" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}"/>`
        : `<rect class="sh sh-s" x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${(2 * r).toFixed(1)}" height="${(2 * r).toFixed(1)}" rx="2"/>`;
    });
  }
  const b = badge
    ? `<circle class="badge${badge}" cx="130" cy="42" r="15"/><text x="130" y="48" text-anchor="middle" class="baglabel" fill="${badge === 'B' ? '#2b2100' : '#fff'}">${badge}</text>` : '';
  const sz = size >= 170 ? 'lg' : size >= 110 ? 'md' : 'sm'; // sized in CSS so it can shrink on short screens
  return `<svg class="bag-${sz}" viewBox="0 0 160 150" aria-hidden="true">
    <rect class="bagbody" x="15" y="44" width="130" height="98" rx="26"/>
    <path class="bagbody" d="M48 46 Q80 18 112 46 Z"/><rect class="bagtie" x="58" y="38" width="44" height="9" rx="4"/>
    ${inner}${b}</svg>`;
}
// A small sealed bag, as on the shelf.
function miniBag(badge) {
  return `<svg viewBox="0 0 40 44" aria-label="bag ${badge}"><rect class="bagbody" x="3" y="12" width="34" height="30" rx="9"/>
    <path class="bagbody" d="M12 13 Q20 3 28 13 Z"/><rect class="bagtie" x="14" y="10" width="12" height="3" rx="1.5"/>
    ${badge ? `<circle class="badge${badge}" cx="20" cy="28" r="9"/><text x="20" y="32" text-anchor="middle" font-size="11" font-weight="800" fill="${badge === 'B' ? '#2b2100' : '#fff'}">${badge}</text>` : ''}</svg>`;
}

// ---------------------------------------------------------------------------
// A bar with a divider you drag. value = the left share, 0..1. Works with a
// finger, a mouse or the arrow keys, and reports the same way for all three.
// ---------------------------------------------------------------------------
function ShareBar({ value = 0.5, leftClass = 'bar-c', rightClass = 'bar-s', leftText = '', rightText = '', label = 'Share', onChange = () => {}, pulse = false, step = 0.05 }) {
  const root = el('div', { class: 'sharebar' + (pulse ? ' pulse' : ''), tabindex: 0, role: 'slider', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100 });
  const left = el('div', { class: 'sb-left ' + leftClass });
  const right = el('div', { class: 'sb-right ' + rightClass });
  const handle = el('div', { class: 'sb-handle' });
  root.append(left, right, handle);
  let v = value, locked = false, touched = false;
  const api = {
    el: root,
    get: () => v,
    touched: () => touched,
    set(x, fromUser = false) {
      v = Math.round(BM.clamp(x, 0, 1) * 100) / 100;
      if (fromUser) { touched = true; root.classList.remove('pulse'); }
      left.style.width = (v * 100) + '%';
      handle.style.left = (v * 100) + '%';
      // Words only where they fit; a narrow segment shows just its number.
      const label = (t, share) => share >= .36 ? `${t} ${Math.round(share * 100)}%`.trim() : share >= .1 ? `${Math.round(share * 100)}%` : '';
      left.textContent = label(leftText, v);
      right.textContent = label(rightText, 1 - v);
      root.setAttribute('aria-valuenow', Math.round(v * 100));
      root.setAttribute('aria-valuetext', `${leftText} ${Math.round(v * 100)} percent`);
      onChange(v, fromUser);
    },
    lock() { locked = true; root.classList.add('locked'); root.tabIndex = -1; },
    unlock() { locked = false; root.classList.remove('locked'); root.tabIndex = 0; },
    ghost(x) { root.append(el('div', { class: 'sb-ghost', style: `left:${x * 100}%` })); },
  };
  const at = e => { const r = root.getBoundingClientRect(); api.set((e.clientX - r.left) / r.width, true); };
  root.addEventListener('pointerdown', e => { if (locked) return; root.setPointerCapture(e.pointerId); root._drag = true; at(e); });
  root.addEventListener('pointermove', e => { if (root._drag && !locked) at(e); });
  const end = () => { root._drag = false; };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
  root.addEventListener('keydown', e => {
    if (locked) return;
    const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
    if (d) { e.preventDefault(); api.set(v + d, true); }
    else if (e.key === 'Home') { e.preventDefault(); api.set(0, true); }
    else if (e.key === 'End') { e.preventDefault(); api.set(1, true); }
  });
  api.set(v);
  return api;
}

// A tray of drawn shapes, newest last.
function Tray() {
  const root = el('div', { class: 'tray', 'aria-live': 'polite' });
  return { el: root, add(type, opts) { root.append(shapeNode(type, { size: 26, ...opts })); }, clear() { root.innerHTML = ''; } };
}

// A tally in two short rows, one per shape, that fill left to right as shapes
// are drawn. Rows, not stacks: a column of twelve shapes would not fit a
// small screen. The caller caps how many can be drawn.
function Tally() {
  const root = el('div', { class: 'tally' });
  const rows = { c: el('div', { class: 'tallyrow' }), s: el('div', { class: 'tallyrow' }) };
  root.append(rows.c, rows.s);
  const counts = { c: 0, s: 0 };
  return {
    el: root, counts,
    add(type) { counts[type]++; rows[type].append(shapeNode(type, { size: 18 })); },
  };
}

// The shelf of sealed bags: nA of kind A and nB of kind B, so the player
// can SEE how common each kind is (the prior, as a picture).
function Shelf(nA, nB) {
  const kinds = [...Array(nA).fill('A'), ...Array(nB).fill('B')];
  return el('div', { class: 'shelf', role: 'img', 'aria-label': `${nA} bags of kind A and ${nB} of kind B` }, kinds.map(k => el('span', { html: miniBag(k) })));
}

// The "imagine ten draws from every bag on the shelf" picture. Each row is
// one bag's ten draws; the draws that match what was seen stay bright and
// the rest fade. The answer is then literally how much of the bright part
// belongs to A. Draws are laid out circles first, so each row reads as a
// proportion.
function FreqGrid(pA, pB, nA, nB, shape) {
  const rows = [...Array(nA).fill('A'), ...Array(nB).fill('B')];
  const root = el('div', { class: 'freq', role: 'img', 'aria-label': 'Ten imagined draws from every bag; the ones that match the shape you saw are bright' });
  for (const k of rows) {
    const nc = BM.circlesPerTen(k === 'A' ? pA : pB);
    const dots = el('div', { class: 'dots' });
    for (let i = 0; i < 10; i++) {
      const t = i < nc ? 'c' : 's';
      const bright = t === shape;
      dots.append(shapeNode(t, { size: 13, cls: 'fd' + (bright ? '' : ' dim') }));
    }
    root.append(el('div', { class: 'freq-row' }, el('span', { class: 'rl ' + k }, k), dots));
  }
  return root;
}

// ---------------------------------------------------------------------------
// A belief between two kinds of bag, A (left) and B (right). Two parts, so
// the direction you move matches what you mean:
//   - a track with a thumb: drag TOWARD the kind you think it is
//   - a bar underneath: how the 100% is split (the favoured kind gets more)
// A single split bar can't do both, because its divider has to move INTO the
// other side's territory to make your choice bigger. Same API as ShareBar;
// value is the belief in A (0..1).
// ---------------------------------------------------------------------------
function BeliefBar({ value = 0.5, label = 'How sure it is kind A', onChange = () => {}, step = 0.05 }) {
  const root = el('div', { class: 'beliefbar' });
  const track = el('div', { class: 'bb-track', tabindex: 0, role: 'slider', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100 });
  const endA = el('div', { class: 'bb-end A' }, 'A'), endB = el('div', { class: 'bb-end B' }, 'B');
  const thumb = el('div', { class: 'bb-thumb' }, '↔');
  track.append(endA, endB, thumb);
  const segA = el('div', { class: 'bb-seg bar-A' }), segB = el('div', { class: 'bb-seg bar-B' });
  const bar = el('div', { class: 'bb-bar' }, segA, segB);
  root.append(track, bar);
  let v = value, locked = false, touched = false;
  const words = (t, share) => share >= .36 ? `${t} ${Math.round(share * 100)}%` : share >= .1 ? `${Math.round(share * 100)}%` : '';
  const api = {
    el: root,
    get: () => v,
    touched: () => touched,
    set(x, fromUser = false) {
      v = Math.round(BM.clamp(x, 0, 1) * 100) / 100;
      if (fromUser) touched = true;
      // thumb: the nearer to A's end, the surer of A (so 100% A is the far left)
      thumb.style.left = `calc(${(1 - v) * 100}% )`;
      thumb.className = 'bb-thumb' + (v > .5 ? ' favA' : v < .5 ? ' favB' : '');
      segA.style.width = (v * 100) + '%'; segB.style.width = ((1 - v) * 100) + '%';
      segA.textContent = words('A', v); segB.textContent = words('B', 1 - v);
      track.setAttribute('aria-valuenow', Math.round(v * 100));
      track.setAttribute('aria-valuetext', `${Math.round(v * 100)} percent sure it is kind A`);
      onChange(v, fromUser);
    },
    lock() { locked = true; root.classList.add('locked'); track.tabIndex = -1; },
    unlock() { locked = false; root.classList.remove('locked'); track.tabIndex = 0; },
    ghost(x) {
      bar.append(el('div', { class: 'sb-ghost', style: `left:${x * 100}%` }));
      track.append(el('div', { class: 'bb-ghost', style: `left:${(1 - x) * 100}%` }));
    },
  };
  const at = e => { const r = track.getBoundingClientRect(); api.set(1 - (e.clientX - r.left) / r.width, true); };
  track.addEventListener('pointerdown', e => { if (locked) return; track.setPointerCapture(e.pointerId); track._drag = true; at(e); });
  track.addEventListener('pointermove', e => { if (track._drag && !locked) at(e); });
  const end = () => { track._drag = false; };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
  // Arrow keys follow the thumb: Left moves it toward A, which is MORE sure of A.
  track.addEventListener('keydown', e => {
    if (locked) return;
    const d = { ArrowLeft: step, ArrowDown: step, ArrowRight: -step, ArrowUp: -step }[e.key];
    if (d) { e.preventDefault(); api.set(v + d, true); }
    else if (e.key === 'Home') { e.preventDefault(); api.set(1, true); }
    else if (e.key === 'End') { e.preventDefault(); api.set(0, true); }
  });
  api.set(v);
  return api;
}


// ===========================================================================
// Unit 1 pieces
// ===========================================================================

// Columns of chips, one column per kind of bag. With `total` the chips are a
// fixed budget to spread (a belief); with total = null each column is its own
// count, 0..perMax (a likelihood). Same + and - buttons as Unit 0's chips.
function ChipsPanel({ heads, total = 10, perMax = 10, grid = false, onChange = () => {} }) {
  const chips = heads.map(() => 0);
  const root = el('div', { class: 'chipgrid' + (grid ? ' grid2' : '') });
  const stacks = [], left = el('div', { class: 'chipleft' });
  const sum = () => chips.reduce((a, b) => a + b, 0);
  const paint = () => {
    stacks.forEach((s, i) => { s.innerHTML = ''; for (let j = 0; j < chips[i]; j++) s.append(el('div', { class: 'chip' })); });
    left.textContent = total == null ? '' : sum() === total ? `All ${total} chips placed` : `${total - sum()} chips left`;
    onChange(chips);
  };
  const move = (i, d) => {
    if (d > 0 && ((total != null && sum() >= total) || chips[i] >= perMax)) return;
    if (d < 0 && chips[i] === 0) return;
    chips[i] += d; paint();
  };
  heads.forEach((h, i) => {
    const stack = el('div', { class: 'chipstack' }); stacks.push(stack);
    const minus = el('button', { 'aria-label': `Remove one: ${h.label}`, onclick: () => move(i, -1) }, '−');
    const plus = el('button', { 'aria-label': `Add one: ${h.label}`, onclick: () => move(i, 1) }, '+');
    if (grid) root.append(el('div', { class: 'chipcell' }, h.node, el('div', { class: 'cellctl' }, el('div', { class: 'stacks' }, stack), el('div', { class: 'chipbtns' }, plus, minus))));
    else root.append(el('div', { class: 'chipcol' }, h.node, el('div', { class: 'stacks' }, stack), el('div', { class: 'chipbtns' }, minus, plus)));
  });
  const wrap = el('div', { class: 'chippanel' }, root, left);
  paint();
  return {
    el: wrap, chips, sum, total,
    set(arr) { arr.forEach((c, i) => { chips[i] = c; }); paint(); },
    lock() { root.classList.add('locked'); },
    showTruth(arr) { stacks.forEach((s, i) => { const tr = el('div', { class: 'chipstack truthstack' }); for (let j = 0; j < Math.round(arr[i]); j++) tr.append(el('div', { class: 'chip truth' })); s.parentNode.append(tr); }); },
  };
}

// A column of a kind of bag: its picture and its share of circles, plus how
// many such bags are on the shelf (small sealed bags) when `count` is given.
function KindHead(p, seed, count = null, compact = false, shelfTotal = 5) {
  const nc = BM.circlesPerTen(p);
  const kids = [el('div', { html: bagSVG(nc, 10 - nc, { seed, size: 64 }) }), el('div', { class: 'stage-note' }, compact ? `${pct(p)}%` : `${pct(p)}% circles`)];
  if (count != null) {
    kids.push(el('div', { class: 'shelfstack', 'aria-label': `${count} of ${shelfTotal} bags on the shelf` }, Array.from({ length: count }, () => el('span', { html: miniBag('') }))));
    // say what the little bags are: this many of the shelf's bags are this kind
    if (!compact) kids.push(el('div', { class: 'shelfcap' }, `${count} of ${shelfTotal} bags`));
  }
  return { node: el('div', { class: 'kindhead' + (compact ? ' compact' : '') }, kids), label: `${pct(p)}% circles bag` };
}

// A row of bars, one per kind, scaled so the tallest fills the row.
function BarsRow(values, { cls = '', height = 34, caption = '' } = {}) {
  const mx = Math.max(...values, 1e-9);
  const row = el('div', { class: 'barsrow ' + cls, style: `height:${height}px`, role: 'img', 'aria-label': caption },
    values.map(v => el('div', { class: 'bcol' }, el('div', { class: 'bfill', style: `height:${Math.max(2, v / mx * 100)}%` }))));
  return caption ? el('div', { class: 'barsline' }, el('span', { class: 'bcap' }, caption), row) : row;
}

// A belief about a share, drawn as a curve over 0..100%. Draws the current
// Beta(a, b), and optionally a dashed target, a faint starting curve, a
// shaded middle section and vertical markers. Redrawn on every update().
function CurveView({ a = 1, b = 1, height = 112 } = {}) {
  const W = 300, H = height, L = 10, R = 10, T = 8, B = 18;
  const root = el('div', { class: 'curveview', role: 'img' });
  const st = { a, b, target: null, ghost: null, shade: null, markers: [] };
  const xOf = x => L + x * (W - L - R);
  function path(ab, ymax, close) {
    const n = 120; let d = '';
    for (let i = 0; i <= n; i++) { const x = i / n, y = BM.betaPdf(Math.min(Math.max(x, 1e-4), 1 - 1e-4), ab[0], ab[1]); d += `${i ? 'L' : 'M'}${xOf(x).toFixed(1)} ${(T + (1 - Math.min(y / ymax, 1.02)) * (H - T - B)).toFixed(1)} `; }
    return close ? d + `L${xOf(1)} ${H - B} L${xOf(0)} ${H - B} Z` : d;
  }
  const peak = ab => { let m = 0; for (let i = 1; i < 100; i++) m = Math.max(m, BM.betaPdf(i / 100, ab[0], ab[1])); return m; };
  const api = {
    el: root, state: st,
    update(p = {}) {
      Object.assign(st, p);
      const curves = [[st.a, st.b], st.target, st.ghost].filter(Boolean);
      const ymax = Math.max(...curves.map(peak)) * 1.12;
      let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
      if (st.shade) {
        const [lo, hi] = st.shade, n = 60; let d = `M${xOf(lo)} ${H - B} `;
        for (let i = 0; i <= n; i++) { const x = lo + (hi - lo) * i / n, y = BM.betaPdf(Math.min(Math.max(x, 1e-4), 1 - 1e-4), st.a, st.b); d += `L${xOf(x).toFixed(1)} ${(T + (1 - Math.min(y / ymax, 1.02)) * (H - T - B)).toFixed(1)} `; }
        s += `<path d="${d}L${xOf(hi)} ${H - B} Z" class="cv-shade"/>`;
      }
      s += `<path d="${path([st.a, st.b], ymax, true)}" class="cv-area"/>`;
      if (st.ghost) s += `<path d="${path(st.ghost, ymax)}" class="cv-ghost"/>`;
      if (st.target) s += `<path d="${path(st.target, ymax)}" class="cv-target"/>`;
      s += `<path d="${path([st.a, st.b], ymax)}" class="cv-line"/>`;
      for (const m of st.markers) s += `<line x1="${xOf(m.x)}" x2="${xOf(m.x)}" y1="${T}" y2="${H - B}" class="cv-mark ${m.cls || ''}"/>`;
      s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="cv-axis"/>`;
      for (const t of [0, .5, 1]) s += `<text x="${xOf(t)}" y="${H - 4}" text-anchor="${t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}" class="cv-tick">${t * 100}%</text>`;
      root.innerHTML = s + '</svg>';
      root.setAttribute('aria-label', `Belief curve: average ${Math.round(BM.betaMean(st.a, st.b) * 100)} percent circles`);
    },
  };
  api.update();
  return api;
}

// A track lined up with the curve's axis, with one or two draggable handles.
// Values are shares 0..1. A press anywhere on the track moves the nearest handle.
function AxisSlider({ values = [0.5], labels = ['Marker'], onChange = () => {}, minGap = 0.02, step = 0.02 }) {
  const root = el('div', { class: 'axisslider' });
  const track = el('div', { class: 'as-track' });
  const vals = values.slice();
  const thumbs = vals.map((v, i) => el('div', { class: 'as-thumb t' + i, tabindex: 0, role: 'slider', 'aria-label': labels[i], 'aria-valuemin': 0, 'aria-valuemax': 100 }));
  track.append(...thumbs); root.append(track);
  let touched = false, locked = false;
  const lim = i => [i === 0 ? 0 : vals[i - 1] + minGap, i === vals.length - 1 ? 1 : vals[i + 1] - minGap];
  const api = {
    el: root, get: () => vals.slice(), touched: () => touched,
    set(i, x, fromUser = false) {
      const [lo, hi] = lim(i); vals[i] = Math.round(BM.clamp(x, lo, hi) * 100) / 100; if (fromUser) touched = true; api.paint(); onChange(vals.slice(), fromUser);
    },
    paint() { thumbs.forEach((t, i) => { t.style.left = (vals[i] * 100) + '%'; t.setAttribute('aria-valuenow', Math.round(vals[i] * 100)); }); },
    lock() { locked = true; root.classList.add('locked'); thumbs.forEach(t => { t.tabIndex = -1; }); },
    mark(x, cls = 'truth') { track.append(el('div', { class: 'as-mark ' + cls, style: `left:${x * 100}%` })); },
  };
  let active = 0;
  const frac = e => { const r = track.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  track.addEventListener('pointerdown', e => {
    if (locked) return; track.setPointerCapture(e.pointerId); track._drag = true;
    const f = frac(e); active = vals.reduce((best, v, i) => Math.abs(v - f) < Math.abs(vals[best] - f) ? i : best, 0); api.set(active, f, true);
  });
  track.addEventListener('pointermove', e => { if (track._drag && !locked) api.set(active, frac(e), true); });
  const end = () => { track._drag = false; }; track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
  thumbs.forEach((t, i) => t.addEventListener('keydown', e => {
    if (locked) return; const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
    if (d) { e.preventDefault(); api.set(i, vals[i] + d, true); }
  }));
  api.paint();
  return api;
}
