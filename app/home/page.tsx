import { redirect } from "next/navigation";
import { AccountActions } from "@/components/home/AccountActions";
import { LessonPath, type LessonPathItem } from "@/components/home/LessonPath";
import { StreakWidget } from "@/components/home/StreakWidget";
import { getAllLessons } from "@/lib/lessons";
import {
  getAllLessonProgress,
  getAllLessonStats,
  getProfile,
  getStreak,
  getWeeklyActivity,
  hasEverCompleted,
} from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";
import type { LessonProgress } from "@/types/lesson";

const DEFAULT_PROGRESS: LessonProgress = {
  status: "not_started",
  current_step_index: 0,
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profile, streak, weekly, progressMap, lessonStats] = await Promise.all([
    getProfile(supabase, user.id),
    getStreak(supabase, user.id),
    getWeeklyActivity(supabase, user.id),
    getAllLessonProgress(supabase, user.id),
    getAllLessonStats(supabase, user.id),
  ]);

  const lessons = getAllLessons();

  const pathItems: LessonPathItem[] = lessons.map((lesson, index) => {
    const progress = progressMap[lesson.id] ?? DEFAULT_PROGRESS;
    const previous =
      index > 0
        ? progressMap[lessons[index - 1].id] ?? DEFAULT_PROGRESS
        : null;
    const locked = index > 0 && !hasEverCompleted(previous as LessonProgress);
    const completedSteps =
      progress.completed_at != null
        ? lesson.totalSteps
        : progress.current_step_index;
    const stats = lessonStats[lesson.id];

    return {
      lesson,
      progress,
      locked,
      completedSteps,
      timeSpentMs: stats?.timeSpentMs ?? 0,
      lastAccessedAt: stats?.lastAccessedAt ?? null,
    };
  });

  const firstName = profile?.display_name?.split(" ")[0] ?? "Student";

  return (
    <main className="py-8">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div>
          <p className="text-label text-muted">Welcome back</p>
          <h1 className="font-heading text-heading-lg text-text">{firstName}</h1>
        </div>
        <AccountActions email={user.email ?? ""} />
      </header>

      <section className="mb-10">
        <StreakWidget
          streak={streak.current_streak}
          days={weekly.days}
          todayIndex={weekly.todayIndex}
        />
      </section>

      <section>
        <h2 className="mb-1 font-heading text-heading-lg">
          <span className="bg-gradient-to-r from-primary via-accent-purple to-accent-pink bg-clip-text text-transparent">
            Your learning path
          </span>
        </h2>
        <p className="mb-6 text-body text-muted">
          Tap a lesson to see your progress and jump back in.
        </p>
        <LessonPath lessons={pathItems} />
      </section>
    </main>
  );
}
