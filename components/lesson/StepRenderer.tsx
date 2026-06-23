"use client";

import type { Problem } from "@/types/lesson";
import { ConceptStep } from "./steps/ConceptStep";
import { DragToSolveStep } from "./steps/DragToSolveStep";
import { MultipleChoiceStep } from "./steps/MultipleChoiceStep";

interface StepRendererProps {
  problem: Problem;
  numericValue: string;
  onNumericChange: (value: string) => void;
  selectedChoice: string | null;
  onChoiceSelect: (id: string) => void;
  onDragCorrect: (feedback: string) => void;
  onDragIncorrect: (feedback: string) => void;
  problemSolved: boolean;
  showChoiceResult: boolean;
  disabled?: boolean;
}

export function StepRenderer({
  problem,
  numericValue,
  onNumericChange,
  selectedChoice,
  onChoiceSelect,
  onDragCorrect,
  onDragIncorrect,
  problemSolved,
  showChoiceResult,
  disabled,
}: StepRendererProps) {
  switch (problem.type) {
    case "concept":
      return <ConceptStep problem={problem} />;
    case "numeric-input":
      return (
        <div>
          <p className="text-body text-text">{problem.prompt}</p>
          <div className="mt-4">
            <input
              type="number"
              inputMode="decimal"
              placeholder="x = ?"
              value={numericValue}
              onChange={(e) => onNumericChange(e.target.value)}
              disabled={disabled || problemSolved}
              className="min-h-[44px] w-full rounded-lg border border-border bg-surface px-4 py-2 font-equation text-equation text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
              aria-label="Answer for x"
            />
          </div>
        </div>
      );
    case "multiple-choice":
      return (
        <MultipleChoiceStep
          problem={problem}
          onSelect={onChoiceSelect}
          disabled={disabled || problemSolved}
          showResult={showChoiceResult}
          selectedId={selectedChoice}
        />
      );
    case "drag-to-solve":
      return (
        <DragToSolveStep
          problem={problem}
          onCorrect={onDragCorrect}
          onIncorrect={onDragIncorrect}
          disabled={disabled || problemSolved}
        />
      );
    default:
      return null;
  }
}
