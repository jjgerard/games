// Part 2: tidy R. A tiny dplyr in JS gives every answer; tools/check-r.R runs the same pipelines in real dplyr/tidyr.
// ---------------------------------------------------------------------------------------------------------------
const TD = (cols, rows, groups = []) => ({ cols, rows, groups });
const objsOf = t => t.rows.map(r => Object.fromEntries(t.cols.map((c, i) => [c, r[i]])));
const gk = (t, o) => t.groups.map(g => o[g]).join('\u0001');
const cmpv = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function grouped(t) { const os = objsOf(t), m = new Map(); os.forEach(o => { const k = t.groups.length ? gk(t, o) : ''; if (!m.has(k)) m.set(k, []); m.get(k).push(o); }); return { os, m, k: o => t.groups.length ? gk(t, o) : '' }; }
const S = {
  filter: (code, f) => ({ code: `filter(${code})`, apply: t => { const g = grouped(t); return TD(t.cols, g.os.filter(o => f(o, g.m.get(g.k(o)))).map(o => t.cols.map(c => o[c])), t.groups); } }),
  mutate: (name, code, f) => ({ code: `mutate(${name} = ${code})`, apply: t => { const g = grouped(t); const cols = t.cols.includes(name) ? t.cols : [...t.cols, name]; return TD(cols, g.os.map(o => { const v = f(o, g.m.get(g.k(o))); return cols.map(c => c === name ? v : o[c]); }), t.groups); } }),
  summarise: (name, code, f) => ({ code: `summarise(${name} = ${code})`, apply: t => {
    const g = grouped(t); const keys = [...g.m.keys()].sort((a, b) => cmpv(a.split('\u0001'), b.split('\u0001')));
    const rows = keys.map(k => { const grp = g.m.get(k); return [...t.groups.map(c => grp[0][c]), f(grp)]; }); return TD([...t.groups, name], rows, t.groups.slice(0, -1)); } }),
  group_by: (...cols) => ({ code: `group_by(${cols.join(', ')})`, apply: t => TD(t.cols, t.rows, cols) }),
  ungroup: () => ({ code: 'ungroup()', apply: t => TD(t.cols, t.rows, []) }),
  arrange: (code, key, desc) => ({ code: `arrange(${code})`, apply: t => { const os = objsOf(t).map((o, i) => [o, i]); os.sort((a, b) => (desc ? -1 : 1) * cmpv(key(a[0]), key(b[0])) || a[1] - b[1]); return TD(t.cols, os.map(([o]) => t.cols.map(c => o[c])), t.groups); } }),
  count: (...cols) => ({ code: `count(${cols.join(', ')})`, apply: t => { const g = grouped({ ...t, groups: cols }); const keys = [...g.m.keys()].sort((a, b) => cmpv(a.split('\u0001'), b.split('\u0001'))); return TD([...cols, 'n'], keys.map(k => [...cols.map(c => g.m.get(k)[0][c]), g.m.get(k).length]), []); } }),
  distinct: (...cols) => ({ code: `distinct(${cols.join(', ')})`, apply: t => { const seen = new Set(), rows = []; objsOf(t).forEach(o => { const k = cols.map(c => o[c]).join('\u0001'); if (!seen.has(k)) { seen.add(k); rows.push(cols.map(c => o[c])); } }); return TD(cols, rows, []); } }),
  select: (...cols) => ({ code: `select(${cols.join(', ')})`, apply: t => TD(cols, objsOf(t).map(o => cols.map(c => o[c])), t.groups.filter(g => cols.includes(g))) }),
};
const runSteps = (t, steps) => steps.reduce((x, s) => s.apply(x), t);
const pipeLines = (steps, head = 'data') => [head + ' %>%', ...steps.map((s, i) => '  ' + s.code + (i < steps.length - 1 ? ' %>%' : ''))];
const pipeExpr = (steps, head = 'data') => [head, ...steps.map(s => s.code)].join(' %>% ');
const sumOf = os => os.reduce((a, o) => a + o.score, 0);
const dataSetup = t => `data = ${dfCode(t.cols, t.rows)}`;
const tdSpec = t => dfSpec(t.cols, t.rows);
const pipeCheck = (t, steps, head = 'data', extra = '') => ({ setup: dataSetup(t) + extra, expr: pipeExpr(steps, head), expect: tdSpec(runSteps(t, steps)) });

function genData(r, n = 5) {
  for (;;) {
    const subj = RG.shuffle(r, RG.pick(r, [['A', 'A', 'B', 'B', 'C'], ['A', 'A', 'A', 'B', 'C'], ['A', 'B', 'B', 'C', 'C'], ['A', 'A', 'B', 'C', 'C']]));
    const cond = subj.map(() => RG.pick(r, ['x', 'y']));
    if (new Set(cond).size < 2) continue;
    // keep a subj-by-cond pair or two repeated so group_by(subj, cond) differs from group_by(subj)
    const t = TD(['subj', 'cond', 'score'], subj.map((s, i) => [s, cond[i], RG.int(r, 1, 9)]));
    const nSub = new Set(subj).size, nPair = new Set(subj.map((s, i) => s + cond[i])).size;
    if (nPair === nSub || nPair === n) continue;
    return t;
  }
}
const inputGrid = (t, o = {}) => tableGrid(t, o).wrap;
const outGrid = t => () => tableGrid(t).wrap;

// ---- row-count pipelines ----
function kFor(r, t, ok) { const ks = [2, 3, 4, 5, 6, 7].filter(k => ok(k)); return ks.length ? RG.pick(r, ks) : null; }
const KINDS = {
  'filter-score': (r, t) => { const k = kFor(r, t, k => { const n = t.rows.filter(x => x[2] > k).length; return n >= 1 && n <= t.rows.length - 1; }); return k && [S.filter(`score > ${k}`, o => o.score > k)]; },
  'filter-cond': (r, t) => { const c = RG.pick(r, ['x', 'y']); return [S.filter(`cond == "${c}"`, o => o.cond === c)]; },
  'filter-or': (r, t) => { const k = kFor(r, t, k => { const a = t.rows.filter(x => x[0] === 'A' || x[2] > k).length, b = t.rows.filter(x => x[0] === 'A' && x[2] > k).length; return a !== b && a < t.rows.length && b > 0; }); return k && [S.filter(`subj == "A" | score > ${k}`, o => o.subj === 'A' || o.score > k)]; },
  'filter-and': (r, t) => { const k = kFor(r, t, k => { const a = t.rows.filter(x => x[0] === 'A' || x[2] > k).length, b = t.rows.filter(x => x[0] === 'A' && x[2] > k).length; return a !== b && b > 0; }); return k && [S.filter(`subj == "A" & score > ${k}`, o => o.subj === 'A' && o.score > k)]; },
  'group': () => [S.group_by('subj')],
  'filter-group': (r, t) => { const k = kFor(r, t, k => { const n = t.rows.filter(x => x[2] > k).length; return n >= 1 && n <= t.rows.length - 1; }); return k && [S.filter(`score > ${k}`, o => o.score > k), S.group_by('subj')]; },
  'group2': () => [S.group_by('subj', 'cond')],
  'group-mutate': () => [S.group_by('subj'), S.mutate('total', 'sum(score)', (o, g) => sumOf(g))],
  'group-summ': () => [S.group_by('subj'), S.summarise('total', 'sum(score)', g => sumOf(g))],
  'group2-summ': () => [S.group_by('subj', 'cond'), S.summarise('n', 'n()', g => g.length)],
  'summ-all': () => [S.summarise('total', 'sum(score)', g => sumOf(g))],
  'mutate': (r, t) => { const k = RG.int(r, 3, 6); return [S.mutate('big', `score > ${k}`, o => o.score > k)]; },
  'filter-group-summ': (r, t) => { const k = kFor(r, t, k => { const keep = t.rows.filter(x => x[2] > k); const nn = new Set(keep.map(x => x[0])).size; return keep.length >= 1 && nn < new Set(t.rows.map(x => x[0])).size; }); return k && [S.filter(`score > ${k}`, o => o.score > k), S.group_by('subj'), S.summarise('n', 'n()', g => g.length)]; },
  'group-mutate-filter': (r, t) => { const g = {}; t.rows.forEach(x => { g[x[0]] = (g[x[0]] || 0) + x[2]; }); const tot = Object.values(g).sort((a, b) => a - b); const k = tot.length > 2 ? tot[0] : null; if (k == null || tot[0] === tot[1]) return null;
    return [S.group_by('subj'), S.mutate('total', 'sum(score)', (o, gr) => sumOf(gr)), S.filter(`total > ${k}`, o => 0, true)].map((s, i) => i === 2 ? S.filter(`total > ${k}`, (o, gr) => sumOf(gr) > k) : s); },
  'arrange': () => [S.arrange('score', o => o.score)],
  'count': () => [S.count('subj')],
  'count2': () => [S.count('subj', 'cond')],
  'distinct': () => [S.distinct('subj')],
};
function rowCase(r, kinds) {
  for (let tries = 0; tries < 80; tries++) {
    const t = genData(r), kind = RG.pick(r, kinds), steps = KINDS[kind](r, t); if (!steps) continue;
    const out = runSteps(t, steps); if (out.rows.length < 1) continue;
    return { t, kind, steps, out };
  }
  const t = genData(r), steps = KINDS.group(r, t); return { t, kind: 'group', steps, out: runSteps(t, steps) };
}
const rowExplain = (cs, n) => {
  const k = cs.kind;
  if (k === 'group' || k === 'group2' || k === 'filter-group') return `group_by() only labels the rows, it collapses nothing. Still ${n} rows.`;
  if (k === 'group-mutate') return `mutate keeps every row and repeats each group's total. Still ${n} rows.`;
  if (k === 'group-summ' || k === 'group2-summ') return `summarise collapses each group to one row: ${n} groups, ${n} rows.`;
  if (k === 'summ-all') return 'With no groups, summarise collapses everything to one row.';
  if (k === 'mutate') return `mutate adds a column and keeps every row: ${n}.`;
  if (k === 'arrange') return `arrange only reorders the rows: ${n}.`;
  if (k.startsWith('filter-')) return `filter keeps the rows where the test is TRUE: ${n} of ${cs.t.rows.length}.`;
  if (k === 'filter-group-summ') return `filter drops rows first, then summarise gives one row for each group that is left: ${n}.`;
  if (k === 'group-mutate-filter') return `mutate keeps all rows, then filter drops the rows of the groups that fail the test: ${n} left.`;
  if (k.startsWith('count') || k === 'distinct') return `${k === 'distinct' ? 'distinct' : 'count'} gives one row per different combination: ${n}.`;
  return `${n} rows.`;
};
function rowQuestion(ctx, kinds, opts = {}) {
  const r = ctx.rng, cs = rowCase(r, kinds), n = cs.out.rows.length;
  return E.count(ctx, { prompt: 'How many rows does the result have?', lead: pipeLines(cs.steps), pic: inputGrid(cs.t), after: outGrid(cs.out), answer: n, max: 6, inputRows: cs.t.rows.length, explain: rowExplain(cs, n), rcheck: [pipeCheck(cs.t, cs.steps)], naive: { 'no change (5)': () => 0 } });
}

// ======================================================================
// Unit 10: What is one row?
// ======================================================================
const UT0 = {
  id: 't0', part: 2, title: 'Unit 10: What is one row?', intro: 'In a tidy table, each row is one observation and each column is one variable.',
  subs: [
    tutorial('t0-first', 'One row, one observation', 'Tap Bo\'s row', 'A row holds everything about one observation.', ctx =>
      E.pick(ctx, { prompt: 'Each row is <b>one observation</b>. Tap the row that records Bo\'s score.', mode: 'row', grid: { data: [['Ann', '7'], ['Bo', '5'], ['Cy', '9']], head: ['name', 'score'], rowHead: ['1', '2', '3'] }, answer: [1], tutorial: true, done: 'One row per observation: here, one person\'s score.' })),
    streak('t0-row', 'Find the row', 'Which row records it?', 'Each row is one observation. Find the row where all the facts match.', ctx => {
      const r = ctx.rng, t = genData(r), i = RG.int(r, 0, t.rows.length - 1), [s, c, v] = t.rows[i];
      const dup = t.rows.filter(x => x[0] === s && x[1] === c).length; if (dup > 1) return UT0.subs[1].build(ctx);
      return E.pick(ctx, { prompt: `Tap the row for subject ${s} in condition ${c}.`, mode: 'row', single: true, grid: { data: t.rows.map(x => x.map(String)), head: t.cols, rowHead: t.rows.map((_, k) => String(k + 1)) }, answer: [i], explain: `Row ${i + 1}: subject ${s}, condition ${c}, score ${v}.`, rcheck: [] });
    }),
    streak('t0-col', 'Find the variable', 'Which column?', 'Each column is one variable: one thing measured or recorded for every row.', ctx => {
      const r = ctx.rng, t = genData(r), j = RG.int(r, 0, 2), what = ['which person (subject) it was', 'which condition it was', 'the score'][j];
      return E.pick(ctx, { prompt: `Tap the column that records <b>${what}</b>.`, mode: 'col', single: true, grid: { data: t.rows.map(x => x.map(String)), head: t.cols, rowHead: t.rows.map((_, k) => String(k + 1)) }, answer: [j], explain: `${t.cols[j]} holds ${what} for every row.`, rcheck: [] });
    }),
    streak('t0-wide', 'Values hiding in headers', 'Spot the wide table', 'If the headers are values of one variable (coffee and tea are both drinks) the table is wide. Tidy data has one column for that variable.', ctx => {
      const r = ctx.rng, pair = RG.pick(r, [['coffee', 'tea'], ['pre', 'post'], ['left', 'right']]), n = 3;
      const rows = Array.from({ length: n }, (_, i) => [String(i + 1), String(RG.int(r, 0, 1)), String(RG.int(r, 0, 1))]);
      return E.pick(ctx, { prompt: 'Which column headers are really <b>values</b> of one variable? Tap them.', mode: 'col', grid: { data: rows, head: ['id', ...pair] }, answer: [1, 2], explain: `${pair[0]} and ${pair[1]} are two values of one variable, so that variable needs its own column. Tidy tables have a column for it.`, rcheck: [] });
    }),
    streak('t0-unit', 'One row is one what?', 'Name the level', 'Look at which columns identify a row. Subject alone: one row per subject. Subject and condition: one row per subject in each condition.', ctx => {
      const r = ctx.rng, lv = RG.int(r, 0, 2);
      const subj = ['A', 'B', 'C'], cond = ['x', 'y'];
      let cols, rows, ans;
      if (lv === 0) { cols = ['subj', 'age']; rows = subj.map(s => [s, RG.int(r, 20, 60)]); ans = 'a subject'; }
      else if (lv === 1) { cols = ['subj', 'cond', 'mean']; rows = subj.slice(0, 2).flatMap(s => cond.map(c => [s, c, RG.int(r, 1, 9)])); ans = 'a subject in a condition'; }
      else { cols = ['subj', 'trial', 'resp']; rows = subj.slice(0, 2).flatMap(s => [1, 2, 3].map(k => [s, k, RG.int(r, 1, 9)])).slice(0, 5); ans = 'a trial'; }
      return E.choice(ctx, { prompt: 'In this table, one row is...', pic: Grid({ data: rows.map(x => x.map(String)), head: cols, compact: true }).wrap, options: ['a subject', 'a trial', 'a subject in a condition', 'a condition'], answer: ans, explain: `The columns ${cols.slice(0, lv === 1 ? 2 : lv === 2 ? 2 : 1).join(' and ')} pick out one row: that is ${ans}.`, rcheck: [] });
    }),
  ],
};

// ======================================================================
// Unit 11: the pipe
// ======================================================================
const UT1 = {
  id: 't1', part: 2, title: 'Unit 11: The pipe, "and then"', intro: 'A pipe passes a table from one step to the next.',
  subs: [
    tutorial('t1-first', 'Run a pipe', 'One step on the belt', 'data %>% filter(...) means: take data, and then filter it.', ctx => {
      const r = ctx.rng, t = genData(r), k = 4; const steps = [S.filter(`score > ${k}`, o => o.score > k)]; if (!runSteps(t, steps).rows.length || runSteps(t, steps).rows.length === t.rows.length) return UT1.subs[0].build(ctx);
      return E.belt(ctx, { prompt: 'The pipe <code>%>%</code> reads "and then". Press Run to send the table down the belt.', table: t, head: 'data', steps, done: 'The table went in, the filter step kept some rows, and the result came out. That is all a pipe does: pass the result along.' });
    }),
    streak('t1-pipe', 'Which joiner?', 'Pipe or plus?', '%>% (or |>) passes a table into the next step. + is only for adding layers to a ggplot.', ctx => {
      const r = ctx.rng, k = RG.int(r, 3, 6);
      return E.assemble(ctx, { prompt: 'Pass <code>data</code> into the next step: <b>and then</b>.', parts: ['data ', { slot: 'p' }, ` filter(score > ${k})`], tiles: ['%>%', '|>', '+', ',', '='], answer: { p: ['%>%', '|>'] }, why: { p: { '+': '+ is for ggplot layers, not data steps.', ',': 'A comma would give filter a second input, not pipe the table.', '=': '= stores a value.', '*': 'The pipe is %>% (or |>).' } },
        explain: '%>% means "and then".', rcheck: [{ setup: dataSetup(genData(RG.mulberry32(7))), expr: `data %>% filter(score > ${k})`, expect: null }] });
    }),
    streak('t1-order', 'Order matters', 'Put the steps in order', 'Each step works on what the step before it made. A column must exist before a later step can use it.', ctx => {
      const r = ctx.rng, t = genData(r), k = RG.int(r, 3, 6);
      const mutS = S.mutate('pass', `score > ${k}`, o => o.score > k), filtS = S.filter('pass', o => o.score > k), arrS = S.arrange('score', o => o.score);
      const useArr = r() < .5; const steps = useArr ? [mutS, filtS, arrS] : [mutS, filtS];
      const out = runSteps(t, steps); if (!out.rows.length) return UT1.subs[2].build(ctx);
      const tiles = [mutS.code, filtS.code, arrS.code, 'ungroup()'];
      const slots = useArr ? ['a', 'b', 'c'] : ['a', 'b'];
      return E.assemble(ctx, { prompt: `Make a column <code>pass</code> (score over ${k}), keep only the passes${useArr ? ', then sort by score' : ''}.`, lines: [['data %>%'], [' ', { slot: 'a' }, ' %>%'], [' ', { slot: 'b' }, useArr ? ' %>%' : ''], ...(useArr ? [[' ', { slot: 'c' }]] : [])], tiles: useArr ? tiles : tiles.slice(0, 2).concat(['arrange(score)']), answer: Object.fromEntries(slots.map((s, i) => [s, steps[i].code])),
        why: { a: { '*': 'The column pass has to be made before anything can use it.' }, b: { '*': 'Filter on pass only after it exists.' }, c: { '*': 'Sorting comes last here.' } }, explain: 'mutate makes pass, then filter(pass) keeps TRUE rows.',
        rcheck: [pipeCheck(t, steps)] });
    }),
    streak('t1-call', 'Every step is a call', 'Spot the bare line', 'After a pipe, every step must be a function call such as filter(...) or mutate(...). A bare assignment or a bare test is not.', ctx => {
      const r = ctx.rng, k = RG.int(r, 3, 6), t = genData(r);
      const good = [`filter(score > ${k})`, 'arrange(score)', 'select(subj, score)', 'mutate(double = score * 2)', 'group_by(subj)'];
      const bad = ['double = score * 2', `score > ${k}`, 'score', '"A"', 'new_score = score + 1'];
      const b = RG.pick(r, bad), at = RG.int(r, 0, 2), others = RG.sample(r, good, 2); const steps = [...others]; steps.splice(at, 0, b);
      const lines = ['data %>%', ...steps.map((s, i) => '  ' + s + (i < steps.length - 1 ? ' %>%' : ''))];
      return E.pick(ctx, { prompt: 'One line breaks the pipe. Tap it.', mode: 'line', single: true, items: lines, answer: [at + 1], explain: `\`${b}\` is not a function call. A new column goes inside mutate(...), a test inside filter(...).`, rcheck: [{ kind: 'error', setup: dataSetup(t), code: `data %>% ${b}`, contains: '' }].slice(0, 0) });
    }),
  ],
};

// ======================================================================
// Unit 12: filter
// ======================================================================
const UT2 = {
  id: 't2', part: 2, title: 'Unit 12: filter keeps rows', intro: 'filter() keeps the rows where a test is TRUE.',
  subs: [
    tutorial('t2-first', 'Which row survives?', 'Tap the survivor', 'filter() keeps rows where the test is TRUE.', ctx =>
      E.pick(ctx, { prompt: '<code>filter(score > 7)</code> keeps the rows where the test is TRUE. Tap the row that survives.', lead: ['data %>% filter(score > 7)'], mode: 'row', grid: { data: [['A', 'x', '4'], ['B', 'y', '9'], ['C', 'x', '6']], head: ['subj', 'cond', 'score'], rowHead: ['1', '2', '3'] }, answer: [1], tutorial: true, done: 'Only row 2 has a score over 7, so only row 2 stays.' })),
    streak('t2-keep', 'Which rows stay?', 'Tap the surviving rows', 'filter() keeps a row when its test is TRUE, and drops it otherwise. The rows keep their original order.', ctx => {
      const r = ctx.rng, t = genData(r), kind = RG.pick(r, ['filter-score', 'filter-cond']), steps = KINDS[kind](r, t); if (!steps) return UT2.subs[1].build(ctx);
      const os = objsOf(t); const f = kind === 'filter-score' ? (() => { const k = Number(steps[0].code.match(/> (\d+)/)[1]); return o => o.score > k; })() : (() => { const c = steps[0].code.match(/"(.)"/)[1]; return o => o.cond === c; })();
      const keep = os.map(f); if (keep.every(x => x) || keep.every(x => !x)) return UT2.subs[1].build(ctx);
      return E.pick(ctx, { prompt: `Tap the rows that <code>${steps[0].code}</code> keeps.`, mode: 'row', grid: { data: t.rows.map(x => x.map(String)), head: t.cols, rowHead: t.rows.map((_, k) => String(k + 1)) }, answer: keep.map((k, i) => k ? i : -1).filter(i => i >= 0), explain: `Rows where ${steps[0].code.replace('filter(', '').replace(')', '')} is TRUE stay.`, rcheck: [pipeCheck(t, steps)] });
    }),
    streak('t2-andor', 'And, or', 'Both tests, or either?', '& (or a comma) keeps rows that pass both tests. | keeps rows that pass either one.', ctx => {
      const r = ctx.rng, t = genData(r), kind = RG.pick(r, ['filter-or', 'filter-and']), steps = KINDS[kind](r, t); if (!steps) return UT2.subs[2].build(ctx);
      const k = Number(steps[0].code.match(/> (\d+)/)[1]), isOr = kind === 'filter-or';
      const keep = objsOf(t).map(o => isOr ? (o.subj === 'A' || o.score > k) : (o.subj === 'A' && o.score > k));
      return E.pick(ctx, { prompt: `Tap the rows that <code>${steps[0].code}</code> keeps.`, mode: 'row', grid: { data: t.rows.map(x => x.map(String)), head: t.cols, rowHead: t.rows.map((_, i) => String(i + 1)) }, answer: keep.map((x, i) => x ? i : -1).filter(i => i >= 0), allowNone: true,
        explain: isOr ? '| keeps a row if either test is TRUE.' : '& keeps a row only if both tests are TRUE.', rcheck: [pipeCheck(t, steps)] });
    }, { target: 10 }),
    streak('t2-na', 'Between and missing', 'between() and !is.na()', 'between(score, 3, 6) keeps 3 to 6, ends included. !is.na(score) keeps rows where score is not missing.', ctx => {
      const r = ctx.rng, t = genData(r), i = RG.int(r, 0, 4); const na = r() < .5;
      const tt = TD(t.cols, t.rows.map((row, k) => k === i ? [row[0], row[1], null] : row)); let code, f;
      if (na) { code = '!is.na(score)'; f = o => o.score !== null; } else { const lo = RG.int(r, 2, 4), hi = lo + RG.int(r, 2, 3); code = `between(score, ${lo}, ${hi})`; f = o => o.score !== null && o.score >= lo && o.score <= hi; }
      const keep = objsOf(tt).map(f); if (keep.every(x => x) || keep.every(x => !x)) return UT2.subs[3].build(ctx);
      const step = { code: `filter(${code})`, apply: t0 => TD(t0.cols, objsOf(t0).filter(f).map(o => t0.cols.map(c => o[c])), t0.groups) };
      return E.pick(ctx, { prompt: `Tap the rows that <code>filter(${code})</code> keeps.`, mode: 'row', grid: { data: tt.rows.map(x => x.map(shown)), head: tt.cols, rowHead: tt.rows.map((_, k) => String(k + 1)) }, answer: keep.map((x, k) => x ? k : -1).filter(k => k >= 0),
        explain: na ? '!is.na(score) is TRUE where score is present, so the row with NA goes.' : 'between() includes both ends; a missing score is not between anything.', rcheck: [pipeCheck(tt, [step])] });
    }),
    streak('t2-write', 'Write the filter', 'Fill the gaps', 'Inside filter: == compares, & means and, | means or. A single = would be a different job.', ctx => {
      const r = ctx.rng, k = RG.int(r, 3, 6), c = RG.pick(r, ['x', 'y']), and = r() < .5;
      return E.assemble(ctx, { prompt: `Keep rows where score is over ${k} <b>${and ? 'and' : 'or'}</b> cond is ${c}.`, parts: ['data %>% filter(score > ', String(k), ' ', { slot: 'j' }, ' cond ', { slot: 'q' }, ` "${c}")`], tiles: ['&', '|', '==', '=', '!=', ','], answer: { j: and ? ['&', ','] : '|', q: '==' },
        why: { j: { '&': 'The question says or: | keeps rows that pass either test.', '|': 'The question says and: & needs both.', '*': and ? 'and is & (a comma also works).' : 'or is |.' }, q: { '=': '= is not a comparison. Use == inside filter.', '!=': '!= keeps the rows that are NOT that value.', '*': 'A comparison is ==.' } },
        explain: `filter(score > ${k} ${and ? '&' : '|'} cond == "${c}")`, rcheck: (() => { const t = genData(RG.mulberry32(11)); const st = [S.filter(`score > ${k} ${and ? '&' : '|'} cond == "${c}"`, o => and ? (o.score > k && o.cond === c) : (o.score > k || o.cond === c))]; return [pipeCheck(t, st)]; })() });
    }),
  ],
};

// ======================================================================
// Unit 13: select, rename, and the verb choice
// ======================================================================
const miniTable = (cols, rows) => tableGrid(TD(cols, rows, [])).wrap;
const U3_VERBS = ['filter', 'select', 'rename', 'mutate'];
const UT3 = {
  id: 't3', part: 2, title: 'Unit 13: select, rename, mutate', intro: 'Four verbs, four jobs: rows, columns, names, values.',
  subs: [
    tutorial('t3-first', 'select keeps columns', 'Tap the kept column', 'select() names the columns to keep.', ctx =>
      E.pick(ctx, { prompt: '<code>select(score)</code> keeps the columns you name. Tap the column that stays.', lead: ['data %>% select(score)'], mode: 'col', grid: { data: [['A', 'x', '4'], ['B', 'y', '9']], head: ['subj', 'cond', 'score'], rowHead: ['1', '2'] }, answer: [2], tutorial: true, done: 'select picks columns by name. It never looks at the values inside them.' })),
    streak('t3-select', 'Which columns?', 'Tap the kept columns', 'select(a, b) keeps those columns. select(-a) keeps everything except a.', ctx => {
      const r = ctx.rng, t = genData(r), names = t.cols, neg = r() < .3; let keep, code;
      if (neg) { const d = RG.int(r, 0, 2); keep = [0, 1, 2].filter(i => i !== d); code = `select(-${names[d]})`; } else { keep = ints(r, 0, 2, RG.int(r, 1, 2), true); code = `select(${keep.map(i => names[i]).join(', ')})`; }
      const step = { code, apply: t0 => TD(keep.map(i => names[i]), t0.rows.map(row => keep.map(i => row[i])), []) };
      return E.pick(ctx, { prompt: `Tap the columns that <code>${code}</code> keeps.`, mode: 'col', grid: { data: t.rows.slice(0, 3).map(x => x.map(String)), head: names, rowHead: ['1', '2', '3'] }, answer: keep, explain: neg ? 'A minus sign means "everything except".' : 'select keeps exactly the columns you name.', rcheck: [pipeCheck(TD(t.cols, t.rows.slice(0, 3)), [step])] });
    }),
    streak('t3-which', 'What changed?', 'Name the verb', 'filter changes which rows exist. select changes which columns exist. rename changes a column name. mutate changes or adds values.', ctx => {
      const r = ctx.rng, v = RG.pick(r, U3_VERBS), id = [1, 2, 3], g = [RG.pick(r, ['a', 'b']), RG.pick(r, ['a', 'b']), RG.pick(r, ['a', 'b'])], p = ints(r, 1, 9, 3);
      let before, after;
      if (v === 'filter') { g[0] = 'a'; g[1] = 'b'; before = TD(['id', 'grp'], id.map((x, i) => [x, g[i]])); after = TD(['id', 'grp'], before.rows.filter(x => x[1] === 'a')); }
      else if (v === 'select') { before = TD(['id', 'grp', 'pts'], id.map((x, i) => [x, g[i], p[i]])); after = TD(['id', 'pts'], before.rows.map(x => [x[0], x[2]])); }
      else if (v === 'rename') { before = TD(['id', 'pts'], id.map((x, i) => [x, p[i]])); after = TD(['id', 'score'], before.rows); }
      else if (r() < .5) { before = TD(['id', 'pts'], id.map((x, i) => [x, p[i]])); after = TD(['id', 'pts', 'big'], before.rows.map(x => [...x, x[1] > 4])); }
      else { g[0] = 'a'; g[1] = 'b'; before = TD(['id', 'grp'], id.map((x, i) => [x, g[i]])); after = TD(['id', 'grp'], before.rows.map(x => [x[0], x[1] === 'a' ? 'ctrl' : 'test'])); }
      const pic = el('div', { class: 'foldwrap' }, miniTable(before.cols, before.rows), el('span', { class: 'arrow', 'aria-label': 'becomes' }, '→'), miniTable(after.cols, after.rows));
      return E.choice(ctx, { prompt: 'Which verb turned the left table into the right one?', pic, options: U3_VERBS, answer: v, code: true,
        explain: { filter: 'Same columns, fewer rows: filter.', select: 'Same rows, fewer columns: select.', rename: 'Same shape, a new header: rename.', mutate: 'Same rows, a new column or changed values: mutate.' }[v], rcheck: [] });
    }, { target: 10 }),
    streak('t3-trap', 'Pick the verb', 'The condition-in-select trap', 'select() chooses columns by name and never looks inside them. A test on values belongs in filter(); changing values belongs in mutate().', ctx => {
      const r = ctx.rng, t = RG.int(r, 0, 3);
      const cs = [
        { p: 'Keep only the <b>rows</b> where cond is x.', parts: ['data %>% ', { slot: 'v' }, '(cond == "x")'], v: 'filter', code: 'filter(cond == "x")', w: { select: 'select picks columns by name. It cannot test the values inside cond.', mutate: 'mutate makes or changes columns; it does not drop rows.', rename: 'rename changes a name only.' } },
        { p: 'Keep only the <b>column</b> cond.', parts: ['data %>% ', { slot: 'v' }, '(cond)'], v: 'select', code: 'select(cond)', w: { filter: 'filter keeps rows. To keep a column use select.', mutate: 'mutate makes new columns.', rename: 'rename would keep every column.' } },
        { p: 'Make a new column <code>pass</code>.', parts: ['data %>% ', { slot: 'v' }, '(pass = score > 4)'], v: 'mutate', code: 'mutate(pass = score > 4)', w: { filter: 'filter keeps rows.', select: 'select chooses existing columns; it cannot make one.', rename: 'rename needs an existing column on the right of =.' } },
        { p: 'Change the <b>values</b> in cond to "ctrl" or "test".', parts: ['data %>% ', { slot: 'v' }, '(cond = recode(cond, "x" = "ctrl", "y" = "test"))'], v: 'mutate', code: 'mutate(cond = recode(...))', w: { select: 'select cannot change values.', rename: 'rename changes the header, not what is inside.', filter: 'filter drops rows.' } },
      ][t];
      const t0 = genData(r);
      const rc = t === 0 ? [pipeCheck(t0, [S.filter('cond == "x"', o => o.cond === 'x')])] : t === 1 ? [pipeCheck(t0, [S.select('cond')])] : t === 2 ? [pipeCheck(t0, [S.mutate('pass', 'score > 4', o => o.score > 4)])] : [pipeCheck(t0, [{ code: 'mutate(cond = recode(cond, "x" = "ctrl", "y" = "test"))', apply: x => TD(x.cols, x.rows.map(row => [row[0], row[1] === 'x' ? 'ctrl' : 'test', row[2]]), []) }])];
      return E.assemble(ctx, { prompt: cs.p, parts: cs.parts, tiles: U3_VERBS, answer: { v: cs.v }, why: { v: cs.w }, explain: `${cs.code} does this job.`, rcheck: rc });
    }, { target: 10 }),
    streak('t3-rename', 'rename: new = old', 'Which side is the new name?', 'rename(new_name = old_name): the new name comes first, on the left of =.', ctx => {
      const r = ctx.rng, [o, n] = RG.pick(r, [['age_m', 'age'], ['resp', 'answer'], ['pts', 'score'], ['grp', 'group'], ['sub', 'subject']]);
      const g = Grid({ data: [['1', '4'], ['2', '9']], head: ['id', n], compact: true, label: `table whose column is now called ${n}` });
      return E.assemble(ctx, { prompt: `The column <code>${o}</code> should be called <code>${n}</code>.`, lead: [`data has columns id, ${o}`], pic: g.wrap, parts: ['data %>% rename(', { slot: 'a' }, ' = ', { slot: 'b' }, ')'], tiles: [o, n, `"${o}"`, `"${n}"`], answer: { a: n, b: o }, why: { a: { [o]: 'The new name goes on the left of =.', '*': 'The new name goes on the left.' }, b: { [n]: 'The old name goes on the right of =.', '*': 'The old name goes on the right.' } }, explain: `rename(${n} = ${o}): new name on the left, old on the right.`,
        rcheck: [{ setup: `data = data.frame(id = 1:2, ${o} = c(4, 9))`, expr: `data %>% rename(${n} = ${o})`, expect: dfSpec(['id', n], [[1, 4], [2, 9]]) }] });
    }),
  ],
};

// ======================================================================
// Unit 14: mutate
// ======================================================================
const UT4 = {
  id: 't4', part: 2, title: 'Unit 14: mutate makes columns', intro: 'mutate() adds a column, or changes one, and keeps every row.',
  subs: [
    tutorial('t4-first', 'A new column', 'Fill the last cell', 'if_else(test, a, b) gives a when the test is TRUE and b otherwise.', ctx =>
      E.fill(ctx, { prompt: '<code>if_else(score > 4, "yes", "no")</code> fills the new column. Finish it.', lead: ['mutate(pass = if_else(score > 4, "yes", "no"))'], grid: { data: [['A', '9', '"yes"'], ['B', '2', '"no"'], ['C', '7', '']], head: ['subj', 'score', 'pass'], rowHead: ['1', '2', '3'] }, blanks: { '2,2': '"yes"' }, tiles: ['"yes"'], tutorial: true, done: 'Row 3 scored 7, which is over 4, so pass is "yes". Every row got a value; no rows were lost.' })),
    streak('t4-ifelse', 'if_else', 'Fill the new column', 'if_else(test, a, b): for each row, a if the test is TRUE and b if it is FALSE.', ctx => {
      const r = ctx.rng, k = RG.int(r, 3, 6), rows = Array.from({ length: 4 }, () => RG.int(r, 1, 9)); if (rows.every(x => x > k) || rows.every(x => x <= k)) return UT4.subs[1].build(ctx);
      const [a, b] = RG.pick(r, [['yes', 'no'], ['high', 'low'], ['pass', 'fail']]);
      const out = rows.map(x => x > k ? a : b);
      return E.fill(ctx, { prompt: 'Fill the new column.', lead: [`mutate(res = if_else(score > ${k}, "${a}", "${b}"))`], grid: { data: rows.map(x => [String(x), '']), head: ['score', 'res'], rowHead: rows.map((_, i) => String(i + 1)) }, blanks: Object.fromEntries(out.map((v, i) => [`${i},1`, `"${v}"`])), tiles: [`"${a}"`, `"${b}"`],
        explain: `Rows over ${k} get "${a}", the others "${b}".`, rcheck: [{ setup: `data = data.frame(score = ${rvec(rows)})`, expr: `data %>% mutate(res = if_else(score > ${k}, "${a}", "${b}"))`, expect: dfSpec(['score', 'res'], rows.map((x, i) => [x, out[i]])) }] });
    }),
    streak('t4-case', 'case_when', 'Three outcomes', 'case_when tries its tests top to bottom; a row takes the first one that is TRUE. TRUE ~ "x" catches the rest.', ctx => {
      const r = ctx.rng, rows = Array.from({ length: 4 }, () => RG.int(r, 1, 9)), hi = RG.int(r, 6, 7), mid = RG.int(r, 3, 4);
      const lab = x => x > hi ? 'high' : x > mid ? 'mid' : 'low'; const out = rows.map(lab); if (new Set(out).size < 3) return UT4.subs[2].build(ctx);
      return E.fill(ctx, { prompt: 'Fill the new column.', lead: [`case_when(score > ${hi} ~ "high",`, `          score > ${mid} ~ "mid",`, '          TRUE ~ "low")'], grid: { data: rows.map(x => [String(x), '']), head: ['score', 'lvl'], rowHead: rows.map((_, i) => String(i + 1)) }, blanks: Object.fromEntries(out.map((v, i) => [`${i},1`, `"${v}"`])), tiles: ['"high"', '"mid"', '"low"'],
        explain: `A row takes the first test that is TRUE: over ${hi} is high, else over ${mid} is mid, else low.`, rcheck: [{ setup: `data = data.frame(score = ${rvec(rows)})`, expr: `data %>% mutate(lvl = case_when(score > ${hi} ~ "high", score > ${mid} ~ "mid", TRUE ~ "low"))`, expect: dfSpec(['score', 'lvl'], rows.map((x, i) => [x, out[i]])) }] });
    }),
    streak('t4-recode', 'Change values inside', 'recode', 'To change values inside a column use mutate with recode. rename would change the header, not the values.', ctx => {
      const r = ctx.rng, [a, b] = RG.pick(r, [['inf', 'Infinitive'], ['subj', 'Subjunctive']]), other = a === 'inf' ? ['subj', 'Subjunctive'] : ['inf', 'Infinitive'];
      const vals = [RG.pick(r, [a, other[0]]), RG.pick(r, [a, other[0]]), RG.pick(r, [a, other[0]]), RG.pick(r, [a, other[0]])]; if (new Set(vals).size < 2) return UT4.subs[3].build(ctx);
      const map = { [a]: b, [other[0]]: other[1] }, out = vals.map(v => map[v]);
      return E.fill(ctx, { prompt: 'Fill in the column after the change.', lead: [`mutate(cond = recode(cond,`, `  "${a}" = "${b}",`, `  "${other[0]}" = "${other[1]}"))`], grid: { data: vals.map(v => [`"${v}"`, '']), head: ['before', 'cond'], rowHead: vals.map((_, i) => String(i + 1)) }, blanks: Object.fromEntries(out.map((v, i) => [`${i},1`, `"${v}"`])), tiles: [`"${b}"`, `"${other[1]}"`],
        explain: 'recode swaps each old value for its new one: "old" = "new".', rcheck: [{ setup: `data = data.frame(cond = ${rvec(vals)})`, expr: `data %>% mutate(cond = recode(cond, "${a}" = "${b}", "${other[0]}" = "${other[1]}"))`, expect: dfSpec(['cond'], out.map(v => [v])) }] });
    }),
  ],
};

// ======================================================================
// Unit 15: group_by and summarise
// ======================================================================
const UT5 = {
  id: 't5', part: 2, title: 'Unit 15: group_by and summarise', intro: 'group_by() only labels rows by group. summarise() is what collapses them.',
  subs: [
    tutorial('t5-first', 'group_by labels', 'Run group_by', 'group_by(subj) marks which rows belong together, and changes nothing else.', ctx => {
      const r = ctx.rng, t = genData(r);
      return E.belt(ctx, { prompt: 'Press Run and watch the table. Count the rows before and after.', table: t, head: 'data', steps: [S.group_by('subj')], done: 'Same rows, same columns. The coloured letter on each row just says which group it is in. group_by() collapses nothing.' });
    }),
    streak('t5-alone', 'group_by alone', 'How many rows?', 'group_by() only labels the rows by group. It collapses nothing, so the row count does not change.', ctx => rowQuestion(ctx, ['group', 'group', 'group2', 'filter-group', 'filter-score', 'group-summ', 'group2-summ']), { target: 10 }),
    streak('t5-boxes', 'Rows into boxes', 'Sort rows by group', 'summarise() gives one row for each box. Sort each row into its group, then count the boxes.', ctx => {
      const r = ctx.rng, t = genData(r), groups = [...new Set(t.rows.map(x => x[0]))].sort();
      const steps = [S.group_by('subj'), S.summarise('n', 'n()', g => g.length)];
      return E.sort(ctx, { prompt: 'Put each row in the box of its <code>subj</code> group.', lead: pipeLines(steps), rows: t.rows.map((x, i) => ({ label: `${x[0]} ${x[1]} ${x[2]}`, group: x[0] })), groups,
        explain: () => `${groups.length} boxes, so summarise returns ${groups.length} rows, one per box, here with n = ${groups.map(g => t.rows.filter(x => x[0] === g).length).join(', ')}.`, rcheck: [pipeCheck(t, steps)] });
    }),
    streak('t5-summ', 'After summarise', 'How many rows?', 'summarise() gives one row per group (one row in all if there are no groups). Rows that were dropped by an earlier filter cannot form a group.', ctx => rowQuestion(ctx, ['group-summ', 'group2-summ', 'summ-all', 'filter-group-summ', 'group-summ']), { target: 10 }),
    streak('t5-n', 'Counting with n()', 'Fill the group sizes', 'n() counts the rows in the current group.', ctx => {
      const r = ctx.rng, t = genData(r), groups = [...new Set(t.rows.map(x => x[0]))].sort(), counts = groups.map(g => t.rows.filter(x => x[0] === g).length);
      const steps = [S.group_by('subj'), S.summarise('n', 'n()', g => g.length)];
      return E.fill(ctx, { prompt: 'Fill in n for each group.', lead: pipeLines(steps), pic: Grid({ data: [t.rows.map(x => x[0])], label: 'the subj column: ' + t.rows.map(x => x[0]).join(' '), cellW: 44, compact: true, rowHead: ['subj'] }).wrap, grid: { data: groups.map(g => [`"${g}"`, '']), head: ['subj', 'n'], rowHead: groups.map(() => '') }, blanks: Object.fromEntries(counts.map((c, i) => [`${i},1`, String(c)])), tiles: ['1', '2', '3', '4'],
        explain: `Each group's n is how many rows carry its letter: ${groups.map((g, i) => g + ' ' + counts[i]).join(', ')}.`, rcheck: [pipeCheck(t, steps)] });
    }),
    streak('t5-nfn', 'n() or nrow()?', 'Inside a group', 'Inside group_by, n() counts the rows of the current group. nrow(data) always counts every row of the whole table.', ctx => {
      const r = ctx.rng, t = genData(r), f = RG.pick(r, ['n_trials', 'n_rows', 'trials']);
      const steps = [S.group_by('subj'), S.mutate(f, 'n()', (o, g) => g.length)];
      return E.assemble(ctx, { prompt: 'Count how many trials each subject has, in a new column.', lines: [['data %>%'], ['  group_by(subj) %>%'], [`  mutate(${f} = `, { slot: 'f' }, ')']], tiles: ['n()', 'nrow(data)', 'length', 'count'], answer: { f: 'n()' }, why: { f: { 'nrow(data)': 'nrow(data) counts every row of the whole table, so every group would get the same number.', '*': 'Inside a group, n() counts that group\'s rows.' } },
        explain: 'n() is the size of the current group.', rcheck: [pipeCheck(t, steps)] });
    }),
    streak('t5-narm', 'Missing values', 'na.rm = TRUE', 'mean() of a group with an NA is NA. mean(score, na.rm = TRUE) leaves the NA out.', ctx => {
      const r = ctx.rng, f = RG.pick(r, ['sum', 'max', 'mean']), nm = { sum: 'total', max: 'top', mean: 'avg' }[f];
      return E.assemble(ctx, { prompt: 'Ignore the missing scores.', lines: [['data %>%'], ['  group_by(subj) %>%'], [`  summarise(${nm} = ${f}(score`, { slot: 'a' }, ' ', { slot: 'b' }, ' = ', { slot: 'c' }, '))']], tiles: [',', 'na.rm', 'TRUE', 'FALSE', 'NA'], answer: { a: ',', b: 'na.rm', c: 'TRUE' }, why: { c: { FALSE: 'na.rm = FALSE keeps the NA.', '*': 'na.rm = TRUE removes them.' }, b: { '*': 'The input is called na.rm.' } },
        explain: `${f}(score, na.rm = TRUE) skips the NA values.`, rcheck: [{ setup: 'data = data.frame(subj = c("A","A","B","B"), score = c(1, NA, 3, 4))', expr: `data %>% group_by(subj) %>% summarise(${nm} = ${f}(score, na.rm = TRUE))`, expect: dfSpec(['subj', nm], [['A', 1], ['B', f === 'sum' ? 7 : f === 'max' ? 4 : 3.5]]) }] });
    }),
  ],
};

// ======================================================================
// Unit 16: mutate vs summarise
// ======================================================================
const UT6 = {
  id: 't6', part: 2, title: 'Unit 16: mutate or summarise?', intro: 'Same group_by, different result: mutate keeps every row, summarise collapses them.',
  subs: [
    tutorial('t6-first', 'mutate inside a group', 'Run it', 'group_by then mutate keeps every row and repeats the group value.', ctx => {
      const r = ctx.rng, t = genData(r);
      return E.belt(ctx, { prompt: 'Press Run for each step. Watch the row count.', table: t, head: 'data', steps: [S.group_by('subj'), S.mutate('total', 'sum(score)', (o, g) => sumOf(g))], done: 'After group_by, mutate worked out each group\'s total and wrote it on every row of that group. Still the same rows.' });
    }),
    streak('t6-repeat', 'Group value, every row', 'Fill the repeated total', 'Inside group_by, mutate computes one value per group and puts it on every row of the group.', ctx => {
      const r = ctx.rng, t = genData(r), steps = [S.group_by('subj'), S.mutate('n', 'n()', (o, g) => g.length)], out = runSteps(t, steps);
      return E.fill(ctx, { prompt: 'Fill the new column <code>n</code>: the size of each row\'s group.', lead: pipeLines(steps), grid: { data: t.rows.map(x => [x[0], '']), head: ['subj', 'n'], rowHead: t.rows.map((_, i) => String(i + 1)) }, blanks: Object.fromEntries(out.rows.map((x, i) => [`${i},1`, String(x[3])])), tiles: ['1', '2', '3'],
        explain: 'Every row gets its own group\'s size.', rcheck: [pipeCheck(t, steps)] });
    }),
    streak('t6-which', 'Which verb?', 'Keep every row, or one per group?', 'After group_by: mutate keeps all the rows and adds a column; summarise gives one row per group.', ctx => {
      const r = ctx.rng, keep = r() < .5;
      return E.assemble(ctx, { prompt: keep ? 'Keep <b>every trial</b> and add each subject\'s total to it.' : 'Get <b>one row per subject</b>: their total.', lines: [['data %>%'], ['  group_by(subj) %>%'], ['  ', { slot: 'v' }, '(total = sum(score))']], tiles: ['mutate', 'summarise', 'filter', 'select'], answer: { v: keep ? 'mutate' : 'summarise' },
        why: { v: { mutate: 'mutate keeps every row. One row per subject needs summarise.', summarise: 'summarise collapses to one row per group. To keep every trial use mutate.', '*': 'This needs mutate or summarise.' } }, explain: keep ? 'mutate keeps all the trial rows.' : 'summarise gives one row per subject.',
        rcheck: [(() => { const t = genData(RG.mulberry32(3)); const st = [S.group_by('subj'), keep ? S.mutate('total', 'sum(score)', (o, g) => sumOf(g)) : S.summarise('total', 'sum(score)', g => sumOf(g))]; return pipeCheck(t, st); })()] });
    }),
    streak('t6-rows', 'Predict the rows', 'The big drill', 'Follow the table through each step. filter can drop rows, mutate and group_by never do, summarise gives one row per group.', ctx => rowQuestion(ctx, Object.keys(KINDS)), { target: 10 }),
    streak('t6-level', 'One row is one what?', 'The level at the end', 'The last summarise decides what a row is: one row per group of the variables you grouped by. With no summarise, a row is still a trial.', ctx => {
      const r = ctx.rng, t = RG.int(r, 0, 3);
      const cs = [
        { code: ['data %>%', '  group_by(subj) %>%', '  summarise(m = mean(score))'], ans: 'a subject' },
        { code: ['data %>%', '  group_by(subj, cond) %>%', '  summarise(m = mean(score))'], ans: 'a subject in a condition' },
        { code: ['data %>%', '  group_by(subj) %>%', '  mutate(m = mean(score))'], ans: 'a trial' },
        { code: ['data %>%', '  group_by(subj, cond) %>%', '  summarise(m = mean(score)) %>%', '  group_by(cond) %>%', '  summarise(m = mean(m))'], ans: 'a condition' },
      ][t];
      const t0 = genData(r);
      return E.choice(ctx, { prompt: 'At the end, one row is...', lead: cs.code, options: ['a trial', 'a subject', 'a subject in a condition', 'a condition'], answer: cs.ans, explain: `The last step that collapsed rows grouped by ${{ 'a subject': 'subj', 'a subject in a condition': 'subj and cond', 'a trial': 'nothing (mutate keeps every trial)', 'a condition': 'cond' }[cs.ans]}.`, rcheck: [] });
    }),
  ],
};

// ======================================================================
// Unit 17: arrange, count, distinct
// ======================================================================
const UT7 = {
  id: 't7', part: 2, title: 'Unit 17: arrange, count, distinct', intro: 'Sort rows, count combinations, drop repeats.',
  subs: [
    tutorial('t7-first', 'arrange sorts', 'Run arrange', 'arrange(score) puts the rows in order of score.', ctx => {
      const r = ctx.rng, t = genData(r);
      return E.belt(ctx, { prompt: 'Press Run. Do the rows change, or just their order?', table: t, head: 'data', steps: [S.arrange('score', o => o.score)], done: 'Same rows, new order: smallest score first. arrange never adds or removes rows.' });
    }),
    streak('t7-arrange', 'Which row is first?', 'arrange and desc()', 'arrange(score) puts the smallest first. arrange(desc(score)) puts the largest first.', ctx => {
      const r = ctx.rng, t = genData(r), desc = r() < .5, vals = t.rows.map(x => x[2]), target = desc ? Math.max(...vals) : Math.min(...vals), idx = vals.indexOf(target);
      if (vals.filter(v => v === target).length > 1) return UT7.subs[1].build(ctx);
      return E.pick(ctx, { prompt: `After <code>arrange(${desc ? 'desc(score)' : 'score'})</code>, which row is on top? Tap it.`, mode: 'row', single: true, grid: { data: t.rows.map(x => x.map(String)), head: t.cols, rowHead: t.rows.map((_, i) => String(i + 1)) }, answer: [idx], explain: desc ? 'desc() reverses the order: the biggest score first.' : 'The smallest score comes first.',
        rcheck: [pipeCheck(t, [S.arrange(desc ? 'desc(score)' : 'score', o => o.score, desc)])] });
    }),
    streak('t7-rows', 'count and distinct', 'How many rows?', 'count(a, b) and distinct(a, b) both give one row for each combination of a and b that actually occurs.', ctx => rowQuestion(ctx, ['count', 'count2', 'distinct', 'count2', 'group2-summ']), { target: 10 }),
  ],
};

// ======================================================================
// Unit 18: joins
// ======================================================================
function genJoin(r) {
  const keys = RG.sample(r, ['A', 'B', 'C', 'D', 'E'], 4), left = keys.slice(0, 3).map(k => [k, RG.int(r, 1, 9)]);
  const rkeys = RG.shuffle(r, [keys[0], keys[1], keys[3]]), dupe = r() < .4 ? RG.pick(r, [keys[0], keys[1]]) : null;
  const right = rkeys.map(k => [k, RG.int(r, 20, 60)]); if (dupe) right.push([dupe, RG.int(r, 20, 60)]);
  return { left, right };
}
const joinOut = (left, right, how) => {
  const rows = [];
  left.forEach(([k, a]) => { const ms = right.filter(x => x[0] === k); if (how === 'anti') { if (!ms.length) rows.push([k, a]); } else if (ms.length) ms.forEach(m => rows.push([k, a, m[1]])); else if (how === 'left') rows.push([k, a, null]); });
  return rows;
};
const UT8 = {
  id: 't8', part: 2, title: 'Unit 18: joins', intro: 'A join adds columns by matching rows on a key.',
  subs: [
    tutorial('t8-first', 'Match the key', 'Join the matching columns', 'A key is a column that identifies the same thing in two tables.', ctx =>
      E.match(ctx, { prompt: 'Both tables have a column for the same thing: the person. Tap one on the left, then its partner on the right.', left: ['subj'], right: ['subj'], pairs: [[0, 0]], tutorial: true, done: 'That shared column is the key. A join lines up rows that have the same key.' })),
    streak('t8-lines', 'Match the rows', 'Link each row to its partner', 'A join pairs each left row with the right rows that have the same key. A left row with no partner stays unlinked.', ctx => {
      const r = ctx.rng, { left, right } = genJoin(r), dupeless = right.length === 3;
      if (!dupeless) return UT8.subs[1].build(ctx);
      const pairs = []; left.forEach(([k], i) => { const j = right.findIndex(x => x[0] === k); if (j >= 0) pairs.push([i, j]); });
      return E.match(ctx, { prompt: 'Link each left row to the right row with the same key. Leave a row alone if it has no partner.', left: left.map(x => `${x[0]} ${x[1]}`), right: right.map(x => `${x[0]} ${x[1]}`), pairs, partial: true, explain: () => `${pairs.length} of ${left.length} left rows have a partner. In left_join the others stay, with NA in the new column.`,
        lead: el('div', { class: 'note' }, 'left: key and x    right: key and age'), rcheck: [] });
    }),
    streak('t8-rows', 'Rows after a join', 'How many rows?', 'left_join keeps every left row (and repeats it for each match). inner_join keeps only rows that match. anti_join keeps the rows with no match.', ctx => {
      const r = ctx.rng, { left, right } = genJoin(r), how = RG.pick(r, ['left', 'inner', 'anti', 'left']), out = joinOut(left, right, how === 'inner' ? 'inner' : how);
      if (!out.length) return UT8.subs[2].build(ctx);
      const fn = how + '_join'; const names = how === 'anti' ? ['k', 'x'] : ['k', 'x', 'age'];
      const pic = el('div', { class: 'foldwrap' }, tableGrid(TD(['k', 'x'], left.map(x => x.map(String)), [])).wrap, tableGrid(TD(['k', 'age'], right.map(x => x.map(String)), [])).wrap);
      return E.count(ctx, { prompt: 'How many rows does the result have?', lead: [`left %>% ${fn}(right, by = "k")`], pic, after: () => tableGrid(TD(names, out.map(x => x.map(v => v == null ? 'NA' : String(v))), [])).wrap, answer: out.length, max: 6, inputRows: left.length,
        explain: how === 'left' ? `Every left row stays; a key matched twice makes two rows: ${out.length}.` : how === 'inner' ? `Only keys found in both tables stay: ${out.length}.` : `anti_join keeps the left rows with no match: ${out.length}.`,
        rcheck: [{ setup: `left = data.frame(k = ${rvec(left.map(x => x[0]))}, x = ${rvec(left.map(x => x[1]))})\nright = data.frame(k = ${rvec(right.map(x => x[0]))}, age = ${rvec(right.map(x => x[1]))})`, expr: `left %>% ${fn}(right, by = "k")`, expect: dfSpec(names, out.map(x => x.map(v => v))) }] });
    }, { target: 10 }),
    streak('t8-by', 'Different key names', 'by = c("left" = "right")', 'When the key has different names, by = c("name in the left table" = "name in the right table"). The left table comes first.', ctx => {
      const r = ctx.rng, [lk, rk] = RG.pick(r, [['subject', 'participant'], ['subj', 'id'], ['child', 'pupil']]), lcol = RG.pick(r, ['age', 'score']);
      return E.assemble(ctx, { prompt: 'Join <code>wm</code> onto <code>data</code>, matching the person columns.', lead: [`data has: ${lk}, ${lcol}`, `wm has: ${rk}, wm_score`], lines: [['data %>%'], ['  left_join(wm, by = c(', { slot: 'a' }, ' = ', { slot: 'b' }, '))']], tiles: [`"${lk}"`, `"${rk}"`, `"${lcol}"`, '"wm_score"'], answer: { a: `"${lk}"`, b: `"${rk}"` },
        why: { a: { [`"${rk}"`]: 'The left side of = names the column in the left table (data).', '*': 'The left side of = is the key column in the left table, data.' }, b: { [`"${lk}"`]: 'The right side of = names the column in the right table (wm).', '*': 'The right side of = is the key column in the right table, wm.' } },
        explain: `by = c("${lk}" = "${rk}"): left table's name, then right table's name.`, rcheck: [{ setup: `data = data.frame(${lk} = c("A","B"), ${lcol} = c(1, 2))\nwm = data.frame(${rk} = c("B","A"), wm_score = c(10, 20))`, expr: `data %>% left_join(wm, by = c("${lk}" = "${rk}"))`, expect: dfSpec([lk, lcol, 'wm_score'], [['A', 1, 20], ['B', 2, 10]]) }] });
    }),
    streak('t8-which', 'Join or stack?', 'Sideways or downwards', 'Joins go sideways, adding columns by matching a key. bind_rows goes downwards, stacking rows of the same kind. anti_join keeps rows with no match.', ctx => {
      const r = ctx.rng, t = RG.int(r, 0, 3);
      const cs = [{ p: 'Add the columns of <code>y</code>, matching on id, and keep <b>all</b> rows of x.', a: 'left_join' }, { p: 'Put the rows of <code>y</code> <b>underneath</b> x. Same columns, more people.', a: 'bind_rows' }, { p: 'Keep only the rows of x that have <b>no match</b> in y.', a: 'anti_join' }, { p: 'Keep only the rows of x that <b>do match</b> y, with y\'s columns added.', a: 'inner_join' }][t];
      return E.choice(ctx, { prompt: cs.p, options: ['left_join', 'inner_join', 'anti_join', 'bind_rows'], answer: cs.a, code: true, explain: { left_join: 'left_join keeps every left row and adds columns.', bind_rows: 'bind_rows stacks rows: it does not match on a key.', anti_join: 'anti_join keeps the left rows with no match.', inner_join: 'inner_join keeps rows found in both.' }[cs.a], rcheck: [{ kind: 'exists', fns: [cs.a] }] });
    }, { target: 10 }),
  ],
};

// ======================================================================
// Unit 19: pivots
// ======================================================================
const wideLong = (r, n = 3) => {
  const [a, b] = RG.pick(r, [['coffee', 'tea'], ['pre', 'post'], ['left', 'right']]), ids = Array.from({ length: n }, (_, i) => i + 1);
  const wide = ids.map(i => [i, RG.int(r, 0, 1), RG.int(r, 0, 1)]);
  const long = ids.flatMap((i, k) => [[i, a, wide[k][1]], [i, b, wide[k][2]]]);
  return { a, b, wide, long, ids };
};
const UT9 = {
  id: 't9', part: 2, title: 'Unit 19: pivots', intro: 'pivot_longer folds columns down into rows. pivot_wider spreads rows out into columns.',
  subs: [
    tutorial('t9-first', 'Fold the columns', 'Watch pivot_longer', 'pivot_longer turns column headers into values of a new column.', ctx => {
      const r = ctx.rng, w = wideLong(r, 2), cols = ['id', w.a, w.b];
      return E.fold(ctx, { prompt: 'Press the button and watch the two columns fold down into rows.', wide: TD(cols, w.wide), long: TD(['id', 'drink', 'liked'], w.long), foldCols: [w.a, w.b], done: 'The headers became values of a new column; the 0/1 values became one column. Two rows became four: 2 people x 2 columns.' });
    }),
    streak('t9-longer', 'pivot_longer', 'Fill the call', 'pivot_longer(cols = the columns to fold, names_to = a name for the new column of headers, values_to = a name for the column of values). The new names are text, so in quotes.', ctx => {
      const r = ctx.rng, w = wideLong(r, 2), nt = RG.pick(r, ['drink', 'when', 'side']), vt = RG.pick(r, ['liked', 'score', 'n']);
      const g = Grid({ data: w.long.slice(0, 2).map(x => x.map(String)), head: ['id', nt, vt], compact: true, label: `long table with columns id, ${nt}, ${vt}; first person: ${w.long.slice(0, 2).map(x => x.join(' ')).join('; ')}` });
      return E.assemble(ctx, { prompt: `Fold <code>${w.a}</code> and <code>${w.b}</code> into the long table shown (first person only).`, pic: g.wrap, lines: [['data %>% pivot_longer('], ['cols = ', { slot: 'a' }, ','], ['names_to = ', { slot: 'b' }, ','], ['values_to = ', { slot: 'c' }, ')']], tiles: [`c(${w.a}, ${w.b})`, 'c(id)', `"${nt}"`, `"${vt}"`, nt], answer: { a: `c(${w.a}, ${w.b})`, b: `"${nt}"`, c: `"${vt}"` },
        why: { a: { 'c(id)': 'id stays as it is. Fold the two columns that hold the values.', '*': 'cols are the columns to fold down.' }, b: { [nt]: 'The new column\'s name is given as text, in quotes.', '*': `names_to is the new column that holds the old headers: ${nt}.` }, c: { '*': `values_to is the column that holds the values: ${vt}.` } },
        explain: `The headers ${w.a} and ${w.b} become values of "${nt}"; the numbers go to "${vt}".`, rcheck: [{ setup: `data = data.frame(id = ${rvec(w.ids)}, ${w.a} = ${rvec(w.wide.map(x => x[1]))}, ${w.b} = ${rvec(w.wide.map(x => x[2]))})`, expr: `data %>% pivot_longer(cols = c(${w.a}, ${w.b}), names_to = "${nt}", values_to = "${vt}")`, expect: dfSpec(['id', nt, vt], w.long) }] });
    }, { target: 10 }),
    streak('t9-rows', 'Rows after a pivot', 'How many rows?', 'pivot_longer makes (rows) x (columns folded) rows. pivot_wider makes one row per different id.', ctx => {
      const r = ctx.rng, n = RG.int(r, 2, 3), k = RG.int(r, 2, 3), longer = r() < .6;
      const cn = ['a', 'b', 'c'].slice(0, k);
      if (longer) {
        const wide = Array.from({ length: n }, (_, i) => [i + 1, ...cn.map(() => RG.int(r, 0, 1))]);
        return E.count(ctx, { prompt: 'How many rows does the result have?', lead: [`data %>% pivot_longer(cols = c(${cn.join(', ')}),`, '  names_to = "key", values_to = "val")'], pic: tableGrid(TD(['id', ...cn], wide.map(x => x.map(String)), [])).wrap, after: () => tableGrid(TD(['id', 'key', 'val'], wide.flatMap(x => cn.map((c, j) => [x[0], c, x[j + 1]])).slice(0, 6).map(x => x.map(String)), [])).wrap, answer: n * k, max: 6, inputRows: n, explain: `${n} rows x ${k} folded columns = ${n * k} rows.`,
          rcheck: [{ setup: `data = data.frame(id = ${rvec(wide.map(x => x[0]))}, ${cn.map((c, j) => `${c} = ${rvec(wide.map(x => x[j + 1]))}`).join(', ')})`, expr: `data %>% pivot_longer(cols = c(${cn.join(', ')}), names_to = "key", values_to = "val")`, expect: dfSpec(['id', 'key', 'val'], wide.flatMap(x => cn.map((c, j) => [x[0], c, x[j + 1]]))) }] });
      }
      const long = Array.from({ length: n }, (_, i) => i + 1).flatMap(i => cn.map(c => [i, c, RG.int(r, 0, 1)]));
      if (long.length > 6) return UT9.subs[2].build(ctx);
      return E.count(ctx, { prompt: 'How many rows does the result have?', lead: ['data %>% pivot_wider(names_from = key,', '  values_from = val)'], pic: tableGrid(TD(['id', 'key', 'val'], long.map(x => x.map(String)), [])).wrap, after: () => tableGrid(TD(['id', ...cn], Array.from({ length: n }, (_, i) => [i + 1, ...cn.map(c => long.find(x => x[0] === i + 1 && x[1] === c)[2])].map(String)), [])).wrap, answer: n, max: 6, inputRows: long.length, explain: `One row per different id: ${n}. The ${k} keys become columns.`,
        rcheck: [{ setup: `data = data.frame(id = ${rvec(long.map(x => x[0]))}, key = ${rvec(long.map(x => x[1]))}, val = ${rvec(long.map(x => x[2]))})`, expr: 'data %>% pivot_wider(names_from = key, values_from = val)', expect: dfSpec(['id', ...cn], Array.from({ length: n }, (_, i) => [i + 1, ...cn.map(c => long.find(x => x[0] === i + 1 && x[1] === c)[2])])) }] });
    }, { target: 10 }),
    streak('t9-wider', 'pivot_wider', 'Fill the call', 'pivot_wider(names_from = the column whose values become headers, values_from = the column of values). These are existing column names, so no quotes.', ctx => {
      const r = ctx.rng, w = wideLong(r, 2), nt = RG.pick(r, ['drink', 'when', 'side']), vt = RG.pick(r, ['liked', 'score', 'n']);
      const g = Grid({ data: w.wide.map(x => x.map(String)), head: ['id', w.a, w.b], compact: true, label: 'wide table to produce' });
      return E.assemble(ctx, { prompt: 'Which call spreads this long table into the wide one shown?', lead: [`data has columns id, ${nt}, ${vt}`], pic: g.wrap, lines: [['data %>% pivot_wider('], ['  names_from = ', { slot: 'a' }, ','], ['  values_from = ', { slot: 'b' }, ')']], tiles: [nt, vt, 'id', `"${nt}"`], answer: { a: nt, b: vt },
        why: { a: { [`"${nt}"`]: 'These are existing columns, so no quotes here.', [vt]: `The headers ${w.a} and ${w.b} come from ${nt}.`, id: 'id is the key that identifies each row; the new headers come from another column.', '*': `The new headers (${w.a}, ${w.b}) come from ${nt}.` }, b: { '*': `The numbers come from ${vt}.` } },
        explain: `names_from = ${nt} gives the new headers; values_from = ${vt} fills the cells.`, rcheck: [{ setup: `data = data.frame(id = ${rvec(w.long.map(x => x[0]))}, ${nt} = ${rvec(w.long.map(x => x[1]))}, ${vt} = ${rvec(w.long.map(x => x[2]))})`, expr: `data %>% pivot_wider(names_from = ${nt}, values_from = ${vt})`, expect: dfSpec(['id', w.a, w.b], w.wide) }] });
    }, { target: 10 }),
  ],
};

// ======================================================================
// Unit 20: whole pipelines
// ======================================================================
const TRANS = [['subset(df, a > 3)', 'filter()'], ['ddply(df, .(g), summarize, ...)', 'group_by() + summarise()'], ['df$new = df$a / 12', 'mutate()'], ['match(x, y)', 'left_join()'], ['melt(df)', 'pivot_longer()'], ['rbind(df1, df2)', 'bind_rows()'], ['df[order(df$a), ]', 'arrange()']];
const UT10 = {
  id: 't10', part: 2, title: 'Unit 20: Whole pipelines', intro: 'Read a pipeline from top to bottom, and translate your old base R.',
  subs: [
    streak('t10-order', 'Write from a description', 'Steps in order', 'Say what you want in order: which rows, which new columns, which groups, then what to summarise.', ctx => {
      const r = ctx.rng, t = genData(r), k = RG.int(r, 3, 5), cs = RG.int(r, 0, 2);
      const cases = [
        { p: `Keep scores over ${k}, then count the rows for each subject.`, steps: [S.filter(`score > ${k}`, o => o.score > k), S.group_by('subj'), S.summarise('n', 'n()', g => g.length)] },
        { p: 'Add each subject\'s total to every trial, then keep only the trials of subject A.', steps: [S.group_by('subj'), S.mutate('total', 'sum(score)', (o, g) => sumOf(g)), S.filter('subj == "A"', o => o.subj === 'A')] },
        { p: `Make a column <code>big</code> (score over ${k}), then count rows for each value of big.`, steps: [S.mutate('big', `score > ${k}`, o => o.score > k), S.count('big')] },
      ][cs];
      const out = runSteps(t, cases.steps); if (!out.rows.length) return UT10.subs[0].build(ctx);
      const n = cases.steps.length, ids = ['a', 'b', 'c', 'd'].slice(0, n);
      const extras = ['arrange(score)', 'select(subj)'];
      return E.assemble(ctx, { prompt: cases.p, lines: [['data %>%'], ...ids.map((s, i) => [' ', { slot: s }, i < n - 1 ? ' %>%' : ''])], tiles: [...cases.steps.map(s => s.code), ...extras], answer: Object.fromEntries(ids.map((s, i) => [s, cases.steps[i].code])),
        why: Object.fromEntries(ids.map(s => [s, { '*': 'Check the order: a step can only use columns and groups that the steps above it made.' }])), explain: 'Each step feeds the next: "and then".', rcheck: [pipeCheck(t, cases.steps)] });
    }),
    streak('t10-translate', 'Old habit, tidy verb', 'Match base R to tidy', 'subset() is filter(), ddply is group_by() + summarise(), $ assignments are mutate(), match is a join, melt is pivot_longer, rbind is bind_rows, order is arrange.', ctx => {
      const r = ctx.rng, pick = RG.sample(r, TRANS, 4), right = RG.shuffle(r, pick.map(x => x[1]));
      return E.match(ctx, { prompt: 'Match each old base R habit with its tidy replacement.', left: pick.map(x => x[0]), right, pairs: pick.map((x, i) => [i, right.indexOf(x[1])]), explain: 'The tidy verbs do the same jobs with one consistent shape: data %>% verb(...).', rcheck: [{ kind: 'exists', fns: ['filter', 'group_by', 'summarise', 'mutate', 'left_join', 'pivot_longer', 'bind_rows', 'arrange'] }] });
    }, { target: 10 }),
    streak('t10-fix', 'Concept right, syntax slip', 'Tap the slip', 'Typical slips: by( instead of by =, a test inside select(), nrow(data) for n(), mutate(x = x) that computes nothing.', ctx => {
      const r = ctx.rng, t = RG.int(r, 0, 3);
      const cases = [
        { toks: ['data %>% left_join(wm, ', 'by("subj" = "id")', ')'], ans: 1, why: 'It is by = c("subj" = "id"): by is an input name, followed by =, and a pair needs c().', diff: null },
        { toks: ['data %>% ', 'select(cond == "x")'], ans: 1, why: 'select chooses columns by name. To keep rows where cond is x, use filter(cond == "x").' },
        { toks: ['data %>% group_by(subj) %>% mutate(n_trials = ', 'nrow(data)', ')'], ans: 1, why: 'nrow(data) counts every row of the whole table. Inside a group, n() counts the group\'s rows.' },
        { toks: ['data %>% group_by(subj) %>% mutate(', 'mean_resp = mean_resp', ')'], ans: 1, why: 'mean_resp = mean_resp computes nothing. It needs mean(resp).' },
      ][t];
      return E.pick(ctx, { prompt: 'The idea is right but one part is wrong. Tap it.', mode: 'token', single: true, items: cases.toks, answer: [cases.ans], explain: cases.why, rcheck: [] });
    }),
  ],
};

// ======================================================================
// Unit 21: ggplot2
// ======================================================================
function chartPic(kind) {
  const ax = '<line x1="30" y1="10" x2="30" y2="100" stroke="#12323a" stroke-width="3"/><line x1="30" y1="100" x2="190" y2="100" stroke="#12323a" stroke-width="3"/>';
  const body = {
    col: '<rect x="45" y="60" width="28" height="40" fill="#14565e"/><rect x="85" y="30" width="28" height="70" fill="#14565e"/><rect x="125" y="50" width="28" height="50" fill="#14565e"/>',
    point: '<circle cx="55" cy="70" r="7" fill="#b5451b"/><circle cx="85" cy="45" r="7" fill="#b5451b"/><circle cx="120" cy="60" r="7" fill="#b5451b"/><circle cx="155" cy="25" r="7" fill="#b5451b"/>',
    line: '<polyline points="45,80 85,45 125,62 165,25" fill="none" stroke="#1f6f93" stroke-width="5"/>',
    hist: '<rect x="45" y="75" width="22" height="25" fill="#5b7a1a"/><rect x="67" y="35" width="22" height="65" fill="#5b7a1a"/><rect x="89" y="20" width="22" height="80" fill="#5b7a1a"/><rect x="111" y="50" width="22" height="50" fill="#5b7a1a"/><rect x="133" y="85" width="22" height="15" fill="#5b7a1a"/>',
  }[kind];
  const name = { col: 'a bar chart with three bars of different heights', point: 'a scatter of four dots', line: 'a line joining four points', hist: 'a histogram: five touching bars, tall in the middle' }[kind];
  return svg(200, 110, ax + body, name);
}
const UT11 = {
  id: 't11', part: 2, title: 'Unit 22: ggplot2', intro: 'A plot is built in layers joined with +.',
  subs: [
    tutorial('t11-first', 'Add a layer', 'Plus adds layers', 'ggplot() starts the plot; + adds a layer such as geom_point().', ctx =>
      E.assemble(ctx, { prompt: 'A plot is built in layers. The layers are joined with a <b>+</b>. Add the plus.', pic: chartPic('point'), parts: ['ggplot(data, aes(x, y)) ', { slot: 'p' }, ' geom_point()'], tiles: ['+'], answer: { p: '+' }, tutorial: true, done: 'ggplot() makes the empty plot; + geom_point() adds a layer of dots. Layers are joined with +, never a pipe.' })),
    streak('t11-plus', 'Plus or pipe?', 'Layers use +', 'Data steps are joined with %>% ("and then"). Plot layers are joined with +. A pipe can feed data into ggplot(), but layers still use +.', ctx => {
      const r = ctx.rng, g = RG.pick(r, ['geom_point()', 'geom_col()', 'geom_line()']), kind = RG.int(r, 0, 1);
      const cfg = kind === 0 ? { p: 'Add a layer to the plot.', parts: ['ggplot(data, aes(x, y)) ', { slot: 'p' }, ' ' + g], a: '+' } : { p: 'Feed <code>data</code> into the plot.', parts: ['data ', { slot: 'p' }, ' ggplot(aes(x, y)) + ' + g], a: ['%>%', '|>'] };
      return E.assemble(ctx, { prompt: cfg.p, parts: cfg.parts, tiles: ['+', '%>%', ',', '|>', '='], answer: { p: cfg.a }, why: { p: { '%>%': 'A pipe passes data on. Layers of a plot are added with +.', '|>': 'A pipe passes data on. Layers of a plot are added with +.', '+': 'Data goes into ggplot() with a pipe; + is for layers.', '*': kind === 0 ? 'Layers are added with +.' : 'Data is piped in with %>%.' } }, explain: kind === 0 ? 'Layers join with +.' : 'Data goes in with a pipe, layers join with +.', rcheck: [{ kind: 'syntax', code: kind === 0 ? `ggplot(data, aes(x, y)) + ${g}` : `data %>% ggplot(aes(x, y)) + ${g}` }] });
    }),
    streak('t11-geom', 'Which geom draws it?', 'Match the picture', 'geom_col draws bars of a given height, geom_point dots, geom_line a line through the points, geom_histogram bars that count how many values fall in each range.', ctx => {
      const r = ctx.rng, k = RG.pick(r, ['col', 'point', 'line', 'hist']), nm = { col: 'geom_col', point: 'geom_point', line: 'geom_line', hist: 'geom_histogram' }[k];
      return E.choice(ctx, { prompt: 'Which layer draws this?', pic: chartPic(k), options: ['geom_col', 'geom_point', 'geom_line', 'geom_histogram'], answer: nm, code: true, explain: `${nm} draws this kind of picture.`, rcheck: [{ kind: 'exists', fns: [nm] }] });
    }),
    streak('t11-aes', 'What goes where?', 'aes() maps columns', 'aes(x = ..., y = ...) says which column goes along the bottom and which up the side. The names are columns, so no quotes.', ctx => {
      const r = ctx.rng, [xc, yc] = RG.pick(r, [['cond', 'score'], ['group', 'rt'], ['age', 'acc']]);
      return E.assemble(ctx, { prompt: `Put <b>${xc}</b> along the bottom and <b>${yc}</b> up the side.`, lead: [`data has columns ${xc}, ${yc}, subj`], parts: ['ggplot(data, aes(x = ', { slot: 'x' }, ', y = ', { slot: 'y' }, '))'], tiles: [xc, yc, 'subj', `"${xc}"`], answer: { x: xc, y: yc },
        why: { x: { [`"${xc}"`]: 'aes() takes column names, not text in quotes.', '*': `x is the horizontal axis: ${xc}.` }, y: { '*': `y is the vertical axis: ${yc}.` } }, explain: `aes(x = ${xc}, y = ${yc})`, rcheck: [{ kind: 'syntax', code: `ggplot(data, aes(x = ${xc}, y = ${yc}))` }] });
    }),
  ],
};

const UNITS_P2 = [UT0, UT1, UT2, UT3, UT4, UT5, UT6, UT7, UT8, UT9, UT10, UT11];

// ---- "where do I start?": the first miss decides; the unit before the missed item's unit is the start (conservative) ----
const subOf = id => [...UNITS_P1, ...UNITS_P2].flatMap(u => u.subs).find(s => s.id === id);
const unitIdx = id => [...UNITS_P1, ...UNITS_P2].findIndex(u => u.subs.some(s => s.id === id));
const PLACEMENT = ['u0-which', 'u2-over', 'u3-call', 'u5-cond', 'u6-cell', 'u8-eachtimes', 'u9-which', 't2-keep', 't6-rows', 't8-by'].map((id, i, arr) => ({ id, unit: i === 0 ? 0 : unitIdx(arr[i - 1]) + 1, build: ctx => subOf(id).build(ctx) }));
