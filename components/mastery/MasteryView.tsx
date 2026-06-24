import type { ComfortLevel, LessonMastery } from "@/lib/comfort";

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

function daysLabel(daysSince: number | null): { label: string; tone: string } {
  if (daysSince === null)
    return { label: "Not practiced yet", tone: "text-muted" };
  if (daysSince <= 0) return { label: "Practiced today", tone: "text-success" };
  if (daysSince === 1) return { label: "Yesterday", tone: "text-text" };
  if (daysSince <= 6)
    return { label: `${daysSince} days ago`, tone: "text-text" };
  return { label: `${daysSince} days ago`, tone: "text-error" };
}

function ComfortMeter({ mastery }: { mastery: LessonMastery }) {
  const meta = COMFORT_META[mastery.comfort.level];
  const started = mastery.comfort.level !== "not-started";

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label text-muted">Comfort</span>
        <span className={`text-label font-medium ${meta.text}`}>
          {meta.label}
        </span>
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

export function MasteryView({ lessons }: { lessons: LessonMastery[] }) {
  return (
    <div className="flex flex-col gap-5">
      {lessons.map((lesson) => (
        <article
          key={lesson.lessonId}
          className="rounded-xl border border-border bg-surface p-5 shadow-sm"
        >
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
        </article>
      ))}
    </div>
  );
}
