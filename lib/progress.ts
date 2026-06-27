import type { SupabaseClient } from "@supabase/supabase-js";
import type { LessonProgress } from "@/types/lesson";

const DEFAULT_PROGRESS: LessonProgress = {
  status: "not_started",
  current_step_index: 0,
};

/**
 * Whether the lesson is currently in a finished state. Based on `completed_at`,
 * which survives moving back through a finished lesson and exiting, but is
 * cleared on restart (so a restarted lesson reads as a fresh run). Used for the
 * Home "completed" card, the congrats screen, and the mastery status.
 */
export function isLessonComplete(progress: LessonProgress): boolean {
  return progress.completed_at != null;
}

/**
 * Whether the learner has finished this lesson at least once, ever. This is
 * durable — it is never cleared, including on restart — so later lessons the
 * learner unlocked stay unlocked even after they restart an earlier lesson.
 */
export function hasEverCompleted(progress: LessonProgress): boolean {
  return progress.ever_completed === true;
}

export async function getLessonProgress(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<LessonProgress> {
  const { data } = await supabase
    .from("lesson_progress")
    .select(
      "status, current_step_index, completed_at, ever_completed, last_duration_ms"
    )
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (!data) return DEFAULT_PROGRESS;

  return {
    status: data.status as LessonProgress["status"],
    current_step_index: data.current_step_index,
    completed_at: data.completed_at,
    ever_completed: data.ever_completed ?? false,
    last_duration_ms: data.last_duration_ms,
  };
}

export async function updateStepIndex(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  stepIndex: number
): Promise<void> {
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("lesson_progress")
      .update({
        current_step_index: stepIndex,
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
  } else {
    await supabase.from("lesson_progress").insert({
      user_id: userId,
      lesson_id: lessonId,
      status: "in_progress",
      current_step_index: stepIndex,
      started_at: new Date().toISOString(),
    });
  }
}

/** Sums active solve time (ms) for the current run, i.e. attempts since `since`. */
async function sumRunDuration(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  since: string | null
): Promise<number> {
  let query = supabase
    .from("step_attempts")
    .select("duration_ms")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId);

  if (since) query = query.gte("attempted_at", since);

  const { data } = await query;
  return (data ?? []).reduce(
    (sum, row) => sum + ((row.duration_ms as number | null) ?? 0),
    0
  );
}

export async function completeLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const totalDurationMs = await sumRunDuration(
    supabase,
    userId,
    lessonId,
    (existing?.started_at as string | null) ?? null
  );

  const payload = {
    status: "complete" as const,
    completed_at: new Date().toISOString(),
    // Durable: once true it is never unset, keeping later lessons unlocked.
    ever_completed: true,
    updated_at: new Date().toISOString(),
    last_duration_ms: totalDurationMs,
  };

  if (existing) {
    await supabase
      .from("lesson_progress")
      .update(payload)
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
  } else {
    await supabase.from("lesson_progress").insert({
      user_id: userId,
      lesson_id: lessonId,
      current_step_index: 4,
      ...payload,
    });
  }
}

export async function restartLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  const payload = {
    status: "in_progress" as const,
    current_step_index: 0,
    updated_at: new Date().toISOString(),
    // Treat this as a fresh run: clear the completion marker, timer total, and
    // start a new timer. We deliberately do NOT touch `ever_completed`, so any
    // later lessons the learner already unlocked stay unlocked.
    completed_at: null,
    last_duration_ms: null,
    started_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase
      .from("lesson_progress")
      .update(payload)
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);
  } else {
    await supabase.from("lesson_progress").insert({
      user_id: userId,
      lesson_id: lessonId,
      ...payload,
    });
  }
}

export async function recordStepAttempt(
  supabase: SupabaseClient,
  params: {
    userId: string;
    lessonId: string;
    stepId: string;
    problemId: string;
    correct: boolean;
    hintsUsed: number;
    /** Active time on the problem in ms. Internal analytics only. */
    durationMs?: number;
  }
): Promise<void> {
  await supabase.from("step_attempts").insert({
    user_id: params.userId,
    lesson_id: params.lessonId,
    step_id: params.stepId,
    problem_id: params.problemId,
    correct: params.correct,
    hints_used: params.hintsUsed,
    duration_ms: params.durationMs ?? null,
  });
}

export interface AttemptRow {
  lesson_id: string;
  step_id: string;
  correct: boolean;
  duration_ms: number | null;
  attempted_at: string;
}

/**
 * Returns every step attempt for a user (most recent first), across all
 * lessons. Used to build the mastery overview (last-practiced + comfort).
 */
export async function getAllStepAttempts(
  supabase: SupabaseClient,
  userId: string
): Promise<AttemptRow[]> {
  const { data } = await supabase
    .from("step_attempts")
    .select("lesson_id, step_id, correct, duration_ms, attempted_at")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: false });

  return (data ?? []) as AttemptRow[];
}

/** Returns lesson progress for every lesson the user has touched, keyed by lesson_id. */
export async function getAllLessonProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, LessonProgress>> {
  const { data } = await supabase
    .from("lesson_progress")
    .select(
      "lesson_id, status, current_step_index, completed_at, ever_completed, last_duration_ms"
    )
    .eq("user_id", userId);

  const map: Record<string, LessonProgress> = {};
  for (const row of data ?? []) {
    map[row.lesson_id as string] = {
      status: row.status as LessonProgress["status"],
      current_step_index: row.current_step_index as number,
      completed_at: row.completed_at as string | null,
      ever_completed: (row.ever_completed as boolean | null) ?? false,
      last_duration_ms: row.last_duration_ms as number | null,
    };
  }
  return map;
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ display_name: string } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return data;
}

/**
 * Whether the learner has actually FINISHED a lesson today (server local time),
 * based on any lesson's `lesson_progress.completed_at`. This is a real
 * completion signal — distinct from {@link getWeeklyActivity}, which is derived
 * from `step_attempts` and therefore reflects practice activity (which would be
 * true for merely opening/attempting a lesson), not completion. Pass the map
 * already loaded via {@link getAllLessonProgress} so no extra query is needed.
 */
export function hasCompletedLessonToday(
  progressMap: Record<string, LessonProgress>,
  now: Date = new Date()
): boolean {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  const startOfTomorrow = startOfToday + 86_400_000;

  for (const progress of Object.values(progressMap)) {
    const completedAt = progress.completed_at;
    if (!completedAt) continue;
    const t = new Date(completedAt).getTime();
    if (!Number.isNaN(t) && t >= startOfToday && t < startOfTomorrow) {
      return true;
    }
  }
  return false;
}

export async function getStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<{ current_streak: number; longest_streak: number }> {
  const { data } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    current_streak: data?.current_streak ?? 0,
    longest_streak: data?.longest_streak ?? 0,
  };
}

export interface WeeklyActivity {
  /** 7 booleans, index 0 = Sunday … 6 = Saturday, true when there was activity that weekday this week. */
  days: boolean[];
  /** Weekday index (0 = Sunday … 6 = Saturday) for today, server local time. */
  todayIndex: number;
}

/**
 * Returns this week's daily activity (Sunday-indexed) based on `step_attempts`.
 * Week starts at the most recent Sunday 00:00 in server local time.
 */
export async function getWeeklyActivity(
  supabase: SupabaseClient,
  userId: string
): Promise<WeeklyActivity> {
  const now = new Date();
  const todayIndex = now.getDay();
  const startOfWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - todayIndex,
    0,
    0,
    0,
    0
  );

  const { data } = await supabase
    .from("step_attempts")
    .select("attempted_at")
    .eq("user_id", userId)
    .gte("attempted_at", startOfWeek.toISOString());

  const days = [false, false, false, false, false, false, false];
  for (const row of data ?? []) {
    const attemptedAt = row.attempted_at as string | null;
    if (!attemptedAt) continue;
    const index = new Date(attemptedAt).getDay();
    if (index >= 0 && index <= 6) days[index] = true;
  }

  return { days, todayIndex };
}

export interface LessonStats {
  /** Total active solve time across all attempts for this lesson (ms). */
  timeSpentMs: number;
  /** ISO timestamp of the most recent attempt, or null when never attempted. */
  lastAccessedAt: string | null;
}

/**
 * Aggregates `step_attempts` per lesson in JS from a single query. Lessons with
 * no attempts are omitted (callers should default to `{ timeSpentMs: 0,
 * lastAccessedAt: null }`).
 */
export async function getAllLessonStats(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, LessonStats>> {
  const { data } = await supabase
    .from("step_attempts")
    .select("lesson_id, duration_ms, attempted_at")
    .eq("user_id", userId);

  const stats: Record<string, LessonStats> = {};
  for (const row of data ?? []) {
    const lessonId = row.lesson_id as string | null;
    if (!lessonId) continue;

    const durationMs = (row.duration_ms as number | null) ?? 0;
    const attemptedAt = row.attempted_at as string | null;

    const existing = stats[lessonId] ?? {
      timeSpentMs: 0,
      lastAccessedAt: null,
    };
    existing.timeSpentMs += durationMs;
    if (
      attemptedAt &&
      (existing.lastAccessedAt === null ||
        attemptedAt > existing.lastAccessedAt)
    ) {
      existing.lastAccessedAt = attemptedAt;
    }
    stats[lessonId] = existing;
  }

  return stats;
}
