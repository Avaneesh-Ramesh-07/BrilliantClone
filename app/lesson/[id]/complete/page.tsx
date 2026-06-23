import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompletionConfetti } from "@/components/lesson/CompletionConfetti";
import { RestartLessonButton } from "@/components/lesson/RestartLessonButton";
import { Button } from "@/components/ui/Button";
import { getLesson } from "@/lib/lessons";
import { completeLesson, getLessonProgress } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

interface CompletePageProps {
  params: Promise<{ id: string }>;
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

  const progress = await getLessonProgress(supabase, user.id, lesson.id);

  if (
    progress.status !== "complete" &&
    progress.current_step_index < lesson.totalSteps - 1
  ) {
    redirect(`/lesson/${id}`);
  }

  if (progress.status !== "complete") {
    await completeLesson(supabase, user.id, lesson.id);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-12 text-center">
      <CompletionConfetti />
      <p className="text-heading-lg">Congrats! 🎉</p>
      <h1 className="mt-4 font-heading text-heading-lg text-text">
        You finished 1/1 lessons!
      </h1>
      <p className="mt-4 max-w-sm text-body text-muted">
        You have successfully mastered equation solving.
      </p>
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Link href="/home">
          <Button fullWidth>Back to Home</Button>
        </Link>
        <RestartLessonButton lessonId={lesson.id} userId={user.id} />
      </div>
    </main>
  );
}
