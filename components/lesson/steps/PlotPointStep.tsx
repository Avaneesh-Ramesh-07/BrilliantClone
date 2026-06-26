"use client";

import { useRef, useState } from "react";
import type { PlotPointProblem } from "@/types/lesson";
import { MathText } from "@/components/lesson/MathText";
import { curveSegments } from "@/lib/plot";

interface PlotPointStepProps {
  problem: PlotPointProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

interface Point {
  x: number;
  y: number;
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function PlotPointStep({
  problem,
  onCorrect,
  disabled,
}: PlotPointStepProps) {
  const { targetX, targetY, xMin, xMax, yMin, yMax, a, b, c } = problem;
  const svgRef = useRef<SVGSVGElement>(null);
  const notifiedRef = useRef(false);

  // Normalize the answer key to a list. Multi-target problems (pick BOTH roots)
  // pass `targets`; legacy single-point problems fall back to targetX/targetY.
  const targetList: Point[] =
    problem.targets && problem.targets.length > 0
      ? problem.targets
      : [{ x: targetX, y: targetY }];
  const requireAll = problem.requireAll ?? targetList.length > 1;
  const totalNeeded = requireAll ? targetList.length : 1;

  // Draw the quadratic when the problem provides its coefficients, so the
  // learner reads the crossings off a visible curve (rather than a bare grid).
  const hasCurve = a !== undefined && b !== undefined && c !== undefined;

  const [hover, setHover] = useState<Point | null>(null);
  const [found, setFound] = useState<Point[]>([]);
  const [wrong, setWrong] = useState<Point | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(
    null
  );
  const solved = found.length >= totalNeeded;

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

  const curveSegs = hasCurve
    ? curveSegments(
        (x) => a! * x * x + b! * x + c!,
        xMin,
        xMax,
        yMin,
        yMax,
        sx,
        sy
      )
    : [];

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

    // Already found this one? Ignore.
    if (found.some((f) => samePoint(f, p))) return;

    const isTarget = targetList.some((t) => samePoint(t, p));
    if (isTarget) {
      const nextFound = [...found, p];
      setFound(nextFound);
      setWrong(null);
      if (nextFound.length >= totalNeeded) {
        setMessage(null);
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          onCorrect(problem.feedback.correct);
        }
      } else {
        const remaining = totalNeeded - nextFound.length;
        setMessage({
          text:
            remaining === 1
              ? "Found one — now pick the other crossing."
              : `Found one — ${remaining} more to go.`,
          error: false,
        });
      }
    } else {
      setWrong(p);
      setMessage({
        text:
          `You clicked (${p.x}, ${p.y}). ` +
          (problem.feedback.incorrect ?? "That isn't a crossing — try again."),
        error: true,
      });
    }
  }

  const readout = hover ?? wrong;
  const labelStyle = { fontSize: 9, fill: "var(--color-muted)" } as const;
  const axisLabelStyle = {
    fontSize: 12,
    fontWeight: 700,
    fontStyle: "italic",
    fill: "var(--color-text)",
  } as const;

  const instruction =
    totalNeeded > 1
      ? `Click BOTH points where the curve crosses the x-axis. (${found.length}/${totalNeeded} found)`
      : "Hover over the grid to read off coordinates, then click the point you're plotting.";

  return (
    <div>
      <p className="text-body text-text">
        <MathText text={problem.prompt} />
      </p>
      <p className="mt-2 text-label normal-case tracking-normal text-muted">
        {instruction}
      </p>

      <div className="relative mt-4 flex justify-center">
        <div className="pointer-events-none absolute right-2 top-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-math text-equation text-text shadow-sm">
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

          {/* the quadratic curve (when coefficients are provided) */}
          {curveSegs.map((pts, i) => (
            <polyline
              key={`seg${i}`}
              points={pts}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

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

          {/* found target points */}
          {found.map((f) => (
            <circle
              key={`f${f.x},${f.y}`}
              cx={sx(f.x)}
              cy={sy(f.y)}
              r={7}
              fill="var(--color-success)"
              stroke="white"
              strokeWidth={2}
            />
          ))}

          {/* last wrong click */}
          {wrong && !solved && (
            <circle
              cx={sx(wrong.x)}
              cy={sy(wrong.y)}
              r={7}
              fill="var(--color-error)"
              stroke="white"
              strokeWidth={2}
            />
          )}
        </svg>
      </div>

      {message && !solved && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 ${
            message.error
              ? "border-error/40 bg-error/5"
              : "border-primary/40 bg-primary-light"
          }`}
        >
          <p className={`text-body ${message.error ? "text-error" : "text-primary"}`}>
            <MathText text={message.text} />
          </p>
        </div>
      )}
      {solved && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">
            <MathText text={problem.feedback.correct} />
          </p>
        </div>
      )}
    </div>
  );
}
