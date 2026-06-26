"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { QuadraticFormulaProblem } from "@/types/lesson";
import { Fraction } from "@/components/lesson/Fraction";

interface QuadraticFormulaStepProps {
  problem: QuadraticFormulaProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
  /** When true, suppress the Goal box and standalone success banner. */
  embedded?: boolean;
}

type SlotKey = "a" | "b" | "c";

/** Render a number using a real minus sign and trim trailing-zero decimals. */
function fmtNum(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded).replace("-", "−");
}

/** Wrap negatives in parentheses for substitution lines, e.g. (−8). */
function fmtParen(n: number): string {
  return n < 0 ? `(${fmtNum(n)})` : fmtNum(n);
}

/** Format a·x² + b·x + c = 0 (handles ±1 coefficients and 0 terms). */
function formatQuadratic(a: number, b: number, c: number): string {
  const aPart = a === 1 ? "x²" : a === -1 ? "−x²" : `${fmtNum(a)}x²`;
  let s = aPart;
  if (b !== 0) {
    const bMag = Math.abs(b);
    s += ` ${b < 0 ? "−" : "+"} ${bMag === 1 ? "" : bMag}x`;
  }
  if (c !== 0) {
    s += ` ${c < 0 ? "−" : "+"} ${Math.abs(c)}`;
  }
  return `${s} = 0`;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SLOT_LABELS: Record<SlotKey, string> = {
  a: "the x² coefficient",
  b: "the x coefficient",
  c: "the constant",
};

export function QuadraticFormulaStep({
  problem,
  onCorrect,
  disabled,
  embedded,
}: QuadraticFormulaStepProps) {
  const { a, b, c, feedback } = problem;

  const shuffledTokens = useMemo(() => shuffle(problem.tokens), [problem.tokens]);

  const [slotA, setSlotA] = useState<number | null>(null);
  const [slotB, setSlotB] = useState<number | null>(null);
  const [slotC, setSlotC] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(
    null
  );
  // Reveal stage: 0 none, 1 substitute, 2 discriminant, 3 solutions.
  const [stage, setStage] = useState(0);
  const [solved, setSolved] = useState(false);
  const calledRef = useRef(false);

  const allFilled = slotA !== null && slotB !== null && slotC !== null;

  // Derived solution values.
  const disc = b * b - 4 * a * c;
  const sqrtDisc = Math.sqrt(Math.abs(disc));
  const isPerfect = disc >= 0 && Number.isInteger(sqrtDisc);
  const root1 = disc >= 0 ? (-b + sqrtDisc) / (2 * a) : NaN;
  const root2 = disc >= 0 ? (-b - sqrtDisc) / (2 * a) : NaN;
  const discText = String(disc).replace("-", "−");

  useEffect(() => {
    if (!allFilled) return;
    setStage(1);
    const t1 = setTimeout(() => setStage(2), 600);
    const t2 = setTimeout(() => {
      setStage(3);
      setSolved(true);
      if (!calledRef.current) {
        calledRef.current = true;
        onCorrect(feedback.correct);
      }
    }, 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [allFilled, feedback.correct, onCorrect]);

  function attemptPlace(slot: SlotKey, value: number) {
    if (disabled || allFilled) return;
    setSelected(null);
    const target = slot === "a" ? a : slot === "b" ? b : c;
    const setter =
      slot === "a" ? setSlotA : slot === "b" ? setSlotB : setSlotC;
    const current = slot === "a" ? slotA : slot === "b" ? slotB : slotC;
    if (current !== null) return;
    if (value === target) {
      setter(value);
      setMessage(null);
    } else {
      setMessage({
        text: `That's not ${slot}. ${slot} is ${SLOT_LABELS[slot]} of ${formatQuadratic(a, b, c)}.`,
        error: true,
      });
    }
  }

  function handleDrop(slot: SlotKey, e: React.DragEvent) {
    e.preventDefault();
    if (disabled || allFilled) return;
    const raw = e.dataTransfer.getData("text/plain");
    if (raw === "") return;
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    attemptPlace(slot, value);
  }

  function handleTokenTap(value: number) {
    if (disabled || allFilled) return;
    setSelected((cur) => (cur === value ? null : value));
  }

  function handleSlotTap(slot: SlotKey) {
    if (disabled || allFilled) return;
    if (selected === null) return;
    attemptPlace(slot, selected);
  }

  const placed = [slotA, slotB, slotC].filter((v): v is number => v !== null);
  const bankTokens = shuffledTokens.filter((v) => !placed.includes(v));

  function Slot({ slot, value }: { slot: SlotKey; value: number | null }) {
    const filled = value !== null;
    return (
      <button
        type="button"
        onClick={() => handleSlotTap(slot)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(slot, e)}
        disabled={disabled || filled || allFilled}
        aria-label={
          filled
            ? `${slot}-slot filled with ${value}`
            : `Empty ${slot}-slot, drop the value of ${slot} here`
        }
        className={`inline-flex h-12 min-w-[3rem] items-center justify-center rounded-lg border-2 px-2 align-middle font-math transition-all duration-200 ${
          filled
            ? "border-success bg-success/10 text-success"
            : selected !== null && !disabled
              ? "cursor-pointer border-dashed border-primary bg-primary-light text-primary/60"
              : "border-dashed border-border bg-surface text-muted"
        }`}
      >
        {filled ? fmtNum(value) : slot}
      </button>
    );
  }

  return (
    <div>
      {!embedded && (
        <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
          <p className="text-label font-semibold text-primary">Goal</p>
          <p className="mt-0.5 text-body text-text">{problem.prompt}</p>
        </div>
      )}

      <p className="mt-5 text-body text-text">{problem.question}</p>

      <div className="mt-6 rounded-xl border border-border bg-bg/60 p-6">
        {/* The equation we're solving */}
        <p className="text-center font-math text-equation text-text">
          {formatQuadratic(a, b, c)}
        </p>

        {/* The quadratic formula as a real stacked fraction */}
        <div className="mt-5 flex items-center justify-center gap-2 font-math text-equation text-text">
          <span>x =</span>
          <Fraction
            numerator={<span>−b ± √(b² − 4ac)</span>}
            denominator={<span>2a</span>}
          />
        </div>

        {/* Drag a, b, c into place */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 font-math text-equation text-text">
          <span className="flex items-center gap-2">
            a = <Slot slot="a" value={slotA} />
          </span>
          <span className="flex items-center gap-2">
            b = <Slot slot="b" value={slotB} />
          </span>
          <span className="flex items-center gap-2">
            c = <Slot slot="c" value={slotC} />
          </span>
        </div>

        {/* Token bank */}
        {!allFilled && (
          <div className="mt-7">
            <p className="mb-2 text-center text-label text-muted">
              {selected !== null
                ? "Now tap a slot — or drag a tile into place."
                : "Drag each value into a, b and c (or tap a tile, then a slot)."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {bankTokens.map((value) => (
                <button
                  key={value}
                  type="button"
                  draggable={!disabled}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(value))
                  }
                  onClick={() => handleTokenTap(value)}
                  disabled={disabled}
                  aria-label={`Token ${value}`}
                  className={`flex h-12 min-w-[3rem] items-center justify-center rounded-lg border-2 px-3 font-math text-equation font-semibold transition-all duration-150 ${
                    disabled
                      ? "cursor-default border-border bg-surface text-muted"
                      : "cursor-grab touch-none hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                  } ${
                    selected === value
                      ? "border-primary bg-primary-light text-primary ring-2 ring-primary"
                      : "border-border bg-surface text-text"
                  }`}
                >
                  {fmtNum(value)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Substitution + discriminant reveal */}
        {stage >= 1 && (
          <div className="mt-7">
            <p className="text-center text-label font-semibold text-primary">
              Plug a, b and c into the formula
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 font-math text-equation text-text">
              <span>x =</span>
              <Fraction
                numerator={
                  <span>
                    −{fmtParen(b)} ± √({fmtParen(b)}² − 4·{fmtParen(a)}·
                    {fmtParen(c)})
                  </span>
                }
                denominator={<span>2·{fmtParen(a)}</span>}
              />
            </div>
            {stage >= 2 && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-math text-equation text-text">
                <span>x =</span>
                <Fraction
                  numerator={
                    <span>
                      −{fmtParen(b)} ± √{discText}
                    </span>
                  }
                  denominator={<span>{fmtNum(2 * a)}</span>}
                />
                <span className="text-label text-muted">
                  (discriminant = {discText})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Solutions */}
        {stage >= 3 && (
          <div className="mt-6 rounded-xl border border-success/40 bg-success/10 px-4 py-4 text-center">
            <p className="text-label font-semibold text-success">Solutions</p>
            {disc < 0 ? (
              <p className="mt-1 text-body text-text">
                The discriminant is negative, so there are no real solutions.
              </p>
            ) : isPerfect ? (
              <p className="mt-1 font-math text-2xl font-bold text-success">
                x = {fmtNum(root1)} or x = {fmtNum(root2)}
              </p>
            ) : (
              <div className="mt-1 font-math text-success">
                <div className="flex flex-wrap items-center justify-center gap-2 text-xl font-bold">
                  <span>x =</span>
                  <Fraction
                    numerator={
                      <span>
                        −{fmtParen(b)} + √{discText}
                      </span>
                    }
                    denominator={<span>{fmtNum(2 * a)}</span>}
                  />
                  <span>or</span>
                  <Fraction
                    numerator={
                      <span>
                        −{fmtParen(b)} − √{discText}
                      </span>
                    }
                    denominator={<span>{fmtNum(2 * a)}</span>}
                  />
                </div>
                <p className="mt-2 text-label normal-case tracking-normal text-muted">
                  ≈ {fmtNum(Math.round(root1 * 100) / 100)} or{" "}
                  {fmtNum(Math.round(root2 * 100) / 100)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {message && !allFilled && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 ${
            message.error ? "border-error/40 bg-error/5" : "border-border bg-surface"
          }`}
        >
          <p className={`text-body ${message.error ? "text-error" : "text-text"}`}>
            {message.text}
          </p>
        </div>
      )}

      {!embedded && solved && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
