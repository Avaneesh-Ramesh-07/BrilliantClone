import lessonEquations from "@/content/lessons/lesson-equations.json";
import lessonGraphingLines from "@/content/lessons/lesson-graphing-lines.json";
import lessonQuadratics from "@/content/lessons/lesson-quadratics.json";
import guestBank from "@/content/arena/guest-problems.json";
import type { ArenaProblem, ProblemPool } from "@/types/arena";

/**
 * Problem delivery for the Arena. Two pools:
 *  - Guests: the 30-problem easy -> hard bank (Phase 2), consumed sequentially.
 *  - Authenticated users: numeric-input problems pulled from STATICALLY IMPORTED
 *    lesson JSON, restricted to lessons the user has completed. Problems are
 *    grouped into tiers by step index (step 1 = easiest tier), and the feed
 *    advances to a harder tier every 4 correct answers.
 *
 * No lesson content is ever fetched from Supabase — only the imports above.
 */

const STATIC_LESSONS = [
  lessonEquations,
  lessonGraphingLines,
  lessonQuadratics,
] as const;

const LESSON_BY_ID: Record<string, (typeof STATIC_LESSONS)[number]> = {
  "lesson-equations": lessonEquations,
  "lesson-graphing-lines": lessonGraphingLines,
  "lesson-quadratics": lessonQuadratics,
};

interface RawProblem {
  id?: string;
  type?: string;
  prompt?: string;
  answer?: unknown;
  demo?: boolean;
}

/** A numeric-input problem usable in the arena: has a prompt and a numeric answer. */
function toArenaProblem(
  p: RawProblem,
  lessonId: string,
  stepId: string
): ArenaProblem | null {
  if (p.type !== "numeric-input") return null;
  if (typeof p.prompt !== "string") return null;
  if (typeof p.answer !== "number" || Number.isNaN(p.answer)) return null;
  return {
    // Namespace the id so the same problem id across lessons can't collide.
    id: `${lessonId}:${stepId}:${p.id ?? p.prompt}`,
    prompt: p.prompt,
    answer: p.answer,
  };
}

/** The full guest bank as ArenaProblems, in authored (easy -> hard) order. */
export function getGuestProblems(): ArenaProblem[] {
  return guestBank.problems.map((p) => ({
    id: p.id,
    prompt: p.prompt,
    answer: p.answer,
  }));
}

/** Guest pool: a single tier consumed in order, so difficulty rises naturally. */
export function buildGuestPool(): ProblemPool {
  return { tiers: [getGuestProblems()] };
}

/**
 * Authenticated pool built from the given completed lesson ids. Tiers are keyed
 * by step index across all completed lessons (tier 0 = every lesson's step 1,
 * tier 1 = step 2, ...) so the feed gets harder as the step index climbs.
 * Lessons are taken in curriculum order; unknown ids are ignored. If the user
 * has completed nothing (or no numeric problems are found), falls back to the
 * guest bank so a match is always playable.
 */
export function buildAuthedPool(completedLessonIds: string[]): ProblemPool {
  const orderedCompleted = STATIC_LESSONS.map((l) => l.id).filter((id) =>
    completedLessonIds.includes(id)
  );

  const tiers: ArenaProblem[][] = [];

  for (const lessonId of orderedCompleted) {
    const lesson = LESSON_BY_ID[lessonId];
    if (!lesson) continue;
    lesson.steps.forEach((step, stepIndex) => {
      const problems = (step.problems as RawProblem[]) ?? [];
      for (const raw of problems) {
        const arenaProblem = toArenaProblem(raw, lesson.id, step.id);
        if (!arenaProblem) continue;
        if (!tiers[stepIndex]) tiers[stepIndex] = [];
        tiers[stepIndex].push(arenaProblem);
      }
    });
  }

  const nonEmpty = tiers.filter((t) => t && t.length > 0);
  if (nonEmpty.length === 0) return buildGuestPool();
  return { tiers: nonEmpty };
}

/**
 * Picks the next problem the player should see, given the pool, the set of
 * already-used problem ids (no repeats within a session), and how many answers
 * they've gotten correct so far. The target tier advances one step every 4
 * correct answers; if that tier is exhausted we search harder tiers first, then
 * easier ones. Returns null only when every problem in the pool is used up.
 */
export function nextProblem(
  pool: ProblemPool,
  usedIds: Set<string>,
  correctCount: number
): ArenaProblem | null {
  const tierCount = pool.tiers.length;
  if (tierCount === 0) return null;

  const target = Math.min(Math.floor(correctCount / 4), tierCount - 1);

  const order: number[] = [];
  for (let t = target; t < tierCount; t++) order.push(t);
  for (let t = target - 1; t >= 0; t--) order.push(t);

  for (const t of order) {
    const available = pool.tiers[t].filter((p) => !usedIds.has(p.id));
    if (available.length > 0) return available[0];
  }
  return null;
}
