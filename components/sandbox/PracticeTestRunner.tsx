"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { revalidateProgressViews } from "@/app/actions";
import { FeedbackPanel } from "@/components/lesson/FeedbackPanel";
import { MathText } from "@/components/lesson/MathText";
import { StepProgressBar } from "@/components/lesson/StepProgressBar";
import { Button } from "@/components/ui/Button";
import { completeLesson, recordStepAttempt } from "@/lib/progress";
import { createClient } from "@/lib/supabase/client";
import { updateStreak } from "@/lib/streak";
import type { VerifiedPracticeProblem } from "@/types/practice-test";

interface PracticeTestRunnerProps {
  lessonId: string;
  title: string;
  description: string;
  problems: VerifiedPracticeProblem[];
  userId: string;
}

/** Pretty-prints a computed value: integers as-is, else trimmed to 6 decimals. */
function formatComputed(value: number): string {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) return String(rounded);
  return String(Math.round(value * 1e6) / 1e6);
}

/**
 * Every distinct number in an option string, as a normalized ascending set, so
 * choices are graded as ORDER-INDEPENDENT sets: "3 and -2" -> [-2, 3] matches
 * "-2 and 3". (Kept local to avoid pulling the server-only math.js verifier
 * into the client bundle.)
 */
function optionNumberSet(text: string): number[] {
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches) return [];
  const out: number[] = [];
  for (const m of matches) {
    const n = Number(m);
    if (!Number.isFinite(n)) continue;
    const r = Math.round(n * 1e6) / 1e6;
    if (!out.some((v) => Math.abs(v - r) < 1e-6)) out.push(r);
  }
  out.sort((a, b) => a - b);
  return out;
}

/** Order-independent equality of two NON-EMPTY number sets (1e-6 tolerance). */
function sameNumberSet(a: number[], b: number[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  return a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
}

/**
 * Self-contained player for an AI practice test. Unlike the shared lesson
 * StepPlayer, it surfaces the deterministic VERIFICATION of each answer key
 * (a "Verified" badge + worked steps showing the computed answer) and applies
 * the app-wide consecutive-wrong gating:
 *   1st wrong attempt  → reveal ONLY the hint (answer stays hidden).
 *   2nd consecutive wrong on the SAME question → reveal the correct answer
 *     (green) and the full explanation.
 * The wrong counter is scoped per question and resets on a correct answer or
 * when moving to the next question. Styling mirrors lessons: a chosen wrong
 * option is muted (never red) and the correct option only turns green on the
 * second miss.
 */
export function PracticeTestRunner({
  lessonId,
  title,
  description,
  problems,
  userId,
}: PracticeTestRunnerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const attemptStart = useRef<number>(Date.now());

  const [index, setIndex] = useState(0);
  const [numericValue, setNumericValue] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  // Consecutive wrong submissions on the CURRENT question (resets each question).
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    message: string;
  } | null>(null);
  const [solved, setSolved] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [answerPrompt, setAnswerPrompt] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const problem = problems[index];
  const isLast = index === problems.length - 1;
  const hasHint = !!problem.hint && problem.hint.trim().length > 0;

  // Reveal the correct answer ONLY once the question is solved, or after the
  // 2nd CONSECUTIVE wrong attempt on this same question (attempts >= 2). A
  // single wrong attempt (attempts === 1) must NOT reveal/highlight anything;
  // it only surfaces the hint. `attempts` resets to 0 on every new question.
  const revealCorrect =
    solved || (!!feedback && !feedback.isCorrect && attempts >= 2);
  const showResult = feedback !== null;

  async function recordAttempt(correct: boolean) {
    const durationMs = Math.min(
      Math.max(Date.now() - attemptStart.current, 0),
      5 * 60 * 1000
    );
    try {
      await recordStepAttempt(supabase, {
        userId,
        lessonId,
        stepId: problem.id,
        problemId: problem.id,
        correct,
        hintsUsed: hintRevealed ? 1 : 0,
        durationMs,
      });
    } catch {
      // Analytics only; never block play on a failed insert.
    }
  }

  function submit(isCorrect: boolean) {
    const prior = attempts;
    setAttempts(prior + 1);
    setAnswerPrompt(null);
    void recordAttempt(isCorrect);

    if (isCorrect) {
      setSolved(true);
      setFeedback({ isCorrect: true, message: problem.correctFeedback });
      if (prior === 0) void updateStreak(supabase, userId);
      return;
    }

    // Wrong. First miss → withhold the answer, nudge to the hint. Second
    // consecutive miss → reveal the answer + full explanation.
    if (prior === 0) {
      setFeedback({
        isCorrect: false,
        message: hasHint
          ? "Not quite. Check the hint below and try again."
          : "Not quite. Take another look and try again.",
      });
      if (hasHint) setHintRevealed(true);
    } else {
      setFeedback({ isCorrect: false, message: problem.incorrectFeedback });
    }
  }

  function handleCheck() {
    if (problem.kind === "numeric") {
      if (numericValue.trim() === "") {
        setAnswerPrompt(
          "Enter an answer to check, or tap \u201cI don\u2019t know\u201d."
        );
        return;
      }
      const parsed = parseFloat(numericValue);
      submit(!Number.isNaN(parsed) && parsed === problem.answer);
      return;
    }
    if (selected === null) return;
    // Order-independent set grading: accept the chosen option when its number
    // set equals the correct option's set (so "3 and -2" is accepted when the
    // key is "-2 and 3"), in addition to a direct index match.
    const correctSet = optionNumberSet(problem.options[problem.correctIndex]);
    const chosenSet = optionNumberSet(problem.options[selected]);
    const correct =
      selected === problem.correctIndex || sameNumberSet(chosenSet, correctSet);
    submit(correct);
  }

  function resetForNext() {
    setNumericValue("");
    setSelected(null);
    setAttempts(0);
    setFeedback(null);
    setSolved(false);
    setHintRevealed(false);
    setAnswerPrompt(null);
    attemptStart.current = Date.now();
  }

  async function finish() {
    setFinishing(true);
    try {
      await completeLesson(supabase, userId, lessonId);
      await revalidateProgressViews();
    } catch {
      // Even if persistence fails, take the learner to the congrats screen.
    }
    router.push(`/lesson/${lessonId}/complete`);
  }

  async function goNext() {
    if (isLast) {
      await finish();
      return;
    }
    setIndex((i) => i + 1);
    resetForNext();
  }

  async function handlePrimary() {
    if (finishing) return;
    if (solved) {
      await goNext();
      return;
    }
    if (feedback && !feedback.isCorrect) {
      // Answer already revealed (2nd miss): let them move on, ungated.
      if (attempts >= 2) {
        await goNext();
        return;
      }
      // First miss: free retry. Keep the hint visible; clear the marking.
      setFeedback(null);
      setAnswerPrompt(null);
      attemptStart.current = Date.now();
      return;
    }
    handleCheck();
  }

  function handleGiveUp() {
    // "I don't know" behaves exactly like a wrong submission: first one reveals
    // the hint, a second consecutive one reveals the answer.
    submit(false);
  }

  const buttonLabel = solved
    ? isLast
      ? "Finish Test →"
      : "Continue →"
    : feedback && !feedback.isCorrect
      ? attempts >= 2
        ? isLast
          ? "Finish Test →"
          : "Continue →"
        : "Try Again"
      : "Check Answer";

  const isCheckPhase = buttonLabel === "Check Answer";
  const buttonDisabled =
    finishing ||
    (isCheckPhase && problem.kind === "mc" && selected === null);
  const showGiveUp = isCheckPhase && !solved;

  return (
    <div className="flex min-h-screen flex-col pb-28">
      <div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-bg/85 px-4 pb-3 pt-4 backdrop-blur">
        <StepProgressBar current={index + 1} total={problems.length} />
      </div>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label font-semibold uppercase tracking-wide text-muted">
            Practice Test
          </span>
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-amber-700">
            Beta
          </span>
        </div>
        <p className="mt-1 text-label text-muted">{title}</p>
        {description && (
          <p className="mt-1 text-label text-muted/80">{description}</p>
        )}
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {problem.conceptLabel && (
          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-label font-medium text-purple-800">
            {problem.conceptLabel}
          </span>
        )}
      </div>

      <div className="mt-6">
        <p className="text-body text-text">
          <MathText text={problem.prompt} />
        </p>

        {problem.kind === "numeric" ? (
          <div className="mt-4">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Answer"
              value={numericValue}
              onChange={(e) => {
                setNumericValue(e.target.value);
                setAnswerPrompt(null);
              }}
              disabled={solved || revealCorrect}
              className="min-h-[44px] w-full rounded-lg border border-border bg-surface px-4 py-2 font-equation text-equation text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-light disabled:opacity-70"
              aria-label="Your answer"
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {(() => {
              const correctSet = optionNumberSet(
                problem.options[problem.correctIndex]
              );
              return problem.options.map((text, i) => {
                const isSelected = selected === i;
                // Green on reveal for the keyed option AND any option that is an
                // equivalent set (order-independent), so a learner who picked an
                // equivalent answer isn't shown their pick as "wrong".
                const isCorrectOption =
                  i === problem.correctIndex ||
                  sameNumberSet(optionNumberSet(text), correctSet);
                const showCorrect = revealCorrect && isCorrectOption;
                const showWrong = showResult && isSelected && !showCorrect;
                const optionDisabled = solved || revealCorrect;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={optionDisabled}
                    onClick={() => setSelected(i)}
                    className={`min-h-[44px] rounded-lg border px-4 py-3 text-left text-body transition-colors ${
                      showCorrect
                        ? "border-success bg-success/10 text-success"
                        : showWrong
                          ? "border-border bg-surface text-muted"
                          : isSelected
                            ? "border-primary bg-primary-light text-text"
                            : "border-border bg-surface text-text hover:border-primary"
                    }`}
                  >
                    <MathText text={text} />
                  </button>
                );
              });
            })()}
          </div>
        )}
      </div>

      <FeedbackPanel
        message={feedback?.message ?? ""}
        isCorrect={feedback?.isCorrect ?? false}
        visible={!!feedback}
      />

      {hintRevealed && hasHint && !revealCorrect && (
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
            <p className="text-body text-amber-700/90">
              <MathText text={problem.hint} />
            </p>
          </div>
        </div>
      )}

      {revealCorrect && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary-light px-4 py-3">
          <p className="text-label font-semibold text-primary">
            Worked solution
          </p>
          {problem.computedAnswer !== null && (
            <p className="mt-1 text-body text-text">
              Computed answer:{" "}
              <span className="font-semibold">
                {formatComputed(problem.computedAnswer)}
              </span>
              {problem.answerExpression?.trim() && (
                <>
                  {" "}
                  <span className="text-muted">
                    (<MathText text={problem.answerExpression} glossary={false} />{" "}
                    = {formatComputed(problem.computedAnswer)})
                  </span>
                </>
              )}
            </p>
          )}
          <p className="mt-1 text-body text-text">
            <MathText text={problem.explanation} />
          </p>
          {problem.status === "verified" && (
            <p className="mt-2 text-label font-medium text-success">
              ✓ This answer was confirmed by computing it directly.
            </p>
          )}
        </div>
      )}

      <div className="sticky bottom-0 mt-auto flex flex-col gap-4 border-t border-border bg-bg pt-4">
        {answerPrompt && (
          <p className="text-center text-label font-medium text-amber-700">
            {answerPrompt}
          </p>
        )}
        <Button
          type="button"
          fullWidth
          onClick={() => void handlePrimary()}
          disabled={buttonDisabled}
        >
          {finishing ? "Finishing…" : buttonLabel}
        </Button>
        {showGiveUp && (
          <button
            type="button"
            onClick={handleGiveUp}
            className="text-center text-label font-semibold text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
          >
            I don&apos;t know
          </button>
        )}
      </div>
    </div>
  );
}
