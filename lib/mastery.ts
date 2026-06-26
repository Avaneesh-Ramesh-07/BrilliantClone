import type { Problem, Step, MasteryResult } from "@/types/lesson";

/**
 * Tolerance for the mastery comparison. Thresholds like 0.67 are meant to read
 * as "2 out of 3", but 2/3 = 0.6667 is just below 0.67, which would wrongly fail
 * a learner who only missed one of three. A small epsilon makes 2/3 satisfy a
 * 0.67 gate without letting a meaningfully lower rate slip through.
 */
const MASTERY_EPSILON = 0.01;

/** Demo problems are guided walkthroughs and don't count toward mastery. */
export function isGraded(problem: Problem): boolean {
  // Throwbacks are low-stakes retrieval practice, not part of this step's grade.
  if ("throwback" in problem && problem.throwback !== undefined) {
    return false;
  }
  if (
    problem.type === "isolate-blocks" ||
    problem.type === "eliminate-blocks" ||
    problem.type === "pizza-share" ||
    problem.type === "two-step-share" ||
    problem.type === "balance-choice" ||
    problem.type === "variable-box" ||
    problem.type === "graph-intercept" ||
    problem.type === "slope-race" ||
    problem.type === "plot-point" ||
    problem.type === "parabola-balls" ||
    problem.type === "factor-quadratic" ||
    problem.type === "power-toggle" ||
    problem.type === "parabola-a-slider" ||
    problem.type === "vertex-formula"
  ) {
    return false;
  }
  return !(problem.type === "drag-to-solve" && problem.demo === true);
}

export function computeMastery(
  step: Step,
  firstAttempts: Record<string, boolean>
): MasteryResult {
  if (step.skipMasteryGate) {
    return { passed: true, rate: 1 };
  }

  const problemIds = step.problems.filter(isGraded).map((p) => p.id);
  const totalProblems = problemIds.length;

  if (totalProblems === 0) {
    return { passed: true, rate: 1 };
  }

  let firstAttemptCorrect = 0;
  for (const id of problemIds) {
    if (firstAttempts[id] === true) {
      firstAttemptCorrect++;
    }
  }

  const rate = firstAttemptCorrect / totalProblems;
  const passed = rate >= step.masteryThreshold - MASTERY_EPSILON;

  if (passed) {
    return {
      passed: true,
      rate,
      partialMasteryMessage:
        rate < 1 && step.partialMasteryMessage
          ? step.partialMasteryMessage
          : undefined,
    };
  }

  return {
    passed: false,
    rate,
    fallbackStepId: step.fallbackStepId,
    fallbackMessage: step.fallbackMessage,
  };
}
