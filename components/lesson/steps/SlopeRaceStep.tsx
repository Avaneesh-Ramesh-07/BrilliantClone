"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MultipleChoiceOption, SlopeRaceProblem } from "@/types/lesson";

interface SlopeRaceStepProps {
  problem: SlopeRaceProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

// Slope magnitudes the sliders allow. Min 1 keeps the line inside the square
// box (horizontal travel = height / |slope| stays <= width).
const M_MIN = 1;
const M_MAX = 4;
const BASE_MS = 2600;

type Phase = "ready" | "racing" | "finished";

function SlopeGraph({
  slope,
  progress,
  label,
  done,
}: {
  slope: number;
  progress: number;
  label: string;
  done: boolean;
}) {
  const S = 132;
  const margin = 14;
  const mag = Math.abs(slope);
  const top = { x: margin, y: margin };
  const bottom = { x: margin + S / mag, y: margin + S };
  const bx = top.x + (bottom.x - top.x) * progress;
  const by = top.y + (bottom.y - top.y) * progress;
  const W = margin * 2 + S;
  const H = margin * 2 + S;

  const grid = [0.25, 0.5, 0.75];
  const axisLabelStyle = {
    fontSize: 10,
    fontWeight: 700,
    fontStyle: "italic",
    fill: "var(--color-text)",
  } as const;

  return (
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <span className="text-label font-semibold text-text">{label}</span>
        <span className="font-equation text-label text-primary">
          slope = {slope}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full"
        role="img"
        aria-label={`${label} graph with slope ${slope}`}
      >
        <rect
          x={margin}
          y={margin}
          width={S}
          height={S}
          fill="var(--color-bg)"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        {grid.map((g) => (
          <line
            key={`gv${g}`}
            x1={margin + S * g}
            y1={margin}
            x2={margin + S * g}
            y2={margin + S}
            stroke="var(--color-border)"
            strokeWidth={0.5}
          />
        ))}
        {grid.map((g) => (
          <line
            key={`gh${g}`}
            x1={margin}
            y1={margin + S * g}
            x2={margin + S}
            y2={margin + S * g}
            stroke="var(--color-border)"
            strokeWidth={0.5}
          />
        ))}

        {/* axis labels */}
        <text
          x={margin - 4}
          y={margin + S / 2}
          textAnchor="end"
          dominantBaseline="middle"
          style={axisLabelStyle}
        >
          y
        </text>
        <text
          x={margin + S / 2}
          y={margin + S + 11}
          textAnchor="middle"
          style={axisLabelStyle}
        >
          x
        </text>

        {/* finish line at the bottom */}
        <line
          x1={margin}
          y1={margin + S}
          x2={margin + S}
          y2={margin + S}
          stroke="var(--color-success)"
          strokeWidth={2}
          strokeDasharray="4 3"
        />

        {/* the slope (a downward ramp) */}
        <line
          x1={top.x}
          y1={top.y}
          x2={bottom.x}
          y2={bottom.y}
          stroke="var(--color-primary)"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* the ball */}
        <circle
          cx={bx}
          cy={by}
          r={7}
          fill={done ? "var(--color-success)" : "var(--color-primary)"}
          stroke="white"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}

export function SlopeRaceStep({
  problem,
  onCorrect,
  disabled,
}: SlopeRaceStepProps) {
  const [leftSlope, setLeftSlope] = useState(-2);
  const [rightSlope, setRightSlope] = useState(-2);
  const [phase, setPhase] = useState<Phase>("ready");
  const [progress, setProgress] = useState({ left: 0, right: 0 });
  const [choice, setChoice] = useState<string | null>(null);
  const [mcResult, setMcResult] = useState<"correct" | "incorrect" | null>(null);
  const rafRef = useRef<number | null>(null);
  // The engine only needs to be told "solved" once; replays don't re-notify.
  const notifiedRef = useRef(false);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const leftMag = Math.abs(leftSlope);
  const rightMag = Math.abs(rightSlope);
  const tie = leftMag === rightMag;
  const steeperSide = leftMag > rightMag ? "left" : "right";

  const racing = phase === "racing";
  const solved = mcResult === "correct";
  const slidersLocked = disabled || racing || solved;

  function play() {
    if (racing) return;
    setProgress({ left: 0, right: 0 });
    setChoice(null);
    setMcResult(null);
    setPhase("racing");

    const start = performance.now();
    const durLeft = BASE_MS / leftMag;
    const durRight = BASE_MS / rightMag;
    const ease = (t: number) => t * t; // accelerate from rest

    const frame = (now: number) => {
      const tl = Math.min(1, (now - start) / durLeft);
      const tr = Math.min(1, (now - start) / durRight);
      setProgress({ left: ease(tl), right: ease(tr) });
      if (tl < 1 || tr < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        setPhase("finished");
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  }

  function pick(option: MultipleChoiceOption) {
    if (disabled || solved) return;
    setChoice(option.id);
    if (option.correct) {
      setMcResult("correct");
      if (!notifiedRef.current) {
        notifiedRef.current = true;
        onCorrect(problem.feedback.correct);
      }
    } else {
      setMcResult("incorrect");
    }
  }

  function reset() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPhase("ready");
    setProgress({ left: 0, right: 0 });
    setChoice(null);
    setMcResult(null);
  }

  const showQuestion = phase === "finished" && !tie;
  const questionParts = problem.question
    .replace("{side}", steeperSide)
    .split("**");

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>

      <div className="mt-5 flex gap-4">
        <SlopeGraph
          slope={leftSlope}
          progress={progress.left}
          label="Left"
          done={phase === "finished"}
        />
        <SlopeGraph
          slope={rightSlope}
          progress={progress.right}
          label="Right"
          done={phase === "finished"}
        />
      </div>

      {/* slope sliders */}
      <div className="mt-4 flex gap-4">
        {(
          [
            ["Left", leftSlope, setLeftSlope] as const,
            ["Right", rightSlope, setRightSlope] as const,
          ]
        ).map(([name, value, setValue]) => (
          <div key={name} className="flex-1">
            <input
              type="range"
              min={-M_MAX}
              max={-M_MIN}
              step={0.5}
              value={value}
              disabled={slidersLocked}
              onChange={(e) => setValue(parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary disabled:opacity-50"
              aria-label={`${name} graph slope`}
            />
            <div className="mt-1 flex justify-between text-label text-muted">
              <span>steep</span>
              <span>gentle</span>
            </div>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="mt-5 flex justify-center">
        {solved ? (
          <Button type="button" variant="secondary" onClick={reset}>
            ↺ Reset &amp; try different slopes
          </Button>
        ) : (
          <Button type="button" onClick={play} disabled={disabled || racing}>
            {phase === "ready" ? "▶ Play" : racing ? "Racing…" : "▶ Play again"}
          </Button>
        )}
      </div>

      {phase === "finished" && tie && (
        <p className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-center text-body text-muted">
          It&apos;s a tie — both slopes are equal. Make one graph steeper than
          the other, then play again.
        </p>
      )}

      {showQuestion && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-body text-text">
            The ball on the <strong>{steeperSide}</strong> graph reached the
            bottom first.{" "}
            {questionParts.map((part, i) =>
              i % 2 === 1 ? (
                <strong key={i}>{part}</strong>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {problem.options.map((option) => {
              const selected = choice === option.id;
              const showCorrect = selected && option.correct;
              const showWrong = selected && !option.correct;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => pick(option)}
                  disabled={disabled || solved}
                  className={`rounded-lg border px-4 py-3 text-left text-body transition-colors ${
                    showCorrect
                      ? "border-success bg-success/10 text-success"
                      : showWrong
                        ? "border-error bg-error/10 text-error"
                        : "border-border bg-surface text-text hover:border-primary"
                  } disabled:cursor-not-allowed`}
                >
                  {option.text}
                </button>
              );
            })}
          </div>

          {mcResult === "correct" && (
            <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
              <p className="text-body text-success">{problem.feedback.correct}</p>
            </div>
          )}
          {mcResult === "incorrect" && (
            <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
              <p className="text-body text-error">
                {problem.feedback.incorrect ??
                  "Not quite — think about how the steepness of the slope affected the speed. Try again."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
