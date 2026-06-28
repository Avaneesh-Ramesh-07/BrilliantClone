"use client";

import { useRef, useState } from "react";
import type { ParabolaSliderProblem } from "@/types/lesson";
import { curveSegments } from "@/lib/plot";

interface ParabolaSliderStepProps {
  problem: ParabolaSliderProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

/** Build a nicely formatted "y = ax² + bx + c" string. */
function formatEquation(a: number, b: number, c: number): string {
  const terms: string[] = [];

  const fmtCoef = (v: number, suffix: string): string => {
    const abs = Math.abs(v);
    if (abs === 1 && suffix) return suffix; // "x²" not "1x²"
    return `${abs}${suffix}`;
  };

  // a·x² term
  if (a !== 0) {
    terms.push(`${a < 0 ? "-" : ""}${fmtCoef(a, "x²")}`);
  }
  // b·x term
  if (b !== 0) {
    const sign = b < 0 ? "-" : terms.length ? "+" : "";
    terms.push(`${sign}${terms.length ? " " : ""}${fmtCoef(b, "x")}`.trim());
  }
  // c term
  if (c !== 0) {
    const sign = c < 0 ? "-" : terms.length ? "+" : "";
    terms.push(`${sign}${terms.length ? " " : ""}${Math.abs(c)}`.trim());
  }

  if (terms.length === 0) return "y = 0";

  // Join with spaces so leading signs of subsequent terms read like "+ 3".
  return `y = ${terms.join(" ")}`;
}

export function ParabolaSliderStep({
  problem,
  onCorrect,
  disabled,
}: ParabolaSliderStepProps) {
  const { b, c, aMin, aMax, aDefault, xMin, xMax, yMin, yMax } = problem;

  const notifiedRef = useRef(false);
  const seenPositiveRef = useRef(false);
  const seenNegativeRef = useRef(false);

  const [a, setA] = useState<number>(aDefault ?? aMax);
  const [completed, setCompleted] = useState(false);

  // --- Grid geometry (copied from PlotPointStep) --------------------------
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const next = parseFloat(e.target.value);
    setA(next);
    if (next > 0) seenPositiveRef.current = true;
    if (next < 0) seenNegativeRef.current = true;
    if (
      seenPositiveRef.current &&
      seenNegativeRef.current &&
      !notifiedRef.current
    ) {
      notifiedRef.current = true;
      setCompleted(true);
      onCorrect(problem.feedback.correct);
    }
  }

  // --- Sample the parabola ------------------------------------------------
  const curve = curveSegments(
    (x) => a * x * x + b * x + c,
    xMin,
    xMax,
    yMin,
    yMax,
    sx,
    sy
  );

  const concavity =
    a > 0
      ? "Concave up (opens upward): this parabola has a minimum."
      : a < 0
        ? "Concave down (opens downward): this parabola has a maximum."
        : "a = 0: this is no longer a parabola; it's a straight line.";

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

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-label text-muted">
            a = <span className="font-equation text-text">{a}</span>
          </span>
          <span className="font-equation text-equation text-text">
            {formatEquation(a, b, c)}
          </span>
        </div>
        <input
          type="range"
          min={aMin}
          max={aMax}
          step={0.25}
          value={a}
          onChange={handleChange}
          disabled={disabled}
          aria-label="Coefficient a"
          className="w-full accent-primary"
        />
        <p className="text-label text-muted">
          Drag <span className="font-equation">a</span> below zero to see the
          parabola flip upside-down.
        </p>
      </div>

      <div className="relative mt-4 flex justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxWidth: W }}
          role="img"
          aria-label="Parabola plotted on a coordinate grid"
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
          <text x={sx(xMax) - 3} y={sy(0) - 7} textAnchor="end" style={axisLabelStyle}>
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

          {/* the parabola */}
          {curve.map((pts, i) => (
            <polyline
              key={`seg${i}`}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              points={pts}
            />
          ))}
        </svg>
      </div>

      <p className="mt-2 text-center text-label text-muted">{concavity}</p>

      {completed && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{problem.feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
