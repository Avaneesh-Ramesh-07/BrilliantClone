import { notFound, redirect } from "next/navigation";
import { StepPlayer } from "@/components/lesson/StepPlayer";
import {
  getLesson,
  getPreviousLessonId,
  selectLessonRun,
  selectRedemptionProblems,
} from "@/lib/lessons";
import { getLessonProgress, hasEverCompleted } from "@/lib/progress";
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

  // Gate: a lesson is locked until the previous lesson in the curriculum is
  // complete. Direct navigation to a locked lesson bounces back home.
  const previousLessonId = getPreviousLessonId(lesson.id);
  if (previousLessonId) {
    const previousProgress = await getLessonProgress(
      supabase,
      user.id,
      previousLessonId
    );
    if (!hasEverCompleted(previousProgress)) {
      redirect("/home");
    }
  }

  const progress = await getLessonProgress(supabase, user.id, lesson.id);
  const lessonRun = selectLessonRun(lesson);
  const redemptionProblems = selectRedemptionProblems(lesson, lessonRun);

  return (
    <StepPlayer
      lesson={lessonRun}
      redemptionProblems={redemptionProblems}
      userId={user.id}
      initialStepIndex={progress.current_step_index}
    />
  );
}
