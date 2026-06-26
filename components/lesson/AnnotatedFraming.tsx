"use client";

import { useState } from "react";
import type { StepFraming } from "@/types/lesson";

interface AnnotatedFramingProps {
  framing: StepFraming;
}

/**
 * Renders a short lead line plus an optional annotated equation. Tokens that
 * carry a `note` become hoverable (and tappable, for touch) chips that reveal a
 * small explanation — replacing a long prose paragraph with a glanceable visual.
 */
export function AnnotatedFraming({ framing }: AnnotatedFramingProps) {
  const [active, setActive] = useState<number | null>(null);
  const hasNotes = framing.equation?.some((p) => p.note) ?? false;

  return (
    <div className="mt-3">
      <p className="text-body text-muted">{framing.lead}</p>

      {framing.equation && (
        <div className="mt-4 flex justify-center">
          <div className="rounded-xl border border-border bg-surface px-5 py-5">
            <span className="font-equation text-equation leading-relaxed text-text">
              {framing.equation.map((part, i) =>
                part.note ? (
                  <span key={i} className="relative inline-block">
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() =>
                        setActive((a) => (a === i ? null : a))
                      }
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive((a) => (a === i ? null : a))}
                      onClick={() =>
                        setActive((a) => (a === i ? null : i))
                      }
                      className="cursor-help rounded-md px-0.5 text-primary underline decoration-dotted decoration-2 underline-offset-4 outline-none transition-colors hover:bg-primary-light focus-visible:bg-primary-light"
                      aria-label={`${part.text}: ${part.note}`}
                    >
                      {part.text}
                    </button>
                    {active === i && (
                      <span
                        role="tooltip"
                        className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-bg px-3 py-2 text-left font-sans text-label leading-snug text-text shadow-lg"
                      >
                        {part.note}
                      </span>
                    )}
                  </span>
                ) : (
                  <span key={i}>{part.text}</span>
                )
              )}
            </span>
          </div>
        </div>
      )}

      {hasNotes && (
        <p className="mt-2 text-center text-label text-muted">
          Hover (or tap) the highlighted parts to see what they mean.
        </p>
      )}

      {framing.note && (
        <p className="mt-3 text-body text-muted">{framing.note}</p>
      )}
    </div>
  );
}
