"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ParabolaBallsProblem } from "@/types/lesson";
import { curveSegments } from "@/lib/plot";
import { MathText } from "@/components/lesson/MathText";

interface ParabolaBallsStepProps {
  problem: ParabolaBallsProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

type Phase = "ready" | "playing" | "done";

interface Ball {
  key: number;
  x: number;
  y: number;
  /** Rendered fill colour: success once the ball has reached its goal. */
  success: boolean;
  opacity: number;
}

/** Per-ball sub-phase used by the physics integrator. */
type Stage = "fall" | "roll" | "rest" | "off";

interface BallState {
  key: number;
  /** Horizontal position in graph units. */
  x: number;
  /** Vertical position in graph units (tracked explicitly during free-fall). */
  y: number;
  /** Tangential (horizontal) velocity while rolling along the curve. */
  v: number;
  /** Vertical velocity while free-falling (drop-max phase 1). */
  vy: number;
  /** x-position this ball is meant to settle at. */
  target: number;
  stage: Stage;
  winner: boolean;
  success: boolean;
  opacity: number;
}

// --- Physics tuning (graph units, seconds) --------------------------------
// Fixed timestep keeps the integrator stable regardless of frame rate.
const FIXED_DT = 1 / 120;
// Hard cap so the demo ALWAYS finishes and calls onCorrect.
const TIME_CAP_MS = 6000;
// Gravity magnitude for the slope-projected acceleration on the curve.
const GRAVITY = 30;
// Linear damping (per second) that bleeds energy so balls settle.
const ROLL_DAMP = 1.4;
// Damped-spring constants used to pull settle-roots balls onto a root.
const ROOT_K = 16;
const ROOT_DAMP = 4.5;
// Free-fall acceleration for drop-max.
const FALL_G = 26;
// How fast losing balls fade after rolling off the peak.
const FADE_RATE = 1.2;
// Settle thresholds.
const V_EPS = 0.04;
const X_EPS = 0.025;

export function ParabolaBallsStep({
  problem,
  onCorrect,
  disabled,
}: ParabolaBallsStepProps) {
  const { a, b, c, xMin, xMax, yMin, yMax, mode, ballStartXs } = problem;

  const [phase, setPhase] = useState<Phase>("ready");
  const [balls, setBalls] = useState<Ball[]>([]);
  const rafRef = useRef<number | null>(null);
  // Live physics state for every ball; mutated in place each fixed step.
  const stateRef = useRef<BallState[]>([]);
  // The engine only needs to be told "solved" once; replays don't re-notify.
  const notifiedRef = useRef(false);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // --- Curve maths --------------------------------------------------------
  const curve = (x: number) => a * x * x + b * x + c;
  const slope = (x: number) => 2 * a * x + b; // f'(x)
  const vertexX = a !== 0 ? -b / (2 * a) : 0;
  const disc = b * b - 4 * a * c;
  const hasRoots = disc >= 0;
  const root1 = hasRoots ? (-b - Math.sqrt(disc)) / (2 * a) : vertexX;
  const root2 = hasRoots ? (-b + Math.sqrt(disc)) / (2 * a) : vertexX;

  function nearestRoot(x: number): number {
    if (!hasRoots) return vertexX;
    return Math.abs(x - root1) <= Math.abs(x - root2) ? root1 : root2;
  }

  // --- Grid geometry (mirrors PlotPointStep) ------------------------------
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
  const clampY = (y: number) => Math.max(yMin, Math.min(yMax, y));
  // The y = 0 line acts as a floor: in settle-roots mode balls never render
  // below it (so a slight spring overshoot can't pass through the ground).
  const floorY = (y: number) => (mode === "settle-roots" ? Math.max(0, y) : y);

  const xTicks: number[] = [];
  for (let i = Math.ceil(xMin); i <= Math.floor(xMax); i++) xTicks.push(i);
  const yTicks: number[] = [];
  for (let i = Math.ceil(yMin); i <= Math.floor(yMax); i++) yTicks.push(i);

  // --- Parabola polyline (broken where it exits the view) -----------------
  const curveSegs = curveSegments(curve, xMin, xMax, yMin, yMax, sx, sy);

  // --- Simulation helpers -------------------------------------------------
  /** Build the starting physics state for the current mode. */
  function initialState(): BallState[] {
    return ballStartXs.map((startX, key) => {
      const winner = mode === "drop-max" && Math.abs(startX - vertexX) < 0.5;
      const target =
        mode === "settle-roots"
          ? nearestRoot(startX)
          : mode === "settle-min"
            ? vertexX
            : startX;
      return {
        key,
        x: startX,
        // drop-max balls begin at the very top and fall down onto the curve.
        y: mode === "drop-max" ? yMax : curve(startX),
        v: 0,
        vy: 0,
        target,
        stage: mode === "drop-max" ? "fall" : "roll",
        winner,
        success: false,
        opacity: 1,
      };
    });
  }

  /** Snapshot the physics state into the renderable ball shape. */
  function render(states: BallState[]): Ball[] {
    return states.map((s) => ({
      key: s.key,
      x: s.x,
      y: s.y,
      success: s.success,
      opacity: s.opacity,
    }));
  }

  /** Advance one ball by a fixed timestep. */
  function stepBall(s: BallState, dt: number) {
    if (s.stage === "rest" || s.stage === "off") return;

    if (s.stage === "fall") {
      // Drop-max phase 1: free-fall straight down under gravity.
      s.vy -= FALL_G * dt;
      s.y += s.vy * dt;
      const landY = curve(s.x);
      if (s.y <= landY) {
        s.y = landY;
        s.vy = 0;
        if (s.winner) {
          // The peak ball balances and stays put.
          s.stage = "rest";
          s.success = true;
        } else {
          // Everything else tips off the peak and rolls down a slope.
          s.stage = "roll";
          s.v = (s.x < vertexX ? -1 : 1) * 0.5;
        }
      }
      return;
    }

    // Rolling along the curve.
    if (mode === "settle-roots") {
      // Damped spring pulls the ball onto its nearest root (gravity alone
      // would settle at the vertex, not a root).
      const ax = -ROOT_K * (s.x - s.target) - ROOT_DAMP * s.v;
      s.v += ax * dt;
      s.x += s.v * dt;
      s.y = curve(s.x);
      return;
    }

    // settle-min and drop-max roll-off: gravity projected along the slope.
    const fp = slope(s.x);
    const ax = (-GRAVITY * fp) / (1 + fp * fp);
    s.v += ax * dt;
    s.v -= ROLL_DAMP * s.v * dt;
    s.x += s.v * dt;
    s.y = curve(s.x);

    if (mode === "drop-max") {
      // Losing balls fade as they slide off the sides.
      s.opacity -= FADE_RATE * dt;
      if (s.opacity <= 0 || s.x <= xMin || s.x >= xMax) {
        s.opacity = 0;
        s.stage = "off";
      }
    } else if (Math.abs(s.v) < V_EPS && Math.abs(s.x - s.target) < X_EPS) {
      // settle-min: locked onto the vertex.
      s.v = 0;
      s.x = s.target;
      s.y = curve(s.target);
      s.stage = "rest";
      s.success = true;
    }
  }

  /** Have all balls reached a terminal stage? */
  function allSettled(states: BallState[]): boolean {
    return states.every((s) => s.stage === "rest" || s.stage === "off");
  }

  /** Force every ball to its exact final state (used at the time cap). */
  function snapToTargets(states: BallState[]) {
    for (const s of states) {
      if (mode === "drop-max") {
        if (s.winner) {
          s.x = s.target;
          s.y = curve(s.target);
          s.success = true;
          s.stage = "rest";
        } else {
          s.opacity = 0;
          s.stage = "off";
        }
      } else {
        s.x = s.target;
        s.y = curve(s.target);
        s.v = 0;
        s.success = true;
        s.stage = "rest";
      }
    }
  }

  // --- Animation control --------------------------------------------------
  function play() {
    if (disabled) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    stateRef.current = initialState();
    setBalls(render(stateRef.current));
    setPhase("playing");

    const startTime = performance.now();
    let last = startTime;
    let acc = 0;

    const finish = () => {
      rafRef.current = null;
      setPhase("done");
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onCorrect(problem.feedback.correct);
      }
    };

    const frame = (now: number) => {
      const elapsed = now - startTime;
      let frameMs = now - last;
      last = now;
      // Guard against tab-switch hitches producing a huge dt.
      if (frameMs > 100) frameMs = 100;
      acc += frameMs / 1000;
      while (acc >= FIXED_DT) {
        for (const s of stateRef.current) stepBall(s, FIXED_DT);
        acc -= FIXED_DT;
      }

      const capped = elapsed >= TIME_CAP_MS;
      if (capped) snapToTargets(stateRef.current);
      setBalls(render(stateRef.current));

      if (capped || allSettled(stateRef.current)) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }

  // Before the first play we still want to show balls at their start points.
  const displayBalls = balls.length > 0 ? balls : render(initialState());

  const solved = phase === "done";
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
      <p className="mt-2 font-math text-equation text-primary">
        {problem.equationLabel}
      </p>

      <div className="mt-4 flex justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ maxWidth: W }}
          role="img"
          aria-label={`Parabola ${problem.equationLabel} with animated balls`}
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

          {/* Bold x-axis "floor" (y = 0) with subtle ground shading, ONLY for
              the solutions demo, where balls come to rest ON this line at the
              crossings. The min/max demos use the plain grid axis instead. */}
          {mode === "settle-roots" && (
            <>
              <rect
                x={margin}
                y={sy(0)}
                width={plotW}
                height={Math.max(0, H - margin - sy(0))}
                fill="var(--color-muted)"
                opacity={0.1}
              />
              <line
                x1={sx(xMin)}
                y1={sy(0)}
                x2={sx(xMax)}
                y2={sy(0)}
                stroke="var(--color-text)"
                strokeWidth={4}
                strokeLinecap="round"
              />
            </>
          )}

          {/* the parabola */}
          {curveSegs.map((pts, i) => (
            <polyline
              key={`seg${i}`}
              points={pts}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeOpacity={0.7}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* the balls */}
          {displayBalls.map((ball) => (
            <circle
              key={ball.key}
              cx={sx(ball.x)}
              cy={sy(clampY(floorY(ball.y)))}
              r={7}
              fill={
                ball.success
                  ? "var(--color-success)"
                  : "var(--color-primary)"
              }
              fillOpacity={ball.opacity}
              stroke="white"
              strokeWidth={2}
              strokeOpacity={ball.opacity}
            />
          ))}
        </svg>
      </div>

      {!solved && (
        <div className="mt-5 flex justify-center gap-3">
          <Button
            type="button"
            onClick={play}
            disabled={disabled || phase === "playing"}
          >
            {phase === "playing" ? "Playing…" : "▶ Play"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={play}
            disabled={disabled || phase === "ready"}
          >
            ↺ Replay
          </Button>
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
