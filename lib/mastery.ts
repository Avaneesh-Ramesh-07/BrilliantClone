import type { Step, MasteryResult } from "@/types/lesson";

/**
 * Returns true when the step can no longer reach its mastery threshold given
 * the first attempts recorded so far — i.e. even getting every remaining
 * problem right would leave the first-attempt rate below the threshold. Used to
 * regress the learner immediately instead of waiting for the step to finish.
 */
export function isMasteryImpossible(
  step: Step,
  firstAttempts: Record<string, boolean>
): boolean {
  if (step.skipMasteryGate) return false;

  const ids = step.problems.map((p) => p.id);
  const total = ids.length;
  if (total === 0) return false;

  let attempted = 0;
  let correct = 0;
  for (const id of ids) {
    if (id in firstAttempts) {
      attempted++;
      if (firstAttempts[id]) correct++;
    }
  }

  const remaining = total - attempted;
  const maxAchievableRate = (correct + remaining) / total;
  return maxAchievableRate < step.masteryThreshold;
}

export function computeMastery(
  step: Step,
  firstAttempts: Record<string, boolean>
): MasteryResult {
  if (step.skipMasteryGate) {
    return { passed: true, rate: 1 };
  }

  const problemIds = step.problems.map((p) => p.id);
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
  const passed = rate >= step.masteryThreshold;

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
