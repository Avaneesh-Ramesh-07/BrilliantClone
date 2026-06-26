/**
 * Answer-key verification for AI-generated practice tests. The model emits a
 * fully-numeric, machine-evaluable `answerExpression` per problem; here we let
 * math.js compute the authoritative value so the computer's arithmetic
 * OVERRIDES the LLM's (which sometimes ships a wrong key — e.g. claiming the
 * vertex y of "y = -2x^2 + 8x" is 16 when it is actually 8).
 */

import { all, create } from "mathjs";
import type { PracticeProblemSpec } from "@/types/practice-test";

// A locked-down math.js instance: full function set for arithmetic, but with
// the dangerous, side-effecting entry points disabled so an expression can
// neither import new functions, define units, nor re-enter the parser.
const math = create(all, {});
const noop = () => {
  throw new Error("disabled");
};
math.import(
  {
    import: noop,
    createUnit: noop,
    evaluate: noop,
    parse: noop,
    simplify: noop,
    derivative: noop,
  },
  { override: true }
);

export interface ExpressionResult {
  ok: boolean;
  value: number | null;
}

/**
 * Safely evaluates a fully-numeric `answerExpression` to a finite number.
 * Returns `{ ok: false, value: null }` if it throws, is non-finite, or is not a
 * plain number (e.g. a unit, complex value, matrix, or object).
 */
export function evaluateAnswerExpression(expression: string): ExpressionResult {
  if (typeof expression !== "string" || !expression.trim()) {
    return { ok: false, value: null };
  }
  try {
    const result = math.evaluate(expression);
    if (typeof result === "number" && Number.isFinite(result)) {
      return { ok: true, value: result };
    }
    return { ok: false, value: null };
  } catch {
    return { ok: false, value: null };
  }
}

/** Rounds to an integer when within 1e-6, else to a sensible 6 decimals. */
function reconcileNumber(value: number): number {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-6) return rounded;
  return Math.round(value * 1e6) / 1e6;
}

export interface NumericReconcileResult {
  ok: boolean;
  /** The spec with its `answer` overridden by the computed value when ok. */
  spec: PracticeProblemSpec;
}

/**
 * Reconciles a NUMERIC problem: if `answerExpression` evaluates to a finite
 * number, that value is AUTHORITATIVE — we override `answer` with it (rounding
 * an integer-ish result to the integer). This auto-fixes LLM arithmetic slips
 * (e.g. 16 -> 8). If the expression can't be evaluated, the problem is marked
 * unverifiable (`ok: false`).
 */
export function reconcileNumericProblem(
  spec: PracticeProblemSpec
): NumericReconcileResult {
  if (spec.kind !== "numeric") return { ok: false, spec };
  const { ok, value } = evaluateAnswerExpression(spec.answerExpression);
  if (!ok || value === null) return { ok: false, spec };
  return { ok: true, spec: { ...spec, answer: reconcileNumber(value) } };
}

/** Extracts the first numeric value from an option string, or null. */
function parseOptionNumber(text: string): number | null {
  if (typeof text !== "string") return null;
  // Match a signed decimal (with optional fraction) anywhere in the option.
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export interface McReconcileResult {
  /** Whether `correctIndex` was changed by verification. */
  corrected: boolean;
  spec: PracticeProblemSpec;
}

/**
 * Best-effort correction of an MC problem's key: evaluate `answerExpression`,
 * then find which option's text denotes that numeric value (within 1e-6). If
 * EXACTLY one option matches, set `correctIndex` to it. If none/ambiguous match
 * or the expression isn't numeric, the problem is left as generated (we NEVER
 * drop an mc problem here).
 */
export function reconcileMcProblem(
  spec: PracticeProblemSpec
): McReconcileResult {
  if (spec.kind !== "mc") return { corrected: false, spec };
  const { ok, value } = evaluateAnswerExpression(spec.answerExpression);
  if (!ok || value === null) return { corrected: false, spec };

  const matches: number[] = [];
  spec.options.forEach((text, i) => {
    const n = parseOptionNumber(text);
    if (n !== null && Math.abs(n - value) < 1e-6) matches.push(i);
  });

  if (matches.length !== 1) return { corrected: false, spec };
  const idx = matches[0];
  if (idx === spec.correctIndex) return { corrected: false, spec };
  return { corrected: true, spec: { ...spec, correctIndex: idx } };
}
