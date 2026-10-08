# R from Zero (working title)

A phone-first game that teaches R from the very first line, in two parts: **Part 1, base R** (Game B1 in `../docs/level-plan.md`, ordered by the `Introduction_to_R` slides plus the simulation and apply chats) and **Part 2, tidy R** (Game B2, from the tidy R chat). No build step, no accounts, no server, no keyboard: open `index.html` from any static host. Progress is saved on the device only (`localStorage` key `rgame:v1`). `?seed=123` makes questions repeatable.

There is no console to type in, so every answer is built or read on screen:
- **tiles into the gaps of a statement** (tap a tile: it drops into the next gap; or drag it to a gap you choose; tap a filled gap to take it back),
- **tap what a bit of code picks** in a drawn vector, matrix or data frame (cells, rows, columns, a script's lines, the broken token in a line, a drawer),
- **fill cells** with value tiles (vectors, variable boxes, new columns, whole data frames),
- **set the row count** of a result with a stepper (a bin of row slivers), after which the real output table is drawn,
- **drag rows into group boxes**, **link matching keys**, **press Run on a belt** so a table visibly goes through each "and then" step, **fold** columns into rows.
Statistics are not taught: the game only teaches running a function and reading its output.

## What is in it (119 sub-levels, 22 units)

Each unit starts with a one-possible-move tutorial whose only control flashes. 5 right in a row (2 hearts); the key drills are 10 in a row. A short "where do I start?" (10 questions, no feedback, no points) is on the home screen.

### Part 1: base R
| Unit | Sub-levels (key drills marked **10**) |
|---|---|
| 0 Running a line | first Run, which line printed this, comments (`#`) |
| 1 Values | quotes make text, number/text/TRUE-FALSE, tap every text value, pick the comparison, `&` and `|` truth table |
| 2 Variables | a box with a name, fill the boxes, overwrite, which lines print, `=` / `<-` / `==` **10**, legal names |
| 3 Functions | inputs in brackets, name + round brackets, assign then show, named inputs, read the error and tap the broken part |
| 4 Vectors | `c()` row, draw the vector, commas and brackets, `a:b` ranges, comparison on every cell, `rev`/`sort` |
| 5 Picking from vectors | `v[3]`, which cell, several cells (`c()`, `2:4`, `-1`), `[ ]` vs `( )` **10**, test then pick (helper row), pick by a test, `|` vs `&` **10**, overwrite the picked cells |
| 6 Tables | `m[2, 3]`, row then column, whole row/column, `cbind` vs `rbind`, `colnames`, `$` and `[, n]`, same column two ways, build a data frame |
| 7 Files and packages | install vs `library` (which lines to re-run), working folder, `read.csv`, `nrow`/`ncol`/`length`/`head`, `df[test, ]`, the comma, `is.na`, `na.rm` |
| 8 Repeating and random | `rep`, `times` vs `each` **10**, code from the picture, participants x trials, recycling, will it fit, random or fixed **10**, what `set.seed` fixes **10** |
| 9 Doing something to each | `sapply`, predict `sapply`, `sapply` vs `apply` (1 rows, 2 columns) **10**, how many results, `paste0`, open the drawer `lst[[paste0(e, "-null")]]`, `sapply` over drawers |

### Part 2: tidy R
| Unit | Sub-levels |
|---|---|
| 10 What is one row? | one row one observation, find the row, find the variable, values hiding in headers (wide), one row is one what |
| 11 The pipe | run a pipe on the belt, `%>%` vs `+`, order matters, every step is a function call (spot the bare line) |
| 12 filter | which row survives, which rows stay, `&` vs `|` **10**, `between`/`!is.na`, write the filter |
| 13 select, rename, mutate | select keeps columns, which columns, "what changed" (before/after tables, name the verb) **10**, condition-in-select trap **10**, `rename(new = old)` |
| 14 mutate | `if_else`, `case_when`, `recode` (fill the new column) |
| 15 group_by and summarise | group_by labels (belt), **group_by alone: how many rows? 10**, rows into boxes, after summarise **10**, `n()`, `n()` vs `nrow(data)`, `na.rm` |
| 16 mutate or summarise | grouped mutate on the belt, repeated group value, which verb, **predict the row count 10** (every verb), the level at the end |
| 17 arrange, count, distinct | arrange on the belt, which row is first (`desc`), count/distinct row counts **10** |
| 18 joins | match the key, link rows to partners, rows after `left_join`/`inner_join`/`anti_join` **10**, `by = c("left" = "right")`, join or stack **10** |
| 19 pivots | fold the columns (animation), `pivot_longer` call **10**, rows after a pivot **10**, `pivot_wider` call **10** |
| 20 Whole pipelines | write from a description, base R to tidy translation **10**, concept right / syntax slip |
| 21 ggplot2 | add a layer, `+` vs pipe, which geom draws it, `aes()` |

Units open in order; the placement test can start you later (it starts at the unit after the last unit it tested and you passed, so it never skips untested material).

## Files
- `engine.js`: the reusable activities (`assemble`, `pick`, `fill`, `choice`, `count`, `sort`, `match`, `run`, `belt`, `fold`), the grid/table drawing, tap-or-drag (`dragify`), R value printing. Content-free.
- `part1.js`, `part2.js`: sub-level generators. `part2.js` also holds a tiny dplyr in JS (`filter`, `mutate`, `group_by`, `summarise`, `arrange`, `count`, `distinct`, `select`) so every pipeline answer is computed, and the placement list.
- `app.js`, `streak.js`, `sound.js`, `style.css`, `index.html`: the shared shell (as in `bayes/`).

## Checking it
```
cd r
python3 -m http.server 8202 &
export NODE_PATH=/opt/node22/lib/node_modules
node tools/collect.js 40 /tmp/rchecks.json && Rscript tools/check-r.R /tmp/rchecks.json   # every answer key, run in real R
node tools/stress.js 40       # 40 random questions per sub-level at 320x568, 360x640, 414x800: fit, right accepted, wrong refused
node tools/play.js            # full playthrough through the UI, real pointer drags/taps, keyboard, placement, hearts, persistence
node tools/audit.js           # sizes, contrast, names, focus, dialogs (port of bayes/tools/audit.js)
node tools/naive.js 150       # how often random / always-first / always-longest / same-rows-as-input / select-all would pass
```
- **Answer keys.** Every generator attaches `rcheck` records (R code plus the value the game expects). `tools/collect.js` records them from real questions, `tools/check-r.R` evaluates them in R and compares (vectors, data frames, matrices, printed output, error messages, which lines print, which are comments, which random lines change between runs, which variables `set.seed` makes repeat, legal names). Tidy pipelines are checked by running the exact displayed code in dplyr on the displayed data, so the "predict the rows" answers are R's, not the JS engine's. Last run: 4147 checks, 0 failed (R 4.3.3, dplyr 1.1.4, tidyr 1.3.1, ggplot2 3.4.4).
- Real tidyverse meta-package is not installed in this container; the packages the game actually uses (dplyr, tidyr, ggplot2) are, and are what was verified.

## Known limits / unverified
- ggplot2 items are checked for existence and parsing only (the plots drawn in the game are hand-drawn pictures, not R output).
- `recode()` is superseded by `case_when()`/`recode_values` in current dplyr but still works (checked); it is used because the chat used it.
- Console output in the game uses a narrow line width (`[1]` wrapping at about 28 characters), so it is not byte-identical to R's 80-column output.
- Left out on purpose (still in the plan): block-index arithmetic, units (days vs years), loop vs vectorised timing, `if`/`else` and writing a function, factors, lists in depth, `across()`/purrr, facets and error bars in ggplot2, other join types, stringr/lubridate. `v + 1` style vector arithmetic is replaced by whole-row comparisons and `rev`/`sort` to keep arithmetic off the learner.
- The text-choice sub-levels (kind of value, `join` choice, "one row is...", "which geom") use 3-4 short options after the idea has been shown; a naive "always first/last/longest" strategy passes at most about half of the questions of any sub-level (see `tools/naive.js`).
- Mascot and sound design are the shared placeholder ones; no licence file yet.

## Checked against `../docs/objections.md` (all 21 points)
- 1-4 size and fit: `tools/audit.js` (ported; 17px minimum including text in pictures, 44px targets, 36px on 320 wide, chart pictures >= 120px) reports no issues in 894 states; `tools/stress.js` confirms no scrolling at 320x568, 360x640, 414x800 before and after Check. Tables are capped at 5-6 rows and vectors at 7 cells so nothing is shrunk below size.
- 5 clear asks: every engine appends its exact action ("Tap...", "Drop the tiles into the gaps", "Set it with + and -") when a prompt does not already say one; prompts state the situation first. Not fully satisfied: some prompts are short for space ("How many rows does the result have?") and rely on the code and table shown above them.
- 6-7, 14: no repeated information (the previous duplicate "one row at the end" level was removed); tables show at most 5 rows, 3-4 columns.
- 8-11: direction and controls are plain taps/drags; the flashing control in each tutorial is the same one used later (tile, cell, Run, + button). Row counts use a flat bin of row slivers with - / + (>= 44px), and the real output table is shown after Check.
- 12-13: generators vary data, thresholds, operators and wording; two levels are deliberate scaffolds (helper row then no helper row for `v[test]`).
- 15-16 layout: stage content is centred; the feedback replaces the prompt in the same slot. Not fully satisfied: after Check the tile tray is hidden (and a count level swaps the input table for the output table) so the answer fits, which shifts content a little.
- 17, 21: names (pipe, mutate, summarise...) are explained after the tutorial or in the explanation; code shown is real R.
- 18: no typing; arithmetic is avoided (only counting of tiny whole numbers such as nchar or n()). 19: naive strategies measured, none above 50% (`tools/naive.js`). 20: neutral examples (letters, scores, coffee/tea, drawers).
