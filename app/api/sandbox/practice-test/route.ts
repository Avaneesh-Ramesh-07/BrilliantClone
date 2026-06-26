import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { OPENAI_MODEL } from "@/lib/ai/lesson-builder";
import {
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
  reconcileMcProblem,
  reconcileNumericProblem,
} from "@/lib/practice-test/verify";
import { createClient } from "@/lib/supabase/server";
import {
  practiceTestSpecSchema,
  type PracticeProblemSpec,
  type PracticeTestSpec,
} from "@/types/practice-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * Runs the math.js answer-key verification over a spec's problems and returns
 * the reconciled, filtered problem list:
 * - NUMERIC: the `answerExpression` value is AUTHORITATIVE and overrides
 *   `answer` (auto-fixing LLM arithmetic slips). A numeric problem is DROPPED
 *   only when its expression is unevaluable/non-finite.
 * - MC: best-effort `correctIndex` correction; the problem is always KEPT.
 */
function reconcileSpecProblems(
  spec: PracticeTestSpec
): PracticeProblemSpec[] {
  const out: PracticeProblemSpec[] = [];
  for (const problem of spec.problems) {
    if (problem.kind === "numeric") {
      const { ok, spec: reconciled } = reconcileNumericProblem(problem);
      // Drop only when the expression couldn't be evaluated to a finite number.
      if (ok) out.push(reconciled);
    } else {
      const { spec: reconciled } = reconcileMcProblem(problem);
      out.push(reconciled);
    }
  }
  return out;
}

/** Generates a practice-test spec from the eligible concepts (may throw). */
async function generatePracticeTestSpec(
  concepts: EligibleConcept[]
): Promise<PracticeTestSpec> {
  const result = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: practiceTestSpecSchema,
    system: buildPracticeTestSystemPrompt(),
    prompt: buildPracticeTestUserPrompt(concepts),
    temperature: 0.7,
    maxOutputTokens: 16000,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(90000),
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

  let spec: PracticeTestSpec;
  try {
    spec = await generatePracticeTestSpec(concepts);
  } catch (err) {
    console.error("[sandbox/practice-test] generateObject failed:", err);
    const e = (err ?? {}) as {
      statusCode?: number;
      name?: string;
      message?: string;
    };
    const status = e.statusCode;
    const detail = [e.name, e.message].filter(Boolean).join(": ").slice(0, 300);
    const error =
      status === 429
        ? "The AI is over its current quota — try again shortly."
        : `Couldn't build that practice test — try again. (${detail || "generation error"})`;
    return NextResponse.json({ error }, { status: 502 });
  }

  // math.js answer-key verification: the computed value of each numeric problem
  // overrides the LLM's `answer`, and mc keys are best-effort corrected.
  // Unverifiable numeric problems are dropped here.
  let problems = reconcileSpecProblems(spec);

  // If verification left too few problems, make ONE more generation attempt and
  // re-verify; keep whichever attempt yields more valid problems. A failed
  // retry simply leaves us with the first attempt's reconciled problems.
  if (problems.length < 3) {
    try {
      const retrySpec = await generatePracticeTestSpec(concepts);
      const retryProblems = reconcileSpecProblems(retrySpec);
      if (retryProblems.length > problems.length) {
        spec = retrySpec;
        problems = retryProblems;
      }
    } catch (err) {
      console.error("[sandbox/practice-test] retry generateObject failed:", err);
    }
  }

  // Proceed with whatever valid problems remain (need >= 1). Zero valid → 500.
  if (problems.length === 0) {
    console.error("[sandbox/practice-test] no verifiable problems remain");
    return NextResponse.json(
      { error: "Couldn't build a complete test — please try again." },
      { status: 500 }
    );
  }

  const reconciledSpec: PracticeTestSpec = { ...spec, problems };

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
      { error: "Couldn't build a complete test — please try again." },
      { status: 500 }
    );
  }

  const baseRow = {
    id: lessonId,
    user_id: user.id,
    topic,
    difficulty: "advanced",
    specific_concept: "Practice Test",
    lesson_json: lesson,
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
      { error: "Couldn't save your practice test — please try again." },
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
