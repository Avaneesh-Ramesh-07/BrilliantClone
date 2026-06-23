import lessonEquations from "@/content/lessons/lesson-equations.json";
import type { Lesson } from "@/types/lesson";

const LESSONS: Record<string, Lesson> = {
  "lesson-equations": lessonEquations as Lesson,
};

export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id];
}

export function getAllLessons(): Lesson[] {
  return Object.values(LESSONS);
}

export function getStepIndexById(lesson: Lesson, stepId: string): number {
  return lesson.steps.findIndex((s) => s.id === stepId);
}
