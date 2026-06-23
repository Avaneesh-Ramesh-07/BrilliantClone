import type { SupabaseClient } from "@supabase/supabase-js";
import type { LessonProgress } from "@/types/lesson";

const DEFAULT_PROGRESS: LessonProgress = {
  status: "not_started",
  current_step_index: 0,
};

export async function getLessonProgress(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<LessonProgress> {
  const { data } = await supabase
    .from("lesson_progress")
    .select("status, current_step_index, completed_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (!data) return DEFAULT_PROGRESS;

  return {
    status: data.status as LessonProgress["status"],
    current_step_index: data.current_step_index,
    completed_at: data.completed_at,
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
    });
  }
}

export async function completeLesson(
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
    status: "complete" as const,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

export async function recordStepAttempt(
  supabase: SupabaseClient,
  params: {
    userId: string;
    lessonId: string;
    stepId: string;
    problemId: string;
    correct: boolean;
    hintsUsed: number;
  }
): Promise<void> {
  await supabase.from("step_attempts").insert({
    user_id: params.userId,
    lesson_id: params.lessonId,
    step_id: params.stepId,
    problem_id: params.problemId,
    correct: params.correct,
    hints_used: params.hintsUsed,
  });
}

export function getCompletedStepCount(progress: LessonProgress): number {
  if (progress.status === "complete") return 5;
  return progress.current_step_index;
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
