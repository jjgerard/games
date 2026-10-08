# What the user has objected to so far (a pre-flight checklist)

Every item below was a real correction on Bayes Units 0-1 (or on the earlier Shapes / Trial and Error games). Check each new
sub-level against ALL of them before calling it done, and write what you checked in the README. If a level is likely to
draw an objection you cannot avoid, say so in your report instead of shipping it silently.

## Size and legibility
1. **Pictures too small.** Anything you must read or count (bags, shelf bags, grids, dots, plots, table cells) must be big enough to see
   at a glance on a 360x640 phone. Bags you count in: >= 80px wide; shelf bags >= 56px; shapes inside >= 9px. If it does not fit,
   cut how much is shown (fewer shapes: 5 per bag, 4x3 grids, 4-5 bags on a shelf) rather than shrinking it.
2. **Buttons and handles too small.** >= 44x44 (36 on 320 wide). Draggable handles too.
3. **Text smaller than the question text.** Nothing, including text inside pictures and axis ticks, below 17px.
4. Everything (question, answer state, Check) fits without scrolling at 360x640 and 320x568.

## Clarity of the ask
5. **"I don't understand what is being asked."** The prompt must say (a) the situation in plain words and (b) the exact action
   ("Drag...", "Tap...", "Put 10 chips..."). Read it as someone who has seen nothing before. No unexplained jargon, no
   labels that look like part of the answer. When a level has two parts (shelf + bags), the picture must make the link obvious.
6. **Info that repeats what the picture already shows.** No % labels next to shapes that show the same thing, no pictures that add nothing
   (a closed bag when the real bags are the point), no shelf when the answer is always 50/50. If two things say the same, drop one.
7. **Unneeded options.** Do not show a 4th/5th thing to track when 3 will do. Too many bags/items to estimate made a level too hard.

## Controls must match intuition
8. **Direction.** Dragging toward something must mean "more of that". Never make the learner move away from what they favour.
9. **First action is flashing.** In a one-possible-move tutorial the control that flashes must be the *same* control used later
   (the normal Draw button), not a special tile. If a learner might try the wrong gesture (drag instead of tap), make the right
   control obvious.
10. **Chips / quantities.** Flat stacks of chips with - / + buttons; the correction shows as a green stack beside yours. No tap-the-bag,
    no corner badges, no tiny +/-.
11. **Keep the visual from the previous level** when the idea carries on (same two big bags), rather than redrawing it a new way.

## Variety and redundancy
12. **Boring repetition.** If the same question appears every time, vary what is asked (different conditionals, different groups, different
    numbers), as long as each variation tests the same idea.
13. **Duplicate levels.** Two sub-levels that teach the same thing should be one. Ask "what does this level teach that the previous one did not?"
14. **Too much to eyeball.** A grid or count the learner is meant to judge by eye should be small (4x3, not 5x5).

## Layout polish
15. **Off-centre or unevenly spaced.** Everything centred in its column; extra elements (such as "Drawn: shapes") sit evenly in the
    space between the content above and the Check button. Test several phone widths, including tall narrow ones.
16. **Layout shifts.** Nothing jumps when feedback appears.

## Learning design (from the user's own earlier chats)
17. **Meet the idea before the name.** The word (prior, likelihood, intercept, pipe...) arrives after the learner has built it.
18. **No arithmetic**, no typing of code; a visual answer, judged with tolerance.
19. **A naive strategy must not pass** (always the first option, always 50%, always the longest, ignore the evidence). Test it.
20. **Non-contested, neutral examples.** Bite-sized sub-levels; 5-in-a-row (10 for key drills); 2 hearts.
21. **Notation the learner will actually meet** (formula, table, output) appears only after the picture, and uses what real R prints.

## What the user is likely to say about the next units (be proactive)
- "The picture is too small / I cannot see what to count." -> enlarge, show fewer items.
- "I don't understand what the question is asking." -> rewrite the prompt with the situation + the exact action.
- "This level is the same as the last one." -> merge or differentiate.
- "Why is this shown? It tells me the answer / repeats the picture." -> remove.
- "The control moves the wrong way / is fiddly." -> direct manipulation, big handles, same direction as intent.
- "It's boring / too many of the same." -> vary the question, shrink the task.
- "Too many things to estimate." -> cap at 3-5.
- "Something is off-centre / not evenly spaced." -> centre, test at several widths.
