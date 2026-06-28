"use client";

import type { Problem } from "@/types/lesson";
import { MathText } from "./MathText";
import { ConceptStep } from "./steps/ConceptStep";
import { DragToSolveStep } from "./steps/DragToSolveStep";
import { EliminateBlocksStep } from "./steps/EliminateBlocksStep";
import { FactorQuadraticStep } from "./steps/FactorQuadraticStep";
import { GraphInterceptStep } from "./steps/GraphInterceptStep";
import { GraphLineStep } from "./steps/GraphLineStep";
import { IsolateBlocksStep } from "./steps/IsolateBlocksStep";
import { MultipleChoiceStep } from "./steps/MultipleChoiceStep";
import { ParabolaBallsStep } from "./steps/ParabolaBallsStep";
import { ParabolaSliderStep } from "./steps/ParabolaSliderStep";
import { PickGraphStep } from "./steps/PickGraphStep";
import { PizzaShareStep } from "./steps/PizzaShareStep";
import { BalanceChoiceStep } from "./steps/BalanceChoiceStep";
import { VariableBoxStep } from "./steps/VariableBoxStep";
import { VertexFormulaStep } from "./steps/VertexFormulaStep";
import { QuadraticFormulaStep } from "./steps/QuadraticFormulaStep";
import { PlotPointStep } from "./steps/PlotPointStep";
import { PowerToggleStep } from "./steps/PowerToggleStep";
import { TwoStepShareStep } from "./steps/TwoStepShareStep";
import { SliderBalanceStep } from "./steps/SliderBalanceStep";
import { SlopeRaceStep } from "./steps/SlopeRaceStep";
import { VertexPickStep } from "./steps/VertexPickStep";

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
  /**
   * When true, choice-based questions may highlight the correct option green.
   * Gated by StepPlayer so the answer is only revealed once the question is
   * solved or missed twice in a row, never on a single wrong attempt.
   */
  revealAnswer: boolean;
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
  revealAnswer,
  disabled,
}: StepRendererProps) {
  switch (problem.type) {
    case "concept":
      return <ConceptStep problem={problem} />;
    case "numeric-input":
      return (
        <div>
          <p className="text-body text-text">
            <MathText text={problem.prompt} />
          </p>
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
          revealCorrect={revealAnswer}
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
    case "eliminate-blocks":
      return (
        <EliminateBlocksStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "pizza-share":
      return (
        <PizzaShareStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "two-step-share":
      return (
        <TwoStepShareStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "balance-choice":
      return (
        <BalanceChoiceStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "variable-box":
      return (
        <VariableBoxStep
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
      // Note: we intentionally don't disable on `problemSolved`; the demo
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
    case "parabola-balls":
      return (
        <ParabolaBallsStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "factor-quadratic":
      return (
        <FactorQuadraticStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "power-toggle":
      return (
        <PowerToggleStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled}
        />
      );
    case "parabola-a-slider":
      return (
        <ParabolaSliderStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled}
        />
      );
    case "vertex-pick":
      return (
        <VertexPickStep
          problem={problem}
          onCorrect={onDragCorrect}
          onIncorrect={onDragIncorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "pick-graph":
      return (
        <PickGraphStep
          problem={problem}
          onSelect={onChoiceSelect}
          disabled={disabled || problemSolved}
          showResult={showChoiceResult}
          revealCorrect={revealAnswer}
          selectedId={selectedChoice}
        />
      );
    case "vertex-formula":
      return (
        <VertexFormulaStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "quadratic-formula":
      return (
        <QuadraticFormulaStep
          problem={problem}
          onCorrect={onDragCorrect}
          disabled={disabled || problemSolved}
        />
      );
    case "graph-line":
      return (
        <GraphLineStep
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
