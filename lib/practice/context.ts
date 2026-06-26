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
