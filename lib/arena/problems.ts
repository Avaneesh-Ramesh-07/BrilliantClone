import { buildPoolForTopics } from "@/lib/arena/generators";
import { ARENA_TOPICS } from "@/types/arena";
import type { ArenaProblem, ArenaTopic, ProblemPool } from "@/types/arena";

/**
 * Problem delivery for the Arena. Every problem is a single-numeric-answer
 * ArenaProblem produced by the procedural generators (lib/arena/generators.ts),
 * which build HARD, multi-step problems correct-by-construction across the
 * three algebra topics. Two pools:
 *
 *  - Guests: assumed fully proficient — the FULL topic range at hard difficulty.
 *  - Authenticated users: hard problems restricted to the topics behind the
 *    lessons they've completed (with a safe full-range fallback).
 *
 * No lesson content or problems are fetched from Supabase.
 */

/** Maps a completed lesson id to the arena topic it unlocks. */
const LESSON_TO_TOPIC: Record<string, ArenaTopic> = {
  "lesson-equations": "equations",
  "lesson-graphing-lines": "graphing",
  "lesson-quadratics": "quadratics",
};

/**
 * Guest pool: guests are assumed fully proficient in algebra, so they get the
 * full topic range (equations + graphing + quadratics) at hard difficulty.
 */
export function buildGuestPool(): ProblemPool {
  return buildPoolForTopics(ARENA_TOPICS);
}

/**
 * Authenticated pool built from the given completed lesson ids: resolves them
 * to arena topics and generates hard problems for only those topics. If no
 * topic resolves (shouldn't happen — the Arena gate requires ≥1 completed
 * lesson), falls back to the full guest range so a match is always playable.
 */
export function buildAuthedPool(completedLessonIds: string[]): ProblemPool {
  const topics: ArenaTopic[] = [];
  for (const id of completedLessonIds) {
    const topic = LESSON_TO_TOPIC[id];
    if (topic && !topics.includes(topic)) topics.push(topic);
  }

  if (topics.length === 0) return buildGuestPool();
  return buildPoolForTopics(topics);
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
