interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div className="w-full">
      {label && (
        <p className="mb-1 text-label text-muted">{label}</p>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
