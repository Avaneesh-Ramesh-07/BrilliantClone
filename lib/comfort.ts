import type { AttemptRow } from "@/lib/progress";
import type { Lesson, LessonProgress } from "@/types/lesson";

export type ComfortLevel =
  | "not-started"
  | "needs-practice"
  | "developing"
  | "comfortable"
  | "very-comfortable";

export interface ComfortMetric {
  level: ComfortLevel;
  /** 0-100 score derived from total lesson time vs. the expected time. */
  score: number;
  /** Total active solve time (ms) of the most recent completed run, if any. */
  totalMs: number | null;
}

export interface SkillSummary {
  stepId: string;
  skill: string;
  daysSince: number | null;
}

export interface LessonMastery {
  lessonId: string;
  title: string;
  subject: string;
  status: LessonProgress["status"];
  comfort: ComfortMetric;
  skills: SkillSummary[];
}

// Comfort is read off the total lesson time relative to the lesson's expected
// length: finishing at/under FAST_RATIO of the estimate reads as fully
// comfortable; taking SLOW_RATIO or longer reads as needing practice.
const FAST_RATIO = 0.4;
const SLOW_RATIO = 1.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Derives comfort from the total time taken to complete the lesson, normalized
 * against the lesson's expected duration. Returns "not-started" until the
 * learner has completed a run (we only have a total time after completion).
 */
export function computeComfort(
  totalMs: number | null,
  estimatedMinutes: number
): ComfortMetric {
  if (!totalMs || totalMs <= 0) {
    return { level: "not-started", score: 0, totalMs: null };
  }

  const targetMs = Math.max(estimatedMinutes, 1) * 60 * 1000;
  const ratio = totalMs / targetMs;
  const speedScore = clamp(
    (SLOW_RATIO - ratio) / (SLOW_RATIO - FAST_RATIO),
    0,
    1
  );
  const score = Math.round(speedScore * 100);

  return { level: toLevel(score), score, totalMs };
}

/** Formats a millisecond duration as e.g. "4m 12s" or "47s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function toLevel(score: number): ComfortLevel {
  if (score >= 80) return "very-comfortable";
  if (score >= 60) return "comfortable";
  if (score >= 40) return "developing";
  return "needs-practice";
}

export function daysSince(iso: string | undefined): number | null {
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

/**
 * Builds the per-lesson mastery overview: comfort metric plus, for each step,
 * how long it's been since the learner last practiced that skill.
 */
export function buildLessonMastery(
  lesson: Lesson,
  attempts: AttemptRow[],
  progress: LessonProgress | undefined
): LessonMastery {
  const lessonRows = attempts.filter((a) => a.lesson_id === lesson.id);

  const lastByStep: Record<string, string> = {};
  for (const row of lessonRows) {
    // Rows arrive most-recent-first, so the first one seen per step wins.
    if (!(row.step_id in lastByStep)) {
      lastByStep[row.step_id] = row.attempted_at;
    }
  }

  const skills: SkillSummary[] = lesson.steps.map((step) => ({
    stepId: step.id,
    skill: step.title,
    daysSince: daysSince(lastByStep[step.id]),
  }));

  return {
    lessonId: lesson.id,
    title: lesson.title,
    subject: lesson.subject,
    status: progress?.status ?? "not_started",
    comfort: computeComfort(
      progress?.last_duration_ms ?? null,
      lesson.estimatedMinutes
    ),
    skills,
  };
}
