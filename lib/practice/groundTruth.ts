/**
 * Deterministic "ground truth" for endless-practice problems.
 *
 * The photo-feedback route (`/api/sandbox/feedback`) must NOT trust the vision
 * model to invent the correct answer: it computes the answer here, server-side,
 * straight from the problem's known structure, and passes it to the model as the
 * authoritative solution. The model's job is then to read the student's photo
 * and compare it to THIS solution, not to free-form its own.
 *
 * This is intentionally separate from (and does not use) the practice-test
 * `verify.ts` solver, which another part of the app owns. It only needs to
 * handle the small, generator-produced label families used by endless practice:
 *   - linear:   "Solve: 2x + 3 = 11"
 *   - quadratic:"Factor x² + 5x + 6"
 *   - graphing: "...y = 2x + 3" (slope / y-intercept)
 *   - concept:  odd-one-out (no single algebraic answer)
 *
 * Parsing is best-effort. When a label can't be parsed, we still produce a
 * conclusion from the structured fields the context already carries
 * (mistakeIndex, steps, oddAnswer, explanation), so grounding degrades safely.
 */

import type { PracticeProblemContext } from "@/types/practice";

const MINUS = "\u2212"; // − (the generators use this, not the ASCII hyphen)
const SUP2 = "\u00b2"; // ²

export type GroundTruthKind = "linear" | "quadratic" | "graphing" | "concept";

export interface GroundTruth {
  kind: GroundTruthKind;
  /** Canonical correct answer (e.g. "x = 4", "(x + 2)(x + 3)"), or null. */
  answer: string | null;
  /** Worked solution steps, when derivable. */
  workedSteps: string[];
  /** Plain-language statement of the correct conclusion for this activity. */
  conclusion: string;
  /** Solved value of x for linear problems; used for contradiction checks. */
  linearX?: number;
  /** The number pair (p, q) for a factored quadratic x² + (p+q)x + pq. */
  quadNumbers?: [number, number];
}

/** Replace the generators' Unicode minus with ASCII and collapse whitespace. */
function normalize(label: string): string {
  return label.replace(new RegExp(MINUS, "g"), "-").replace(/\s+/g, " ").trim();
}

/** Parse a coefficient prefix: "" → 1, "-" → -1, otherwise the integer. */
function coef(raw: string): number {
  if (raw === "" || raw === "+") return 1;
  if (raw === "-") return -1;
  return parseInt(raw, 10);
}

/** Solve a linear label like "Solve: 2x + 3 = 11" → { x, a, b, c }, or null. */
function parseLinear(
  label: string
): { a: number; b: number; c: number; x: number } | null {
  let s = normalize(label).replace(/^solve:\s*/i, "");
  // ax + b = c   /   ax - b = c
  let m = /^(-?\d*)x\s*([+-])\s*(\d+)\s*=\s*(-?\d+)$/.exec(s);
  if (m) {
    const a = coef(m[1]);
    const b = (m[2] === "-" ? -1 : 1) * parseInt(m[3], 10);
    const c = parseInt(m[4], 10);
    if (a === 0) return null;
    const x = (c - b) / a;
    return { a, b, c, x };
  }
  // ax = c (no constant term)
  m = /^(-?\d*)x\s*=\s*(-?\d+)$/.exec(s);
  if (m) {
    const a = coef(m[1]);
    const c = parseInt(m[2], 10);
    if (a === 0) return null;
    return { a, b: 0, c, x: c / a };
  }
  return null;
}

/** Find p, q with p + q = b and p·q = c (the factoring number pair), or null. */
function factorPair(b: number, c: number): [number, number] | null {
  for (let p = 1; p <= Math.abs(c); p++) {
    if (c % p !== 0) continue;
    const q = c / p;
    if (p + q === b) return [p, q];
  }
  return null;
}

/** Parse "Factor x² + 5x + 6" → number pair (p, q), or null. */
function parseQuadratic(label: string): [number, number] | null {
  const s = normalize(label);
  const m = new RegExp(`x${SUP2}\\s*\\+\\s*(\\d+)x\\s*\\+\\s*(\\d+)`).exec(s);
  if (!m) return null;
  return factorPair(parseInt(m[1], 10), parseInt(m[2], 10));
}

/** Parse a "y = mx + b" line anywhere in the label → { m, b }, or null. */
function parseLine(label: string): { m: number; b: number } | null {
  const s = normalize(label);
  const m = /y\s*=\s*(-?\d*)x\s*(?:([+-])\s*(\d+))?/.exec(s);
  if (!m) return null;
  const slope = coef(m[1]);
  const b = m[2] ? (m[2] === "-" ? -1 : 1) * parseInt(m[3], 10) : 0;
  return { m: slope, b };
}

function describeStepConclusion(p: PracticeProblemContext): string {
  if (typeof p.mistakeIndex === "undefined") {
    // order-steps: steps are in the correct order.
    if (p.steps && p.steps.length > 0) {
      return `The correct order is: ${p.steps.join(" → ")}.`;
    }
    return p.explanation;
  }
  if (p.mistakeIndex === null) {
    return "The worked solution shown is fully correct - there is no mistake.";
  }
  const wrong = p.steps?.[p.mistakeIndex] ?? "";
  return `The FIRST mistake is at step ${p.mistakeIndex + 1} (1-based)${
    wrong ? `: "${wrong}"` : ""
  }.`;
}

/**
 * Compute the deterministic ground truth for a practice problem context. Never
 * throws - falls back to the structured fields when a label can't be parsed.
 */
export function computeGroundTruth(p: PracticeProblemContext): GroundTruth {
  const label = p.problemLabel ?? p.prompt;

  // odd-one-out: conceptual, no single algebraic answer.
  if (p.options && p.options.length > 0) {
    return {
      kind: "concept",
      answer: p.oddAnswer ? `Odd one out: ${p.oddAnswer}` : null,
      workedSteps: [],
      conclusion: p.oddAnswer
        ? `The odd one out is "${p.oddAnswer}". ${p.explanation}`
        : p.explanation,
    };
  }

  // Linear "Solve: ax + b = c".
  const lin = parseLinear(label);
  if (lin) {
    const ax = lin.a === 1 ? "x" : lin.a === -1 ? "-x" : `${lin.a}x`;
    const moved = lin.c - lin.b;
    const workedSteps = [
      `${ax} ${lin.b >= 0 ? "+" : "-"} ${Math.abs(lin.b)} = ${lin.c}`,
      `${ax} = ${lin.c} ${lin.b >= 0 ? "-" : "+"} ${Math.abs(lin.b)} = ${moved}`,
      `x = ${moved} ÷ ${lin.a} = ${lin.x}`,
    ];
    return {
      kind: "linear",
      answer: `x = ${lin.x}`,
      workedSteps,
      conclusion: `${describeStepConclusion(p)} The equation solves to x = ${lin.x}.`,
      linearX: lin.x,
    };
  }

  // Quadratic "Factor x² + bx + c".
  const quad = parseQuadratic(label);
  if (quad) {
    const [p1, p2] = quad;
    return {
      kind: "quadratic",
      answer: `(x + ${p1})(x + ${p2})`,
      workedSteps: [
        `Find two numbers that multiply to ${p1 * p2} and add to ${p1 + p2}`,
        `Those numbers are ${p1} and ${p2}`,
        `Factored form: (x + ${p1})(x + ${p2})`,
      ],
      conclusion: `${describeStepConclusion(p)} The correct factorization is (x + ${p1})(x + ${p2}).`,
      quadNumbers: quad,
    };
  }

  // Graphing "y = mx + b" (slope / y-intercept reading).
  const line = parseLine(label);
  if (line) {
    return {
      kind: "graphing",
      answer: `slope = ${line.m}, y-intercept = ${line.b}`,
      workedSteps: [
        `The coefficient of x is the slope: m = ${line.m}`,
        `The constant term is the y-intercept: b = ${line.b}`,
        `So the line crosses the y-axis at (0, ${line.b})`,
      ],
      conclusion: `${describeStepConclusion(p)} The slope is ${line.m} and the y-intercept is ${line.b}, so the line crosses the y-axis at (0, ${line.b}).`,
    };
  }

  // Fallback: derive a conclusion from the structured fields. When the caller
  // supplied a pre-verified correctAnswer (the practice-test runner does, since
  // its word problems don't match the grammars above), trust it as the answer
  // and fold it into the conclusion the tutor model is told to compare against.
  const stepConclusion = describeStepConclusion(p);
  if (p.correctAnswer && p.correctAnswer.trim()) {
    const answer = p.correctAnswer.trim();
    return {
      kind: "concept",
      answer,
      workedSteps: [],
      conclusion: `The verified correct answer is ${answer}. ${stepConclusion}`,
    };
  }
  return {
    kind: "concept",
    answer: null,
    workedSteps: [],
    conclusion: stepConclusion,
  };
}

/** Pull a signed integer/decimal x-value out of free text ("x = 4", "x=-3"). */
function extractXValue(text: string): number | null {
  const s = text.replace(new RegExp(MINUS, "g"), "-");
  const m = /x\s*=\s*(-?\d+(?:\.\d+)?)/i.exec(s);
  return m ? parseFloat(m[1]) : null;
}

/** All signed integers found in a string, in order. */
function extractInts(text: string): number[] {
  const s = text.replace(new RegExp(MINUS, "g"), "-");
  return (s.match(/-?\d+/g) ?? []).map((n) => parseInt(n, 10));
}

/**
 * Decide whether the model's CLAIMED correct answer contradicts the
 * deterministic ground truth. Conservative on purpose: only returns true when we
 * can confidently parse a comparable answer out of the model's text AND it
 * disagrees. When we can't be sure, returns false so we don't wrongly suppress
 * otherwise-valid feedback.
 */
export function contradictsGroundTruth(
  gt: GroundTruth,
  modelCorrectAnswer: string | null | undefined
): boolean {
  if (!modelCorrectAnswer) return false;

  if (gt.kind === "linear" && typeof gt.linearX === "number") {
    const claimed = extractXValue(modelCorrectAnswer);
    return claimed !== null && claimed !== gt.linearX;
  }

  if (gt.kind === "quadratic" && gt.quadNumbers) {
    // The factored form (x + p)(x + q) - the model should reference both p and q.
    const ints = new Set(extractInts(modelCorrectAnswer).map((n) => Math.abs(n)));
    if (ints.size === 0) return false; // nothing parseable → don't flag
    const [p, q] = gt.quadNumbers;
    // Flag only if the model clearly states two factor numbers and neither set
    // matches our pair.
    const hasP = ints.has(Math.abs(p));
    const hasQ = ints.has(Math.abs(q));
    return !(hasP && hasQ);
  }

  // graphing / concept: not reliably comparable as free text → don't flag.
  return false;
}

/**
 * A safe, deterministic fallback message used when the model's feedback is
 * suppressed because it contradicted the known answer (or was unusable). States
 * the verified correct answer without parroting the model's bad math.
 */
export function safeGroundedFeedback(gt: GroundTruth): string {
  const lines: string[] = [];
  lines.push(
    "What we can confirm: We solved this problem ourselves to be sure."
  );
  lines.push(`The verified answer: ${gt.conclusion}`);
  if (gt.workedSteps.length > 0) {
    lines.push(`Worked solution: ${gt.workedSteps.join("; ")}`);
  }
  lines.push(
    "Next step: Compare each line of your own work to this and find the first line where they differ."
  );
  return lines.join("\n");
}
