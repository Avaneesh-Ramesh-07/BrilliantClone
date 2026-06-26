"use client";

import { useEffect, useMemo, useState } from "react";
import type { PizzaShareProblem } from "@/types/lesson";

interface PizzaShareStepProps {
  problem: PizzaShareProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
  /** When true, suppress the Goal box and standalone success banner (a parent renders them); still call onCorrect on completion. */
  embedded?: boolean;
}

const CX = 110;
const CY = 110;
const R = 96;

const PIZZA_FILL = "#f4c879";
/** Fill for each half once the pizza is cut (1-indexed). */
const HALF_FILLS: Record<1 | 2, string> = {
  1: "#7dd3fc", // sky
  2: "#6ee7b7", // emerald
};

/** Build the SVG path for an equal wedge `i` of `slices`, centered at (CX, CY). */
function wedgePath(i: number, slices: number): string {
  const a0 = (i / slices) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / slices) * Math.PI * 2 - Math.PI / 2;
  const x0 = CX + R * Math.cos(a0);
  const y0 = CY + R * Math.sin(a0);
  const x1 = CX + R * Math.cos(a1);
  const y1 = CY + R * Math.sin(a1);
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1} Z`;
}

/** Point on the circle of `radius` at slice boundary `b` (between slice b-1 and b). */
function boundaryPoint(b: number, slices: number, radius: number) {
  const a = (b / slices) * Math.PI * 2 - Math.PI / 2;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

/** A stacked numerator-over-denominator fraction in the equation font. */
function Fraction({
  num,
  den,
  highlightDen,
}: {
  num: string;
  den: string;
  highlightDen?: boolean;
}) {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="px-2 pb-1">{num}</span>
      <span className="h-px w-full bg-current" />
      <span
        className={`px-2 pt-1 ${
          highlightDen ? "font-bold text-primary" : ""
        }`}
      >
        {den}
      </span>
    </span>
  );
}

export function PizzaShareStep({
  problem,
  onCorrect,
  disabled,
  embedded,
}: PizzaShareStepProps) {
  const { variable, feedback } = problem;
  // Support up to 2 people per the content contract → a single straight cut.
  const people = Math.min(Math.max(problem.people, 1), 2);
  const slices = problem.slices;
  const share = slices / people;
  const half = Math.round(slices / 2);
  const divisionsNeeded = people - 1;

  const paths = useMemo(
    () => Array.from({ length: slices }, (_, i) => wedgePath(i, slices)),
    [slices]
  );

  // Slice boundary the cut runs through (a diameter through it and its opposite),
  // or null before a cut is made.
  const [cutAt, setCutAt] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Staggered reveal of the equation transformation after the cut.
  const [revealStep, setRevealStep] = useState(0);
  const [done, setDone] = useState(false);

  const isCut = cutAt !== null;
  const interactive = !disabled && !isCut && !done && people > 1;

  // Trivial 1-person case (no real division): just resolve.
  useEffect(() => {
    if (people === 1 && !done) {
      setDone(true);
      onCorrect(feedback.correct);
    }
  }, [people, done, onCorrect, feedback.correct]);

  // After the cut, stagger the "divide both sides" reveal, then resolve once.
  useEffect(() => {
    if (!isCut) return;
    const t1 = setTimeout(() => setRevealStep(1), 600);
    const t2 = setTimeout(() => setRevealStep(2), 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isCut]);

  useEffect(() => {
    if (isCut && revealStep >= 2 && !done) {
      setDone(true);
      onCorrect(feedback.correct);
    }
  }, [isCut, revealStep, done, onCorrect, feedback.correct]);

  function makeCut(b: number) {
    if (!interactive) return;
    setCutAt(b);
    setHover(null);
  }

  // The boundary currently driving the visuals: the committed cut, else the hover.
  const activeBoundary = cutAt ?? hover;

  function halfOf(i: number): 0 | 1 | 2 {
    if (activeBoundary === null) return 0;
    const rel = (i - activeBoundary + slices) % slices;
    return rel < half ? 1 : 2;
  }

  function fillFor(i: number): string {
    const h = halfOf(i);
    if (h === 0) return PIZZA_FILL;
    return HALF_FILLS[h];
  }

  // Endpoints of the straight cut (a diameter) for the active boundary.
  const cutLine =
    activeBoundary !== null
      ? {
          a: boundaryPoint(activeBoundary, slices, R + 6),
          b: boundaryPoint(activeBoundary + half, slices, R + 6),
        }
      : null;

  return (
    <div>
      {!embedded && (
        <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
          <p className="text-label font-semibold text-primary">Goal</p>
          <p className="mt-0.5 text-body text-text">{problem.prompt}</p>
        </div>
      )}

      <p className="mt-5 text-body text-text">{problem.question}</p>

      {!isCut && people > 1 && (
        <p className="mt-2 text-body text-text">
          {people} people need to share this fairly. Make{" "}
          <span className="font-semibold">
            {divisionsNeeded} straight {divisionsNeeded === 1 ? "cut" : "cuts"}
          </span>{" "}
          through the center — click a notch on the crust to slice straight
          across.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-border bg-bg/60 p-5">
        <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-center">
          {/* Pizza */}
          <div className="flex shrink-0 flex-col items-center gap-3">
            <svg
              viewBox="0 0 220 220"
              className="h-56 w-56"
              role="img"
              aria-label={`Pizza cut into ${slices} equal slices`}
            >
              {/* crust ring */}
              <circle
                cx={CX}
                cy={CY}
                r={R + 5}
                fill="#d9a441"
                stroke="#b9842f"
                strokeWidth={2}
              />
              {paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={fillFor(i)}
                  stroke="#b9842f"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  className="transition-colors duration-200"
                />
              ))}

              {/* Cut line (preview while hovering, bold once committed) */}
              {cutLine && (
                <line
                  x1={cutLine.a.x}
                  y1={cutLine.a.y}
                  x2={cutLine.b.x}
                  y2={cutLine.b.y}
                  stroke={isCut ? "#1f2937" : "#6b7280"}
                  strokeWidth={isCut ? 5 : 3}
                  strokeLinecap="round"
                  strokeDasharray={isCut ? undefined : "6 6"}
                  className="transition-all duration-200"
                />
              )}

              {/* Boundary handles to choose where to cut */}
              {interactive &&
                Array.from({ length: slices }, (_, b) => {
                  const p = boundaryPoint(b, slices, R + 5);
                  const opp = boundaryPoint(b + half, slices, R + 5);
                  return (
                    <g key={b}>
                      {/* large invisible hit target */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={12}
                        fill="transparent"
                        className="cursor-pointer"
                        onClick={() => makeCut(b)}
                        onMouseEnter={() => setHover(b)}
                        onMouseLeave={() =>
                          setHover((h) => (h === b ? null : h))
                        }
                        role="button"
                        aria-label={`Cut straight across at this notch`}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={hover === b ? 6 : 4}
                        fill={hover === b ? "#1f2937" : "#9ca3af"}
                        className="pointer-events-none transition-all duration-150"
                      />
                      <circle
                        cx={opp.x}
                        cy={opp.y}
                        r={hover === b ? 6 : 4}
                        fill={hover === b ? "#1f2937" : "#9ca3af"}
                        className="pointer-events-none transition-all duration-150"
                      />
                    </g>
                  );
                })}
            </svg>

            {isCut && (
              <p className="text-center text-label text-muted">
                One cut → {people} equal halves of {share}{" "}
                {share === 1 ? "slice" : "slices"}.
              </p>
            )}
          </div>

          {/* Equation — kept central and prominent: cutting in half is dividing
              both sides by the number that multiplies x. */}
          <div className="flex-1 rounded-xl border-2 border-primary/40 bg-primary-light/60 px-5 py-6">
            <p className="text-center text-label font-semibold uppercase tracking-wide text-primary">
              {isCut ? `Divide both sides by ${people}` : "Both sides"}
            </p>

            <div className="mt-4 flex min-h-[7rem] flex-col items-center justify-center gap-3 font-equation text-text">
              {!isCut ? (
                <span className="whitespace-nowrap text-4xl font-semibold">
                  {people}
                  {variable} = {slices}
                </span>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-3xl">
                    <Fraction
                      num={`${people}${variable}`}
                      den={`${people}`}
                      highlightDen
                    />
                    <span>=</span>
                    <Fraction num={`${slices}`} den={`${people}`} highlightDen />
                  </div>
                  {revealStep >= 1 && (
                    <span className="whitespace-nowrap text-2xl text-muted transition-opacity duration-300">
                      {variable} = {slices} / {people}
                    </span>
                  )}
                  {revealStep >= 2 && (
                    <span className="whitespace-nowrap text-4xl font-bold text-primary transition-opacity duration-300">
                      {variable} = {share}
                    </span>
                  )}
                </>
              )}
            </div>

            <p className="mt-4 text-center text-label text-muted">
              {isCut ? (
                `Cutting the pizza in half does the same thing to the food as dividing both sides by ${people} does to the equation.`
              ) : (
                <>
                  Cutting the pizza fairly forces each person to get{" "}
                  <span className="whitespace-nowrap font-equation font-semibold text-text">
                    {slices} / {people} = {share}
                  </span>
                  . That&apos;s the same as dividing both sides by {people}.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {!embedded && done && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
