"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Dispatch } from "react";
import { FeedbackPanel } from "@/components/lesson/FeedbackPanel";
import { HintButton } from "@/components/lesson/HintButton";
import { StepProgressBar } from "@/components/lesson/StepProgressBar";
import { StepRenderer } from "@/components/lesson/StepRenderer";
import { Button } from "@/components/ui/Button";
import { getStepIndexById } from "@/lib/lessons";
import { computeMastery } from "@/lib/mastery";
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
  | { type: "NEXT_PROBLEM" }
  | { type: "REVEAL_HINT" }
  | { type: "SET_NUMERIC"; value: string }
  | { type: "SET_CHOICE"; id: string }
  | { type: "RESET_ATTEMPT" };

function problemDefaults(): Pick<
  EngineState,
  | "hintsRevealed"
  | "feedback"
  | "problemSolved"
  | "masteryPassed"
  | "numericValue"
  | "selectedChoice"
  | "showChoiceResult"
> {
  return {
    hintsRevealed: 0,
    feedback: null,
    problemSolved: false,
    masteryPassed: false,
    numericValue: "",
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
  selectedChoice: string | null
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
  // #region agent log
  fetch("http://127.0.0.1:7317/ingest/5ca51102-074a-497f-a02f-436942c7f190", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "427e58",
    },
    body: JSON.stringify({
      sessionId: "427e58",
      runId: "step-advance",
      hypothesisId: "H1-H2",
      location: "StepPlayer.tsx:checkMastery",
      message: "mastery computed",
      data: {
        stepId: step.id,
        passed: mastery.passed,
        rate: mastery.rate,
        threshold: step.masteryThreshold,
        firstAttempts,
        problemIds: step.problems.map((p) => p.id),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
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

  const handleCheck = useCallback(async () => {
    const result = validateProblem(
      problem,
      state.numericValue,
      state.selectedChoice
    );
    if (!result) return;

    const isFirst = (state.attemptCounts[problem.id] ?? 0) === 0;
    dispatch({ type: "SUBMIT", feedback: result, problemId: problem.id });
    await persistAttempt(result.isCorrect, state.hintsRevealed, problem.id, step.id);

    if (result.isCorrect && isFirst) {
      await updateStreak(supabase, userId);
    }

    if (result.isCorrect && isLastProblem) {
      const updated = {
        ...state.firstAttempts,
        [problem.id]: isFirst ? result.isCorrect : (state.firstAttempts[problem.id] ?? false),
      };
      afterCorrectLastProblem(updated);
    }
  }, [
    problem,
    state.numericValue,
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
      dispatch({
        type: "SUBMIT",
        feedback: { message: feedbackMsg, isCorrect: false },
        problemId: problem.id,
      });
      await persistAttempt(false, state.hintsRevealed, problem.id, step.id);
    },
    [problem.id, state.hintsRevealed, step.id, persistAttempt]
  );

  const goToNextStep = useCallback(async () => {
    if (isLastStep) {
      await completeLesson(supabase, userId, lesson.id);
      router.push(`/lesson/${lesson.id}/complete`);
      return;
    }
    const nextIndex = state.stepIndex + 1;
    const banner = state.masteryBanner;
    // #region agent log
    fetch("http://127.0.0.1:7317/ingest/5ca51102-074a-497f-a02f-436942c7f190", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "427e58",
      },
      body: JSON.stringify({
        sessionId: "427e58",
        runId: "step-advance",
        hypothesisId: "H4",
        location: "StepPlayer.tsx:goToNextStep",
        message: "advancing step",
        data: { fromIndex: state.stepIndex, nextIndex, nextStepId: lesson.steps[nextIndex]?.id },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7317/ingest/5ca51102-074a-497f-a02f-436942c7f190", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "427e58",
      },
      body: JSON.stringify({
        sessionId: "427e58",
        runId: "step-advance",
        hypothesisId: "H3-H5",
        location: "StepPlayer.tsx:handlePrimary",
        message: "primary button clicked",
        data: {
          stepIndex: state.stepIndex,
          stepId: step.id,
          problemIndex: state.problemIndex,
          problemId: problem.id,
          problemType: problem.type,
          masteryPassed: state.masteryPassed,
          problemSolved: state.problemSolved,
          isLastProblem,
          isLastStep,
          buttonLabel,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (state.masteryPassed) {
      goToNextStep();
      return;
    }

    if (state.problemSolved && !isLastProblem) {
      dispatch({ type: "NEXT_PROBLEM" });
      // #region agent log
      fetch("http://127.0.0.1:7317/ingest/5ca51102-074a-497f-a02f-436942c7f190", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "427e58",
        },
        body: JSON.stringify({
          sessionId: "427e58",
          runId: "post-fix",
          hypothesisId: "H5-fix",
          location: "StepPlayer.tsx:handlePrimary:NEXT_PROBLEM",
          message: "dispatched NEXT_PROBLEM",
          data: {
            fromProblemIndex: state.problemIndex,
            nextProblemIndex: state.problemIndex + 1,
            stepId: step.id,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
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
    <div className="flex min-h-screen flex-col pb-28 pt-6">
      <StepProgressBar
        current={state.stepIndex + 1}
        total={lesson.totalSteps}
      />

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
          selectedChoice={state.selectedChoice}
          onChoiceSelect={(id) => dispatch({ type: "SET_CHOICE", id })}
          onDragCorrect={handleDragCorrect}
          onDragIncorrect={handleDragIncorrect}
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
