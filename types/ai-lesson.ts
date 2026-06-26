import { z } from "zod";
import type { Lesson } from "@/types/lesson";

/**
 * A row in the `ai_lessons` table (see Part 1 migration). The generated lesson
 * is stored as JSON in `lesson_json` and is a fully-formed {@link Lesson} that
 * plays in the unmodified StepPlayer.
 */
export interface AiLessonRow {
  id: string;
  user_id: string;
  topic: string;
  difficulty: string;
  specific_concept: string;
  lesson_json: Lesson;
  created_at: string;
}

/**
 * The curated menu of existing parametric interactive types the model may pick
 * from per step. Our backend (`buildInteractive`) constructs the exact JSON for
 * each and validates it, falling back to a numeric question if invalid — so the
 * model only ever supplies a type + a few numbers, never raw interactive JSON.
 */
export const INTERACTIVE_TYPES = [
  // Equations family
  "variable-box",
  "eliminate-blocks",
  "balance-choice",
  "pizza-share",
  "two-step-share",
  "slider-balance",
  // Graphing / geometry family
  "graph-intercept",
  "plot-point",
  "graph-line",
  "pick-graph",
  "slope-race",
  // Quadratics (intro) family
  "vertex-formula",
  "parabola-a-slider",
] as const;

export type InteractiveType = (typeof INTERACTIVE_TYPES)[number];

/**
 * A small, loose grab-bag of numeric/string parameters the model fills for an
 * interactive. Every field is optional; `buildInteractive` reads only the ones
 * a given type needs and validates them (returning null on anything invalid).
 */
// NOTE: every field is `.nullable()` rather than `.optional()`. OpenAI's strict
// structured outputs require EVERY property to appear in the schema's `required`
// array; an optional field is omitted from `required` and rejected. A nullable
// field stays required but may be `null`, which `buildInteractive` treats the
// same as "absent" (all reads are guarded by isInt/isNum/typeof checks).
const interactiveParamsSchema = z.object({
  variable: z.string().nullable(),
  value: z.number().nullable(),
  coefficient: z.number().nullable(),
  constant: z.number().nullable(),
  rightValue: z.number().nullable(),
  people: z.number().nullable(),
  slices: z.number().nullable(),
  slope: z.number().nullable(),
  intercept: z.number().nullable(),
  equationLabel: z.string().nullable(),
  targetX: z.number().nullable(),
  targetY: z.number().nullable(),
  a: z.number().nullable(),
  b: z.number().nullable(),
  c: z.number().nullable(),
});

export type InteractiveParams = z.infer<typeof interactiveParamsSchema>;

const numericProblemSpec = z.object({
  kind: z.literal("numeric"),
  prompt: z.string(),
  answer: z.number(),
  explanation: z.string(),
  correctFeedback: z.string(),
  incorrectFeedback: z.string(),
});

const mcProblemSpec = z.object({
  kind: z.literal("mc"),
  prompt: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correctIndex: z.number().int(),
  explanation: z.string(),
  correctFeedback: z.string(),
  incorrectFeedback: z.string(),
});

const interactiveProblemSpec = z.object({
  kind: z.literal("interactive"),
  type: z.enum(INTERACTIVE_TYPES),
  prompt: z.string(),
  question: z.string(),
  params: interactiveParamsSchema,
});

/**
 * A single problem the model produces — distinguished by the `kind` literal.
 * Uses `z.union` (not `z.discriminatedUnion`) because OpenAI structured outputs
 * rejects the `oneOf` JSON-schema keyword that a discriminated union emits; a
 * plain union serializes to the permitted `anyOf` while still parsing by `kind`.
 */
export const problemSpecSchema = z.union([
  numericProblemSpec,
  mcProblemSpec,
  interactiveProblemSpec,
]);

export type ProblemSpec = z.infer<typeof problemSpecSchema>;

const stepSpec = z.object({
  title: z.string(),
  concept: z.string(),
  conceptFraming: z.string(),
  // Loose bounds so an off-by-one count from the model doesn't fail the whole
  // generation; `buildLessonFromSpec` normalizes to exactly 2 hints.
  hints: z.array(z.string()).min(1).max(4),
  problems: z.array(problemSpecSchema).min(1).max(6),
});

export type StepSpec = z.infer<typeof stepSpec>;

/**
 * The full generation spec the model fills via `generateObject`. Intentionally
 * SIMPLE: five incremental steps, each with concept framing, two hints, and a
 * short bank of problems. `buildLessonFromSpec` normalizes this into a valid
 * {@link Lesson}.
 */
export const lessonGenerationSpecSchema = z.object({
  title: z.string(),
  description: z.string(),
  // The prompt asks for exactly 5 steps, but accept a small range so a
  // 4- or 6-step response still builds instead of hard-failing.
  steps: z.array(stepSpec).min(3).max(7),
});

export type LessonGenerationSpec = z.infer<typeof lessonGenerationSpecSchema>;
