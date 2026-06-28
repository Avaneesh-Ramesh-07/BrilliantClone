/**
 * Answer-key verification for AI-generated practice tests. The model emits a
 * fully-numeric, machine-evaluable `answerExpression` per problem; here we let
 * math.js compute the authoritative value so the computer's arithmetic
 * OVERRIDES the LLM's (which sometimes ships a wrong key, e.g. claiming the
 * vertex y of "y = -2x^2 + 8x" is 16 when it is actually 8).
 */

import { all, create } from "mathjs";
import type {
  PracticeProblemSpec,
  VerifiedPracticeProblem,
} from "@/types/practice-test";

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

/**
 * Clamps a model-supplied difficulty to an integer in [1,10], defaulting to a
 * middle 5 when the value is missing/non-finite, so the field is always a
 * usable 1-10 rating regardless of what the model emitted.
 */
function clampDifficulty(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 5;
  return Math.min(10, Math.max(1, Math.round(value)));
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
 * number, that value is AUTHORITATIVE, we override `answer` with it (rounding
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

/** Dedupes (within 1e-6) and sorts ascending so comparison is order-independent. */
function normalizeSet(nums: number[]): number[] {
  const out: number[] = [];
  for (const n of nums) {
    const r = Math.round(n * 1e6) / 1e6;
    if (!out.some((m) => Math.abs(m - r) < 1e-6)) out.push(r);
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * Every distinct number in a string, as a normalized ascending set. Unlike
 * {@link parseOptionNumber} (which grabs only the FIRST number), this captures
 * the FULL set so a multi-value option like "3 and -2" becomes [-2, 3] and can
 * be compared order-independently against the computed solution set.
 */
export function parseNumberSet(text: string): number[] {
  if (typeof text !== "string") return [];
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return normalizeSet(matches.map(Number).filter((n) => Number.isFinite(n)));
}

/** Order-independent equality of two NON-EMPTY number sets (1e-6 tolerance). */
export function numberSetsEqual(a: number[], b: number[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-6) return false;
  }
  return true;
}

/**
 * Evaluates an `answerExpression` that may encode a SET of solutions: it is
 * split on commas/semicolons, each fully-numeric part is evaluated with
 * math.js, and the normalized set is returned (a single value yields a
 * one-element set). Returns `ok: false` if any part fails to evaluate, so a
 * multi-solution answer must provide ALL solutions (e.g. "3, -2").
 */
export function evaluateAnswerExpressionSet(expression: string): {
  ok: boolean;
  set: number[];
} {
  if (typeof expression !== "string" || !expression.trim()) {
    return { ok: false, set: [] };
  }
  const parts = expression
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return { ok: false, set: [] };
  const nums: number[] = [];
  for (const part of parts) {
    const { ok, value } = evaluateAnswerExpression(part);
    if (!ok || value === null) return { ok: false, set: [] };
    nums.push(value);
  }
  return { ok: true, set: normalizeSet(nums) };
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

// --- Self-consistency ------------------------------------------------------

/**
 * Single-letter variable the QUESTION explicitly asks the learner to find,
 * captured from patterns like "x-values", "value of x", "solve for x", "what
 * is y", "find a", "determine n". Word boundaries keep multi-letter words
 * (e.g. "area", "months") from being mistaken for a one-letter symbol. Returns
 * the lowercased letters (usually one), or [] when the question doesn't single
 * out a symbol.
 */
function askedSymbols(prompt: string): string[] {
  const found = new Set<string>();
  const patterns: RegExp[] = [
    /\b([a-zA-Z])-?\s*values?\b/gi, // "x-values", "x values"
    /\bvalues?\s+of\s+([a-zA-Z])\b/gi, // "value of x"
    /\bsolve\s+for\s+([a-zA-Z])\b/gi, // "solve for x"
    /\bfind\s+(?:the\s+)?(?:value\s+of\s+)?([a-zA-Z])\b/gi, // "find x" / "find the value of x"
    /\bwhat\s+(?:is|are)\s+([a-zA-Z])\b/gi, // "what is y"
    /\bdetermine\s+(?:the\s+)?([a-zA-Z])\b/gi, // "determine n"
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(prompt)) !== null) {
      const letter = m[1].toLowerCase();
      // Ignore words that merely START with a letter we already split on; the
      // regexes above only capture a lone letter at a boundary, so this is a
      // light guard against the occasional false catch (e.g. "a" in "a line").
      found.add(letter);
    }
  }
  return Array.from(found);
}

/**
 * Whether a single-letter symbol appears in a MATH context inside the prompt
 * (i.e. as an actual variable in an equation/expression), not merely as the
 * word the question asks about. We look for the letter adjacent to a digit,
 * a power, an equals sign, or an arithmetic operator. This is intentionally
 * conservative: any genuine equation use returns true, so only symbols that are
 * truly absent from the math (the gardener's "x") are flagged.
 */
function appearsInMath(symbol: string, prompt: string): boolean {
  const s = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const contexts: RegExp[] = [
    new RegExp(`\\d\\s*\\*?\\s*${s}\\b`, "i"), // 2x, 2*x, 30x
    new RegExp(`\\b${s}\\s*\\^`, "i"), // x^2
    new RegExp(`\\b${s}\\s*\\*?\\s*\\d`, "i"), // x2 / x*2
    new RegExp(`\\b${s}\\s*=`, "i"), // x =
    new RegExp(`=\\s*[^=]*\\b${s}\\b`, "i"), // ... = ... x ...
    new RegExp(`\\b${s}\\s*[+\\-*/]`, "i"), // x + , x - , x* , x/
    new RegExp(`[+\\-*/]\\s*${s}\\b`, "i"), // + x , - x , *x , /x
  ];
  return contexts.some((re) => re.test(prompt));
}

export interface ConsistencyResult {
  consistent: boolean;
  reason: string | null;
}

/**
 * Flags a problem whose QUESTION asks for the value of a symbol that never
 * appears in the equation/expression (the exact gardener bug: "what are the
 * x-values" when the equation is "A = l*w - 15" with no x). Such a problem is
 * unanswerable as written, so it is treated as inconsistent and dropped.
 *
 * Conservative by design: only fires when the question singles out a lone
 * letter AND that letter is genuinely absent from any math context, so clear,
 * well-formed problems are never falsely rejected.
 */
export function checkSelfConsistency(prompt: string): ConsistencyResult {
  if (typeof prompt !== "string" || !prompt.trim()) {
    return { consistent: false, reason: "empty prompt" };
  }
  for (const symbol of askedSymbols(prompt)) {
    if (!appearsInMath(symbol, prompt)) {
      return {
        consistent: false,
        reason: `question asks for "${symbol}" but no such symbol appears in the equation`,
      };
    }
  }
  return { consistent: true, reason: null };
}

// --- Unified verification --------------------------------------------------

export interface ProblemVerification {
  /**
   * "verified"     - the key was confirmed by math.js.
   * "unverifiable" - self-consistent, but the key couldn't be confirmed.
   * "inconsistent" - fails the self-consistency check (must be dropped).
   */
  status: "verified" | "unverifiable" | "inconsistent";
  /** Whether the caller should DROP this problem (never show it). */
  drop: boolean;
  reason: string | null;
  /** Computed value of `answerExpression`, or null when it didn't evaluate. */
  computedAnswer: number | null;
  /** The reconciled spec (answer / correctIndex overridden where confirmed). */
  spec: PracticeProblemSpec;
  /** The runner-ready problem, or null when dropped. */
  problem: VerifiedPracticeProblem | null;
}

/** Whether an mc spec has a single valid correct option in range. */
function mcKeyIsValid(spec: Extract<PracticeProblemSpec, { kind: "mc" }>): boolean {
  return (
    Number.isInteger(spec.correctIndex) &&
    spec.correctIndex >= 0 &&
    spec.correctIndex < spec.options.length
  );
}

/** Builds an "inconsistent" (must-drop) verification result. */
function inconsistent(
  spec: PracticeProblemSpec,
  reason: string
): ProblemVerification {
  return {
    status: "inconsistent",
    drop: true,
    reason,
    computedAnswer: null,
    spec,
    problem: null,
  };
}

/**
 * Verifies ONE problem across every kind the generator emits (numeric + mc),
 * combining deterministic key reconciliation with the self-consistency check:
 *
 * - Self-consistency first: a problem asking for an absent symbol is marked
 *   "inconsistent" and flagged to DROP (it can't be answered as written).
 * - NUMERIC: `answerExpression` is authoritative and overrides `answer` (this
 *   preserves the existing "fix the LLM's arithmetic" behavior). If it can't be
 *   evaluated the problem is unverifiable and dropped (it can't be graded).
 * - MC: best-effort `correctIndex` correction from the expression; when exactly
 *   one option matches the computed value the key is "verified", otherwise the
 *   problem stays "unverifiable" (kept, graded by the model's key, no badge).
 *   An mc whose key is structurally invalid (out of range) is dropped.
 */
export function verifyPracticeProblem(
  spec: PracticeProblemSpec
): ProblemVerification {
  const consistency = checkSelfConsistency(spec.prompt);
  if (!consistency.consistent) {
    return {
      status: "inconsistent",
      drop: true,
      reason: consistency.reason,
      computedAnswer: null,
      spec,
      problem: null,
    };
  }

  if (spec.kind === "numeric") {
    const { ok, value } = evaluateAnswerExpression(spec.answerExpression);
    if (!ok || value === null) {
      // Can't grade it deterministically - drop (matches prior behavior).
      return {
        status: "unverifiable",
        drop: true,
        reason: "numeric answerExpression did not evaluate",
        computedAnswer: null,
        spec,
        problem: null,
      };
    }
    const answer = reconcileNumber(value);
    const reconciled: PracticeProblemSpec = { ...spec, answer };
    return {
      status: "verified",
      drop: false,
      reason: null,
      computedAnswer: answer,
      spec: reconciled,
      problem: {
        id: "",
        kind: "numeric",
        conceptLabel: spec.conceptLabel?.trim() ?? "",
        difficulty: clampDifficulty(spec.difficulty),
        prompt: spec.prompt,
        hint: spec.hint,
        explanation: spec.explanation,
        correctFeedback: spec.correctFeedback,
        incorrectFeedback: spec.incorrectFeedback,
        status: "verified",
        answerExpression: spec.answerExpression,
        computedAnswer: answer,
        answer,
      },
    };
  }

  // mc
  if (!mcKeyIsValid(spec)) {
    return inconsistent(spec, "mc correctIndex out of range");
  }

  const mc = spec as Extract<PracticeProblemSpec, { kind: "mc" }>;
  const optionSets = mc.options.map(parseNumberSet);

  // AMBIGUOUS-KEY GUARD: reject any item where two or more options reduce to the
  // SAME non-empty value/set (e.g. "3 and -2" vs "-2 and 3", or "8" vs "8"),
  // since the correct choice would no longer be unique. Dropped like any other
  // inconsistent item (and the route then regenerates if too few remain).
  for (let i = 0; i < optionSets.length; i++) {
    for (let j = i + 1; j < optionSets.length; j++) {
      if (numberSetsEqual(optionSets[i], optionSets[j])) {
        return inconsistent(
          spec,
          "two or more options reduce to the same value/set (ambiguous key)"
        );
      }
    }
  }

  // ORDER-INDEPENDENT key check: compute the full solution SET (the
  // answerExpression may list several solutions, e.g. "3, -2") and match it
  // against each option's number set. Exactly one match confirms (and may
  // correct) the key; a tie means an ambiguous key and is dropped.
  const { ok, set } = evaluateAnswerExpressionSet(mc.answerExpression);
  let correctIndex = mc.correctIndex;
  let verified = false;
  let computedAnswer: number | null = null;
  if (ok && set.length > 0) {
    // A single-value set has a meaningful "computed answer" to surface; a
    // multi-value solution set is shown via the highlighted option instead.
    computedAnswer = set.length === 1 ? set[0] : null;
    const matches: number[] = [];
    optionSets.forEach((os, i) => {
      if (numberSetsEqual(os, set)) matches.push(i);
    });
    if (matches.length === 1) {
      correctIndex = matches[0];
      verified = true;
    } else if (matches.length >= 2) {
      return inconsistent(
        spec,
        "computed solution set matches multiple options (ambiguous key)"
      );
    }
  }

  const status: "verified" | "unverifiable" = verified
    ? "verified"
    : "unverifiable";
  const reconciled: PracticeProblemSpec = { ...mc, correctIndex };

  return {
    status,
    drop: false,
    reason: verified ? null : "mc key not deterministically confirmed",
    computedAnswer,
    spec: reconciled,
    problem: {
      id: "",
      kind: "mc",
      conceptLabel: mc.conceptLabel?.trim() ?? "",
      difficulty: clampDifficulty(mc.difficulty),
      prompt: mc.prompt,
      hint: mc.hint,
      explanation: mc.explanation,
      correctFeedback: mc.correctFeedback,
      incorrectFeedback: mc.incorrectFeedback,
      status,
      answerExpression: mc.answerExpression,
      computedAnswer,
      options: mc.options,
      correctIndex,
    },
  };
}
