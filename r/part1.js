// Part 1: base R. Content only; the activities live in engine.js.
// Every generator attaches `rcheck` records so tools/check-r.R can run the same code in real R and compare.
const PARTS = {
  1: { title: 'Part 1: Base R', blurb: 'From your first line to vectors, tables and the apply family.' },
  2: { title: 'Part 2: Tidy R', blurb: 'The pipe, rows and columns, groups, joins and pivots.' },
};
const mkSub = (kind, id, name, blurb, help, build, o = {}) => ({ id, name, blurb, help, kind, build, target: kind === 'streak' ? (o.target || 5) : 0, hearts: 2, ...o });
const streak = (id, name, blurb, help, build, o) => mkSub('streak', id, name, blurb, help, build, o);
const tutorial = (id, name, blurb, help, build, o) => mkSub('tutorial', id, name, blurb, help, build, o);
const ints = (r, lo, hi, k, sorted) => RG.distinct(r, lo, hi, k, sorted);
const disp = v => typeof v === 'string' ? JSON.stringify(v) : shown(v);
const strip = (vals, o = {}) => Strip(vals.map(disp), o);
const R1 = (expr, expect, setup = '') => ({ setup, expr, expect });
// the strip's width limits what fits on a 320 px phone: at most 7 cells

// ======================================================================
// Unit 0: running a line
// ======================================================================
const U0 = {
  id: 'u0', part: 1, title: 'Unit 0: Running a line', intro: 'Code is lines of text that R runs, one line at a time.',
  subs: [
    tutorial('u0-run', 'First run', 'Press Run', 'R runs a line when you press Run. It prints the answer in the console.',
      ctx => E.run(ctx, { prompt: 'This is one line of R code. Tap <b>Run</b>.', lines: ['1 + 2'], output: '[1] 3', done: 'R ran the line and printed the answer. `[1]` just means "here comes the first value".' })),
    streak('u0-which', 'Which line?', 'Match output to code', 'The console shows what one line printed. Tap the line that made it. Numbers print bare, text keeps its quotes.', ctx => {
      const r = ctx.rng, pool = [['"hello"', '[1] "hello"'], ['"R"', '[1] "R"'], ['7', '[1] 7'], ['12', '[1] 12'], ['TRUE', '[1] TRUE'], ['FALSE', '[1] FALSE'], ['"12"', '[1] "12"']];
      const four = RG.sample(r, pool, 4), a = RG.int(r, 0, 3);
      return E.pick(ctx, { prompt: 'The console printed this. Which line made it?', mode: 'line', items: four.map(x => x[0]), answer: [a], single: true, out: four[a][1],
        explain: `\`${four[a][0]}\` prints ${four[a][1]}. Text keeps its quotes in the output; numbers and TRUE/FALSE do not have any.`, rcheck: [{ kind: 'print', code: four[a][0], expect: four[a][1] }] });
    }),
    streak('u0-comment', 'Comments', 'Lines that do nothing', 'A line starting with # is a comment: R skips it. Text after a # on a line is skipped too. Tap every line that R will run.', ctx => {
      const r = ctx.rng;
      const cm = ['# load the data', '# add one', '# x = 99', '# check this later', '# my first script'], code = ['x = 5', 'y = 8', 'x', 'sum(1, 2)', 'x = 5   # five', 'y   # show y'];
      const nc = RG.int(r, 2, 3); const lines = [...RG.sample(r, cm, nc), ...RG.sample(r, code, 5 - nc)];
      const L = RG.shuffle(r, lines); const ans = L.map((l, i) => /^\s*#/.test(l) ? -1 : i).filter(i => i >= 0);
      return E.pick(ctx, { prompt: 'Tap every line that R will <b>run</b>.', mode: 'line', items: L, answer: ans,
        explain: `Lines starting with # are comments and R skips them. Code before a # on the same line still runs.`, rcheck: [{ kind: 'comments', lines: L, expect: L.map(l => !/^\s*#/.test(l)) }] });
    }),
  ],
};

// ======================================================================
// Unit 1: values
// ======================================================================
const U1 = {
  id: 'u1', part: 1, title: 'Unit 1: Values', intro: 'Numbers, text and TRUE/FALSE are the three kinds of single value.',
  subs: [
    tutorial('u1-first', 'Quotes make text', 'One value, one tap', 'Anything in quotes is text.', ctx =>
      E.choice(ctx, { prompt: 'R is looking at this value. Quotes mean it is <b>text</b>. Tap the kind.', pic: codebox(['"cat"']), options: ['text'], answer: 0, tutorial: true, done: 'Yes: text sits in quotes. Numbers and TRUE/FALSE never do.' })),
    streak('u1-kind', 'What kind?', 'Number, text or TRUE/FALSE', 'Numbers have no quotes. TRUE and FALSE (capitals, no quotes) are logical values. Anything in quotes is text, even "7".', ctx => {
      const r = ctx.rng, pool = [['7', 'number'], ['3.5', 'number'], ['12', 'number'], ['0.5', 'number'], ['"cat"', 'text'], ['"7"', 'text'], ['"TRUE"', 'text'], ['"R"', 'text'], ['TRUE', 'TRUE/FALSE'], ['FALSE', 'TRUE/FALSE']];
      const v = RG.pick(r, pool);
      return E.choice(ctx, { prompt: 'What kind of value is this?', pic: codebox([v[0]]), options: ['number', 'text', 'TRUE/FALSE'], answer: v[1], noShuffle: false,
        explain: v[1] === 'text' ? `\`${v[0]}\` is in quotes, so it is text, even when it looks like something else.` : `\`${v[0]}\` has no quotes, so it is a ${v[1] === 'number' ? 'number' : 'TRUE/FALSE value'}.`,
        rcheck: [R1(`class(${v[0]})`, [{ number: 'numeric', text: 'character', 'TRUE/FALSE': 'logical' }[v[1]]])] });
    }),
    streak('u1-quotes', 'Quotes matter', 'Tap every text value', 'Quotes turn anything into text: "5" is text, 5 is a number, "TRUE" is text, TRUE is a logical value.', ctx => {
      const r = ctx.rng, nt = RG.int(r, 1, 3);
      const items = RG.shuffle(r, [...RG.sample(r, ['"5"', '"cat"', '"TRUE"', '"R"', '"12"'], nt), ...RG.sample(r, ['5', '12', '3.5', '9'], 2), ...RG.sample(r, ['TRUE', 'FALSE'], 3 - nt)]);
      const ans = items.map((x, i) => x.startsWith('"') ? i : -1).filter(i => i >= 0);
      return E.pick(ctx, { prompt: 'Tap every value that R reads as <b>text</b>.', mode: 'token', items, answer: ans,
        explain: 'The quoted ones are text. 5 and TRUE without quotes are a number and a logical value.', rcheck: items.map(x => R1(`is.character(${x})`, [x.startsWith('"')])) });
    }),
    streak('u1-compare', 'Make it TRUE', 'Pick the comparison', '== asks "is it equal?", != "is it different?", < and > ask which is smaller or bigger. A comparison answers TRUE or FALSE.', ctx => {
      const r = ctx.rng, a = RG.int(r, 1, 9); let b = RG.int(r, 1, 9); if (r() < .2) b = a;
      const f = { '<': (x, y) => x < y, '>': (x, y) => x > y, '==': (x, y) => x === y, '!=': (x, y) => x !== y, '<=': (x, y) => x <= y, '>=': (x, y) => x >= y };
      const goal = r() < .5; const ops = Object.keys(f); const good = ops.filter(o => f[o](a, b) === goal);
      if (!good.length || good.length === ops.length) return U1.subs[3].build(ctx);
      return E.assemble(ctx, { prompt: `Make R print <b>${goal ? 'TRUE' : 'FALSE'}</b>. Drop in a comparison.`, parts: [`${a} `, { slot: 'op' }, ` ${b}`], tiles: ops, answer: { op: good }, out: `Goal: [1] ${goal ? 'TRUE' : 'FALSE'}`,
        explain: `${a} ${good[0]} ${b} is ${goal ? 'TRUE' : 'FALSE'}.`, why: { op: { '*': `${a} and ${b} do not make that comparison come out ${goal ? 'TRUE' : 'FALSE'}.` } },
        rcheck: ops.map(o => R1(`${a} ${o} ${b}`, [f[o](a, b)])) });
    }),
    streak('u1-logic', 'And, or', 'Fill the truth table', '& needs both sides TRUE. | needs at least one side TRUE. Fill the last column.', ctx => {
      const r = ctx.rng, op = RG.pick(r, ['&', '|']); const rows = [[true, true], [true, false], [false, true], [false, false]];
      const res = rows.map(([a, b]) => op === '&' ? a && b : a || b);
      const blanks = Object.fromEntries(rows.map((_, i) => [`${i},2`, res[i] ? 'TRUE' : 'FALSE']));
      return E.fill(ctx, { prompt: `Fill in <code>A ${op} B</code> for each row.`, grid: { head: ['A', 'B', `A ${op} B`], data: rows.map(([a, b]) => [shown(a), shown(b), '']), label: 'truth table' }, blanks, tiles: ['TRUE', 'FALSE'],
        explain: op === '&' ? '& is TRUE only when both sides are TRUE.' : '| is TRUE when at least one side is TRUE.', rcheck: rows.map(([a, b], i) => R1(`${shown(a)} ${op} ${shown(b)}`, [res[i]])) });
    }),
  ],
};

// ======================================================================
// Unit 2: variables
// ======================================================================
// a tiny interpreter for the "x = 3 / y = x" statements used by the box levels
function runAssign(stmts) { const env = {}; stmts.forEach(([n, v]) => { env[n] = typeof v === 'object' ? env[v.ref] : v; }); return env; }
const stmtText = ([n, v]) => `${n} = ${typeof v === 'object' ? v.ref : disp(v)}`;
const U2 = {
  id: 'u2', part: 1, title: 'Unit 2: Variables', intro: 'A variable is a labelled box that holds a value.',
  subs: [
    tutorial('u2-first', 'A box with a name', 'Put 3 in the box', 'x = 3 stores 3 in a box labelled x.', ctx =>
      E.fill(ctx, { prompt: '<code>x = 3</code> stores 3 in a box called x. Tap the box.', lead: ['x = 3'], grid: { head: ['x'], data: [['']], cellW: 80 }, blanks: { '0,0': '3' }, tiles: ['3'], tutorial: true, done: 'The line stored 3 in the box named x. From now on, x means 3.' })),
    streak('u2-boxes', 'What is in the boxes?', 'Fill the boxes', 'Each line puts a value in a named box. Fill each box with what it holds after the lines run.', ctx => {
      const r = ctx.rng, names = RG.sample(r, ['x', 'y', 'z', 'a', 'b', 'n'], 2), pool = [3, 5, 8, 2, 9, 6, '"hi"', '"R"', 'TRUE'];
      const vals = RG.sample(r, [3, 5, 8, 2, 9, 6, 'hi', 'R', true, false], 2);
      const stmts = names.map((n, i) => [n, vals[i]]); const env = runAssign(stmts);
      const tiles = [...new Set([...vals.map(disp), ...RG.sample(r, [4, 7, '"no"', 'FALSE'].map(String), 2)])];
      return E.fill(ctx, { prompt: 'Fill each box with the value it holds.', lead: stmts.map(stmtText), grid: { head: names, data: [['', '']], cellW: 80 }, blanks: { '0,0': disp(env[names[0]]), '0,1': disp(env[names[1]]) }, tiles,
        explain: `${names[0]} holds ${disp(env[names[0]])} and ${names[1]} holds ${disp(env[names[1]])}. Text keeps its quotes.`, rcheck: names.map(n => R1(n, [env[n]], stmts.map(stmtText).join('\n'))) });
    }),
    streak('u2-over', 'Overwrite', 'A new line replaces the old value', 'A box holds one value. Assigning again throws the old value away. x = y copies the value y holds right now.', ctx => {
      const r = ctx.rng, [n1, n2, n3] = ints(r, 1, 9, 3), form = RG.int(r, 0, 1);
      const stmts = form === 0 ? [['a', n1], ['b', n2], ['a', { ref: 'b' }], ['b', n3]] : [['a', n1], ['b', n2], ['b', { ref: 'a' }], ['a', n3]];
      const env = runAssign(stmts);
      return E.fill(ctx, { prompt: 'Run the lines top to bottom. What do the boxes hold at the end?', lead: stmts.map(stmtText), grid: { head: ['a', 'b'], data: [['', '']], cellW: 80 }, blanks: { '0,0': String(env.a), '0,1': String(env.b) },
        tiles: [...new Set([n1, n2, n3].map(String))], explain: `At the end a holds ${env.a} and b holds ${env.b}. A line like a = b copies b's value at that moment, it does not link the two boxes.`,
        rcheck: ['a', 'b'].map(n => R1(n, [env[n]], stmts.map(stmtText).join('\n'))) });
    }),
    streak('u2-silent', 'Prints or silent?', 'Tap lines that print', 'Assigning stores a value and prints nothing. A bare name, a value or a calculation prints its result.', ctx => {
      const r = ctx.rng, n = RG.int(r, 2, 9);
      const pool = [['x', 1], ['5', 1], ['z <- 10', 0], ['print(x)', 1], ['sum(1, 2)', 1], ['total = sum(1, 2)', 0], [`x == ${n}`, 1], ['y = x', 0], ['x > 1', 1], ['v = c(1, 2)', 0]];
      let pick; do { pick = RG.sample(r, pool, 4); } while (!pick.some(p => p[1]) || !pick.some(p => !p[1]));
      const lines = [`x = ${n}`, ...pick.map(p => p[0])]; const flags = [0, ...pick.map(p => p[1])];
      return E.pick(ctx, { prompt: 'Run the script. Tap every line that <b>prints</b> something.', mode: 'line', items: lines, answer: flags.map((f, i) => f ? i : -1).filter(i => i >= 0),
        explain: 'Lines that only assign (= or <-) are silent. Anything else shows its result.', rcheck: [{ kind: 'visible', lines, expect: flags.map(Boolean) }] });
    }),
    streak('u2-eq', '= or <- or ==', 'Store, or ask?', 'One = (or <-) stores a value. Two == ask "are these equal?" and answer TRUE or FALSE. != asks "are they different?".', ctx => {
      const r = ctx.rng, v = RG.int(r, 2, 9), t = RG.int(r, 0, 2);
      const cfgs = [
        { prompt: `Store <b>${v}</b> in a box called x.`, parts: ['x ', { slot: 'op' }, ` ${v}`], ans: ['=', '<-'], why: { '==': `\`x == ${v}\` only asks a question. It does not store anything.`, '!=': '`!=` asks "is it different?". It does not store.' }, rc: R1('{x = ' + v + '; x}', [v]), msg: `\`x = ${v}\` (or \`x <- ${v}\`) stores ${v} in x.` },
        { prompt: `x already holds ${v}. Ask: <b>is x equal to ${v}</b>?`, lead: [`x = ${v}`], parts: ['x ', { slot: 'op' }, ` ${v}`], ans: '==', why: { '=': '`x = ' + v + '` would store, not ask.', '<-': '`x <- ' + v + '` would store, not ask.', '!=': '`!=` asks "is it different?".' }, rc: R1(`x == ${v}`, [true], `x = ${v}`), msg: `\`x == ${v}\` asks the question and prints TRUE.` },
        { prompt: `x already holds ${v}. Ask: <b>is x different from ${v}</b>?`, lead: [`x = ${v}`], parts: ['x ', { slot: 'op' }, ` ${v}`], ans: '!=', why: { '==': '`==` asks "is it equal?".', '=': '`=` would store.', '<-': '`<-` would store.' }, rc: R1(`x != ${v}`, [false], `x = ${v}`), msg: `\`x != ${v}\` asks "is x different?" and prints FALSE.` },
      ][t];
      return E.assemble(ctx, { prompt: cfgs.prompt, lead: cfgs.lead, parts: cfgs.parts, tiles: ['=', '<-', '==', '!='], answer: { op: cfgs.ans }, why: { op: cfgs.why }, explain: cfgs.msg, rcheck: [cfgs.rc] });
    }, { target: 10 }),
    streak('u2-names', 'Allowed names', 'Tap the legal names', 'A name may use letters, digits, . and _ but cannot start with a digit or hold a space or a dash.', ctx => {
      const r = ctx.rng, ok = ['new_var2', 'John2', 'my.data', 'x', 'total_n', 'Age', 'data1'], bad = ['2nd', 'my var', 'new-var', '_x', '1x', 'my$var'];
      const items = RG.shuffle(r, [...RG.sample(r, ok, RG.int(r, 2, 3)), ...RG.sample(r, bad, 5 - 2 > 0 ? RG.int(r, 2, 3) : 2)]).slice(0, 5);
      if (!items.some(x => ok.includes(x))) items[0] = 'x';
      const ans = items.map((x, i) => ok.includes(x) ? i : -1).filter(i => i >= 0);
      return E.pick(ctx, { prompt: 'Tap every name R accepts as a variable name.', mode: 'token', items, answer: ans, explain: 'Allowed: letters, digits, . and _, not starting with a digit. A space, a dash or $ would be read as something else.',
        rcheck: [{ kind: 'names', names: items, expect: items.map(x => ok.includes(x)) }] });
    }),
  ],
};

// ======================================================================
// Unit 3: functions
// ======================================================================
const FN = { sum: ['add them up', x => x.reduce((a, b) => a + b, 0)], max: ['the biggest', x => Math.max(...x)], min: ['the smallest', x => Math.min(...x)], length: ['how many there are', x => x.length] };
const U3 = {
  id: 'u3', part: 1, title: 'Unit 3: Functions', intro: 'A function is a name with brackets. Inputs go inside the brackets.',
  subs: [
    tutorial('u3-first', 'Inputs in brackets', 'Drop the inputs in', 'name(inputs). The inputs are called arguments.', ctx =>
      E.assemble(ctx, { prompt: 'A function is a name with brackets. Drag the inputs inside.', parts: ['sum(', { slot: 'a' }, ')'], tiles: ['1, 2, 3'], answer: { a: '1, 2, 3' }, tutorial: true, done: '`sum(1, 2, 3)` hands 1, 2 and 3 to the function sum, which adds them up and prints [1] 6.' })),
    streak('u3-call', 'Fill the call', 'Name and brackets', 'A call is name, round bracket, inputs, round bracket. Pick the function that does the job.', ctx => {
      const r = ctx.rng, f = RG.pick(r, Object.keys(FN)), xs = ints(r, 1, 20, 3), args = f === 'length' ? `c(${xs.join(', ')})` : xs.join(', ');
      return E.assemble(ctx, { prompt: `Get <b>${FN[f][0]}</b> of ${xs.join(', ')}.`, parts: [{ slot: 'f' }, { slot: 'o' }, args, { slot: 'c' }], tiles: [...Object.keys(FN), '(', ')', '[', ']'], answer: { f, o: '(', c: ')' },
        why: { f: { '*': `\`${f}\` is the function for ${FN[f][0]}.` }, o: { '[': 'Square brackets pick from a vector. A function call needs round brackets.', ']': 'A call opens with a round bracket.', ')': 'A call opens with ( and closes with ).', '*': 'A call opens with a round bracket (.' }, c: { ']': 'A call closes with a round bracket ).', '[': 'A call closes with a round bracket ).', '(': 'A call closes with ), not (.', '*': 'A call closes with a round bracket ).' } },
        explain: `\`${f}(${args})\` is ${FN[f][1](xs)}.`, rcheck: [R1(`${f}(${args})`, [FN[f][1](xs)])] });
    }),
    streak('u3-save', 'Keep the output', 'Assign, then show', 'A function prints its result. Put name = in front to keep it in a box, then type the name to see it.', ctx => {
      const r = ctx.rng, f = RG.pick(r, ['sum', 'max', 'min']), nm = { sum: 'total', max: 'biggest', min: 'smallest' }[f], xs = ints(r, 1, 9, 2);
      return E.assemble(ctx, { prompt: `Keep <b>${FN[f][0]}</b> of ${xs.join(' and ')} in a box called <code>${nm}</code>, then show it.`, lines: [[{ slot: 'a' }, ' ', { slot: 'b' }, ` ${f}(${xs.join(', ')})`], [{ slot: 'c' }]],
        tiles: [nm, nm, '=', '<-', '=='], answer: { a: nm, b: ['=', '<-'], c: nm }, why: { b: { '==': '`==` asks a question. Use = or <- to store.' }, a: { '*': `The box is called ${nm}.` } },
        explain: `\`${nm} = ${f}(${xs.join(', ')})\` stores the result; typing \`${nm}\` then prints it.`, rcheck: [R1(`{${nm} = ${f}(${xs.join(', ')}); ${nm}}`, [FN[f][1](xs)])] });
    }),
    streak('u3-named', 'Named inputs', 'name = value', 'Some inputs are named: round(x, digits = 2). The name says which input the value is for.', ctx => {
      const r = ctx.rng, t = RG.int(r, 0, 2);
      const cfg = [
        { p: 'Keep <b>2 decimal places</b>.', a: ['round(3.14159, ', ')'], n: 'digits', v: '2', ex: 'round(3.14159, digits = 2)', out: 3.14 },
        { p: 'Repeat it <b>3 times</b>.', a: ['rep("ab", ', ')'], n: 'times', v: '3', ex: 'rep("ab", times = 3)', out: ['ab', 'ab', 'ab'] },
        { p: 'Glue the two with a <b>dash</b> between.', a: ['paste("a", "b", ', ')'], n: 'sep', v: '"-"', ex: 'paste("a", "b", sep = "-")', out: 'a-b' },
      ][t];
      return E.assemble(ctx, { prompt: cfg.p, parts: [cfg.a[0], { slot: 'n' }, ' = ', { slot: 'v' }, cfg.a[1]], tiles: ['digits', 'times', 'sep', 'each', '2', '3', '"-"', '"+"'].filter(x => !['each'].includes(x) || true), answer: { n: cfg.n, v: cfg.v },
        why: { n: { '*': `The input that does this job is called ${cfg.n}.` }, v: { '*': `${cfg.v} is the value that does this job.` } }, explain: `\`${cfg.ex}\` gives ${Array.isArray(cfg.out) ? cfg.out.map(disp).join(' ') : disp(cfg.out)}.`,
        rcheck: [R1(cfg.ex, Array.isArray(cfg.out) ? cfg.out : [cfg.out])] });
    }),
    streak('u3-error', 'Read the error', 'Tap what broke it', 'An error message names the problem. Find the part of the line that caused it.', ctx => {
      const r = ctx.rng;
      const cases = [
        { lead: [], toks: ['Sum', '(', '1', ',', ' 2', ')'], err: 'Error: could not find function "Sum"', ans: 0, why: 'R is case sensitive: the function is sum, not Sum.', code: 'Sum(1, 2)' },
        { lead: ['x = 5'], toks: ['y', '=', 'x', '+', 'z'], err: "Error: object 'z' not found", ans: 4, why: 'z was never created. R can only use boxes that exist.', code: 'y = x + z' },
        { lead: ['v = c(1, 2, 3)'], toks: ['v', '(', '3', ')'], err: 'Error: could not find function "v"', ans: 1, why: 'Round brackets call a function. v is a vector, so use v[3].', code: 'v(3)' },
        { lead: ['v = c(1, 2, 3)'], toks: ['v', '[', '3', ')'], err: "Error: unexpected ')'", ans: 3, why: 'A [ must close with ], not ).', code: 'v[3)' },
        { lead: [], toks: ['mean', '(', 'x', ')'], err: "Error: object 'x' not found", ans: 2, why: 'x was never created, so mean has nothing to work on.', code: 'mean(x)' },
        { lead: [], toks: ['"a"', '+', '1'], err: 'Error: non-numeric argument to binary operator', ans: 0, why: 'You cannot add to text. "a" is text because of its quotes.', code: '"a" + 1' },
        { lead: [], toks: ['sum', '(', '1', ',', ' 2', ']'], err: "Error: unexpected ']'", ans: 5, why: 'A ( must close with ), not ].', code: 'sum(1, 2]' },
      ];
      const k = RG.pick(r, cases);
      return E.pick(ctx, { prompt: 'R printed this error. Tap the part of the line that caused it.', lead: k.lead.length ? k.lead : null, mode: 'token', items: k.toks, answer: [k.ans], single: true, out: k.err,
        explain: k.why, rcheck: [{ kind: 'error', setup: k.lead.join('\n'), code: k.code, contains: k.err.replace(/^Error: /, '').replace(/ in .*/, '') }] });
    }),
  ],
};

// ======================================================================
// Unit 4: vectors
// ======================================================================
const U4 = {
  id: 'u4', part: 1, title: 'Unit 4: Vectors', intro: 'A vector is a row of values of one kind. c() builds one.',
  subs: [
    tutorial('u4-first', 'c() makes a row', 'Fill the middle cell', 'c(5, 8, 2) lines up values.', ctx =>
      E.fill(ctx, { prompt: '<code>c(5, 8, 2)</code> lines the values up in a row. Fill the middle cell.', lead: ['v = c(5, 8, 2)'], grid: { data: [['5', '', '2']], index: true, cellW: 56 }, blanks: { '0,1': '8' }, tiles: ['8'], tutorial: true, done: 'A row of values is a vector. The little numbers above the cells are their positions.' })),
    streak('u4-row', 'Draw the vector', 'Fill the row', 'c() lines up its values in order. Fill the row to match the code.', ctx => {
      const r = ctx.rng, txt = r() < .3, n = RG.int(r, 4, 6), vals = txt ? RG.sample(r, ['a', 'b', 'c', 'd', 'e', 'f'], n) : ints(r, 1, 30, n);
      const blanks = Object.fromEntries(vals.map((v, i) => [`0,${i}`, disp(v)])); const extra = txt ? ['"z"'] : [String(RG.int(r, 31, 40))];
      return E.fill(ctx, { prompt: 'Fill the row to match the code.', lead: [`v = ${rvec(vals)}`], grid: { data: [vals.map(() => '')], index: true, cellW: 56 }, blanks, tiles: [...vals.map(disp), ...extra],
        explain: `The cells follow the order inside c(): ${vals.map(disp).join(', ')}.`, rcheck: [R1('v', vals, `v = ${rvec(vals)}`)] });
    }),
    streak('u4-punct', 'Commas and brackets', 'Fix the syntax slots', 'c( opens, commas separate the values, ) closes. Put the right symbol in each gap.', ctx => {
      const r = ctx.rng, vs = ints(r, 1, 30, 3);
      return E.assemble(ctx, { prompt: 'Make a vector of these three values. Fill the gaps with the right symbols.', pic: strip(vs), parts: ['v = c', { slot: 'a' }, String(vs[0]), { slot: 'b' }, ' ' + vs[1], { slot: 'c' }, ' ' + vs[2], { slot: 'd' }], tiles: ['(', ',', ',', ')', '[', ']', '+'], answer: { a: '(', b: ',', c: ',', d: ')' },
        why: { a: { '[': 'c is a function, so it takes round brackets.', '*': 'c opens with a round bracket (.' }, b: { '*': 'Values are separated by commas.' }, c: { '*': 'Values are separated by commas.' }, d: { '*': 'c( closes with a round bracket ).' } },
        explain: `\`c(${vs.join(', ')})\`: round brackets and commas.`, rcheck: [R1(`c(${vs.join(', ')})`, vs)] });
    }),
    streak('u4-range', 'Ranges with :', 'a:b counts for you', 'a:b makes every whole number from a to b. 10:1 counts down.', ctx => {
      const r = ctx.rng, down = r() < .35, lo = RG.int(r, 1, 6), hi = lo + RG.int(r, 3, 5), seq = []; for (let i = lo; i <= hi; i++) seq.push(i); if (down) seq.reverse();
      const a = seq[0], b = seq[seq.length - 1], ds = ints(r, lo + 1, hi - 1, 2);
      return E.assemble(ctx, { prompt: 'Make this row with a range.', pic: strip(seq), parts: ['v = ', { slot: 's' }, ':', { slot: 'e' }], tiles: [...new Set([a, b, ...ds].map(String))], answer: { s: String(a), e: String(b) },
        why: { s: { '*': `A range starts at the first cell, ${a}.` }, e: { '*': `A range ends at the last cell, ${b}.` } }, explain: `\`${a}:${b}\` runs from ${a} to ${b}${down ? ', counting down' : ''}.`, rcheck: [R1(`${a}:${b}`, seq)] });
    }),
    streak('u4-compare', 'Ask every cell', 'A comparison on a whole row', 'A comparison on a vector asks every cell at once, and gives a row of TRUE and FALSE.', ctx => {
      const r = ctx.rng, v = ints(r, 1, 9, 5), k = RG.int(r, 3, 7), op = RG.pick(r, ['>', '<', '==']);
      const t = op === '>' ? x => x > k : op === '<' ? x => x < k : x => x === k; if (op === '==') v[RG.int(r, 0, 4)] = k;
      const res = v.map(t);
      return E.fill(ctx, { prompt: `<code>v ${op} ${k}</code> asks about every cell. Fill in the answers.`, lead: [`v = ${rvec(v)}`, `v ${op} ${k}`], grid: { data: [v.map(String), v.map(() => '')], index: true, cellW: 56, rowHead: ['v', '?'] },
        blanks: Object.fromEntries(res.map((x, i) => [`1,${i}`, x ? 'TRUE' : 'FALSE'])), tiles: ['TRUE', 'FALSE'], explain: `Each cell is compared with ${k} separately.`, rcheck: [R1(`v ${op} ${k}`, res, `v = ${rvec(v)}`)] });
    }),
    streak('u4-sort', 'rev and sort', 'Functions on a whole row', 'rev(v) reads the row backwards. sort(v) puts it in increasing order (decreasing = TRUE reverses that).', ctx => {
      const r = ctx.rng, v = ints(r, 1, 30, 5), kind = RG.int(r, 0, 2);
      const code = ['rev(v)', 'sort(v)', 'sort(v, decreasing = TRUE)'][kind];
      const res = kind === 0 ? v.slice().reverse() : kind === 1 ? v.slice().sort((a, b) => a - b) : v.slice().sort((a, b) => b - a);
      return E.fill(ctx, { prompt: `Fill the row that <code>${code}</code> gives.`, lead: [`v = ${rvec(v)}`, code], grid: { data: [v.map(String), v.map(() => '')], index: true, cellW: 56, rowHead: ['v', 'out'] }, blanks: Object.fromEntries(res.map((x, i) => [`1,${i}`, String(x)])), tiles: v.map(String),
        explain: `${code} gives ${res.join(' ')}.`, rcheck: [R1(code, res, `v = ${rvec(v)}`)], noShuffle: false });
    }),
  ],
};

// ======================================================================
// Unit 5: indexing
// ======================================================================
const conds = r => {
  const k = RG.int(r, 3, 7);
  return [{ code: `v > ${k}`, f: x => x > k }, { code: `v < ${k}`, f: x => x < k }, { code: `v >= ${k}`, f: x => x >= k }, { code: `v != ${k}`, f: x => x !== k }, { code: `v == ${k}`, f: x => x === k }];
};
const U5 = {
  id: 'u5', part: 1, title: 'Unit 5: Picking from vectors', intro: 'Square brackets pick cells out of a vector.',
  subs: [
    tutorial('u5-first', 'v[3] picks the third', 'Tap the picked cell', 'v[3] is the cell in position 3.', ctx =>
      E.pick(ctx, { prompt: '<code>v[3]</code> picks the cell in position 3. Tap it.', lead: ['v = c(8, 6, 4, 2)', 'v[3]'], mode: 'cell', grid: { data: [['8', '6', '4', '2']], index: true, cellW: 56 }, answer: ['0,2'], tutorial: true, done: 'The number in the brackets is a position. v[3] prints [1] 4.' })),
    streak('u5-one', 'Which cell?', 'Tap the picked cell', 'The number in [ ] is a position, counted from 1. The positions are written above the cells.', ctx => {
      const r = ctx.rng, n = RG.int(r, 5, 7), v = ints(r, 1, 40, n), k = RG.int(r, 1, n);
      return E.pick(ctx, { prompt: `Tap the cell that <code>v[${k}]</code> picks.`, lead: [`v = ${rvec(v)}`], mode: 'cell', single: true, grid: { data: [v.map(String)], index: true, cellW: 56 }, answer: [`0,${k - 1}`],
        explain: `v[${k}] is the ${k}th cell: ${v[k - 1]}.`, rcheck: [R1(`v[${k}]`, [v[k - 1]], `v = ${rvec(v)}`)] });
    }),
    streak('u5-many', 'Several cells', 'c(), a range, or minus', 'v[c(2, 5)] picks positions 2 and 5. v[2:4] picks 2, 3, 4. v[-1] picks everything except position 1.', ctx => {
      const r = ctx.rng, n = RG.int(r, 5, 7), v = ints(r, 1, 40, n), t = RG.int(r, 0, 2); let code, pos;
      if (t === 0) { pos = ints(r, 1, n, 2, true); code = `v[c(${pos.join(', ')})]`; } else if (t === 1) { const a = RG.int(r, 1, n - 2), b = a + RG.int(r, 1, Math.min(3, n - a)); pos = []; for (let i = a; i <= b; i++) pos.push(i); code = `v[${a}:${b}]`; } else { const k = RG.int(r, 1, n); pos = []; for (let i = 1; i <= n; i++) if (i !== k) pos.push(i); code = `v[-${k}]`; }
      return E.pick(ctx, { prompt: `Tap every cell that <code>${code}</code> picks.`, lead: [`v = ${rvec(v)}`], mode: 'cell', grid: { data: [v.map(String)], index: true, cellW: 56 }, answer: pos.map(p => `0,${p - 1}`),
        explain: `${code} picks positions ${pos.join(', ')}. A minus sign means "everything except".`, rcheck: [R1(code, pos.map(p => v[p - 1]), `v = ${rvec(v)}`)] });
    }),
    streak('u5-brackets', '[ ] or ( )', 'Pick, or call?', 'Square brackets pick cells from a vector. Round brackets call a function. v(3) tries to run a function named v.', ctx => {
      const r = ctx.rng, t = RG.int(r, 0, 3), k = RG.int(r, 2, 4), f = RG.pick(r, ['length', 'sum', 'max']);
      const pick = t < 2, v = [4, 9, 2, 7];
      return E.assemble(ctx, { prompt: pick ? `Pick out the <b>${['', '', '2nd', '3rd', '4th'][k]}</b> value of v.` : `Run <code>${f}</code> on v.`, lead: ['v = c(4, 9, 2, 7)'],
        parts: pick ? ['v', { slot: 'o' }, String(k), { slot: 'c' }] : [f, { slot: 'o' }, 'v', { slot: 'c' }], tiles: ['[', ']', '(', ')'], answer: pick ? { o: '[', c: ']' } : { o: '(', c: ')' },
        why: { o: { '*': pick ? 'To pick from a vector use a square bracket [.' : `${f} is a function, so it is called with a round bracket (.`, '(': 'v(3) would call a function named v. A vector is picked with [ ].', '[': `${f}[ ] would try to pick from ${f}. A function is called with ( ).` }, c: { '*': pick ? 'Close with a square bracket ].' : 'Close with a round bracket ).' } },
        explain: pick ? `v[${k}] picks ${v[k - 1]}. Round brackets would call a function.` : `${f}(v) calls the function ${f} on v.`, rcheck: [pick ? R1(`v[${k}]`, [v[k - 1]], 'v = c(4, 9, 2, 7)') : R1(`${f}(v)`, [FN[f][1](v)], 'v = c(4, 9, 2, 7)')] });
    }, { target: 10 }),
    streak('u5-test', 'Test, then pick', 'See which cells pass', 'v > 5 gives TRUE or FALSE for every cell. v[v > 5] keeps the cells where the answer is TRUE.', ctx => {
      const r = ctx.rng, v = ints(r, 1, 9, 5), c = RG.pick(r, conds(r)), flags = v.map(c.f);
      if (flags.every(x => x) || flags.every(x => !x)) return U5.subs[4].build(ctx);
      return E.pick(ctx, { prompt: `Tap the cells that <code>v[${c.code}]</code> keeps.`, lead: [`v = ${rvec(v)}`, `${c.code}  # the test row`], mode: 'cell', grid: { data: [v.map(String), flags.map(x => ({ v: shown(x), cls: 'logi' }))], index: true, cellW: 44, rowHead: ['v', 'test'], compact: false }, answer: flags.map((f, i) => f ? `0,${i}` : null).filter(Boolean),
        only: null, explain: 'The cells whose test is TRUE are kept.', rcheck: [R1(`v[${c.code}]`, v.filter(c.f), `v = ${rvec(v)}`)] });
    }),
    streak('u5-cond', 'Pick by a test', 'No helper row', 'v[test] keeps the cells where the test is TRUE. Work out the test for each cell yourself.', ctx => {
      const r = ctx.rng, txt = r() < .25;
      if (txt) { const w = RG.shuffle(r, ['a', 'b', 'a', 'c', 'b', 'a']).slice(0, 6), t = RG.pick(r, ['a', 'b']), op = RG.pick(r, ['==', '!=']), keep = w.map(x => op === '==' ? x === t : x !== t); if (keep.every(x => x) || keep.every(x => !x)) return U5.subs[5].build(ctx);
        return E.pick(ctx, { prompt: `Tap the cells that <code>v[v ${op} "${t}"]</code> keeps.`, lead: [`v = ${rvec(w)}`], mode: 'cell', grid: { data: [w.map(disp)], index: true, cellW: 56 }, answer: keep.map((k, i) => k ? `0,${i}` : null).filter(Boolean), explain: `Keep the cells where v ${op} "${t}" is TRUE.`, rcheck: [R1(`v[v ${op} "${t}"]`, w.filter((x, i) => keep[i]), `v = ${rvec(w)}`)] }); }
      const n = RG.int(r, 5, 7), v = ints(r, 1, 12, n), c = RG.pick(r, conds(r)), flags = v.map(c.f);
      if (flags.every(x => x) || flags.every(x => !x)) return U5.subs[5].build(ctx);
      return E.pick(ctx, { prompt: `Tap the cells that <code>v[${c.code}]</code> keeps.`, lead: [`v = ${rvec(v)}`], mode: 'cell', grid: { data: [v.map(String)], index: true, cellW: 56 }, answer: flags.map((f, i) => f ? `0,${i}` : null).filter(Boolean),
        explain: `${c.code} is TRUE for ${flags.filter(Boolean).length} of the ${n} cells; those are kept.`, rcheck: [R1(`v[${c.code}]`, v.filter(c.f), `v = ${rvec(v)}`)] });
    }),
    streak('u5-andor', 'Or, and', 'Two tests together', '| keeps a cell if either test passes. & keeps it only if both pass. A cell cannot be below 3 and above 8 at once, so that picks nothing.', ctx => {
      const r = ctx.rng, n = 6, v = ints(r, 1, 12, n), lo = RG.int(r, 3, 5), hi = RG.int(r, 8, 10), t = RG.int(r, 0, 2);
      const forms = [{ code: `v < ${lo} | v > ${hi}`, f: x => x < lo || x > hi }, { code: `v > ${lo} & v < ${hi}`, f: x => x > lo && x < hi }, { code: `v < ${lo} & v > ${hi}`, f: x => x < lo && x > hi }][t];
      const keep = v.map(forms.f);
      return E.pick(ctx, { prompt: `Tap the cells that <code>v[${forms.code}]</code> keeps.`, lead: [`v = ${rvec(v)}`], mode: 'cell', grid: { data: [v.map(String)], index: true, cellW: 56 }, answer: keep.map((k, i) => k ? `0,${i}` : null).filter(Boolean), allowNone: true, noneLabel: 'Nothing is kept',
        explain: t === 2 ? `No number is both below ${lo} and above ${hi}, so & keeps nothing.` : t === 0 ? '| keeps a cell when either test is TRUE.' : '& keeps a cell only when both tests are TRUE.', rcheck: [R1(`v[${forms.code}]`, v.filter(forms.f), `v = ${rvec(v)}`)] });
    }, { target: 10 }),
    streak('u5-over', 'Overwrite the picked', 'Which cells change?', 'v[test] = value overwrites only the picked cells. The others stay as they were.', ctx => {
      const r = ctx.rng, v = ints(r, 1, 12, 6), c = RG.pick(r, conds(r)), flags = v.map(c.f);
      if (flags.every(x => x) || flags.every(x => !x)) return U5.subs[7].build(ctx);
      const nv = v.map((x, i) => flags[i] ? 0 : x);
      return E.pick(ctx, { prompt: `After this line, tap the cells that hold <b>0</b>.`, lead: [`v = ${rvec(v)}`, `v[${c.code}] = 0`], mode: 'cell', grid: { data: [v.map(String)], index: true, cellW: 56 }, answer: flags.map((f, i) => f ? `0,${i}` : null).filter(Boolean),
        explain: `Only the cells where ${c.code} is TRUE become 0.`, rcheck: [R1('v', nv, `v = ${rvec(v)}\nv[${c.code}] = 0`)] });
    }),
  ],
};

// ======================================================================
// Unit 6: tables
// ======================================================================
const M = (r, nr = 3, nc = 4) => { const flat = ints(r, 10, 99, nr * nc); return Array.from({ length: nr }, (_, i) => flat.slice(i * nc, i * nc + nc)); };
const mHead = nc => Array.from({ length: nc }, (_, i) => `[,${i + 1}]`), mRows = nr => Array.from({ length: nr }, (_, i) => `[${i + 1},]`);
const mSetup = m => `m = matrix(c(${m.flat().join(', ')}), nrow = ${m.length}, byrow = TRUE)`;
const mGrid = m => ({ data: m.map(row => row.map(String)), head: mHead(m[0].length), rowHead: mRows(m.length) });
const DFN = ['id', 'age', 'score', 'group'];
const U6 = {
  id: 'u6', part: 1, title: 'Unit 6: Tables', intro: 'A table has rows and columns. Row first, then column.',
  subs: [
    tutorial('u6-first', 'm[2, 3]', 'Tap row 2, column 3', 'Inside [ ], the first number is the row and the second is the column.', ctx =>
      E.pick(ctx, { prompt: '<code>m[2, 3]</code> means row 2, column 3. Tap that cell.', lead: ['m[2, 3]'], mode: 'cell', grid: { data: [['11', '12', '13', '14'], ['21', '22', '23', '24'], ['31', '32', '33', '34']].map(rw => rw.map(String)), head: mHead(4), rowHead: mRows(3) }, answer: ['1,2'], tutorial: true, done: 'Row first, then column. m[2, 3] is 23.' })),
    streak('u6-cell', 'Row, then column', 'Tap m[row, col]', 'm[2, 3]: the number before the comma is the row, the one after is the column.', ctx => {
      const r = ctx.rng, m = M(r), i = RG.int(r, 1, 3), j = RG.int(r, 1, 4);
      return E.pick(ctx, { prompt: `Tap the cell that <code>m[${i}, ${j}]</code> picks.`, mode: 'cell', single: true, grid: mGrid(m), answer: [`${i - 1},${j - 1}`], explain: `Row ${i}, column ${j} holds ${m[i - 1][j - 1]}.`, rcheck: [R1(`m[${i}, ${j}]`, [m[i - 1][j - 1]], mSetup(m))] });
    }),
    streak('u6-line', 'A whole row or column', 'Leave one side blank', 'm[2, ] is all of row 2. m[, 3] is all of column 3. The blank side means "everything".', ctx => {
      const r = ctx.rng, m = M(r), row = r() < .5, k = row ? RG.int(r, 1, 3) : RG.int(r, 1, 4);
      return E.pick(ctx, { prompt: `Tap what <code>${row ? `m[${k}, ]` : `m[, ${k}]`}</code> picks.`, mode: row ? 'row' : 'col', single: true, grid: mGrid(m), answer: [k - 1],
        explain: row ? `m[${k}, ] is all of row ${k}: the blank after the comma means every column.` : `m[, ${k}] is all of column ${k}: the blank before the comma means every row.`, rcheck: [R1(row ? `m[${k}, ]` : `m[, ${k}]`, row ? m[k - 1] : m.map(rw => rw[k - 1]), mSetup(m))] });
    }),
    streak('u6-bind', 'cbind or rbind', 'Glue vectors into a table', 'cbind glues vectors side by side as columns. rbind stacks them as rows. The first one named comes first.', ctx => {
      const r = ctx.rng, a = ints(r, 1, 9, 3), b = ints(r, 1, 9, 3), col = r() < .5, [x, y] = r() < .5 ? ['a', 'b'] : ['b', 'a'], first = x === 'a' ? a : b, second = x === 'a' ? b : a;
      const g = col ? Grid({ data: first.map((_, i) => [String(first[i]), String(second[i])]), head: [x, y], label: `table with columns ${x} and ${y}` }) : Grid({ data: [first.map(String), second.map(String)], rowHead: [x, y], label: `table with rows ${x} and ${y}` });
      return E.assemble(ctx, { prompt: 'Which call builds this table?', lead: [`a = ${rvec(a)}`, `b = ${rvec(b)}`], pic: g.wrap, parts: ['m = ', { slot: 'f' }, '(', { slot: 'x' }, ', ', { slot: 'y' }, ')'], tiles: ['cbind', 'rbind', 'a', 'b'], answer: { f: col ? 'cbind' : 'rbind', x, y },
        why: { f: { cbind: 'cbind puts vectors side by side, as columns. This table has them as rows.', rbind: 'rbind stacks vectors as rows. This table has them as columns.' }, x: { '*': `The first vector in the table is ${x}.` }, y: { '*': `The second vector in the table is ${y}.` } },
        explain: `${col ? 'cbind' : 'rbind'}(${x}, ${y}) makes ${col ? 'columns' : 'rows'} in that order.`, rcheck: [{ setup: `a = ${rvec(a)}\nb = ${rvec(b)}`, expr: `${col ? 'cbind' : 'rbind'}(${x}, ${y})`, expect: { mat: { nrow: col ? 3 : 2, byrow: col ? first.flatMap((_, i) => [first[i], second[i]]) : [...first, ...second] } } }] });
    }),
    streak('u6-names', 'Name the columns', 'colnames and c()', 'colnames(df) = c("a", "b") gives the columns their names. Names are text, so they need quotes.', ctx => {
      const r = ctx.rng, [n1, n2] = RG.sample(r, ['age', 'score', 'group', 'time', 'height', 'id'], 2), rows = [[RG.int(r, 20, 60), RG.int(r, 1, 9)], [RG.int(r, 20, 60), RG.int(r, 1, 9)]];
      const g = Grid({ data: rows.map(rw => rw.map(String)), head: [n1, n2], label: `table with columns ${n1} and ${n2}` });
      return E.assemble(ctx, { prompt: 'Name the columns so the table looks like this.', lead: ['df has columns V1 and V2'], pic: g.wrap, parts: ['colnames(df) = c(', { slot: 'a' }, ', ', { slot: 'b' }, ')'], tiles: [`"${n1}"`, `"${n2}"`, n1, n2], answer: { a: `"${n1}"`, b: `"${n2}"` },
        why: { a: { [n1]: 'Names are text. Without quotes R looks for a variable called ' + n1 + '.', '*': `The first column is ${n1}.` }, b: { [n2]: 'Names are text, so they need quotes.', '*': `The second column is ${n2}.` } },
        explain: `colnames(df) = c("${n1}", "${n2}")`, rcheck: [R1(`{colnames(df) = c("${n1}", "${n2}"); names(df)}`, [n1, n2], 'df = data.frame(V1 = 1:2, V2 = 3:4)')] });
    }),
    streak('u6-dollar', '$ picks a column', 'df$name or df[, n]', 'df$score is the column called score. df[, 3] is the third column. Both give the column as a vector.', ctx => {
      const r = ctx.rng, names = ['id', 'age', 'score', 'group'], rows = [0, 1, 2].map(() => [RG.int(r, 1, 9), RG.int(r, 20, 60), RG.int(r, 10, 99), RG.int(r, 1, 3)]), k = RG.int(r, 0, 3), by = r() < .5;
      return E.pick(ctx, { prompt: `Tap the column that <code>${by ? 'df$' + names[k] : 'df[, ' + (k + 1) + ']'}</code> picks.`, mode: 'col', single: true, grid: { data: rows.map(rw => rw.map(String)), head: names, rowHead: ['1', '2', '3'] }, answer: [k],
        explain: by ? `df$${names[k]} is the column called ${names[k]}.` : `df[, ${k + 1}] is column ${k + 1}, which is ${names[k]}.`, rcheck: [R1(by ? `df$${names[k]}` : `df[, ${k + 1}]`, rows.map(rw => rw[k]), `df = data.frame(${names.map((n, j) => `${n} = ${rvec(rows.map(rw => rw[j]))}`).join(', ')})`)] });
    }),
    streak('u6-same', 'Same column, two ways', 'Which line is the same?', 'df$score and df[, 3] are the same column when score is the third column. df[3, ] is row 3, a different thing.', ctx => {
      const r = ctx.rng, names = ['id', 'age', 'score', 'group'], k = RG.int(r, 1, 3), other = [0, 1, 2, 3].filter(x => x !== k)[RG.int(r, 0, 2)];
      const rows = [0, 1, 2].map(() => [RG.int(r, 1, 9), RG.int(r, 20, 60), RG.int(r, 10, 99), RG.int(r, 1, 3)]);
      const good = `df[, ${k + 1}]`;
      return E.choice(ctx, { prompt: `Which line gives the same as <code>df$${names[k]}</code>?`, pic: Grid({ data: rows.map(rw => rw.map(String)), head: names, rowHead: ['1', '2', '3'], compact: true, label: 'table' }).wrap, options: [good, `df[${k + 1}, ]`, `df[, ${other + 1}]`], answer: good, code: true,
        explain: `${names[k]} is column ${k + 1}, and df[, ${k + 1}] is column ${k + 1}. df[${k + 1}, ] would be a row.`, rcheck: [R1(`identical(df$${names[k]}, df[, ${k + 1}])`, [true], `df = data.frame(${names.map((n, j) => `${n} = ${rvec(rows.map(rw => rw[j]))}`).join(', ')})`)] });
    }),
    streak('u6-frame', 'Build a data frame', 'Drop values into the cells', 'data.frame(name = c(...), age = c(...)): each c() becomes one column, in order.', ctx => {
      const r = ctx.rng, nm = RG.sample(r, ['Ann', 'Bo', 'Cy', 'Di', 'Ed'], 3), ag = ints(r, 20, 60, 3);
      return E.fill(ctx, { prompt: 'Fill the table that this code builds.', lead: [`df = data.frame(`, `  name = ${rvec(nm)},`, `  age = ${rvec(ag)})`], grid: { data: nm.map(() => ['', '']), head: ['name', 'age'], rowHead: ['1', '2', '3'] },
        blanks: Object.fromEntries(nm.flatMap((n, i) => [[`${i},0`, `"${n}"`], [`${i},1`, String(ag[i])]])), tiles: [...nm.map(n => `"${n}"`), ...ag.map(String)], explain: 'Each c() fills one column from top to bottom.', rcheck: [{ setup: '', expr: `data.frame(name = ${rvec(nm)}, age = ${rvec(ag)})`, expect: dfSpec(['name', 'age'], nm.map((n, i) => [n, ag[i]])) }] });
    }),
  ],
};

// ======================================================================
// Unit 7: files and packages
// ======================================================================
const U7 = {
  id: 'u7', part: 1, title: 'Unit 7: Files and packages', intro: 'Packages add functions. Files come from a folder R is looking in.',
  subs: [
    tutorial('u7-first', 'Install once', 'Get a package', 'install.packages("name") downloads a package, once.', ctx =>
      E.choice(ctx, { prompt: 'You have never used the package <b>tidyr</b>. Tap the line that gets it onto your computer.', pic: null, options: ['install.packages("tidyr")'], answer: 0, tutorial: true, code: true, done: 'That downloads it, once. Each new session you then switch it on with library(tidyr).' })),
    streak('u7-pkg', 'Once, or every time?', 'install vs library', 'install.packages("x") downloads x once (name in quotes). library(x) switches it on, at the top of each session.', ctx => {
      const r = ctx.rng, p = RG.pick(r, ['tidyr', 'dplyr', 'ggplot2', 'lme4']), first = r() < .5;
      return E.choice(ctx, { prompt: first ? `First time ever using <b>${p}</b>. Which line?` : `Start of a new session. <b>${p}</b> is already downloaded. Which line?`, options: [`install.packages("${p}")`, `install.packages(${p})`, `library(${p})`], answer: first ? `install.packages("${p}")` : `library(${p})`, code: true,
        explain: first ? `install.packages("${p}") downloads it, once, with the name in quotes.` : `library(${p}) switches on a package you already have. No download.`, rcheck: [{ kind: 'syntax', code: first ? `install.packages("${p}")` : `library(${p})` }] });
    }),
    streak('u7-where', 'Where does R look?', 'The working folder', 'read.csv("data.csv") looks for that file in the working folder. The same name in another folder is a different file.', ctx => {
      const r = ctx.rng, folders = ['study1', 'study2', 'old'], wd = RG.pick(r, folders), has = r() < .7, f = RG.pick(r, ['data.csv', 'scores.csv']);
      const show = folders.map(x => x === wd && !has ? `${x}/other.csv` : `${x}/${f}`).concat(has ? [] : ['error: no such file']);
      const answer = has ? folders.indexOf(wd) : 3;
      return E.pick(ctx, { prompt: `R's working folder is <b>${wd}</b>. Tap what <code>read.csv("${f}")</code> opens.`, mode: 'drawer', single: true, items: show, answer: [answer],
        explain: has ? `R only looks in ${wd}, so it opens ${wd}/${f}.` : `${wd} has no ${f}, so R stops with an error. Files in other folders do not count.`, rcheck: [] });
    }),
    streak('u7-read', 'Read a csv', 'Assign what read.csv gives', 'my_data = read.csv("file.csv", header = TRUE): the file name is text, so it has quotes. header = TRUE means the first row holds the column names.', ctx => {
      const r = ctx.rng, f = RG.pick(r, ['scores.csv', 'data.csv', 'trials.csv']);
      return E.assemble(ctx, { prompt: 'Read the file into a data frame called my_data.', parts: ['my_data ', { slot: 'op' }, ' read.csv(', { slot: 'f' }, ', header = ', { slot: 'h' }, ')'], tiles: ['=', '<-', `"${f}"`, f, 'TRUE', '"TRUE"'], answer: { op: ['=', '<-'], f: `"${f}"`, h: 'TRUE' },
        why: { f: { [f]: 'The file name is text, so it needs quotes.', '*': 'The file name goes in quotes.' }, h: { '"TRUE"': 'TRUE is a logical value. In quotes it would be text.', '*': 'header = TRUE says the first row holds the names.' }, op: { '*': 'Use = or <- to keep the result.' } },
        explain: `read.csv("${f}", header = TRUE) reads the file; my_data = keeps it.`, rcheck: [{ setup: `write.csv(data.frame(a = 1:3), "${f}", row.names = FALSE)`, expr: `{my_data = read.csv("${f}", header = TRUE); my_data$a}`, expect: [1, 2, 3] }] });
    }),
    streak('u7-look', 'Look at the data', 'nrow, ncol, length, head', 'nrow(df) counts rows, ncol(df) counts columns, length(v) counts the values in a vector, head(df) shows the first rows.', ctx => {
      const r = ctx.rng, nr = RG.int(r, 3, 5), rows = Array.from({ length: nr }, () => [RG.int(r, 20, 60), RG.int(r, 1, 9)]), t = RG.int(r, 0, 3);
      const asks = [['How many <b>rows</b> does df have?', 'nrow(df)', nr], ['How many <b>columns</b> does df have?', 'ncol(df)', 2], ['How many values are in the vector <code>df$age</code>?', 'length(df$age)', nr], ['Show the <b>first rows</b> of df.', 'head(df)', null]][t];
      const setup = `df = data.frame(age = ${rvec(rows.map(x => x[0]))}, n = ${rvec(rows.map(x => x[1]))})`;
      return E.choice(ctx, { prompt: asks[0], pic: Grid({ data: rows.map(x => x.map(String)), head: ['age', 'n'], rowHead: rows.map((_, i) => String(i + 1)), compact: true }).wrap, options: ['nrow(df)', 'ncol(df)', 'length(df$age)', 'head(df)'], answer: asks[1], code: true,
        explain: `${asks[1]} ${asks[2] == null ? 'shows the first six rows.' : 'gives ' + asks[2] + '.'}`, rcheck: asks[2] == null ? [] : [R1(asks[1], [asks[2]], setup)] });
    }),
    streak('u7-rows', 'Keep the rows', 'df[test, ]', 'df[df$age > 30, ] keeps the rows where the test is TRUE. The test goes before the comma.', ctx => {
      const r = ctx.rng, n = 5, ages = ints(r, 20, 60, n), k = RG.int(r, 30, 45), t = RG.int(r, 0, 1), grp = ['a', 'b', 'a', 'b', 'a'].map((x, i) => RG.pick(r, ['a', 'b']));
      const code = t === 0 ? `df[df$age > ${k}, ]` : `df[df$grp == "${RG.pick(r, ['a', 'b'])}", ]`; const g = t === 1 ? code.match(/"(.)"/)[1] : null;
      const keep = t === 0 ? ages.map(a => a > k) : grp.map(x => x === g);
      if (keep.every(x => x) || keep.every(x => !x)) return U7.subs[5].build(ctx);
      return E.pick(ctx, { prompt: `Tap the rows that <code>${code}</code> keeps.`, mode: 'row', grid: { data: ages.map((a, i) => [String(a), grp[i]]), head: ['age', 'grp'], rowHead: ages.map((_, i) => String(i + 1)) }, answer: keep.map((x, i) => x ? i : -1).filter(i => i >= 0),
        explain: 'The rows where the test is TRUE are kept, whole.', rcheck: [{ setup: `df = data.frame(age = ${rvec(ages)}, grp = ${rvec(grp)})`, expr: code, expect: dfSpec(['age', 'grp'], ages.map((a, i) => [a, grp[i]]).filter((_, i) => keep[i])) }] });
    }),
    streak('u7-comma', 'The comma', 'Rows left of it, columns right', 'In df[ , ] rows come before the comma and columns after. Forgetting the comma changes what you get.', ctx => {
      const r = ctx.rng, rows = r() < .5, k = RG.int(r, 25, 45);
      const cfg = rows ? { p: `Keep the <b>rows</b> where age is over ${k}.`, parts: ['df', { slot: 'a' }, `df$age > ${k}`, { slot: 'b' }, ' ', { slot: 'c' }], code: `df[df$age > ${k}, ]` } : { p: 'Keep the <b>2nd column</b>.', parts: ['df', { slot: 'a' }, { slot: 'b' }, '2', { slot: 'c' }], code: 'df[, 2]' };
      const df = 'df = data.frame(age = c(22, 30, 41, 50), n = c(1, 2, 3, 4))';
      return E.assemble(ctx, { prompt: cfg.p, parts: cfg.parts, tiles: ['[', ']', ',', '(', ')'], answer: { a: '[', b: ',', c: ']' }, why: { a: { '(': 'df( ) would call a function. A table is picked with [ ].', '*': 'Open with a square bracket [.' }, b: { '*': 'The comma separates rows from columns.' }, c: { '*': 'Close with a square bracket ].' } },
        explain: `${cfg.code}: rows before the comma, columns after.`, rcheck: [{ setup: df, expr: cfg.code, expect: rows ? dfSpec(['age', 'n'], [[22, 1], [30, 2], [41, 3], [50, 4]].filter(x => x[0] > k)) : [1, 2, 3, 4] }] });
    }),
    streak('u7-na', 'Missing values', 'Tap the NA cells', 'NA means missing. is.na(v) is TRUE where a value is missing.', ctx => {
      const r = ctx.rng, v = ints(r, 1, 30, 6), na = ints(r, 0, 5, RG.int(r, 1, 2)); const vv = v.map((x, i) => na.includes(i) ? null : x);
      return E.pick(ctx, { prompt: 'Tap the cells that <code>is.na(v)</code> says TRUE for.', lead: [`v = ${rvec(vv)}`], mode: 'cell', grid: { data: [vv.map(shown)], index: true, cellW: 56 }, answer: na.map(i => `0,${i}`), explain: 'is.na is TRUE exactly where the value is NA.', rcheck: [R1('is.na(v)', vv.map(x => x === null), `v = ${rvec(vv)}`)] });
    }),
    streak('u7-narm', 'Skip the NA', 'na.rm = TRUE', 'sum(v) is NA if any value is NA. Add na.rm = TRUE to leave the missing ones out.', ctx => {
      const r = ctx.rng, f = RG.pick(r, ['sum', 'max', 'min']), v = ints(r, 1, 20, 3); const vv = [v[0], null, v[1], v[2]];
      return E.assemble(ctx, { prompt: `Get ${FN[f][0]} of v, <b>leaving out</b> the NA.`, lead: [`v = ${rvec(vv)}`], parts: [f + '(v', { slot: 'a' }, ' ', { slot: 'b' }, ' = ', { slot: 'c' }, ')'], tiles: [',', 'na.rm', 'TRUE', 'FALSE', 'NA', 'na.omit'], answer: { a: ',', b: 'na.rm', c: 'TRUE' },
        why: { b: { na: 'na.rm is the input that removes missing values.', '*': 'The input that removes missing values is called na.rm.' }, c: { FALSE: 'na.rm = FALSE keeps the NA, so the answer stays NA.', '*': 'na.rm = TRUE removes them.' }, a: { '*': 'A comma separates inputs.' } },
        explain: `${f}(v, na.rm = TRUE) ignores the NA.`, rcheck: [R1(`${f}(v, na.rm = TRUE)`, [FN[f][1](v)], `v = ${rvec(vv)}`)] });
    }),
  ],
};

// ======================================================================
// Unit 8: vectors in practice
// ======================================================================
const U8 = {
  id: 'u8', part: 1, title: 'Unit 8: Repeating and random', intro: 'Build vectors by repeating, and know when numbers are random.',
  subs: [
    tutorial('u8-first', 'rep repeats', 'Finish the row', 'rep(x, times = 3) repeats x three times.', ctx =>
      E.fill(ctx, { prompt: '<code>rep("a", times = 3)</code> repeats "a" three times. Finish the row.', lead: ['rep("a", times = 3)'], grid: { data: [['"a"', '"a"', '']], index: true, cellW: 56 }, blanks: { '0,2': '"a"' }, tiles: ['"a"'], tutorial: true, done: 'rep repeats whatever you give it.' })),
    streak('u8-eachtimes', 'times or each?', 'Predict the row', 'times = 2 repeats the whole vector twice. each = 2 repeats every item twice before moving on.', ctx => {
      const r = ctx.rng, k = RG.int(r, 2, 3), v = RG.sample(r, ['a', 'b', 'c'], k === 3 ? 2 : RG.int(r, 2, 3)), each = r() < .5, n = each ? 2 : (v.length === 3 ? 2 : RG.int(r, 2, 3)), out = [];
      if (each) v.forEach(x => { for (let i = 0; i < n; i++) out.push(x); }); else for (let i = 0; i < n; i++) v.forEach(x => out.push(x));
      const code = `rep(${rvec(v)}, ${each ? 'each' : 'times'} = ${n})`;
      return E.fill(ctx, { prompt: `Fill in what <code>${code}</code> makes.`, grid: { data: [out.map(() => '')], index: true, cellW: 56 }, lead: [code], blanks: Object.fromEntries(out.map((x, i) => [`0,${i}`, disp(x)])), tiles: v.map(disp), auto: true,
        explain: each ? `each = ${n}: every item ${n} times in a row: ${out.map(disp).join(' ')}.` : `times = ${n}: the whole vector ${n} times: ${out.map(disp).join(' ')}.`, rcheck: [R1(code, out)] });
    }, { target: 10 }),
    streak('u8-picture', 'Code from the picture', 'times or each, and how many', 'Look at the pattern: items that repeat side by side are each; the whole sequence that comes round again is times.', ctx => {
      const r = ctx.rng, base = RG.int(r, 0, 1) ? '1:3' : '1:2', bv = base === '1:3' ? [1, 2, 3] : [1, 2], each = r() < .5, n = base === '1:2' ? RG.int(r, 2, 3) : 2, out = [];
      if (each) bv.forEach(x => { for (let i = 0; i < n; i++) out.push(x); }); else for (let i = 0; i < n; i++) bv.forEach(x => out.push(x));
      return E.assemble(ctx, { prompt: 'Which call makes this row?', pic: strip(out), parts: [`rep(${base}, `, { slot: 'a' }, ' = ', { slot: 'n' }, ')'], tiles: ['times', 'each', '2', '3'], answer: { a: each ? 'each' : 'times', n: String(n) },
        why: { a: { each: 'The items do not repeat side by side here, the whole sequence comes round again: times.', times: 'Here the items repeat side by side: each.' }, n: { '*': `It repeats ${n} times.` } }, explain: `rep(${base}, ${each ? 'each' : 'times'} = ${n}) makes this row.`, rcheck: [R1(`rep(${base}, ${each ? 'each' : 'times'} = ${n})`, out)] });
    }),
    streak('u8-design', 'Participants and trials', 'A column for each design factor', 'In a long table every participant has several trials. Each participant number repeats side by side (each), the trial numbers come round again (times).', ctx => {
      const r = ctx.rng, [np, nt] = RG.pick(r, [[2, 2], [2, 3], [3, 2]]);
      const subj = [], trial = []; for (let p = 1; p <= np; p++) for (let t = 1; t <= nt; t++) { subj.push(p); trial.push(t); }
      const g = Grid({ data: [subj.map(String), trial.map(String)], rowHead: ['subject', 'trial'], cellW: 30, compact: true, label: 'two columns, written across: subject ' + subj.join(' ') + ', trial ' + trial.join(' ') });
      return E.assemble(ctx, { prompt: `${np} participants, ${nt} trials each. Which words make these two columns?`, pic: g.wrap, lines: [[`subject = rep(1:${np}, `, { slot: 'a' }, ` = ${nt})`], [`trial = rep(1:${nt}, `, { slot: 'b' }, ` = ${np})`]], tiles: ['each', 'times', 'by', 'length'], answer: { a: 'each', b: 'times' },
        why: { a: { '*': 'Each participant number should repeat side by side, once per trial: each.' }, b: { '*': 'The trial numbers 1, 2, ... come round again for each participant: times.' } }, explain: `subject = rep(1:${np}, each = ${nt}); trial = rep(1:${nt}, times = ${np}).`,
        rcheck: [R1(`rep(1:${np}, each = ${nt})`, subj), R1(`rep(1:${nt}, times = ${np})`, trial)] });
    }),
    streak('u8-recycle', 'Short vectors are recycled', 'Fill the short column', 'When one column is shorter, R repeats it from the start until it fills the table. 6 rows and a pair of values: x y x y x y.', ctx => {
      const r = ctx.rng, n = 4, pat = RG.sample(r, ['x', 'y', 'z'], 2), out = Array.from({ length: n }, (_, i) => pat[i % 2]);
      return E.fill(ctx, { prompt: 'Fill the <code>g</code> column.', lead: [`data.frame(id = 1:${n}, g = ${rvec(pat)})`], grid: { data: out.map((_, i) => [String(i + 1), '']), head: ['id', 'g'], compact: true }, blanks: Object.fromEntries(out.map((x, i) => [`${i},1`, `"${x}"`])), tiles: pat.map(x => `"${x}"`),
        explain: `The pair ${pat.join(', ')} is repeated down the column.`, rcheck: [{ setup: '', expr: `data.frame(id = 1:${n}, g = ${rvec(pat)})`, expect: dfSpec(['id', 'g'], out.map((x, i) => [i + 1, x])) }] });
    }),
    streak('u8-fit', 'Will it fit?', 'Recycle, or error?', 'A shorter column is recycled only if its length divides the longer one evenly. Otherwise R stops with an error.', ctx => {
      const r = ctx.rng, pairs = [[6, 2], [6, 3], [4, 2], [6, 4], [6, 5], [4, 3], [6, 1], [5, 2]], [n, m] = RG.pick(r, pairs), fits = n % m === 0;
      const opts = ['6 rows', '4 rows', '5 rows', 'error']; const show = [`${n} rows`, 'error', ...[4, 5, 6, 3].filter(x => x !== n).slice(0, 2).map(x => `${x} rows`)];
      return E.choice(ctx, { prompt: `What happens?`, pic: codebox([`data.frame(a = 1:${n}, b = 1:${m})`]), options: show, answer: fits ? `${n} rows` : 'error', explain: fits ? `${m} goes evenly into ${n}, so b is recycled and the table has ${n} rows.` : `${m} does not go evenly into ${n}, so R refuses: "arguments imply differing number of rows".`,
        rcheck: [fits ? R1(`nrow(data.frame(a = 1:${n}, b = 1:${m}))`, [n]) : { kind: 'error', setup: '', code: `data.frame(a = 1:${n}, b = 1:${m})`, contains: 'differing number of rows' }] });
    }),
    streak('u8-random', 'New numbers each run?', 'Random or fixed', 'runif, rnorm, sample and rbinom give new numbers every run. Plain values, 1:3 and rep are the same every time. After set.seed(n), random lines repeat too.', ctx => {
      const r = ctx.rng, rnd = ['runif(3)', 'rnorm(2)', 'sample(1:6, 1)', 'rbinom(1, 1, 0.5)'], fix = ['1:3', 'c(2, 4)', 'rep(1, 3)', 'sum(1, 2)'], seeded = r() < .25;
      const k = RG.int(r, 1, 3), lines = RG.shuffle(r, [...RG.sample(r, rnd, k), ...RG.sample(r, fix, 4 - k)]);
      const items = seeded ? ['set.seed(42)', ...lines] : lines, ans = seeded ? [] : items.map((l, i) => rnd.includes(l) ? i : -1).filter(i => i >= 0);
      return E.pick(ctx, { prompt: 'Run the script twice. Tap every line whose numbers <b>change</b> between runs.', mode: 'line', items, answer: ans, allowNone: seeded, noneLabel: 'None of them change',
        explain: seeded ? 'set.seed(42) fixes the random stream, so a re-run starts from the same place and gives the same numbers.' : 'The random generators give new numbers each run. Fixed values never change.', rcheck: [{ kind: 'random', lines: items, expect: items.map((l, i) => ans.includes(i)) }] });
    }, { target: 10 }),
    streak('u8-seed', 'What does set.seed fix?', 'Which results repeat?', 'set.seed(n) restarts the random stream at a fixed place. Every random line after it repeats in a re-run; lines before the first set.seed do not.', ctx => {
      const r = ctx.rng, g = RG.int(r, 0, 3), rand = ['a = runif(2)', 'b = runif(2)', 'c = runif(2)'], lines = [...rand]; lines.splice(g, 0, 'set.seed(1)');
      const ans = [0, 1, 2].filter(i => i >= g);
      return E.pick(ctx, { prompt: 'Run the whole script <b>twice</b>. Tap every variable that gets the same numbers both times.', lead: lines, mode: 'token', items: ['a', 'b', 'c'], answer: ans, allowNone: true, noneLabel: 'None of them repeat',
        explain: g === 3 ? 'set.seed(1) comes after every random line, so it cannot fix any of them.' : g === 0 ? 'set.seed(1) is above all three, so all repeat.' : `Only the lines after set.seed(1) repeat: ${ans.map(i => 'abc'[i]).join(', ')}. The ones before it are drawn from wherever the stream happens to be.`,
        rcheck: [{ kind: 'seedvars', lines, vars: ['a', 'b', 'c'], expect: [0, 1, 2].map(i => i >= g) }] });
    }, { target: 10 }),
  ],
};

// ======================================================================
// Unit 9: apply family
// ======================================================================
const U9 = {
  id: 'u9', part: 1, title: 'Unit 9: Doing something to each', intro: 'sapply and apply run one function over many items.',
  subs: [
    tutorial('u9-first', 'sapply runs it on each', 'Finish the row', 'sapply(items, f) runs f on each item.', ctx =>
      E.fill(ctx, { prompt: '<code>sapply(w, toupper)</code> runs toupper on each item. Finish the row.', lead: ['w = c("a", "b", "c")', 'sapply(w, toupper)'], grid: { data: [['"A"', '"B"', '']], index: true, cellW: 56 }, blanks: { '0,2': '"C"' }, tiles: ['"C"'], tutorial: true, done: 'One function, applied to each item in turn, with the results lined up in a new vector.' })),
    streak('u9-each', 'Do it to each', 'Predict sapply', 'sapply(v, f) runs f on each item in turn. toupper makes capitals, nchar counts letters, is.na asks if it is missing.', ctx => {
      const r = ctx.rng, f = RG.pick(r, ['toupper', 'nchar', 'is.na']); let items, out;
      if (f === 'is.na') { items = RG.shuffle(r, ['"a"', 'NA', '"b"', 'NA']).slice(0, 4); out = items.map(x => x === 'NA' ? 'TRUE' : 'FALSE'); } else { const w = RG.sample(r, ['a', 'bb', 'cat', 'do', 'ox'], 4); items = w.map(disp); out = f === 'toupper' ? w.map(x => disp(x.toUpperCase())) : w.map(x => String(x.length)); }
      const wv = `c(${items.join(', ')})`;
      return E.fill(ctx, { prompt: `Fill in what <code>sapply(w, ${f})</code> returns.`, lead: [`w = ${wv}`, `sapply(w, ${f})`], grid: { data: [out.map(() => '')], index: true, cellW: 56 }, blanks: Object.fromEntries(out.map((x, i) => [`0,${i}`, x])), tiles: [...new Set(out)], auto: true,
        explain: `${f} is run on each item and the answers are lined up: ${out.join(' ')}.`, rcheck: [R1(`unname(sapply(w, ${f}))`, out.map(x => x === 'TRUE' ? true : x === 'FALSE' ? false : x.startsWith('"') ? JSON.parse(x) : Number(x)), `w = ${wv}`)] });
    }),
    streak('u9-which', 'sapply or apply?', 'Items, rows or columns', 'sapply goes over the items of a vector or list. apply goes over the rows or columns of a table: 1 means rows, 2 means columns.', ctx => {
      const r = ctx.rng, t = RG.int(r, 0, 2), f = RG.pick(r, ['sum', 'max']), m = M(r, 3, 3);
      const mat = Grid({ data: m.map(rw => rw.map(String)), head: mHead(3), rowHead: mRows(3), compact: true, label: 'matrix m' }).wrap;
      if (t === 2) return E.assemble(ctx, { prompt: `Run <code>${f}</code> on <b>each item</b> of the vector v.`, lead: ['v = c(3, 8, 5)'], parts: [{ slot: 'f' }, `(v, ${f})`], tiles: ['sapply', 'apply', '1', '2'], answer: { f: 'sapply' }, why: { f: { apply: 'apply is for the rows or columns of a table. v is a plain vector.', '*': 'Use sapply for items of a vector.' } }, explain: `sapply(v, ${f})`, rcheck: [R1(`sapply(v, ${f})`, [3, 8, 5], 'v = c(3, 8, 5)')] });
      return E.assemble(ctx, { prompt: `Run <code>${f}</code> on <b>each ${t === 0 ? 'row' : 'column'}</b> of m.`, pic: mat, lead: [mSetup(m)], parts: [{ slot: 'f' }, '(m, ', { slot: 'a' }, `, ${f})`], tiles: ['apply', 'sapply', '1', '2'], answer: { f: 'apply', a: t === 0 ? '1' : '2' },
        why: { f: { sapply: 'sapply goes over items. For rows or columns of a table use apply.', '*': 'Use apply for a table.' }, a: { '*': `${t === 0 ? '1 means rows' : '2 means columns'}.` } }, explain: `apply(m, ${t === 0 ? 1 : 2}, ${f}): 1 = rows, 2 = columns.`, rcheck: [R1(`apply(m, ${t === 0 ? 1 : 2}, ${f})`, t === 0 ? m.map(rw => FN[f][1](rw)) : [0, 1, 2].map(j => FN[f][1](m.map(rw => rw[j]))), mSetup(m))] });
    }, { target: 10 }),
    streak('u9-count', 'How many results?', 'One result per row or column', 'apply(m, 1, f) gives one result per row; apply(m, 2, f) one per column; sapply(v, f) one per item.', ctx => {
      const r = ctx.rng, nr = RG.int(r, 2, 4), nc = RG.int(r, 2, 5), t = RG.int(r, 0, 2), m = M(r, nr, nc), n = RG.int(r, 3, 6);
      const code = t === 0 ? 'apply(m, 1, sum)' : t === 1 ? 'apply(m, 2, sum)' : `sapply(1:${n}, sqrt)`, ans = t === 0 ? nr : t === 1 ? nc : n;
      const lead = t === 2 ? [code] : [`m has ${nr} rows and ${nc} columns`, code];
      return E.count(ctx, { prompt: `How many results does <code>${code}</code> return?`, lead, pic: t === 2 ? null : Grid({ data: m.map(rw => rw.map(() => '')), compact: true, label: `matrix with ${nr} rows and ${nc} columns` }).wrap, answer: ans, max: 6, inputRows: nr,
        explain: `One result per ${t === 0 ? 'row' : t === 1 ? 'column' : 'item'}: ${ans}.`, rcheck: [R1(`length(${code})`, [ans], mSetup(m))] });
    }),
    streak('u9-paste', 'paste0 joins pieces', 'Build a name', 'paste0(14, "-null") glues its inputs with nothing between, and gives "14-null". Text pieces need quotes.', ctx => {
      const r = ctx.rng, e = RG.int(r, 11, 20), suf = RG.pick(r, ['-null', '-a', '_x']);
      return E.assemble(ctx, { prompt: `Build the name <b>"${e}${suf}"</b>.`, parts: ['paste0(', { slot: 'a' }, ', ', { slot: 'b' }, ')'], tiles: [String(e), `"${suf}"`, suf, String(e + 1)], answer: { a: [String(e), `"${e}"`], b: `"${suf}"` },
        why: { b: { [suf]: 'The text piece needs quotes.', '*': `The ending is "${suf}".` }, a: { '*': `The first piece is ${e}.` } }, explain: `paste0(${e}, "${suf}") gives "${e}${suf}".`, rcheck: [R1(`paste0(${e}, "${suf}")`, [`${e}${suf}`])] });
    }),
    streak('u9-drawer', 'Open the right drawer', '[[ ]] with paste0', 'lst[["14-null"]] opens the drawer with that name. paste0 can build the name for you.', ctx => {
      const r = ctx.rng, es = ints(r, 11, 20, 4, true), e = RG.pick(r, es), items = es.map(x => `${x}-null`);
      return E.pick(ctx, { prompt: `Tap the drawer that <code>lst[[paste0(e, "-null")]]</code> opens.`, lead: [`e = ${e}`], mode: 'drawer', single: true, items, answer: [es.indexOf(e)], explain: `paste0(${e}, "-null") is "${e}-null", and [[ ]] opens the drawer with that name.`,
        rcheck: [R1(`names(lst)[names(lst) == paste0(e, "-null")]`, [`${e}-null`], `lst = setNames(as.list(1:4), c(${items.map(x => `"${x}"`).join(', ')}))\ne = ${e}`)] });
    }),
    streak('u9-nested', 'sapply over drawers', 'Collect one thing from each', 'sapply(11:13, function(e) ...) runs the code once for each e. Each run opens one drawer.', ctx => {
      const r = ctx.rng, es = [RG.int(r, 11, 14)]; es.push(es[0] + 1, es[0] + 2); const ns = ints(r, 1, 9, 3);
      const code = `sapply(${es[0]}:${es[2]}, function(e) lst[[paste0(e, "-null")]]$n)`;
      const g = Grid({ data: es.map((e, i) => [`${e}-null`, String(ns[i])]), head: ['drawer', 'n'], compact: true, label: 'drawers and their n values' }).wrap;
      return E.fill(ctx, { prompt: 'Fill in what this returns: the <code>n</code> of each drawer in turn.', lead: [code], pic: g, grid: { data: [['', '', '']], index: true, cellW: 56 }, blanks: { '0,0': String(ns[0]), '0,1': String(ns[1]), '0,2': String(ns[2]) }, tiles: [...new Set(ns.map(String))], auto: true,
        explain: `e runs ${es.join(', ')}; each time one drawer is opened and its n is collected: ${ns.join(' ')}.`, rcheck: [R1(code, ns, `lst = list(${es.map((e, i) => `"${e}-null" = list(n = ${ns[i]})`).join(', ')})`)] });
    }),
  ],
};

const UNITS_P1 = [U0, U1, U2, U3, U4, U5, U6, U7, U8, U9];
