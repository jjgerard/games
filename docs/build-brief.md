# Build brief for the game-building agents

You are building part of a series of static, mobile-first learning games ("shapes and trial and error" style).
The finished, reviewed example is `bayes/` (Units 0-1). **Read `bayes/README.md`, `bayes/app.js`, `bayes/ui.js`,
`bayes/unit1.js`, `bayes/style.css`, `bayes/tools/*.js` first, and `docs/level-plan.md` for the level list and the
learner snags this series must target.** Source chats and course slides are in
`/root/.claude/uploads/3f954832-a63b-5b2f-b998-3bd0c4052c27/` (read-only, private: never copy them into the repo).

## Hard rules (the user has corrected these repeatedly)
- Vanilla JS + SVG, no build step, no accounts, no server. localStorage progress. `?seed=` makes questions repeatable.
- Mobile first. **Every question, its answer state and its Check button must fit 360x640 and 320x568 with no scrolling.**
- **No text smaller than the question text (17px), including text inside pictures.** Targets >= 44x44 (36 on 320 wide).
  Pictures you must read are big (a bag you count in is >= 80px wide). Contrast 4.5:1. Text alternatives for every
  information-bearing graphic. Dialog semantics, focus handling, keyboard use. `bayes/tools/audit.js` enforces this: port it.
- Make things **visual and manipulable** (drag, tap-to-place, tap-the-thing) rather than multiple-choice text questions.
  Where a text choice is unavoidable make it few, short options.
- Sub-levels: 5-in-a-row streak (10 for key drills), 2 hearts, bite-sized; **meet the idea before the name**;
  the first sub-level of anything new is a one-possible-move tutorial whose only control flashes.
- **No arithmetic** for the learner to do; non-contested, neutral examples; tolerances rather than exact answers where a drag is involved.
- Generators must not let a naive strategy pass (prior only, likelihood only, 50/50, always the first option, always the longest).
  Test this like `bayes/tools/naive.js`.
- Check every answer key against real R (R is installed: `Rscript`). Put the check in `<game>/tools/` and run it.
- Test like bayes: a playthrough at 360x640, 320x568, 414x800 (`play.js`), random-question stress (`stress.js`), the audit.
  Everything must pass before you report. Fix, do not weaken, the checks.
- Stay in your own directory. Do **not** run git commands (the parent commits). Do not edit other games' folders or `docs/`
  except to add a short `<game>/README.md`. Serve with `python3 -m http.server <your port>` for tests.
- Keep the shared look (copy the shell, `streak.js`, `sound.js`, `style.css` from bayes and adjust colours/name). Each game has a
  home, a units/levels screen, sub-level tiles that unlock in order, a help dialog, and progress saved under its own localStorage key.
- Write a concise README: what is in each unit/sub-level, how to run the tools, anything unverified.
- Finish with a short report: what is built, what passed, what you are unsure about, and any questions for the user.
