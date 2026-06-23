import { redirect } from "next/navigation";
import { AccountActions } from "@/components/home/AccountActions";
import { StreakBadge } from "@/components/home/StreakBadge";
import { LessonCard } from "@/components/home/LessonCard";
import { SkillActivity } from "@/components/home/SkillActivity";
import type { SkillActivityItem } from "@/components/home/SkillActivity";
import { getAllLessons } from "@/lib/lessons";
import {
  getLessonProgress,
  getProfile,
  getSkillActivity,
  getStreak,
} from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThen = new Date(iso);
  startOfThen.setHours(0, 0, 0, 0);
  return Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / 86400000
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  const streak = await getStreak(supabase, user.id);
  const lessons = getAllLessons();

  const lessonsWithProgress = await Promise.all(
    lessons.map(async (lesson) => ({
      lesson,
      progress: await getLessonProgress(supabase, user.id, lesson.id),
    }))
  );

  const firstName = profile?.display_name?.split(" ")[0] ?? "Student";
  const primaryLesson = lessons[0];

  const skillActivity: SkillActivityItem[] = primaryLesson
    ? await (async () => {
        const activity = await getSkillActivity(
          supabase,
          user.id,
          primaryLesson.id
        );
        return primaryLesson.steps.map((step) => ({
          skill: step.title,
          daysSince: daysSince(activity[step.id]),
        }));
      })()
    : [];

  return (
    <main className="py-8">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label text-muted">Welcome back</p>
            <h1 className="font-heading text-heading-lg text-text">
              {firstName}
            </h1>
            {primaryLesson && (
              <p className="mt-1 text-body text-muted">
                {primaryLesson.subject} — {primaryLesson.title}
              </p>
            )}
          </div>
          <AccountActions email={user.email ?? ""} />
        </div>
        <div className="mt-4">
          <StreakBadge streak={streak.current_streak} />
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-label text-muted">Your lessons</h2>
        <div className="flex flex-col gap-4">
          {lessonsWithProgress.map(({ lesson, progress }) => (
            <LessonCard key={lesson.id} lesson={lesson} progress={progress} />
          ))}
        </div>
      </section>

      <SkillActivity items={skillActivity} />
    </main>
  );
}
