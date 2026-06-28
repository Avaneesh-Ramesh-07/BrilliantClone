"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { NinjaHead, beltForIndex } from "@/components/home/NinjaHead";
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

/** Horizontal lean (in 0-100 viewBox units) used for the gentle zig-zag. */
function leanFor(index: number): number {
  return index % 2 === 0 ? 34 : 66;
}

/**
 * Open-popup state. `sticky` distinguishes a popup opened by click/tap (which
 * stays open until an outside-click or Escape) from a transient hover preview
 * (which auto-hides on mouse-leave).
 */
interface OpenState {
  id: string;
  sticky: boolean;
}

export function LessonPath({ lessons }: LessonPathProps) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const openId = open?.id ?? null;
  const popupRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<OpenState | null>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Hover-intent guard: a short close delay so a momentary pointer exit at the
  // circle's edge (or while travelling onto the popup) doesn't immediately
  // dismiss a transient hover preview.
  const closeTimerRef = useRef<number | null>(null);

  // Keep a ref mirror of the open state so handlers can consult it without
  // needing `open` in their dependency lists.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Clear any pending hover-close timer when the component unmounts.
  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  // Open a sticky popup on click/tap (toggles closed if already sticky-open).
  const toggleOpen = (id: string) => {
    cancelScheduledClose();
    setOpen((cur) => (cur?.id === id && cur.sticky ? null : { id, sticky: true }));
  };

  // Hover opens a transient preview unless a sticky popup is already up.
  const hoverOpen = (id: string) => {
    cancelScheduledClose();
    setOpen((cur) => (cur?.sticky ? cur : { id, sticky: false }));
  };

  // Real mouse-leave closes a transient preview, but only after a brief delay
  // so a tiny boundary wobble or a move onto the popup doesn't flicker it shut.
  const scheduleHoverClose = (id: string) => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen((cur) => (cur && cur.id === id && !cur.sticky ? null : cur));
    }, 140);
  };

  // Dismiss the open popup on an outside click/tap or on Escape. Clicks inside
  // the popup itself, or on the popup's own lesson node, are ignored so they
  // don't immediately close it.
  useEffect(() => {
    if (!open) return;

    const openIndex = lessons.findIndex((l) => l.lesson.id === open.id);

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (nodeRefs.current[openIndex]?.contains(target)) return;
      setOpen(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, lessons]);

  // The user's CURRENT lesson: the first one not yet completed (or the last
  // node when everything is complete). The path is statically coloured green
  // from the first lesson up to and including the connector leading into this
  // node; everything beyond stays grey.
  const firstUncompletedIndex = lessons.findIndex(
    (l) => l.progress.completed_at == null
  );
  const targetNodeIndex =
    firstUncompletedIndex === -1 ? lessons.length - 1 : firstUncompletedIndex;

  // The currently open lesson (if any), resolved to its node so the popover can
  // measure the node's live position for placement.
  const openIndex = open
    ? lessons.findIndex((l) => l.lesson.id === open.id)
    : -1;
  const openItem = openIndex >= 0 ? lessons[openIndex] : null;

  return (
    <div className="flex flex-col">
      {lessons.map((item, index) => {
        const { lesson } = item;
        const state = nodeState(item);
        const isOpen = openId === lesson.id;
        // Connector slot `index` joins node index-1 → node index. It's green
        // when it sits at or before the current lesson, grey otherwise.
        const connectorGreen = index <= targetNodeIndex;
        const isCurrent = index === targetNodeIndex;

        return (
          <div key={lesson.id}>
            {index > 0 && (
              <Connector
                green={connectorGreen}
                fromLean={leanFor(index - 1)}
                toLean={leanFor(index)}
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
                  nodeRef={(el) => {
                    nodeRefs.current[index] = el;
                  }}
                  index={index}
                  item={item}
                  state={state}
                  isOpen={isOpen}
                  isCurrent={isCurrent}
                  onToggle={() => toggleOpen(lesson.id)}
                  onHover={() => hoverOpen(lesson.id)}
                  onLeave={() => scheduleHoverClose(lesson.id)}
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
          </div>
        );
      })}

      {/* The popup is a FIXED, portalled overlay positioned from the open node's
          bounding rect with flip/clamp collision handling, so it's always fully
          on-screen and never pushes layout / moves the circle (no flicker). */}
      {openItem && (
        <LessonPopover
          anchorEl={openIndex >= 0 ? nodeRefs.current[openIndex] : null}
          item={openItem}
          popupRef={popupRef}
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={() => scheduleHoverClose(openItem.lesson.id)}
        />
      )}
    </div>
  );
}

interface PathNodeProps {
  index: number;
  item: LessonPathItem;
  state: NodeState;
  isOpen: boolean;
  /** True for the user's current lesson node (gets a prominent static highlight). */
  isCurrent?: boolean;
  onToggle: () => void;
  onHover: () => void;
  onLeave: () => void;
  nodeRef?: (el: HTMLButtonElement | null) => void;
}

function PathNode({
  index,
  item,
  state,
  isOpen,
  isCurrent,
  onToggle,
  onHover,
  onLeave,
  nodeRef,
}: PathNodeProps) {
  // NOTE: no scale/transform on hover or open, resizing the circle would move
  // its edge out from under the cursor and cause open/close flicker. The hover
  // affordance is a ring + shadow (box-shadow based, so it never changes the
  // node's geometry or hit-area).
  const base =
    "group relative flex h-20 w-20 items-center justify-center rounded-full transition-[box-shadow] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 hover:shadow-lg hover:ring-4 hover:ring-primary/20";

  // Highlight the current lesson node (when it isn't already completed) so it's
  // obvious where the user is. Completed nodes keep their green ring; locked /
  // future nodes are unchanged.
  const highlightCurrent = isCurrent && state !== "complete";

  // Circular "coin" backdrop the ninja head sits on, emphasized per state.
  let backdrop: string;
  if (state === "locked") {
    backdrop = "bg-border/40 ring-1 ring-border";
  } else if (state === "complete") {
    backdrop = "bg-surface ring-2 ring-accent-green/40 shadow-md";
  } else if (highlightCurrent) {
    backdrop = "bg-surface ring-4 ring-primary shadow-lg";
  } else if (state === "active") {
    backdrop = "bg-surface ring-4 ring-primary/30 shadow-md";
  } else {
    backdrop = "bg-surface ring-1 ring-border shadow-md";
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
      ref={nodeRef}
      type="button"
      aria-label={`${item.lesson.title}: ${stateLabel}${
        highlightCurrent ? " (current lesson)" : ""
      }. Show details.`}
      aria-current={highlightCurrent ? "step" : undefined}
      aria-expanded={isOpen}
      onClick={onToggle}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`${base} ${isOpen ? "shadow-lg ring-4 ring-primary/30" : ""}`}
    >
      {/* Soft static glow halo behind the current lesson node. */}
      {highlightCurrent && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1.5 rounded-full ring-2 ring-primary/30"
        />
      )}
      <span
        aria-hidden
        className={`absolute inset-0 rounded-full transition-colors ${backdrop}`}
      />
      <NinjaHead
        belt={beltForIndex(index)}
        state={state}
        className="relative h-14 w-14"
      />
    </button>
  );
}

interface ConnectorProps {
  fromLean: number;
  toLean: number;
  /** Static green dotted path (traversed/up-to-current) vs grey (beyond). */
  green?: boolean;
}

function Connector({ fromLean, toLean, green }: ConnectorProps) {
  const midY = 50;
  const d = `M ${fromLean} 0 C ${fromLean} ${midY}, ${toLean} ${midY}, ${toLean} 100`;
  return (
    <div className="h-12 w-full" aria-hidden>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {/* Dotted connector. Static colour: green up to and including the
            segment leading into the current lesson, grey beyond it. */}
        <path
          d={d}
          fill="none"
          stroke={green ? "var(--color-accent-green)" : "var(--color-border)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 7"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

interface PopoverPos {
  top: number;
  left: number;
  placement: "top" | "bottom";
  /** Arrow x-offset within the card (px), kept pointing at the node centre. */
  arrowLeft: number;
}

/**
 * Renders the lesson `DetailCard` as a FIXED-position element portalled to
 * <body>, positioned from the open node's bounding rect with viewport collision
 * handling so the whole card is always visible:
 *   - Vertically: prefer below the node, FLIP above when there's more room; if
 *     neither side fully fits, clamp within [navBottom+margin, viewportBottom-margin].
 *   - Horizontally: centre on the node, then CLAMP into the viewport.
 * Position is measured after mount (no SSR mismatch, hidden until computed) and
 * recomputed on resize/scroll while open; listeners are cleaned up on close.
 */
function LessonPopover({
  anchorEl,
  item,
  popupRef,
  onMouseEnter,
  onMouseLeave,
}: {
  anchorEl: HTMLElement | null;
  item: LessonPathItem;
  popupRef: RefObject<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [pos, setPos] = useState<PopoverPos | null>(null);

  useEffect(() => {
    if (!anchorEl) return;
    const EDGE = 8; // min gap to the viewport edges
    const GAP = 10; // gap between the node and the card

    const compute = () => {
      const card = popupRef.current;
      if (!card) return;
      const node = anchorEl.getBoundingClientRect();
      const cw = card.offsetWidth;
      const ch = card.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Don't let the card slide under the sticky TopNav.
      const navEl = document.querySelector("nav");
      const navBottom = navEl ? navEl.getBoundingClientRect().bottom : 0;
      const topBound = Math.max(EDGE, navBottom + EDGE);
      const bottomBound = vh - EDGE;

      const spaceBelow = bottomBound - (node.bottom + GAP);
      const spaceAbove = node.top - GAP - topBound;

      let placement: "top" | "bottom";
      if (ch <= spaceBelow) placement = "bottom";
      else if (ch <= spaceAbove) placement = "top";
      else placement = spaceBelow >= spaceAbove ? "bottom" : "top";

      let top =
        placement === "bottom" ? node.bottom + GAP : node.top - GAP - ch;
      // Clamp so the entire card stays between the nav and the bottom edge.
      const maxTop = Math.max(topBound, bottomBound - ch);
      top = Math.min(Math.max(top, topBound), maxTop);

      const nodeCenterX = node.left + node.width / 2;
      let left = nodeCenterX - cw / 2;
      left = Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - EDGE - cw));

      const arrowLeft = Math.min(Math.max(nodeCenterX - left, 16), cw - 16);

      setPos({ top, left, placement, arrowLeft });
    };

    compute();
    window.addEventListener("resize", compute);
    // Capture phase so scrolling in any ancestor container also recomputes.
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [anchorEl, item.lesson.id, popupRef]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popupRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 w-80 max-w-[calc(100vw-1rem)]"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {/* Small anchor arrow pointing back at the lesson node. */}
      {pos && (
        <span
          aria-hidden
          className="absolute h-3 w-3 rotate-45 border border-border bg-surface"
          style={
            pos.placement === "bottom"
              ? {
                  top: -6,
                  left: pos.arrowLeft - 6,
                  borderRight: "none",
                  borderBottom: "none",
                }
              : {
                  bottom: -6,
                  left: pos.arrowLeft - 6,
                  borderLeft: "none",
                  borderTop: "none",
                }
          }
        />
      )}
      <DetailCard item={item} />
    </div>,
    document.body
  );
}

function DetailCard({
  item,
  cardRef,
}: {
  item: LessonPathItem;
  cardRef?: Ref<HTMLDivElement>;
}) {
  const { lesson, locked, completedSteps, timeSpentMs, lastAccessedAt } = item;
  const isComplete = item.progress.completed_at != null;
  const buttonLabel = isComplete
    ? "Review"
    : completedSteps === 0
      ? "Start"
      : "Continue";

  return (
    <div ref={cardRef} className="card-pop relative w-full p-5">
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
