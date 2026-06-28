/**
 * Conceptual hints for endless-practice questions, shown on a learner's FIRST
 * wrong attempt (before the correct answer is ever revealed). Mirrors the lesson
 * scaffolding: a first miss gets a nudge, not the solution.
 *
 * The generated practice questions don't carry an authored hint, so we derive a
 * deterministic, type- (and lightly topic-) appropriate nudge here. It points at
 * the strategy without giving the answer away.
 */

import type { PracticeQuestion } from "@/types/practice";

const FIND_MISTAKE_HINTS: Record<PracticeQuestion["topic"], string> = {
  equations:
    "Re-check each line against the one above it. Watch the sign when you move a term across the equals sign, and the division at the end.",
  graphing:
    "In y = mx + b, the number in front of x is the slope and the lone constant is the y-intercept, which sits at (0, b). Check each line against that.",
  quadratics:
    "The two numbers must BOTH multiply to the constant and add to the middle coefficient - and their signs decide the signs inside the factors.",
};

const ORDER_STEPS_HINTS: Record<PracticeQuestion["topic"], string> = {
  equations:
    "Undo the equation in reverse order: deal with the added/subtracted constant first, then divide off the coefficient, then check.",
  graphing:
    "Start by plotting the y-intercept, then use the slope as rise over run to step to a second point before drawing the line.",
  quadratics:
    "Find the number pair first, then write the factors, and verify by expanding them back out last.",
};

const ODD_ONE_OUT_HINTS: Record<PracticeQuestion["topic"], string> = {
  equations:
    "Solve each option for x. Three will land on the same value - the one that doesn't is the odd one out.",
  graphing:
    "Compare the feature the prompt names (slope, or passing through the origin). Three will share it; one won't.",
  quadratics:
    "Look at the highest power and the sign of the x² term. Three will match; one breaks the pattern.",
};

/** A first-miss hint for a practice question - strategy only, never the answer. */
export function hintForQuestion(question: PracticeQuestion): string {
  switch (question.type) {
    case "find-mistake":
      return FIND_MISTAKE_HINTS[question.topic];
    case "order-steps":
      return ORDER_STEPS_HINTS[question.topic];
    case "odd-one-out":
      return ODD_ONE_OUT_HINTS[question.topic];
    default:
      return "Take another look and try again.";
  }
}
