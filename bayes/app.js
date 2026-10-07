// App shell: home, units, sub-levels, the activity runner, the placement
// test, help, menu. Same arrangement as Shapes and Trial and Error (name
// gate aside: this one has no accounts at all), so a student who has played
// one already knows how this works.
const STORE = 'bayes:v1';
const POINTS_SUB_COMPLETE = 50;
const params = new URLSearchParams(location.search);
const seedBase = params.has('seed') ? Number(params.get('seed')) : Date.now() % 1e9;
let seedCounter = 0;
const nextRng = () => BM.mulberry32(seedBase + 7919 * (++seedCounter));

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
  UNITS.forEach((u, i) => {
    const done = u.subs.length && u.subs.every(s => isDone(s.id));
    // a unit opens once it exists and the one before it is finished
    const locked = !u.subs.length || (i > 0 && !UNITS[i - 1].subs.every(s => isDone(s.id)));
    const t = el('button', { class: 'tile' + (locked ? ' locked' : '') + (done ? ' done' : ''), disabled: locked, onclick: () => openUnit(u) },
      el('span', { class: 'tile-num' }, locked ? String(i) : `UNIT ${i}`),
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
function openOverlay(id) { $(id).classList.remove('hidden'); }
function closeOverlay(id) { $(id).classList.add('hidden'); }
function showHelp(title, html) { $('help-title').textContent = title; $('help-body').innerHTML = html; openOverlay('help-overlay'); }
const HELP = {
  general: `<p>Every puzzle is a picture you can move: draw shapes from bags, slide dividers, place chips.</p>
    <p>Most sub-levels need <b>5 right in a row</b>. You can miss twice (♥♥); a third miss starts the run again. The answer is always explained, and you will often see a picture of why.</p>
    <p>You never have to calculate anything. If an answer is within a little of right, it counts.</p>`,
  about: `<p><b>Bag of Shapes</b> (working title) teaches Bayesian statistics from the very beginning, by trial and error: shapes, bags, and changing your mind when evidence arrives.</p>
    <p>Nothing here is graded or watched. Your progress and points are saved on this device only, and nothing is sent anywhere.</p>
    <p>Unit 0 needs no maths at all. Later units are planned to follow the chapters of <i>Bayesian Data Analysis for Cognitive Science</i> (Nicenboim, Schad &amp; Vasishth), with original examples.</p>`,
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
function setFeedback(text, kind) { const f = $('quiz-feedback'); f.textContent = text || ''; f.className = 'quiz-feedback' + (kind ? ' ' + kind : ''); }
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
$('quiz-help').onclick = () => showHelp(run.placement ? 'Find my level' : run.sub.name, run.placement ? `<p>${PLACEMENT.length === 5 ? 'Five' : PLACEMENT.length} quick pictures, with no feedback. The first one you miss is where you will start. You can always go back and play earlier levels.</p>` : `<p>${run.sub.help}</p>`);

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
    btn.textContent = 'Back to sub-levels'; btn.disabled = false; run.finished = true;
  });
  run.ctrl = sub.build(ctx);
}
$('quiz-action').onclick = () => {
  if (run.placement) return placementAction();
  const btn = $('quiz-action');
  if (run.phase === 'answering') {
    const r = run.ctrl.check(), g = run.game;
    const res = g.answer(r.correct);
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
    btn.disabled = false;
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
  run.ctrl = item.build(buildCtx(() => {}));
}
function placementAction() {
  const P = run.placement, item = PLACEMENT[P.i];
  if (run.phase === 'answering') {
    const r = run.ctrl.check(); P.results.push({ id: item.id, correct: r.correct });
    // No teaching here: show only that the answer was recorded.
    run.phase = 'review'; setFeedback('Recorded.', ''); $('quiz-action').textContent = P.i === PLACEMENT.length - 1 ? 'See my level' : 'Next';
  } else if (P.i < PLACEMENT.length - 1) { P.i++; placementQuestion(); } else placementResult();
}
function placementResult() {
  const P = run.placement; run.phase = 'result';
  const firstMiss = P.results.findIndex(r => !r.correct);
  const stage = $('stage'); stage.innerHTML = ''; $('quiz-prompt').innerHTML = '<b>Your level</b>'; $('streak-wrap').classList.add('hidden');
  const unlocked = [];
  const upTo = firstMiss === -1 ? PLACEMENT.length : firstMiss;
  for (let i = 0; i < upTo; i++) unlocked.push(...PLACEMENT[i].unlocks);
  const startSub = firstMiss === -1 ? null : UNITS[0].subs.find(s => !unlocked.includes(s.id));
  stage.append(el('p', {}, firstMiss === -1
    ? 'You got every picture right. Unit 0 is marked as done, and Unit 1 is open.'
    : `You got ${upTo} of ${PLACEMENT.length} right before the first miss. You will start at "${startSub.name}", and everything before it is marked as done.`),
    el('div', { class: 'stage-note' }, 'No points for skipped levels. You can replay any of them.'));
  setFeedback('');
  const btn = $('quiz-action'); btn.textContent = 'Start here'; btn.disabled = false;
  run.placementDone = { unlocked };
}
const placementAfter = () => {
  const u = run.placementDone.unlocked; UNITS[0].subs.forEach(s => { if (u.includes(s.id)) markDone(s.id, false); });
  state.started = true; save(); navStack.length = 0;
  closeOverlay('quiz-overlay'); run.phase = 'idle'; run.placement = null; run.placementDone = null;
  history.replaceState({}, ''); renderUnits(); openUnit(UNITS[0]);
};
$('quiz-action').addEventListener('click', () => { if (run.phase === 'result') placementAfter(); }, true);

// ---------------- boot ----------------
$('btn-start').onclick = () => { state.started = true; save(); goUnits(); pushNav(goHome); };
$('btn-continue').onclick = () => { goUnits(); pushNav(goHome); };
$('btn-placement').onclick = () => { startPlacement(); };
goHome();
