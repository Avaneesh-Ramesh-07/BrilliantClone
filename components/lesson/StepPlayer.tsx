"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { revalidateProgressViews } from "@/app/actions";
import { FeedbackPanel } from "@/components/lesson/FeedbackPanel";
import { StepProgressBar } from "@/components/lesson/StepProgressBar";
import { StepRenderer } from "@/components/lesson/StepRenderer";
import { HelperInteractive } from "@/components/lesson/steps/HelperInteractive";
import { defaultSliderValue } from "@/components/lesson/steps/SliderBalanceStep";
import { Button } from "@/components/ui/Button";
import { getStepIndexById } from "@/lib/lessons";
import { computeMastery } from "@/lib/mastery";
import { recordStepAttempt, updateStepIndex, completeLesson } from "@/lib/progress";
import { updateStreak } from "@/lib/streak";
import { createClient } from "@/lib/supabase/client";
import type {
  FeedbackState,
  InteractiveHelper,
  Lesson,
  Problem,
} from "@/types/lesson";

interface StepPlayerProps {
  lesson: Lesson;
  /** One extra problem per step id, shown as a redemption chance before regressing. */
  redemptionProblems: Record<string, Problem>;
  userId: string;
  initialStepIndex: number;
}

const REDEMPTION_BANNER =
  "Not quite — here's one more problem. Get this one right to move on.";

interface EngineState {
  stepIndex: number;
  problemIndex: number;
  hintsRevealed: number;
  feedback: FeedbackState | null;
  firstAttempts: Record<string, boolean>;
  attemptCounts: Record<string, number>;
  masteryBanner: string | null;
  problemSolved: boolean;
  masteryPassed: boolean;
  /** When true, the learner is on their redemption problem for this step. */
  redemption: boolean;
  /**
   * When true, a redemption has been triggered but not yet entered: the learner
   * still sees the marking on the question that triggered it, plus an "I
   * understand" button that takes them to the redemption problem.
   */
  redemptionArmed: boolean;
  /**
   * Index of the regular problem that triggered the redemption, or null when the
   * redemption was triggered at the end of a step (below the mastery threshold).
   * On a successful redemption we resume right after this problem.
   */
  redemptionOriginIndex: number | null;
  numericValue: string;
  sliderValue: number;
  selectedChoice: string | null;
  showChoiceResult: boolean;
  /** Set when the learner checks an empty answer, asking them to enter one. */
  answerPrompt: string | null;
  /** Whether this question's conceptual hint is currently shown. */
  hintRevealed: boolean;
  /** Whether the reinforcement interactive is currently being shown. */
  helperActive: boolean;
  /** Whether the reinforcement interactive has been worked through. */
  helperDone: boolean;
}

type Action =
  | { type: "SUBMIT"; feedback: FeedbackState; problemId: string }
  | { type: "MASTERY_PASS"; partialNudge?: string }
  | {
      type: "MASTERY_FAIL";
      message: string;
      fallbackIndex: number;
    }
  | { type: "ADVANCE_STEP"; nextIndex: number; banner?: string | null }
  | { type: "PREV_STEP"; prevIndex: number }
  | { type: "ARM_REDEMPTION"; originIndex: number | null }
  | { type: "ENTER_REDEMPTION"; message: string; originIndex: number | null }
  | {
      type: "REDEEM_NEXT_PROBLEM";
      problemIndex: number;
      firstAttempts: Record<string, boolean>;
    }
  | { type: "NEXT_PROBLEM" }
  | { type: "SET_NUMERIC"; value: string }
  | { type: "SET_SLIDER"; value: number }
  | { type: "SET_CHOICE"; id: string }
  | { type: "PROMPT_ANSWER"; message: string }
  | { type: "REVEAL_HINT" }
  | { type: "ACTIVATE_HELPER" }
  | { type: "HELPER_DONE" }
  | { type: "RESET_ATTEMPT" };

function problemDefaults(): Pick<
  EngineState,
  | "hintsRevealed"
  | "feedback"
  | "problemSolved"
  | "masteryPassed"
  | "numericValue"
  | "sliderValue"
  | "selectedChoice"
  | "showChoiceResult"
  | "answerPrompt"
  | "hintRevealed"
  | "helperActive"
  | "helperDone"
> {
  return {
    hintsRevealed: 0,
    feedback: null,
    problemSolved: false,
    masteryPassed: false,
    numericValue: "",
    sliderValue: 5,
    selectedChoice: null,
    showChoiceResult: false,
    answerPrompt: null,
    hintRevealed: false,
    helperActive: false,
    helperDone: false,
  };
}

function createInitialState(stepIndex: number): EngineState {
  return {
    stepIndex,
    problemIndex: 0,
    ...problemDefaults(),
    firstAttempts: {},
    attemptCounts: {},
    masteryBanner: null,
    redemption: false,
    redemptionArmed: false,
    redemptionOriginIndex: null,
  };
}

function reducer(state: EngineState, action: Action): EngineState {
  switch (action.type) {
    case "SUBMIT": {
      const count = (state.attemptCounts[action.problemId] ?? 0) + 1;
      return {
        ...state,
        feedback: action.feedback,
        problemSolved: action.feedback.isCorrect,
        showChoiceResult: true,
        answerPrompt: null,
        attemptCounts: {
          ...state.attemptCounts,
          [action.problemId]: count,
        },
        firstAttempts:
          count === 1
            ? {
                ...state.firstAttempts,
                [action.problemId]: action.feedback.isCorrect,
              }
            : state.firstAttempts,
      };
    }
    case "MASTERY_PASS":
      return {
        ...state,
        masteryPassed: true,
        masteryBanner: action.partialNudge ?? state.masteryBanner,
      };
    case "MASTERY_FAIL":
      return {
        ...createInitialState(action.fallbackIndex),
        masteryBanner: action.message,
      };
    case "ADVANCE_STEP":
      return {
        ...createInitialState(action.nextIndex),
        masteryBanner: action.banner ?? null,
        firstAttempts: {},
        attemptCounts: {},
      };
    case "PREV_STEP":
      return createInitialState(action.prevIndex);
    case "ARM_REDEMPTION":
      // Keep the current feedback/marking visible; just record that a redemption
      // is queued so the UI can offer an "I understand" button.
      return {
        ...state,
        redemptionArmed: true,
        redemptionOriginIndex: action.originIndex,
      };
    case "ENTER_REDEMPTION":
      return {
        ...state,
        ...problemDefaults(),
        redemption: true,
        redemptionArmed: false,
        redemptionOriginIndex: action.originIndex,
        masteryBanner: action.message,
      };
    case "REDEEM_NEXT_PROBLEM":
      // Successful mid-step redemption: clear the redemption state and resume at
      // the problem that would have followed the recovered question.
      return {
        ...state,
        ...problemDefaults(),
        redemption: false,
        redemptionArmed: false,
        redemptionOriginIndex: null,
        masteryBanner: null,
        problemIndex: action.problemIndex,
        firstAttempts: action.firstAttempts,
      };
    case "NEXT_PROBLEM":
      return {
        ...state,
        ...problemDefaults(),
        redemptionArmed: false,
        problemIndex: state.problemIndex + 1,
      };
    case "SET_NUMERIC":
      return { ...state, numericValue: action.value, answerPrompt: null };
    case "SET_SLIDER":
      return { ...state, sliderValue: action.value, answerPrompt: null };
    case "SET_CHOICE":
      return { ...state, selectedChoice: action.id, answerPrompt: null };
    case "PROMPT_ANSWER":
      return { ...state, answerPrompt: action.message };
    case "REVEAL_HINT":
      return { ...state, hintRevealed: true };
    case "ACTIVATE_HELPER":
      return { ...state, helperActive: true };
    case "HELPER_DONE":
      // The interactive has been worked through. Clear the attempt so the
      // learner can answer the question fresh; keep the hint visible.
      return {
        ...state,
        helperActive: false,
        helperDone: true,
        feedback: null,
        showChoiceResult: false,
        answerPrompt: null,
        numericValue: "",
        selectedChoice: null,
      };
    case "RESET_ATTEMPT":
      return {
        ...state,
        feedback: null,
        showChoiceResult: false,
        answerPrompt: null,
      };
    default:
      return state;
  }
}

function validateProblem(
  problem: Problem,
  numericValue: string,
  selectedChoice: string | null,
  sliderValue: number
): FeedbackState | null {
  switch (problem.type) {
    case "numeric-input": {
      const parsed = parseFloat(numericValue);
      const correct = !isNaN(parsed) && parsed === problem.answer;
      return {
        message: correct
          ? problem.feedback.correct
          : (problem.feedback.incorrect ?? "Try again."),
        isCorrect: correct,
      };
    }
    case "slider-balance": {
      const correct = sliderValue === problem.answer;
      return {
        message: correct
          ? problem.feedback.correct
          : (problem.feedback.incorrect ?? "Try again."),
        isCorrect: correct,
      };
    }
    case "multiple-choice": {
      if (!selectedChoice) return null;
      const option = problem.options.find((o) => o.id === selectedChoice);
      const correct = option?.correct ?? false;
      return {
        message: correct
          ? problem.feedback.correct
          : (problem.feedback.incorrect ?? "Try again."),
        isCorrect: correct,
      };
    }
    case "graph-intercept": {
      const correct = sliderValue === (problem.targetX ?? 0);
      return {
        message: correct
          ? problem.feedback.correct
          : (problem.feedback.incorrect ??
            "Slide the ball to x = 0 (the y-axis) first, then check."),
        isCorrect: correct,
      };
    }
    default:
      return null;
  }
}

export function StepPlayer({
  lesson,
  redemptionProblems,
  userId,
  initialStepIndex,
}: StepPlayerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When the current attempt started, used to record solve time per attempt
  // (internal analytics only — never surfaced to the learner as a timer).
  const attemptStartRef = useRef<number>(Date.now());

  const [state, dispatch] = useReducer(
    reducer,
    initialStepIndex,
    createInitialState
  );

  const step = lesson.steps[state.stepIndex];
  const redemptionProblem = redemptionProblems[step.id];
  const problem =
    state.redemption && redemptionProblem
      ? redemptionProblem
      : step.problems[state.problemIndex];
  const isLastProblem = state.problemIndex >= step.problems.length - 1;
  const isLastStep = Boolean(step.isLastStep);
  // Demo problems are guided walkthroughs: they never gate progress or trigger
  // the redemption/regression flow.
  const isDemo =
    (problem.type === "drag-to-solve" ||
      problem.type === "isolate-blocks" ||
      problem.type === "graph-intercept" ||
      problem.type === "slope-race" ||
      problem.type === "plot-point") &&
    problem.demo === true;
  // Interactive demos drive their own primary action (drag / tap / play /
  // click), so the bottom "Check Answer" button only appears once solved.
  const isInteractiveDemo =
    problem.type === "drag-to-solve" ||
    problem.type === "isolate-blocks" ||
    problem.type === "slope-race" ||
    problem.type === "plot-point";

  // The reinforcement interactive for this question (per-question override, else
  // the step's interactive) and the question's conceptual hint, if any.
  const activeInteractive: InteractiveHelper | undefined =
    ("interactive" in problem ? problem.interactive : undefined) ??
    step.interactive;
  const problemHint =
    "hint" in problem && typeof problem.hint === "string"
      ? problem.hint
      : undefined;

  const persistStepIndex = useCallback(
    (index: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void updateStepIndex(supabase, userId, lesson.id, index);
      }, 500);
    },
    [supabase, userId, lesson.id]
  );

  const didMountRef = useRef(false);
  useEffect(() => {
    // Skip the initial mount: the starting step comes from the server, and every
    // in-lesson transition (advance, back, fallback, exit) persists explicitly.
    // Auto-saving on mount would overwrite real progress if the page ever
    // rendered a stale step index (e.g. from the client Router Cache).
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    persistStepIndex(state.stepIndex);
  }, [state.stepIndex, persistStepIndex]);

  const sliderDefault =
    problem.type === "slider-balance"
      ? defaultSliderValue(problem)
      : problem.type === "graph-intercept"
        ? (problem.xDefault ??
          Math.max(
            problem.xMin,
            Math.min(problem.xMax, (problem.targetX ?? 0) + 3)
          ))
        : null;

  useEffect(() => {
    if (sliderDefault !== null) {
      dispatch({ type: "SET_SLIDER", value: sliderDefault });
    }
    // Start (or restart) the solve timer whenever a new problem is shown.
    attemptStartRef.current = Date.now();
  }, [problem.id, state.stepIndex, state.problemIndex, sliderDefault]);

  const persistAttempt = useCallback(
    async (correct: boolean, hintsUsed: number, problemId: string, stepId: string) => {
      // Cap at 5 minutes so an idle/backgrounded tab doesn't skew comfort stats.
      const durationMs = Math.min(
        Math.max(Date.now() - attemptStartRef.current, 0),
        5 * 60 * 1000
      );
      await recordStepAttempt(supabase, {
        userId,
        lessonId: lesson.id,
        stepId,
        problemId,
        correct,
        hintsUsed,
        durationMs,
      });
    },
    [supabase, userId, lesson.id]
  );

  // Bump the learner back to the fallback step (used when a redemption problem
  // is also missed).
  const failToFallback = useCallback(() => {
    const fallbackIndex = getStepIndexById(lesson, step.fallbackStepId);
    const idx = fallbackIndex >= 0 ? fallbackIndex : 0;
    dispatch({
      type: "MASTERY_FAIL",
      message: step.fallbackMessage,
      fallbackIndex: idx,
    });
    persistStepIndex(idx);
  }, [lesson, step.fallbackStepId, step.fallbackMessage, persistStepIndex]);

  const afterCorrectLastProblem = useCallback(
    (updatedFirstAttempts: Record<string, boolean>) => {
      const mastery = computeMastery(step, updatedFirstAttempts);
      if (mastery.passed) {
        dispatch({
          type: "MASTERY_PASS",
          partialNudge: mastery.partialMasteryMessage,
        });
      } else {
        // Below threshold at the end of the step: arm a redemption problem
        // before regressing. The learner sees the marking on this question and
        // taps "I understand" to move on. Passing redemption advances the step.
        dispatch({ type: "ARM_REDEMPTION", originIndex: null });
      }
    },
    [step]
  );

  const goToPrevStep = useCallback(() => {
    if (state.stepIndex === 0) return;
    const prevIndex = state.stepIndex - 1;
    persistStepIndex(prevIndex);
    dispatch({ type: "PREV_STEP", prevIndex });
  }, [state.stepIndex, persistStepIndex]);

  // Leave the lesson and return home, saving the current step so the learner
  // resumes where they left off. We flush the (debounced) save immediately so
  // progress is persisted even if they navigate away right away, then revalidate
  // the Home/Mastery caches so they re-fetch the saved progress instead of
  // serving a stale cached render (which would reset the steps-completed count).
  const exitLesson = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await updateStepIndex(supabase, userId, lesson.id, state.stepIndex);
    await revalidateProgressViews();
    router.push("/home");
  }, [supabase, userId, lesson.id, state.stepIndex, router]);

  const goToNextStep = useCallback(async () => {
    if (isLastStep) {
      await completeLesson(supabase, userId, lesson.id);
      await revalidateProgressViews();
      router.push(`/lesson/${lesson.id}/complete`);
      return;
    }
    const nextIndex = state.stepIndex + 1;
    // Don't carry the redemption prompt into the next step.
    const banner = state.redemption ? null : state.masteryBanner;
    persistStepIndex(nextIndex);
    dispatch({ type: "ADVANCE_STEP", nextIndex, banner });
  }, [
    isLastStep,
    lesson.id,
    router,
    state.stepIndex,
    state.masteryBanner,
    state.redemption,
    persistStepIndex,
    supabase,
    userId,
  ]);

  // Called once a redemption problem has been answered correctly. Instead of
  // jumping straight to the next step, resume the normal flow at whatever
  // problem would have come next had the original question been answered right.
  const advanceAfterRedemption = useCallback(() => {
    const origin = state.redemptionOriginIndex;
    // End-of-step redemption (fell below the mastery threshold) → next step.
    if (origin === null) {
      void goToNextStep();
      return;
    }
    // Mid-step redemption: treat the missed question as recovered and continue.
    const originProblem = step.problems[origin];
    const repaired = { ...state.firstAttempts, [originProblem.id]: true };
    const nextIndex = origin + 1;
    if (nextIndex <= step.problems.length - 1) {
      dispatch({
        type: "REDEEM_NEXT_PROBLEM",
        problemIndex: nextIndex,
        firstAttempts: repaired,
      });
    } else {
      // The missed question was the last one — completing the redemption
      // finishes the step.
      void goToNextStep();
    }
  }, [state.redemptionOriginIndex, state.firstAttempts, step, goToNextStep]);

  // Scaffolding after a wrong (non-redemption) answer:
  //   1st miss  → reveal the conceptual hint.
  //   2nd miss  → surface the step's reinforcement interactive (if any) to
  //               rebuild understanding; otherwise arm the redemption flow.
  //   later     → once the interactive has been worked through, fall back to
  //               the usual redemption flow.
  // Demos are exempt — they're guided walkthroughs, not graded questions.
  const escalateAfterWrong = useCallback(
    (attemptNum: number) => {
      if (isDemo) return;
      const hasHint =
        "hint" in problem &&
        typeof problem.hint === "string" &&
        problem.hint.trim().length > 0;
      const interactive =
        ("interactive" in problem ? problem.interactive : undefined) ??
        step.interactive;

      if (attemptNum === 1) {
        if (hasHint) dispatch({ type: "REVEAL_HINT" });
        return;
      }
      if (interactive && !state.helperDone) {
        dispatch({ type: "ACTIVATE_HELPER" });
        return;
      }
      dispatch({ type: "ARM_REDEMPTION", originIndex: state.problemIndex });
    },
    [problem, step.interactive, isDemo, state.helperDone, state.problemIndex]
  );

  const handleCheck = useCallback(async () => {
    // Require a value before checking a numeric problem; a blank submission
    // shouldn't count as a wrong attempt — nudge the learner instead.
    if (problem.type === "numeric-input" && state.numericValue.trim() === "") {
      dispatch({
        type: "PROMPT_ANSWER",
        message: "Enter an answer to check — or tap \u201cI don\u2019t know\u201d.",
      });
      return;
    }

    const result = validateProblem(
      problem,
      state.numericValue,
      state.selectedChoice,
      state.sliderValue
    );
    if (!result) return;

    const isFirst = (state.attemptCounts[problem.id] ?? 0) === 0;
    dispatch({ type: "SUBMIT", feedback: result, problemId: problem.id });
    await persistAttempt(result.isCorrect, state.hintsRevealed, problem.id, step.id);

    if (result.isCorrect && isFirst) {
      await updateStreak(supabase, userId);
    }

    if (state.redemption) {
      // One shot: a miss regresses immediately; a correct answer waits for the
      // learner to press Continue (handled in handlePrimary).
      if (!result.isCorrect) failToFallback();
      return;
    }

    if (result.isCorrect) {
      if (isLastProblem) {
        const updated = isFirst
          ? { ...state.firstAttempts, [problem.id]: true }
          : state.firstAttempts;
        afterCorrectLastProblem(updated);
      }
      return;
    }

    // Wrong answer. Surface a hint, then a reinforcement interactive, then the
    // redemption flow as the learner keeps missing the same question.
    escalateAfterWrong((state.attemptCounts[problem.id] ?? 0) + 1);
  }, [
    problem,
    state.numericValue,
    state.sliderValue,
    state.selectedChoice,
    state.attemptCounts,
    state.firstAttempts,
    state.hintsRevealed,
    state.redemption,
    isLastProblem,
    isDemo,
    step.id,
    persistAttempt,
    supabase,
    userId,
    afterCorrectLastProblem,
    failToFallback,
    escalateAfterWrong,
  ]);

  // "I don't know" — explicitly give up on the current problem. This produces
  // the same outcome as submitting a wrong answer (counts against mastery, can
  // trigger the redemption / regression flow).
  const handleGiveUp = useCallback(async () => {
    let incorrectMsg = "That's okay — review the explanation and keep going.";
    if (
      problem.type === "numeric-input" ||
      problem.type === "slider-balance" ||
      problem.type === "multiple-choice"
    ) {
      incorrectMsg = problem.feedback.incorrect ?? incorrectMsg;
    }
    const result: FeedbackState = { message: incorrectMsg, isCorrect: false };

    dispatch({ type: "SUBMIT", feedback: result, problemId: problem.id });
    await persistAttempt(false, state.hintsRevealed, problem.id, step.id);

    if (state.redemption) {
      failToFallback();
      return;
    }

    escalateAfterWrong((state.attemptCounts[problem.id] ?? 0) + 1);
  }, [
    problem,
    state.attemptCounts,
    state.hintsRevealed,
    state.redemption,
    isDemo,
    step.id,
    persistAttempt,
    failToFallback,
    escalateAfterWrong,
  ]);

  const handleDragCorrect = useCallback(
    async (feedbackMsg: string) => {
      const isFirst = (state.attemptCounts[problem.id] ?? 0) === 0;
      dispatch({
        type: "SUBMIT",
        feedback: { message: feedbackMsg, isCorrect: true },
        problemId: problem.id,
      });
      await persistAttempt(true, state.hintsRevealed, problem.id, step.id);

      if (isFirst) {
        await updateStreak(supabase, userId);
      }

      if (state.redemption) {
        advanceAfterRedemption();
        return;
      }

      if (isLastProblem) {
        const updated = {
          ...state.firstAttempts,
          [problem.id]: isFirst ? true : (state.firstAttempts[problem.id] ?? false),
        };
        afterCorrectLastProblem(updated);
      }
    },
    [
      problem.id,
      state.attemptCounts,
      state.firstAttempts,
      state.hintsRevealed,
      state.redemption,
      isLastProblem,
      step.id,
      persistAttempt,
      supabase,
      userId,
      afterCorrectLastProblem,
      advanceAfterRedemption,
    ]
  );

  const handleDragIncorrect = useCallback(
    async (feedbackMsg: string) => {
      const isFirst = (state.attemptCounts[problem.id] ?? 0) === 0;
      dispatch({
        type: "SUBMIT",
        feedback: { message: feedbackMsg, isCorrect: false },
        problemId: problem.id,
      });
      await persistAttempt(false, state.hintsRevealed, problem.id, step.id);

      if (state.redemption) {
        failToFallback();
        return;
      }

      // Two misses on the same problem trigger the redemption flow (demos are
      // exempt — they're just guided walkthroughs).
      if (!isFirst && !isDemo) {
        dispatch({ type: "ARM_REDEMPTION", originIndex: state.problemIndex });
      }
    },
    [
      problem.id,
      state.attemptCounts,
      state.hintsRevealed,
      state.redemption,
      state.problemIndex,
      isDemo,
      step.id,
      persistAttempt,
      failToFallback,
    ]
  );

  // A redemption answered correctly resumes the normal flow (next problem, or
  // next step if the missed question was the last / it was an end-of-step
  // redemption) rather than always jumping to the next step.
  const redemptionGoesToNextStep =
    state.redemptionOriginIndex === null ||
    state.redemptionOriginIndex >= step.problems.length - 1;

  const handlePrimary = async () => {
    // A redemption is queued: let the learner acknowledge the marking on the
    // triggering question, then enter the redemption problem.
    if (state.redemptionArmed) {
      dispatch({
        type: "ENTER_REDEMPTION",
        message: REDEMPTION_BANNER,
        originIndex: state.redemptionOriginIndex,
      });
      attemptStartRef.current = Date.now();
      return;
    }

    if (state.redemption && state.problemSolved) {
      advanceAfterRedemption();
      return;
    }

    if (state.masteryPassed) {
      goToNextStep();
      return;
    }

    if (state.problemSolved && !isLastProblem) {
      dispatch({ type: "NEXT_PROBLEM" });
      return;
    }

    if (state.feedback && !state.feedback.isCorrect) {
      dispatch({ type: "RESET_ATTEMPT" });
      attemptStartRef.current = Date.now();
      return;
    }

    if (state.problemSolved && isLastProblem && !state.masteryPassed) {
      return;
    }

    await handleCheck();
  };

  const buttonLabel = (() => {
    if (state.redemptionArmed) return "I understand";
    if (state.redemption && state.problemSolved) {
      return redemptionGoesToNextStep
        ? step.completionAction.buttonLabel
        : "Continue →";
    }
    if (state.masteryPassed) return step.completionAction.buttonLabel;
    if (state.problemSolved && !isLastProblem) return "Continue →";
    if (state.feedback && !state.feedback.isCorrect) return "Try Again";
    return "Check Answer";
  })();

  const showButton =
    state.masteryPassed ||
    state.redemptionArmed ||
    !isInteractiveDemo ||
    (state.problemSolved && !isLastProblem);
  const buttonDisabled =
    !state.masteryPassed &&
    !state.redemptionArmed &&
    problem.type === "multiple-choice" &&
    !state.selectedChoice &&
    !state.problemSolved;

  // Offer an explicit "I don't know" escape while the learner is still on a
  // fresh attempt of an answerable, graded problem (never on guided demos).
  const showGiveUp =
    !isInteractiveDemo &&
    !isDemo &&
    buttonLabel === "Check Answer" &&
    !state.masteryPassed &&
    !state.problemSolved;

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-bg/85 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goToPrevStep}
            disabled={state.stepIndex === 0}
            aria-label="Go to previous step"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-border/60 hover:text-text disabled:pointer-events-none disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="flex-1">
            <StepProgressBar
              current={state.stepIndex + 1}
              total={lesson.totalSteps}
            />
          </div>
          <button
            type="button"
            onClick={() => void exitLesson()}
            aria-label="Exit lesson and save progress"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-label font-semibold text-muted transition-colors hover:border-border hover:bg-border/40 hover:text-text"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
              <path
                d="M16 17l5-5-5-5M21 12H9M12 19H6a2 2 0 01-2-2V7a2 2 0 012-2h6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Exit
          </button>
        </div>
      </div>

      {state.masteryBanner && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 ${
            state.redemption
              ? "border-amber-300 bg-amber-50"
              : "border-primary/30 bg-primary-light"
          }`}
        >
          <p
            className={`text-body ${
              state.redemption ? "text-amber-700" : "text-primary"
            }`}
          >
            {state.masteryBanner}
          </p>
        </div>
      )}

      <h1 className="mt-6 font-heading text-heading-md text-text">
        {step.title}
      </h1>
      <p className="mt-3 text-body text-muted">{step.conceptFraming}</p>

      {isDemo && !state.redemption && (
        <div className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full border border-primary/30 bg-primary-light px-3 py-1 text-label font-semibold text-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M8 5v14l11-7z"
              fill="currentColor"
            />
          </svg>
          Demo — walkthrough
        </div>
      )}

      {state.redemption && (
        <div className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-label font-semibold text-amber-700">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M12 3v18M3 12h18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          Redemption question
        </div>
      )}

      {state.helperActive && activeInteractive ? (
        <HelperInteractive
          key={`helper:${state.stepIndex}:${state.problemIndex}:${problem.id}`}
          problem={activeInteractive}
          onDismiss={() => dispatch({ type: "HELPER_DONE" })}
        />
      ) : (
        <>
          <div className="mt-6">
            <StepRenderer
              key={`${state.stepIndex}:${state.problemIndex}:${
                state.redemption ? "r" : "n"
              }:${problem.id}`}
              problem={problem}
              numericValue={state.numericValue}
              onNumericChange={(v) =>
                dispatch({ type: "SET_NUMERIC", value: v })
              }
              sliderValue={state.sliderValue}
              onSliderChange={(v) => dispatch({ type: "SET_SLIDER", value: v })}
              selectedChoice={state.selectedChoice}
              onChoiceSelect={(id) => dispatch({ type: "SET_CHOICE", id })}
              onDragCorrect={handleDragCorrect}
              onDragIncorrect={handleDragIncorrect}
              onDragReset={() => dispatch({ type: "RESET_ATTEMPT" })}
              problemSolved={state.problemSolved}
              showChoiceResult={state.showChoiceResult}
              disabled={state.masteryPassed || state.redemptionArmed}
            />
          </div>

          {problem.type !== "drag-to-solve" &&
            problem.type !== "isolate-blocks" &&
            problem.type !== "slope-race" &&
            problem.type !== "plot-point" && (
              <FeedbackPanel
                message={state.feedback?.message ?? ""}
                isCorrect={state.feedback?.isCorrect ?? false}
                visible={!!state.feedback}
              />
            )}

          {problem.type === "drag-to-solve" &&
            state.feedback &&
            !state.feedback.isCorrect && (
              <FeedbackPanel
                message={state.feedback.message}
                isCorrect={false}
                visible
              />
            )}

          {state.hintRevealed && problemHint && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                aria-hidden
              >
                <path
                  d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.6.45 1 1.15 1.1 1.95h5c.1-.8.5-1.5 1.1-1.95A6 6 0 0012 3z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div>
                <p className="text-label font-semibold text-amber-700">Hint</p>
                <p className="text-body text-amber-700/90">{problemHint}</p>
              </div>
            </div>
          )}

          {state.helperDone &&
            !state.feedback &&
            !state.problemSolved &&
            !state.redemptionArmed && (
              <p className="mt-4 text-center text-label font-medium text-primary">
                Now give the question another try.
              </p>
            )}
        </>
      )}

      <div className="sticky bottom-0 mt-auto flex flex-col gap-4 border-t border-border bg-bg pt-4">
        {state.answerPrompt && (
          <p className="text-center text-label font-medium text-amber-700">
            {state.answerPrompt}
          </p>
        )}
        {showButton && !state.helperActive && (
          <Button
            type="button"
            fullWidth
            onClick={() => void handlePrimary()}
            disabled={buttonDisabled}
          >
            {buttonLabel}
          </Button>
        )}
        {showGiveUp && !state.helperActive && (
          <button
            type="button"
            onClick={() => void handleGiveUp()}
            className="text-center text-label font-semibold text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
          >
            I don&apos;t know
          </button>
        )}
      </div>
    </div>
  );
}
