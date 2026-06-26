import { redirect } from "next/navigation";
import { PracticeSession } from "@/components/practice/PracticeSession";
import { getAllLessons } from "@/lib/lessons";
import { getLessonProgress, hasEverCompleted } from "@/lib/progress";
import { computeComfort } from "@/lib/comfort";
import { createClient } from "@/lib/supabase/server";
import {
  LESSON_TOPIC,
  type ComfortLevel,
  type PracticeTopic,
} from "@/types/practice";

export default async function PracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // The sandbox only generates questions for topics whose lesson has been
  // completed at least once.
  const lessons = getAllLessons();
  const progresses = await Promise.all(
    lessons.map((lesson) => getLessonProgress(supabase, user.id, lesson.id))
  );

  const allowedTopics: PracticeTopic[] = [];
  const topicComfort: Partial<
    Record<PracticeTopic, { level: ComfortLevel; score: number }>
  > = {};

  lessons.forEach((lesson, i) => {
    const topic = LESSON_TOPIC[lesson.id];
    if (!topic || !hasEverCompleted(progresses[i])) return;
    allowedTopics.push(topic);
    const comfort = computeComfort(
      progresses[i]?.last_duration_ms ?? null,
      lesson.estimatedMinutes
    );
    topicComfort[topic] = { level: comfort.level, score: comfort.score };
  });

  return (
    <PracticeSession allowedTopics={allowedTopics} topicComfort={topicComfort} />
  );
}
