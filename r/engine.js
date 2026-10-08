// Engine: the few reusable activities every sub-level is built from. Content lives in
// part1.js / part2.js; nothing here knows about R beyond how to print a value.
//
// Every engine returns a controller: { check(), judge(), solve(), solveWrong(), info, rcheck, naive }
//   judge()  pure: is the current state right?  check() = judge() + marks + message.
//   rcheck   [{setup, expr, expect}]  evaluated in real R by tools/check-r.R (see README).
//   naive    { name: fn } tempting wrong strategies; tools/naive.js measures how often they pass.
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
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// `code` in a message becomes <code>
const rich = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

// ---------------- random helpers (seeded) ----------------
const RG = {
  mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  int: (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
  pick: (r, a) => a[Math.floor(r() * a.length)],
  shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  sample(r, a, k) { return RG.shuffle(r, a).slice(0, k); },
  // k distinct ints in [lo, hi], optionally sorted
  distinct(r, lo, hi, k, sorted) { const out = RG.sample(r, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), k); return sorted ? out.sort((a, b) => a - b) : out; },
};

// ---------------- R value formatting ----------------
const isNA = v => v === null || v === undefined;
const rlit = v => isNA(v) ? 'NA' : typeof v === 'string' ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
const rv = a => a.length === 1 ? rlit(a[0]) : 'c(' + a.map(rlit).join(', ') + ')';
const rvec = a => 'c(' + a.map(rlit).join(', ') + ')';
const shown = v => isNA(v) ? 'NA' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
// console output for a vector, wrapped the way R does, at a phone-friendly width
function rprint(a, width = 28) {
  if (!a.length) return 'numeric(0)';
  const items = a.map(v => typeof v === 'string' ? JSON.stringify(v) : shown(v));
  const w = Math.max(...items.map(s => s.length));
  const lab = n => `[${n}]`, labw = lab(a.length).length;
  const per = Math.max(1, Math.floor((width - labw) / (w + 1)));
  const lines = [];
  for (let i = 0; i < a.length; i += per) lines.push(lab(i + 1).padStart(labw) + items.slice(i, i + per).map(s => ' ' + s.padStart(w)).join(''));
  return lines.join('\n');
}
// a data frame in the form the R checker reads
const dfSpec = (names, rows) => ({ df: Object.fromEntries(names.map((n, j) => [n, rows.map(r => r[j])])) });
const dfCode = (names, rows) => 'data.frame(' + names.map((n, j) => `${n} = ${rvec(rows.map(r => r[j]))}`).join(', ') + ')';

// ---------------- dragging ----------------
// A tile or chip you can tap OR drag. onTap(): the tap action. targetAt(x,y): the drop node under the pointer
// (or null). onDrop(target): what to do. Taps and drags never both fire.
function dragify(node, { onTap, onDrop, ghostClass = 'ghost' }) {
  let st = null;
  const targetAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest('[data-drop]'); };
  const hot = t => { document.querySelectorAll('.drop-hot').forEach(x => x.classList.remove('drop-hot')); if (t) t.classList.add('drop-hot'); };
  node.addEventListener('pointerdown', e => {
    if (node.disabled || e.button > 0) return; node._swallow = false;
    st = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, ghost: null };
    try { node.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });
  node.addEventListener('pointermove', e => {
    if (!st) return;
    if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) {
      st.moved = true; const r = node.getBoundingClientRect();
      st.ghost = node.cloneNode(true); st.ghost.classList.add(ghostClass); st.ghost.style.width = r.width + 'px'; st.ghost.style.height = r.height + 'px'; st.ghost.removeAttribute('id');
      document.body.append(st.ghost); node.classList.add('dragging');
    }
    if (st.moved) { st.ghost.style.left = (e.clientX - st.ghost.offsetWidth / 2) + 'px'; st.ghost.style.top = (e.clientY - st.ghost.offsetHeight - 6) + 'px'; hot(targetAt(e.clientX, e.clientY)); }
  });
  const end = e => {
    if (!st) return; const s = st; st = null;
    if (s.moved) {
      s.ghost.remove(); node.classList.remove('dragging'); hot(null); node._swallow = true;
      const t = e.type === 'pointerup' ? targetAt(e.clientX, e.clientY) : null; if (t) onDrop(t);
    }
  };
  node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end);
  node.addEventListener('click', e => { if (node._swallow) { node._swallow = false; return; } onTap(e); });
}

const PUNCT = { ',': 'comma', '(': 'open bracket', ')': 'close bracket', '[': 'open square bracket', ']': 'close square bracket', '=': 'equals', '==': 'double equals', '<-': 'arrow', '+': 'plus', '%>%': 'pipe', '|>': 'pipe', '|': 'or', '&': 'and', '$': 'dollar sign', ':': 'colon', '#': 'hash', '!=': 'not equal', '<': 'less than', '>': 'greater than', '~': 'tilde', '"': 'quote', '{': 'open curly bracket', '}': 'close curly bracket' };
const nameFor = t => PUNCT[t] ? `${t} (${PUNCT[t]})` : t;
const ACTION = /\b(Tap|tap|Drag|Fill|Press|Link|Match|Put|Sort|Drop|Set)\b/;
const ask = (p, add) => ACTION.test(p) ? p : p + ' ' + add;
const alts = a => Array.isArray(a) ? a : [a];

// ---------------- the grid: vectors, matrices, data frames ----------------
// data[r][c] is a value or {v, cls}. head = column heads, rowHead = row heads, index = true draws 1..n above (vectors).
// kinds: 'btn' = every cell a button; 'row'/'col' = heads are buttons, cells click-through; null = display only.
function Grid({ data, head, rowHead, index, compact, kind = null, only = null, cellW = null, label = 'table', gutter = null, minCol = null }) {
  const nr = data.length, nc = (data[0] || []).length;
  const hasRH = !!rowHead || !!gutter;
  const allow = id => only == null ? true : typeof only === 'function' ? only(id) : String(only) === String(id);
  const root = el('div', { class: 'grid' + (compact ? ' compact' : ''), role: 'group', 'aria-label': label });
  const cols = (gutter ? 'auto ' : '') + (rowHead ? 'auto ' : '') + `repeat(${nc}, ${cellW ? `minmax(0, ${cellW}px)` : `minmax(${minCol || 0}px, 1fr)`})`;
  root.style.gridTemplateColumns = cols;
  const out = { el: root, cell: {}, head: {}, rowHead: {}, root, nr, nc };
  const skip = () => { if (hasRH) root.append(el('div', { class: 'gcorner' })); };
  if (index) { skip(); for (let c = 0; c < nc; c++) root.append(el('div', { class: 'gi', 'aria-hidden': 'true' }, String(c + 1))); }
  if (head) {
    skip();
    head.forEach((h, c) => {
      const isBtn = kind === 'col' && allow(c);
      const n = el(isBtn ? 'button' : 'div', { class: 'gh' + (kind === 'col' && !isBtn ? ' inert' : ''), 'aria-label': kind === 'col' ? `column ${h}` : null }, h);
      out.head[c] = n; root.append(n);
    });
  }
  for (let r = 0; r < nr; r++) {
    if (gutter) { const g = el('div', { class: 'gutter ' + (gutter[r] ? 'g' + gutter[r].k : ''), 'aria-hidden': 'true' }, gutter[r] ? gutter[r].t : ''); root.append(g); }
    if (rowHead) {
      const isBtn = kind === 'row' && allow(r);
      const n = el(isBtn ? 'button' : 'div', { class: 'gh rowh', 'aria-label': kind === 'row' ? `row ${rowHead[r]}` : null }, rowHead[r]);
      out.rowHead[r] = n; root.append(n);
    }
    for (let c = 0; c < nc; c++) {
      let v = data[r][c], cls = '';
      if (v && typeof v === 'object' && 'v' in v) { cls = v.cls || ''; v = v.v; }
      const isBtn = kind === 'btn' && allow(r + ',' + c);
      const n = el(isBtn ? 'button' : 'div', { class: 'gc ' + cls + (isNA(v) ? ' na' : '') + (!isBtn ? ' inert' : ''), 'data-rc': r + ',' + c }, shown(v));
      if (isBtn) n.setAttribute('aria-label', `row ${r + 1}, column ${head ? head[c] : c + 1}: ${shown(v)}`);
      if (kind === 'btn' && !isBtn) n.classList.add('dimmed');
      out.cell[r + ',' + c] = n; root.append(n);
    }
  }
  out.wrap = el('div', { class: 'gridwrap' }, root);
  return out;
}
// a vector as a row of cells
const Strip = (vals, o = {}) => Grid({ data: [vals], index: true, cellW: 56, label: 'vector: ' + vals.map(shown).join(', '), ...o });
const codebox = (lines, o = {}) => el('div', { class: 'codebox' + (o.cls ? ' ' + o.cls : ''), role: 'group', 'aria-label': 'code' }, lines.map((l, i) => el('span', { class: 'codeline' + (/^\s*#/.test(l) ? ' cm' : '') + (o.dim && o.dim.includes(i) ? ' dim' : '') }, l)));
const consoleBox = (text, cap = 'Output') => el('div', { class: 'console', role: 'status', 'aria-label': cap }, text);

// ---------------- helpers ----------------
function setLocked(nodes, on) { nodes.forEach(n => { if (n.tagName === 'BUTTON') n.disabled = on; }); }
function finishTutorial(ctx, c) { ctx.complete(c.done || 'Well done.'); }
function flash(n) { if (n) n.classList.add('flash'); }

// =====================================================================
// ASSEMBLE: tiles into the slots of a statement
// cfg: prompt, lead[] (code lines above), out (console), lines: [[part,...],...] | parts, tiles[],
//      answer {slot: str|[alts]}, why {slot: {tile: msg, '*': msg}}, explain, tutorial, done, rcode+expect (R check)
// =====================================================================
const E = {};
E.assemble = (ctx, c) => {
  ctx.setPrompt(ask(c.prompt, 'Drop the tiles into the gaps.'));
  const lines = c.lines || [c.parts];
  const tiles = []; let nextId = 0;
  const slots = {}, order = [], placed = {};
  let locked = false, done = false;
  const wrap = el('div', { class: 'stagecol' });
  if (c.lead) wrap.append(codebox(c.lead));
  if (c.pic) wrap.append(c.pic);
  const stmt = el('div', { class: 'stmtbox' });
  const speak = [];
  lines.forEach(ln => {
    const row = el('div', { class: 'stmt' });
    ln.forEach(p => {
      if (typeof p === 'string') { row.append(el('span', { class: 'fx' }, p)); speak.push(p); }
      else {
        const s = el('button', { class: 'slot', 'data-drop': '1', 'aria-label': `blank ${order.length + 1}, empty` }, '');
        s._accept = t => put(t, p.slot); s.addEventListener('click', () => { if (placed[p.slot] && !locked) unput(p.slot); });
        slots[p.slot] = s; order.push(p.slot); row.append(s); speak.push('[blank]');
      }
    });
    stmt.append(row);
  });
  stmt.setAttribute('role', 'group'); stmt.setAttribute('aria-label', 'Statement: ' + speak.join(' '));
  wrap.append(stmt);
  const tray = el('div', { class: 'tilebox', role: 'group', 'aria-label': 'Code tiles' });
  const want = [];
  Object.values(c.answer).forEach(a => want.push(alts(a)[0]));
  const texts = c.tiles || [...want];
  const arranged = c.noShuffle ? texts : RG.shuffle(ctx.rng, texts);
  arranged.forEach(t => {
    const tile = { id: nextId++, t, slot: null, node: el('button', { class: 'ctile', 'aria-label': nameFor(t) }, t) };
    dragify(tile.node, { onTap: () => { const k = order.find(k => !placed[k]); if (k) put(tile, k); }, onDrop: tg => tg._accept && tg._accept(tile) });
    tiles.push(tile); tray.append(tile.node);
  });
  wrap.append(tray);
  if (c.out) wrap.append(consoleBox(c.out));
  ctx.stage.append(wrap);
  function refresh() {
    order.forEach((k, i) => {
      const s = slots[k], t = placed[k];
      s.textContent = t ? t.t : ''; s.classList.toggle('full', !!t);
      s.setAttribute('aria-label', `blank ${i + 1}, ${t ? 'holds ' + t.t + ' (tap to remove)' : 'empty'}`);
    });
    tiles.forEach(t => { t.node.classList.toggle('used', t.slot != null); t.node.tabIndex = t.slot != null ? -1 : 0; });
    ctx.setReady(order.every(k => placed[k]));
  }
  function put(tile, k) {
    if (locked || done) return;
    if (placed[k]) unput(k, true);
    if (tile.slot != null) delete placed[tile.slot];
    placed[k] = tile; tile.slot = k; refresh();
    if (c.tutorial && !done) { done = true; locked = true; order.forEach(x => slots[x].classList.add('right')); finishTutorial(ctx, c); }
  }
  function unput(k, quiet) { const t = placed[k]; if (!t) return; t.slot = null; delete placed[k]; if (!quiet) refresh(); }
  const reset = () => order.forEach(k => unput(k, true));
  const judge = () => order.every(k => placed[k] && alts(c.answer[k]).includes(placed[k].t));
  if (c.tutorial) { tiles.forEach(t => flash(t.node)); }
  refresh();
  return {
    judge,
    check() {
      locked = true; const ok = judge(); let why = '';
      order.forEach(k => { const good = placed[k] && alts(c.answer[k]).includes(placed[k].t); slots[k].classList.add(good ? 'right' : 'bad'); slots[k].classList.remove('full'); });
      if (!ok) {
        const k = order.find(k => !(placed[k] && alts(c.answer[k]).includes(placed[k].t)));
        const w = c.why && c.why[k]; const t = placed[k] && placed[k].t;
        why = (w && (w[t] || w['*'])) || `Blank ${order.indexOf(k) + 1} should hold ${alts(c.answer[k])[0]}.`;
      }
      setLocked(tiles.map(t => t.node), true);
      return { correct: ok, message: ok ? `Yes. ${c.explain || ''}` : `Not quite. ${why} ${c.explain || ''}` };
    },
    solve() { reset(); order.forEach(k => { const a = alts(c.answer[k]); const t = tiles.find(t => t.slot == null && a.includes(t.t)); put(t, k); }); },
    solveWrong() {
      this.solve(); const k0 = order[0];
      // swap in a wrong tile if one exists, else swap two different slots
      const spare = tiles.find(t => t.slot == null && !alts(c.answer[k0]).includes(t.t));
      if (spare) { put(spare, k0); return; }
      for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
        const a = placed[order[i]], b = placed[order[j]];
        if (a.t !== b.t) { unput(order[i], true); unput(order[j], true); put(b, order[i]); put(a, order[j]); return; }
      }
    },
    setSlots(map) { reset(); Object.entries(map).forEach(([k, t]) => { const tile = tiles.find(x => x.slot == null && x.t === t); if (tile) put(tile, k); }); },
    info: { answer: c.answer, tiles: texts, order }, rcheck: c.rcheck || null,
    naive: Object.assign({ random: () => { reset(); order.forEach(k => { const free = tiles.filter(t => t.slot == null); put(RG.pick(Math.random, free), k); }); } }, c.naive ? Object.fromEntries(Object.entries(c.naive).map(([n, f]) => [n, () => { reset(); f({ put: (k, t) => { const tile = tiles.find(x => x.slot == null && x.t === t); if (tile) put(tile, k); } }); }])) : {}),
  };
};

// =====================================================================
// PICK: tap cells / rows / columns / tokens / lines
// cfg: prompt, lead[], out, grid:{...Grid opts}, mode 'cell'|'row'|'col'|'token'|'line'|'drawer',
//      items (token/line/drawer texts), answer: [ids] (single => one id), single, tutorial, only
// =====================================================================
E.pick = (ctx, c) => {
  ctx.setPrompt(ask(c.prompt, 'Tap your answer.'));
  const wrap = el('div', { class: 'stagecol' });
  if (c.lead && c.mode !== 'line') wrap.append(codebox(c.lead));
  const items = {}; // id -> node
  let g = null;
  const only = c.tutorial ? String(c.answer[0]) : null;
  if (c.mode === 'token') {
    const line = el('div', { class: 'codebox tokline', role: 'group', 'aria-label': 'code, tap the part' });
    c.items.forEach((t, i) => { const b = el('button', { class: 'tok', 'aria-label': nameFor(t) }, t); items[i] = b; line.append(b); });
    wrap.append(line);
  } else if (c.mode === 'line') {
    const box = el('div', { class: 'codebox', role: 'group', 'aria-label': 'script, tap lines' });
    c.items.forEach((t, i) => { const b = el('button', { class: 'codeline', 'aria-label': `line ${i + 1}: ${t}` }, el('span', { class: 'ln' }, String(i + 1)), t); items[i] = b; box.append(b); });
    wrap.append(box);
  } else if (c.mode === 'drawer') {
    const box = el('div', { class: 'drawers', role: 'group', 'aria-label': 'drawers' });
    c.items.forEach((t, i) => { const b = el('button', { class: 'drawer', 'aria-label': `drawer ${t}` }, t); items[i] = b; box.append(b); });
    if (Math.max(...c.items.map(t => t.length)) > 9) box.style.gridTemplateColumns = '1fr';
    wrap.append(box);
  } else {
    const kind = c.mode === 'cell' ? 'btn' : c.mode;
    g = Grid({ ...c.grid, kind, only: c.tutorial ? (c.mode === 'cell' ? only : Number(only)) : null });
    wrap.append(g.wrap);
    if (c.mode === 'cell') Object.entries(g.cell).forEach(([k, n]) => { items[k] = n; });
    else if (c.mode === 'row') for (let r = 0; r < g.nr; r++) { items[r] = g.rowHead[r]; }
    else for (let k = 0; k < g.nc; k++) { items[k] = g.head[k]; }
  }
  if (c.out) wrap.append(consoleBox(c.out));
  let none = false, noneBtn = null;
  if (c.allowNone) { noneBtn = el('button', { class: 'choice', 'aria-pressed': 'false', style: 'flex:none;width:100%' }, c.noneLabel || 'None of them'); wrap.append(noneBtn); }
  ctx.stage.append(wrap);
  const sel = new Set(); let locked = false, done = false;
  const ids = Object.keys(items);
  const want = new Set(c.answer.map(String));
  const lit = id => { const n = items[id]; n.classList.toggle('sel', sel.has(id)); n.classList.toggle('on', sel.has(id)); n.setAttribute('aria-pressed', sel.has(id) ? 'true' : 'false');
    // row / column modes light the whole row or column
    if (g && c.mode === 'row') for (let k = 0; k < g.nc; k++) g.cell[id + ',' + k].classList.toggle('sel', sel.has(id));
    if (g && c.mode === 'col') for (let k = 0; k < g.nr; k++) g.cell[k + ',' + id].classList.toggle('sel', sel.has(id)); };
  const toggle = id => {
    if (locked || done) return; id = String(id);
    if (c.single) { [...sel].forEach(x => { sel.delete(x); lit(x); }); sel.add(id); } else sel.has(id) ? sel.delete(id) : sel.add(id);
    none = false; if (noneBtn) noneBtn.setAttribute('aria-pressed', 'false');
    lit(id); ctx.setReady(sel.size > 0);
    if (c.tutorial) { if (want.has(id)) { done = true; locked = true; finishTutorial(ctx, c); } else { sel.delete(id); lit(id); } }
  };
  ids.forEach(id => {
    const n = items[id]; n.addEventListener('click', () => toggle(id));
    if (g && c.mode === 'row') for (let k = 0; k < g.nc; k++) g.cell[id + ',' + k].addEventListener('click', () => toggle(id));
    if (g && c.mode === 'col') for (let k = 0; k < g.nr; k++) g.cell[k + ',' + id].addEventListener('click', () => toggle(id));
  });
  if (c.tutorial) { flash(items[String(c.answer[0])]); }
  const judge = () => sel.size === want.size && [...sel].every(x => want.has(x)) && (want.size > 0 || none);
  const set = arr => { [...sel].forEach(x => { sel.delete(x); lit(x); }); arr.forEach(x => { sel.add(String(x)); lit(String(x)); }); none = arr.length === 0 && !!noneBtn; if (noneBtn) noneBtn.setAttribute('aria-pressed', none ? 'true' : 'false'); ctx.setReady(sel.size > 0 || none); };
  if (noneBtn) noneBtn.addEventListener('click', () => { if (locked) return; set([]); });
  return {
    judge,
    check() {
      locked = true; const ok = judge();
      ids.forEach(id => { const n = items[id], s = sel.has(id), w = want.has(id);
        if (c.mode === 'cell' || c.mode === 'drawer' || c.mode === 'token' || c.mode === 'line') { n.classList.toggle('right', s && w); n.classList.toggle('bad', s && !w); n.classList.toggle('want', !s && w); if (!s && w) n.classList.add('sel'); } });
      if (g && (c.mode === 'row' || c.mode === 'col')) ids.forEach(id => { const s = sel.has(id), w = want.has(id); const cells = c.mode === 'row' ? Array.from({ length: g.nc }, (_, k) => g.cell[id + ',' + k]) : Array.from({ length: g.nr }, (_, k) => g.cell[k + ',' + id]);
        cells.forEach(n => { n.classList.toggle('right', s && w); n.classList.toggle('bad', s && !w); n.classList.toggle('want', !s && w); }); items[id].classList.toggle('sel', w); });
      Object.values(items).forEach(n => { if (n.tagName === 'BUTTON') n.disabled = true; });
      if (noneBtn) { noneBtn.disabled = true; if (want.size === 0) noneBtn.classList.add(none ? 'right' : 'want'); else if (none) noneBtn.classList.add('bad'); }
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (typeof c.explain === 'function' ? c.explain(ok, [...sel]) : c.explain || '') };
    },
    solve() { if (c.tutorial) toggle(c.answer[0]); else set(c.answer); },
    solveWrong() {
      const a = c.answer.map(String); const other = ids.find(i => !want.has(i));
      if (c.single) set([other]); else if (a.length > 1) set(a.slice(1)); else if (other != null) set([...a, other]); else set([]);
      if (want.size === 0 && noneBtn) set([ids[0]]);
    },
    info: { answer: c.answer, ids }, rcheck: c.rcheck || null,
    naive: { random: () => { const k = c.single ? 1 : RG.int(Math.random, c.allowNone ? 0 : 1, ids.length); set(RG.sample(Math.random, ids, k)); }, all: () => set(ids), first: () => set([ids[0]]), last: () => set([ids[ids.length - 1]]), none: () => set([]), ...(c.naive || {}) },
  };
};

// =====================================================================
// FILL: put values into the blank cells of a vector / data frame / variable boxes
// cfg: prompt, lead[], grid (Grid opts, data cells may be {v, cls}), blanks {id: expected}, tiles[], auto (tap tile = next blank),
//      tutorial, explain
// =====================================================================
E.fill = (ctx, c) => {
  ctx.setPrompt(ask(c.prompt, 'Tap a value, then the cells.'));
  const wrap = el('div', { class: 'stagecol' });
  if (c.lead) wrap.append(codebox(c.lead));
  if (c.pic) wrap.append(c.pic);
  const blankIds = Object.keys(c.blanks);
  const gd = c.grid.data.map((row, r) => row.map((v, k) => blankIds.includes(r + ',' + k) ? { v: '?', cls: 'blank' } : v));
  const g = Grid({ ...c.grid, data: gd, kind: 'btn', only: id => blankIds.includes(id) && (!c.tutorial || id === blankIds[0]) });
  wrap.append(g.wrap);
  const vals = {}; let held = null, locked = false, done = false;
  const tray = el('div', { class: 'tilebox', role: 'group', 'aria-label': 'Values' });
  const palette = [];
  const texts = [...new Set(c.tiles)];
  (c.noShuffle ? texts : RG.shuffle(ctx.rng, texts)).forEach(t => {
    const b = el('button', { class: 'ctile', 'aria-pressed': 'false', 'aria-label': nameFor(t) }, t);
    const tile = { t, node: b };
    dragify(b, { onTap: () => tapTile(tile), onDrop: tg => tg._accept && tg._accept(tile) });
    palette.push(tile); tray.append(b);
  });
  wrap.append(tray);
  if (c.out) wrap.append(consoleBox(c.out));
  ctx.stage.append(wrap);
  const exp = id => alts(c.blanks[id]);
  function paint() {
    blankIds.forEach(id => { const n = g.cell[id], v = vals[id]; n.textContent = v == null ? '?' : v; n.classList.toggle('blank', v == null); n.classList.toggle('fill', v != null);
      n.setAttribute('aria-label', `${n.getAttribute('aria-label').split(':')[0]}: ${v == null ? 'empty' : v}`); });
    palette.forEach(p => { p.node.classList.toggle('held', held === p); p.node.setAttribute('aria-pressed', held === p ? 'true' : 'false'); });
    ctx.setReady(blankIds.every(id => vals[id] != null));
  }
  function setVal(id, t) {
    if (locked || done) return; vals[id] = t; paint();
    if (c.tutorial) { done = true; locked = true; g.cell[id].classList.add('right'); finishTutorial(ctx, c); }
  }
  function tapTile(tile) {
    if (locked || done) return;
    if (c.auto) { const id = blankIds.find(i => vals[i] == null); if (id) setVal(id, tile.t); return; }
    held = held === tile ? null : tile; paint();
  }
  blankIds.forEach(id => {
    const n = g.cell[id]; n._accept = tile => setVal(id, tile.t); n.setAttribute('data-drop', '1');
    n.addEventListener('click', () => {
      if (locked || done) return;
      if (held && vals[id] !== held.t) setVal(id, held.t); else if (vals[id] != null) { delete vals[id]; paint(); }
    });
  });
  if (c.tutorial) { held = palette[0]; flash(g.cell[blankIds[0]]); }
  paint();
  const judge = () => blankIds.every(id => vals[id] != null && exp(id).map(String).includes(String(vals[id])));
  const setAll = m => { Object.keys(vals).forEach(k => delete vals[k]); Object.entries(m).forEach(([k, v]) => { vals[k] = v; }); paint(); };
  return {
    judge,
    check() {
      locked = true; const ok = judge(); let first = null;
      blankIds.forEach(id => { const good = exp(id).map(String).includes(String(vals[id])); g.cell[id].classList.remove('blank', 'fill'); g.cell[id].classList.add(good ? 'right' : 'bad'); if (!good && !first) first = id; });
      setLocked(palette.map(p => p.node), true); setLocked(Object.values(g.cell), true);
      const why = first && c.why ? (c.why[first] || c.why['*']) : '';
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ' + (why || '')) + ' ' + (c.explain || '') };
    },
    solve() { if (c.tutorial) { setVal(blankIds[0], exp(blankIds[0])[0]); return; } setAll(Object.fromEntries(blankIds.map(id => [id, exp(id)[0]]))); },
    solveWrong() {
      this.solve(); const id = blankIds[0]; const other = palette.map(p => p.t).find(t => !exp(id).map(String).includes(String(t)));
      if (other != null) vals[id] = other; else { delete vals[id]; } paint();
    },
    setVals(m) { setAll(m); },
    info: { blanks: c.blanks }, rcheck: c.rcheck || null,
    naive: { random: () => setAll(Object.fromEntries(blankIds.map(id => [id, RG.pick(Math.random, palette).t]))), 'all the first tile': () => setAll(Object.fromEntries(blankIds.map(id => [id, texts[0]]))), ...(c.naive || {}) },
  };
};

// =====================================================================
// CHOICE: a few short options, tap one (or none-of-text: used sparingly)
// cfg: prompt, lead[], pic (node), options[], answer (index into options as given, or string), code (mono), tutorial
// =====================================================================
E.choice = (ctx, c) => {
  ctx.setPrompt(ask(c.prompt, 'Tap one answer.'));
  const wrap = el('div', { class: 'stagecol' });
  if (c.lead) wrap.append(codebox(c.lead));
  if (c.pic) wrap.append(c.pic);
  const correct = typeof c.answer === 'number' ? c.options[c.answer] : c.answer;
  const opts = c.tutorial ? [correct] : (c.noShuffle ? c.options : RG.shuffle(ctx.rng, c.options));
  const box = el('div', { class: 'choices', role: 'group', 'aria-label': 'Choices' });
  const btns = opts.map(o => { const b = el('button', { class: 'choice' + (c.code ? ' code' : ''), 'aria-pressed': 'false' }, o); box.append(b); return b; });
  wrap.append(box); if (c.out) wrap.append(consoleBox(c.out)); ctx.stage.append(wrap);
  let pick = null, locked = false;
  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (locked) return; pick = i; btns.forEach((x, j) => x.setAttribute('aria-pressed', j === i ? 'true' : 'false')); ctx.setReady(true);
    if (c.tutorial) { locked = true; b.classList.add('right'); finishTutorial(ctx, c); }
  }));
  if (c.tutorial) flash(btns[0]);
  const setPick = i => { pick = i; btns.forEach((x, j) => x.setAttribute('aria-pressed', j === i ? 'true' : 'false')); ctx.setReady(true); };
  const judge = () => pick != null && opts[pick] === correct;
  return {
    judge,
    check() { locked = true; const ok = judge(); btns.forEach((b, i) => { b.disabled = true; if (opts[i] === correct) b.classList.add('right'); else if (i === pick) b.classList.add('bad'); b.setAttribute('aria-pressed', 'false'); });
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (typeof c.explain === 'function' ? c.explain(ok, opts[pick]) : c.explain || '') }; },
    solve() { if (c.tutorial) btns[0].click(); else setPick(opts.indexOf(correct)); },
    solveWrong() { setPick(opts.findIndex(o => o !== correct)); },
    info: { options: opts, correct }, rcheck: c.rcheck || null,
    naive: { random: () => setPick(RG.int(Math.random, 0, opts.length - 1)), first: () => setPick(0), last: () => setPick(opts.length - 1), longest: () => setPick(opts.reduce((m, o, i) => o.length > opts[m].length ? i : m, 0)), shortest: () => setPick(opts.reduce((m, o, i) => o.length < opts[m].length ? i : m, 0)) },
  };
};

// =====================================================================
// COUNT: set how many rows the result has with a stepper (the bin of rows)
// cfg: prompt, lead[], pic, answer n, max, unit
// =====================================================================
E.count = (ctx, c) => {
  ctx.setPrompt(ask(c.prompt, 'Set it with + and −.'));
  const wrap = el('div', { class: 'stagecol' });
  if (c.lead) wrap.append(codebox(c.lead, { cls: 'hideonreview' }));
  const picBox = el('div', { class: 'picbox' }); if (c.pic) picBox.append(c.pic); wrap.append(picBox);
  let n = 0, touched = false, locked = false, done = false;
  const minus = el('button', { class: 'stepbtn', 'aria-label': 'one fewer row' }, '−'), plus = el('button', { class: 'stepbtn', 'aria-label': 'one more row' }, '+');
  const bin = el('div', { class: 'bin compactbin', role: 'img' }); const cnt = el('div', { class: 'count' });
  wrap.append(el('div', { class: 'binwrap' }, minus, bin, cnt, plus));
  ctx.stage.append(wrap);
  const paint = () => {
    bin.innerHTML = ''; for (let i = 0; i < n; i++) bin.append(el('div', { class: 'rowchip' }));
    cnt.textContent = n === 1 ? '1 row' : `${n} rows`; bin.setAttribute('aria-label', `result bin: ${cnt.textContent}`);
    minus.disabled = locked || n <= 0; plus.disabled = locked || n >= c.max; ctx.setReady(touched);
  };
  const bump = d => { if (locked || done) return; n = Math.max(0, Math.min(c.max, n + d)); touched = true; paint();
    if (c.tutorial) { if (n === c.answer) { done = true; locked = true; finishTutorial(ctx, c); paint(); } } };
  minus.onclick = () => bump(-1); plus.onclick = () => bump(1);
  if (c.tutorial) { plus.classList.add('flash'); minus.disabled = true; }
  paint();
  const setN = k => { n = k; touched = true; paint(); };
  return {
    judge: () => n === c.answer,
    check() { locked = true; paint(); const ok = n === c.answer; bin.classList.toggle('ok', ok);
      if (c.after) { picBox.innerHTML = ''; const a = c.after(); a.setAttribute('aria-label', 'What R gives back'); a.classList.add('afterbox'); picBox.append(a); }
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (typeof c.explain === 'function' ? c.explain(ok, n) : c.explain || '') }; },
    solve() { if (c.tutorial) { while (n < c.answer) bump(1); } else setN(c.answer); }, solveWrong() { setN(c.answer === 1 ? 2 : c.answer - 1); },
    setN, info: { answer: c.answer, max: c.max }, rcheck: c.rcheck || null,
    naive: { random: () => setN(RG.int(Math.random, 0, c.max)), 'same as input': () => setN(c.inputRows), 'always 1': () => setN(1), 'half': () => setN(Math.round(c.inputRows / 2)), ...(c.naive || {}) },
  };
};

// =====================================================================
// SORT: put each row-chip into the box of its group (tap chip, tap box; or drag)
// cfg: prompt, lead[], rows [{label, group}], groups [labels], explain
// =====================================================================
E.sort = (ctx, c) => {
  ctx.setPrompt(c.prompt);
  const wrap = el('div', { class: 'stagecol' });
  if (c.lead) wrap.append(codebox(c.lead));
  const chips = c.rows.map((r, i) => ({ i, r, box: null, node: el('button', { class: 'rowchip2', 'aria-label': `row ${r.label}` }, r.label) }));
  const pool = el('div', { class: 'tilebox', role: 'group', 'aria-label': 'Rows' });
  let held = null, locked = false;
  const boxes = c.groups.map((g, k) => {
    const b = el('button', { class: 'boxbtn', 'data-drop': '1', 'aria-label': `box ${g}` }, el('div', {}, g), el('div', { class: 'rowpile' }));
    b._accept = ch => put(ch, k); b.addEventListener('click', () => { if (held) put(held, k); }); return b;
  });
  chips.forEach(ch => { dragify(ch.node, { onTap: () => { if (locked) return; held = held === ch ? null : ch; paint(); }, onDrop: tg => tg._accept && tg._accept(ch), ghostClass: 'ghost' }); pool.append(ch.node); });
  wrap.append(pool, el('div', { class: 'boxes', role: 'group', 'aria-label': 'Group boxes' }, boxes)); ctx.stage.append(wrap);
  function put(ch, k) { if (locked) return; ch.box = k; held = null; paint(); }
  function paint() {
    chips.forEach(ch => { ch.node.classList.toggle('used', ch.box != null); ch.node.classList.toggle('held', held === ch); ch.node.tabIndex = ch.box != null ? -1 : 0; });
    boxes.forEach((b, k) => { const pile = b.querySelector('.rowpile'); pile.innerHTML = ''; const n = chips.filter(ch => ch.box === k).length; for (let j = 0; j < n; j++) pile.append(el('i')); b.setAttribute('aria-label', `box ${c.groups[k]}: ${n} rows`); });
    ctx.setReady(chips.every(ch => ch.box != null));
  }
  paint();
  const judge = () => chips.every(ch => ch.box != null && c.groups[ch.box] === ch.r.group);
  return {
    judge,
    check() { locked = true; const ok = judge(); boxes.forEach(b => { b.disabled = true; }); chips.forEach(ch => { ch.node.disabled = true; });
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (typeof c.explain === 'function' ? c.explain(ok) : c.explain || '') }; },
    solve() { chips.forEach(ch => { ch.box = c.groups.indexOf(ch.r.group); }); held = null; paint(); },
    solveWrong() { this.solve(); const ch = chips[0]; ch.box = (ch.box + 1) % c.groups.length; paint(); },
    info: { groups: c.groups }, rcheck: c.rcheck || null,
    naive: { random: () => { chips.forEach(ch => { ch.box = RG.int(Math.random, 0, c.groups.length - 1); }); held = null; paint(); }, 'all in one box': () => { chips.forEach(ch => { ch.box = 0; }); paint(); } },
  };
};

// =====================================================================
// MATCH: tap one on the left, then one on the right, to join them
// cfg: prompt, lead[], left[], right[], pairs [[li, ri]]
// =====================================================================
E.match = (ctx, c) => {
  ctx.setPrompt(c.prompt);
  const wrap = el('div', { class: 'stagecol' });
  if (c.lead) wrap.append(c.lead);
  const L = c.left.map((t, i) => ({ t, i, link: null, node: el('button', { class: 'mbtn' }, t) }));
  const Rr = c.right.map((t, i) => ({ t, i, link: null, node: el('button', { class: 'mbtn' }, t) }));
  const cols = el('div', { class: 'matchcols', role: 'group', 'aria-label': 'Match the pairs' });
  const lcol = el('div', { class: 'stagecol' }, L.map(x => x.node)), rcol = el('div', { class: 'stagecol' }, Rr.map(x => x.node));
  cols.append(lcol, rcol); wrap.append(cols); ctx.stage.append(wrap);
  let held = null, locked = false, nextBadge = 1, tutDone = false;
  const linkOf = (side, x) => side === 'L' ? x.link : x.link;
  function paint() {
    [...L, ...Rr].forEach(x => { x.node.textContent = ''; if (x.badge) x.node.append(el('span', { class: 'badge' }, String(x.badge))); x.node.append(x.t);
      x.node.classList.toggle('held', held === x); x.node.classList.toggle('linked', x.link != null);
      x.node.setAttribute('aria-label', `${x.t}${x.badge ? ', paired ' + x.badge : ''}`); });
    ctx.setReady(c.partial ? L.some(x => x.link != null) || !!c.allowNoLinks : L.every(x => x.link != null));
    if (c.tutorial && !tutDone && L.every(x => x.link != null)) { tutDone = true; locked = true; finishTutorial(ctx, c); }
  }
  function tap(side, x) {
    if (locked) return;
    if (x.link != null) { const o = x.link; const other = side === 'L' ? Rr[o] : L[o]; other.link = null; other.badge = 0; x.link = null; x.badge = 0; held = null; paint(); return; }
    if (held && held.side === side) { held = { side, x }; paint(); return; }
    if (!held) { held = { side, x }; paint(); return; }
    const a = held.side === 'L' ? held.x : x, b = held.side === 'L' ? x : held.x;
    a.link = b.i; b.link = a.i; a.badge = b.badge = nextBadge++; held = null; paint();
  }
  L.forEach(x => x.node.addEventListener('click', () => tap('L', x))); Rr.forEach(x => x.node.addEventListener('click', () => tap('R', x)));
  const judge = () => c.pairs.every(([l, r]) => L[l].link === r) && L.every(x => x.link == null || c.pairs.some(([l]) => l === x.i));
  const setPairs = ps => { [...L, ...Rr].forEach(x => { x.link = null; x.badge = 0; }); nextBadge = 1; ps.forEach(([l, r]) => { L[l].link = r; Rr[r].link = l; L[l].badge = Rr[r].badge = nextBadge++; }); held = null; paint(); };
  if (c.tutorial) { L.forEach(x => flash(x.node)); Rr.forEach(x => flash(x.node)); }
  paint();
  return {
    judge,
    check() { locked = true; const ok = judge();
      L.forEach(x => { const want = c.pairs.find(([l]) => l === x.i); const good = want ? x.link === want[1] : x.link == null; x.node.classList.add(good ? 'right' : 'bad'); if (x.link != null) Rr[x.link].node.classList.add(good ? 'right' : 'bad'); x.node.disabled = true; });
      Rr.forEach(x => { x.node.disabled = true; });
      return { correct: ok, message: (ok ? 'Yes. ' : 'Not quite. ') + (typeof c.explain === 'function' ? c.explain(ok) : c.explain || '') }; },
    solve() { if (c.tutorial) { tap('L', L[0]); tap('R', Rr[0]); } else setPairs(c.pairs); },
    solveWrong() { const ps = c.pairs.map(p => p.slice()); if (ps.length > 1) { const t = ps[0][1]; ps[0][1] = ps[1][1]; ps[1][1] = t; setPairs(ps); } else { const wrong = Rr.findIndex((_, i) => i !== ps[0][1]); setPairs([[ps[0][0], wrong >= 0 ? wrong : 0]]); } },
    info: { pairs: c.pairs }, rcheck: c.rcheck || null,
    naive: { random: () => { const rr = RG.shuffle(Math.random, Rr.map((_, i) => i)); setPairs(L.map((_, i) => [i, rr[i % rr.length]]).filter(() => !c.partial || Math.random() < .6).slice(0, Math.min(L.length, Rr.length))); }, 'pair in order shown': () => setPairs(L.map((_, i) => [i, i % Rr.length])) },
  };
};

// =====================================================================
// RUN: a script with a Run button (the first, one-move tutorials and "which line made this?")
// =====================================================================
E.run = (ctx, c) => {
  ctx.setPrompt(c.prompt);
  const wrap = el('div', { class: 'stagecol' });
  wrap.append(codebox(c.lines)); const out = consoleBox(c.before || '', 'Console output'); wrap.append(out);
  const btn = el('button', { class: 'runbtn flash' }, '▶ Run');
  wrap.append(el('div', { class: 'cmdrow', style: 'justify-content:center' }, btn)); ctx.stage.append(wrap);
  let done = false;
  btn.onclick = () => { if (done) return; done = true; btn.disabled = true; btn.classList.remove('flash'); out.textContent = c.output; finishTutorial(ctx, c); };
  return { judge: () => done, check() { return { correct: done, message: '' }; }, solve() { btn.click(); }, solveWrong() { }, info: {}, rcheck: null, naive: {} };
};

// ---------------- little pictures ----------------
// two-input logic picture: lamp A, gate, lamp B
function lamp(label, on) { return el('div', { class: 'stagecol', style: 'align-items:center;gap:2px' }, el('div', { class: 'lamp' + (on ? ' on' : ''), role: 'img', 'aria-label': `${label} is ${on ? 'TRUE' : 'FALSE'}` }, on ? 'TRUE' : 'FALSE'), el('div', { class: 'lampcap' }, label)); }
function svg(w, h, inner, label) { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.setAttribute('class', 'chart'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); s.setAttribute('width', w); s.setAttribute('height', h); s.innerHTML = inner; return s; }

// =====================================================================
// BELT: a pipeline as conveyor belts. Each press of Run sends the table through the next step ("and then").
// cfg: prompt, table {cols, rows, groups}, steps [{code, apply}], head (first code line), done
// =====================================================================
function tableGrid(t, o = {}) {
  const gi = (t.groups || []).map(g => t.cols.indexOf(g)).filter(i => i >= 0);
  let gutter = null;
  if (gi.length) { const keys = [...new Set(t.rows.map(r => gi.map(i => r[i]).join('/')))]; gutter = t.rows.map(r => { const k = gi.map(i => r[i]).join('/'); return { k: keys.indexOf(k) % 4 + 1, t: k.split('/').map(x => x.slice(0, 2)).join('') }; }); }
  const cells = t.rows.map(row => row.map((v, j) => ({ v, cls: o.newCol === t.cols[j] ? 'new' : '' })));
  return Grid({ data: cells, head: t.cols, compact: true, gutter, label: `table with ${t.rows.length} rows: columns ${t.cols.join(', ')}${gi.length ? '; grouped by ' + t.groups.join(', ') : ''}` });
}
E.belt = (ctx, c) => {
  ctx.setPrompt(c.prompt);
  const wrap = el('div', { class: 'stagecol' });
  const lines = [c.head, ...c.steps.map((s, i) => '  ' + s.code + (i < c.steps.length - 1 ? ' %>%' : ''))];
  lines[0] = c.head + ' %>%';
  const cb = el('div', { class: 'codebox', role: 'group', 'aria-label': 'pipeline' }); const lineEls = lines.map(l => el('span', { class: 'codeline' }, l)); cb.append(...lineEls);
  const holder = el('div', { class: 'gridwrap' }), cap = el('div', { class: 'note', role: 'status' });
  const btn = el('button', { class: 'runbtn flash', style: 'align-self:center' }, '▶ Run the next step');
  wrap.append(cb, holder, cap, btn); ctx.stage.append(wrap);
  let t = c.table, k = 0, done = false, prevCols = t.cols;
  const show = (newCol) => { holder.innerHTML = ''; holder.append(tableGrid(t, { newCol }).wrap); cap.textContent = `${t.rows.length} rows` + (t.groups && t.groups.length ? `, grouped by ${t.groups.join(', ')}` : ''); };
  show();
  btn.onclick = () => {
    if (done) return; const s = c.steps[k]; const before = t.cols; t = s.apply(t); lineEls[k + 1].classList.add('flagged'); k++;
    show(t.cols.find(x => !before.includes(x)));
    if (k >= c.steps.length) { done = true; btn.disabled = true; btn.classList.remove('flash'); finishTutorial(ctx, c); }
  };
  return { judge: () => done, check() { return { correct: done, message: '' }; }, solve() { while (!done) btn.click(); }, solveWrong() { }, info: {}, rcheck: c.rcheck || null, naive: {} };
};

// =====================================================================
// FOLD: a wide table folds into a long one (or back). cfg: prompt, wide {cols, rows}, long {cols, rows}, foldCols [names], done
// =====================================================================
E.fold = (ctx, c) => {
  ctx.setPrompt(c.prompt);
  const wrap = el('div', { class: 'stagecol' });
  const w = tableGrid({ ...c.wide, groups: [] }), l = tableGrid({ ...c.long, groups: [] });
  const lw = el('div', { class: 'gridwrap' }), longBox = el('div', { class: 'gridwrap', style: 'min-height:' + (31 * (c.long.rows.length + 1)) + 'px' });
  lw.append(w.wrap);
  const btn = el('button', { class: 'runbtn flash', style: 'align-self:center' }, c.button || '▶ Fold the columns');
  const cap = el('div', { class: 'note', role: 'status' }, `${c.wide.rows.length} rows`);
  wrap.append(lw, cap, btn, longBox); ctx.stage.append(wrap);
  let done = false;
  btn.onclick = () => {
    if (done) return; done = true; btn.disabled = true; btn.classList.remove('flash');
    c.foldCols.forEach(n => { const j = c.wide.cols.indexOf(n); [w.head[j], ...Array.from({ length: w.nr }, (_, r) => w.cell[r + ',' + j])].forEach(x => x && x.classList.add('gone')); });
    longBox.append(l.wrap); cap.textContent = `${c.long.rows.length} rows now`;
    Object.values(l.cell).forEach((n, i) => { n.style.opacity = '0'; setTimeout(() => { n.style.opacity = ''; }, 60 + i * 35); });
    finishTutorial(ctx, c);
  };
  return { judge: () => done, check() { return { correct: done, message: '' }; }, solve() { btn.click(); }, solveWrong() { }, info: {}, rcheck: c.rcheck || null, naive: {} };
};
