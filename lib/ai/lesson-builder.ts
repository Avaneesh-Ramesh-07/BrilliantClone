/**
 * Server-side builder for the AI "Sandbox" lessons. The model produces a SIMPLE
 * {@link LessonGenerationSpec} (a topic-appropriate sequence of steps + a few
 * numbers per interactive); this module turns that into a fully valid
 * {@link Lesson} that plays in the unmodified StepPlayer.
 *
 * Design: the model NEVER emits raw interactive JSON. It picks an interactive
 * `type` from a curated menu and supplies a handful of numbers; `buildInteractive`
 * constructs + validates the exact JSON for that type and returns `null` on
 * anything invalid so the caller can fall back to a graded numeric question.
 */

import { isGraded } from "@/lib/mastery";
import type {
  InteractiveParams,
  InteractiveType,
  LessonGenerationSpec,
  ProblemSpec,
} from "@/types/ai-lesson";
import type { Lesson, Problem, ProblemFeedback, Step } from "@/types/lesson";

export const OPENAI_MODEL = "gpt-4o-mini" as const;

// --- Topics ---------------------------------------------------------------

export type TopicFamily = "equations" | "graphing" | "quadratics";

export interface AllowedTopic {
  id: string;
  label: string;
  family: TopicFamily;
}

/** Intro algebra/geometry topics the Sandbox supports. */
export const ALLOWED_TOPICS: AllowedTopic[] = [
  { id: "variables-expressions", label: "Variables & Expressions", family: "equations" },
  { id: "linear-equations", label: "Linear Equations", family: "equations" },
  { id: "two-step-equations", label: "Two-Step Equations", family: "equations" },
  { id: "inequalities", label: "Inequalities", family: "equations" },
  { id: "graphing-lines", label: "Graphing Lines", family: "graphing" },
  { id: "slope", label: "Slope & Rate of Change", family: "graphing" },
  { id: "systems", label: "Systems of Equations", family: "graphing" },
  { id: "quadratics", label: "Intro to Quadratics", family: "quadratics" },
  { id: "other-algebra", label: "Other algebra…", family: "equations" },
];

export function isAllowedTopic(topic: unknown): topic is string {
  return (
    typeof topic === "string" && ALLOWED_TOPICS.some((t) => t.id === topic)
  );
}

export function getTopic(topic: string): AllowedTopic | undefined {
  return ALLOWED_TOPICS.find((t) => t.id === topic);
}

export function topicFamily(topic: string): TopicFamily {
  return getTopic(topic)?.family ?? "equations";
}

export function topicLabel(topic: string): string {
  return getTopic(topic)?.label ?? topic;
}

/** Curated interactive menu per topic family (mirrors the plan). */
export const INTERACTIVE_MENU: Record<TopicFamily, InteractiveType[]> = {
  equations: [
    "variable-box",
    "eliminate-blocks",
    "balance-choice",
    "pizza-share",
    "two-step-share",
    "slider-balance",
  ],
  graphing: ["graph-intercept", "plot-point", "graph-line", "pick-graph", "slope-race"],
  quadratics: ["vertex-formula", "parabola-a-slider"],
};

// --- Difficulty -----------------------------------------------------------

export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export interface DifficultyProfile {
  label: string;
  numberRange: [number, number];
  scaffolding: string;
  stepComplexity: string;
  masteryThreshold: number;
}

export const DIFFICULTY: Record<DifficultyLevel, DifficultyProfile> = {
  beginner: {
    label: "Beginner",
    numberRange: [1, 10],
    scaffolding:
      "Heavy scaffolding. Start with the absolute basics, define every term, and move in tiny increments. Use small whole numbers (1–10) and positive values only.",
    stepComplexity:
      "Each step introduces exactly one new idea with worked, concrete examples before any practice.",
    masteryThreshold: 0.5,
  },
  intermediate: {
    label: "Intermediate",
    numberRange: [1, 20],
    scaffolding:
      "Moderate scaffolding. Assume the learner knows the basics; review briefly, then build. Use numbers up to ~20 and introduce some negatives.",
    stepComplexity:
      "Steps combine ideas and include a mix of guided and independent practice.",
    masteryThreshold: 0.6,
  },
  advanced: {
    label: "Advanced",
    numberRange: [1, 40],
    scaffolding:
      "Light scaffolding. Move quickly, use richer language, and include negatives, fractions where natural, and multi-step reasoning.",
    stepComplexity:
      "Steps chain multiple concepts and end on a genuinely challenging problem.",
    masteryThreshold: 0.67,
  },
};

export function isAllowedDifficulty(d: unknown): d is DifficultyLevel {
  return d === "beginner" || d === "intermediate" || d === "advanced";
}

// --- Prompts --------------------------------------------------------------

export function buildSystemPrompt(): string {
  return [
    "You are an expert algebra and geometry teacher who designs thorough,",
    "engaging, interactive micro-lessons for a mobile learning app.",
    "",
    "You will design a lesson as a STRICT structured object. Rules:",
    "- The lesson MUST have EXACTLY 5 steps that build incrementally: each step",
    "  introduces one new idea and assumes mastery of the previous steps.",
    "- Every step MUST set the concept framing (a short, friendly explanation of",
    "  the idea) BEFORE any problems.",
    "- Every step MUST include EXACTLY 2 hints: short conceptual nudges that",
    "  guide thinking WITHOUT ever giving away the final answer.",
    "- Every step MUST include AT LEAST ONE graded problem of kind 'numeric' or",
    "  'mc' (multiple choice). Prefer 2-3 graded problems per step.",
    "- Feedback must be specific and encouraging: 'correctFeedback' celebrates",
    "  and reinforces WHY it's right; 'incorrectFeedback' gently explains the fix.",
    "- The final (5th) step must end with a genuinely challenging problem.",
    "",
    "Interactive problems (kind 'interactive'): you may OPTIONALLY include guided",
    "interactives chosen ONLY from the provided menu. For these you supply just a",
    "type and a few numbers in 'params' — never raw layout. Use whole numbers and",
    "keep them consistent (e.g. for an equation a*x + b = c, pick numbers so x is",
    "a clean whole number). If unsure, prefer plain 'numeric'/'mc' problems.",
    "",
    "Keep all math in plain text (e.g. 'y = 2x + 3', 'x^2'). No markdown, no LaTeX.",
  ].join("\n");
}

export function buildUserPrompt(params: {
  topic: string;
  difficulty: DifficultyLevel;
  specificConcept: string;
}): string {
  const { topic, difficulty, specificConcept } = params;
  const profile = DIFFICULTY[difficulty];
  const family = topicFamily(topic);
  const menu = INTERACTIVE_MENU[family];

  return [
    `Topic area: ${topicLabel(topic)} (family: ${family}).`,
    `Specific concept the learner wants to master: "${specificConcept}".`,
    `Difficulty: ${profile.label}.`,
    "",
    "Difficulty guidance:",
    `- Numbers: use values roughly in the range ${profile.numberRange[0]}–${profile.numberRange[1]}.`,
    `- Scaffolding: ${profile.scaffolding}`,
    `- Step complexity: ${profile.stepComplexity}`,
    "",
    "Curated interactive menu you may pick from for kind 'interactive' problems",
    `(use ONLY these types): ${menu.join(", ")}.`,
    "Params each interactive uses (supply whole numbers):",
    "- variable-box: { variable, value }",
    "- eliminate-blocks: { variable, constant (>0), rightValue, coefficient? }",
    "- balance-choice: { variable, coefficient, rightValue } (rightValue divisible by coefficient)",
    "- pizza-share: { variable, people (1 or 2), slices } (slices divisible by people)",
    "- two-step-share: { variable, coefficient (1 or 2), constant (>0), rightValue } ((rightValue-constant) divisible by coefficient)",
    "- slider-balance: { value } (graded: solve x = value)",
    "- graph-intercept: { equationLabel, slope, intercept }",
    "- plot-point: { targetX, targetY }",
    "- graph-line: { equationLabel, slope (integer), intercept } (graded)",
    "- pick-graph: { equationLabel, slope, intercept } (graded)",
    "- slope-race: {} (no params needed)",
    "- vertex-formula: { a, b, c } (a and b must differ)",
    "- parabola-a-slider: { b, c }",
    "",
    "Design a complete 5-step lesson that takes a learner from the basics of this",
    "concept to confidently solving it. Make every step teach, then practice.",
  ].join("\n");
}

// --- Interactive construction --------------------------------------------

function isInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Number.isInteger(n);
}

function isNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

const GRID = { xMin: -6, xMax: 6, yMin: -6, yMax: 6 };

/**
 * Constructs the exact, valid JSON for a curated interactive type from the
 * model-supplied params. Returns `null` when required fields are missing or
 * invalid (e.g. non-divisible values), so the caller falls back to a numeric
 * question. Field shapes mirror `types/lesson.ts` and the matching
 * `components/lesson/*Step.tsx`.
 */
export function buildInteractive(
  id: string,
  type: InteractiveType,
  prompt: string,
  question: string,
  params: InteractiveParams
): Problem | null {
  const variable =
    typeof params.variable === "string" && params.variable.trim()
      ? params.variable.trim().slice(0, 3)
      : "x";

  switch (type) {
    case "variable-box": {
      if (!isInt(params.value)) return null;
      return {
        id,
        type: "variable-box",
        demo: true,
        prompt,
        question,
        variable,
        value: params.value,
        feedback: { correct: `A variable is just a box for a number — here ${variable} = ${params.value}.` },
      };
    }

    case "eliminate-blocks": {
      const { constant, rightValue, coefficient } = params;
      if (!isInt(constant) || constant <= 0 || !isInt(rightValue)) return null;
      const coeff = isInt(coefficient) && coefficient >= 1 ? coefficient : undefined;
      return {
        id,
        type: "eliminate-blocks",
        demo: true,
        prompt,
        question,
        variable,
        ...(coeff && coeff > 1 ? { coefficient: coeff } : {}),
        constant,
        rightValue,
        feedback: {
          correct: `Eliminating +${constant} from both sides keeps things balanced and isolates ${variable}.`,
        },
      };
    }

    case "balance-choice": {
      const { coefficient, rightValue } = params;
      if (!isInt(coefficient) || coefficient < 1 || !isInt(rightValue)) return null;
      if (coefficient === 0 || rightValue % coefficient !== 0) return null;
      return {
        id,
        type: "balance-choice",
        demo: true,
        prompt,
        question,
        variable,
        coefficient,
        rightValue,
        feedback: {
          correct: `Dividing BOTH sides by ${coefficient} keeps the scale level, so ${variable} = ${rightValue / coefficient}.`,
        },
      };
    }

    case "pizza-share": {
      const { people, slices } = params;
      if (!isInt(people) || (people !== 1 && people !== 2)) return null;
      if (!isInt(slices) || slices <= 0 || slices % people !== 0) return null;
      return {
        id,
        type: "pizza-share",
        demo: true,
        prompt,
        question,
        variable,
        people,
        slices,
        feedback: {
          correct: `Sharing ${slices} slices equally among ${people} gives ${variable} = ${slices / people}.`,
        },
      };
    }

    case "two-step-share": {
      const { coefficient, constant, rightValue } = params;
      if (!isInt(coefficient) || (coefficient !== 1 && coefficient !== 2)) return null;
      if (!isInt(constant) || constant <= 0 || !isInt(rightValue)) return null;
      const remaining = rightValue - constant;
      if (remaining <= 0 || remaining % coefficient !== 0) return null;
      return {
        id,
        type: "two-step-share",
        demo: true,
        prompt,
        question,
        variable,
        coefficient,
        constant,
        rightValue,
        feedback: {
          correct: `Clear +${constant} first, then share equally: ${variable} = ${remaining / coefficient}.`,
        },
      };
    }

    case "slider-balance": {
      const v = params.value;
      if (!isInt(v) || v <= 0) return null;
      return {
        id,
        type: "slider-balance",
        prompt,
        answer: v,
        sliderMin: 0,
        sliderMax: Math.max(v * 2, v + 5),
        sliderDefault: Math.max(0, Math.floor(v / 2)),
        leftLabel: variable,
        rightLabel: String(v),
        rightValue: v,
        hint: "The scale only sits level when both sides weigh the same.",
        feedback: {
          correct: `Balanced! ${variable} = ${v} makes both sides match.`,
          incorrect: `Not level yet — slide ${variable} until it matches the right side.`,
        },
      };
    }

    case "graph-intercept": {
      const { slope, intercept } = params;
      if (!isNum(slope) || !isInt(intercept)) return null;
      const label =
        typeof params.equationLabel === "string" && params.equationLabel.trim()
          ? params.equationLabel.trim()
          : `y = ${slope}x ${intercept >= 0 ? "+ " + intercept : "- " + Math.abs(intercept)}`;
      return {
        id,
        type: "graph-intercept",
        demo: true,
        prompt,
        equationLabel: label,
        slope,
        intercept,
        xMin: GRID.xMin,
        xMax: GRID.xMax,
        targetX: 0,
        feedback: {
          correct: `At x = 0 the line crosses the y-axis at ${intercept} — that's the y-intercept.`,
        },
      };
    }

    case "plot-point": {
      const { targetX, targetY } = params;
      if (!isInt(targetX) || !isInt(targetY)) return null;
      if (Math.abs(targetX) > GRID.xMax || Math.abs(targetY) > GRID.yMax) return null;
      return {
        id,
        type: "plot-point",
        demo: true,
        prompt,
        targetX,
        targetY,
        ...GRID,
        feedback: {
          correct: `Nice — (${targetX}, ${targetY}) is exactly the point.`,
        },
      };
    }

    case "graph-line": {
      const { slope, intercept } = params;
      if (!isInt(slope) || !isInt(intercept)) return null;
      const label =
        typeof params.equationLabel === "string" && params.equationLabel.trim()
          ? params.equationLabel.trim()
          : `y = ${slope}x ${intercept >= 0 ? "+ " + intercept : "- " + Math.abs(intercept)}`;
      return {
        id,
        type: "graph-line",
        prompt,
        equationLabel: label,
        slope,
        intercept,
        ...GRID,
        feedback: {
          correct: "That's the line — y-intercept first, then use the slope.",
          incorrect: "Plot the y-intercept (0, b) first, then count the slope to a second point.",
        },
      };
    }

    case "pick-graph": {
      const { slope, intercept } = params;
      if (!isNum(slope) || !isInt(intercept)) return null;
      const label =
        typeof params.equationLabel === "string" && params.equationLabel.trim()
          ? params.equationLabel.trim()
          : `y = ${slope}x ${intercept >= 0 ? "+ " + intercept : "- " + Math.abs(intercept)}`;
      const distractorSlope = slope === 0 ? 1 : -slope;
      const distractorIntercept = intercept + (intercept >= 0 ? 2 : -2);
      return {
        id,
        type: "pick-graph",
        prompt,
        equationLabel: label,
        options: [
          { id: "a", slope, intercept, correct: true },
          { id: "b", slope: distractorSlope, intercept, correct: false },
          { id: "c", slope, intercept: distractorIntercept, correct: false },
        ],
        ...GRID,
        hint: "Check the y-intercept first, then the steepness and direction of the slope.",
        feedback: {
          correct: "Yes — that graph has the right intercept and slope.",
          incorrect: "Match the y-intercept first, then check the slope's steepness and sign.",
        },
      };
    }

    case "slope-race": {
      return {
        id,
        type: "slope-race",
        demo: true,
        prompt,
        question: "Which line reached the bottom first?",
        options: [
          { id: "a", text: "The {side} line", correct: true },
          { id: "b", text: "They reached the bottom at the same time", correct: false },
        ],
        feedback: {
          correct: "Right — the steeper line (bigger slope magnitude) drops faster.",
        },
      };
    }

    case "vertex-formula": {
      const { a, b, c } = params;
      if (!isInt(a) || !isInt(b) || !isInt(c)) return null;
      if (a === 0 || a === b) return null;
      const tokens = Array.from(new Set([a, b, a + b, b + 1, a + 2])).slice(0, 5);
      if (!tokens.includes(a) || !tokens.includes(b)) return null;
      return {
        id,
        type: "vertex-formula",
        demo: true,
        prompt,
        question,
        a,
        b,
        c,
        tokens,
        feedback: {
          correct: "Dropping a and b into x = -b/(2a) locates the vertex.",
        },
      };
    }

    case "parabola-a-slider": {
      const { b, c } = params;
      if (!isInt(b) || !isInt(c)) return null;
      return {
        id,
        type: "parabola-a-slider",
        demo: true,
        prompt,
        b,
        c,
        aMin: -3,
        aMax: 3,
        aDefault: 1,
        ...GRID,
        feedback: {
          correct: "When a > 0 it opens up; when a < 0 it opens down.",
        },
      };
    }

    default:
      return null;
  }
}

// --- Spec → Lesson normalization -----------------------------------------

function letterId(index: number): string {
  return String.fromCharCode(97 + index); // a, b, c, ...
}

/** Normalizes the model's hints down/up to exactly two short nudges. */
function normalizeHints(hints: string[]): string[] {
  const cleaned = hints.map((h) => h.trim()).filter(Boolean);
  if (cleaned.length >= 2) return cleaned.slice(0, 2);
  if (cleaned.length === 1) {
    return [cleaned[0], "Re-read the concept above and take it one step at a time."];
  }
  return [
    "Focus on what the step just taught.",
    "Take it one step at a time and check each move.",
  ];
}

/**
 * Computes a clean whole-number answer for an equation-family interactive so a
 * failed/unsupported interactive can fall back to a graded numeric question.
 * Returns null when no sensible numeric answer can be derived.
 */
function numericFallbackAnswer(spec: Extract<ProblemSpec, { kind: "interactive" }>): number | null {
  const p = spec.params;
  switch (spec.type) {
    case "variable-box":
    case "slider-balance":
      return isInt(p.value) ? p.value : null;
    case "eliminate-blocks": {
      if (!isInt(p.constant) || !isInt(p.rightValue)) return null;
      const coeff = isInt(p.coefficient) && p.coefficient >= 1 ? p.coefficient : 1;
      const v = (p.rightValue - p.constant) / coeff;
      return Number.isInteger(v) ? v : null;
    }
    case "balance-choice": {
      if (!isInt(p.coefficient) || p.coefficient === 0 || !isInt(p.rightValue)) return null;
      const v = p.rightValue / p.coefficient;
      return Number.isInteger(v) ? v : null;
    }
    case "pizza-share": {
      if (!isInt(p.people) || p.people === 0 || !isInt(p.slices)) return null;
      const v = p.slices / p.people;
      return Number.isInteger(v) ? v : null;
    }
    case "two-step-share": {
      if (!isInt(p.coefficient) || p.coefficient === 0 || !isInt(p.constant) || !isInt(p.rightValue))
        return null;
      const v = (p.rightValue - p.constant) / p.coefficient;
      return Number.isInteger(v) ? v : null;
    }
    default:
      return null;
  }
}

function specToProblem(spec: ProblemSpec, id: string): Problem | null {
  switch (spec.kind) {
    case "numeric": {
      const feedback: ProblemFeedback = {
        correct: spec.correctFeedback,
        incorrect: spec.incorrectFeedback,
      };
      return {
        id,
        type: "numeric-input",
        prompt: spec.prompt,
        answer: spec.answer,
        hint: spec.explanation,
        feedback,
      };
    }
    case "mc": {
      const options = spec.options.map((text, i) => ({
        id: letterId(i),
        text,
        correct: i === spec.correctIndex,
      }));
      // Must have exactly one correct option.
      if (options.filter((o) => o.correct).length !== 1) return null;
      return {
        id,
        type: "multiple-choice",
        prompt: spec.prompt,
        options,
        hint: spec.explanation,
        feedback: {
          correct: spec.correctFeedback,
          incorrect: spec.incorrectFeedback,
        },
      };
    }
    case "interactive": {
      const built = buildInteractive(id, spec.type, spec.prompt, spec.question, spec.params);
      if (built) return built;
      // Fallback to a graded numeric question when the interactive is invalid.
      const answer = numericFallbackAnswer(spec);
      if (answer === null) return null;
      return {
        id,
        type: "numeric-input",
        prompt: spec.prompt,
        answer,
        hint: "Isolate the variable one step at a time.",
        feedback: {
          correct: "Correct — nicely done.",
          incorrect: "Not quite — undo each operation on both sides to isolate the variable.",
        },
      };
    }
    default:
      return null;
  }
}

export interface LessonMeta {
  id: string;
  topic: string;
  difficulty: DifficultyLevel;
  specificConcept: string;
}

/**
 * Normalizes a model {@link LessonGenerationSpec} into a fully valid
 * {@link Lesson}. Throws nothing; callers validate the result (Part 3).
 */
export function buildLessonFromSpec(
  spec: LessonGenerationSpec,
  meta: LessonMeta
): Lesson {
  const profile = DIFFICULTY[meta.difficulty];

  const steps: Step[] = spec.steps.map((stepSpec, i) => {
    const stepNumber = i + 1;
    const stepId = `step-${stepNumber}`;
    const isLast = i === spec.steps.length - 1;

    // Build problems, then order them so guided demos come first and graded
    // questions come last (mirrors the existing lessons and guarantees the
    // final problem of a step is graded so the mastery check always runs).
    const built: Problem[] = [];
    stepSpec.problems.forEach((ps, j) => {
      const problem = specToProblem(ps, `${stepId}-${letterId(j)}`);
      if (problem) built.push(problem);
    });
    const demos = built.filter((p) => !isGraded(p));
    const graded = built.filter((p) => isGraded(p));
    const problems = [...demos, ...graded];

    const completionAction = isLast
      ? { buttonLabel: "Finish Lesson →", route: "/lesson/[id]/complete" }
      : { buttonLabel: "Next Step →", nextStepId: `step-${stepNumber + 1}` };

    const step: Step = {
      id: stepId,
      title: stepSpec.title,
      concept: stepSpec.concept,
      conceptFraming: stepSpec.conceptFraming,
      masteryThreshold: i === 0 ? 1 : profile.masteryThreshold,
      fallbackStepId: i === 0 ? "step-1" : `step-${stepNumber - 1}`,
      fallbackMessage:
        i === 0
          ? "Let's take another run at the basics here."
          : "Let's solidify the previous step before moving on.",
      hints: normalizeHints(stepSpec.hints),
      completionAction,
      anchors: 1,
      present: problems.length,
      problems,
    };

    if (i === 0) step.skipMasteryGate = true;
    if (isLast) step.isLastStep = true;

    return step;
  });

  return {
    id: meta.id,
    title: spec.title,
    subject: topicLabel(meta.topic),
    description: spec.description,
    estimatedMinutes: 15,
    totalSteps: steps.length,
    masteryRule: {
      description:
        "After all problems in a step are submitted, first-attempt correctness is compared to masteryThreshold; below it sends the learner back to fallbackStepId.",
      nextButtonVisibleOnlyAfterMastery: true,
    },
    steps,
  };
}

/**
 * Validates a built lesson meets the engine's hard requirements: an id, a
 * title, a sensible number of steps, and at least one graded problem per step.
 * Returns an error string when invalid, or null when valid.
 */
export function validateBuiltLesson(lesson: Lesson): string | null {
  if (!lesson.id) return "Lesson is missing an id.";
  if (!lesson.title || !lesson.title.trim()) return "Lesson is missing a title.";
  if (lesson.steps.length < 3 || lesson.steps.length > 7) {
    return `Lesson must have between 3 and 7 steps (got ${lesson.steps.length}).`;
  }
  for (const step of lesson.steps) {
    const gradedCount = step.problems.filter(isGraded).length;
    if (gradedCount < 1) {
      return `Step "${step.id}" has no graded problem.`;
    }
  }
  return null;
}
