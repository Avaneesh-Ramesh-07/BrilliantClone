interface EquationBadgeProps {
  /** The equation to display prominently, e.g. "y = 2x − 1". */
  equation: string;
  /** Optional small caption above the equation, e.g. "Match this equation". */
  label?: string;
  /** Extra classes for the wrapper (e.g. spacing overrides). */
  className?: string;
}

/**
 * A prominent, readable chip for a line/curve equation shown right next to its
 * grid. Uses a bordered surface box and the app's equation face so it reads as
 * the equation itself, not body text.
 */
export function EquationBadge({ equation, label, className }: EquationBadgeProps) {
  return (
    <div className={`flex flex-col items-center ${className ?? ""}`}>
      {label && (
        <span className="mb-1 text-label font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
      )}
      <span className="inline-block rounded-lg border border-border bg-surface px-4 py-2 font-math text-equation text-text shadow-sm">
        {equation}
      </span>
    </div>
  );
}
