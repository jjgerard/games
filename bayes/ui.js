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
    <circle class="badge${badge}" cx="20" cy="28" r="9"/><text x="20" y="32" text-anchor="middle" font-size="11" font-weight="800" fill="${badge === 'B' ? '#2b2100' : '#fff'}">${badge}</text></svg>`;
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

// Two tally columns, one per shape, that fill as shapes are drawn.
function Tally() {
  const root = el('div', { class: 'tally' });
  const cols = { c: el('div', { class: 'tallycol' }), s: el('div', { class: 'tallycol' }) };
  root.append(cols.c, cols.s);
  const counts = { c: 0, s: 0 };
  return {
    el: root, counts,
    add(type) { counts[type]++; cols[type].append(shapeNode(type, { size: 22 })); },
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
