import type { SupabaseClient } from "@supabase/supabase-js";
import { topicFamily, type TopicFamily } from "@/lib/ai/lesson-builder";
import { getAllLessons } from "@/lib/lessons";
import { getAllStepAttempts } from "@/lib/progress";
import { LESSON_TOPIC } from "@/types/practice";
import type { Lesson } from "@/types/lesson";

/**
 * A concept the learner last reviewed on an EARLIER calendar day (never today),
 * eligible to appear on a freshly generated practice test.
 */
export interface EligibleConcept {
  lessonId: string;
  stepId: string;
  conceptLabel: string;
  lessonTitle: string;
  topicFamily: TopicFamily;
  /** Whole calendar days since the last review (>= 1; 1 = yesterday). */
  lastReviewedDaysAgo: number;
}

/**
 * Calendar-day distance between `iso` and today's local date: 0 = today,
 * 1 = yesterday, etc. Replicates the exact logic of `daysSince` in
 * lib/comfort.ts (which is not exported), so "reviewed on an earlier day"
 * means strictly before today's local date.
 */
function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThen = new Date(iso);
  startOfThen.setHours(0, 0, 0, 0);
  return Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / 86400000
  );
}

const MAX_CONCEPTS = 12;

/**
 * Returns up to 12 concepts whose MOST RECENT review fell on a previous calendar
 * day (any concept touched today is excluded). Eligibility is per-CONCEPT, not
 * per-lesson: a concept left untouched today stays eligible even when other
 * concepts in the same lesson were practiced today, because "today" is resolved
 * from per-step `step_attempts.attempted_at` timestamps (one row per concept).
 * Resilient: never throws on missing rows; unresolved steps are simply skipped.
 * Returns [] on no eligible work.
 */
export async function getEligibleConcepts(
  supabase: SupabaseClient,
  userId: string
): Promise<EligibleConcept[]> {
  const attempts = await getAllStepAttempts(supabase, userId);

  // Latest attempted_at per (lesson_id, step_id). Rows arrive most-recent-first,
  // so the first one seen per key already wins, but compare defensively.
  const latestByKey: Record<string, { lessonId: string; stepId: string; at: string }> =
    {};
  for (const row of attempts) {
    if (!row.lesson_id || !row.step_id || !row.attempted_at) continue;
    const key = `${row.lesson_id}::${row.step_id}`;
    const existing = latestByKey[key];
    if (!existing || row.attempted_at > existing.at) {
      latestByKey[key] = {
        lessonId: row.lesson_id,
        stepId: row.step_id,
        at: row.attempted_at,
      };
    }
  }

  // Resolve EVERY latest-per-step entry to its concept, INCLUDING steps last
  // touched today. We keep today's steps here (rather than filtering them out
  // up front) so that a concept practiced today via ANY of its steps can be
  // recognized below and excluded even when an older step happens to share its
  // label. The per-concept "touched today?" decision is made after the dedupe.
  const allLatest = Object.values(latestByKey);
  if (allLatest.length === 0) return [];

  // Built-in lessons keyed by id for fast lookup.
  const builtInLessons: Record<string, Lesson> = {};
  for (const lesson of getAllLessons()) {
    builtInLessons[lesson.id] = lesson;
  }

  // AI lessons: any touched lessonId that isn't a built-in.
  const aiLessonIds = Array.from(
    new Set(allLatest.map((p) => p.lessonId).filter((id) => !(id in builtInLessons)))
  );

  const aiLessons: Record<
    string,
    { lesson: Lesson; topic: string | null }
  > = {};
  if (aiLessonIds.length > 0) {
    try {
      const { data } = await supabase
        .from("ai_lessons")
        .select("id, topic, lesson_json")
        .eq("user_id", userId)
        .in("id", aiLessonIds);
      for (const row of data ?? []) {
        const id = row.id as string;
        const lesson = row.lesson_json as Lesson | null;
        if (lesson) {
          aiLessons[id] = {
            lesson,
            topic: (row.topic as string | null) ?? null,
          };
        }
      }
    } catch {
      // Tolerate a missing/failed query; AI-lesson concepts are simply skipped.
    }
  }

  const resolved: EligibleConcept[] = [];
  for (const { lessonId, stepId, at } of allLatest) {
    const daysAgo = daysSince(at);
    if (daysAgo === null) continue;

    const builtIn = builtInLessons[lessonId];
    if (builtIn) {
      const step = builtIn.steps.find((s) => s.id === stepId);
      if (!step) continue;
      const conceptLabel = (step.concept || step.title || "").trim();
      if (!conceptLabel) continue;
      resolved.push({
        lessonId,
        stepId,
        conceptLabel,
        lessonTitle: builtIn.title,
        // LESSON_TOPIC values ("equations"|"graphing"|"quadratics") are exactly
        // the TopicFamily union, so this maps directly.
        topicFamily: LESSON_TOPIC[lessonId] ?? "equations",
        lastReviewedDaysAgo: daysAgo,
      });
      continue;
    }

    const ai = aiLessons[lessonId];
    if (!ai) continue;
    const step = ai.lesson.steps.find((s) => s.id === stepId);
    if (!step) continue;
    const conceptLabel = (step.concept || step.title || "").trim();
    if (!conceptLabel) continue;
    resolved.push({
      lessonId,
      stepId,
      conceptLabel,
      lessonTitle: ai.lesson.title,
      topicFamily: ai.topic ? topicFamily(ai.topic) : "equations",
      lastReviewedDaysAgo: daysAgo,
    });
  }

  // Dedupe by conceptLabel, collapsing to the MOST RECENT review (smallest
  // daysAgo) across every step/lesson carrying that label. This makes the
  // touched-today test per-CONCEPT: a concept reviewed today via any of its
  // steps collapses to daysAgo 0 and is dropped below, while a concept whose
  // most recent review was an earlier day stays eligible.
  const byLabel: Record<string, EligibleConcept> = {};
  for (const c of resolved) {
    const existing = byLabel[c.conceptLabel];
    if (!existing || c.lastReviewedDaysAgo < existing.lastReviewedDaysAgo) {
      byLabel[c.conceptLabel] = c;
    }
  }

  // Keep only concepts last reviewed strictly before today (same-day excluded).
  return Object.values(byLabel)
    .filter((c) => c.lastReviewedDaysAgo >= 1)
    .sort((a, b) => a.lastReviewedDaysAgo - b.lastReviewedDaysAgo)
    .slice(0, MAX_CONCEPTS);
}
