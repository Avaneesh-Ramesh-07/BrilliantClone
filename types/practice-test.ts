import { z } from "zod";

/**
 * Strict structured-output schema for an AI-generated practice test. Mirrors the
 * rules in types/ai-lesson.ts: uses `z.union` (NOT `z.discriminatedUnion`, whose
 * `oneOf` keyword OpenAI rejects) and NEVER `.optional()` — every field is
 * required (use `.nullable()` if a field must be absent), since strict mode
 * requires every property to appear in `required`.
 */

const numericProblemSpec = z.object({
  kind: z.literal("numeric"),
  conceptLabel: z.string(),
  prompt: z.string(),
  answer: z.number(),
  // A SINGLE, fully-NUMERIC arithmetic expression (NO variables/letters) that
  // math.js can evaluate to the final answer: use `^` for powers and explicit
  // `*` for multiplication, substituting EVERY value. (E.g. for the vertex of
  // y = -2x^2 + 8x at x = 2: "-2*(2)^2 + 8*2".) It must evaluate to this
  // problem's numeric `answer`; the server evaluates it with math.js and treats
  // that computed value as the authoritative answer, so it must independently
  // compute the answer (it WILL be checked).
  answerExpression: z.string(),
  // Short scaffold shown after a wrong attempt. Must NOT reveal the final
  // numeric answer; see buildPracticeTestSystemPrompt for the per-tier style.
  hint: z.string(),
  explanation: z.string(),
  correctFeedback: z.string(),
  incorrectFeedback: z.string(),
});

const mcProblemSpec = z.object({
  kind: z.literal("mc"),
  conceptLabel: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correctIndex: z.number().int(),
  // A SINGLE, fully-NUMERIC arithmetic expression (NO variables/letters) that
  // math.js can evaluate, using `^` for powers and explicit `*`, with EVERY
  // value substituted. It must evaluate to the NUMERIC VALUE that the correct
  // option represents. When the correct answer is inherently non-numeric (e.g.
  // a factored form), still give a numeric check when possible (e.g. the root
  // value); otherwise set it to the numeric value referenced by the correct
  // option. The server uses it (best effort) to confirm/correct correctIndex.
  answerExpression: z.string(),
  // Short scaffold shown after a wrong attempt. Must NOT reveal the correct
  // option; see buildPracticeTestSystemPrompt for the per-tier style.
  hint: z.string(),
  explanation: z.string(),
  correctFeedback: z.string(),
  incorrectFeedback: z.string(),
});

export const problemSpecSchema = z.union([numericProblemSpec, mcProblemSpec]);

export type PracticeProblemSpec = z.infer<typeof problemSpecSchema>;

export const practiceTestSpecSchema = z.object({
  title: z.string(),
  description: z.string(),
  problems: z.array(problemSpecSchema).min(4).max(12),
});

export type PracticeTestSpec = z.infer<typeof practiceTestSpecSchema>;
