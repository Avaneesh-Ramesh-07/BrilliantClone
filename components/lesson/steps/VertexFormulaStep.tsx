"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VertexFormulaProblem } from "@/types/lesson";
import { Fraction } from "@/components/lesson/Fraction";

interface VertexFormulaStepProps {
  problem: VertexFormulaProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
  /** When true, suppress the Goal box and standalone success banner (a parent renders them). */
  embedded?: boolean;
}

type SlotKey = "b" | "a";

/** Render a number using a real minus sign and trim trailing-zero decimals. */
function fmtNum(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  const str = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return str.replace("-", "−");
}

/** Wrap negatives in parentheses for substitution lines, e.g. (−8). */
function fmtParen(n: number): string {
  return n < 0 ? `(${fmtNum(n)})` : fmtNum(n);
}

/** Format y = a·x² + b·x + c as a clean string (handles ±1 coefficients, 0 terms). */
function formatQuadratic(a: number, b: number, c: number): string {
  const aPart = a === 1 ? "x²" : a === -1 ? "−x²" : `${fmtNum(a)}x²`;
  let s = `y = ${aPart}`;
  if (b !== 0) {
    const bMag = Math.abs(b);
    s += ` ${b < 0 ? "−" : "+"} ${bMag === 1 ? "" : bMag}x`;
  }
  if (c !== 0) {
    s += ` ${c < 0 ? "−" : "+"} ${Math.abs(c)}`;
  }
  return s;
}

/** Shuffle a copy of the array (Fisher–Yates). */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function VertexFormulaStep({
  problem,
  onCorrect,
  disabled,
  embedded,
}: VertexFormulaStepProps) {
  const { a, b, c, feedback } = problem;

  const shuffledTokens = useMemo(() => shuffle(problem.tokens), [problem.tokens]);

  const [slotB, setSlotB] = useState<number | null>(null);
  const [slotA, setSlotA] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(
    null
  );
  // Reveal stage: 0 = none, 1 = substitute, 2 = simplify, 3 = result, 4 = vertex.
  const [stage, setStage] = useState(0);
  const [solved, setSolved] = useState(false);
  const calledRef = useRef(false);

  const bothFilled = slotB !== null && slotA !== null;

  // Derived vertex values.
  const num = -b; // numerator after −b
  const den = 2 * a; // denominator after 2·a
  const vx = num / den;
  const vy = a * vx * vx + b * vx + c;

  // Worked substitution line: plug the found x back into the original equation.
  const aDisp = a === 1 ? "" : a === -1 ? "−" : fmtNum(a);
  const originalEq = formatQuadratic(a, b, c);
  const subLine =
    `y = ${aDisp}(${fmtNum(vx)})²` +
    (b !== 0 ? ` ${b < 0 ? "−" : "+"} ${Math.abs(b)}(${fmtNum(vx)})` : "") +
    (c !== 0 ? ` ${c < 0 ? "−" : "+"} ${Math.abs(c)}` : "") +
    ` = ${fmtNum(vy)}`;

  // Once both slots are correctly filled, stage the auto-simplify reveal.
  useEffect(() => {
    if (!bothFilled) return;
    setStage(1);
    const t1 = setTimeout(() => setStage(2), 500);
    const t2 = setTimeout(() => setStage(3), 1000);
    const t3 = setTimeout(() => {
      setStage(4);
      setSolved(true);
      if (!calledRef.current) {
        calledRef.current = true;
        onCorrect(feedback.correct);
      }
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [bothFilled, feedback.correct, onCorrect]);

  function attemptPlace(slot: SlotKey, value: number) {
    if (disabled || bothFilled) return;
    setSelected(null);
    if (slot === "b") {
      if (slotB !== null) return;
      if (value === b) {
        setSlotB(value);
        setMessage(null);
      } else {
        setMessage({
          text: "That's not b. b is the coefficient of x — look at the x term.",
          error: true,
        });
      }
    } else {
      if (slotA !== null) return;
      if (value === a) {
        setSlotA(value);
        setMessage(null);
      } else {
        setMessage({
          text: "That's not a. a is the coefficient of x² — look at the x² term.",
          error: true,
        });
      }
    }
  }

  function handleDrop(slot: SlotKey, e: React.DragEvent) {
    e.preventDefault();
    if (disabled || bothFilled) return;
    const raw = e.dataTransfer.getData("text/plain");
    if (raw === "") return;
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    attemptPlace(slot, value);
  }

  function handleTokenTap(value: number) {
    if (disabled || bothFilled) return;
    setSelected((cur) => (cur === value ? null : value));
  }

  function handleSlotTap(slot: SlotKey) {
    if (disabled || bothFilled) return;
    if (selected === null) return;
    attemptPlace(slot, selected);
  }

  // Tokens still available in the bank (placed values are removed).
  const bankTokens = shuffledTokens.filter(
    (v) => v !== slotB && v !== slotA
  );

  // --- Quadratic display: y = a x² + b x + c with a and b highlighted -------
  const aCoeffText = a === 1 ? "" : a === -1 ? "−" : fmtNum(a);
  const bSignText = b < 0 ? "−" : "+";
  const bMag = Math.abs(b);
  const bCoeffText = bMag === 1 ? "" : String(bMag);
  const cSignText = c < 0 ? "−" : "+";
  const cMag = Math.abs(c);

  function Slot({ slot, value }: { slot: SlotKey; value: number | null }) {
    const filled = value !== null;
    return (
      <button
        type="button"
        onClick={() => handleSlotTap(slot)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(slot, e)}
        disabled={disabled || filled || bothFilled}
        aria-label={
          filled
            ? `${slot}-slot filled with ${value}`
            : `Empty ${slot}-slot, drop the value of ${slot} here`
        }
        className={`inline-flex h-12 min-w-[3rem] items-center justify-center rounded-lg border-2 px-2 align-middle transition-all duration-200 ${
          filled
            ? "border-success bg-success/10 text-success"
            : selected !== null && !disabled
              ? "border-primary border-dashed bg-primary-light text-primary/60 cursor-pointer hover:bg-primary-light"
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
        {/* Example quadratic with a and b highlighted */}
        <div className="flex flex-wrap items-center justify-center gap-x-1 font-math text-equation text-text">
          <span>y =</span>
          <span className="ml-1 rounded-md bg-primary-light px-1.5 font-semibold text-primary">
            {aCoeffText || "1"}
          </span>
          <span>x²</span>
          <span className="ml-1.5 rounded-md bg-success/15 px-1.5 font-semibold text-success">
            {bSignText} {bCoeffText}
          </span>
          <span>x</span>
          <span className="ml-1.5">
            {cSignText} {cMag}
          </span>
        </div>
        <p className="mt-2 text-center text-label text-muted">
          a is the x² coefficient, b is the x coefficient.
        </p>

        {/* Formula template as a real stacked fraction: (−[b]) over (2 · [a]) */}
        <div className="mt-6 flex items-center justify-center gap-2 font-math text-equation text-text">
          <span>x =</span>
          <Fraction
            numerator={
              <span className="flex items-center gap-1">
                <span>−</span>
                <Slot slot="b" value={slotB} />
              </span>
            }
            denominator={
              <span className="flex items-center gap-1">
                <span>2 ·</span>
                <Slot slot="a" value={slotA} />
              </span>
            }
          />
        </div>

        {/* Token bank */}
        {!bothFilled && (
          <div className="mt-7">
            <p className="mb-2 text-center text-label text-muted">
              {selected !== null
                ? "Now tap a slot — or drag a tile into place."
                : "Drag a tile into a slot (or tap a tile, then tap a slot)."}
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
                  className={`flex h-12 min-w-[3rem] items-center justify-center rounded-lg border-2 px-3 font-equation text-equation font-semibold transition-all duration-150 ${
                    disabled
                      ? "cursor-default border-border bg-surface text-muted"
                      : "cursor-grab touch-none active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md"
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

        {/* Step 1 — simplify the formula to get the x-coordinate */}
        {stage >= 1 && (
          <div className="mt-7">
            <p className="text-center text-label font-semibold text-primary">
              Step 1 — find x with the formula
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 font-math text-equation text-text">
              <span>x =</span>
              <Fraction
                numerator={<span>−{fmtParen(b)}</span>}
                denominator={<span>2 · {fmtParen(a)}</span>}
              />
              {stage >= 2 && (
                <>
                  <span>=</span>
                  <Fraction
                    numerator={<span>{fmtNum(num)}</span>}
                    denominator={<span>{fmtNum(den)}</span>}
                  />
                </>
              )}
              {stage >= 3 && (
                <>
                  <span>=</span>
                  <span className="font-semibold text-primary">{fmtNum(vx)}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2 — substitute x back into the original equation to get y */}
        {stage >= 4 && (
          <div className="mt-7">
            <p className="text-center text-label font-semibold text-primary">
              Step 2 — substitute x into the equation
            </p>
            <p className="mt-1 text-center text-body text-muted">
              Now plug x = {fmtNum(vx)} back into {originalEq} to get y:
            </p>
            <p className="mt-2 text-center font-math text-equation text-text">
              {subLine}
            </p>
          </div>
        )}

        {/* Vertex */}
        {stage >= 4 && (
          <div className="mt-6 rounded-xl border border-success/40 bg-success/10 px-4 py-4 text-center">
            <p className="text-label font-semibold text-success">Vertex</p>
            <p className="mt-1 font-math text-2xl font-bold text-success">
              ({fmtNum(vx)}, {fmtNum(vy)})
            </p>
            <p className="mt-1 text-label normal-case tracking-normal text-muted">
              (x from Step 1, y from Step 2)
            </p>
          </div>
        )}
      </div>

      {/* Inline rejection / status message */}
      {message && !bothFilled && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 ${
            message.error
              ? "border-error/40 bg-error/5"
              : "border-border bg-surface"
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
