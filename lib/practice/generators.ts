/**
 * Procedural generators for the endless Practice / Sandbox mode.
 *
 * Every question is generated correct-by-construction (no parsing/solving at
 * runtime, we build the worked solution from numbers we already control).
 *
 * Difficulty-aware: each builder takes a `Difficulty` and adjusts number sizes,
 * step counts, and distractor closeness.
 *   - easy  : single-step, small numbers, clear/obvious choices.
 *   - medium: balanced.
 *   - hard  : multi-step, bigger numbers, trickier distractors / "no mistake".
 *
 * `nextQuestion` enforces interleaving: it never returns the same topic three
 * times in a row, and avoids repeating the exact question type back-to-back.
 */

import {
  Difficulty,
  FindMistakeQuestion,
  OddOneOutOption,
  OddOneOutQuestion,
  OrderStepsQuestion,
  PracticeQuestion,
  PracticeQuestionType,
  PracticeTopic,
  PRACTICE_TOPICS,
} from "@/types/practice";
import { expectedMsFor } from "@/lib/practice/skill";

export const MINUS = "−";
export const SUP2 = "²";

const QUESTION_TYPES: PracticeQuestionType[] = [
  "find-mistake",
  "order-steps",
  "odd-one-out",
];

// ---------------------------------------------------------------------------
// Small random helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randNonZero(min: number, max: number): number {
  let n = 0;
  do {
    n = rand(min, max);
  } while (n === 0);
  return n;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

let idCounter = 0;
function uid(topic: PracticeTopic, type: PracticeQuestionType): string {
  idCounter += 1;
  return `${topic}-${type}-${idCounter}-${Math.floor(Math.random() * 1e6)}`;
}

/** Common base fields (difficulty + expected time + source) for every question. */
function meta(type: PracticeQuestionType, d: Difficulty) {
  return {
    difficulty: d,
    expectedMs: expectedMsFor(type, d),
    source: "heuristic" as const,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "+ 3" or "− 3" with a leading space, for appending a constant term. */
function signedConst(n: number): string {
  return n >= 0 ? `+ ${n}` : `${MINUS} ${Math.abs(n)}`;
}

/** Linear equation label, omitting a leading coefficient of 1. */
function linEq(a: number, b: number, c: number): string {
  const ax = a === 1 ? "x" : `${a}x`;
  return `${ax} ${signedConst(b)} = ${c}`;
}

/** y = mx + b style line label. b may be 0 (term omitted). */
function lineEquation(m: number, b: number): string {
  if (b === 0) return `y = ${m}x`;
  return `y = ${m}x ${signedConst(b)}`;
}

// ===========================================================================
// EQUATIONS
// ===========================================================================

interface EqParams {
  a: number;
  b: number;
  x: number;
  c: number;
  cb: number;
  oneStep: boolean;
}

function eqParams(d: Difficulty): EqParams {
  if (d === "easy") {
    const a = 1;
    const b = randNonZero(1, 6);
    const x = rand(1, 7);
    const c = a * x + b;
    return { a, b, x, c, cb: c - b, oneStep: true };
  }
  if (d === "hard") {
    const a = rand(3, 9);
    const b = randNonZero(-12, 12);
    const x = rand(-9, 12);
    const c = a * x + b;
    return { a, b, x, c, cb: c - b, oneStep: false };
  }
  const a = rand(2, 5);
  const b = randNonZero(-6, 6);
  const x = rand(-5, 6);
  const c = a * x + b;
  return { a, b, x, c, cb: c - b, oneStep: false };
}

function eqFindMistake(d: Difficulty): FindMistakeQuestion {
  const { a, b, x, c, cb, oneStep } = eqParams(d);
  const problemLabel = `Solve: ${linEq(a, b, c)}`;
  const moveLine = `${a === 1 ? "x" : `${a}x`} = ${c} ${
    b >= 0 ? MINUS : "+"
  } ${Math.abs(b)}`;

  let steps: string[];
  let mistakeIndex: number | null;
  let explanation: string;

  if (oneStep) {
    // Single-step: move the constant, then read off x.
    const variant = pick(["none", "result", "result"] as const);
    if (variant === "none") {
      steps = [moveLine, `x = ${x}`];
      mistakeIndex = null;
      explanation = `All correct: ${c} ${b >= 0 ? MINUS : "+"} ${Math.abs(
        b
      )} = ${x}.`;
    } else {
      const wrong = pick([x + 1, x - 1, x !== 0 ? -x : x + 2].filter((v) => v !== x));
      steps = [moveLine, `x = ${wrong}`];
      mistakeIndex = 1;
      explanation = `Step 2 is wrong: ${c} ${b >= 0 ? MINUS : "+"} ${Math.abs(
        b
      )} = ${x}, not ${wrong}.`;
    }
  } else {
    // Two-step: move, simplify, divide. Hard biases toward subtle errors / none.
    const pool =
      d === "hard"
        ? (["none", "none", "simplify", "divide"] as const)
        : (["none", "simplify", "divide"] as const);
    const variant = pick(pool);
    if (variant === "none") {
      steps = [moveLine, `${a}x = ${cb}`, `x = ${x}`];
      mistakeIndex = null;
      explanation = `Every line checks out: ${c} ${b >= 0 ? MINUS : "+"} ${Math.abs(
        b
      )} = ${cb}, and ${cb} ÷ ${a} = ${x}.`;
    } else if (variant === "simplify") {
      const wrongCb = cb + (Math.random() < 0.5 ? a : -a);
      steps = [moveLine, `${a}x = ${wrongCb}`, `x = ${wrongCb / a}`];
      mistakeIndex = 1;
      explanation = `Step 2 is wrong: ${c} ${b >= 0 ? MINUS : "+"} ${Math.abs(
        b
      )} = ${cb}, not ${wrongCb}. Done correctly, x = ${x}.`;
    } else {
      const wrong = pick([x + 1, x - 1, x !== 0 ? -x : x + 2].filter((v) => v !== x));
      steps = [moveLine, `${a}x = ${cb}`, `x = ${wrong}`];
      mistakeIndex = 2;
      explanation = `Step 3 is wrong: ${cb} ÷ ${a} = ${x}, not ${wrong}.`;
    }
  }

  return {
    ...meta("find-mistake", d),
    id: uid("equations", "find-mistake"),
    topic: "equations",
    type: "find-mistake",
    prompt: "Find the first step that contains a mistake (or say the work is correct).",
    problemLabel,
    steps,
    mistakeIndex,
    explanation,
  };
}

function eqOrderSteps(d: Difficulty): OrderStepsQuestion {
  const { a, b, x, c, cb, oneStep } = eqParams(d);
  const undo = b >= 0 ? `Subtract ${b} from both sides` : `Add ${-b} to both sides`;

  let steps: string[];
  if (oneStep) {
    steps = [
      undo,
      `x = ${x}`,
      `Check: ${x} ${b >= 0 ? `+ ${b}` : `${MINUS} ${-b}`} = ${c}`,
    ];
  } else {
    steps = [undo, `${a}x = ${cb}`, `Divide both sides by ${a}`, `x = ${x}`];
  }

  return {
    ...meta("order-steps", d),
    id: uid("equations", "order-steps"),
    topic: "equations",
    type: "order-steps",
    prompt: "Put these steps in the correct order to solve the equation.",
    problemLabel: `Solve: ${linEq(a, b, c)}`,
    steps,
    explanation: oneStep
      ? `Undo the constant first (${
          b >= 0 ? `subtract ${b}` : `add ${-b}`
        }), then check your answer x = ${x}.`
      : `First undo the ${
          b >= 0 ? "addition" : "subtraction"
        } (${
          b >= 0 ? `subtract ${b}` : `add ${-b}`
        }), then divide both sides by ${a} to get x = ${x}.`,
  };
}

const eqMakers: ReadonlyArray<(t: number) => string> = [
  (t) => {
    const p = rand(1, 5);
    return `x + ${p} = ${t + p}`;
  },
  (t) => {
    const p = rand(1, 5);
    return `x ${MINUS} ${p} = ${t - p}`;
  },
  (t) => {
    const q = rand(2, 4);
    return `${q}x = ${q * t}`;
  },
  (t) => {
    const q = rand(2, 4);
    const p = rand(1, 4);
    return `${q}x + ${p} = ${q * t + p}`;
  },
];

function eqOddOneOut(d: Difficulty): OddOneOutQuestion {
  const k = d === "easy" ? rand(1, 5) : rand(-3, 8);
  const offset =
    d === "easy"
      ? pick([-3, -2, 2, 3])
      : d === "hard"
        ? pick([-1, 1])
        : pick([-2, -1, 1, 2]);
  const m = k + offset;
  const makers = shuffle(eqMakers);
  const sameTexts = [makers[0](k), makers[1](k), makers[2](k)];
  const oddText = makers[3](m);

  const options: OddOneOutOption[] = shuffle([
    { id: "o0", text: sameTexts[0] },
    { id: "o1", text: sameTexts[1] },
    { id: "o2", text: sameTexts[2] },
    { id: "odd", text: oddText },
  ]);

  return {
    ...meta("odd-one-out", d),
    id: uid("equations", "odd-one-out"),
    topic: "equations",
    type: "odd-one-out",
    prompt: "Three of these equations have the same solution. Which one doesn't belong?",
    options,
    oddId: "odd",
    explanation: `Three solve to x = ${k}, but “${oddText}” solves to x = ${m}, so it's the odd one out.`,
  };
}

// ===========================================================================
// GRAPHING
// ===========================================================================

function graphRanges(d: Difficulty) {
  if (d === "easy") return { mAbs: 2, bAbs: 4 };
  if (d === "hard") return { mAbs: 6, bAbs: 6 };
  return { mAbs: 4, bAbs: 5 };
}

function graphFindMistake(d: Difficulty): FindMistakeQuestion {
  const { mAbs, bAbs } = graphRanges(d);
  const m = randNonZero(-mAbs, mAbs);
  const b = rand(-bAbs, bAbs);
  const problemLabel = `${lineEquation(m, b)}`;

  const pool =
    d === "hard"
      ? (["none", "none", "slope", "intercept", "crossing"] as const)
      : (["none", "slope", "intercept", "crossing"] as const);
  const variant = pick(pool);
  const steps = [
    `Slope m = ${m}`,
    `y-intercept = ${b}`,
    `The line crosses the y-axis at (0, ${b})`,
  ];

  let mistakeIndex: number | null = null;
  let explanation: string;

  if (variant === "none") {
    explanation = `All correct: the coefficient of x is the slope (${m}) and the constant is the y-intercept (${b}), crossing at (0, ${b}).`;
  } else if (variant === "slope") {
    steps[0] = `Slope m = ${-m}`;
    mistakeIndex = 0;
    explanation = `Step 1 is wrong: the slope is the coefficient of x, which is ${m}, not ${-m}.`;
  } else if (variant === "intercept") {
    const wrong = b !== 0 ? -b : b + 1;
    steps[1] = `y-intercept = ${wrong}`;
    mistakeIndex = 1;
    explanation = `Step 2 is wrong: the y-intercept is the constant term, ${b}, not ${wrong}.`;
  } else {
    steps[2] = `The line crosses the y-axis at (${b}, 0)`;
    mistakeIndex = 2;
    explanation = `Step 3 is wrong: a y-intercept of ${b} means the line crosses at (0, ${b}), not (${b}, 0).`;
  }

  return {
    ...meta("find-mistake", d),
    id: uid("graphing", "find-mistake"),
    topic: "graphing",
    type: "find-mistake",
    prompt: "Find the first step that contains a mistake (or say the work is correct).",
    problemLabel: `Read the slope and y-intercept of ${problemLabel}`,
    steps,
    mistakeIndex,
    explanation,
  };
}

function graphOrderSteps(d: Difficulty): OrderStepsQuestion {
  const { mAbs, bAbs } = graphRanges(d);
  const m = randNonZero(-mAbs, mAbs);
  const b = rand(-bAbs, bAbs);
  const moveStep =
    m >= 0
      ? `From there, go up ${m} and right 1 to a second point`
      : `From there, go down ${-m} and right 1 to a second point`;
  return {
    ...meta("order-steps", d),
    id: uid("graphing", "order-steps"),
    topic: "graphing",
    type: "order-steps",
    prompt: "Put these steps in order to graph the line.",
    problemLabel: `Graph ${lineEquation(m, b)}`,
    steps: [
      `Plot the y-intercept at (0, ${b})`,
      `Read the slope as rise over run: ${m} = ${m}/1`,
      moveStep,
      "Draw a straight line through both points",
    ],
    explanation: `Start at the y-intercept (0, ${b}), use the slope ${m} to step to a second point, then connect them with a straight line.`,
  };
}

function graphOddOneOut(d: Difficulty): OddOneOutQuestion {
  const variant = pick(["slope", "origin"] as const);
  const { mAbs } = graphRanges(d);

  if (variant === "slope") {
    const m = randNonZero(-mAbs, mAbs);
    let m2 = d === "hard" ? m + pick([-1, 1]) : randNonZero(-mAbs, mAbs);
    while (m2 === m || m2 === 0) m2 = randNonZero(-mAbs - 1, mAbs + 1);
    const bs = shuffle([-3, -1, 1, 2, 3, 4]).slice(0, 3);
    const oddB = pick([-2, 0, 5]);
    const options: OddOneOutOption[] = shuffle([
      { id: "o0", text: lineEquation(m, bs[0]) },
      { id: "o1", text: lineEquation(m, bs[1]) },
      { id: "o2", text: lineEquation(m, bs[2]) },
      { id: "odd", text: lineEquation(m2, oddB) },
    ]);
    return {
      ...meta("odd-one-out", d),
      id: uid("graphing", "odd-one-out"),
      topic: "graphing",
      type: "odd-one-out",
      prompt: "Three of these lines are parallel. Which one doesn't belong?",
      options,
      oddId: "odd",
      explanation: `Three share slope ${m} (parallel lines), but “${lineEquation(
        m2,
        oddB
      )}” has slope ${m2}.`,
    };
  }

  const slopes = shuffle([-3, -2, 2, 3, 4]).slice(0, 3);
  const oddM = randNonZero(-mAbs, mAbs);
  const oddB = randNonZero(-5, 5);
  const options: OddOneOutOption[] = shuffle([
    { id: "o0", text: lineEquation(slopes[0], 0) },
    { id: "o1", text: lineEquation(slopes[1], 0) },
    { id: "o2", text: lineEquation(slopes[2], 0) },
    { id: "odd", text: lineEquation(oddM, oddB) },
  ]);
  return {
    ...meta("odd-one-out", d),
    id: uid("graphing", "odd-one-out"),
    topic: "graphing",
    type: "odd-one-out",
    prompt: "Three of these lines pass through the origin. Which one doesn't belong?",
    options,
    oddId: "odd",
    explanation: `Three have no constant term, so they pass through (0, 0). “${lineEquation(
      oddM,
      oddB
    )}” has a y-intercept of ${oddB}.`,
  };
}

// ===========================================================================
// QUADRATICS
// ===========================================================================

function quadParams(d: Difficulty) {
  const lo = 1;
  const hi = d === "easy" ? 3 : d === "hard" ? 9 : 6;
  const p = rand(lo, hi);
  const q = rand(lo, hi);
  return { p, q, b: p + q, c: p * q };
}

function quadFindMistake(d: Difficulty): FindMistakeQuestion {
  const { p, q, b, c } = quadParams(d);
  const problemLabel = `Factor x${SUP2} + ${b}x + ${c}`;
  const pool =
    d === "hard"
      ? (["none", "numbers", "sign", "sign"] as const)
      : (["none", "numbers", "sign"] as const);
  const variant = pick(pool);

  let steps: string[];
  let mistakeIndex: number | null;
  let explanation: string;

  if (variant === "none") {
    steps = [
      `Find two numbers that multiply to ${c} and add to ${b}`,
      `The numbers are ${p} and ${q}`,
      `Factored form: (x + ${p})(x + ${q})`,
    ];
    mistakeIndex = null;
    explanation = `All correct: ${p} × ${q} = ${c} and ${p} + ${q} = ${b}, so the factors are (x + ${p})(x + ${q}).`;
  } else if (variant === "numbers") {
    const q2 = q + 1;
    steps = [
      `Find two numbers that multiply to ${c} and add to ${b}`,
      `The numbers are ${p} and ${q2}`,
      `Factored form: (x + ${p})(x + ${q2})`,
    ];
    mistakeIndex = 1;
    explanation = `Step 2 is wrong: ${p} and ${q2} multiply to ${
      p * q2
    } and add to ${
      p + q2
    }. You need numbers multiplying to ${c} and adding to ${b}: ${p} and ${q}.`;
  } else {
    steps = [
      `Find two numbers that multiply to ${c} and add to ${b}`,
      `The numbers are ${p} and ${q}`,
      `Factored form: (x ${MINUS} ${p})(x + ${q})`,
    ];
    mistakeIndex = 2;
    explanation = `Step 3 has a sign error. The numbers are +${p} and +${q}, so both factors use plus: (x + ${p})(x + ${q}).`;
  }

  return {
    ...meta("find-mistake", d),
    id: uid("quadratics", "find-mistake"),
    topic: "quadratics",
    type: "find-mistake",
    prompt: "Find the first step that contains a mistake (or say the work is correct).",
    problemLabel,
    steps,
    mistakeIndex,
    explanation,
  };
}

function quadOrderSteps(d: Difficulty): OrderStepsQuestion {
  const { p, q, b, c } = quadParams(d);
  return {
    ...meta("order-steps", d),
    id: uid("quadratics", "order-steps"),
    topic: "quadratics",
    type: "order-steps",
    prompt: "Put these factoring steps in the correct order.",
    problemLabel: `Factor x${SUP2} + ${b}x + ${c}`,
    steps: [
      `Look for two numbers that multiply to ${c} and add to ${b}`,
      `The numbers are ${p} and ${q}`,
      `Write the factors: (x + ${p})(x + ${q})`,
      `Check: expanding (x + ${p})(x + ${q}) gives x${SUP2} + ${b}x + ${c}`,
    ],
    explanation: `Find the number pair (${p} and ${q}), write them as factors, then expand to confirm you get x${SUP2} + ${b}x + ${c}.`,
  };
}

function quadOddOneOut(d: Difficulty): OddOneOutQuestion {
  const variant = pick(["linear", "direction"] as const);
  const big = d === "hard";

  if (variant === "linear") {
    const quads = shuffle([
      `y = x${SUP2} ${signedConst(randNonZero(-5, 5))}`,
      `y = ${big ? rand(2, 5) : 2}x${SUP2} + ${rand(1, 5)}x`,
      `y = x${SUP2} + ${rand(1, 5)}x ${signedConst(randNonZero(-4, 4))}`,
    ]);
    const oddText = `y = ${rand(2, 5)}x ${signedConst(randNonZero(-5, 5))}`;
    const options: OddOneOutOption[] = shuffle([
      { id: "o0", text: quads[0] },
      { id: "o1", text: quads[1] },
      { id: "o2", text: quads[2] },
      { id: "odd", text: oddText },
    ]);
    return {
      ...meta("odd-one-out", d),
      id: uid("quadratics", "odd-one-out"),
      topic: "quadratics",
      type: "odd-one-out",
      prompt: "Three of these are quadratics. Which one doesn't belong?",
      options,
      oddId: "odd",
      explanation: `Three have an x${SUP2} term (they're quadratics). “${oddText}” is linear, so it doesn't belong.`,
    };
  }

  const upA = shuffle([1, 2, 3]);
  const ups = upA.map(
    (a) => `y = ${a === 1 ? "" : a}x${SUP2} ${signedConst(randNonZero(-4, 4))}`
  );
  const downA = big ? rand(2, 4) : rand(1, 3);
  const oddText = `y = ${MINUS}${downA === 1 ? "" : downA}x${SUP2} ${signedConst(
    randNonZero(-4, 4)
  )}`;
  const options: OddOneOutOption[] = shuffle([
    { id: "o0", text: ups[0] },
    { id: "o1", text: ups[1] },
    { id: "o2", text: ups[2] },
    { id: "odd", text: oddText },
  ]);
  return {
    ...meta("odd-one-out", d),
    id: uid("quadratics", "odd-one-out"),
    topic: "quadratics",
    type: "odd-one-out",
    prompt: "Three of these parabolas open the same way. Which one doesn't belong?",
    options,
    oddId: "odd",
    explanation: `Three have a positive x${SUP2} coefficient (open upward). “${oddText}” has a negative x${SUP2} coefficient, so it opens downward.`,
  };
}

// ===========================================================================
// Dispatch + interleaving
// ===========================================================================

const GENERATORS: Record<
  PracticeTopic,
  Record<PracticeQuestionType, (d: Difficulty) => PracticeQuestion>
> = {
  equations: {
    "find-mistake": eqFindMistake,
    "order-steps": eqOrderSteps,
    "odd-one-out": eqOddOneOut,
  },
  graphing: {
    "find-mistake": graphFindMistake,
    "order-steps": graphOrderSteps,
    "odd-one-out": graphOddOneOut,
  },
  quadratics: {
    "find-mistake": quadFindMistake,
    "order-steps": quadOrderSteps,
    "odd-one-out": quadOddOneOut,
  },
};

export interface RecentEntry {
  topic: PracticeTopic;
  type: PracticeQuestionType;
}

function pickTopic(recent: RecentEntry[], pool: PracticeTopic[]): PracticeTopic {
  const lastTwo = recent.slice(-2);
  if (lastTwo.length === 2 && lastTwo[0].topic === lastTwo[1].topic) {
    // Avoid a third in a row when there's another topic available; with only one
    // unlocked topic, repeats are unavoidable.
    const filtered = pool.filter((t) => t !== lastTwo[0].topic);
    if (filtered.length > 0) return pick(filtered);
  }
  return pick(pool);
}

function pickType(recent: RecentEntry[]): PracticeQuestionType {
  const last = recent[recent.length - 1];
  if (last) {
    return pick(QUESTION_TYPES.filter((t) => t !== last.type));
  }
  return pick(QUESTION_TYPES);
}

/**
 * Pick the next topic + question type (with interleaving rules) and resolve the
 * difficulty band for that topic. This is the SELECTION half of generation,
 * separated so the AI can fill the content while we keep interleaving and a
 * deterministic local fallback.
 *
 * Pass the recent history (most recent last) so interleaving applies: never 3
 * same-topic in a row, and never the same question type twice in a row.
 *
 * `allowedTopics` restricts selection to topics the learner has unlocked. When
 * omitted or empty, all topics are eligible. `difficultyByTopic` sets the band
 * per topic (from the AI coach / comfort seed, with a heuristic fallback);
 * defaults to "medium".
 */
export function pickTopicAndType(
  recent: RecentEntry[] = [],
  allowedTopics?: PracticeTopic[],
  difficultyByTopic?: Partial<Record<PracticeTopic, Difficulty>>
): { topic: PracticeTopic; type: PracticeQuestionType; difficulty: Difficulty } {
  const pool =
    allowedTopics && allowedTopics.length > 0 ? allowedTopics : PRACTICE_TOPICS;
  const topic = pickTopic(recent, pool);
  const type = pickType(recent);
  const difficulty = difficultyByTopic?.[topic] ?? "medium";
  return { topic, type, difficulty };
}

/**
 * Build the question CONTENT locally (correct-by-construction). Every question
 * returned here is tagged `source: "heuristic"` via `meta`. Used both as the
 * default generator and as the silent fallback when the AI is unavailable or
 * returns invalid output.
 */
export function buildLocalQuestion(
  topic: PracticeTopic,
  type: PracticeQuestionType,
  difficulty: Difficulty
): PracticeQuestion {
  return GENERATORS[topic][type](difficulty);
}

/**
 * Fixed, deterministic FIRST question per topic. Used so the very first problem
 * of a sandbox session is identical every time (no Math.random), which makes the
 * entry point predictable for now. Subsequent questions stay randomized.
 */
const FIRST_QUESTIONS: Record<PracticeTopic, PracticeQuestion> = {
  equations: {
    ...meta("find-mistake", "easy"),
    id: "sandbox-first-equations",
    topic: "equations",
    type: "find-mistake",
    prompt:
      "Find the first step that contains a mistake (or say the work is correct).",
    problemLabel: `Solve: 2x + 3 = 11`,
    steps: [`2x = 11 ${MINUS} 3`, `2x = 8`, `x = 5`],
    mistakeIndex: 2,
    explanation: `Step 3 is wrong: 8 ÷ 2 = 4, not 5.`,
  } satisfies FindMistakeQuestion,
  graphing: {
    ...meta("find-mistake", "easy"),
    id: "sandbox-first-graphing",
    topic: "graphing",
    type: "find-mistake",
    prompt:
      "Find the first step that contains a mistake (or say the work is correct).",
    problemLabel: `Read the slope and y-intercept of y = 2x + 3`,
    steps: [
      `Slope m = 2`,
      `y-intercept = 3`,
      `The line crosses the y-axis at (0, 3)`,
    ],
    mistakeIndex: null,
    explanation: `All correct: the coefficient of x is the slope (2) and the constant is the y-intercept (3), crossing at (0, 3).`,
  } satisfies FindMistakeQuestion,
  quadratics: {
    ...meta("find-mistake", "easy"),
    id: "sandbox-first-quadratics",
    topic: "quadratics",
    type: "find-mistake",
    prompt:
      "Find the first step that contains a mistake (or say the work is correct).",
    problemLabel: `Factor x${SUP2} + 5x + 6`,
    steps: [
      `Find two numbers that multiply to 6 and add to 5`,
      `The numbers are 2 and 3`,
      `Factored form: (x + 2)(x + 3)`,
    ],
    mistakeIndex: null,
    explanation: `All correct: 2 × 3 = 6 and 2 + 3 = 5, so the factors are (x + 2)(x + 3).`,
  } satisfies FindMistakeQuestion,
};

/**
 * The deterministic first question for a session: the fixed question for the
 * first unlocked topic (in canonical topic order). Falls back to a random
 * question only if no allowed topic has a fixed entry.
 */
export function firstQuestion(allowedTopics?: PracticeTopic[]): PracticeQuestion {
  const pool =
    allowedTopics && allowedTopics.length > 0 ? allowedTopics : PRACTICE_TOPICS;
  const topic = PRACTICE_TOPICS.find((t) => pool.includes(t));
  if (topic) return FIRST_QUESTIONS[topic];
  return nextQuestion([], allowedTopics);
}

/**
 * Produce the next endless practice question entirely locally, selection plus
 * content. Kept as a thin wrapper over `pickTopicAndType` + `buildLocalQuestion`
 * so existing callers keep working.
 */
export function nextQuestion(
  recent: RecentEntry[] = [],
  allowedTopics?: PracticeTopic[],
  difficultyByTopic?: Partial<Record<PracticeTopic, Difficulty>>
): PracticeQuestion {
  const { topic, type, difficulty } = pickTopicAndType(
    recent,
    allowedTopics,
    difficultyByTopic
  );
  return buildLocalQuestion(topic, type, difficulty);
}
