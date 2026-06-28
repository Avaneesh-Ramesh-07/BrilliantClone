"use client";

import { useMemo, useState } from "react";
import type { BalanceChoiceProblem } from "@/types/lesson";

interface BalanceChoiceStepProps {
  problem: BalanceChoiceProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
  /** When true, suppress the Goal box and standalone success banner (a parent renders them). */
  embedded?: boolean;
}

type OptionId = "both" | "left" | "right";

interface Option {
  id: OptionId;
  label: string;
  correct: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function BalanceChoiceStep({
  problem,
  onCorrect,
  disabled,
  embedded,
}: BalanceChoiceStepProps) {
  const { variable, coefficient, rightValue, feedback } = problem;
  const quotient = rightValue / coefficient;

  const options = useMemo<Option[]>(
    () =>
      shuffle([
        {
          id: "both",
          label: `Divide both sides by ${coefficient}`,
          correct: true,
        },
        {
          id: "left",
          label: `Divide only the left by ${coefficient}`,
          correct: false,
        },
        {
          id: "right",
          label: `Divide only the right by ${coefficient}`,
          correct: false,
        },
      ]),
    [coefficient]
  );

  const [picked, setPicked] = useState<OptionId | null>(null);
  const [solved, setSolved] = useState(false);

  const interactive = !disabled && !solved;

  function handlePick(id: OptionId) {
    if (!interactive) return;
    setPicked(id);
    if (id === "both") {
      setSolved(true);
      onCorrect(feedback.correct);
    }
  }

  // Weights of each pan after the chosen (or pending) move. Equal weights → the
  // beam is level; otherwise the heavier side drops.
  const leftWeight =
    picked === "left" || picked === "both" ? quotient : rightValue;
  const rightWeight =
    picked === "right" || picked === "both" ? quotient : rightValue;
  const balanced = leftWeight === rightWeight;
  // Positive angle drops the right side; negative drops the left.
  const tilt = balanced ? 0 : leftWeight > rightWeight ? -12 : 12;

  // Pan expressions (what each side reads as) after the move.
  const leftExpr =
    picked === "left" || picked === "both"
      ? variable
      : `${coefficient}${variable}`;
  const rightExpr =
    picked === "right" || picked === "both" ? `${quotient}` : `${rightValue}`;

  const explanation = (() => {
    if (picked === "both") {
      return `Balanced. Doing the same thing to both sides keeps the scale level, and it isolates the variable: ${variable} = ${quotient}.`;
    }
    if (picked === "left") {
      return `The left now weighs less than the right, so the beam tips down on the right. You changed only one side, so the two sides are no longer equal, which breaks the equation.`;
    }
    if (picked === "right") {
      return `The right now weighs less than the left, so the beam tips down on the left. Changing only one side makes the sides unequal, which breaks the equation.`;
    }
    return `The scale starts level because ${coefficient}${variable} and ${rightValue} weigh the same. Keep it level: whatever you do, do it to both sides.`;
  })();

  return (
    <div>
      {!embedded && (
        <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
          <p className="text-label font-semibold text-primary">Goal</p>
          <p className="mt-0.5 text-body text-text">{problem.prompt}</p>
        </div>
      )}

      <p className="mt-5 text-body text-text">{problem.question}</p>

      <div className="mt-6 rounded-xl border border-border bg-bg/60 p-5">
        {/* Balance beam */}
        <div className="flex justify-center">
          <svg
            viewBox="0 0 320 220"
            className="h-52 w-full max-w-md"
            role="img"
            aria-label={`Balance scale comparing ${leftExpr} and ${rightExpr}`}
          >
            {/* Pivot post + base */}
            <rect x={154} y={70} width={12} height={120} rx={3} fill="#9ca3af" />
            <polygon points="120,196 200,196 180,176 140,176" fill="#9ca3af" />

            {/* Rotating beam group (beam + pans) */}
            <g
              transform={`rotate(${tilt} 160 78)`}
              style={{ transition: "transform 600ms cubic-bezier(0.34,1.56,0.64,1)" }}
            >
              {/* beam */}
              <rect x={40} y={72} width={240} height={12} rx={6} fill="#6b7280" />
              <circle cx={160} cy={78} r={9} fill="#4b5563" />

              {/* left pan */}
              <line x1={64} y1={78} x2={64} y2={118} stroke="#9ca3af" strokeWidth={3} />
              <path
                d="M 30 118 L 98 118 L 88 144 L 40 144 Z"
                fill="#bfdbfe"
                stroke="#60a5fa"
                strokeWidth={2}
              />
              <text
                x={64}
                y={136}
                textAnchor="middle"
                className="font-equation"
                fontSize={20}
                fill="#1f2937"
              >
                {leftExpr}
              </text>

              {/* right pan */}
              <line x1={256} y1={78} x2={256} y2={118} stroke="#9ca3af" strokeWidth={3} />
              <path
                d="M 222 118 L 290 118 L 280 144 L 232 144 Z"
                fill="#bbf7d0"
                stroke="#34d399"
                strokeWidth={2}
              />
              <text
                x={256}
                y={136}
                textAnchor="middle"
                className="font-equation"
                fontSize={20}
                fill="#1f2937"
              >
                {rightExpr}
              </text>
            </g>
          </svg>
        </div>

        {/* Balance status */}
        <div className="mt-2 flex justify-center">
          {picked !== null &&
            (balanced ? (
              <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-label font-semibold text-success">
                ✓ Balanced: both sides still equal
              </span>
            ) : (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-label font-semibold text-amber-700">
                ✗ Not balanced: the sides are no longer equal
              </span>
            ))}
        </div>

        {/* Choices */}
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {options.map((opt) => {
            const isPicked = picked === opt.id;
            const state =
              isPicked && opt.correct
                ? "border-success bg-success/10 text-success"
                : isPicked && !opt.correct
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-border bg-surface text-text hover:border-primary/40";
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handlePick(opt.id)}
                disabled={!interactive}
                className={`rounded-lg border px-3 py-2.5 text-left text-body font-medium transition-colors ${state} ${
                  interactive ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        <p
          className={`mt-4 text-body ${
            picked === null
              ? "text-muted"
              : balanced
                ? "text-success"
                : "text-amber-700"
          }`}
        >
          {explanation}
        </p>
      </div>

      {!embedded && solved && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
