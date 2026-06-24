import Link from "next/link";
import { ReactNode } from "react";
import { RestartLessonButton } from "@/components/lesson/RestartLessonButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { isLessonComplete } from "@/lib/progress";
import type { Lesson, LessonProgress } from "@/types/lesson";

interface LessonCardProps {
  lesson: Lesson;
  progress: LessonProgress;
  userId: string;
  /** Locked lessons are gated behind completing the previous lesson. */
  locked?: boolean;
}

export function LessonCard({
  lesson,
  progress,
  userId,
  locked,
}: LessonCardProps) {
  const completed = isLessonComplete(progress);
  const completedSteps = completed
    ? lesson.totalSteps
    : progress.current_step_index;
  const buttonLabel = completedSteps === 0 ? "Start Lesson" : "Continue";
  const statusLabel = completed
    ? "Complete"
    : completedSteps === 0
      ? "Not Started"
      : "In Progress";

  const statusBadge = locked ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-border/60 px-2 py-0.5 text-label text-muted">
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <rect
          x="5"
          y="11"
          width="14"
          height="9"
          rx="2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M8 11V8a4 4 0 018 0v3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      Locked
    </span>
  ) : (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-label ${
        completed
          ? "bg-success/10 text-success"
          : "bg-primary-light text-primary"
      }`}
    >
      {completed && (
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {statusLabel}
    </span>
  );

  const cardBody = (action: ReactNode) => (
    <article
      className={`rounded-xl border border-border bg-surface p-5 shadow-sm ${
        locked ? "opacity-60" : "transition-shadow hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-heading text-heading-md text-text">
          {lesson.title}
        </h2>
        {statusBadge}
      </div>
      <p className="mt-2 text-body text-muted">{lesson.description}</p>
      <div className="mt-3 inline-flex items-center gap-1.5 text-label text-muted">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
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
      <div className="mt-4">{action}</div>
    </article>
  );

  if (locked) {
    return (
      <div aria-disabled className="cursor-not-allowed">
        {cardBody(
          <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-border/60 px-4 py-2 text-body font-medium text-muted">
            Complete the previous lesson to unlock
          </span>
        )}
      </div>
    );
  }

  // Finished at least once: offer a recap (congrats screen) and a fresh restart.
  if (completed) {
    return cardBody(
      <div className="flex flex-col gap-2">
        <Link href={`/lesson/${lesson.id}/complete`} className="block">
          <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-body font-medium text-white">
            View Congratulations
          </span>
        </Link>
        <RestartLessonButton lessonId={lesson.id} userId={userId} />
      </div>
    );
  }

  return (
    <Link href={`/lesson/${lesson.id}`} className="block">
      {cardBody(
        <span className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-body font-medium text-white">
          {buttonLabel}
        </span>
      )}
    </Link>
  );
}
