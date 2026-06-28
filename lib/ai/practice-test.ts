/**
 * Server-side builder for AI-generated "practice tests". A practice test is a
 * single-step, challenging, word-problem-heavy {@link Lesson} that plays in the
 * unmodified StepPlayer (same playback + completion path as the Sandbox
 * lessons). The model produces a {@link PracticeTestSpec} (a flat bank of
 * numeric/mc word problems); this module turns that into a valid Lesson.
 */

import { isGraded } from "@/lib/mastery";
import type { EligibleConcept } from "@/lib/practice-test/eligibility";
import type { Lesson, Problem, ProblemFeedback, Step } from "@/types/lesson";
import type { PracticeProblemSpec, PracticeTestSpec } from "@/types/practice-test";

/**
 * Model used ONLY for practice-test generation. Intentionally OpenAI's current
 * flagship `gpt-5.5` (not the smaller model used by lesson building / photo
 * feedback) for stronger arithmetic and instruction-following on answer keys and
 * self-consistency. Note `gpt-5.5` is a REASONING model: it consumes reasoning
 * tokens and does NOT accept a custom `temperature`, so the generation call must
 * omit `temperature` and budget extra `maxOutputTokens` for reasoning.
 */
export const PRACTICE_TEST_MODEL = "gpt-5.5" as const;

/** a, b, c, … for multiple-choice option ids (mirrors lesson-builder). */
function letterId(index: number): string {
  return String.fromCharCode(97 + index);
}

/**
 * Defensive cleanup: strips a trailing inline multiple-choice option list that
 * the model sometimes leaks into the question `prompt` (the choices belong only
 * in the `options` array, never in the stem). Matches an enumerated A-D run
 * such as "A) 2 and -3  B) 3 and -2  C) -2 and 3  D) -3 and 2", also handling
 * "A." / "(A)" / "[A]" and lowercase variants.
 *
 * To avoid damaging legitimate prompt math, it ONLY strips when at least the
 * markers A, B and C appear in order (the unmistakable signature of an option
 * list), and the leading marker sits at a word boundary so things like
 * "area)" never trip it.
 */
function stripInlineOptionList(prompt: string): string {
  if (!prompt) return prompt;
  const OPTION_LIST_RE =
    /(?:^|\s)[([]?[Aa][).\]]\s[\s\S]*?\s[([]?[Bb][).\]]\s[\s\S]*?\s[([]?[Cc][).\]][\s\S]*$/;
  const stripped = prompt.replace(OPTION_LIST_RE, "").trim();
  // If stripping somehow consumed everything, keep the original prompt.
  return stripped.length > 0 ? stripped : prompt.trim();
}

// --- Prompts --------------------------------------------------------------

export function buildPracticeTestSystemPrompt(): string {
  return [
    "You are an expert algebra and geometry teacher writing a focused practice",
    "test for a motivated learner who has already studied these specific concepts.",
    "",
    "OUTPUT JSON SHAPE - the whole test is one object:",
    "  { \"title\": string, \"description\": string, \"problems\": [ 15 to 22 problem objects ] }",
    "Each problem is ONE object matching EXACTLY ONE of these two shapes (emit ONLY",
    "these fields, all required, with these exact types):",
    "",
    "  // multiple-choice problem",
    "  {",
    "    \"kind\": \"mc\",",
    "    \"conceptLabel\": string,      // EXACT label copied verbatim from the eligible list",
    "    \"prompt\": string,           // question STEM only; ends with the question; NO choices inside",
    "    \"options\": string[],        // 2 to 4 DISTINCT choices",
    "    \"correctIndex\": integer,    // 0-based index of the single correct option",
    "    \"answerExpression\": string, // fully-numeric math.js expr = numeric value of the correct option",
    "    \"hint\": string,             // short scaffold; must NOT reveal the correct option",
    "    \"explanation\": string,      // full worked solution",
    "    \"correctFeedback\": string,  // why the correct answer is right",
    "    \"incorrectFeedback\": string // gently names the likely misstep",
    "  }",
    "",
    "  // numeric problem",
    "  {",
    "    \"kind\": \"numeric\",",
    "    \"conceptLabel\": string,",
    "    \"prompt\": string,           // question STEM only; ends with the question",
    "    \"answer\": number,           // the single numeric answer",
    "    \"answerExpression\": string, // fully-numeric math.js expr that evaluates to `answer`",
    "    \"hint\": string,             // short scaffold; must NOT reveal the answer",
    "    \"explanation\": string,",
    "    \"correctFeedback\": string,",
    "    \"incorrectFeedback\": string",
    "  }",
    "",
    "The rules below govern the CONTENT of each field.",
    "",
    "TOP PRIORITY - CLARITY AND CORRECTNESS OVER DIFFICULTY:",
    "- Produce problems a student can clearly UNDERSTAND and that are completely",
    "  SELF-CONSISTENT. Clarity beats difficulty every time; when unsure, choose",
    "  the simpler, unambiguous problem over a clever but confusing one.",
    "- DEFINE every variable and symbol you use, in words, right where it first",
    "  appears (e.g. 'A = l*w, where l is the length and w is the width').",
    "- ONLY ask for a quantity that ACTUALLY appears in the problem's",
    "  equation/expression (never ask for x if there is no x).",
    "- INTERNAL CONSISTENCY is mandatory: the question, the equation, the stated",
    "  answer, and answerExpression must all agree and be computable from the given",
    "  information. Re-read each problem and reject it yourself if they don't",
    "  perfectly line up.",
    "",
    "TEST LENGTH:",
    "- Produce about 20 problems total, and NEVER fewer than 15. The eligible-",
    "  concept list is often shorter than 15, so write MULTIPLE distinct problems",
    "  per concept, distributed across all the listed concepts, to reach the count.",
    "- Every problem on the SAME concept must use a genuinely different scenario",
    "  and different numbers; never near-duplicates or reworded twins.",
    "- Keep each 'explanation' CONCISE (a few tight sentences) so all ~20 problems",
    "  fit without being truncated.",
    "",
    "STAY ON THE TARGET CONCEPT:",
    "- Each problem MUST directly exercise EXACTLY ONE supplied concept, with",
    "  'conceptLabel' set to that concept's EXACT label (copied verbatim).",
    "- Frame it as a SHORT real-world WORD PROBLEM that is only a THIN WRAPPER",
    "  around that one skill - no unrelated detours, no multi-topic chains.",
    "  'Challenging' comes from the concept ITSELF (realistic numbers, a less",
    "  obvious setup, trick MC distractors), not from extra unrelated steps.",
    "- Calibrate difficulty to the concept: a simple comparison stays simple; a",
    "  quadratic-feature concept can be genuinely harder.",
    "",
    "THE 'hint' FIELD (required on every problem): a SINGLE short scaffold that",
    "helps the learner START, revealed only after a wrong attempt; it must NEVER",
    "reveal the numeric answer or the correct option. Match its style to the",
    "problem, per these difficulty exemplars:",
    "- EASY (single operation): 'Cathy has 5 oranges and Ben has 17 oranges. How",
    "  many more does Cathy need to match Ben?' Hint names the operation without",
    "  the result: 'Compare the two amounts - what is the difference?'",
    "- MEDIUM (set up + solve a linear equation): 'A gym charges a $50 initiation",
    "  fee plus $30 per month. If you spent $350 total, how many months have you",
    "  been a member?' (x = months, so 30x + 50 = 350.) Hint GIVES THE EQUATION:",
    "  'Set up: 30x + 50 = 350.'",
    "- HARD (conceptual): 'A ball follows the parabola y = -x^2 + 2x + 1. What is",
    "  its maximum height?' Hint is a GUIDING QUESTION, not the computation: 'What",
    "  feature of a parabola does maximum height correspond to?'",
    "",
    "RATE-BASED PROBLEMS: only use a rate/linear-cost scenario ('$X per",
    "month/hour/item', a constant rate of change, speed/distance over time) if you",
    "write the explicit equation into the prompt (e.g. '30x + 50 = 350') and make",
    "the hint that equation; otherwise choose a non-rate situation.",
    "",
    "NO TRIVIAL / TAUTOLOGICAL QUESTIONS: never ask anything whose answer is",
    "restated or trivially implied by the prompt, and never a pure definition/",
    "recall question. (Forbidden: 'A line crosses the y-axis at (0, -4); what is",
    "its starting point on the y-axis?' - the answer is given.) Every problem must",
    "be a genuine, multi-sentence situational word problem that needs real setup",
    "and reasoning.",
    "",
    "SITUATION ARCHETYPES (pick one that fits the concept; vary them across the",
    "test):",
    "- equations: total-cost/savings with a KNOWN total, age problems,",
    "  perimeter/area with a given total, splitting items among people,",
    "  consecutive integers.",
    "- graphing/lines: comparisons over time or distance, break-even between two",
    "  options, interpreting a GIVEN line equation in context.",
    "- quadratics: projectile / maximum height (the vertex), area maximization,",
    "  'for what input is the value zero' (roots) framed as a real scenario.",
    "",
    "THE 'prompt' FIELD - QUESTION STEM ONLY: it contains only the situation and",
    "what is asked, and ends with the question. NEVER put the answer choices in the",
    "prompt (no 'A) ... B) ... C) ...' list, in any capitalization/format) - the",
    "choices live SOLELY in the 'options' array and are rendered by the UI. Applies",
    "to numeric and mc alike.",
    "",
    "MULTIPLE-CHOICE ('mc'):",
    "- Write TRICK distractors reflecting common mistakes on the concept (sign",
    "  errors, off-by-one, swapped values), not obvious throwaways. Exactly one",
    "  option is correct ('correctIndex').",
    "- DISTINCT OPTIONS: every option must denote a genuinely DIFFERENT value/set",
    "  from the correct answer and from each other - never two with the same value",
    "  or the same set of numbers. For solution-set answers ORDER DOES NOT MATTER,",
    "  so never offer the same pair reordered (e.g. both '3 and -2' and '-2 and",
    "  3'). An item with two equivalent options is REJECTED.",
    "",
    "'answerExpression' (critical - this is what the server checks):",
    "- A SINGLE, fully-numeric math.js expression (no variables/letters; '^' for",
    "  powers; explicit '*' for every multiplication) that INDEPENDENTLY computes",
    "  the answer - the real computation, not a restatement. Example - vertex y of",
    "  'y = -2x^2 + 8x' at x = 2: '-2*(2)^2 + 8*2'.",
    "- It must evaluate to the numeric 'answer' (numeric) or to the numeric value",
    "  the correct option represents (mc). For a SET answer (e.g. both roots), list",
    "  ALL values comma-separated (e.g. roots of (x-3)(x+2) -> '3, -2'); the correct",
    "  option must contain exactly that set and no other option may repeat it.",
    "- It IS CHECKED with math.js and OVERRIDES your stated answer, so make sure it",
    "  truly evaluates to the intended answer.",
    "",
    "Mix numeric and mc problems across the test.",
    "",
    "FORMATTING: keep ALL math in plain text (e.g. 'y = 2x + 3', 'x^2', '3/4') - no",
    "markdown, no LaTeX. The UI renders '^' as a real superscript (x^2 shows as",
    "x²), so ALWAYS write exponents with '^' and NEVER spell them out ('squared',",
    "'to the power of').",
  ].join("\n");
}

export function buildPracticeTestUserPrompt(concepts: EligibleConcept[]): string {
  const lines = concepts.map(
    (c) => `- "${c.conceptLabel}" (from the lesson "${c.lessonTitle}")`
  );

  return [
    "Write a practice test covering ONLY these concepts (each line is a concept",
    "and the lesson it came from); the learner last reviewed them on a previous",
    "day:",
    ...lines,
    "",
    "Produce about 20 problems total, and NEVER fewer than 15. The list above is",
    "often shorter than 15, so write SEVERAL distinct problems per concept,",
    "distributed as evenly as you reasonably can across all listed concepts, each",
    "with a different scenario and different numbers. Apply every rule from the",
    "instructions above (define each symbol, ask only for quantities present, full",
    "internal consistency, thin on-concept word problems, distinct mc options, and",
    "a fully-numeric answerExpression that independently computes the answer).",
    "Order the problems so the hardest come LAST, never sacrificing clarity or",
    "correctness. Give the test a short, motivating title and a one-sentence",
    "description.",
  ].join("\n");
}

// --- Spec → Lesson normalization -----------------------------------------

/**
 * Converts one spec problem into a graded {@link Problem}, reusing the exact
 * numeric/mc shapes from lesson-builder's `specToProblem`. Returns null for an
 * mc problem that doesn't have exactly one correct option.
 */
function practiceSpecToProblem(
  spec: PracticeProblemSpec,
  id: string
): Problem | null {
  // Prefer the model's tailored scaffold; fall back to the full explanation
  // only when the hint is missing/blank.
  const hint = spec.hint && spec.hint.trim() ? spec.hint : spec.explanation;
  // Defensive: never let an enumerated MC option list leak into the stem.
  const prompt = stripInlineOptionList(spec.prompt);
  switch (spec.kind) {
    case "numeric": {
      const feedback: ProblemFeedback = {
        correct: spec.correctFeedback,
        incorrect: spec.incorrectFeedback,
      };
      return {
        id,
        type: "numeric-input",
        prompt,
        answer: spec.answer,
        hint,
        // Full worked solution, revealed only on the second miss (the short
        // `hint` stays the first-miss scaffold).
        solution: spec.explanation,
        feedback,
      };
    }
    case "mc": {
      const options = spec.options.map((text, i) => ({
        id: letterId(i),
        text,
        correct: i === spec.correctIndex,
      }));
      if (options.filter((o) => o.correct).length !== 1) return null;
      return {
        id,
        type: "multiple-choice",
        prompt,
        options,
        hint,
        // Full worked solution, revealed only on the second miss (the short
        // `hint` stays the first-miss scaffold).
        solution: spec.explanation,
        feedback: {
          correct: spec.correctFeedback,
          incorrect: spec.incorrectFeedback,
        },
      };
    }
    default:
      return null;
  }
}

export interface PracticeTestMeta {
  id: string;
  topicFamily: string;
}

/**
 * Normalizes a model {@link PracticeTestSpec} into a fully valid {@link Lesson}
 * where EACH spec problem becomes its OWN step, so the step count reflects the
 * number of questions. Throws nothing; callers validate the result.
 */
export function buildPracticeTestFromSpec(
  spec: PracticeTestSpec,
  meta: PracticeTestMeta
): Lesson {
  // First build the graded problem for each spec problem (skipping any that the
  // builder rejects), so we know the FINAL step count before wiring up the
  // per-step navigation (Next → / Finish Test →).
  const built: { problem: Problem; conceptLabel: string }[] = [];
  spec.problems.forEach((ps, i) => {
    const stepNumber = built.length + 1;
    const problem = practiceSpecToProblem(ps, `step-${stepNumber}-${letterId(i)}`);
    if (problem) {
      built.push({
        problem,
        conceptLabel: ps.conceptLabel?.trim() ?? "",
      });
    }
  });

  const steps: Step[] = built.map(({ problem, conceptLabel }, i) => {
    const stepId = `step-${i + 1}`;
    const isLast = i === built.length - 1;
    const title = conceptLabel || `Question ${i + 1}`;
    const completionAction: Step["completionAction"] = isLast
      ? { buttonLabel: "Finish Test →", route: "/lesson/[id]/complete" }
      : { buttonLabel: "Next →", nextStepId: `step-${i + 2}` };

    const step: Step = {
      id: stepId,
      title,
      concept: conceptLabel || `Question ${i + 1}`,
      conceptFraming:
        "A practice problem drawn from a concept you reviewed earlier. Read it carefully and work it through.",
      masteryThreshold: 0,
      fallbackStepId: stepId,
      fallbackMessage: "Give it another careful read and try again.",
      hints: [
        "Read carefully and identify what's being asked.",
        "Translate the words into an equation, then solve step by step.",
      ],
      skipMasteryGate: true,
      ...(isLast ? { isLastStep: true } : {}),
      completionAction,
      anchors: 1,
      present: 1,
      problems: [problem],
    };
    return step;
  });

  return {
    id: meta.id,
    title: spec.title,
    subject: "Practice Test",
    description: spec.description,
    estimatedMinutes: Math.max(1, steps.length),
    totalSteps: steps.length,
    masteryRule: {
      description:
        "A practice test is a sequence of ungated steps, one question each: every problem is graded for feedback, but the learner is free to finish regardless of score.",
      nextButtonVisibleOnlyAfterMastery: false,
    },
    steps,
  };
}

/**
 * Validates a built practice test: an id, a title, at least one step, and that
 * EVERY step holds exactly its one graded (numeric-input/multiple-choice)
 * problem. Returns an error string when invalid, or null when valid.
 */
export function validatePracticeTest(lesson: Lesson): string | null {
  if (!lesson.id) return "Practice test is missing an id.";
  if (!lesson.title || !lesson.title.trim()) {
    return "Practice test is missing a title.";
  }
  if (lesson.steps.length < 1) return "Practice test has no steps.";
  for (let i = 0; i < lesson.steps.length; i++) {
    const step = lesson.steps[i];
    if (step.problems.length !== 1) {
      return `Practice test step ${i + 1} must have exactly one problem.`;
    }
    if (!isGraded(step.problems[0])) {
      return `Practice test step ${i + 1} has no graded problem.`;
    }
  }
  return null;
}
