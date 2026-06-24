"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { FeedbackPanel } from "@/components/lesson/FeedbackPanel";
import { HintButton } from "@/components/lesson/HintButton";
import { StepProgressBar } from "@/components/lesson/StepProgressBar";
import { StepRenderer } from "@/components/lesson/StepRenderer";
import { defaultSliderValue } from "@/components/lesson/steps/SliderBalanceStep";
import { Button } from "@/components/ui/Button";
import { fireConfetti } from "@/lib/confetti";
import { getStepIndexById } from "@/lib/lessons";
import { computeMastery } from "@/lib/mastery";
import { recordStepAttempt, updateStepIndex, completeLesson } from "@/lib/progress";
import { updateStreak } from "@/lib/streak";
import { createClient } from "@/lib/supabase/client";
import type { FeedbackState, Lesson, Problem } from "@/types/lesson";

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
   * Index of the regular problem that triggered the redemption, or null when the
   * redemption was triggered at the end of a step (below the mastery threshold).
   * On a successful redemption we resume right after this problem.
   */
  redemptionOriginIndex: number | null;
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
  | { type: "ENTER_REDEMPTION"; message: string; originIndex: number | null }
  | {
      type: "REDEEM_NEXT_PROBLEM";
      problemIndex: number;
      firstAttempts: Record<string, boolean>;
    }
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
    redemption: false,
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
    case "ENTER_REDEMPTION":
      return {
        ...state,
        ...problemDefaults(),
        redemption: true,
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
        redemptionOriginIndex: null,
        masteryBanner: null,
        problemIndex: action.problemIndex,
        firstAttempts: action.firstAttempts,
      };
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
  const isDemo = problem.type === "drag-to-solve" && problem.demo === true;

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
        // Below threshold at the end of the step: offer a redemption problem
        // before regressing. Passing it progresses to the next step.
        dispatch({
          type: "ENTER_REDEMPTION",
          message: REDEMPTION_BANNER,
          originIndex: null,
        });
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

  const goToNextStep = useCallback(async () => {
    if (isLastStep) {
      await completeLesson(supabase, userId, lesson.id);
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

    // Wrong answer. Missing the same question twice triggers the redemption
    // flow regardless of the mastery threshold (demos are exempt).
    if (!isFirst && !isDemo) {
      dispatch({
        type: "ENTER_REDEMPTION",
        message: REDEMPTION_BANNER,
        originIndex: state.problemIndex,
      });
    }
  }, [
    problem,
    state.numericValue,
    state.sliderValue,
    state.selectedChoice,
    state.attemptCounts,
    state.firstAttempts,
    state.hintsRevealed,
    state.redemption,
    state.problemIndex,
    isLastProblem,
    isDemo,
    step.id,
    persistAttempt,
    supabase,
    userId,
    afterCorrectLastProblem,
    failToFallback,
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
        dispatch({
          type: "ENTER_REDEMPTION",
          message: REDEMPTION_BANNER,
          originIndex: state.problemIndex,
        });
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
