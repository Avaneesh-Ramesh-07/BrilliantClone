import { redirect } from "next/navigation";
import { StepPlayer } from "@/components/lesson/StepPlayer";
import { selectLessonRun, selectRedemptionProblems } from "@/lib/lessons";
import { getLessonProgress } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";
import type { Lesson } from "@/types/lesson";

export const dynamic = "force-dynamic";

interface SandboxLessonPageProps {
  params: Promise<{ id: string }>;
}

export default async function SandboxLessonPage({
  params,
}: SandboxLessonPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("ai_lessons")
    .select("lesson_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) redirect("/home");

  const lesson = row.lesson_json as Lesson;
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
