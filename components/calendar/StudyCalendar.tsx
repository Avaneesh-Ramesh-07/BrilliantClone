"use client";

import { useState, useTransition } from "react";
import { getMonthActivity } from "@/app/home/actions";
import {
  formatStudyTime,
  type DayActivity,
  type MonthlyActivity,
} from "@/lib/activity";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Builds the breakdown sentence for a day's tooltip. */
function describeDay(day: DayActivity): string {
  if (!day.active) return "No activity";
  if (day.totalMs === 0) return "Active — time not recorded";

  const parts: string[] = [];
  const { lessons, practiceTests, duels } = day.breakdown;
  if (lessons > 0) parts.push(`Lessons ${formatStudyTime(lessons)}`);
  if (practiceTests > 0)
    parts.push(`Practice tests ${formatStudyTime(practiceTests)}`);
  if (duels > 0) parts.push(`Duels ${formatStudyTime(duels)}`);

  const total = `Studied ${formatStudyTime(day.totalMs)}`;
  return parts.length > 0 ? `${total} — ${parts.join(" · ")}` : total;
}

/** `Jun 12` style label for a day's date. */
function shortDate(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function StudyCalendar({ activity }: { activity: MonthlyActivity }) {
  const [current, setCurrent] = useState<MonthlyActivity>(activity);
  const { year, month, days } = current;
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [pinnedDay, setPinnedDay] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const openDay = pinnedDay ?? hoverDay;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const leadingBlanks = new Date(year, month - 1, 1).getDay();

  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayDate = now.getDate();

  // Move to another month inline via the server action (no page navigation).
  function goToMonth(targetYear: number, targetMonth: number) {
    setHoverDay(null);
    setPinnedDay(null);
    startTransition(async () => {
      const next = await getMonthActivity(targetYear, targetMonth);
      setCurrent(next);
    });
  }

  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);

  const activeDays = days.filter((d) => d.active).length;

  return (
    <section className="card-pop p-4" aria-busy={isPending}>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(prev.getFullYear(), prev.getMonth() + 1)}
          disabled={isPending}
          aria-label="Previous month"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2 className="font-heading text-heading-md text-text">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => goToMonth(next.getFullYear(), next.getMonth() + 1)}
          disabled={isPending}
          aria-label="Next month"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-bg hover:text-text disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M9 18l6-6-6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="py-1 text-center text-label text-muted"
            aria-hidden
          >
            {wd.charAt(0)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}

        {days.map((day) => {
          const isToday = isCurrentMonth && day.day === todayDate;
          const isOpen = openDay === day.day;
          const tooltipId = `cal-day-${day.day}`;
          const label = `${shortDate(year, month, day.day)}: ${describeDay(day)}`;

          const base =
            "relative flex aspect-square w-full flex-col items-center justify-center rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
          const tone = day.completedLesson
            ? "bg-primary font-semibold text-white"
            : day.active
              ? "bg-primary-light font-medium text-primary"
              : "text-text hover:bg-bg";
          const todayRing = isToday
            ? " ring-2 ring-accent-orange ring-offset-1 ring-offset-surface"
            : "";

          return (
            <button
              key={day.day}
              type="button"
              aria-label={label}
              aria-expanded={isOpen}
              aria-describedby={isOpen ? tooltipId : undefined}
              className={`${base} ${tone}${todayRing}`}
              onMouseEnter={() => setHoverDay(day.day)}
              onMouseLeave={() =>
                setHoverDay((d) => (d === day.day ? null : d))
              }
              onFocus={() => setHoverDay(day.day)}
              onBlur={() => setHoverDay((d) => (d === day.day ? null : d))}
              onClick={() =>
                setPinnedDay((d) => (d === day.day ? null : day.day))
              }
            >
              <span>{day.day}</span>
              {/* Activity marker for days with no lesson completion. */}
              {day.active && !day.completedLesson && (
                <span
                  className="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent-green"
                  aria-hidden
                />
              )}

              {isOpen && (
                <span
                  id={tooltipId}
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-44 -translate-x-1/2 rounded-lg border border-border bg-surface p-2 text-center shadow-lg"
                >
                  <span className="block text-label text-muted">
                    {shortDate(year, month, day.day)}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-text">
                    {describeDay(day)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-primary" aria-hidden />
          Completed a lesson
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-primary-light" aria-hidden />
          Active day
        </span>
        <span className="ml-auto">
          {activeDays} active {activeDays === 1 ? "day" : "days"}
        </span>
      </div>
    </section>
  );
}
