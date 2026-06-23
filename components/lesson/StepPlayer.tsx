"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Dispatch } from "react";
import { FeedbackPanel } from "@/components/lesson/FeedbackPanel";
import { HintButton } from "@/components/lesson/HintButton";
import { StepProgressBar } from "@/components/lesson/StepProgressBar";
import { StepRenderer } from "@/components/lesson/StepRenderer";
import { defaultSliderValue } from "@/components/lesson/steps/SliderBalanceStep";
import { Button } from "@/components/ui/Button";
import { fireConfetti } from "@/lib/confetti";
import { getStepIndexById } from "@/lib/lessons";
import { computeMastery, isMasteryImpossible } from "@/lib/mastery";
import { recordStepAttempt, updateStepIndex, completeLesson } from "@/lib/progress";
import { updateStreak } from "@/lib/streak";
import { createClient } from "@/lib/supabase/client";
import type { FeedbackState, Lesson, Problem, Step } from "@/types/lesson";

interface StepPlayerProps {
  lesson: Lesson;
  userId: string;
  initialStepIndex: number;
}

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
  numericValue: string;
  sliderValue: number;
  selectedChoice: string | null;
  showChoiceResult: boolean;
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
  | { type: "NEXT_PROBLEM" }
  | { type: "REVEAL_HINT" }
  | { type: "SET_NUMERIC"; value: string }
  | { type: "SET_SLIDER"; value: number }
  | { type: "SET_CHOICE"; id: string }
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
    case "NEXT_PROBLEM":
      return {
        ...state,
        ...problemDefaults(),
        problemIndex: state.problemIndex + 1,
      };
    case "REVEAL_HINT":
      return { ...state, hintsRevealed: state.hintsRevealed + 1 };
    case "SET_NUMERIC":
      return { ...state, numericValue: action.value };
    case "SET_SLIDER":
      return { ...state, sliderValue: action.value };
    case "SET_CHOICE":
      return { ...state, selectedChoice: action.id };
    case "RESET_ATTEMPT":
      return {
        ...state,
        feedback: null,
        showChoiceResult: false,
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
    default:
      return null;
  }
}

function checkMastery(
  step: Step,
  firstAttempts: Record<string, boolean>,
  lesson: Lesson,
  dispatch: Dispatch<Action>,
  persistStepIndex: (index: number) => void
) {
  const mastery = computeMastery(step, firstAttempts);
  if (mastery.passed) {
    dispatch({ type: "MASTERY_PASS", partialNudge: mastery.partialMasteryMessage });
  } else {
    const fallbackIndex = getStepIndexById(
      lesson,
      mastery.fallbackStepId ?? step.fallbackStepId
    );
    const idx = fallbackIndex >= 0 ? fallbackIndex : 0;
    dispatch({
      type: "MASTERY_FAIL",
      message: mastery.fallbackMessage ?? step.fallbackMessage,
      fallbackIndex: idx,
    });
    persistStepIndex(idx);
  }
}

export function StepPlayer({
  lesson,
  userId,
  initialStepIndex,
}: StepPlayerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, dispatch] = useReducer(
    reducer,
    initialStepIndex,
    createInitialState
  );

  const step = lesson.steps[state.stepIndex];
  const problem = step.problems[state.problemIndex];
  const isLastProblem = state.problemIndex >= step.problems.length - 1;
  const isLastStep = Boolean(step.isLastStep);

  const persistStepIndex = useCallback(
    (index: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void updateStepIndex(supabase, userId, lesson.id, index);
      }, 500);
    },
    [supabase, userId, lesson.id]
  );

  useEffect(() => {
    persistStepIndex(state.stepIndex);
  }, [state.stepIndex, persistStepIndex]);

  const sliderDefault =
    problem.type === "slider-balance" ? defaultSliderValue(problem) : null;

  useEffect(() => {
    if (sliderDefault !== null) {
      dispatch({ type: "SET_SLIDER", value: sliderDefault });
    }
  }, [problem.id, state.stepIndex, state.problemIndex, sliderDefault]);

  const persistAttempt = useCallback(
    async (correct: boolean, hintsUsed: number, problemId: string, stepId: string) => {
      await recordStepAttempt(supabase, {
        userId,
        lessonId: lesson.id,
        stepId,
        problemId,
        correct,
        hintsUsed,
      });
    },
    [supabase, userId, lesson.id]
  );

  const afterCorrectLastProblem = useCallback(
    (updatedFirstAttempts: Record<string, boolean>) => {
      checkMastery(step, updatedFirstAttempts, lesson, dispatch, persistStepIndex);
    },
    [step, lesson, persistStepIndex]
  );

  // Regress as soon as mastery is mathematically out of reach, without waiting
  // for the learner to finish the remaining problems in the step.
  const maybeRegressEarly = useCallback(
    (updatedFirstAttempts: Record<string, boolean>): boolean => {
      if (!isMasteryImpossible(step, updatedFirstAttempts)) return false;
      const fallbackIndex = getStepIndexById(lesson, step.fallbackStepId);
      const idx = fallbackIndex >= 0 ? fallbackIndex : 0;
      dispatch({
        type: "MASTERY_FAIL",
        message: step.fallbackMessage,
        fallbackIndex: idx,
      });
      persistStepIndex(idx);
      return true;
    },
    [step, lesson, persistStepIndex]
  );

  const handleCheck = useCallback(async () => {
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

    if (result.isCorrect) {
      fireConfetti({ particleCount: 36, origin: { x: 0.5, y: 0.78 } });
    }

    if (result.isCorrect && isFirst) {
      await updateStreak(supabase, userId);
    }

    const updated = isFirst
      ? { ...state.firstAttempts, [problem.id]: result.isCorrect }
      : state.firstAttempts;

    if (isFirst && maybeRegressEarly(updated)) return;

    if (result.isCorrect && isLastProblem) {
      afterCorrectLastProblem(updated);
    }
  }, [
    problem,
    state.numericValue,
    state.sliderValue,
    state.selectedChoice,
    state.attemptCounts,
    state.firstAttempts,
    state.hintsRevealed,
    isLastProblem,
    step.id,
    persistAttempt,
    supabase,
    userId,
    afterCorrectLastProblem,
    maybeRegressEarly,
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
      fireConfetti({ particleCount: 36, origin: { x: 0.5, y: 0.78 } });

      if (isFirst) {
        await updateStreak(supabase, userId);
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
      isLastProblem,
      step.id,
      persistAttempt,
      supabase,
      userId,
      afterCorrectLastProblem,
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

      if (isFirst) {
        const updated = { ...state.firstAttempts, [problem.id]: false };
        maybeRegressEarly(updated);
      }
    },
    [
      problem.id,
      state.attemptCounts,
      state.firstAttempts,
      state.hintsRevealed,
      step.id,
      persistAttempt,
      maybeRegressEarly,
    ]
  );

  const goToPrevStep = useCallback(() => {
    if (state.stepIndex === 0) return;
    const prevIndex = state.stepIndex - 1;
    persistStepIndex(prevIndex);
    dispatch({ type: "PREV_STEP", prevIndex });
  }, [state.stepIndex, persistStepIndex]);

  const goToNextStep = useCallback(async () => {
    if (isLastStep) {
      await completeLesson(supabase, userId, lesson.id);
      router.push(`/lesson/${lesson.id}/complete`);
      return;
    }
    const nextIndex = state.stepIndex + 1;
    const banner = state.masteryBanner;
    persistStepIndex(nextIndex);
    dispatch({ type: "ADVANCE_STEP", nextIndex, banner });
  }, [
    isLastStep,
    lesson.id,
    router,
    state.stepIndex,
    state.masteryBanner,
    persistStepIndex,
    supabase,
    userId,
  ]);

  const handlePrimary = async () => {
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
      return;
    }

    if (state.problemSolved && isLastProblem && !state.masteryPassed) {
      return;
    }

    await handleCheck();
  };

  const buttonLabel = (() => {
    if (state.masteryPassed) return step.completionAction.buttonLabel;
    if (state.problemSolved && !isLastProblem) return "Continue →";
    if (state.feedback && !state.feedback.isCorrect) return "Try Again";
    return "Check Answer";
  })();

  const showButton =
    state.masteryPassed ||
    problem.type !== "drag-to-solve" ||
    (state.problemSolved && !isLastProblem);
  const buttonDisabled =
    !state.masteryPassed &&
    problem.type === "multiple-choice" &&
    !state.selectedChoice &&
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
        </div>
      </div>

      {state.masteryBanner && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary-light px-4 py-3">
          <p className="text-body text-primary">{state.masteryBanner}</p>
        </div>
      )}

      <h1 className="mt-6 font-heading text-heading-md text-text">
        {step.title}
      </h1>
      <p className="mt-3 text-body text-muted">{step.conceptFraming}</p>

      <div className="mt-6">
        <StepRenderer
          problem={problem}
          numericValue={state.numericValue}
          onNumericChange={(v) => dispatch({ type: "SET_NUMERIC", value: v })}
          sliderValue={state.sliderValue}
          onSliderChange={(v) => dispatch({ type: "SET_SLIDER", value: v })}
          selectedChoice={state.selectedChoice}
          onChoiceSelect={(id) => dispatch({ type: "SET_CHOICE", id })}
          onDragCorrect={handleDragCorrect}
          onDragIncorrect={handleDragIncorrect}
          onDragReset={() => dispatch({ type: "RESET_ATTEMPT" })}
          problemSolved={state.problemSolved}
          showChoiceResult={state.showChoiceResult}
          disabled={state.masteryPassed}
        />
      </div>

      {problem.type !== "drag-to-solve" && (
        <FeedbackPanel
          message={state.feedback?.message ?? ""}
          isCorrect={state.feedback?.isCorrect ?? false}
          visible={!!state.feedback}
        />
      )}

      {problem.type === "drag-to-solve" && state.feedback && !state.feedback.isCorrect && (
        <FeedbackPanel
          message={state.feedback.message}
          isCorrect={false}
          visible
        />
      )}

      <div className="sticky bottom-0 mt-auto flex flex-col gap-4 border-t border-border bg-bg pt-4">
        <HintButton
          hints={step.hints}
          hintsRevealed={state.hintsRevealed}
          onReveal={() => dispatch({ type: "REVEAL_HINT" })}
          canReveal={
            (state.attemptCounts[problem.id] ?? 0) > 0 && !state.problemSolved
          }
        />
        {showButton && (
          <Button
            type="button"
            fullWidth
            onClick={() => void handlePrimary()}
            disabled={buttonDisabled}
          >
            {buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
