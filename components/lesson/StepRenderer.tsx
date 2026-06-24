"use client";

import type { Problem } from "@/types/lesson";
import { ConceptStep } from "./steps/ConceptStep";
import { DragToSolveStep } from "./steps/DragToSolveStep";
import { GraphInterceptStep } from "./steps/GraphInterceptStep";
import { IsolateBlocksStep } from "./steps/IsolateBlocksStep";
import { MultipleChoiceStep } from "./steps/MultipleChoiceStep";
import { PlotPointStep } from "./steps/PlotPointStep";
import { SliderBalanceStep } from "./steps/SliderBalanceStep";
import { SlopeRaceStep } from "./steps/SlopeRaceStep";

interface StepRendererProps {
  problem: Problem;
  numericValue: string;
  onNumericChange: (value: string) => void;
  sliderValue: number;
  onSliderChange: (value: number) => void;
  selectedChoice: string | null;
  onChoiceSelect: (id: string) => void;
  onDragCorrect: (feedback: string) => void;
  onDragIncorrect: (feedback: string) => void;
  onDragReset: () => void;
  problemSolved: boolean;
  showChoiceResult: boolean;
  disabled?: boolean;
}

export function StepRenderer({
  problem,
  numericValue,
  onNumericChange,
  sliderValue,
  onSliderChange,
  selectedChoice,
  onChoiceSelect,
  onDragCorrect,
  onDragIncorrect,
  onDragReset,
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
    case "slider-balance":
      return (
        <SliderBalanceStep
          problem={problem}
          value={sliderValue}
          onChange={onSliderChange}
          disabled={disabled || problemSolved}
          showBalanced={problemSolved}
        />
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
          onReset={onDragReset}
          disabled={disabled || problemSolved}
        />
      );
    case "isolate-blocks":
      return (
        <IsolateBlocksStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "graph-intercept":
      return (
        <GraphInterceptStep
          problem={problem}
          value={sliderValue}
          onChange={onSliderChange}
          disabled={disabled || problemSolved}
          showResult={problemSolved}
        />
      );
    case "slope-race":
      // Note: we intentionally don't disable on `problemSolved` — the demo
      // stays replayable (via its own Reset) after it's been answered.
      return (
        <SlopeRaceStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled}
        />
      );
    case "plot-point":
      return (
        <PlotPointStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    default:
      return null;
  }
}
