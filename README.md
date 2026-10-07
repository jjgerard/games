# Learning Games

Short, visual, mobile-first browser games that teach statistics and R from a much lower starting point than most tutorials. Static site: no build, no accounts, no server. Progress is stored in the browser.

| Game | Folder | Topic |
|---|---|---|
| Bag of Shapes | [`bayes/`](bayes/) | Bayesian statistics, from "what is a share?" to hierarchical models |
| R from zero | [`r/`](r/) | Part 1 base R, Part 2 tidy R |
| Models and scales | [`models/`](models/) | Part 1 regression and scales, Part 2 mixed-effects models |

The landing page is [`index.html`](index.html), with an [`about.html`](about.html) page.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

Any static host works (GitHub Pages: serve the repository root). `?seed=123` in a game's URL makes its questions repeatable.

## How the games are built

- Vanilla JavaScript and SVG, one folder per game, each with its own `README.md` listing every level.
- Levels are streaks (five right in a row, two hearts) with one-possible-move tutorials; ideas are met before they are named; answers are things you move, not text you choose.
- Answer keys are checked against R (`verify/`, and each game's `tools/`). Generators are tested so naive strategies do not pass.
- Each game has an automated playthrough, a stress test and an accessibility audit run at 360x640, 320x568 and 414x800. Text is never smaller than the question text (17px), targets are at least 44px, contrast meets WCAG AA.

Tests need Node with Playwright and Chromium. See each game's README, for example [`bayes/README.md`](bayes/README.md).

## Planning

[`docs/level-plan.md`](docs/level-plan.md) holds the evidence base (common learner snags, what earlier games did) and the level plans. [`docs/build-brief.md`](docs/build-brief.md) is the shared brief for building a game.

## Licence

MIT, see [`LICENSE`](LICENSE). The Bayesian game follows the order of Nicenboim, Schad and Vasishth, *An Introduction to Bayesian Data Analysis for Cognitive Science*; the examples and wording are original.
