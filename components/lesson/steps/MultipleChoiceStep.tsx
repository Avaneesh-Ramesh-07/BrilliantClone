"use client";

import { useState } from "react";
import type { MultipleChoiceProblem } from "@/types/lesson";
import { evalExpression } from "@/lib/expression";
import { curveSegments } from "@/lib/plot";
import { MathText } from "@/components/lesson/MathText";

interface MultipleChoiceStepProps {
  problem: MultipleChoiceProblem;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  showResult?: boolean;
  /**
   * When true, the correct option is highlighted green. Gated by the player so
   * the answer is only revealed once solved or missed twice in a row. A single
   * wrong attempt still marks the chosen option but doesn't give the answer away.
   */
  revealCorrect?: boolean;
  selectedId?: string | null;
}

export function MultipleChoiceStep({
  problem,
  onSelect,
  disabled,
  showResult,
  revealCorrect,
  selectedId,
}: MultipleChoiceStepProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const active = selectedId ?? localSelected;

  const selectedOption = active
    ? problem.options.find((o) => o.id === active) ?? null
    : null;
  const showGraph =
    !!problem.graphOnSelect &&
    !!selectedOption &&
    typeof selectedOption.fn === "string" &&
    selectedOption.fn.length > 0;

  return (
    <div>
      <p className="text-body text-text">
        <MathText text={problem.prompt} />
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {problem.options.map((option) => {
          const isSelected = active === option.id;
          const showCorrect = revealCorrect && option.correct;
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
              className={`min-h-[44px] rounded-lg border px-4 py-3 text-left text-body transition-colors ${
                showCorrect
                  ? "border-success bg-success/10 text-success"
                  : showWrong
                    ? "border-border bg-surface text-muted"
                    : isSelected
                      ? "border-primary bg-primary-light text-text"
                      : "border-border bg-surface text-text hover:border-primary"
              }`}
            >
              <MathText text={option.text} />
            </button>
          );
        })}
      </div>

      {showGraph && selectedOption && (
        <EquationGraph
          fn={selectedOption.fn as string}
          label={selectedOption.text}
          bounds={problem.graph ?? { xMin: -6, xMax: 6, yMin: -6, yMax: 6 }}
        />
      )}
    </div>
  );
}

interface EquationGraphProps {
  fn: string;
  label: string;
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
}

function EquationGraph({ fn, label, bounds }: EquationGraphProps) {
  const { xMin, xMax, yMin, yMax } = bounds;

  // --- Grid geometry (matches PlotPointStep) ------------------------------
  const xUnits = xMax - xMin;
  const yUnits = yMax - yMin;
  const cell = Math.min(300 / xUnits, 300 / yUnits);
  const margin = 24;
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
    (x) => evalExpression(fn, x),
    xMin,
    xMax,
    yMin,
    yMax,
    sx,
    sy
  );

  const labelStyle = { fontSize: 9, fill: "var(--color-muted)" } as const;
  const axisLabelStyle = {
    fontSize: 12,
    fontWeight: 700,
    fontStyle: "italic",
    fill: "var(--color-text)",
  } as const;

  return (
    <>
      <p className="mt-4 text-label text-muted">Graph of {label}</p>
      <div className="mt-2 flex justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxWidth: W }}
          role="img"
          aria-label={`Graph of ${label}`}
        >
          {xTicks.map((tx) => (
            <line
              key={`vx${tx}`}
              x1={sx(tx)}
              y1={margin}
              x2={sx(tx)}
              y2={H - margin}
              stroke="var(--color-border)"
              strokeWidth={tx === 0 ? 1.6 : 0.6}
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
              strokeWidth={ty === 0 ? 1.6 : 0.6}
            />
          ))}

          {xTicks
            .filter((t) => t !== 0 && t % 2 === 0)
            .map((tx) => (
              <text
                key={`xl${tx}`}
                x={sx(tx)}
                y={sy(0) + 12}
                textAnchor="middle"
                style={labelStyle}
              >
                {tx}
              </text>
            ))}
          {yTicks
            .filter((t) => t !== 0 && t % 2 === 0)
            .map((ty) => (
              <text
                key={`yl${ty}`}
                x={sx(0) - 6}
                y={sy(ty) + 3}
                textAnchor="end"
                style={labelStyle}
              >
                {ty}
              </text>
            ))}

          {/* axis labels */}
          <text
            x={sx(xMax) - 3}
            y={sy(0) - 7}
            textAnchor="end"
            style={axisLabelStyle}
          >
            x
          </text>
          <text
            x={sx(0) + 8}
            y={sy(yMax) + 4}
            textAnchor="start"
            dominantBaseline="hanging"
            style={axisLabelStyle}
          >
            y
          </text>

          {/* plotted curve */}
          {curve.map((pts, i) => (
            <polyline
              key={`seg${i}`}
              points={pts}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>
    </>
  );
}
