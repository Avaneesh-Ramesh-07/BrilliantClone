import type { ReactNode } from "react";

interface FractionProps {
  /** Content rendered above the bar. */
  numerator: ReactNode;
  /** Content rendered below the bar. */
  denominator: ReactNode;
  /** Extra classes for the inline wrapper (e.g. margins). */
  className?: string;
  /**
   * Accessible label for the whole fraction (e.g. "3 over 4"). When omitted and
   * both parts are plain strings/numbers, a sensible "<num> over <den>" label is
   * generated so screen readers never announce a bare slash.
   */
  ariaLabel?: string;
  /**
   * Compact spacing for tight spots like draggable equation tiles. Defaults to
   * the roomier inline spacing used inside sentences and equations.
   */
  tight?: boolean;
}

/** Builds a spoken label like "3 over 4" when both parts are plain text. */
function autoLabel(numerator: ReactNode, denominator: ReactNode): string | undefined {
  const isText = (v: ReactNode): v is string | number =>
    typeof v === "string" || typeof v === "number";
  if (isText(numerator) && isText(denominator)) {
    return `${numerator} over ${denominator}`;
  }
  return undefined;
}

/**
 * The app-wide stacked fraction: a numerator over a horizontal bar over a
 * denominator. The bar (`bg-current`) inherits the surrounding text color and
 * stretches to the wider of the two rows, so it reads as a real fraction rather
 * than an inline slash. Inline-flex + align-middle keeps it inline with text
 * like "x = ", and it shrinks gracefully on narrow mobile widths.
 *
 * This is the single source of truth for fraction rendering. Other helpers
 * (the lesson `Fraction` re-export and the equation `FractionGlyph`) delegate
 * here so every fraction in the app looks and behaves the same.
 */
export function Fraction({
  numerator,
  denominator,
  className,
  ariaLabel,
  tight,
}: FractionProps) {
  const label = ariaLabel ?? autoLabel(numerator, denominator);
  const pad = tight ? "px-1" : "px-2";
  const bar = tight ? "h-px" : "my-1 h-0.5";
  return (
    <span
      className={`inline-flex flex-col items-center align-middle ${className ?? ""}`}
      role={label ? "math" : undefined}
      aria-label={label}
    >
      <span
        className={`flex items-center justify-center ${pad} leading-tight`}
        aria-hidden={!!label}
      >
        {numerator}
      </span>
      <span className={`${bar} w-full self-stretch rounded bg-current`} aria-hidden />
      <span
        className={`flex items-center justify-center ${pad} leading-tight`}
        aria-hidden={!!label}
      >
        {denominator}
      </span>
    </span>
  );
}
