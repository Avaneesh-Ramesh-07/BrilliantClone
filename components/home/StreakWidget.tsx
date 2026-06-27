interface StreakWidgetProps {
  streak: number;
  /** 7 booleans, index 0 = Sunday … 6 = Saturday. */
  days: boolean[];
  /** Weekday index (0 = Sunday … 6 = Saturday) to emphasize as today. */
  todayIndex: number;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function StreakWidget({ streak, days, todayIndex }: StreakWidgetProps) {
  return (
    <div
      aria-label={`${streak}-day streak.`}
      className="card-pop overflow-hidden bg-gradient-to-br from-accent-orange/15 via-surface to-accent-yellow/15 p-5"
    >
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-orange/15 text-3xl ring-1 ring-accent-orange/30">
          <span aria-hidden>🥷</span>
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-base shadow ring-1 ring-accent-orange/30"
          >
            🔥
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-heading text-heading-lg text-text">
            <span className="text-accent-orange">{streak}</span>-day streak
          </p>
          <p className="text-label text-muted">
            {streak > 0 ? "Keep the ninja fire burning" : "Begin your training today"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-1.5">
        {DAY_LABELS.map((label, index) => {
          const active = days[index] === true;
          const isToday = index === todayIndex;
          return (
            <div
              key={index}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div
                aria-hidden
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full text-body font-bold transition-colors",
                  active
                    ? "bg-accent-orange text-white shadow-sm"
                    : "bg-border/50 text-muted",
                  isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : "",
                ].join(" ")}
              >
                {active ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>
              <span
                className={`text-label ${
                  isToday ? "text-primary" : "text-muted"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
