// App shell: home, units, sub-levels, the activity runner, the placement
// test, help, menu. Same arrangement as Shapes and Trial and Error (name
// gate aside: this one has no accounts at all), so a student who has played
// one already knows how this works.
const STORE = 'rgame:v1';
const POINTS_SUB_COMPLETE = 50;
const params = new URLSearchParams(location.search);
const seedBase = params.has('seed') ? Number(params.get('seed')) : Date.now() % 1e9;
let seedCounter = 0;
const nextRng = () => RG.mulberry32(seedBase + 7919 * (++seedCounter));
const UNITS = [...UNITS_P1, ...UNITS_P2];
// The first four units (running a line, values, variables, functions) are quick checks: two right in a row.
UNITS.slice(0, 4).forEach(u => u.subs.forEach(s => { if (s.kind === 'streak' && s.target === 5) s.target = 2; }));

// ---------------- storage ----------------
function loadState() {
  let p = null; try { p = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { p = null; }
  return { points: Number(p?.points) || 0, done: Array.isArray(p?.done) ? p.done : [], started: !!p?.started };
}
let state = loadState();
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* keep playing */ } }

// ---------------- back button ----------------
const navStack = [];
function pushNav(undo) { navStack.push(undo); history.pushState({ d: navStack.length }, ''); }
function navBack() { if (navStack.length) history.back(); }
window.addEventListener('popstate', () => { const u = navStack.pop(); if (u) u(); });

const $ = id => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  $(`screen-${id}`).classList.remove('hidden');
  document.body.classList.toggle('on-welcome', id === 'home');
  window.scrollTo(0, 0);
}
function updateHeader() {
  $('points').textContent = `${state.points} pts`;
  $('points').classList.toggle('hidden', !state.started);
}
const allSubs = () => UNITS.flatMap(u => u.subs);
const isDone = id => state.done.includes(id);
function isUnlocked(unit, i) { return i === 0 || isDone(unit.subs[i - 1].id); }

// ---------------- screens ----------------
function renderUnits() {
  const grid = $('unit-grid'); grid.innerHTML = '';
  let lastPart = 0;
  UNITS.forEach((u, i) => {
    if (u.part !== lastPart) { lastPart = u.part; grid.append(el('h2', { class: 'part-head' }, PARTS[u.part].title, el('small', {}, PARTS[u.part].blurb))); }
    const done = u.subs.length && u.subs.every(s => isDone(s.id));
    const locked = !u.subs.length || (i > 0 && !UNITS[i - 1].subs.every(s => isDone(s.id)));
    const t = el('button', { class: 'tile' + (locked ? ' locked' : '') + (done ? ' done' : ''), disabled: locked, onclick: () => openUnit(u) },
      el('span', { class: 'tile-num' }, locked ? String(i) : `UNIT ${i}${done ? ' ✓' : ''}`),
      el('span', { class: 'tile-name' }, u.title.replace(/^Unit \d+: /, '')),
      el('span', { class: 'tile-blurb' }, locked ? '' : `${u.subs.filter(s => isDone(s.id)).length} of ${u.subs.length} done`));
    grid.append(t);
  });
}
function openUnit(u) {
  $('unit-heading').textContent = u.title; $('unit-intro').textContent = u.intro || '';
  renderSubs(u); showScreen('unit'); pushNav(() => { renderUnits(); showScreen('units'); });
  currentUnit = u;
}
let currentUnit = null;
function renderSubs(u) {
  const grid = $('sub-grid'); grid.innerHTML = '';
  u.subs.forEach((s, i) => {
    const unlocked = isUnlocked(u, i);
    grid.append(el('button', { class: 'tile' + (isDone(s.id) ? ' done' : '') + (unlocked ? '' : ' locked'), disabled: !unlocked, onclick: () => openActivity(s) },
      el('span', { class: 'tile-num' }, unlocked ? `${i}${isDone(s.id) ? ' ✓' : ''}` : String(i)),
      el('span', { class: 'tile-name' }, s.name), el('span', { class: 'tile-blurb' }, s.blurb)));
  });
}
function goHome() {
  navStack.length = 0;
  $('btn-continue').classList.toggle('hidden', !state.started);
  $('btn-start').classList.toggle('hidden', state.started);
  $('btn-placement').classList.toggle('hidden', state.started);
  showScreen('home'); updateHeader();
}
function goUnits() { renderUnits(); showScreen('units'); updateHeader(); }

// ---------------- dialogs ----------------
// Modal behaviour: when a dialog opens, focus moves into it, everything behind
// it is inert (so Tab and screen readers stay inside), Escape closes it, and
// focus goes back to where it was when it closes.
const focusStack = [];
const openOverlays = () => [...document.querySelectorAll('.overlay')].filter(o => !o.classList.contains('hidden'));
function syncInert() {
  const open = openOverlays(), top = open[open.length - 1];
  $('app').inert = open.length > 0;
  document.querySelectorAll('.overlay').forEach(o => { o.inert = !!top && o !== top && !o.classList.contains('hidden'); });
}
function firstFocus(overlay) {
  return overlay.querySelector('#stage .bigbtn:not(:disabled), #stage [role="slider"], #stage button:not(:disabled), #stage [tabindex="0"]') || overlay.querySelector('.dialog-actions .btn-primary, .btn-primary, button, [tabindex="0"]');
}
// Controls disable or disappear when you answer, which would drop keyboard focus
// on the page. Always put it somewhere sensible instead: the next thing to press.
function focusAction() { const b = $('quiz-action'); if (b && !b.disabled) b.focus(); }
function focusQuestion() { setTimeout(() => { const f = firstFocus($('quiz-overlay')); if (f) f.focus(); }, 0); }
function openOverlay(id) {
  const o = $(id); focusStack.push({ id, from: document.activeElement });
  o.classList.remove('hidden'); syncInert();
  const f = id === 'quiz-overlay' ? $('quiz-close') : firstFocus(o);
  if (f) setTimeout(() => f.focus(), 0);
}
function closeOverlay(id) {
  const o = $(id); if (o.classList.contains('hidden')) return;
  o.classList.add('hidden'); syncInert();
  const i = focusStack.map(s => s.id).lastIndexOf(id);
  if (i >= 0) { const { from } = focusStack.splice(i, 1)[0]; if (from && document.body.contains(from) && !from.closest('[inert]')) setTimeout(() => from.focus(), 0); }
}
document.addEventListener('keydown', e => {
  const open = openOverlays(), top = open[open.length - 1]; if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (top.id === 'quiz-overlay') $('quiz-close').click();
    else if (top.id === 'confirm-overlay') $('confirm-cancel').click();
    else closeOverlay(top.id);
  } else if (e.key === 'Tab') { // keep Tab inside the top dialog
    const f = [...top.querySelectorAll('button:not(:disabled), [href], input, [role="slider"], [tabindex="0"]')].filter(x => x.offsetParent !== null && !x.closest('[inert]'));
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
function showHelp(title, html) { $('help-title').textContent = title; $('help-body').innerHTML = html; openOverlay('help-overlay'); }
const HELP = {
  general: `<p>Every puzzle is something you build or tap: drop code tiles into the gaps of a line, tap the cells a bit of code picks out, fill a table, drag rows into boxes. There is no keyboard.</p>
    <p>Most sub-levels need <b>5 right in a row</b> (10 for the big ideas). You can miss twice (♥♥); a third miss starts the run again. The answer is always explained.</p>
    <p>Tiles: tap a tile to drop it into the next gap, or drag it to a gap you choose. Tap a filled gap to take the tile back.</p>
    <p>The first sub-level of each unit has only one possible move, and it flashes.</p>`,
  about: `<p><b>R from Zero</b> teaches R from the very first line, in two parts: <b>Part 1</b> is base R (values, variables, vectors, indexing, tables, packages, random numbers, the apply family) and <b>Part 2</b> is tidy R (the pipe, filter, mutate, group_by and summarise, joins, pivots, ggplot2).</p>
    <p>Nothing here is graded or watched. Your progress is saved on this device only, and nothing is sent anywhere.</p>
    <p>Statistics are out of scope: you learn to run a function and read its output, not what a test means. Every answer was checked by running the code in real R.</p>`,
};
let confirmCb = null;
function confirmDialog(title, msg, ok) { $('confirm-title').textContent = title; $('confirm-message').textContent = msg; confirmCb = ok; openOverlay('confirm-overlay'); }
$('confirm-cancel').onclick = () => closeOverlay('confirm-overlay');
$('confirm-ok').onclick = () => { closeOverlay('confirm-overlay'); const f = confirmCb; confirmCb = null; if (f) f(); };
$('help-close').onclick = () => closeOverlay('help-overlay');
$('btn-menu').onclick = () => { $('menu-sound').textContent = isSoundMuted() ? '🔇 Sound is off' : '🔊 Sound is on'; openOverlay('menu-overlay'); };
$('menu-close').onclick = () => closeOverlay('menu-overlay');
$('menu-sound').onclick = () => { setSoundMuted(!isSoundMuted()); $('menu-sound').textContent = isSoundMuted() ? '🔇 Sound is off' : '🔊 Sound is on'; };
$('menu-help').onclick = () => { closeOverlay('menu-overlay'); showHelp('How to play', HELP.general); };
$('menu-about').onclick = () => { closeOverlay('menu-overlay'); showHelp('About this game', HELP.about); };
$('menu-reset').onclick = () => { closeOverlay('menu-overlay'); confirmDialog('Erase your progress?', 'This removes your points and everything you have completed on this device.', () => { state = { points: 0, done: [], started: false }; save(); goHome(); }); };
document.querySelectorAll('[data-help]').forEach(b => b.onclick = () => showHelp('How does this work?', HELP[b.dataset.help]));
document.querySelectorAll('[data-back]').forEach(b => b.onclick = navBack);
$('brand').onclick = () => { if (!$('quiz-overlay').classList.contains('hidden')) return; goHome(); };

// ---------------- activity runner ----------------
const run = { sub: null, game: null, ctrl: null, phase: 'idle', placement: null, ready: false, finished: false };
window.__run = run; // read by the test suite

function setReady(r) { run.ready = r; if (run.phase === 'answering') $('quiz-action').disabled = !r; }
function setFeedback(text, kind) { const f = $('quiz-feedback'); f.innerHTML = rich(text || ''); f.className = 'quiz-feedback' + (kind ? ' ' + kind : ''); }
function renderStreak() {
  const g = run.game, wrap = $('streak-wrap');
  wrap.classList.toggle('hidden', !g);
  if (!g) return;
  $('streak-fill').style.width = (Math.min(1, g.streak / g.target) * 100) + '%';
  $('streak-label').textContent = `${g.streak}/${g.target}  ${'♥'.repeat(g.missesLeft)}${'♡'.repeat(g.allowedMisses - g.missesLeft)}`;
}
function openOverlayActivity(title) {
  $('quiz-title').textContent = title; openOverlay('quiz-overlay'); pushNav(closeActivity);
}
function closeActivity() {
  closeOverlay('quiz-overlay'); run.phase = 'idle'; run.sub = null; run.game = null; run.placement = null;
  if (currentUnit && !$('screen-unit').classList.contains('hidden')) renderSubs(currentUnit);
  updateHeader();
}
$('quiz-close').onclick = () => { if (run.phase === 'idle') return; if (run.phase === 'answering' && run.game && run.game.streak > 0) confirmDialog('Leave this sub-level?', 'Your current run will be lost.', navBack); else navBack(); };
$('quiz-help').onclick = () => showHelp(run.placement ? 'Where do I start?' : run.sub.name, run.placement ? `<p>${PLACEMENT.length} quick questions, with no feedback. The first one you miss is where you start; everything before it is marked done. You can always replay earlier levels.</p>` : `<p>${run.sub.help}</p>`);

function buildCtx(onComplete) {
  const stage = $('stage'); stage.innerHTML = '';
  return { stage, rng: nextRng(), setPrompt: h => { $('quiz-prompt').innerHTML = h; }, setReady, complete: onComplete };
}
function markDone(id, withPoints) {
  if (!isDone(id)) { state.done.push(id); if (withPoints) state.points += POINTS_SUB_COMPLETE; }
  state.started = true; save(); updateHeader();
}

function openActivity(sub) {
  run.sub = sub; run.placement = null; run.finished = false;
  run.game = sub.kind === 'streak' ? new StreakGame(sub.target, sub.hearts) : null;
  openOverlayActivity(sub.name); renderStreak(); nextQuestion();
}
function nextQuestion() {
  const sub = run.sub; run.phase = 'answering'; run.ready = false;
  setFeedback(''); renderStreak(); $('quiz-body').classList.remove('reviewing');
  const btn = $('quiz-action'); btn.textContent = sub.kind === 'tutorial' ? 'Waiting for your move…' : 'Check'; btn.disabled = true;
  const ctx = buildCtx(msg => {
    run.phase = 'review'; setFeedback(msg, 'good'); playCorrectSound();
    markDone(sub.id, true); setFeedback(`${msg} Sub-level complete: +${POINTS_SUB_COMPLETE} pts.`, 'good');
    btn.textContent = 'Back to sub-levels'; btn.disabled = false; run.finished = true; focusAction();
  });
  run.ctrl = sub.build(ctx); focusQuestion();
}
$('quiz-action').onclick = () => {
  if (run.placement) return placementAction();
  const btn = $('quiz-action');
  if (run.phase === 'answering') {
    const r = run.ctrl.check(), g = run.game;
    const res = g.answer(r.correct); run.wrongRow = r.correct ? 0 : (run.wrongRow || 0) + 1; if (!r.correct && run.wrongRow >= 3 && run.sub.hint) r.message += ' Hint: ' + run.sub.hint;
    run.phase = 'review'; run.lastCorrect = r.correct; $('quiz-body').classList.add('reviewing');
    setFeedback(r.message, r.correct ? 'good' : 'bad');
    r.correct ? playCorrectSound() : playWrongSound();
    if (run.ctrl.reveal) run.ctrl.reveal();
    renderStreak();
    if (res.complete) {
      markDone(run.sub.id, true); run.finished = true;
      setFeedback(`${r.message} Sub-level complete: +${POINTS_SUB_COMPLETE} pts!`, 'good'); playChimeSound();
      btn.textContent = 'Back to sub-levels';
    } else btn.textContent = res.forgiven ? 'Next (you have used a heart)' : 'Next';
    btn.disabled = false; focusAction();
  } else if (run.phase === 'review') {
    if (run.finished) navBack(); else nextQuestion();
  }
};

// ---------------- placement ----------------
function startPlacement() {
  run.sub = null; run.game = null; run.finished = false;
  run.placement = { i: 0, results: [] };
  openOverlayActivity('Find my level'); renderStreak(); placementQuestion();
}
function placementQuestion() {
  const P = run.placement, item = PLACEMENT[P.i];
  run.phase = 'answering'; run.ready = false; setFeedback(''); $('quiz-body').classList.remove('reviewing');
  $('streak-wrap').classList.remove('hidden'); $('streak-fill').style.width = (P.i / PLACEMENT.length * 100) + '%';
  $('streak-label').textContent = `${P.i + 1} of ${PLACEMENT.length}`;
  const btn = $('quiz-action'); btn.textContent = 'Check'; btn.disabled = true;
  run.ctrl = item.build(buildCtx(() => {})); focusQuestion();
}
function placementAction() {
  const P = run.placement, item = PLACEMENT[P.i];
  if (run.phase === 'answering') {
    const r = run.ctrl.check(); P.results.push({ id: item.id, correct: r.correct });
    // No teaching here: show only that the answer was recorded.
    run.phase = 'review'; setFeedback('Recorded.', ''); $('quiz-action').textContent = P.i === PLACEMENT.length - 1 ? 'See my level' : 'Next'; focusAction();
  } else if (P.i < PLACEMENT.length - 1) { P.i++; placementQuestion(); } else placementResult();
}
function placementResult() {
  const P = run.placement; run.phase = 'result';
  const firstMiss = P.results.findIndex(r => !r.correct);
  const stage = $('stage'); stage.innerHTML = ''; $('quiz-prompt').innerHTML = '<b>Your starting point</b>'; $('streak-wrap').classList.add('hidden');
  const startUnit = firstMiss === -1 ? UNITS.length - 1 : PLACEMENT[firstMiss].unit;
  stage.append(el('p', {}, firstMiss === -1
    ? 'You got every question right. You can start at the last unit; everything before it is marked as done.'
    : `You got ${firstMiss} of ${PLACEMENT.length} right before the first miss. You will start at "${UNITS[startUnit].title.replace(/^Unit \d+: /, '')}", and the units before it are marked as done.`),
    el('div', { class: 'stage-note' }, 'No points for skipped levels. You can replay any of them.'));
  setFeedback('');
  const btn = $('quiz-action'); btn.textContent = 'Start here'; btn.disabled = false; focusAction();
  run.placementDone = { startUnit };
}
const placementAfter = () => {
  const su = run.placementDone.startUnit; UNITS.forEach((u, i) => { if (i < su) u.subs.forEach(s => markDone(s.id, false)); });
  state.started = true; save(); navStack.length = 0;
  closeOverlay('quiz-overlay'); run.phase = 'idle'; run.placement = null; run.placementDone = null;
  history.replaceState({}, ''); renderUnits(); openUnit(UNITS[su]); pushNav(() => { renderUnits(); showScreen('units'); });
};
$('quiz-action').addEventListener('click', () => { if (run.phase === 'result') placementAfter(); }, true);

// ---------------- boot ----------------
$('btn-start').onclick = () => { state.started = true; save(); goUnits(); pushNav(goHome); };
$('btn-continue').onclick = () => { goUnits(); pushNav(goHome); };
$('btn-placement').onclick = () => { startPlacement(); };
goHome();
