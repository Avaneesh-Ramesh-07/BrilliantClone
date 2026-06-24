"use client";

import { BalanceScaleVisual } from "@/components/equation/BalanceScaleVisual";
import type { SliderBalanceProblem } from "@/types/lesson";

interface SliderBalanceStepProps {
  problem: SliderBalanceProblem;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  showBalanced?: boolean;
}

export function SliderBalanceStep({
  problem,
  value,
  onChange,
  disabled,
  showBalanced,
}: SliderBalanceStepProps) {
  const isBalanced = value === problem.answer;

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>

      <div className="mt-4">
        <BalanceScaleVisual
          leftValue={value}
          rightValue={problem.rightValue}
          leftLabel={problem.leftLabel}
          rightLabel={problem.rightLabel}
          balanced={showBalanced && isBalanced}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <label htmlFor="x-slider" className="text-label text-muted">
            Try x =
          </label>
          <span className="font-equation text-equation text-primary">{value}</span>
        </div>
        <input
          id="x-slider"
          type="range"
          min={problem.sliderMin}
          max={problem.sliderMax}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary disabled:opacity-50"
          aria-valuemin={problem.sliderMin}
          aria-valuemax={problem.sliderMax}
          aria-valuenow={value}
          aria-label="Value of x"
        />
        <div className="mt-1 flex justify-between text-label text-muted">
          <span>{problem.sliderMin}</span>
          <span>{problem.sliderMax}</span>
        </div>
      </div>
    </div>
  );
}

function defaultSliderValue(problem: SliderBalanceProblem): number {
  return (
    problem.sliderDefault ??
    Math.floor((problem.sliderMin + problem.sliderMax) / 2)
  );
}

export { defaultSliderValue };
