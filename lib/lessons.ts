import lessonEquations from "@/content/lessons/lesson-equations.json";
import lessonGraphingLines from "@/content/lessons/lesson-graphing-lines.json";
import lessonQuadratics from "@/content/lessons/lesson-quadratics.json";
import { isGraded } from "@/lib/mastery";
import type { Lesson, Problem } from "@/types/lesson";

const LESSONS: Record<string, Lesson> = {
  "lesson-equations": lessonEquations as Lesson,
  "lesson-graphing-lines": lessonGraphingLines as Lesson,
  "lesson-quadratics": lessonQuadratics as Lesson,
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
export function selectStepProblems(
  problems: Problem[],
  present?: number,
  anchors: number = 1
): Problem[] {
  const keep = Math.max(1, Math.min(anchors, problems.length));
  if (!present || present >= problems.length) return problems;
  if (present <= keep) return problems.slice(0, keep);
  const head = problems.slice(0, keep);
  const rest = problems.slice(keep);
  const sampled = shuffle(rest).slice(0, present - keep);
  return [...head, ...sampled];
}

/**
 * Returns a copy of the lesson with each step's problems narrowed to a
 * randomized run-specific selection (see {@link selectStepProblems}).
 */
export function selectLessonRun(lesson: Lesson): Lesson {
  return {
    ...lesson,
    steps: lesson.steps.map((step) => {
      const selected = selectStepProblems(
        step.problems,
        step.present,
        step.anchors
      );
      // If this step has a throwback bank, pick one at random and slot it in just
      // AFTER the first graded question, never as the opening problem and never
      // last. This way a throwback only ever follows a real question (the engine
      // additionally gates it on answering that question correctly) and the final
      // problem stays graded so the step's mastery check always runs. If there's
      // no room for it to sit mid-sequence, skip the throwback for this run.
      if (step.throwbacks && step.throwbacks.length > 0) {
        const firstGraded = selected.findIndex(isGraded);
        if (firstGraded !== -1 && firstGraded < selected.length - 1) {
          const throwback = shuffle(step.throwbacks)[0];
          const insertAt = firstGraded + 1;
          return {
            ...step,
            problems: [
              ...selected.slice(0, insertAt),
              throwback,
              ...selected.slice(insertAt),
            ],
          };
        }
      }
      return { ...step, problems: selected };
    }),
  };
}

/**
 * Picks one "redemption" problem per step: a problem from the full bank that
 * isn't part of the presented run, so a learner who slips below mastery gets a
 * fresh question. Falls back to the last presented problem (or the anchor) when
 * the bank has no spare. Keyed by step id.
 */
export function selectRedemptionProblems(
  fullLesson: Lesson,
  run: Lesson
): Record<string, Problem> {
  const map: Record<string, Problem> = {};

  for (const step of fullLesson.steps) {
    const runStep = run.steps.find((s) => s.id === step.id);
    const shownIds = new Set((runStep?.problems ?? []).map((p) => p.id));
    // A redemption problem must be a graded question (never a guided demo), to
    // match the redemption behavior of every other lesson.
    const unseen = step.problems.filter(
      (p) => !shownIds.has(p.id) && isGraded(p)
    );
    const shownGraded = (runStep?.problems ?? []).filter(isGraded);

    const pick =
      (unseen.length > 0 ? shuffle(unseen)[0] : undefined) ??
      shownGraded[shownGraded.length - 1] ??
      runStep?.problems[runStep.problems.length - 1] ??
      step.problems[step.problems.length - 1];

    if (pick) map[step.id] = pick;
  }

  return map;
}

export function getAllLessons(): Lesson[] {
  return Object.values(LESSONS);
}

/** Lesson ids in their fixed curriculum order. */
export function getLessonOrder(): string[] {
  return Object.keys(LESSONS);
}

/** The lesson that must be completed before `id` unlocks, or null for the first. */
export function getPreviousLessonId(id: string): string | null {
  const order = getLessonOrder();
  const index = order.indexOf(id);
  return index > 0 ? order[index - 1] : null;
}

/** The lesson that follows `id` in the curriculum, or null if it's the last. */
export function getNextLessonId(id: string): string | null {
  const order = getLessonOrder();
  const index = order.indexOf(id);
  return index >= 0 && index < order.length - 1 ? order[index + 1] : null;
}

export function getStepIndexById(lesson: Lesson, stepId: string): number {
  return lesson.steps.findIndex((s) => s.id === stepId);
}
