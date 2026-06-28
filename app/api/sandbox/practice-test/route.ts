import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  PRACTICE_TEST_MODEL,
  buildPracticeTestFromSpec,
  buildPracticeTestSystemPrompt,
  buildPracticeTestUserPrompt,
  validatePracticeTest,
} from "@/lib/ai/practice-test";
import {
  getEligibleConcepts,
  type EligibleConcept,
} from "@/lib/practice-test/eligibility";
import {
  verifyPracticeProblem,
  type ProblemVerification,
} from "@/lib/practice-test/verify";
import { createClient } from "@/lib/supabase/server";
import {
  practiceTestSpecSchema,
  type PracticeTestLesson,
  type PracticeTestSpec,
  type VerifiedPracticeProblem,
} from "@/types/practice-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimum number of valid (kept, non-dropped) problems a test must reach. */
const TARGET_VALID = 15;
/** Hard cap on generation attempts while accumulating toward TARGET_VALID. */
const MAX_ATTEMPTS = 4;

/**
 * Normalizes a problem stem for cross-attempt dedupe: trim, lowercase, and
 * collapse internal whitespace so reworded-identical prompts can't pad the count.
 */
function normalizeStem(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * A NEAR-DUPLICATE signature for MULTIPLE-CHOICE problems beyond the stem: two
 * mc problems collide when they share the SAME correct answer AND the SAME set
 * of option texts, regardless of wording or option order. This catches reworded
 * twins the stem check misses (e.g. the same equation re-skinned with a new
 * scenario but the same choices). Returns null for numeric problems (which have
 * no option set; deduping them by answer alone would wrongly drop distinct
 * problems that merely share a common answer like 5), so those rely on the stem
 * check only.
 */
function nearDuplicateSignature(v: ProblemVerification): string | null {
  const problem = v.problem;
  if (!problem || problem.kind !== "mc") return null;
  const options = [...problem.options]
    .map((o) => normalizeStem(o))
    .sort()
    .join("|");
  const answer = normalizeStem(problem.options[problem.correctIndex] ?? "");
  return `mc|${answer}|${options}`;
}

/** A representative ALLOWED_TOPICS id whose family matches, for the `topic` column. */
const FAMILY_TOPIC_ID: Record<string, string> = {
  equations: "linear-equations",
  graphing: "graphing-lines",
  quadratics: "quadratics",
};

/** Returns the most common topic family among the eligible concepts. */
function dominantFamily(concepts: EligibleConcept[]): string {
  const counts: Record<string, number> = {};
  for (const c of concepts) {
    counts[c.topicFamily] = (counts[c.topicFamily] ?? 0) + 1;
  }
  let best = "equations";
  let bestCount = -1;
  for (const [family, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = family;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Runs deterministic verification over a spec's problems and returns only the
 * ones to KEEP (each carrying its reconciled spec + verification metadata):
 * - DROPPED: problems that fail the self-consistency check (e.g. asking for a
 *   symbol absent from the equation - the gardener bug) and numeric problems
 *   whose `answerExpression` can't be evaluated (ungradeable).
 * - KEPT: everything else. NUMERIC keys are overridden by the computed value;
 *   MC keys are best-effort corrected and tagged "verified" when confirmed or
 *   "unverifiable" when the key couldn't be machine-confirmed.
 */
function verifyAndKeep(spec: PracticeTestSpec): ProblemVerification[] {
  return spec.problems.map(verifyPracticeProblem).filter((v) => !v.drop);
}

/** Generates a practice-test spec from the eligible concepts (may throw). */
async function generatePracticeTestSpec(
  concepts: EligibleConcept[]
): Promise<PracticeTestSpec> {
  const result = await generateObject({
    model: openai(PRACTICE_TEST_MODEL),
    schema: practiceTestSpecSchema,
    system: buildPracticeTestSystemPrompt(),
    prompt: buildPracticeTestUserPrompt(concepts),
    // gpt-5.5 is a reasoning model: it rejects a custom `temperature` (only the
    // default is allowed) and spends reasoning tokens, so we omit `temperature`
    // entirely and budget a generous output cap that fits ~20 heavy problems
    // plus the reasoning tokens (well within the model's 128K output limit).
    maxOutputTokens: 48000,
    maxRetries: 2,
    // Reasoning models are slower; give each attempt up to 180s.
    abortSignal: AbortSignal.timeout(180000),
  });
  return result.object;
}

/** GET: returns the eligible concepts for the builder preview (auth required). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const concepts = await getEligibleConcepts(supabase, user.id);
  return NextResponse.json({ concepts });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Practice tests are unavailable right now." },
      { status: 503 }
    );
  }

  // Always compute eligibility SERVER-SIDE; never trust a client-supplied list.
  const concepts = await getEligibleConcepts(supabase, user.id);
  if (concepts.length === 0) {
    return NextResponse.json({ empty: true });
  }

  // Accumulate verified problems across up to MAX_ATTEMPTS generations until we
  // reach at least TARGET_VALID (15) valid, deduped problems. Each attempt
  // generates a fresh spec, runs deterministic verification (self-consistency +
  // math.js key reconciliation; inconsistent / ungradeable problems are
  // dropped), and ADDS its survivors to the running collection. A single failed
  // attempt is caught and skipped so it can never crash the whole handler.
  const kept: ProblemVerification[] = [];
  const seenStems = new Set<string>();
  // Near-duplicate signatures (answer + option set). Shared across attempts AND
  // within a single attempt, so repeats are dropped wherever they appear.
  const seenSignatures = new Set<string>();
  let baseSpec: PracticeTestSpec | null = null;
  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS && kept.length < TARGET_VALID;
    attempt++
  ) {
    let attemptSpec: PracticeTestSpec;
    try {
      attemptSpec = await generatePracticeTestSpec(concepts);
    } catch (err) {
      console.error(
        `[sandbox/practice-test] generateObject failed (attempt ${attempt + 1}/${MAX_ATTEMPTS}):`,
        err
      );
      lastError = err;
      continue;
    }
    // Keep the first successful spec for its title/description metadata.
    if (!baseSpec) baseSpec = attemptSpec;
    // Dedupe by normalized stem AND by near-duplicate signature (answer + option
    // set), both WITHIN this attempt and ACROSS attempts (the `seen*` sets are
    // shared), keeping the first occurrence of each.
    for (const v of verifyAndKeep(attemptSpec)) {
      const stem = normalizeStem(v.spec.prompt);
      if (seenStems.has(stem)) continue;
      const signature = nearDuplicateSignature(v);
      if (signature !== null && seenSignatures.has(signature)) continue;
      seenStems.add(stem);
      if (signature !== null) seenSignatures.add(signature);
      kept.push(v);
    }
  }

  // If EVERY attempt failed to even produce a spec, surface a graceful error
  // (quota-aware), mirroring the prior single-attempt failure path.
  if (!baseSpec) {
    const e = (lastError ?? {}) as {
      statusCode?: number;
      name?: string;
      message?: string;
    };
    const detail = [e.name, e.message].filter(Boolean).join(": ").slice(0, 300);
    const error =
      e.statusCode === 429
        ? "The AI is over its current quota. Try again shortly."
        : `Couldn't build that practice test. Try again. (${detail || "generation error"})`;
    return NextResponse.json({ error }, { status: 502 });
  }

  const spec = baseSpec;

  // Proceed with whatever valid problems remain (need >= 1). After MAX_ATTEMPTS
  // there may still be < TARGET_VALID, which is acceptable; only zero valid → 500.
  if (kept.length === 0) {
    console.error("[sandbox/practice-test] no verifiable problems remain");
    return NextResponse.json(
      { error: "Couldn't build a complete test. Please try again." },
      { status: 500 }
    );
  }

  // ENFORCE INCREASING CHALLENGE: order the kept problems by ascending verified
  // difficulty (clamped 1-10) so the test gets progressively harder. A stable
  // sort preserves generation order for equal ratings. The spec rebuilt below
  // reads from this same `kept` array, so the stored lesson + the runner bank
  // stay aligned in this sorted order.
  kept.sort((a, b) => (a.problem?.difficulty ?? 5) - (b.problem?.difficulty ?? 5));

  // Assign stable ids the runner uses for attempt tracking, and gather the
  // runner-ready verified problem bank.
  const practiceProblems: VerifiedPracticeProblem[] = [];
  kept.forEach((v, i) => {
    if (!v.problem) return;
    v.problem.id = `pt-${i + 1}`;
    practiceProblems.push(v.problem);
  });

  const reconciledSpec: PracticeTestSpec = {
    ...spec,
    problems: kept.map((v) => v.spec),
  };

  const family = dominantFamily(concepts);
  const topic = FAMILY_TOPIC_ID[family] ?? "linear-equations";
  const lessonId = randomUUID();

  const lesson = buildPracticeTestFromSpec(reconciledSpec, {
    id: lessonId,
    topicFamily: family,
  });

  const invalid = validatePracticeTest(lesson);
  if (invalid) {
    console.error("[sandbox/practice-test] invalid test:", invalid);
    return NextResponse.json(
      { error: "Couldn't build a complete test. Please try again." },
      { status: 500 }
    );
  }

  // Ride the verified problem bank along in the stored lesson_json so the
  // dedicated runner can show worked steps, "Verified" badges, and gating.
  const practiceLesson: PracticeTestLesson = { ...lesson, practiceProblems };

  const baseRow = {
    id: lessonId,
    user_id: user.id,
    topic,
    difficulty: "advanced",
    specific_concept: "Practice Test",
    lesson_json: practiceLesson,
  };

  // Insert WITH `kind`. If the column doesn't exist yet (pre-migration), retry
  // without it so the feature still works via the `specific_concept` fallback.
  let { error: insertError } = await supabase
    .from("ai_lessons")
    .insert({ ...baseRow, kind: "practice_test" });

  if (insertError && mentionsKindColumn(insertError)) {
    ({ error: insertError } = await supabase
      .from("ai_lessons")
      .insert(baseRow));
  }

  if (insertError) {
    console.error("[sandbox/practice-test] insert failed:", insertError);
    return NextResponse.json(
      { error: "Couldn't save your practice test. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ lessonId });
}

/** Whether an insert error is the "kind" column being unknown (pre-migration). */
function mentionsKindColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  const msg = (error.message ?? "").toLowerCase();
  // PGRST204: column not found in schema cache; 42703: undefined column.
  return (
    msg.includes("kind") ||
    error.code === "PGRST204" ||
    error.code === "42703"
  );
}
