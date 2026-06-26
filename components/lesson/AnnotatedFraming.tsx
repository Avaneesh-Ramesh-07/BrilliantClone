"use client";

import { Fragment, useState } from "react";
import type { EquationPart, StepFraming } from "@/types/lesson";
import { Fraction } from "./Fraction";
import { MathText } from "./MathText";

interface AnnotatedFramingProps {
  framing: StepFraming;
}

/** Does any part (recursively) carry a hoverable note? */
function hasAnyNote(parts: EquationPart[]): boolean {
  return parts.some(
    (p) =>
      Boolean(p.note) ||
      (p.fraction
        ? hasAnyNote(p.fraction.numerator) || hasAnyNote(p.fraction.denominator)
        : false)
  );
}

/**
 * Renders a short lead line plus an optional annotated equation. Tokens that
 * carry a `note` become hoverable (and tappable, for touch) chips that reveal a
 * small explanation. Parts with a `fraction` render as a true stacked fraction,
 * with notes still working on the numerator/denominator tokens.
 */
export function AnnotatedFraming({ framing }: AnnotatedFramingProps) {
  // Active note keyed by a stable path string so nested fraction tokens don't
  // collide with top-level indices.
  const [active, setActive] = useState<string | null>(null);

  const renderParts = (parts: EquationPart[], keyPrefix: string) =>
    parts.map((part, i) => {
      const key = `${keyPrefix}.${i}`;

      if (part.fraction) {
        return (
          <Fraction
            key={key}
            className="mx-1.5"
            numerator={renderParts(part.fraction.numerator, `${key}n`)}
            denominator={renderParts(part.fraction.denominator, `${key}d`)}
          />
        );
      }

      if (part.note) {
        return (
          <span key={key} className="relative inline-block">
            <button
              type="button"
              onMouseEnter={() => setActive(key)}
              onMouseLeave={() => setActive((a) => (a === key ? null : a))}
              onFocus={() => setActive(key)}
              onBlur={() => setActive((a) => (a === key ? null : a))}
              onClick={() => setActive((a) => (a === key ? null : key))}
              className="cursor-help rounded-md px-0.5 text-primary underline decoration-dotted decoration-2 underline-offset-4 outline-none transition-colors hover:bg-primary-light focus-visible:bg-primary-light"
              aria-label={`${part.text ?? ""}: ${part.note}`}
            >
              {part.text}
            </button>
            {active === key && (
              <span
                role="tooltip"
                className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-bg px-3 py-2 text-left font-sans not-italic text-label leading-snug text-text shadow-lg"
              >
                {part.note}
              </span>
            )}
          </span>
        );
      }

      return <Fragment key={key}>{part.text}</Fragment>;
    });

  const showNoteHint = framing.equation ? hasAnyNote(framing.equation) : false;

  return (
    <div className="mt-3">
      <p className="text-body text-muted">
        <MathText text={framing.lead} />
      </p>

      {framing.equation && (
        <div className="mt-4 flex justify-center">
          <div className="rounded-xl border border-border bg-surface px-5 py-5">
            <span className="font-math text-equation leading-relaxed text-text">
              {renderParts(framing.equation, "eq")}
            </span>
          </div>
        </div>
      )}

      {showNoteHint && (
        <p className="mt-2 text-center text-label text-muted">
          Hover (or tap) the highlighted parts to see what they mean.
        </p>
      )}

      {framing.note && (
        <p className="mt-3 text-body text-muted">
          <MathText text={framing.note} />
        </p>
      )}
    </div>
  );
}
