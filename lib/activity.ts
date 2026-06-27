import type { SupabaseClient } from "@supabase/supabase-js";
import { getLessonOrder } from "@/lib/lessons";

/**
 * Cross-activity daily time aggregation for the Study Calendar.
 *
 * Pulls together every activity type that AlgebraPath records to the database
 * and buckets it by *local* calendar day (server timezone, matching the rest of
 * the app — see `getWeeklyActivity` in lib/progress.ts). The sources are:
 *
 *  - Curriculum + AI lessons  -> `step_attempts.duration_ms` (built-in lessons
 *                                and AI-built custom lessons).
 *  - Practice tests           -> `step_attempts.duration_ms` for lessons whose
 *                                `ai_lessons.kind = 'practice_test'`. Practice
 *                                tests are played as AI lessons through the same
 *                                StepPlayer, so they also write `step_attempts`;
 *                                we split them out via the `ai_lessons` table.
 *  - Head-to-head duels       -> estimated from `arena_events`: per duel we take
 *                                the wall-clock span (last − first event), the
 *                                same heuristic the Duel-history dashboard uses.
 *  - Endless practice         -> NOT TRACKED. The endless/sandbox mode never
 *                                persists attempts or time (it only calls the
 *                                stateless `/api/sandbox/feedback` route), so
 *                                there is nothing in the DB to aggregate. We
 *                                report it as 0 rather than invent a table.
 *
 * There is no explicit "login" event table either, so a day counts as
 * `active` when it has ANY recorded activity (a step attempt, a lesson
 * completion, or a duel).
 */

export interface ActivityBreakdown {
  /** Active solve time on curriculum + AI custom lessons (ms). */
  lessons: number;
  /** Active solve time on generated practice tests (ms). */
  practiceTests: number;
  /** Estimated time spent in head-to-head duels (ms). */
  duels: number;
  /** Endless practice — always 0 (not persisted anywhere). */
  endless: number;
}

export interface DayActivity {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Day of month, 1–31. */
  day: number;
  /** Sum of every tracked activity's time that day (ms). */
  totalMs: number;
  breakdown: ActivityBreakdown;
  /** A `lesson_progress.completed_at` fell on this day. */
  completedLesson: boolean;
  /** Any recorded activity (attempt, completion, or duel) that day. */
  active: boolean;
}

export interface MonthlyActivity {
  /** Full year, e.g. 2026. */
  year: number;
  /** Month, 1–12 (1 = January). */
  month: number;
  /** One entry per calendar day of the month, in order (index 0 = the 1st). */
  days: DayActivity[];
}

interface StepAttemptRow {
  lesson_id: string | null;
  duration_ms: number | null;
  attempted_at: string | null;
}

interface ArenaEventRow {
  session_id: string;
  created_at: string;
}

/** A local `YYYY-MM-DD` key for an ISO timestamp (server-local, like the app). */
function localDayKey(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A local `YYYY-MM-DD` key from explicit local Y/M/D parts. */
function dayKeyFromParts(year: number, month1: number, day: number): string {
  return `${year}-${`${month1}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

/**
 * Daily cross-activity totals for a single month.
 *
 * @param month 1–12 (1 = January). All boundaries are computed in server-local
 *   time and every query is scoped to `[firstOfMonth, firstOfNextMonth)`.
 */
export async function getMonthlyActivity(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<MonthlyActivity> {
  // Local month window; `end` is the exclusive first instant of next month.
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Per-day accumulators keyed by `YYYY-MM-DD`.
  const lessonsMs: Record<string, number> = {};
  const practiceMs: Record<string, number> = {};
  const duelsMs: Record<string, number> = {};
  const completedDays = new Set<string>();
  const activeDays = new Set<string>();

  const builtInIds = new Set(getLessonOrder());

  // --- Step attempts (lessons + practice tests) ---------------------------
  const { data: attemptData } = await supabase
    .from("step_attempts")
    .select("lesson_id, duration_ms, attempted_at")
    .eq("user_id", userId)
    .gte("attempted_at", startIso)
    .lt("attempted_at", endIso);

  const attempts = (attemptData as StepAttemptRow[] | null) ?? [];

  // Resolve which AI lesson_ids in this window are practice tests. Any lesson_id
  // that is neither a built-in lesson nor a known AI lesson defaults to the
  // "lessons" bucket.
  const aiLessonIds = Array.from(
    new Set(
      attempts
        .map((a) => a.lesson_id)
        .filter(
          (id): id is string => typeof id === "string" && !builtInIds.has(id)
        )
    )
  );

  const practiceTestIds = new Set<string>();
  if (aiLessonIds.length > 0) {
    try {
      const { data: aiRows } = await supabase
        .from("ai_lessons")
        .select("id, kind")
        .eq("user_id", userId)
        .in("id", aiLessonIds);
      for (const row of aiRows ?? []) {
        if ((row.kind as string | null) === "practice_test") {
          practiceTestIds.add(row.id as string);
        }
      }
    } catch {
      // Tolerate a missing `kind` column / failed lookup: such attempts simply
      // fall through to the "lessons" bucket rather than breaking the page.
    }
  }

  for (const a of attempts) {
    if (!a.attempted_at) continue;
    const key = localDayKey(a.attempted_at);
    activeDays.add(key);
    const ms = a.duration_ms ?? 0;
    if (a.lesson_id && practiceTestIds.has(a.lesson_id)) {
      practiceMs[key] = (practiceMs[key] ?? 0) + ms;
    } else {
      lessonsMs[key] = (lessonsMs[key] ?? 0) + ms;
    }
  }

  // --- Lesson completions -------------------------------------------------
  const { data: progressData } = await supabase
    .from("lesson_progress")
    .select("completed_at")
    .eq("user_id", userId)
    .gte("completed_at", startIso)
    .lt("completed_at", endIso);

  for (const row of progressData ?? []) {
    const completedAt = row.completed_at as string | null;
    if (!completedAt) continue;
    const key = localDayKey(completedAt);
    completedDays.add(key);
    activeDays.add(key);
  }

  // --- Duels (estimated from arena_events spans) --------------------------
  // Find the user's sessions created this month, then derive each duel's active
  // time as the span between its first and last event (same heuristic as the
  // Duel-history dashboard). Bucket that span on the session's local day.
  const { data: sessionData } = await supabase
    .from("arena_sessions")
    .select("id, created_at")
    .or(`created_by.eq.${userId},joined_by.eq.${userId}`)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const sessions = (sessionData as { id: string; created_at: string }[] | null) ?? [];
  if (sessions.length > 0) {
    const dayBySession = new Map<string, string>();
    for (const s of sessions) dayBySession.set(s.id, localDayKey(s.created_at));

    const { data: eventData } = await supabase
      .from("arena_events")
      .select("session_id, created_at")
      .in(
        "session_id",
        sessions.map((s) => s.id)
      );

    const events = (eventData as ArenaEventRow[] | null) ?? [];
    const minMax = new Map<string, { min: number; max: number }>();
    for (const e of events) {
      const t = new Date(e.created_at).getTime();
      const cur = minMax.get(e.session_id);
      if (!cur) minMax.set(e.session_id, { min: t, max: t });
      else {
        if (t < cur.min) cur.min = t;
        if (t > cur.max) cur.max = t;
      }
    }

    dayBySession.forEach((day, sessionId) => {
      // A session always counts as activity on its day, even with <2 events.
      activeDays.add(day);
      const span = minMax.get(sessionId);
      if (span) duelsMs[day] = (duelsMs[day] ?? 0) + (span.max - span.min);
    });
  }

  // --- Assemble one entry per calendar day --------------------------------
  const days: DayActivity[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const key = dayKeyFromParts(year, month, day);
    const lessons = lessonsMs[key] ?? 0;
    const practiceTests = practiceMs[key] ?? 0;
    const duels = duelsMs[key] ?? 0;
    // TODO: endless practice is not persisted to the DB; wire this up if a
    // future migration starts recording endless attempts/time.
    const endless = 0;
    const totalMs = lessons + practiceTests + duels + endless;
    days.push({
      date: key,
      day,
      totalMs,
      breakdown: { lessons, practiceTests, duels, endless },
      completedLesson: completedDays.has(key),
      active: activeDays.has(key),
    });
  }

  return { year, month, days };
}

/**
 * Human-friendly study time, e.g. `0m`, `<1m`, `42m`, `1h 5m`. Rounds to whole
 * minutes; anything above zero but under a minute reads as `<1m`.
 */
export function formatStudyTime(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes === 0) return "<1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
