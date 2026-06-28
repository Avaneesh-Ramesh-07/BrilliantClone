import { redirect } from "next/navigation";
import { PracticeTestRunner } from "@/components/sandbox/PracticeTestRunner";
import { createClient } from "@/lib/supabase/server";
import type { PracticeTestLesson } from "@/types/practice-test";

export const dynamic = "force-dynamic";

interface PracticeTestRunnerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PracticeTestRunnerPage({
  params,
}: PracticeTestRunnerPageProps) {
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

  const lesson = row.lesson_json as PracticeTestLesson;
  const problems = Array.isArray(lesson.practiceProblems)
    ? lesson.practiceProblems
    : [];

  // A practice test stored before the verified bank existed has no runner
  // payload; fall back to the shared lesson player so it still plays.
  if (problems.length === 0) redirect(`/sandbox/lesson/${id}`);

  return (
    <PracticeTestRunner
      lessonId={lesson.id}
      title={lesson.title}
      description={lesson.description}
      problems={problems}
      userId={user.id}
    />
  );
}
