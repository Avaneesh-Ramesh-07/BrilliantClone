import type { ReactNode } from "react";

interface FractionProps {
  /** Content rendered above the bar. */
  numerator: ReactNode;
  /** Content rendered below the bar. */
  denominator: ReactNode;
  /** Extra classes for the inline wrapper (e.g. margins). */
  className?: string;
}

/**
 * Renders a true stacked fraction: numerator over a horizontal bar over
 * denominator. The bar (`bg-current`) inherits the surrounding text color and
 * stretches to the wider of the two rows, so it reads as a real fraction rather
 * than an inline slash. Inline-flex + align-middle keeps it inline with text
 * like "x = ", and it shrinks gracefully on narrow mobile widths.
 */
export function Fraction({ numerator, denominator, className }: FractionProps) {
  return (
    <span
      className={`inline-flex flex-col items-center align-middle ${className ?? ""}`}
    >
      <span className="flex items-center justify-center px-2 leading-tight">
        {numerator}
      </span>
      <span className="my-1 h-0.5 w-full self-stretch rounded bg-current" aria-hidden />
      <span className="flex items-center justify-center px-2 leading-tight">
        {denominator}
      </span>
    </span>
  );
}
