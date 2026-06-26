"use client";

import { useRef, useState } from "react";
import type { GraphLineProblem } from "@/types/lesson";
import { curveSegments } from "@/lib/plot";
import { EquationBadge } from "@/components/lesson/EquationBadge";
import { MathText } from "@/components/lesson/MathText";

interface GraphLineStepProps {
  problem: GraphLineProblem;
  onCorrect: (feedback: string) => void;
  onIncorrect: (feedback: string) => void;
  disabled?: boolean;
}

interface Point {
  x: number;
  y: number;
}

type Stage = "intercept" | "second" | "done";

export function GraphLineStep({
  problem,
  onCorrect,
  onIncorrect,
  disabled,
}: GraphLineStepProps) {
  const { slope, intercept, xMin, xMax, yMin, yMax } = problem;
  const svgRef = useRef<SVGSVGElement>(null);
  const notifiedRef = useRef(false);

  const [stage, setStage] = useState<Stage>("intercept");
  const [interceptPt, setInterceptPt] = useState<Point | null>(null);
  const [secondPt, setSecondPt] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [wrong, setWrong] = useState<Point | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const solved = stage === "done";

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

  // The full line is revealed only once both points are placed correctly.
  const lineSegments = solved
    ? curveSegments((x) => slope * x + intercept, xMin, xMax, yMin, yMax, sx, sy)
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

    if (stage === "intercept") {
      if (p.x === 0 && p.y === intercept) {
        setInterceptPt(p);
        setWrong(null);
        setMessage(null);
        setStage("second");
      } else {
        setWrong(p);
        setMessage(
          "That isn't the y-intercept. The y-intercept is where the line crosses the y-axis (x = 0)."
        );
        onIncorrect(
          problem.feedback.incorrect ?? "That isn't the y-intercept — try again."
        );
      }
      return;
    }

    // stage === "second": any other lattice point that lies on the line.
    const onLine = p.y === slope * p.x + intercept;
    if (onLine && !(p.x === 0 && p.y === intercept)) {
      setSecondPt(p);
      setWrong(null);
      setMessage(null);
      setStage("done");
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onCorrect(problem.feedback.correct);
      }
    } else {
      setWrong(p);
      setMessage(
        "That point isn't on the line. From the intercept, use the slope (rise over run) to step to another point."
      );
      onIncorrect(
        problem.feedback.incorrect ?? "That point isn't on the line — try again."
      );
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
    stage === "intercept"
      ? "Step 1: click the y-intercept."
      : stage === "second"
        ? "Step 2: click another point on the line using the slope."
        : "Nice — that's the line!";

  return (
    <div>
      <p className="text-body text-text">
        <MathText text={problem.prompt} />
      </p>
      <EquationBadge
        equation={problem.equationLabel}
        label="Graph this line"
        className="mt-3"
      />
      <p className="mt-3 text-label text-muted">{instruction}</p>

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
          aria-label="Coordinate grid — plot the line"
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

          {/* revealed line */}
          {lineSegments.map((pts, i) => (
            <polyline
              key={`seg${i}`}
              points={pts}
              fill="none"
              stroke="var(--color-success)"
              strokeWidth={2.5}
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

          {/* placed intercept point */}
          {interceptPt && (
            <circle
              cx={sx(interceptPt.x)}
              cy={sy(interceptPt.y)}
              r={7}
              fill="var(--color-success)"
              stroke="white"
              strokeWidth={2}
            />
          )}

          {/* placed second point */}
          {secondPt && (
            <circle
              cx={sx(secondPt.x)}
              cy={sy(secondPt.y)}
              r={7}
              fill="var(--color-success)"
              stroke="white"
              strokeWidth={2}
            />
          )}

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
        <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
          <p className="text-body text-error">
            <MathText text={message} />
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
