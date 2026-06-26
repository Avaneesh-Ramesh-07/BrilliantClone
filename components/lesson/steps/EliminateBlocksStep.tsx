"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
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

  const [phase, setPhase] = useState<Phase>("idle");
  const [removeTriggered, setRemoveTriggered] = useState(false);

  useEffect(() => {
    if (phase !== "animating") return;
    const raf = requestAnimationFrame(() => setRemoveTriggered(true));
    const timer = setTimeout(() => {
      setRemoveTriggered(false);
      setPhase("done");
      onCorrect(problem.feedback.correct);
    }, 850);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
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
    setPhase("idle");
  }

  const animating = phase === "animating" && removeTriggered;

  // Left stack: amber constants on top of the variable block.
  const leftConstants = phase === "done" ? 0 : constant;
  // Right stack: plain blocks; top `constant` are removed.
  const rightCount = phase === "done" ? result : rightValue;

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
                    animating ? REMOVING : ""
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
              {leftLabel} + {constant}
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
                    animating && i < constant ? REMOVING : ""
                  }`}
                >
                  <div className="h-7 w-7 rounded-md border border-emerald-400 bg-emerald-200" />
                </div>
              ))}
            </div>
            <span className="font-equation text-equation text-muted">
              {rightValue}
            </span>
          </div>
        </div>

        {phase === "done" && (
          <p className="mt-4 text-center font-equation text-equation text-text">
            {leftLabel} = {result}
          </p>
        )}

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
              Add {constant} to both sides
            </Button>
          </div>
        )}
      </div>

      {phase === "wrong" && (
        <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
          <p className="text-body text-error">
            Adding {constant} to both sides just makes both sides bigger — it
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
