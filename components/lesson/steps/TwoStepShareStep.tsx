"use client";

import { useState } from "react";
import { EliminateBlocksStep } from "@/components/lesson/steps/EliminateBlocksStep";
import { PizzaShareStep } from "@/components/lesson/steps/PizzaShareStep";
import type {
  EliminateBlocksProblem,
  PizzaShareProblem,
  TwoStepShareProblem,
} from "@/types/lesson";

interface TwoStepShareStepProps {
  problem: TwoStepShareProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

type Stage = "eliminate" | "share" | "done";

/**
 * Two-step demo for `coefficient·x + constant = rightValue`. Runs the
 * block-elimination demo first (clear the +constant), then the pizza-share demo
 * (split the remaining slices equally). Renders a single goal box and the final
 * success banner; the child stages run in `embedded` mode so they don't render
 * their own framing.
 */
export function TwoStepShareStep({
  problem,
  onCorrect,
  disabled,
}: TwoStepShareStepProps) {
  const { variable, coefficient, constant, rightValue } = problem;
  const afterConstant = rightValue - constant;

  const [stage, setStage] = useState<Stage>("eliminate");

  const stageOne: EliminateBlocksProblem = {
    id: `${problem.id}-s1`,
    type: "eliminate-blocks",
    prompt: problem.prompt,
    question: problem.question,
    variable,
    coefficient,
    constant,
    rightValue,
    distractor: {
      label: `Divide both sides by ${coefficient}`,
      kind: "divide",
    },
    feedback: {
      correct: `Now the equation is ${coefficient}${variable} = ${afterConstant}.`,
    },
  };

  const stageTwo: PizzaShareProblem = {
    id: `${problem.id}-s2`,
    type: "pizza-share",
    prompt: problem.prompt,
    question: `Now share it out: ${coefficient}${variable} = ${afterConstant} means cutting ${afterConstant} slices evenly for ${coefficient} people. Make one straight cut through the center.`,
    variable,
    people: coefficient,
    slices: afterConstant,
    feedback: problem.feedback,
  };

  return (
    <div>
      <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
        <p className="text-label font-semibold text-primary">Goal</p>
        <p className="mt-0.5 text-body text-text">{problem.prompt}</p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-label">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${
            stage === "eliminate"
              ? "border-primary/40 bg-primary-light text-primary"
              : "border-success/40 bg-success/10 text-success"
          }`}
        >
          {stage === "eliminate" ? "1" : "✓"} Eliminate +{constant}
        </span>
        <span className="h-px w-5 bg-border" />
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-semibold ${
            stage === "share"
              ? "border-primary/40 bg-primary-light text-primary"
              : stage === "done"
                ? "border-success/40 bg-success/10 text-success"
                : "border-border bg-surface text-muted"
          }`}
        >
          {stage === "done" ? "✓" : "2"} Share the pizza
        </span>
      </div>

      <div className="mt-4">
        {stage === "eliminate" ? (
          <EliminateBlocksStep
            key="s1"
            problem={stageOne}
            embedded
            disabled={disabled}
            onCorrect={() => setStage("share")}
          />
        ) : (
          <PizzaShareStep
            key="s2"
            problem={stageTwo}
            embedded
            disabled={disabled}
            onCorrect={() => {
              setStage("done");
              onCorrect(problem.feedback.correct);
            }}
          />
        )}
      </div>

      {stage === "done" && (
        <>
          <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
            <p className="text-body text-success">{problem.feedback.correct}</p>
          </div>

          <div className="mt-4 rounded-xl border-2 border-primary/40 bg-primary-light px-4 py-3">
            <p className="text-label font-semibold text-primary">
              The strategy: undo addition/subtraction FIRST, then
              multiplication/division.
            </p>
            <ol className="mt-2 flex flex-col gap-2">
              <li className="flex items-start gap-2 text-body text-text">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-label font-semibold text-white">
                  1
                </span>
                <span>
                  Eliminate the +{constant} (subtract it from both sides).
                </span>
              </li>
              <li className="flex items-start gap-2 text-body text-text">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-label font-semibold text-white">
                  2
                </span>
                <span>Divide both sides by {coefficient}.</span>
              </li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
