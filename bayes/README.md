# Bag of Shapes (working title)

A phone-first game that teaches Bayesian statistics from the very beginning, by trial and error. No build step, no accounts, no server: open `index.html` from any static host. Progress is saved on the device only.

**Status:** Unit 0 ("Shapes and counting") is built: two one-move tutorials, eight puzzle sub-levels, and a six-picture placement test. Units 1-3 are placeholders (see `../docs/level-plan.md`).

## What is in Unit 0
Every sub-level is something you move or draw, not a list of options. Nothing asks you to multiply; answers are judged against a tolerance.

| # | Sub-level | You... |
|---|---|---|
| 0 | First draw | drag the flashing tile out of the bag (the only possible move) |
| 1 | First slide | drag a divider along a bar (the only possible move) |
| 2 | Share of circles | slide a divider to a share, from a visible bag or a tally |
| 3 | How many draws? | choose a sample size, run 20 people, see how they scatter |
| 4 | Inside a group | tap the group you are inside (circles, squares, dotted or plain), then slide to a share; a different question each time |
| 5 | Flip it | same, either way round; shows the two directions differ |
| 6 | Which bag? | one draw, two kinds of bag; drag a thumb toward the kind you think it is, with a bar showing the split; reveal is ten imagined draws per bag |
| 7 | More draws | drag shapes out of a closed bag and update your belief draw by draw |
| 8 | Rare bags | a scarce kind of bag; base rate vs the obvious guess |
| 9 | Many bags | spread ten chips over several possible bags |

Run lengths follow Trial and Error: 5 right in a row, 2 hearts, and the question and its Check button fit a 360x640 (and 320x568) screen with no scrolling.

## Files
- `math.js`: the answers (posteriors, coverage). Pure, so it can be tested.
- `ui.js`: shapes, bags, the draggable share bar, shelf, frequency grid.
- `activities.js`: every sub-level and the placement test.
- `app.js`: screens, runner, placement, menu, saving.
- `streak.js`, `sound.js`: copied from `jjgerard/research-methods` (MIT, same author).

## Checking it
```
cd bayes
python3 -m http.server 8123 &
NODE_PATH=/opt/node22/lib/node_modules node tools/play.js        # plays every sub-level at 3 phone sizes
node tools/check-math.js | Rscript tools/check-math.R              # checks math.js against R
```
`tools/play.js` uses each activity's `solve()`/`solveWrong()` to set the answer through the same component code the pointer uses, and separately tests a real pointer drag and arrow keys. `?seed=123` in the URL makes a run repeatable.

## Not done yet
- Mascot and sound design to match the sister games, and a proper logo.
- Units 1+ (Bayes' rule written out, beta-binomial, ...).
- The placement test only covers Unit 0.
- A licence file (the sister repos are MIT).
