"use client";

import { useState } from "react";
import { formatDuration, type ComfortLevel, type LessonMastery } from "@/lib/comfort";

const COMFORT_META: Record<
  ComfortLevel,
  { label: string; bar: string; text: string }
> = {
  "very-comfortable": {
    label: "Very comfortable",
    bar: "bg-success",
    text: "text-success",
  },
  comfortable: {
    label: "Comfortable",
    bar: "bg-primary",
    text: "text-primary",
  },
  developing: {
    label: "Developing",
    bar: "bg-amber-500",
    text: "text-amber-600",
  },
  "needs-practice": {
    label: "Needs practice",
    bar: "bg-error",
    text: "text-error",
  },
  "not-started": {
    label: "Not started yet",
    bar: "bg-border",
    text: "text-muted",
  },
};

function comfortExplanation(mastery: LessonMastery): string | null {
  const { level, totalMs, expectedMinutes } = mastery.comfort;
  if (level === "not-started" || totalMs === null) return null;
  // Use the same formatting as the completion screen so the tooltip matches the
  // most recent lesson time exactly (no rounding drift).
  const base = `You took ${formatDuration(totalMs)} and the expected time is ${expectedMinutes} min.`;
  switch (level) {
    case "needs-practice":
      return `${base} We recommend you practice this lesson again.`;
    case "developing":
      return `${base} A little more practice will build your speed.`;
    default:
      return `${base} Nice work keeping a strong pace!`;
  }
}

function daysLabel(daysSince: number | null): { label: string; tone: string } {
  if (daysSince === null)
    return { label: "Not practiced yet", tone: "text-muted" };
  if (daysSince <= 0) return { label: "Practiced today", tone: "text-success" };
  if (daysSince === 1) return { label: "Yesterday", tone: "text-text" };
  if (daysSince <= 6)
    return { label: `${daysSince} days ago`, tone: "text-text" };
  return { label: `${daysSince} days ago`, tone: "text-error" };
}

function statusMeta(status: LessonMastery["status"]): {
  label: string;
  badge: string;
} {
  if (status === "complete")
    return { label: "Completed", badge: "bg-success/10 text-success" };
  if (status === "in_progress")
    return { label: "In progress", badge: "bg-primary/10 text-primary" };
  return { label: "Not started", badge: "bg-border/60 text-muted" };
}

function ComfortMeter({ mastery }: { mastery: LessonMastery }) {
  const meta = COMFORT_META[mastery.comfort.level];
  const started = mastery.comfort.level !== "not-started";
  const explanation = comfortExplanation(mastery);

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label text-muted">Comfort</span>
        {explanation ? (
          <span className="group relative inline-flex items-center">
            <span
              tabIndex={0}
              className={`cursor-help text-label font-medium underline decoration-dotted underline-offset-2 ${meta.text}`}
            >
              {meta.label}
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 w-60 rounded-lg border border-border bg-surface p-3 text-left text-label font-normal leading-relaxed text-text opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {explanation}
            </span>
          </span>
        ) : (
          <span className={`text-label font-medium ${meta.text}`}>
            {meta.label}
          </span>
        )}
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all ${meta.bar}`}
          style={{ width: `${started ? Math.max(mastery.comfort.score, 4) : 0}%` }}
        />
      </div>
    </div>
  );
}

// Colorful accent per lesson so the page pops like the home screen.
const CARD_ACCENTS = [
  "bg-accent-purple",
  "bg-accent-cyan",
  "bg-accent-pink",
  "bg-accent-orange",
  "bg-accent-green",
];

export function MasteryView({ lessons }: { lessons: LessonMastery[] }) {
  const [active, setActive] = useState(0);

  if (lessons.length === 0) {
    return (
      <p className="text-body text-muted">No lessons to show yet.</p>
    );
  }

  const activeIndex = Math.min(active, lessons.length - 1);
  const lesson = lessons[activeIndex];

  return (
    <div>
      {/* Tabs — each shows the lesson name + completed status */}
      <div
        role="tablist"
        aria-label="Lessons"
        className="flex flex-wrap gap-2"
      >
        {lessons.map((l, index) => {
          const isActive = index === activeIndex;
          const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
          const status = statusMeta(l.status);
          return (
            <button
              key={l.lessonId}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(index)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary-light"
                  : "border-border bg-surface hover:bg-bg"
              }`}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent}`} aria-hidden />
              <span
                className={`text-body font-semibold ${
                  isActive ? "text-primary" : "text-text"
                }`}
              >
                {l.title}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-label ${status.badge}`}
              >
                {status.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active lesson's full data */}
      <article
        key={lesson.lessonId}
        role="tabpanel"
        className="card-pop mt-5 overflow-hidden p-0"
      >
        <div
          className={`h-1.5 w-full ${CARD_ACCENTS[activeIndex % CARD_ACCENTS.length]}`}
        />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-heading-md text-text">
                {lesson.title}
              </h2>
              <p className="text-label text-muted">{lesson.subject}</p>
            </div>
            {lesson.status === "complete" && (
              <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-label text-success">
                Completed
              </span>
            )}
          </div>

          <ComfortMeter mastery={lesson} />

          <ul className="mt-4 overflow-hidden rounded-lg border border-border">
            {lesson.skills.map((skill, i) => {
              const { label, tone } = daysLabel(skill.daysSince);
              return (
                <li
                  key={skill.stepId}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <span className="text-body text-text">{skill.skill}</span>
                  <span className={`shrink-0 text-label ${tone}`}>{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </article>
    </div>
  );
}
