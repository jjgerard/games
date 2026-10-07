# Bag of Shapes (working title)

A phone-first game that teaches Bayesian statistics from the very beginning, by trial and error. No build step, no accounts, no server: open `index.html` from any static host. Progress is saved on the device only.

**Status:** Unit 0 ("Shapes and counting") and Unit 1 ("Prior, likelihood, posterior") are built, plus a six-picture placement test for Unit 0. Units 2+ are still to do (see `../docs/level-plan.md`). Unit 1 opens when Unit 0 is finished.

## What is in Unit 0
Every sub-level is something you move or draw, not a list of options. Nothing asks you to multiply; answers are judged against a tolerance.

| # | Sub-level | You... |
|---|---|---|
| 0 | First draw | tap the flashing Draw button (the only possible move) |
| 1 | First slide | drag a divider along a bar (the only possible move) |
| 2 | Share of circles | slide a divider to a share, from a visible bag or a tally |
| 3 | How many draws? | choose a sample size, run 20 people, see how they scatter |
| 4 | Flip it | tap the group you are inside (circles, squares, dotted or plain), slide to a share; the reveal shows the flipped question has a different answer |
| 5 | Which bag? | one draw, two equally common kinds of bag; drag a thumb toward the kind you think it is, with a bar showing the split; reveal is ten imagined draws per kind |
| 6 | More draws | tap Draw on a hidden bag (one of the two shown) and update your belief draw by draw |
| 7 | Rare bags | the same, but one kind is scarce on a shelf of four or five bags |
| 8 | Many bags | spread ten chips over several possible bags |

## What is in Unit 1
The three pieces of a Bayesian update, built by hand before they are named (the names arrive in the explanation afterwards).

| # | Sub-level | You... |
|---|---|---|
| 0 | Before the draw | spread 10 chips to match how common each kind of bag is on a shelf (the prior) |
| 1 | What fits the draw? | build a stack per kind: how many of 10 draws would show this shape (the likelihood) |
| 2 | Put them together | spread chips after a draw; the reveal shows prior, likelihood and posterior as three rows of bars |
| 3 | Which is which? | tap the row that is the prior, the likelihood or the posterior |
| 4 | First imagined shape | tap the flashing + circle (the only possible move) |
| 5 | Imagined draws | match a dashed belief curve by adding imagined circles and squares (a Beta curve as pseudo-counts) |
| 6 | Real draws join in | drag a marker to where belief averages out after imagined and real shapes are pooled |
| 7 | Bracket the belief | drag two handles to hold the middle 90% of a curve (a credible interval) |

Run lengths follow Trial and Error: 5 right in a row, 2 hearts, and the question and its Check button fit a 360x640 (and 320x568) screen with no scrolling.

## Files
- `math.js`: the answers (posteriors, coverage). Pure, so it can be tested.
- `ui.js`: shapes, bags, the share bar, belief bar, shelf, frequency grid, chips, bar rows, belief curve, axis slider.
- `activities.js`: Unit 0 sub-levels and the placement test. `unit1.js`: Unit 1.
- `app.js`: screens, runner, placement, menu, saving.
- `streak.js`, `sound.js`: copied from `jjgerard/research-methods` (MIT, same author).

## Checking it
```
cd bayes
python3 -m http.server 8123 &
NODE_PATH=/opt/node22/lib/node_modules node tools/play.js        # plays every sub-level at 3 phone sizes
node tools/check-math.js | Rscript tools/check-math.R              # checks math.js against R (posteriors, Beta curves, quantiles)
NODE_PATH=/opt/node22/lib/node_modules node tools/stress.js 60    # 60 random questions per sub-level on a 320x568 phone: fit, right answers accepted, wrong refused
NODE_PATH=/opt/node22/lib/node_modules node tools/naive.js        # how often tempting wrong strategies would be accepted
```
`tools/play.js` uses each activity's `solve()`/`solveWrong()` to set the answer through the same component code the pointer uses, and separately tests a real pointer drag and arrow keys. `?seed=123` in the URL makes a run repeatable.

## Not done yet
- Mascot and sound design to match the sister games, and a proper logo.
- Units 1+ (Bayes' rule written out, beta-binomial, ...).
- The placement test only covers Unit 0.
- A licence file (the sister repos are MIT).
