# Level plan (draft 1)

Status: planning only. Draft 1 predates the Shapes build log and the Trial and Error chat; the section "Conventions inherited from Shapes and Trial and Error" was added after reading them. The level lists below have NOT yet been re-run against them or against the full stats and R chats.

## Evidence base
- `Introduction_to_R.pdf` (62 slides): the course outline and the starred slides.
- `tidy_R_learning_progress.txt`: quiz transcript, ~18 items.
- `likert_mixed_model_chat_progress.txt` and `glmer_intercept_chat_progress.txt`: stats chats.
- `github_r_progress_summary.txt`: git and sapply session.
- Caveat: this is small. Four chats and one deck, so the snags below are hypotheses to test with the placement and first-play data.

## Common snags (cross-cutting)
1. **What is one row? (unit/level of analysis).** group_by() read as aggregation; mutate vs summarise; filter "doesn't change rows"; wide vs long; one observation per participant × question making participant:question variance inestimable.
2. **Relative to what? (reference point and direction).** left_join `by = c("left" = "right")`; "is the coefficient a difference from the intercept?"; what the intercept is under sum coding.
3. **Nonlinear scale.** Mean of logits is not logit of the mean (intercept 4.38 -> .988, but cell means average ~.5).
4. **Right concept, wrong slot in the syntax.** A bare `age_years = ...` after a pipe; `select(condition == "inf")` (a condition inside select); `mutate(x = x)`; `nrow(data)` vs `n()`; `by("a" = "b")`; missing ")". Concept scores are higher than syntax scores, so test them separately.
5. **Verb selection among near-neighbours.** select vs rename vs recode-in-mutate; filter vs select; join vs bind_rows.
6. **Errors are information about the data, not noise.** "Rank deficient" -> aliased/empty cells; "levels of grouping factor must be < observations" -> no replication within cell.
7. **Fixed vs random, and what the inferential goal needs** (pairwise comparisons -> covariance structure).
8. **Old-habit pull.** Modify-in-place, `$`, ddply. Needs translation tables, not just new vocabulary.
9. **Fear of irreversible actions** (git: "will I change the original?"). Games should be safe sandboxes with undo and reset.

Design rules that follow:
- A "predict the row count / shape of the output" trial is the repeated core drill for tidy R.
- Separate concept checks (multiple choice or click) from syntax checks (fill-in-blank, ordering, error-spotting).
- Seeded simulators with a hidden ground truth so the player can poke, guess, and be told.
- Every level: one idea, 3-5 trials, 2-4 minutes, instant feedback, name the term after they have felt it.
- Stats stays in the stats games even when it uses R. R games teach R only.

## Conventions inherited from Shapes and Trial and Error
Source: Shapes build log (dev thread only; Levels 9-12 in detail, earlier levels only via the summary) and the Trial and Error chat (Levels 1-5, 31 sub-levels, 27 disciplines).

**Format to reuse**
- Static site, no build, no accounts, progress saved on the device, mobile-first. Mascot, "?" help per activity, About page, README. Engine knows nothing about content; content lives in data files. Cache-busting version on every asset.
- Fixed progression; levels unlock in order; locked levels show only a number. Sub-levels as a card grid. A few reusable activity types, reused across levels.
- Streak mechanic: N correct in a row, with hearts (allowed mistakes). User-tuned values: 5 in a row by default, 10 for the key drill sub-levels; 2 hearts on every sub-level, 3 on the hardest. Shapes' final levels switch to limited attempts ("do you know it, not can you work it out").
- Wrong moves are refused and explained, saying which part was wrong. After 3 wrong in a row, a hint highlights something that fits.
- Meet the idea before the name (Mystery Level; "keep IV/DV out of 1b so the payoff isn't given away").
- Every question, including its Check button, must fit a 360x640 (and 320x568) screen with no scrolling. Redundant instruction lines get deleted to make it fit.
- Typed answers use a no-server matcher against the items in the description, shows "Read as: ...", and asks "did you mean...?" instead of marking wrong. Nothing leaves the device (About promises this).
- UI accent is kept well away from category colours so the interface never looks like it means something; the mascot is deliberately not a category shape.

**How the user shrinks steps (the "bite-size" rule)**
- Shapes Level 1 opened too high, so four tutorials were added: (1) two lone triangles, one possible drag; (2) the same, already joined, one possible cut; (3-4) the same actions with more pieces on screen. Nothing on screen but the one shape, so there is no wrong move available.
- On the first real join, the legal pair lights up immediately, not after two wrong moves. The control to press (scissors) flashes until used.
- Order complexity within a sub-level group, mixing item types inside each: single factor, then multi factor, then both.
- Lives vs corrections: early sub-levels give corrections, later ones a limit.

**What the user said to leave out or change (research-methods chat)**
- No arithmetic. "I don't want students to have to be multiplying things." Use obvious extremes (20 heads in a row, ten 6s) and map them to the null.
- No "1 in 50" style numbers (bigger = rarer is confusing). Plain percentages, one number compared to the rule; no borderline values (nothing between 4% and 6%).
- No screen-time-and-language relation, and nothing implying a connection between them. The phone-use example was left out of cross-sectional/longitudinal.
- Avoid anything that could be misread and cause misinformation: no diet/disease, drugs, crime and demographics, policy, or group differences between kinds of people. Use intuitive examples a second-year in that discipline would know; write limits into the sentence ("up to its elastic limit").
- Effects in generated graphs are either clearly present or exactly absent. At most 3 x-levels and 2 colours in the interaction graphs; every bar clearly visible.
- Titles must not carry one discipline's name once the game spans many; check names against existing resources and aim for a double entendre.
- Not decided by the user (do not assume): correlation vs causation; sampling and test-vs-filler items; "valid but not reliable" items.

**Implications for these games**
- Bayes Unit 0 must start with a one-possible-move tutorial and contain no arithmetic. Posteriors are compared visually or by sliders; at most "add the counts". This conflicts with parts of the book (ch. 2 onward), so book-level units need visual replacements for any multiplication.
- Trial and Error Level 5 already teaches "how likely is this data if H0 were true" with no sums. Bayes Unit 0 should start where that stops: two hypotheses (fair coin vs two-headed coin), same evidence, which is likelier? Then flip the condition.
- Mixed-models and Bayes graph items can reuse the generator idea: effects clearly present or exactly absent, with a hidden seeded truth.
- R on a phone: typing code is the weak point. Plan for tap-to-assemble code tiles, fill-in-the-blank and error-spotting as the default, and a typed-answer matcher with "Read as:" feedback only where typing is needed.
- Misconceptions are checked by simulating students (Shapes' belief-model simulation found which levels catch which errors). Do the same here with the snags from the chats once the full chats are in.
- Reuse the shell from the public `jjgerard/research-methods` repo rather than rebuilding it (needs the repo attached to this session).

## Licence for Bayesian source material (Nicenboim, Schad, Vasishth)
- Website states no licence and no copyright holder. It says the book, data and code are free online and the Rmd sources are released.
- GitHub repo `bnicenboim/bayescogsci` LICENSE: MIT, "Copyright (c) 2025 Bruno Nicenboim". MIT requires keeping the copyright and permission notice in copies or substantial portions.
- Unverified: whether the printed book's publisher holds separate rights in the prose or figures, and whether MIT is meant to cover the prose rather than just the code.
- Plan: write original items and examples; use the book as the syllabus and link to the chapter at each level; do not copy text, figures or exercises verbatim. If any of the book's code or data is reused, include the MIT notice. If you want verbatim reuse, ask the authors.

## Game A: Bayesian statistics ("Bag of Shapes" series)
Placement test (about 10 items, adaptive, no code): fractions and proportions; reading a 2x2 table; P(A|B) vs P(B|A) (links to the p(data|H0) slide); base rate with natural frequencies; two-bag Bayes; prior x likelihood intuition; beta-binomial; credible vs confidence interval; "why MCMC". Result places into a unit; the default start for everyone is Unit 0.

- **Unit 0, before the book (shapes and counts)**
  - 0.1 Tally draws; proportions.
  - 0.2 Few vs many draws: variability.
  - 0.3 Conditional counts ("given it's a circle...").
  - 0.4 Flip the condition: P(A|B) is not P(B|A).
  - 0.5 Two bags, one draw: which bag?
  - 0.6 Several draws accumulate.
  - 0.7 Unequal bags: base rate (prior).
  - 0.8 Many possible bags (grid of hypotheses): prior x likelihood, normalise.
- **Unit 1, book ch. 1-2:** Bayes' rule written out; probability mass and density; binomial likelihood; Beta prior; beta-binomial posterior; prior as pseudo-counts; credible interval. (The current Bag of Shapes is about 1.5-1.7.)
- **Unit 2, ch. 3:** grid approximation; sampling from the posterior; prior and posterior predictive checks; why MCMC.
- **Unit 3, ch. 4:** intercept-only model; slope; priors on slopes; reading brms-style output; plotting the posterior.
- **Unit 4, ch. 5:** hierarchical models and partial pooling (shared with the mixed-models game).
- **Unit 5, ch. 6-7:** contrast coding (shared with the mixed-models game).
- **Deferred:** Stan, model comparison and Bayes factors, cross-validation, cognitive models, meta-analysis.
- **Possibly missing vs typical tutorials:** MCMC diagnostics (R-hat, traces, divergences), prior sensitivity, reporting a Bayesian analysis, Bayes factor cautions.

## Game B1: R part 1, base R
Follows the slide order.
1. **Console:** calculator; script vs console and running a line; comments.
2. **Values:** numbers, characters (quotes), TRUE/FALSE; ==, !=, <, >; & and |.
3. **Variables:** assign; print vs assign (starred slide); overwrite; naming; arithmetic.
4. **Functions:** operator vs function; arguments, order, named; assigning output.
5. **Vectors:** c(); 1:10 and 10:1; vector arithmetic.
6. **Indexing:** [4]; [] vs (); by condition; | vs &; overwrite selected values.
7. **Tables:** [row, col]; cbind/rbind; as.data.frame; colnames; `$` vs [, 1].
8. **Files and packages:** working directory; install once vs library each session; read.csv; View; head/str/summary; subset rows by condition; nrow/length; NA basics.
9. **Bridge (optional):** sapply, paste0, [[ ]], for loop basics, writing a function.
- **Possibly missing vs typical tutorials:** reading error messages, `?help`, NA handling, factor vs character, str()/head(), seeds and random numbers, lists, if/else, loops, writing functions, RStudio projects and file paths.
- **Note:** slides teach `=` for assignment; the tidy chat answers use `<-`. Pick one and accept both.

## Game B2: R part 2, tidy R
0. **What is one row?** observations vs variables; tidy data.
1. The pipe as "and then".
2. filter (rows): &, |, between(), !is.na.
3. select vs rename; the "condition inside select" trap.
4. mutate: new column; if_else/case_when/recode (changing values, not names); the "bare assignment after a pipe" trap.
5. group_by + summarise: group_by alone collapses nothing; n(); na.rm; naming.
6. mutate vs summarise in a group: row-count prediction drill.
7. arrange, count, distinct.
8. Joins: left_join by=; by = c("left" = "right"); anti_join to find unmatched; bind_rows vs join.
9. Reshape: pivot_longer / pivot_wider (replaces melt/dcast).
10. ungroup and whole pipelines: read aloud and write from a description; base -> tidy translation table (subset->filter, ddply->group_by+summarise, $->mutate, match->join, melt->pivot_longer).
11. ggplot2: layers with +, aes, geoms, summary data with error bars, facets.
12. Optional: across(), purrr, lists. Not forcing loops into purrr.
- **Possibly missing vs typical tutorials:** readr/tibbles, native pipe `|>`, stringr/forcats/lubridate, missing-value handling, other join types, reshape edge cases, tidy-data checks.

## Game C: Mixed-effects models (stats; R used only for the models)
Short placement: within vs between, fixed vs random, independence.
1. Why not just average? non-independence; pseudo-replication.
2. Design table: within vs between; crossed vs nested; count observations per cell.
3. Random intercepts: reading (1 | participant); shrinkage and partial pooling (shared with Bayes Unit 4).
4. Random slopes: what is estimable given the replication you have; "levels must be < observations".
5. Fixed vs random: why one factor cannot be both here.
6. Coding: treatment vs sum; what the intercept is; coefficient = difference with +/-.5; interaction = difference of differences; 3-way = difference of those.
7. Link functions: log-odds; plogis; intercept is not the mean probability (generate variants of the .2/.2/.6/.999 example).
8. Interactions: why main effects mislead under a 3-way; simple effects; emmeans pairwise; what pairwise comparisons depend on.
9. Debug the model: rank deficiency, singular fit, non-convergence, grouping-factor error -> what each says about the data.
10. Reporting: put the intercept in the table without over-reading it.
- **Possibly missing vs typical tutorials:** model comparison (LRT/AIC), residual and assumption checks, p-values in lmer, crossed subjects x items, centring/scaling, ICC, power by simulation, ordinal models for Likert data (the chat used lmer on ratings).

## Deferred
Similarity-based interference in psycholinguistics (later). Git/GitHub (optional small game; decide later).

## Open items
- Shapes and research-methods games, plus the "don't include" list from the research-methods chat: not yet seen.
- Real R in the browser (WebR) vs simulated checking for the R games.
- Where the slides' Statistics section goes: proposed to the stats games, with R part 1 only covering running a function and reading its output.
