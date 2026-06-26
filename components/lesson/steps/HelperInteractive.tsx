"use client";

import { useState } from "react";
import { BalanceChoiceStep } from "@/components/lesson/steps/BalanceChoiceStep";
import { EliminateBlocksStep } from "@/components/lesson/steps/EliminateBlocksStep";
import { IsolateBlocksStep } from "@/components/lesson/steps/IsolateBlocksStep";
import { PizzaShareStep } from "@/components/lesson/steps/PizzaShareStep";
import { PlotPointStep } from "@/components/lesson/steps/PlotPointStep";
import { SlopeRaceStep } from "@/components/lesson/steps/SlopeRaceStep";
import { TwoStepShareStep } from "@/components/lesson/steps/TwoStepShareStep";
import { Button } from "@/components/ui/Button";
import type { InteractiveHelper } from "@/types/lesson";

interface HelperInteractiveProps {
  problem: InteractiveHelper;
  /** Called when the learner dismisses the helper to return to the question. */
  onDismiss: () => void;
}

/**
 * A reinforcement interactive surfaced when a learner is stuck on a graded
 * question (wrong again after the hint). It is NOT graded: once the learner
 * works through it, they dismiss it and try the original question again.
 */
export function HelperInteractive({ problem, onDismiss }: HelperInteractiveProps) {
  const [done, setDone] = useState(false);
  const markDone = () => setDone(true);

  return (
    <div className="mt-6 rounded-xl border border-primary/30 bg-primary-light/40 p-4">
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light px-3 py-1 text-label font-semibold text-primary">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.6.45 1 1.15 1.1 1.95h5c.1-.8.5-1.5 1.1-1.95A6 6 0 0012 3z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Let&apos;s build the idea
      </div>
      <p className="mb-4 text-body text-muted">
        No worries — work through this quick interactive, then give the question
        another try.
      </p>

      {problem.type === "isolate-blocks" && (
        <IsolateBlocksStep problem={problem} onCorrect={markDone} />
      )}
      {problem.type === "eliminate-blocks" && (
        <EliminateBlocksStep problem={problem} onCorrect={markDone} />
      )}
      {problem.type === "pizza-share" && (
        <PizzaShareStep problem={problem} onCorrect={markDone} />
      )}
      {problem.type === "two-step-share" && (
        <TwoStepShareStep problem={problem} onCorrect={markDone} />
      )}
      {problem.type === "balance-choice" && (
        <BalanceChoiceStep problem={problem} onCorrect={markDone} />
      )}
      {problem.type === "plot-point" && (
        <PlotPointStep problem={problem} onCorrect={markDone} />
      )}
      {problem.type === "slope-race" && (
        <SlopeRaceStep problem={problem} onCorrect={markDone} />
      )}

      {done && (
        <div className="mt-5">
          <Button type="button" fullWidth onClick={onDismiss}>
            Got it — back to the question
          </Button>
        </div>
      )}
    </div>
  );
}
