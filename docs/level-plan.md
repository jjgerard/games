# Level plan (draft 2)

Status: planning only; nothing below is built except the early Bag of Shapes prototype (to be rebuilt).
Draft 2 replaces draft 1 after reading the Shapes build log, the Trial and Error chat, and the five FULL chats (glmer intercept, coding/simulation, Likert mixed model, tidy R, GitHub/sapply) plus the Introduction to R slides.

## Evidence base and its limits
- Introduction_to_R.pdf (62 slides); Shapes build log (dev thread only); Trial and Error chat (Levels 1-5, 27 disciplines).
- Full chats: glmer intercept (~1,150 lines), coding/simulation (~2,450), Likert mixed model (~2,100), tidy R (retained transcript; its first part is a compacted summary), GitHub/sapply (an abridged transcript, so thin).
- Small sample: five learning chats. Treat snags as hypotheses to test with placement and first-play data.
- **Reliability warning.** The assistant in those chats was not always right or consistent, so none of its replies is ground truth for game content. Examples seen: in the Likert chat it first said (1 | participant) assumes responses across questions are independent (a random intercept actually induces equal correlation among all of one participant's responses), recommended (1 | participant:question), then said it cannot be estimated (that part is right: one observation per participant x question), and it called a fixed question x time x population interaction "not estimable" without showing the cause; the rank deficiency was never diagnosed in the chat. In the coding chat the model formula `(1 * ifmatch | item)` looks like a typo for `+` and was never flagged. Every answer key in the games must be checked against a stats text and, where possible, by running the code.

## Common snags (re-run on full chats)
Ranked by how often and how stubbornly they recur.
1. **Link scale vs response scale** (3 chats). Intercept 4.38 read as a probability (.988); "I thought I could reconstruct the grand mean from the estimate"; an average of logits is not the logit of the average (her own example .2/.2/.6/.999 -> .50 vs .757); in her own simulation she added plogis(effect) to a probability; exp() vs plogis() (odds vs probability); "what do the odds mean".
2. **What is this number relative to? (reference point and coding).** Intercept is at x = 0, which for age 800-1200 is outside the data ("plugging in gives negative numbers"); she did not know whether her factors were coded +/-1 or +/-.5 (coefficient = full difference vs half); "everything is interpreted in relation to the intercept"; sign of a coefficient vs sign of a prediction ("negative effect but still positive log-odds"); which level is the reference (is ifmatch = 1 match? add or subtract the effect?); join direction `by = c("left" = "right")`.
3. **Test vs estimate.** "Is the estimate the difference from .5?" The test is against 0 on the link scale; the estimate is a value on the link scale. Conflated repeatedly.
4. **What is one row? (unit/level).** group_by() as aggregation; mutate vs summarise; wide vs long; one observation per participant x question makes participant:question variance inestimable.
5. **Concept right, syntax slot wrong** (tidy chat). Bare assignment after a pipe; condition inside select(); `mutate(x = x)`; `nrow(data)` vs `n()`; `by(` for `by = c(`; missing brackets. Concept scores run ahead of syntax scores.
6. **Verb choice among near neighbours.** select vs rename vs recode inside mutate; filter vs select; join vs bind_rows; "rows" vs "columns" slip.
7. **Model-formula notation.** (1 | a:b); both (1 | participant) and (1 | participant:question); "(1 | question) when question is fixed"; `*` vs `+` inside a random term; mapping a paper's variance-component line to lme4 syntax (she brought a table excerpt and asked "is that this line?").
8. **Errors as information about the design, and failing to find the cause.** "Rank deficient" persisted after removing an empty level; "levels of grouping factor must be < observations" meant one observation per cell. She tried adding terms before inspecting the design.
9. **Simulating from a model** (coding chat). Coefficient vs sigma ("which one is sigma?"); a regression line vs simulated data (no noise); lm for a bounded outcome; regressing in the wrong direction (wm ~ ac used to generate ac); units (days vs years); vector length mismatch and recycling (n vs participants); block-index arithmetic (1-8, 9-16, ...); rep(each=) vs rep(times=); clamping before qlogis(); loop + rbind slowness.
10. **Risk calibration.** "Is it disastrous if I leave out the question slope?" She wants to know how bad, and for which claim (pairwise comparisons were her main concern); adjusting for many comparisons was never raised.
11. **Old-habit pull** (tidy). Modify in place, `$`, ddply.
12. **Fear of irreversible actions** (git: "what if I make a change by mistake?"). Needs a safe sandbox with undo.
13. **apply/sapply and dynamic names** (paste0 + [[ ]]).

## How she learns (design signals)
- **Concrete numbers beat abstract explanation.** "I don't understand this" was resolved only when she proposed her own numbers (.2, .2, .6, .999). Every scale/coding level should let the player enter or drag numbers and see the effect.
- **Overload is real and stated:** "I don't have the spoons to understand this right now"; "don't change the variable names". Provide a low-effort path (fewer controls, keep her variable names in worked examples, one change at a time) and a "walk me through it again" replay.
- She asks for the simplest working model first, then wants to know what it costs ("what happens if I don't?"). Offer a simple version, then a "what does this cost?" reveal with severity tags.
- She self-corrects when the structure is shown (tidy quiz: concept right, syntax slips). Syntax drills should be scaffolded (tiles, blanks) rather than free typing.
- She asks for precedent (a paper that uses the structure). Optional "where is this used" links, not core.

## Conventions inherited from Shapes and Trial and Error
**Reuse**
- Static site, no build, no accounts, local progress, mobile-first, mascot, "?" help, About, README, versioned assets. Content in data files, engine content-free.
- Fixed progression, locked levels show only a number, sub-levels as cards, a few reusable activity types.
- N-in-a-row streak with hearts. User-tuned: 5 by default, 10 on key drills, 2 hearts everywhere, 3 on the hardest.
- Wrong moves refused with an explanation of which part was wrong; hint after 3 wrong in a row.
- Meet the idea before the name. Every question including Check fits 360x640 and 320x568 with no scrolling.
- Typed answers: no-server matcher, shows "Read as:", "did you mean...?". Nothing leaves the device.
- Interface accent kept far from category colours; mascot is not a category shape.

**Bite-size rule (from Shapes Level 1):** start with one thing on screen and one possible move, then the same action with more on screen; split any sub-level that introduces two actions; light the first legal move immediately; flash the control to use; order complexity single -> multiple -> both with item types mixed inside.

**Left out or changed in Trial and Error:** no arithmetic; no "1 in 50" formats (plain percentages, one number vs the rule, nothing borderline); no screen-time-and-language relation; nothing misread-able as misinformation (no diet/disease, drugs, crime and demographics, policy, group differences); effects either clearly present or exactly absent; <=3 x-levels and <=2 colours in interaction graphs; titles without a single discipline's name; check names against existing resources. Undecided by the user, so do not assume: correlation vs causation; sampling; "valid but not reliable".

**Implications**
- No arithmetic conflicts with the logit levels. Replace calculation with mapping on a number line: drag a probability and watch log-odds and odds move; drag bars on a logit axis and watch the mean marker (the .2/.2/.6/.999 effect) without computing.
- Trial and Error Level 5 already teaches "how likely is this data if H0 were true" without sums. Bayes Unit 0 starts there: two hypotheses (fair coin vs two-headed coin), same evidence, which is likelier?
- Hidden seeded truth with clearly-present/absent effects is the shared generator idea across Bayes, scales and mixed models. A "Simulate it, then refit and recover" activity answers snag 9.
- R on a phone: typing code is the weak point. Default to tap-to-assemble tiles, fill-in-the-blank, error-spotting, and "predict the output/row count"; typed matcher only where needed.
- Check coverage by simulating learners (Shapes' belief-model simulation) with these snags as the belief errors.
- Reuse the shell from the public jjgerard/research-methods repo (needs it attached to this session).

## Licence for Bayesian source material (Nicenboim, Schad, Vasishth)
- The book website states no licence or copyright holder. The GitHub repo bnicenboim/bayescogsci has an MIT LICENSE, "Copyright (c) 2025 Bruno Nicenboim" (keep the notice if code is reused).
- Unverified: whether the print publisher holds separate rights in prose or figures, and whether MIT is meant to cover prose.
- Plan: write original items; use the book as a syllabus and link each level to its chapter; no verbatim text, figures or exercises without asking the authors.

## Game A: Bayesian statistics
Placement test (about 10 items, no code, no arithmetic): proportions and a 2x2 table; P(A|B) vs P(B|A); base rate with natural frequencies; two-bag and fair-vs-two-headed-coin; prior x likelihood intuition; beta-binomial as pseudo-counts; credible vs confidence interval; "coefficient vs sigma" (simulation); why MCMC. Everyone defaults to Unit 0 below the book.

- **Unit 0 (before the book):** one-possible-move tutorial; tally draws; few vs many draws; conditional counts; flip the condition (P(A|B) vs P(B|A)); two bags, one draw; several draws accumulate; unequal bags (base rate); many possible bags (grid).
- **Unit 1 (ch. 1-2):** Bayes' rule; mass and density; binomial likelihood; Beta prior as pseudo-counts; posterior as compromise; credible interval. (Current prototype is about here.)
- **Unit 2 (ch. 3):** grid approximation; sampling from the posterior; **generate data from parameters** (prior and posterior predictive) with the "line vs simulated data" and "coefficient vs sigma" ideas; why MCMC.
- **Unit 3 (ch. 4):** intercept-only model; slope; priors on slopes; reading brms-style output; plotting the posterior.
- **Unit 4 (ch. 5):** hierarchical models and partial pooling (shared with mixed models).
- **Unit 5 (ch. 6-7):** contrast coding (shared with Game C level 5).
- **Deferred:** Stan, model comparison and Bayes factors, cross-validation, cognitive models, meta-analysis.
- **Typically included, not yet planned:** MCMC diagnostics (R-hat, traces, divergences), prior sensitivity, reporting.

## Game B1: R part 1, base R
Follows the slide order; the starred slides are the key drills.
1. Console: calculator; script vs console and running a line; comments.
2. Values: numbers, characters (quotes), TRUE/FALSE; comparisons; & and |.
3. Variables: assign; print vs assign; overwrite; naming; arithmetic.
4. Functions: operator vs function; arguments, order, named; assigning output.
5. Vectors: c(); 1:10 and 10:1; vector arithmetic.
6. Indexing: [4]; [] vs (); by condition; | vs &; overwrite selected values.
7. Tables: [row, col]; cbind/rbind; as.data.frame; colnames; `$` vs [, 1].
8. Files and packages: working directory; install once vs library each session; read.csv; View; head/str/summary; subset rows by condition; nrow/length; NA basics.
9. **Vectors in practice (new, from the simulation chat):** rep(each=) vs rep(times=); vector recycling and length mismatches; block index arithmetic; deterministic vs random (runif, rnorm, rbinom) and set.seed; units (days vs years); loop vs vectorised and why rbind in a loop is slow.
10. **Apply family (new, from the GitHub chat):** sapply vs apply; paste0 and [[ ]] to build names; nested sapply.
11. Optional: if/else, writing a function.
- Note: slides use `=` for assignment; tidy answers use `<-`. Pick one and accept both.
- Typically included, not yet planned: reading error messages, ?help, factor vs character, lists, RStudio projects and file paths.
- Statistics tests from the slides (binom.test, t.test, McNemar) move to the stats games; R part 1 only teaches "run a function and read its output".

## Game B2: R part 2, tidy R
0. What is one row? (observations vs variables; tidy data).
1. The pipe as "and then".
2. filter: &, |, between(), !is.na.
3. select vs rename; the "condition inside select" trap.
4. mutate: new column; if_else/case_when/recode (values, not names); "every step after a pipe is a function call".
5. group_by + summarise: group_by alone collapses nothing; n(); na.rm.
6. mutate vs summarise within a group: **predict-the-row-count drill**.
7. arrange, count, distinct.
8. Joins: left_join by=; by = c("left" = "right"); anti_join; bind_rows vs join.
9. Reshape: pivot_longer / pivot_wider (replaces melt/dcast).
10. ungroup and whole pipelines: read aloud ("what does one row represent at the end?"); write from a description; base -> tidy translation table (subset->filter, ddply->group_by+summarise, $->mutate, match->join, melt->pivot_longer).
11. ggplot2: layers with +, aes, geoms, summary data with error bars, facets.
12. Optional: across(), purrr, lists.
- Typically included, not yet planned: readr/tibbles, `|>`, stringr/forcats/lubridate, other join types, tidy-data checks.

## Game C: Regression, scales and mixed-effects models (stats; R only as the tool)
Proposed as two parts so the most frequent snag (scales) is fixed before random effects.
Short placement: link vs response scale; within vs between; fixed vs random.

**Part 1: Regression and scales**
1. Prediction from a line: intercept + slope x; units; why the intercept at x = 0 can be outside the data; centring.
2. Bounded outcomes: why a straight line escapes 0-1.
3. Three scales: probability, odds, log-odds. Drag one, watch the other two (no arithmetic). exp() vs plogis() as "which scale am I on?".
4. Averaging on the wrong scale: drag bars on the logit axis, watch the mean marker vs the mean probability (.2/.2/.6/.999 and generated variants). Ceiling cells have enormous leverage.
5. Reading a logistic table: test is against 0 on the link scale; estimate is not "difference from .5"; sign of coefficient vs sign of predicted log-odds; reference level (which level is 1?).
6. Coding: treatment vs sum; +/-1 vs +/-.5; "which coding did I use?" identified from the table; what the intercept is under each; coefficient = difference or half-difference.
7. Interactions: difference of differences; three-way = difference of those; main effects under an interaction; simple effects.

**Part 2: Mixed-effects models**
1. Why not just average? Non-independence; pseudo-replication.
2. Design table: within vs between; crossed vs nested; count observations per cell (table()).
3. Random intercepts: reading (1 | participant); what it implies (equal correlation among one person's responses); shrinkage.
4. Random-effects notation: (1 | a), (1 | a:b), (1 + x | a); `+` vs `*` inside a random term; both terms together; map a variance-component description to a formula.
5. Estimable or not? Replication per cell; "levels must be < observations" as a design fact; one observation per participant x question.
6. Fixed vs random: sampled levels vs the levels you care about; why using one factor as both is rarely sensible.
7. What does it cost? Simple vs maximal structure with severity tags ("how bad is it, and for which claim?").
8. Pairwise comparisons: what emmeans depends on; adjusting for many comparisons.
9. Debug the model: rank deficiency (inspect which columns drop: empty or aliased cells), singular fit, non-convergence, grouping-factor error. Rule: inspect the design before adding terms.
10. **Simulate it, then refit and recover:** set the true intercept, effects, subject SD; simulate on the logit scale; check the sigma/no-sigma difference for lm vs glmer; see whether the model recovers the truth.
11. Reporting: report the intercept without over-reading it.
- Typically included, not yet planned: model comparison (LRT/AIC), residual and assumption checks, p-values in lmer, crossed subjects x items, power by simulation, ordinal models for Likert data (the chat used lmer on ratings), multiple-comparison adjustment details.

## Deferred
Similarity-based interference in psycholinguistics. Git/GitHub (optional small safe-sandbox game).

## Open items
- Whether Game C stays one game in two parts or becomes two games.
- Real R in the browser (WebR) vs simulated checking.
- Whether to attach jjgerard/research-methods (and shapes) to reuse the shell.
