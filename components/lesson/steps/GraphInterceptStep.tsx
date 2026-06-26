"use client";

import type { GraphInterceptProblem } from "@/types/lesson";
import { EquationBadge } from "@/components/lesson/EquationBadge";
import { MathText } from "@/components/lesson/MathText";

interface GraphInterceptStepProps {
  problem: GraphInterceptProblem;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Show the "solved" highlight once the answer has been checked correctly. */
  showResult?: boolean;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function GraphInterceptStep({
  problem,
  value,
  onChange,
  disabled,
  showResult,
}: GraphInterceptStepProps) {
  const { slope, intercept, xMin, xMax, equationLabel } = problem;
  const targetX = problem.targetX ?? 0;

  const x = value;
  const y = slope * x + intercept;
  const atTarget = showResult === true && x === targetX;

  // --- Grid geometry (data coords -> svg pixels) --------------------------
  const yAtMin = slope * xMin + intercept;
  const yAtMax = slope * xMax + intercept;
  const yLo = Math.floor(Math.min(yAtMin, yAtMax, 0));
  const yHi = Math.ceil(Math.max(yAtMin, yAtMax, 0));
  const xUnits = xMax - xMin;
  const yUnits = yHi - yLo;
  const cell = Math.min(220 / xUnits, 300 / yUnits);
  const margin = 26;
  const plotW = xUnits * cell;
  const plotH = yUnits * cell;
  const W = plotW + margin * 2;
  const H = plotH + margin * 2;
  const sx = (dx: number) => margin + (dx - xMin) * cell;
  const sy = (dy: number) => margin + (yHi - dy) * cell;

  const xTicks: number[] = [];
  for (let i = Math.ceil(xMin); i <= Math.floor(xMax); i++) xTicks.push(i);
  const yTicks: number[] = [];
  for (let i = yLo; i <= yHi; i++) yTicks.push(i);

  const ballX = sx(x);
  const ballY = sy(y);
  const labelStyle = { fontSize: 9, fill: "var(--color-muted)" } as const;
  const axisLabelStyle = {
    fontSize: 12,
    fontWeight: 700,
    fontStyle: "italic",
    fill: "var(--color-text)",
  } as const;

  return (
    <div>
      <p className="text-body text-text">
        <MathText text={problem.prompt} />
      </p>
      <p className="mt-2 text-label text-muted">
        Slide the ball along the line to{" "}
        <span className="font-equation text-primary">x = {targetX}</span> (the
        y-axis) and read its height — that height is the y-intercept. Then press
        Check Answer.
      </p>

      <EquationBadge
        equation={equationLabel}
        label="The line"
        className="mt-5"
      />

      <div className="relative mt-4 flex justify-center">
        <div className="absolute right-2 top-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-equation text-equation text-text shadow-sm">
          (x = {fmt(x)}, y = {fmt(y)})
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxWidth: Math.max(W, 220) }}
          role="img"
          aria-label={`Graph of ${equationLabel} with a movable ball at x = ${x}, y = ${fmt(y)}`}
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
          <text
            x={sx(0) - 6}
            y={sy(0) + 12}
            textAnchor="end"
            style={labelStyle}
          >
            0
          </text>

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
            y={sy(yHi) + 4}
            textAnchor="start"
            dominantBaseline="hanging"
            style={axisLabelStyle}
          >
            y
          </text>

          <line
            x1={sx(xMin)}
            y1={sy(yAtMin)}
            x2={sx(xMax)}
            y2={sy(yAtMax)}
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          <circle
            cx={sx(0)}
            cy={sy(intercept)}
            r={4}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.5}
          />

          {atTarget && (
            <line
              x1={ballX}
              y1={ballY}
              x2={sx(0)}
              y2={sy(0)}
              stroke="var(--color-success)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}

          {atTarget && (
            <circle
              cx={ballX}
              cy={ballY}
              r={13}
              fill="none"
              stroke="var(--color-success)"
              strokeWidth={2}
              opacity={0.5}
            />
          )}
          <circle
            cx={ballX}
            cy={ballY}
            r={8}
            fill={atTarget ? "var(--color-success)" : "var(--color-primary)"}
            stroke="white"
            strokeWidth={2}
          />
        </svg>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="ball-x-slider" className="text-label text-muted">
            Move the ball: x =
          </label>
          <span className="font-equation text-equation text-primary">{x}</span>
        </div>
        <input
          id="ball-x-slider"
          type="range"
          min={xMin}
          max={xMax}
          step={1}
          value={x}
          disabled={disabled}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary disabled:opacity-50"
          aria-label="x position of the ball"
        />
        <div className="mt-1 flex justify-between text-label text-muted">
          <span>{xMin}</span>
          <span>{xMax}</span>
        </div>
      </div>
    </div>
  );
}
