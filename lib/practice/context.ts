/**
 * Serializes a generated sandbox question into a compact, provider-agnostic
 * `PracticeProblemContext` for the AI photo-feedback route. This is what tells
 * the tutor model what the learner was solving and what the correct reasoning
 * is, so its feedback on their handwritten work is grounded and specific.
 */

import {
  PracticeProblemContext,
  PracticeQuestion,
  QUESTION_TYPE_LABELS,
  TOPIC_LABELS,
} from "@/types/practice";
import type { VerifiedPracticeProblem } from "@/types/practice-test";

/** Pretty-prints a computed value: integers as-is, else trimmed to 6 decimals. */
function formatNumber(value: number): string {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) return String(rounded);
  return String(Math.round(value * 1e6) / 1e6);
}

/**
 * Serializes a VERIFIED PRACTICE-TEST problem into the same
 * `PracticeProblemContext` the photo-feedback route consumes, so the runner can
 * reuse endless practice's "upload your work" feature. The word-problem prompts
 * don't match the ground-truth label grammar, so we pass the deterministically
 * verified answer via `correctAnswer` (the computed numeric value, or the
 * correct option's text for multiple choice) and let `computeGroundTruth` fall
 * back to it. options/correctIndex are folded into that answer so the tutor
 * model still grades the handwritten work against the real solution.
 */
export function serializePracticeTestProblem(
  problem: VerifiedPracticeProblem
): PracticeProblemContext {
  const correctAnswer =
    problem.kind === "numeric"
      ? formatNumber(problem.computedAnswer ?? problem.answer)
      : problem.options[problem.correctIndex] ?? "";
  return {
    topicLabel: problem.conceptLabel || "Practice test",
    typeLabel:
      problem.kind === "numeric"
        ? "Numeric word problem"
        : "Multiple-choice word problem",
    prompt: problem.prompt,
    // The runner's prompt IS the exact problem to solve (no separate label).
    problemLabel: problem.prompt,
    correctAnswer,
    explanation: problem.explanation,
  };
}

export function serializeProblem(q: PracticeQuestion): PracticeProblemContext {
  const base = {
    topicLabel: TOPIC_LABELS[q.topic],
    typeLabel: QUESTION_TYPE_LABELS[q.type],
    prompt: q.prompt,
    explanation: q.explanation,
  };

  switch (q.type) {
    case "find-mistake":
      return {
        ...base,
        problemLabel: q.problemLabel,
        steps: q.steps,
        mistakeIndex: q.mistakeIndex,
      };
    case "order-steps":
      return {
        ...base,
        problemLabel: q.problemLabel,
        steps: q.steps,
      };
    case "odd-one-out": {
      const odd = q.options.find((o) => o.id === q.oddId);
      return {
        ...base,
        options: q.options.map((o) => o.text),
        oddAnswer: odd?.text,
      };
    }
  }
}
