"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Fraction as StackedFraction } from "@/components/math/Fraction";
import type { EliminateBlocksProblem } from "@/types/lesson";

interface EliminateBlocksStepProps {
  problem: EliminateBlocksProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
  /** When true, suppress the Goal box and the standalone success banner (a parent renders them); still call onCorrect on completion. */
  embedded?: boolean;
}

type Phase = "idle" | "animating" | "wrong" | "done";

const REMOVING = "translate-y-10 scale-50 opacity-0";

function VariableBlock({ label }: { label: string }) {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary bg-primary-light font-equation text-equation text-primary">
      {label}
    </div>
  );
}

/** A small stacked fraction; delegates to the shared {@link StackedFraction}. */
function Fraction({ num, den }: { num: number; den: number }) {
  return <StackedFraction tight className="mx-0.5" numerator={num} denominator={den} />;
}

export function EliminateBlocksStep({
  problem,
  onCorrect,
  disabled,
  embedded,
}: EliminateBlocksStepProps) {
  const { variable, constant, rightValue } = problem;
  const coefficient = problem.coefficient ?? 1;
  const result = rightValue - constant;
  const leftLabel = `${coefficient > 1 ? coefficient : ""}${variable}`;

  const distractorLabel =
    problem.distractor?.label ?? `Add ${constant} to both sides`;
  const distractorKind = problem.distractor?.kind ?? "add";

  const [phase, setPhase] = useState<Phase>("idle");
  // Blocks slide out + the "− {constant}" terms slide in.
  const [removeTriggered, setRemoveTriggered] = useState(false);
  // Equation has morphed to the solved line ({leftLabel} = {result}).
  const [showSolved, setShowSolved] = useState(false);

  useEffect(() => {
    if (phase !== "animating") return;
    // 1) kick off the block removal + reveal the "− {constant}" beat.
    const raf = requestAnimationFrame(() => setRemoveTriggered(true));
    // 2) after the subtract beat, morph the equation to the solved line.
    const solveTimer = setTimeout(() => setShowSolved(true), 850);
    // 3) hold the solved line briefly (readable even when embedded), then finish.
    const doneTimer = setTimeout(() => {
      setPhase("done");
      onCorrect(problem.feedback.correct);
    }, 1500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(solveTimer);
      clearTimeout(doneTimer);
    };
  }, [phase, onCorrect, problem.feedback.correct]);

  const interactive = !disabled && phase === "idle";

  function handleEliminate() {
    if (!interactive) return;
    setPhase("animating");
  }

  function handleDistractor() {
    if (!interactive) return;
    setPhase("wrong");
  }

  function handleTryAgain() {
    setRemoveTriggered(false);
    setShowSolved(false);
    setPhase("idle");
  }

  // The "− {constant}" beat is showing (blocks animating out, not yet solved).
  const subtracting = phase === "animating" && removeTriggered && !showSolved;
  // Once the equation has morphed to the solved line the blocks are cleared.
  const cleared = showSolved || phase === "done";

  // Left stack: amber constants on top of the variable block.
  const leftConstants = cleared ? 0 : constant;
  // Right stack: plain blocks; top `constant` are removed.
  const rightCount = cleared ? result : rightValue;

  const subtractTermClass = `text-error transition-all duration-300 ${
    removeTriggered ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
  }`;

  return (
    <div>
      {!embedded && (
        <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
          <p className="text-label font-semibold text-primary">Goal</p>
          <p className="mt-0.5 text-body text-text">{problem.prompt}</p>
        </div>
      )}

      <p className={`${embedded ? "" : "mt-5"} text-body text-text`}>
        {problem.question}
      </p>

      <div className="mt-6 rounded-xl border border-border bg-bg/60 p-5">
        <div className="flex items-end justify-center gap-6">
          {/* LEFT stack: x + N */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              {Array.from({ length: leftConstants }).map((_, i) => (
                <div
                  key={`lc-${i}`}
                  className={`transition-all duration-700 ${
                    subtracting ? REMOVING : ""
                  }`}
                >
                  <div className="h-7 w-7 rounded-md border border-amber-500 bg-amber-200" />
                </div>
              ))}
              {Array.from({ length: coefficient }).map((_, i) => (
                <VariableBlock key={`vb-${i}`} label={variable} />
              ))}
            </div>
            <span className="font-equation text-equation text-muted">
              {cleared ? leftLabel : `${leftLabel} + ${constant}`}
            </span>
          </div>

          <span className="font-equation text-equation text-text">=</span>

          {/* RIGHT stack: plain count */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              {Array.from({ length: rightCount }).map((_, i) => (
                <div
                  key={`rc-${i}`}
                  className={`transition-all duration-700 ${
                    subtracting && i < constant ? REMOVING : ""
                  }`}
                >
                  <div className="h-7 w-7 rounded-md border border-emerald-400 bg-emerald-200" />
                </div>
              ))}
            </div>
            <span className="font-equation text-equation text-muted">
              {cleared ? result : rightValue}
            </span>
          </div>
        </div>

        {/* Central morphing equation line. */}
        <div className="mt-5 text-center font-equation text-equation text-text">
          {cleared ? (
            <span>
              {leftLabel} = {result}
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-1.5">
              <span>
                {leftLabel} + {constant}
              </span>
              {phase === "animating" && (
                <span className={subtractTermClass}>− {constant}</span>
              )}
              <span>=</span>
              <span>{rightValue}</span>
              {phase === "animating" && (
                <span className={subtractTermClass}>− {constant}</span>
              )}
            </span>
          )}
        </div>

        {(phase === "idle" || phase === "animating") && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleEliminate}
              disabled={!interactive}
            >
              Eliminate +{constant} from both sides
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDistractor}
              disabled={!interactive}
            >
              {distractorLabel}
            </Button>
          </div>
        )}
      </div>

      {phase === "wrong" && distractorKind === "divide" && (
        <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
          <div className="flex flex-col items-center gap-2 font-equation text-equation text-text">
            <span>
              {leftLabel} + {constant} = {rightValue}
            </span>
            <span className="text-label font-sans text-muted">
              divide every term by {coefficient}
            </span>
            <span className="inline-flex items-center gap-1.5 text-error">
              <span className="text-text">{variable} +</span>
              <Fraction num={constant} den={coefficient} />
              <span className="text-text">=</span>
              <Fraction num={rightValue} den={coefficient} />
            </span>
          </div>
          <p className="mt-3 text-body text-error">
            Dividing first turns the +{constant} into a fraction (
            <Fraction num={constant} den={coefficient} />
            ), so now you&apos;re stuck doing fraction arithmetic. Undo the +
            {constant} FIRST, then divide.
          </p>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={handleTryAgain}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {phase === "wrong" && distractorKind === "add" && (
        <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
          <p className="text-body text-error">
            Adding {constant} to both sides just makes both sides bigger; it
            doesn&apos;t get {variable} alone. Eliminate the +{constant} instead.
          </p>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={handleTryAgain}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {!embedded && phase === "done" && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{problem.feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
