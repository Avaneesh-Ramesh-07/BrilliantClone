import Link from "next/link";
import { redirect } from "next/navigation";
import { MasteryView } from "@/components/mastery/MasteryView";
import { buildLessonMastery } from "@/lib/comfort";
import { getAllLessons } from "@/lib/lessons";
import { getAllLessonProgress, getAllStepAttempts } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

export default async function MasteryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const lessons = getAllLessons();
  const [attempts, progressByLesson] = await Promise.all([
    getAllStepAttempts(supabase, user.id),
    getAllLessonProgress(supabase, user.id),
  ]);

  const mastery = lessons.map((lesson) =>
    buildLessonMastery(lesson, attempts, progressByLesson[lesson.id])
  );

  return (
    <main className="py-8">
      <header className="mb-6">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-label text-muted transition-colors hover:text-text"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to lessons
        </Link>
        <h1 className="mt-3 font-heading text-heading-lg text-text">
          Your mastery
        </h1>
        <p className="mt-1 text-body text-muted">
          Skills you&apos;ve practiced, how recently, and how comfortable you
          are with each lesson.
        </p>
      </header>

      <MasteryView lessons={mastery} />
    </main>
  );
}
