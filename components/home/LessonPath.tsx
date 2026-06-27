"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Lesson, LessonProgress } from "@/types/lesson";

export interface LessonPathItem {
  lesson: Lesson;
  progress: LessonProgress;
  locked: boolean;
  /** Steps completed: equals totalSteps when complete, else current_step_index. */
  completedSteps: number;
  timeSpentMs: number;
  lastAccessedAt: string | null;
}

interface LessonPathProps {
  lessons: LessonPathItem[];
}

/** "Not started yet" for 0, otherwise "12m" or "1h 4m". */
function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "Not started yet";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return "<1m";
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/** "Today" / "Yesterday" / "N days ago" / "Never". */
function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Never";
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 86_400_000;
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(then)) / dayMs);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

type NodeState = "locked" | "active" | "complete" | "open";

function nodeState(item: LessonPathItem): NodeState {
  if (item.locked) return "locked";
  if (item.progress.completed_at != null) return "complete";
  if (item.progress.current_step_index > 0) return "active";
  return "open";
}

const NODE_ACCENTS = [
  "bg-primary text-white",
  "bg-accent-purple text-white",
  "bg-accent-pink text-white",
];

/** Horizontal lean (in 0–100 viewBox units) used for the gentle zig-zag. */
function leanFor(index: number): number {
  return index % 2 === 0 ? 34 : 66;
}

export function LessonPath({ lessons }: LessonPathProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [openId]);

  return (
    <div ref={containerRef} className="flex flex-col">
      {lessons.map((item, index) => {
        const { lesson } = item;
        const state = nodeState(item);
        const isOpen = openId === lesson.id;

        return (
          <div key={lesson.id}>
            {index > 0 && (
              <Connector
                fromLean={leanFor(index - 1)}
                toLean={leanFor(index)}
                completed={lessons[index - 1].progress.completed_at != null}
              />
            )}

            <div
              className="relative flex"
              style={{
                justifyContent:
                  index % 2 === 0 ? "flex-start" : "flex-end",
              }}
            >
              <div className="flex flex-col items-center">
                <PathNode
                  index={index}
                  item={item}
                  state={state}
                  isOpen={isOpen}
                  onToggle={() =>
                    setOpenId((cur) => (cur === lesson.id ? null : lesson.id))
                  }
                  onHover={() => setOpenId(lesson.id)}
                />
                <p
                  className={`mt-2 max-w-[8rem] text-center text-label ${
                    state === "locked" ? "text-muted" : "text-text"
                  }`}
                >
                  {lesson.title}
                </p>
              </div>
            </div>

            {isOpen && <DetailCard item={item} />}
          </div>
        );
      })}
    </div>
  );
}

interface PathNodeProps {
  index: number;
  item: LessonPathItem;
  state: NodeState;
  isOpen: boolean;
  onToggle: () => void;
  onHover: () => void;
}

function PathNode({ index, item, state, isOpen, onToggle, onHover }: PathNodeProps) {
  const base =
    "relative flex h-20 w-20 items-center justify-center rounded-full text-2xl font-heading font-bold shadow-md transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 hover:scale-105";

  let visual: string;
  let inner: React.ReactNode;

  if (state === "locked") {
    visual = "bg-border/60 text-muted ring-1 ring-border";
    inner = <LockIcon />;
  } else if (state === "complete") {
    visual = "bg-accent-green text-white ring-2 ring-accent-green/40";
    inner = <CheckIcon />;
  } else if (state === "active") {
    visual =
      "bg-primary text-white ring-4 ring-primary/30 animate-pulse-dot";
    inner = <span aria-hidden>{index + 1}</span>;
  } else {
    visual = `${NODE_ACCENTS[index % NODE_ACCENTS.length]} ring-2 ring-white`;
    inner = <span aria-hidden>{index + 1}</span>;
  }

  const stateLabel =
    state === "locked"
      ? "locked"
      : state === "complete"
        ? "completed"
        : state === "active"
          ? "in progress"
          : "not started";

  return (
    <button
      type="button"
      aria-label={`${item.lesson.title} — ${stateLabel}. Show details.`}
      aria-expanded={isOpen}
      onClick={onToggle}
      onMouseEnter={onHover}
      className={`${base} ${visual} ${isOpen ? "scale-105" : ""}`}
    >
      {inner}
    </button>
  );
}

interface ConnectorProps {
  fromLean: number;
  toLean: number;
  completed: boolean;
}

function Connector({ fromLean, toLean, completed }: ConnectorProps) {
  const midY = 50;
  return (
    <div className="h-12 w-full" aria-hidden>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <path
          d={`M ${fromLean} 0 C ${fromLean} ${midY}, ${toLean} ${midY}, ${toLean} 100`}
          fill="none"
          stroke={completed ? "var(--color-accent-green)" : "var(--color-border)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 7"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function DetailCard({ item }: { item: LessonPathItem }) {
  const { lesson, locked, completedSteps, timeSpentMs, lastAccessedAt } = item;
  const isComplete = item.progress.completed_at != null;
  const buttonLabel = isComplete
    ? "Review"
    : completedSteps === 0
      ? "Start"
      : "Continue";

  return (
    <div className="card-pop mt-4 p-5">
      <h3 className="font-heading text-heading-md text-text">{lesson.title}</h3>

      <p className="mt-1 text-label text-muted">
        {completedSteps} / {lesson.totalSteps} steps completed
      </p>

      <p className="mt-3 text-body text-muted">{lesson.description}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Typical time" value={`About ${lesson.estimatedMinutes} min`} />
        <Stat label="Time spent" value={formatDuration(timeSpentMs)} />
        <Stat label="Last accessed" value={relativeTime(lastAccessedAt)} />
      </dl>

      <div className="mt-5">
        {locked ? (
          <p className="rounded-xl bg-border/50 px-4 py-3 text-center text-body text-muted">
            Complete the previous lesson to unlock
          </p>
        ) : (
          <Link
            href={`/lesson/${lesson.id}`}
            className="btn-pop inline-flex min-h-[48px] w-full items-center justify-center bg-primary px-4 text-body text-white"
          >
            {buttonLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-muted">{label}</dt>
      <dd className="mt-0.5 text-body font-medium text-text">{value}</dd>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
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
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
