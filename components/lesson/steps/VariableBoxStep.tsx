"use client";

import { useState } from "react";
import type { VariableBoxProblem } from "@/types/lesson";

interface VariableBoxStepProps {
  problem: VariableBoxProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
  /** When true, suppress the Goal box and standalone success banner (a parent renders them). */
  embedded?: boolean;
}

export function VariableBoxStep({
  problem,
  onCorrect,
  disabled,
  embedded,
}: VariableBoxStepProps) {
  const { variable, value, feedback } = problem;
  const [opened, setOpened] = useState(false);

  function open() {
    if (disabled || opened) return;
    setOpened(true);
    onCorrect(feedback.correct);
  }

  return (
    <div>
      {!embedded && (
        <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
          <p className="text-label font-semibold text-primary">Goal</p>
          <p className="mt-0.5 text-body text-text">{problem.prompt}</p>
        </div>
      )}

      <p className="mt-5 text-body text-text">{problem.question}</p>

      <div className="mt-6 rounded-xl border border-border bg-bg/60 p-6">
        {/* Equation:  [ box ]  =  value */}
        <div className="flex items-center justify-center gap-5 font-equation">
          <button
            type="button"
            onClick={open}
            disabled={disabled || opened}
            aria-label={
              opened
                ? `The box labeled ${variable} contains ${value}`
                : `Open the box labeled ${variable}`
            }
            className={`group relative flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-4 transition-all duration-300 ${
              opened
                ? "border-success bg-success/10"
                : "border-primary bg-primary-light " +
                  (disabled
                    ? "cursor-default"
                    : "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg")
            }`}
          >
            {/* Lid */}
            <span
              className={`absolute -top-3 left-1/2 h-3 w-[7.5rem] -translate-x-1/2 rounded-md border-4 transition-all duration-300 ${
                opened
                  ? "border-success bg-success/20 -rotate-6 -translate-x-[60%] -translate-y-1"
                  : "border-primary bg-primary-light"
              }`}
            />
            {opened ? (
              <span className="text-5xl font-bold text-success">{value}</span>
            ) : (
              <>
                <span className="text-4xl font-bold text-primary">
                  {variable}
                </span>
                <span className="mt-1 text-label text-primary/70 group-hover:text-primary">
                  tap to open
                </span>
              </>
            )}
          </button>

          <span className="text-4xl font-semibold text-text">=</span>

          <span className="text-5xl font-semibold text-text">{value}</span>
        </div>

        {opened && (
          <p className="mt-6 text-center text-body text-text">
            The box ({variable}) was hiding{" "}
            <span className="font-semibold text-success">{value}</span> all
            along, so{" "}
            <span className="font-equation font-semibold">
              {variable} = {value}
            </span>
            .
          </p>
        )}
      </div>

      {!embedded && opened && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
