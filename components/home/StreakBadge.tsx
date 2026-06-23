interface StreakBadgeProps {
  streak: number;
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface px-4 py-2 shadow-sm ring-1 ring-border">
      <span aria-hidden>🔥</span>
      <span className="font-heading text-heading-md text-text">
        {streak}-day streak
      </span>
    </div>
  );
}
