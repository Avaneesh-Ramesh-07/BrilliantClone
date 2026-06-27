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

/** a, b, c, … for multiple-choice option ids (mirrors lesson-builder). */
function letterId(index: number): string {
  return String.fromCharCode(97 + index);
}

/**
 * Defensive cleanup: strips a trailing inline multiple-choice option list that
 * the model sometimes leaks into the question `prompt` (the choices belong only
 * in the `options` array, never in the stem). Matches an enumerated A–D run
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
    "TEST LENGTH — make it substantial:",
    "- Produce about 20 problems total, and NEVER fewer than 15.",
    "- The eligible-concept list is often SHORTER than 15, so write MULTIPLE",
    "  distinct problems per concept — distributed across all the listed concepts —",
    "  to reach the count. Reuse a concept across several problems freely.",
    "- Every problem on the SAME concept must use a genuinely different scenario",
    "  and different numbers; never produce near-duplicates or reworded twins.",
    "- Keep each 'explanation' reasonably CONCISE (a few tight sentences) so all",
    "  ~20 problems fit within the output budget without being truncated.",
    "",
    "CORE PRINCIPLE — stay on the target concept:",
    "- Each problem MUST DIRECTLY exercise EXACTLY ONE of the supplied eligible",
    "  concepts, and its 'conceptLabel' MUST be set to that concept's EXACT label",
    "  (copied verbatim from the provided list).",
    "- Frame each problem as a SHORT real-world WORD PROBLEM, but the scenario is",
    "  only a THIN WRAPPER around the actual target skill. The math the learner",
    "  does to solve it must BE that concept — nothing more.",
    "- Do NOT drift into skills or topics the learner hasn't covered. Do NOT bolt",
    "  on unrelated detours (no surprise geometry inside an equations problem, no",
    "  multi-topic chains). 'Challenging' must come from the concept ITSELF:",
    "  realistic numbers, a slightly less obvious setup, and trick MC distractors —",
    "  NOT from forcing extra unrelated steps.",
    "- Calibrate difficulty to the concept: a simple comparison concept stays a",
    "  simple comparison; a quadratic-feature concept can be genuinely harder.",
    "",
    "Difficulty + hint exemplars (match this framing AND this hint style):",
    "- EASY (single operation): 'Cathy has 5 oranges and Ben has 17 oranges. How",
    "  many more oranges does Cathy need to match Ben?' Hint nudges the operation",
    "  WITHOUT the result, e.g. 'Compare the two amounts — what is the difference?'",
    "- MEDIUM (set up + solve a linear equation): 'You join a gym. The initiation",
    "  fee is $50 and it charges $30 per month. If you spent $350 total, how many",
    "  months have you been a member?' Here x = months, so 30x + 50 = 350. For this",
    "  kind, the hint GIVES THE EQUATION TO SOLVE, e.g. 'Set up: 30x + 50 = 350.'",
    "- HARD (conceptual): 'A ball launcher launches a ball upward following the",
    "  parabola y = -x^2 + 2x + 1. What is the maximum height?' For this kind, the",
    "  hint is a GUIDING CONCEPTUAL QUESTION pointing at the key idea, NOT the",
    "  computation, e.g. 'What feature of a parabola does \"maximum height\"",
    "  correspond to?' (the vertex).",
    "",
    "The 'hint' field (REQUIRED on every problem):",
    "- A SINGLE short scaffold that helps the learner START, revealed only after a",
    "  wrong attempt. It MUST NOT reveal the final numeric answer (for numeric) or",
    "  the correct option (for mc).",
    "- For equation-setup problems: give the equation to solve (as in the gym",
    "  example) — but never the solved value.",
    "- For conceptual problems: ask the guiding question that points at the key",
    "  idea (as in the parabola example).",
    "- For simple one-step problems: name the operation/comparison to perform",
    "  without doing it.",
    "",
    "RATE-BASED PROBLEMS — strict rule:",
    "- Do NOT pose a rate-based problem (anything phrased as '$X per",
    "  month/hour/item', a constant rate of change, 'increases by N each ...',",
    "  speed/distance-per-time, etc.) UNLESS the problem statement EXPLICITLY",
    "  gives the learner the equation to use — written out as 'y = mx + b' or a",
    "  concrete instance like '30x + 50 = 350'.",
    "- For ANY rate/linear-cost scenario you DO use, state that explicit equation",
    "  right in the prompt, and make the 'hint' the equation to solve.",
    "- If you would otherwise write a rate problem WITHOUT giving the equation,",
    "  pick a DIFFERENT, non-rate situation instead.",
    "",
    "NO TRIVIAL / TAUTOLOGICAL QUESTIONS — strict rule:",
    "- FORBIDDEN: any question whose answer is restated, given, or trivially",
    "  implied by the prompt itself, and any pure definition/recall question.",
    "- BAD example to AVOID (the answer is literally in the question): 'If a line",
    "  crosses the y-axis at (0, -4), what is its starting point on the y-axis?'",
    "- Every problem MUST be a genuine, multi-sentence SITUATIONAL word problem",
    "  that requires real setup + reasoning to reach the answer — never a one-line",
    "  restatement or a 'what is the definition of ...' prompt.",
    "",
    "SITUATION ARCHETYPES to draw from (pick one that fits the target concept;",
    "vary them across the test, and always obey the rate rule above):",
    "- equations: total-cost or savings with a KNOWN total, age problems,",
    "  perimeter/area with a given total, splitting items among people,",
    "  consecutive integers.",
    "- graphing/lines: comparisons over time or distance, break-even between two",
    "  options, interpreting a GIVEN line equation in context — and when the",
    "  scenario is a rate/linear cost, give the explicit equation per the rate",
    "  rule.",
    "- quadratics: projectile / maximum height (the vertex), area maximization,",
    "  'for what input is the value zero' (roots) framed as a real scenario.",
    "",
    "THE 'prompt' FIELD — question stem ONLY (strict):",
    "- The 'prompt' MUST contain ONLY the question stem (the situation + what is",
    "  being asked). It must END with the question.",
    "- NEVER put the multiple-choice answer choices inside the 'prompt'. Do NOT",
    "  append an enumerated option list such as 'A) 2 and -3  B) 3 and -2  C) -2",
    "  and 3  D) -3 and 2' (or 'A.'/'(A)'/lowercase variants) to the prompt text.",
    "  The answer choices belong SOLELY in the 'options' array and are rendered by",
    "  the UI — listing them in the prompt would show them twice.",
    "- This applies to BOTH numeric and mc problems: the prompt is the stem, never",
    "  the answers.",
    "",
    "Other rules:",
    "- For multiple-choice ('mc') problems, write TRICK distractors that reflect",
    "  common mistakes ON THIS CONCEPT (sign errors, off-by-one, swapped values) —",
    "  not obvious throwaways. Exactly one option is correct ('correctIndex'). Put",
    "  every choice ONLY in the 'options' array — never inside the 'prompt'.",
    "- For 'numeric' problems the 'answer' is a single number.",
    "",
    "ANSWER EXPRESSION — REQUIRED on EVERY problem ('answerExpression'):",
    "- ALWAYS provide a SINGLE, fully-NUMERIC arithmetic expression that, when",
    "  evaluated, INDEPENDENTLY computes the answer. It must reflect the ACTUAL",
    "  computation that yields the answer for THIS problem — not a restatement of",
    "  the number.",
    "- It must be fully numeric: substitute ALL values and contain NO variables,",
    "  letters, or symbols (no x, y, etc.). Use math.js syntax: '^' for powers and",
    "  an explicit '*' for every multiplication (e.g. '2*x' is wrong; write the",
    "  number). Example — vertex y of 'y = -2x^2 + 8x' at x = 2: '-2*(2)^2 + 8*2'.",
    "- For 'numeric' problems it MUST evaluate to the numeric 'answer'.",
    "- For 'mc' problems it MUST evaluate to the NUMERIC VALUE that the correct",
    "  option represents. If the correct answer is inherently non-numeric (e.g. a",
    "  factored form), still give a numeric check when possible (e.g. the root",
    "  value); otherwise use the numeric value the correct option references.",
    "- This expression WILL BE CHECKED by the computer with math.js, and the",
    "  computed value overrides your stated answer — so make sure it is correct and",
    "  truly evaluates to the intended answer.",
    "- Mix numeric and multiple-choice problems across the test.",
    "- 'explanation' teaches the FULL worked solution; 'hint' is just the short",
    "  scaffold above (equation-to-solve for setup problems, a guiding question",
    "  for conceptual ones); 'correctFeedback' reinforces WHY it's right;",
    "  'incorrectFeedback' gently points at the misstep.",
    "- Keep ALL math in plain text (e.g. 'y = 2x + 3', 'x^2', '3/4'). No markdown,",
    "  no LaTeX.",
    "- In DISPLAYED fields (prompt, mc options, hint, explanation, feedback), the UI",
    "  renders any exponent written with '^' as a real superscript (e.g. 'x^2' shows",
    "  as x², '2^(n+1)' as 2 raised to n+1). So ALWAYS write exponents with the '^'",
    "  form and NEVER spell them out as 'to the power of' or 'squared'.",
  ].join("\n");
}

export function buildPracticeTestUserPrompt(concepts: EligibleConcept[]): string {
  const lines = concepts.map(
    (c) => `- "${c.conceptLabel}" (from the lesson "${c.lessonTitle}")`
  );

  return [
    "Write a practice test covering ONLY these concepts the learner last reviewed",
    "on a previous day (each entry is the concept followed by the lesson it came",
    "from):",
    ...lines,
    "",
    "Produce about 20 problems total, and NO FEWER THAN 15. The eligible-concept",
    "list above may have fewer than 15 entries, so you MUST write SEVERAL",
    "different problems for each concept as needed to reach the count — distribute",
    "the problems across all the listed concepts as evenly as you reasonably can.",
    "When you write multiple problems for the same concept, each one must use a",
    "genuinely DIFFERENT scenario and DIFFERENT numbers — no near-duplicates, no",
    "trivially reworded twins. For each problem:",
    "- Its scenario must test THAT concept SPECIFICALLY — a thin word-problem",
    "  wrapper around exactly that skill, never drifting into other topics.",
    "- Make it a REAL, multi-sentence situational word problem that needs setup",
    "  and reasoning. Do NOT write trivial or tautological questions whose answer",
    "  is restated or trivially implied by the prompt, and do NOT write pure",
    "  definition/recall questions (e.g. NEVER 'a line crosses the y-axis at",
    "  (0, -4), what is its y-axis starting point?' — the answer is given).",
    "- If the situation involves a constant rate / linear cost, you MUST write the",
    "  explicit equation (e.g. '30x + 50 = 350') into the prompt and make the hint",
    "  that equation; otherwise choose a non-rate situation.",
    "- Keep the 'prompt' to the question STEM only — never list the answer",
    "  choices (no 'A) ... B) ... C) ... D) ...' inside the prompt). The choices",
    "  go ONLY in the 'options' array.",
    "- Set 'conceptLabel' to that concept's label VERBATIM from the list above.",
    "- Include a tailored 'hint' that scaffolds the approach for THIS problem",
    "  without giving away the final answer (equation-to-solve for setup problems,",
    "  a guiding question for conceptual ones, the operation for simple ones).",
    "- Provide 'answerExpression': a SINGLE fully-numeric math.js expression (no",
    "  variables/letters; '^' for powers, explicit '*') that independently computes",
    "  the answer. For numeric it must evaluate to 'answer'; for mc it must",
    "  evaluate to the numeric value of the correct option. It will be evaluated",
    "  and used to verify/override the answer, so it MUST be correct.",
    "- Keep each 'explanation' reasonably CONCISE (a few tight sentences) so all",
    "  ~20 problems fit comfortably — clear worked solution, no padding.",
    "Vary the difficulty across problems and order them so the hardest come LAST.",
    "Give the test a short, motivating title and a one-sentence description.",
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
