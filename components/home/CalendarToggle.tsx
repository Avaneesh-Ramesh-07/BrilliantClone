"use client";

import { useState } from "react";
import { StudyCalendar } from "@/components/calendar/StudyCalendar";

type Props = {
  activity: React.ComponentProps<typeof StudyCalendar>["activity"];
};

// Collapsible study-calendar control shown below the streak counter on the home
// page. Hidden by default; the toggle reveals the monthly calendar.
export function CalendarToggle({ activity }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-bg"
      >
        <span className="flex items-center gap-2 text-body font-medium text-text">
          <span aria-hidden>📅</span>
          Study calendar
        </span>
        <span className="flex items-center gap-1 text-label text-muted">
          {open ? "Hide" : "Show"}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div className="mt-4">
          <StudyCalendar activity={activity} />
        </div>
      )}
    </div>
  );
}
