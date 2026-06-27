"use client";

import { useEffect, useId, useRef, useState } from "react";

interface StreakWidgetProps {
  streak: number;
  /** 7 booleans, index 0 = Sunday … 6 = Saturday. */
  days: boolean[];
  /** Weekday index (0 = Sunday … 6 = Saturday) to emphasize as today. */
  todayIndex: number;
  /** True when the learner has actually finished a lesson today. */
  completedToday: boolean;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function StreakWidget({
  streak,
  days,
  todayIndex,
  completedToday,
}: StreakWidgetProps) {
  return (
    <div
      aria-label={`${streak}-day streak.`}
      className="card-pop relative bg-gradient-to-br from-accent-orange/15 via-surface to-accent-yellow/15 p-5"
    >
      <StreakInfo completedToday={completedToday} />

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
            <span className="text-accent-orange">{streak}</span> day streak
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

/**
 * The "i"-in-a-circle info button in the streak card's top-right corner.
 * Reveals a small tooltip explaining today's streak status. Works on hover and
 * keyboard focus (desktop) and on tap/click (touch); dismissable via Escape,
 * an outside click/tap, or moving away. The tooltip text is conditional on
 * whether the learner has completed a lesson today.
 */
function StreakInfo({ completedToday }: { completedToday: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const message = completedToday
    ? "Great job completing a lesson today! Come back tomorrow to keep your streak on fire!!"
    : "Finish a lesson today to continue your streak!";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="absolute right-3 top-3 z-10"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="What counts toward your streak?"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((cur) => !cur)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:text-accent-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-orange/50"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
          <circle
            cx="10"
            cy="10"
            r="8.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="10" cy="6.2" r="1.15" fill="currentColor" />
          <rect x="9.1" y="8.8" width="1.8" height="5.6" rx="0.9" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-full z-50 mt-3 w-60 rounded-xl border border-black/15 bg-[var(--color-text)] px-3.5 py-2.5 text-left text-label font-medium leading-snug text-white shadow-2xl"
        >
          {/* Caret pointing up toward the info icon, so it reads as a floating
              popover rather than inline text. */}
          <span
            aria-hidden
            className="absolute -top-1.5 right-3.5 h-3 w-3 rotate-45 rounded-[2px] border-l border-t border-black/15 bg-[var(--color-text)]"
          />
          <span className="relative">{message}</span>
        </div>
      )}
    </div>
  );
}
