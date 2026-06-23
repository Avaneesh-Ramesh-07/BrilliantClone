import { notFound, redirect } from "next/navigation";
import { StepPlayer } from "@/components/lesson/StepPlayer";
import { getLesson, selectLessonRun } from "@/lib/lessons";
import { getLessonProgress } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";

interface LessonPageProps {
  params: Promise<{ id: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { id } = await params;
  const lesson = getLesson(id);

  if (!lesson) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const progress = await getLessonProgress(supabase, user.id, lesson.id);
  const lessonRun = selectLessonRun(lesson);

  return (
    <StepPlayer
      lesson={lessonRun}
      userId={user.id}
      initialStepIndex={progress.current_step_index}
    />
  );
}
