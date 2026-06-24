import Link from "next/link";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Lesson, LessonProgress } from "@/types/lesson";

interface LessonCardProps {
  lesson: Lesson;
  progress: LessonProgress;
}

function statusLabel(status: LessonProgress["status"]): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "in_progress":
      return "In Progress";
    default:
      return "Not Started";
  }
}

export function LessonCard({ lesson, progress }: LessonCardProps) {
  const completedSteps =
    progress.status === "complete"
      ? lesson.totalSteps
      : progress.current_step_index;
  const buttonLabel = completedSteps === 0 ? "Start Lesson" : "Continue";

  return (
    <Link href={`/lesson/${lesson.id}`} className="block">
      <article className="rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-heading text-heading-md text-text">
            {lesson.title}
          </h2>
          <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 text-label text-primary">
            {statusLabel(progress.status)}
          </span>
        </div>
        <p className="mt-2 text-body text-muted">{lesson.description}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-label text-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 7v5l3 2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>About {lesson.estimatedMinutes} min</span>
        </div>
        <div className="mt-4">
          <ProgressBar
            value={completedSteps}
            max={lesson.totalSteps}
            label={`${completedSteps} of ${lesson.totalSteps} steps completed`}
          />
        </div>
        <div className="mt-4">
          <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-body font-medium text-white">
            {buttonLabel}
          </span>
        </div>
      </article>
    </Link>
  );
}
