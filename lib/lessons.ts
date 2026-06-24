import lessonEquations from "@/content/lessons/lesson-equations.json";
import lessonGraphingLines from "@/content/lessons/lesson-graphing-lines.json";
import lessonQuadraticFactoring from "@/content/lessons/lesson-quadratic-factoring.json";
import type { Lesson, Problem } from "@/types/lesson";

const LESSONS: Record<string, Lesson> = {
  "lesson-equations": lessonEquations as Lesson,
  "lesson-graphing-lines": lessonGraphingLines as Lesson,
  "lesson-quadratic-factoring": lessonQuadraticFactoring as Lesson,
};

export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id];
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks the problems to present for a single run of a step. The first problem
 * is treated as the teaching anchor and is always kept; the remaining slots are
 * filled by randomly sampling the rest of the bank. Call this per lesson load
 * so restarting (or revisiting) surfaces a different mix of practice problems.
 */
export function selectStepProblems(problems: Problem[], present?: number): Problem[] {
  if (!present || present >= problems.length) return problems;
  if (present <= 1) return problems.slice(0, 1);
  const [anchor, ...rest] = problems;
  const sampled = shuffle(rest).slice(0, present - 1);
  return [anchor, ...sampled];
}

/**
 * Returns a copy of the lesson with each step's problems narrowed to a
 * randomized run-specific selection (see {@link selectStepProblems}).
 */
export function selectLessonRun(lesson: Lesson): Lesson {
  return {
    ...lesson,
    steps: lesson.steps.map((step) => ({
      ...step,
      problems: selectStepProblems(step.problems, step.present),
    })),
  };
}

export function getAllLessons(): Lesson[] {
  return Object.values(LESSONS);
}

export function getStepIndexById(lesson: Lesson, stepId: string): number {
  return lesson.steps.findIndex((s) => s.id === stepId);
}
