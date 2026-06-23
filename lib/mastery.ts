import type { Step, MasteryResult } from "@/types/lesson";

export function computeMastery(
  step: Step,
  firstAttempts: Record<string, boolean>
): MasteryResult {
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
