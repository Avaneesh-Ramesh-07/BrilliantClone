import { redirect } from "next/navigation";
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
        <p className="text-label text-muted">Welcome back</p>
        <h1 className="font-heading text-heading-lg text-text">{firstName}</h1>
        {primaryLesson && (
          <p className="mt-1 text-body text-muted">
            {primaryLesson.subject} — {primaryLesson.title}
          </p>
        )}
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
    </main>
  );
}
