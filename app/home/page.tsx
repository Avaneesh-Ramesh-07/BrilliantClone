import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountActions } from "@/components/home/AccountActions";
import { StreakBadge } from "@/components/home/StreakBadge";
import { LessonCard } from "@/components/home/LessonCard";
import { getAllLessons } from "@/lib/lessons";
import { getLessonProgress, getProfile, getStreak } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

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

      <section className="mt-6">
        <Link
          href="/mastery"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div>
            <p className="text-body font-medium text-text">Your mastery</p>
            <p className="text-label text-muted">
              See your skills, recent practice, and comfort by lesson
            </p>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 shrink-0 text-muted"
            aria-hidden
          >
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </section>
    </main>
  );
}
