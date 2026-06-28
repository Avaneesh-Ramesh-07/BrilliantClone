import { z } from "zod";
import type { Lesson } from "@/types/lesson";

/**
 * Strict structured-output schema for an AI-generated practice test. Uses
 * `z.union` (NOT `z.discriminatedUnion`, whose `oneOf` keyword OpenAI rejects
 * in strict structured outputs) and NEVER `.optional()`, every field is
 * required (use `.nullable()` if a field must be absent), since strict mode
 * requires every property to appear in `required`.
 */

const numericProblemSpec = z.object({
  kind: z.literal("numeric"),
  conceptLabel: z.string(),
  // Integer 1-10 self-rated difficulty (1 = easiest, 10 = hardest). Instructed
  // in the prompt and clamped server-side to [1,10]; used to order the test so
  // it gets progressively harder. Strict-mode requires it; never `.optional()`.
  difficulty: z.number().int(),
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
  // Integer 1-10 self-rated difficulty (1 = easiest, 10 = hardest). Instructed
  // in the prompt and clamped server-side to [1,10]; used to order the test so
  // it gets progressively harder. Strict-mode requires it; never `.optional()`.
  difficulty: z.number().int(),
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
  problems: z.array(problemSpecSchema).min(15).max(22),
});

export type PracticeTestSpec = z.infer<typeof practiceTestSpecSchema>;

// --- Verified problems (post deterministic verification) ------------------

/**
 * Outcome of the deterministic answer-key verification for one problem:
 * - "verified":     the key was confirmed by a machine computation (math.js),
 *                   so the UI can show a "Verified" badge.
 * - "unverifiable": the key could not be deterministically confirmed (e.g. the
 *                   `answerExpression` didn't evaluate, or no single MC option
 *                   matched it), but the problem is otherwise self-consistent.
 *                   It is still playable; it just doesn't earn the badge.
 *
 * Problems that fail the self-consistency check (e.g. ask for a symbol absent
 * from the equation) are "inconsistent" and DROPPED before reaching the UI, so
 * that status never appears on a {@link VerifiedPracticeProblem}.
 */
export type VerificationStatus = "verified" | "unverifiable";

interface VerifiedProblemBase {
  /** Stable id used by the runner for attempt tracking. */
  id: string;
  conceptLabel: string;
  /** Integer 1-10 difficulty (clamped). Drives ascending order + the UI label. */
  difficulty: number;
  prompt: string;
  hint: string;
  /** Full worked solution, revealed on the second consecutive miss. */
  explanation: string;
  correctFeedback: string;
  incorrectFeedback: string;
  status: VerificationStatus;
  /** The fully-numeric expression used to check the key (shown as worked steps). */
  answerExpression: string;
  /** The math.js-computed value of `answerExpression`, or null if it didn't evaluate. */
  computedAnswer: number | null;
}

export interface VerifiedNumericProblem extends VerifiedProblemBase {
  kind: "numeric";
  /** Authoritative answer (overridden by `computedAnswer` when verified). */
  answer: number;
}

export interface VerifiedMcProblem extends VerifiedProblemBase {
  kind: "mc";
  options: string[];
  correctIndex: number;
}

export type VerifiedPracticeProblem =
  | VerifiedNumericProblem
  | VerifiedMcProblem;

/**
 * A practice test stored as a {@link Lesson} (so completion / eligibility keep
 * working) but carrying the verified problem bank the dedicated practice-test
 * runner plays. The extra field rides along in the `lesson_json` JSONB column.
 */
export interface PracticeTestLesson extends Lesson {
  practiceProblems: VerifiedPracticeProblem[];
}
