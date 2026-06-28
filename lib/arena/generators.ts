/**
 * Procedural generators for the head-to-head Arena.
 *
 * The Arena match UI (components/arena/ArenaMatch.tsx) accepts ONLY a typed
 * numeric answer (`parseNumeric` + `parsed === problem.answer`), so EVERY
 * problem here is an `ArenaProblem = { id; prompt; answer: number }` with a
 * single numeric answer.
 *
 * Like endless practice (lib/practice/generators.ts), every problem is built
 * correct-by-construction: we choose the answer-defining integers first, then
 * derive the displayed coefficients/constants from them. We never solve an
 * equation at runtime. Each player builds their OWN pool client-side, so plain
 * Math.random is fine, no cross-client determinism is required.
 *
 * Difficulty is intentionally HARD across the board (multi-step, variables on
 * both sides, big coefficients), and escalates further across tiers.
 */

import type { ArenaProblem, ArenaTopic, ProblemPool } from "@/types/arena";

const SUP2 = "²";
const MINUS = "−";

// ---------------------------------------------------------------------------
// Random helpers
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

let idCounter = 0;
function uid(topic: ArenaTopic): string {
  idCounter += 1;
  return `arena-${topic}-${idCounter}-${Math.floor(Math.random() * 1e6)}`;
}

// ---------------------------------------------------------------------------
// Formatting helpers (display only, parseNumeric maps the unicode minus back)
// ---------------------------------------------------------------------------

/** " + 3" or " − 3": a signed constant term to append after another term. */
function signedTerm(n: number): string {
  return n >= 0 ? `+ ${n}` : `${MINUS} ${Math.abs(n)}`;
}

/** A standalone coefficient*x term, e.g. "6x", "x", "−4x". */
function coefX(m: number): string {
  if (m === 1) return "x";
  if (m === -1) return `${MINUS}x`;
  if (m < 0) return `${MINUS}${Math.abs(m)}x`;
  return `${m}x`;
}

/** "y = mx + b" style line, omitting a zero intercept. */
function lineEq(m: number, b: number): string {
  return b === 0 ? coefX(m) : `${coefX(m)} ${signedTerm(b)}`;
}

/** "x² + bx + c" with proper signs; zero terms are omitted. */
function quadEq(b: number, c: number): string {
  let s = `x${SUP2}`;
  if (b !== 0) s += ` ${signedTerm(b)}x`;
  if (c !== 0) s += ` ${signedTerm(c)}`;
  return s;
}

// ---------------------------------------------------------------------------
// Difficulty bands (all hard; escalate across tiers)
// ---------------------------------------------------------------------------

interface Band {
  coeffMax: number;
  constMax: number;
  rootMax: number;
}

const BANDS: Band[] = [
  { coeffMax: 7, constMax: 18, rootMax: 7 },
  { coeffMax: 9, constMax: 26, rootMax: 9 },
  { coeffMax: 11, constMax: 34, rootMax: 10 },
  { coeffMax: 13, constMax: 44, rootMax: 11 },
  { coeffMax: 15, constMax: 55, rootMax: 12 },
];

// ===========================================================================
// EQUATIONS, multi-step linear with variables on BOTH sides
// ===========================================================================

function genEquation(band: Band): Omit<ArenaProblem, "topic"> {
  const x = randNonZero(-(band.rootMax + 3), band.rootMax + 6);
  const a = rand(2, band.coeffMax);
  let b = rand(1, band.coeffMax);
  while (b === a) b = rand(1, band.coeffMax); // a != b => unique solution

  const parenthesized = Math.random() < 0.5;
  let prompt: string;

  if (parenthesized) {
    // a(x + p) = b·x + c2  ⇒ left = a·x + a·p, so c1 = a·p.
    const p = randNonZero(-9, 9);
    const c1 = a * p;
    const c2 = (a - b) * x + c1;
    prompt = `Solve for x:  ${a}(x ${signedTerm(p)}) = ${coefX(b)} ${signedTerm(c2)}`;
  } else {
    // a·x + c1 = b·x + c2  ⇒ c2 = (a − b)·x + c1.
    const c1 = randNonZero(-band.constMax, band.constMax);
    const c2 = (a - b) * x + c1;
    prompt = `Solve for x:  ${coefX(a)} ${signedTerm(c1)} = ${coefX(b)} ${signedTerm(c2)}`;
  }

  return { id: uid("equations"), prompt, answer: x };
}

// ===========================================================================
// GRAPHING / LINEAR, single numeric answer
// ===========================================================================

function genGraphing(band: Band): Omit<ArenaProblem, "topic"> {
  const variant = pick(["evalY", "xIntercept", "solveX", "yIntercept"] as const);
  const m = randNonZero(2, band.coeffMax);

  if (variant === "evalY") {
    const b = randNonZero(-band.constMax, band.constMax);
    const k = randNonZero(-9, 12);
    return {
      id: uid("graphing"),
      prompt: `For y = ${lineEq(m, b)}, what is y when x = ${k}?`,
      answer: m * k + b,
    };
  }

  if (variant === "xIntercept") {
    // x-intercept r is an integer by construction: b = −m·r.
    const r = randNonZero(-12, 12);
    const b = -m * r;
    return {
      id: uid("graphing"),
      prompt: `What is the x-intercept of y = ${lineEq(m, b)}? (enter the x-value)`,
      answer: r,
    };
  }

  if (variant === "solveX") {
    const b = randNonZero(-band.constMax, band.constMax);
    const x0 = randNonZero(-10, 11);
    const v = m * x0 + b;
    return {
      id: uid("graphing"),
      prompt: `For y = ${lineEq(m, b)}, what value of x gives y = ${v}?`,
      answer: x0,
    };
  }

  // yIntercept
  const b = randNonZero(-band.constMax, band.constMax);
  return {
    id: uid("graphing"),
    prompt: `What is the y-intercept of y = ${lineEq(m, b)}? (enter the y-value)`,
    answer: b,
  };
}

// ===========================================================================
// QUADRATICS, factorable with integer roots
// ===========================================================================

function genQuadratic(band: Band): Omit<ArenaProblem, "topic"> {
  const variant = pick([
    "largerRoot",
    "smallerRoot",
    "sumRoots",
    "productRoots",
    "discriminant",
  ] as const);

  const r1 = randNonZero(-band.rootMax, band.rootMax);
  let r2 = randNonZero(-band.rootMax, band.rootMax);
  // Distinct roots so "larger"/"smaller" are unambiguous.
  if (variant === "largerRoot" || variant === "smallerRoot") {
    while (r2 === r1) r2 = randNonZero(-band.rootMax, band.rootMax);
  }

  // x² + bx + c with roots r1, r2: b = −(r1 + r2), c = r1·r2.
  const b = -(r1 + r2);
  const c = r1 * r2;
  const eq = quadEq(b, c);

  switch (variant) {
    case "largerRoot":
      return {
        id: uid("quadratics"),
        prompt: `${eq} = 0. Enter the LARGER root.`,
        answer: Math.max(r1, r2),
      };
    case "smallerRoot":
      return {
        id: uid("quadratics"),
        prompt: `${eq} = 0. Enter the SMALLER root.`,
        answer: Math.min(r1, r2),
      };
    case "sumRoots":
      return {
        id: uid("quadratics"),
        prompt: `What is the sum of the roots of ${eq}?`,
        answer: r1 + r2,
      };
    case "productRoots":
      return {
        id: uid("quadratics"),
        prompt: `What is the product of the roots of ${eq}?`,
        answer: r1 * r2,
      };
    default:
      // discriminant b² − 4c (= (r1 − r2)²)
      return {
        id: uid("quadratics"),
        prompt: `Evaluate the discriminant of ${eq}.`,
        answer: b * b - 4 * c,
      };
  }
}

// ===========================================================================
// Dispatch + public API
// ===========================================================================

const GENERATORS: Record<
  ArenaTopic,
  (band: Band) => Omit<ArenaProblem, "topic">
> = {
  equations: genEquation,
  graphing: genGraphing,
  quadratics: genQuadratic,
};

/**
 * Builds a problem for `topic` and stamps the topic onto it so every generated
 * problem carries the topic it tests (consumed by the per-answer arena stats).
 */
function generateFor(topic: ArenaTopic, band: Band): ArenaProblem {
  return { ...GENERATORS[topic](band), topic };
}

/** Normalize the requested topics: dedupe and keep only valid topics. */
function normalizeTopics(topics: readonly ArenaTopic[]): ArenaTopic[] {
  const seen = new Set<ArenaTopic>();
  const out: ArenaTopic[] = [];
  for (const t of topics) {
    if (GENERATORS[t] && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export interface BuildPoolOptions {
  /** Number of escalating difficulty tiers (default = number of bands). */
  tiers?: number;
  /** Problems per tier (default 10). */
  perTier?: number;
}

/**
 * Build a tiered ProblemPool for the given topics. Each tier draws from a
 * harder band than the last (escalating coefficients/roots), and within a tier
 * topics are round-robined so a mixed pool stays varied. Defaults to ~50
 * problems (5 tiers × 10) so a long match never exhausts the pool.
 */
export function buildPoolForTopics(
  topics: readonly ArenaTopic[],
  opts: BuildPoolOptions = {}
): ProblemPool {
  const list = normalizeTopics(topics);
  const safeTopics: ArenaTopic[] =
    list.length > 0 ? list : ["equations", "graphing", "quadratics"];

  const tierCount = Math.max(1, opts.tiers ?? BANDS.length);
  const perTier = Math.max(1, opts.perTier ?? 10);

  const tiers: ArenaProblem[][] = [];
  for (let t = 0; t < tierCount; t++) {
    const band = BANDS[Math.min(t, BANDS.length - 1)];
    const tier: ArenaProblem[] = [];
    for (let j = 0; j < perTier; j++) {
      const topic = safeTopics[j % safeTopics.length];
      tier.push(generateFor(topic, band));
    }
    tiers.push(tier);
  }
  return { tiers };
}

/**
 * Flat list of `count` hard problems across the given topics (round-robined),
 * with difficulty escalating roughly evenly across the run.
 */
export function generateArenaProblems(
  topics: readonly ArenaTopic[],
  count: number
): ArenaProblem[] {
  const list = normalizeTopics(topics);
  const safeTopics: ArenaTopic[] =
    list.length > 0 ? list : ["equations", "graphing", "quadratics"];

  const n = Math.max(0, Math.floor(count));
  const perBand = Math.max(1, Math.ceil(n / BANDS.length));
  const out: ArenaProblem[] = [];
  for (let i = 0; i < n; i++) {
    const topic = safeTopics[i % safeTopics.length];
    const band = BANDS[Math.min(Math.floor(i / perBand), BANDS.length - 1)];
    out.push(generateFor(topic, band));
  }
  return out;
}
