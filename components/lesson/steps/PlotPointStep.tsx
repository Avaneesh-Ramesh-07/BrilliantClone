"use client";

import { useRef, useState } from "react";
import type { PlotPointProblem } from "@/types/lesson";

interface PlotPointStepProps {
  problem: PlotPointProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

interface Point {
  x: number;
  y: number;
}

export function PlotPointStep({
  problem,
  onCorrect,
  disabled,
}: PlotPointStepProps) {
  const { targetX, targetY, xMin, xMax, yMin, yMax } = problem;
  const svgRef = useRef<SVGSVGElement>(null);
  const notifiedRef = useRef(false);

  const [hover, setHover] = useState<Point | null>(null);
  const [clicked, setClicked] = useState<Point | null>(null);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const solved = result === "correct";

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

  function toData(e: React.MouseEvent): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    const dx = Math.round((loc.x - margin) / cell + xMin);
    const dy = Math.round(yMax - (loc.y - margin) / cell);
    if (dx < xMin || dx > xMax || dy < yMin || dy > yMax) return null;
    return { x: dx, y: dy };
  }

  function handleMove(e: React.MouseEvent) {
    if (disabled || solved) return;
    setHover(toData(e));
  }

  function handleClick(e: React.MouseEvent) {
    if (disabled || solved) return;
    const p = toData(e);
    if (!p) return;
    setClicked(p);
    if (p.x === targetX && p.y === targetY) {
      setResult("correct");
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onCorrect(problem.feedback.correct);
      }
    } else {
      setResult("incorrect");
    }
  }

  const readout = hover ?? clicked;
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
      <p className="mt-2 text-label text-muted">
        Hover over the grid to read off coordinates, then click the point you&apos;re
        plotting.
      </p>

      <div className="relative mt-4 flex justify-center">
        <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-equation text-equation text-text shadow-sm">
          {readout
            ? `(x = ${readout.x}, y = ${readout.y})`
            : "Move your mouse over the grid"}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{
            maxWidth: W,
            cursor: disabled || solved ? "default" : "crosshair",
          }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          onClick={handleClick}
          role="img"
          aria-label="Coordinate grid — click the point you are solving for"
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

          {/* hover crosshair point */}
          {hover && !solved && (
            <circle
              cx={sx(hover.x)}
              cy={sy(hover.y)}
              r={5}
              fill="var(--color-primary)"
              fillOpacity={0.25}
              stroke="var(--color-primary)"
              strokeWidth={1.5}
            />
          )}

          {/* clicked point */}
          {clicked && (
            <circle
              cx={sx(clicked.x)}
              cy={sy(clicked.y)}
              r={7}
              fill={
                result === "correct"
                  ? "var(--color-success)"
                  : "var(--color-error)"
              }
              stroke="white"
              strokeWidth={2}
            />
          )}
        </svg>
      </div>

      {result === "incorrect" && clicked && (
        <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
          <p className="text-body text-error">
            You clicked ({clicked.x}, {clicked.y}).{" "}
            {problem.feedback.incorrect ??
              "That isn't the point — try again."}
          </p>
        </div>
      )}
      {result === "correct" && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{problem.feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
