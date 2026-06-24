import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompletionConfetti } from "@/components/lesson/CompletionConfetti";
import { RestartLessonButton } from "@/components/lesson/RestartLessonButton";
import { Button } from "@/components/ui/Button";
import { formatDuration } from "@/lib/comfort";
import { getLesson } from "@/lib/lessons";
import { completeLesson, getLessonProgress } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

interface CompletePageProps {
  params: Promise<{ id: string }>;
}

const CELEBRATION_MESSAGES = [
  "Awesome job today! I'd be **line** if I said I wasn't proud of your progress!!",
  "Way to go! You're on the true path to being an Algebra Warrior!!",
  "Amazing job! Congrats on finishing <lesson name>",
  "Woah! I don't know very many people with your alge-brains!! Congrats on completing the lesson!!",
];

/** Substitutes the lesson name and renders **bold** segments of a message. */
function renderCelebration(template: string, lessonName: string) {
  const withName = template.replace(/<lesson name>/gi, lessonName);
  return withName.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    return bold ? (
      <strong key={i} className="font-semibold text-text">
        {bold[1]}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

export default async function CompletePage({ params }: CompletePageProps) {
  const { id } = await params;
  const lesson = getLesson(id);

  if (!lesson) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let progress = await getLessonProgress(supabase, user.id, lesson.id);

  if (
    progress.status !== "complete" &&
    progress.current_step_index < lesson.totalSteps - 1
  ) {
    redirect(`/lesson/${id}`);
  }

  if (progress.status !== "complete") {
    await completeLesson(supabase, user.id, lesson.id);
    // Re-read so we pick up the total run time computed at completion.
    progress = await getLessonProgress(supabase, user.id, lesson.id);
  }

  const totalMs = progress.last_duration_ms ?? null;
  const celebration =
    CELEBRATION_MESSAGES[
      Math.floor(Math.random() * CELEBRATION_MESSAGES.length)
    ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-12 text-center">
      <CompletionConfetti />
      <p className="text-heading-lg">🎉</p>
      <h1 className="mt-4 font-heading text-heading-lg text-text">
        Congrats, you&apos;re an expert at {lesson.title}!
      </h1>
      <p className="mt-4 max-w-sm text-body text-muted">
        {renderCelebration(celebration, lesson.title)}
      </p>

      {totalMs !== null && (
        <div className="mt-8 rounded-xl border border-border bg-surface px-6 py-4">
          <p className="text-label text-muted">Total time</p>
          <p className="mt-1 font-heading text-heading-lg text-text">
            {formatDuration(totalMs)}
          </p>
        </div>
      )}

      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link href="/home">
          <Button fullWidth>Back to Home</Button>
        </Link>
        <RestartLessonButton lessonId={lesson.id} userId={user.id} />
      </div>
    </main>
  );
}
