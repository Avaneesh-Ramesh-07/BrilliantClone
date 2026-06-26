"use client";

import { useEffect, useId, useRef, useState } from "react";

interface GlossaryTermProps {
  /** The text to display (the matched word/phrase, original casing preserved). */
  term: string;
  /** Short, plain-language definition shown in the popover. */
  definition: string;
}

/**
 * A bold, tappable math term. Tapping (or focusing + Enter/Space) reveals a
 * small popover with a beginner-friendly definition. Dismisses on outside click
 * or Escape. Rendered inline inside lesson text via {@link MathText}.
 */
export function GlossaryTerm({ term, definition }: GlossaryTermProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        className="cursor-pointer font-semibold text-primary underline decoration-dotted decoration-from-font underline-offset-2 outline-none transition-colors hover:bg-primary-light focus-visible:bg-primary-light focus-visible:rounded-sm"
      >
        {term}
      </button>
      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          className="absolute left-1/2 top-full z-40 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-border bg-bg px-3 py-2 text-left font-sans text-label font-normal not-italic leading-snug text-text shadow-lg"
        >
          <span className="block font-semibold capitalize text-text">{term}</span>
          <span className="mt-0.5 block text-muted">{definition}</span>
        </span>
      )}
    </span>
  );
}
