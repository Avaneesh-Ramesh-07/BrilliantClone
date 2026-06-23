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

function buttonLabel(status: LessonProgress["status"]): string {
  return status === "not_started" ? "Start" : "Continue";
}

export function LessonCard({ lesson, progress }: LessonCardProps) {
  const completedSteps =
    progress.status === "complete"
      ? lesson.totalSteps
      : progress.current_step_index;

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
        <div className="mt-4">
          <ProgressBar
            value={completedSteps}
            max={lesson.totalSteps}
            label={`${completedSteps} of ${lesson.totalSteps} steps completed`}
          />
        </div>
        <div className="mt-4">
          <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-body font-medium text-white">
            {buttonLabel(progress.status)}
          </span>
        </div>
      </article>
    </Link>
  );
}
