# Models and scales

A phone-first game that teaches how to **interpret** regression and mixed-effects models, by trial and error. R is only the tool that produced the tables: nothing is typed, nothing is calculated by the player. No build step, no accounts, no server: open `index.html` from any static host. Progress is saved on the device only (`localStorage` key `models:v1`). `?seed=123` in the URL makes a run repeatable.

One game in two parts (decided in `../docs/level-plan.md`, Game C). 16 levels, 54 sub-levels, a four-picture placement test. The first sub-level of each level is a one-move tutorial whose only live control flashes. Other sub-levels need 5 right in a row (10 on the key drills: scale conversions, which average, reading a table, coding, which slope, estimability, finding the number in a printout, writing it up), 2 hearts. Every question, its answer state and its Check button fit 360x640 and 320x568 with no scrolling.

## Part 1: Regression and scales
| Level | Sub-levels (you...) |
|---|---|
| 1 A line makes predictions | ride a dot on a line; drag a dot to the height the line gives (at x, at x = 0, or where it reaches a height); drag a marker to where the intercept is read (uncentred: age 0, far outside the data; centred: the average age) |
| 2 Bounded outcomes | slide along a straight line until it predicts something impossible; find the first x where it leaves 0%-100% (the reveal draws the logistic S-curve from a real `glm` fit) |
| 3 Three scales | drag one marker on three linked lines (probability, odds, log-odds); move until a scale reads a number; tap `plogis` / `qlogis` / `exp` / `log` and see where the answer lands as a hollow ring |
| 4 Averaging on the wrong scale | drag one bar on the logit axis and watch two averages split (the .2/.2/.6/.999 effect); drag a marker to the average of the log-odds bars; say which flag is the probability the model reports; move one bar to land the average on a star |
| 5 Reading a logistic table | tap the number a question asks for in a drawn glm table (estimate, SE, z, p, which row); drag the group-B marker (baseline plus change) and read its probability (sign of the coefficient vs sign of the log-odds) |
| 6 Coding | switch coding on two group means; drag the intercept (height at code 0); tilt the line through both means and read the coefficient (half the gap for -1/+1); tap the coding that reproduces the table |
| 7 Interactions | drag a point until the lines stop being parallel; make lines parallel / one flat / mirror images; tap which rise the A coefficient is under treatment and sum coding; compare two panels (three-way = difference of differences) |

## Part 2: Mixed-effects models
| Level | Sub-levels (you...) |
|---|---|
| 8 Why not just average? | tap a person's dots; set a counter to the number of independent people (not dots); tilt a line to the trend within people (Simpson's pattern) |
| 9 Design tables | tap the cells a described design fills; label each factor within/between (the grid headers tint); pick the crossed or nested grid |
| 10 Random intercepts and shrinkage | lift a person's line; match three people's lines; slide to the mixed model and tap who moved most (positions are real `lme4` BLUPs) |
| 11 Random-effects notation | tap a tile into a formula; build the random part from a description (equivalent spellings accepted); tick the variance components a formula creates; spot the broken part; tap the table row a term makes |
| 12 Estimable or not? | see repeats make `(1 | subj:item)` estimable; tick which random terms a design can estimate; the same for a random slope |
| 13 Random slopes | tilt a person's line; say what varies (intercepts, slopes, both); trust the right interval bar (leaving a needed slope out) |
| 14 When the fit goes wrong | find the singular number in a printout (or "nothing wrong"); tap the empty cell that makes a coefficient drop; pick the best first move for a real lme4 message |
| 15 Reading lmer and glmer output | find the number a question asks for in a printout (real fits); drag to `plogis(Intercept)`: the middle person, not the mean of the dots |
| 16 Writing it up | fill a blank with the right call (`exp`, `plogis`, the raw number); pick the fair reading of an intercept |

## Files
- `math.js`: the answers (scales, glm/lm fits, coding, interaction effects, shrinkage, formula canonicalisation). Pure, so it can be tested.
- `ui.js`: plots and draggable handles, three linked scales, bars on the logit axis, model tables, design grids, tile builder, choices, chips, stepper, slider.
- `part1.js`, `part2.js`: every sub-level. `levels.js`: order and the placement test. `app.js`: screens, runner, help, saving. `streak.js`, `sound.js`, `style.css`: from `../bayes`.
- `pools.js`: **generated** by `tools/make-pools.R` from real `lme4` fits (printouts, shrinkage, standard errors). Do not edit by hand.

## Checking it
```
cd models
python3 -m http.server 8203 &
export NODE_PATH=/opt/node22/lib/node_modules
node tools/play.js            # plays every sub-level at 360x640, 320x568, 414x800: fit, wrong refused, right accepted, points, tutorials, pointer + keyboard, placement
node tools/stress.js 60       # 60 random questions per sub-level on a 320x568 phone: fit, right answers accepted, wrong refused
node tools/audit.js           # accessibility: targets >=44 (36 on 320), text >=17px incl. inside pictures, contrast, names, alt text, dialogs, focus
node tools/naive.js 300       # how often tempting wrong strategies would be accepted (must all be <= 60%)
node tools/dump-keys.js /tmp/keys.json 40 && Rscript tools/check-keys.R /tmp/keys.json   # every answer key recomputed in real R (lm, glm, lme4)
Rscript tools/make-pools.R    # regenerate pools.js (about a minute)
```

## What was verified in R (tools/check-keys.R, R 4.3.3, lme4 1.1.35.1)
All answer keys are produced by the real generators in the browser and recomputed in R: scale functions and `pnorm`/`qnorm`; the four codings with `lm` (also unbalanced); `lm` intercept at 0 and at the mean; `lm`/`glm` lines and the crossing point in the bounded-outcome level; log-odds mean vs log-odds of the mean; glm table relations (z = est/SE, p = 2 pnorm(-|z|)); `lm(y ~ A*B)` and `lm(y ~ A*B*C)` coefficients for the simple, average and three-way effects; within-person trend = `lm(y ~ x + id)` = mean of person slopes; common-slope offsets = `lm(y ~ 0 + id + x)`; whether `lme4` accepts a term (levels < observations; observations > random effects) for every generated design; `isNested` for the nested/crossed grids; NA coefficients = empty cells in a saturated `lm`; median/mean of people's probabilities by `integrate`; `lme4`'s own parser (`lFormula`) for the variance components of each formula and for equivalent spellings (same logLik); `VarCorr` rows for the table level; BLUP shrinkage formula; coverage of the +-2 SE interval with and without a needed random slope; variance pattern of parallel / fanning / mixed person lines.

Things the checks found, now in the game: `(1 * cond | id)` does **not** mean `(1 + cond | id)`: R reads `1 * cond` as `1`, so the random slope silently vanishes (the typo in the coding chat was therefore a real error, not a harmless one). Without brackets (`y ~ cond + 1 | subj`) the bar splits the whole formula and the fixed effect of `cond` disappears. `(1 | cond)` on a fixed two-level factor fits with "not uniquely determined" warnings. A random slope for a factor that never varies within a person is *not* refused by lme4 (it fits), but the slope variance and correlation are not identified (equal deviance at different parameters), so the game marks it as not estimable and says why.

## Not done / unverified
- Sub-levels for the plan's "pairwise comparisons / emmeans" and "simulate it, then refit and recover" are not built. "What does it cost?" is covered only for the random slope (level 13); "fixed vs random" only through the broken-formula and notation sub-levels.
- The drawn lmer random-effects table shows SD (and Corr) only, not Variance, to fit a 320px screen.
- Some pool-backed items (printouts, singular examples) cannot be refit in the check because the pool stores summaries, not data; they are checked for internal consistency (z = est/SE, p from z, a "singular" example really shows a 0 SD or a +-1 correlation, a healthy one does not) and were produced by real `lme4` fits.
- Teaching judgements that are not R facts: "simplify first" as the best response to a singular fit; "wider bar" as the one to trust when people differ in their effect (supported by the coverage simulation: about 73% vs 95% for a nominal 95% interval in the simulated setting).
- No sound design, mascot or logo beyond a placeholder; no service worker (deliberate, as in the other games).
