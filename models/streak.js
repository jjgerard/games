// The "10 correct in a row" scoring engine every sub-level runs on (the
// same one as the quizzes in Shapes and Language). A wrong answer resets
// the streak to zero, so a sub-level is only done once 5 straight answers
// land. Reward AND penalty scale with the CURRENT bonus tier -- the streak
// going into this question -- so a wrong guess at a high streak is a real
// loss, not a free reroll. That's what stops a run of 5 being fished for
// by guessing: most questions here have only two possible answers.
const STREAK_TARGET = 5;
const STREAK_BASE_POINTS = 10;
const STREAK_TIER_SIZE = 3; // every 3-in-a-row doubles the multiplier

// A run can allow a set number of misses (shown as hearts): a
// wrong answer then costs points and a heart, but the run carries on. Only
// running out of hearts resets it -- and refills them.
class StreakGame {
  constructor(target = STREAK_TARGET, allowedMisses = 0) {
    this.streak = 0;
    this.target = target;
    this.allowedMisses = allowedMisses;
    this.missesLeft = allowedMisses;
  }
  multiplier() {
    return Math.pow(2, Math.floor(this.streak / STREAK_TIER_SIZE));
  }
  // Apply a correct/incorrect answer; returns {pointsDelta, streak,
  // progress (0-1), complete, multiplier (the one this answer scored at),
  // forgiven (a miss that cost a heart instead of the run)}.
  answer(correct) {
    const multiplier = this.multiplier();
    const pointsDelta = (correct ? 1 : -1) * STREAK_BASE_POINTS * multiplier;
    let forgiven = false;
    if (correct) this.streak += 1;
    else if (this.missesLeft > 0) { this.missesLeft -= 1; forgiven = true; }
    else { this.streak = 0; this.missesLeft = this.allowedMisses; }
    return {
      pointsDelta,
      multiplier,
      forgiven,
      streak: this.streak,
      progress: Math.min(1, this.streak / this.target),
      complete: this.streak >= this.target,
    };
  }
}
