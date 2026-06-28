"use client";

import { useRef, useState } from "react";
import type { PowerToggleProblem } from "@/types/lesson";
import { Button } from "@/components/ui/Button";
import { curveSegments } from "@/lib/plot";

interface PowerToggleStepProps {
  problem: PowerToggleProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

type Power = 1 | 2;

export function PowerToggleStep({
  problem,
  onCorrect,
  disabled,
}: PowerToggleStepProps) {
  const { xMin, xMax, yMin, yMax } = problem;
  const coefficient = problem.coefficient ?? 1;

  const notifiedRef = useRef(false);

  const [power, setPower] = useState<Power>(1);
  const [viewed, setViewed] = useState<Record<Power, boolean>>({
    1: true,
    2: false,
  });
  const [completed, setCompleted] = useState(false);

  function selectPower(next: Power) {
    if (disabled) return;
    setPower(next);
    setViewed((prev) => {
      if (prev[next]) return prev;
      const updated = { ...prev, [next]: true };
      if (updated[1] && updated[2] && !notifiedRef.current) {
        notifiedRef.current = true;
        setCompleted(true);
        onCorrect(problem.feedback.correct);
      }
      return updated;
    });
  }

  // --- Grid geometry ------------------------------------------------------
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
    (x) => coefficient * Math.pow(x, power),
    xMin,
    xMax,
    yMin,
    yMax,
    sx,
    sy
  );

  const caption =
    power === 1
      ? "Linear (highest power of x is 1): a straight line."
      : "Quadratic (highest power of x is 2): a U-shaped curve called a parabola.";

  const labelStyle = { fontSize: 9, fill: "var(--color-muted)" } as const;
  const axisLabelStyle = {
    fontSize: 12,
    fontWeight: 700,
    fontStyle: "italic",
    fill: "var(--color-text)",
  } as const;

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant={power === 1 ? "primary" : "secondary"}
          onClick={() => selectPower(1)}
          disabled={disabled}
        >
          Power = 1 (linear)
        </Button>
        <Button
          type="button"
          variant={power === 2 ? "primary" : "secondary"}
          onClick={() => selectPower(2)}
          disabled={disabled}
        >
          Power = 2 (quadratic)
        </Button>
      </div>

      <div className="relative mt-4 flex justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxWidth: W }}
          role="img"
          aria-label="Graph of y equals coefficient times x to the chosen power"
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

          {/* plotted function */}
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

      <p className="mt-2 text-label text-muted">{caption}</p>

      {completed && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{problem.feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
