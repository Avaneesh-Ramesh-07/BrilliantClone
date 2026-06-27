"use client";

import { useEffect, useMemo, useState } from "react";
import { evalExpression } from "@/lib/expression";
import type { GridPlotVisual, GridAnimation } from "@/types/lesson";

interface GridPlotVisualProps {
  visual: GridPlotVisual;
  animation?: GridAnimation;
}

const WIDTH = 280;
const HEIGHT = 200;
const PADDING = 30;

function evalFn(fn: string, x: number): number {
  try {
    return evalExpression(fn, x);
  } catch {
    return 0;
  }
}

export function GridPlotVisual({ visual, animation }: GridPlotVisualProps) {
  const [mounted, setMounted] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showVertical, setShowVertical] = useState(false);

  const xMin = 0;
  const xMax = Math.max(visual.solution + 2, 8);
  const yValues: number[] = [];

  for (let x = xMin; x <= xMax; x += 0.5) {
    yValues.push(evalFn(visual.leftLine.fn, x));
    yValues.push(evalFn(visual.rightLine.fn, x));
  }

  const yMin = Math.min(...yValues, 0) - 1;
  const yMax = Math.max(...yValues) + 1;

  const toX = (x: number) =>
    PADDING + ((x - xMin) / (xMax - xMin)) * (WIDTH - 2 * PADDING);
  const toY = (y: number) =>
    HEIGHT - PADDING - ((y - yMin) / (yMax - yMin)) * (HEIGHT - 2 * PADDING);

  const leftPath = useMemo(() => {
    const points: string[] = [];
    for (let x = xMin; x <= xMax; x += 0.25) {
      const y = evalFn(visual.leftLine.fn, x);
      points.push(`${toX(x)},${toY(y)}`);
    }
    return points.join(" ");
  }, [visual, xMin, xMax, yMin, yMax]);

  const rightPath = useMemo(() => {
    const points: string[] = [];
    for (let x = xMin; x <= xMax; x += 0.25) {
      const y = evalFn(visual.rightLine.fn, x);
      points.push(`${toX(x)},${toY(y)}`);
    }
    return points.join(" ");
  }, [visual, xMin, xMax, yMin, yMax]);

  const solutionX = toX(visual.solution);
  const solutionY = evalFn(visual.leftLine.fn, visual.solution);
  const dotY = toY(solutionY);

  useEffect(() => {
    const t1 = setTimeout(() => setMounted(true), 50);
    const t2 = setTimeout(() => setShowVertical(true), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-3">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {showLeft && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 font-math text-equation text-text shadow-sm">
            <span
              className="inline-block h-2.5 w-4 rounded-sm"
              style={{ backgroundColor: "#3B5BDB" }}
              aria-hidden
            />
            {visual.leftLine.label}
          </span>
        )}
        {showRight && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 font-math text-equation text-text shadow-sm">
            <span
              className="inline-block h-2.5 w-4 rounded-sm"
              style={{ backgroundColor: "#E03131" }}
              aria-hidden
            />
            {visual.rightLine.label}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mx-auto w-full max-w-[280px]"
        aria-label="Coordinate grid showing equation lines"
      >
        {/* Grid lines */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line
            key={`gx-${i}`}
            x1={toX(i)}
            y1={PADDING}
            x2={toX(i)}
            y2={HEIGHT - PADDING}
            stroke="var(--color-border)"
            strokeWidth="0.5"
          />
        ))}

        {/* Axes */}
        <line
          x1={PADDING}
          y1={toY(0)}
          x2={WIDTH - PADDING}
          y2={toY(0)}
          stroke="var(--color-muted)"
          strokeWidth="1"
        />
        <line
          x1={toX(0)}
          y1={PADDING}
          x2={toX(0)}
          y2={HEIGHT - PADDING}
          stroke="var(--color-muted)"
          strokeWidth="1"
        />

        {/* Axis labels */}
        <text
          x={WIDTH - PADDING + 2}
          y={toY(0) - 6}
          textAnchor="end"
          style={{
            fontSize: 13,
            fontWeight: 700,
            fontStyle: "italic",
            fill: "var(--color-text)",
          }}
        >
          x
        </text>
        <text
          x={toX(0) + 7}
          y={PADDING}
          textAnchor="start"
          dominantBaseline="hanging"
          style={{
            fontSize: 13,
            fontWeight: 700,
            fontStyle: "italic",
            fill: "var(--color-text)",
          }}
        >
          y
        </text>

        {showLeft && (
          <polyline
            points={leftPath}
            fill="none"
            stroke="#3B5BDB"
            strokeWidth="2"
            className={mounted ? "animate-line-draw" : "opacity-0"}
          />
        )}

        {showRight && (
          <polyline
            points={rightPath}
            fill="none"
            stroke="#E03131"
            strokeWidth="2"
            strokeDasharray="6 4"
            className={mounted ? "animate-line-draw" : "opacity-0"}
          />
        )}

        {showVertical && animation?.greenVerticalLine !== false && (
          <line
            x1={solutionX}
            y1={HEIGHT - PADDING}
            x2={solutionX}
            y2={PADDING}
            stroke="var(--color-success)"
            strokeWidth="2"
            className="animate-vertical-rise"
          />
        )}

        {mounted && (
          <circle
            cx={solutionX}
            cy={dotY}
            r="5"
            fill="var(--color-success)"
            className="animate-pulse-dot"
          />
        )}
      </svg>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowLeft((v) => !v)}
          className={`rounded px-2 py-1 text-label ${showLeft ? "bg-primary-light text-primary" : "bg-border text-muted"}`}
        >
          {visual.leftLine.label}
        </button>
        <button
          type="button"
          onClick={() => setShowRight((v) => !v)}
          className={`rounded px-2 py-1 text-label ${showRight ? "bg-primary-light text-primary" : "bg-border text-muted"}`}
        >
          {visual.rightLine.label}
        </button>
      </div>
    </div>
  );
}
