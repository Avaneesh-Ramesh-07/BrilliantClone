"use client";

import { useState } from "react";
import type { PickGraphProblem } from "@/types/lesson";
import { curveSegments } from "@/lib/plot";

interface PickGraphStepProps {
  problem: PickGraphProblem;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  showResult?: boolean;
  selectedId?: string | null;
}

export function PickGraphStep({
  problem,
  onSelect,
  disabled,
  showResult,
  selectedId,
}: PickGraphStepProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const active = selectedId ?? localSelected;

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>
      <p className="mt-2 font-equation text-equation text-primary">
        {problem.equationLabel}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {problem.options.map((option) => {
          const isSelected = active === option.id;
          const showCorrect = showResult && option.correct;
          const showWrong = showResult && isSelected && !option.correct;

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setLocalSelected(option.id);
                onSelect(option.id);
              }}
              className={`flex flex-col items-center rounded-lg border p-2 transition-colors ${
                showCorrect
                  ? "border-success bg-success/10"
                  : showWrong
                    ? "border-error bg-error/10"
                    : isSelected
                      ? "border-primary bg-primary-light"
                      : "border-border bg-surface hover:border-primary"
              }`}
            >
              <MiniLineGraph
                slope={option.slope}
                intercept={option.intercept}
                bounds={{
                  xMin: problem.xMin,
                  xMax: problem.xMax,
                  yMin: problem.yMin,
                  yMax: problem.yMax,
                }}
                tone={
                  showCorrect
                    ? "success"
                    : showWrong
                      ? "error"
                      : "primary"
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MiniLineGraphProps {
  slope: number;
  intercept: number;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  tone: "primary" | "success" | "error";
}

function MiniLineGraph({ slope, intercept, bounds, tone }: MiniLineGraphProps) {
  const { xMin, xMax, yMin, yMax } = bounds;

  const xUnits = xMax - xMin;
  const yUnits = yMax - yMin;
  const cell = Math.min(120 / xUnits, 120 / yUnits);
  const margin = 8;
  const plotW = xUnits * cell;
  const plotH = yUnits * cell;
  const W = plotW + margin * 2;
  const H = plotH + margin * 2;
  const sx = (dx: number) => margin + (dx - xMin) * cell;
  const sy = (dy: number) => margin + (yMax - dy) * cell;

  const xTicks: number[] = [];
  for (let i = Math.ceil(xMin); i <= Math.floor(xMax); i++) xTicks.push(i);
  const yTicks: number[] = [];
  for (let i = Math.ceil(yMin); i <= Math.floor(yMax); i++) yTicks.push(i);

  const curve = curveSegments(
    (x) => slope * x + intercept,
    xMin,
    xMax,
    yMin,
    yMax,
    sx,
    sy
  );

  const stroke =
    tone === "success"
      ? "var(--color-success)"
      : tone === "error"
        ? "var(--color-error)"
        : "var(--color-primary)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ maxWidth: W }}
      role="img"
      aria-label={`Line with slope ${slope} and y-intercept ${intercept}`}
    >
      {xTicks.map((tx) => (
        <line
          key={`vx${tx}`}
          x1={sx(tx)}
          y1={margin}
          x2={sx(tx)}
          y2={H - margin}
          stroke="var(--color-border)"
          strokeWidth={tx === 0 ? 1.4 : 0.5}
        />
      ))}
      {yTicks.map((ty) => (
        <line
          key={`hy${ty}`}
          x1={margin}
          y1={sy(ty)}
          x2={W - margin}
          y2={sy(ty)}
          stroke="var(--color-border)"
          strokeWidth={ty === 0 ? 1.4 : 0.5}
        />
      ))}

      {curve.map((pts, i) => (
        <polyline
          key={`seg${i}`}
          points={pts}
          fill="none"
          stroke={stroke}
          strokeWidth={2.2}
        />
      ))}
    </svg>
  );
}
