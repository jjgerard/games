# Bag of Shapes (working title)

A phone-first game that teaches Bayesian statistics from the very beginning, by trial and error. No build step, no accounts, no server: open `index.html` from any static host. Progress is saved on the device only.

**Status:** Units 0 to 6 are built, with a ten-picture placement test covering Units 0 to 5. Each unit opens when the one before it is finished. Unit 6 (trusting a fitted model) is an extra short unit; Stan, model comparison and the cognitive-model chapters are deferred (see `../docs/level-plan.md`). The book followed is Nicenboim, Schad and Vasishth; all examples are original.

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
| 8 | Many bags | tap the big bags to spread ten chips over four possible bags (2×2) |

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

## What is in Units 2 to 6
Same rules as before: something you move, drag, tap or place; tolerances not exact answers; 5 right in a row, 2 hearts; every new idea starts with a one-move tutorial whose only control flashes; the question, its answer state and Check fit 360x640 and 320x568 with no scrolling.

**Unit 2: Grids, samples and simulated data** (book ch. 3)
| Sub-level | You... |
|---|---|
| Chop a curve (tutorial) | tap Chop finer: 5 bars become 21 and follow the curve (grid approximation) |
| Tallest bar | drag a marker to the tallest bar of prior x likelihood (posterior) over 11 candidate shares |
| First samples (tutorial) | tap to draw 150 samples; the pile takes the curve's shape |
| Count the pile | slide a divider to the share of 300 samples left of a line (a posterior probability by counting) |
| Two steps (tutorial) | pick a share from a belief, then draw ten shapes (simulating from parameters) |
| Predict ten draws | bracket the count of circles in the next ten, 9 times in 10 (prior or posterior predictive; plugging in the average is refused) |
| Which simulation? | tap the prior or posterior predictive among three simulated histograms (the third ignores the uncertain share) |
| Too many cells (tutorial) | add an unknown: 7 cells become 49 (why grids stop working) |
| Move or stay? | a Metropolis walker: higher proposal moves, far lower proposal stays (why MCMC works) |

**Unit 3: Lines and noise** (book ch. 4). Seedlings and dough.
| Sub-level | You... |
|---|---|
| First marker (tutorial), Typical and spread | drag a marker (intercept-only model) and a second handle one spread above it |
| First line (tutorial), Fit by eye | drag line ends through the dots; within 3 cm of lm() at both ends |
| Add the noise | slide sigma until simulated dots scatter like real ones (a line is not the data; coefficient is not sigma) |
| Tame the slope | slide the prior spread of a slope until 90 to 99% of 25 prior lines stay in the plausible frame |
| Read the table | tap one of nine cells of a brms-style table (Est., l-95%, u-95% for Intercept, slope, sigma) |
| The fuzz | drag a marker to where posterior lines disagree most or least |
| Centre x | drag the zero line to where the intercept equals the average height |

**Unit 4: Groups and pooling** (book ch. 5). Apple trees, branches.
| Sub-level | You... |
|---|---|
| Slide to pool (tutorial) | slide pooling from none to complete; dots slide toward the all-trees average |
| Where does it land? | drag one tree to its partially pooled position (few branches or alike trees: close to the average) |
| Who moves most? | tap the tree moved most (distance and few branches both matter; the naive picks fail 2 in 3) |
| How much pooling? | set the pooling slider the data call for (balanced groups; ANOVA/lme4 weight) |
| Name the picture | tap the picture showing none, partial or complete pooling |

**Unit 5: Coding groups** (book ch. 6-7). The real regression picture: code on x, height on y.
| Sub-level | You... |
|---|---|
| Switch the coding (tutorial) | tap once: averages stay, the intercept dot moves |
| Find the intercept | drag the dot at code 0 (codes 0/1, 1/0, -1/+1, -.5/+.5, and 1/2 where it lies outside the groups) |
| Find the slope | drag the handle at code 1; slope = rise per +1 of code (full gap, half gap or reversed) |
| Which coding? | tap one of four codings from an intercept line and slope arrow |
| Prior for a slope | slide the prior spread to just cover the biggest slope this coding allows |

**Unit 6: Can I trust it?** (extra, not in the plan's book mapping)
| Sub-level | You... |
|---|---|
| Run the chains (tutorial) | tap to run four chains |
| Fuzzy caterpillar | tap the healthy trace among chains that disagree, drift or stray |
| Rhat and ESS | tap the row of a summary that should not be trusted |
| How much is prior? | slide to the prior's share of imagined against real shapes |
| Outgrow the prior | fewest draws until a flat and a firm prior agree to within 3 points |

## Placement test
Ten pictures, no feedback, ordered by unit: share of circles, flip it, rare bags (covers two-bag and several-draws), product (covers chips and Unit 1 names), pool-the-shapes shift, count the pile, predict ten draws, read the table, where does it land, find the intercept. The first one missed is where you start and everything before it is marked done (no points). It does not test grid peaks, MCMC walking, Unit 5 slopes or Unit 6, so a pass assumes those; the sub-levels stay replayable. Unit 6 always opens after Unit 5.

## Files
- `math.js`: the answers (posteriors, coverage, normal and beta-binomial, least squares, shrinkage). Pure, so it can be tested.
- `ui.js`: shapes, bags, the share bar, belief bar, shelf, frequency grid, chips, bar rows, belief curve, axis slider.
- `activities.js`: Unit 0 sub-levels. `unit1.js` ... `unit6.js`: Units 1 to 6. `placement.js`: the ten placement items.
- `ui2.js`: pieces for Units 2 to 6: `Plot` (axes plus draggable 44px handles over it), `BarStrip` (bars on a grid of candidate values), `Pile` (samples), `TracePlot`, `ParamTable`, `ShrinkStrip` (dots that slide toward a mean), `PickButtons`.
- `app.js`: screens, runner, placement, menu, saving.
- `streak.js`, `sound.js`: copied from `jjgerard/research-methods` (MIT, same author).

## Checking it
Every tool reads `PORT` (default 8123); this build was tested on 8201.
```
cd bayes
python3 -m http.server 8201 &
export PORT=8201 NODE_PATH=/opt/node22/lib/node_modules
node tools/play.js                                                   # plays every sub-level of Units 0-6 at 3 phone sizes, the 10-item placement (3 outcomes), pointer/keyboard use of the new controls
node tools/check-math.js | Rscript tools/check-math.R                # math.js against R: beta, normal, beta-binomial, lm, lme4, conjugate shrinkage
node tools/check-keys.js 40 | Rscript tools/check-keys.R             # the answer key of 40 generated questions per Unit 2-6 level, recomputed in R (dbeta/pbeta/integrate, lm, lmer, qnorm)
node tools/stress.js 60                                              # 60 random questions per streak sub-level on 320x568: fit, right answers accepted, wrong refused
node tools/audit.js                                                  # targets, fonts >= 17px (also inside pictures), contrast, names, alt text, dialogs, focus, on every screen and state
node tools/naive.js                                                  # how often tempting wrong strategies would be accepted
node tools/shot.js <sub-id> 320 568 out.png [reveal] [seed]          # screenshot a sub-level, and report overflow
```
`?seed=123` makes a run repeatable. Each controller exposes `solve()`, `solveWrong()` and `info` (the question's inputs and key) for the tools.

## Notes on the keys and naive strategies
- Intervals in the brms-style table use estimate +/- 1.96 SE from least squares (n = 30), not a real posterior; real brms output would differ slightly. R confirms the numbers against `lm()`.
- Partial pooling (4.1, 4.2) treats the variances as known (conjugate normal); 4.3 uses the ANOVA estimator, which equals lme4's REML fit for balanced groups (checked).
- Naive strategies (naive.js, 300 questions each): the "obvious" wrong answer is refused 100% of the time or close to it for every drag/slider level. Residual acceptance is inherent in binary or few-option items: always "moves" 57% (2.8), always the first picture about a third, pool-none or pool-all about half (4.3, the two regimes are equally common), "slope = B minus A whatever the coding" 45% (5.2), midway for the intercept 40% (5.1), ignoring the coding for the prior 32% (5.4). A 5-in-a-row streak makes these a few per cent at most.
- Tolerances: share 0.1, intercept 3 cm, slope 20% of the gap, pooled position 12% of the distance moved.

## Not done yet
- Mascot and sound design to match the sister games, and a proper logo; a licence file.
- Stan, model comparison, Bayes factors, cross-validation, cognitive models and meta-analysis (deferred in the plan); posterior predictive checks of a fitted regression; reporting.
- Not played by real learners: difficulty of the tolerance-based drags (pooled position, prior spread) is unverified on touch screens; the placement test is short and assumes the untested sub-levels listed above.
