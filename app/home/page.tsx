import { redirect } from "next/navigation";
import { CalendarToggle } from "@/components/home/CalendarToggle";
import { LessonPath, type LessonPathItem } from "@/components/home/LessonPath";
import { StreakWidget } from "@/components/home/StreakWidget";
import { getMonthlyActivity } from "@/lib/activity";
import { getAllLessons } from "@/lib/lessons";
import {
  getAllLessonProgress,
  getAllLessonStats,
  getProfile,
  getStreak,
  getWeeklyActivity,
  hasCompletedLessonToday,
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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [profile, streak, weekly, progressMap, lessonStats, monthlyActivity] =
    await Promise.all([
      getProfile(supabase, user.id),
      getStreak(supabase, user.id),
      getWeeklyActivity(supabase, user.id),
      getAllLessonProgress(supabase, user.id),
      getAllLessonStats(supabase, user.id),
      getMonthlyActivity(supabase, user.id, currentYear, currentMonth),
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
  // Real "finished a lesson today" signal (a completed_at dated today), not the
  // weekly-activity array (which is derived from practice attempts).
  const completedToday = hasCompletedLessonToday(progressMap, now);

  return (
    <main className="py-8">
      {/*
        Full-bleed breakout (desktop only): the root layout traps every page in
        a 480px column (max-w-app) with px-4. On md+ we pull out to span the
        viewport (left-1/2 + -mx-[50vw] + w-screen) then re-center in a wider
        max-w-5xl container so the streak + path can sit side by side. On mobile
        these md: utilities are inert, so it stays a single 480px column.
      */}
      <div className="md:relative md:left-1/2 md:right-1/2 md:-mx-[50vw] md:w-screen">
        <div className="md:mx-auto md:max-w-5xl md:px-8">
          <div className="md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start md:gap-12">
            {/* LEFT — welcome header + streak (sticky on desktop) */}
            <div className="md:sticky md:top-24">
              <header className="mb-8">
                <p className="text-label text-muted">Welcome back</p>
                <h1 className="font-heading text-heading-lg text-text">
                  {firstName}
                </h1>
              </header>

              <section className="mb-6">
                <StreakWidget
                  streak={streak.current_streak}
                  days={weekly.days}
                  todayIndex={weekly.todayIndex}
                  completedToday={completedToday}
                />
              </section>

              <section className="mb-10 md:mb-0">
                <CalendarToggle activity={monthlyActivity} />
              </section>
            </div>

            {/* RIGHT — vertical learning path */}
            <section>
              <h2 className="mb-1 font-heading text-heading-lg text-text">
                Your learning path
              </h2>
              <p className="mb-6 text-body text-muted">
                Tap a lesson to see your progress and jump back in.
              </p>
              <LessonPath lessons={pathItems} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
