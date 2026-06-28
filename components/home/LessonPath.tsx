"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { NinjaHead, beltForIndex } from "@/components/home/NinjaHead";
import { RunningNinja } from "@/components/home/RunningNinja";
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

interface Point {
  x: number;
  y: number;
}

/**
 * A connector segment that the ninja traverses. `startFrac`/`endFrac` are the
 * connector's start/end positions as a fraction (0..1) of the TOTAL run
 * distance, so its green overlay can be revealed in lock-step with the ninja's
 * progress (the reveal path uses pathLength=1, so its strokeDashoffset is
 * driven from 1 down to 0 across [startFrac, endFrac]).
 */
interface GreenSeg {
  index: number;
  startFrac: number;
  endFrac: number;
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

  // --- Running-ninja path animation state ----------------------------------
  // The positioned overlay container the ninja/trails are measured against.
  const containerRef = useRef<HTMLDivElement>(null);
  // Per-connector measuring + reveal refs (the box, the masked reveal path, and
  // the green dotted overlay whose opacity is armed when the run starts).
  const connectorRefs = useRef<(HTMLDivElement | null)[]>([]);
  // The masked reveal path (driven during the run). Geometry is measured off
  // `geomRefs` (the always-rendered base grey path) instead, because path
  // metrics on elements inside <defs>/<mask> are unreliable across browsers.
  const revealRefs = useRef<(SVGPathElement | null)[]>([]);
  const geomRefs = useRef<(SVGPathElement | null)[]>([]);
  const greenSegsRef = useRef<GreenSeg[] | null>(null);
  // The travel polyline (container-relative px) the ninja follows; null when no
  // run is active (reduced motion, popup open, nothing to traverse, or done).
  const [route, setRoute] = useState<Point[] | null>(null);
  const ninjaRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<{ index: number; center: Point } | null>(null);
  const [impactIndex, setImpactIndex] = useState<number | null>(null);
  // True once the run has begun: arms the green dotted overlays (opacity 0 ->
  // 1) so they never flash green before the masked reveal starts.
  const [runStarted, setRunStarted] = useState(false);
  // True while the figure is diving into the target node (swaps bob -> dive).
  const [diving, setDiving] = useState(false);
  // Connector indices whose green "traversed" overlay should persist (fully
  // lit, mask dropped): the resting/fallback green-up-to-target coloring.
  const [litConnectors, setLitConnectors] = useState<number[]>([]);
  const hasRunRef = useRef(false);
  const [trails, setTrails] = useState<{ id: number; x: number; y: number }[]>(
    []
  );
  const trailIdRef = useRef(0);

  // The user's CURRENT lesson: the first one not yet completed (or the last
  // node when everything is complete). The path is coloured green from the
  // first lesson up to and including the connector leading into this node;
  // everything beyond stays grey.
  const firstUncompletedIndex = lessons.findIndex(
    (l) => l.progress.completed_at == null
  );
  const targetNodeIndex =
    firstUncompletedIndex === -1 ? lessons.length - 1 : firstUncompletedIndex;

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

  // Measure the on-screen route the ninja should run (node 0's outer edge,
  // along each drawn connector, to the target node's outer edge) and decide
  // whether to animate at all. Runs once per home load. Bails to the static
  // green-up-to-target path (no ninja) under reduced motion, when a popup is
  // already open, or when there's nothing to traverse.
  useEffect(() => {
    if (hasRunRef.current) return;
    if (lessons.length === 0) return;

    const target = targetNodeIndex;
    const greenIndices: number[] = [];
    for (let i = 1; i <= target; i++) greenIndices.push(i);

    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // No run: settle straight to the resting green-up-to-target coloring. This
    // path DOES consume hasRunRef (the decision not to animate is final).
    const settleStatic = () => {
      hasRunRef.current = true;
      if (greenIndices.length > 0) setLitConnectors(greenIndices);
    };

    if (prefersReduced || openRef.current || target <= 0) {
      settleStatic();
      return;
    }

    // Build the screen-space route. Returns null when the geometry isn't ready
    // yet (zero-size / not-yet-laid-out container, degenerate path metrics, or
    // a ~0-length total) so the caller can retry instead of giving up. Crucially
    // this does NOT consume hasRunRef on failure, so a too-early or degenerate
    // measurement never permanently disables the animation.
    const buildRoute = (): Point[] | null => {
      const container = containerRef.current;
      if (!container) return null;
      const cRect = container.getBoundingClientRect();
      // Container not laid out / hidden (e.g. a collapsed responsive column):
      // bail and let the ResizeObserver/rAF retry once it has a real size.
      if (cRect.width < 1 || cRect.height < 1) return null;

      const startNode = nodeRefs.current[0];
      const endNode = nodeRefs.current[target];
      if (!startNode || !endNode) return null;

      const center = (el: HTMLElement): Point => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - cRect.left + r.width / 2,
          y: r.top - cRect.top + r.height / 2,
        };
      };

      // Sample connector[i]'s ACTUAL drawn SVG path (between node[i-1] and
      // node[i]) by arc length, mapping each point into container px. We measure
      // off the always-rendered BASE grey path (geomRefs), whose getTotalLength
      // / getPointAtLength are reliable; the masked reveal path is only driven.
      // The SVG uses viewBox 0..100 with preserveAspectRatio="none", so the
      // 0..100 user box is stretched to the div's rect:
      //   pxX = rectLeft + (userX/100)*width ; pxY = rectTop + (userY/100)*height.
      const SAMPLES = 28;
      const sampleConnector = (i: number): Point[] => {
        const div = connectorRefs.current[i];
        const path = geomRefs.current[i];
        if (!div || !path) return [];
        const r = div.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return [];
        let totalLen = 0;
        try {
          totalLen = path.getTotalLength();
        } catch {
          return [];
        }
        if (!Number.isFinite(totalLen) || totalLen <= 0) return [];
        const left = r.left - cRect.left;
        const top = r.top - cRect.top;
        const pts: Point[] = [];
        for (let s = 0; s <= SAMPLES; s++) {
          const pt = path.getPointAtLength((s / SAMPLES) * totalLen);
          pts.push({
            x: left + (pt.x / 100) * r.width,
            y: top + (pt.y / 100) * r.height,
          });
        }
        return pts;
      };

      // Stitch the connector paths in order: start just OUTSIDE node 0 (the
      // first connector's `M` point sits at the circle edge) and end just
      // outside the target node (the last connector's final drawn point).
      const points: Point[] = [];
      const bounds: { index: number; startIdx: number; endIdx: number }[] = [];
      for (let i = 1; i <= target; i++) {
        const pts = sampleConnector(i);
        if (pts.length < 2) continue;
        const startIdx = points.length;
        points.push(...pts);
        bounds.push({ index: i, startIdx, endIdx: points.length - 1 });
      }
      if (points.length < 2) return null;

      // Cumulative on-screen distance along the whole route.
      const cum: number[] = [0];
      for (let k = 1; k < points.length; k++) {
        cum.push(
          cum[k - 1] +
            Math.hypot(
              points[k].x - points[k - 1].x,
              points[k].y - points[k - 1].y
            )
        );
      }
      const totalDist = cum[points.length - 1];
      if (!Number.isFinite(totalDist) || totalDist < 2) return null;

      // Per-connector fractions of the total run, so each green overlay can
      // light progressively (its reveal path's strokeDashoffset is driven
      // 1 -> 0 across [startFrac, endFrac]) exactly as the ninja crosses it.
      greenSegsRef.current = bounds.map((b) => ({
        index: b.index,
        startFrac: cum[b.startIdx] / totalDist,
        endFrac: cum[b.endIdx] / totalDist,
      }));
      targetRef.current = { index: target, center: center(endNode) };
      return points;
    };

    let cancelled = false;
    let rafId = 0;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // ~0.5s of rAF retries before relying on the observer
    let observer: ResizeObserver | null = null;

    const stop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      observer?.disconnect();
      observer = null;
    };

    // One measurement attempt. On success consumes hasRunRef ONCE and starts the
    // run; returns whether it succeeded (or should otherwise stop retrying).
    const attempt = (): boolean => {
      if (cancelled || hasRunRef.current) return true;
      const points = buildRoute();
      if (!points) return false;
      hasRunRef.current = true;
      stop();
      setRoute(points);
      return true;
    };

    // rAF retry loop: defers past initial layout, then keeps trying for a short
    // window so a late-laid-out / async-sized container still triggers exactly
    // one run as soon as its geometry is valid.
    const tick = () => {
      rafId = 0;
      if (attempt()) return;
      attempts += 1;
      if (attempts < MAX_ATTEMPTS && !cancelled && !hasRunRef.current) {
        rafId = window.requestAnimationFrame(tick);
      }
    };
    rafId = window.requestAnimationFrame(tick);

    // ResizeObserver: the moment the container gains a real size (responsive
    // breakpoint resolving, fonts/layout settling, becoming visible), measure
    // once more. Guarded by hasRunRef so it only ever starts a single run.
    const container = containerRef.current;
    if (typeof ResizeObserver !== "undefined" && container) {
      observer = new ResizeObserver(() => {
        if (cancelled || hasRunRef.current) {
          stop();
          return;
        }
        // Measure on the next frame so child connector/node layout has settled.
        window.requestAnimationFrame(() => {
          if (cancelled || hasRunRef.current) return;
          attempt();
        });
      });
      observer.observe(container);
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [lessons, targetNodeIndex]);

  // Physically run the ninja along the reconstructed route with the Web
  // Animations API, advancing each crossed connector's green reveal in
  // lock-step, then dive into the target node. Cancels + freezes the static
  // green coloring if a popup opens mid-run; cleans up on unmount.
  useEffect(() => {
    if (!route || route.length < 2) return;

    const greenIndices = (greenSegsRef.current ?? []).map((s) => s.index);

    // A lesson popup opened: cancel the run, hide the ninja/trails, and freeze
    // the reveals at the static target coloring (green up to target).
    if (open) {
      setRoute(null);
      setTrails([]);
      setImpactIndex(null);
      setDiving(false);
      if (greenIndices.length > 0) setLitConnectors(greenIndices);
      return;
    }

    const el = ninjaRef.current;
    if (!el) return;

    const cum: number[] = [0];
    for (let i = 1; i < route.length; i++) {
      cum.push(
        cum[i - 1] +
          Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y)
      );
    }
    const total = cum[cum.length - 1];
    if (total < 2) {
      const t = window.setTimeout(() => setRoute(null), 500);
      return () => window.clearTimeout(t);
    }

    const RUN_MS = 1500;
    const RUN_DELAY = 300; // pause at the first lesson, then dash to the target
    const EASING = "cubic-bezier(0.45, 0.05, 0.3, 1)";

    // Arm the green dotted overlays so they fade in (opacity 0 -> 1) only once
    // the run is underway; the mask still hides them until the ninja crosses.
    setRunStarted(true);

    // A viewport resize invalidates the measured px route: abort the run and
    // settle to the static green-up-to-target coloring instead of animating
    // along stale coordinates.
    const onResize = () => {
      setRoute(null);
      setTrails([]);
      setImpactIndex(null);
      setDiving(false);
      if (greenIndices.length > 0) setLitConnectors(greenIndices);
    };
    window.addEventListener("resize", onResize);

    const keyframes: Keyframe[] = route.map((p, i) => ({
      offset: cum[i] / total,
      top: `${p.y}px`,
      left: `${p.x}px`,
    }));

    const anim = el.animate(keyframes, {
      duration: RUN_MS,
      delay: RUN_DELAY,
      easing: EASING,
      fill: "forwards",
    });

    // Progressive grey -> green reveal of the traversed connectors. Each reveal
    // path uses pathLength=1, so strokeDashoffset goes 1 (hidden) -> 0
    // (revealed) across the connector's [startFrac, endFrac] window of the SAME
    // eased run timeline; because the ninja's keyframe offsets are also distance
    // fractions, the revealed length tracks the ninja in lock-step. fill:"both"
    // keeps it hidden during the initial pause and fully revealed afterwards.
    const greenAnims: Animation[] = [];
    for (const seg of greenSegsRef.current ?? []) {
      const path = revealRefs.current[seg.index];
      if (!path) continue;
      const frames: Keyframe[] = [
        { strokeDashoffset: 1, offset: 0 },
      ];
      if (seg.startFrac > 0.0001) {
        frames.push({ strokeDashoffset: 1, offset: seg.startFrac });
      }
      const litOffset = Math.min(
        1,
        Math.max(seg.endFrac, seg.startFrac + 0.0001)
      );
      frames.push({ strokeDashoffset: 0, offset: litOffset });
      if (litOffset < 1) {
        frames.push({ strokeDashoffset: 0, offset: 1 });
      }
      greenAnims.push(
        path.animate(frames, {
          duration: RUN_MS,
          delay: RUN_DELAY,
          easing: EASING,
          fill: "both",
        })
      );
    }

    // Drop fading dashed "speed lines" behind the ninja while it runs.
    const container = containerRef.current;
    let trailInterval: number | undefined;
    const trailStart = window.setTimeout(() => {
      trailInterval = window.setInterval(() => {
        const node = ninjaRef.current;
        if (!node || !container) return;
        const nr = node.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        const x = nr.left - cr.left + nr.width / 2;
        const y = nr.top - cr.top + nr.height / 2;
        const id = (trailIdRef.current += 1);
        setTrails((cur) => [...cur, { id, x, y }]);
        window.setTimeout(
          () => setTrails((cur) => cur.filter((p) => p.id !== id)),
          500
        );
      }, 70);
    }, RUN_DELAY);

    let removeTimer: number | undefined;
    let impactTimer: number | undefined;
    let diveAnim: Animation | undefined;

    anim.onfinish = () => {
      if (trailInterval) window.clearInterval(trailInterval);

      // Persist the green illumination declaratively so it survives the
      // eventual cancellation of the reveal animations + later re-renders.
      if (greenIndices.length > 0) setLitConnectors(greenIndices);

      const target = targetRef.current;
      const arrival = route[route.length - 1];
      const DIVE_MS = 620;

      if (target) {
        const targetCenter = target.center;
        const apex = {
          x: (arrival.x + targetCenter.x) / 2,
          y: Math.min(arrival.y, targetCenter.y) - 26, // hop up before plunging
        };

        // Travel from the path's end into the node centre; the figure's own
        // tuck/shrink is the CSS `animate-ninja-dive` swapped in via `diving`.
        diveAnim = el.animate(
          [
            { top: `${arrival.y}px`, left: `${arrival.x}px`, offset: 0 },
            { top: `${apex.y}px`, left: `${apex.x}px`, offset: 0.32 },
            { top: `${targetCenter.y}px`, left: `${targetCenter.x}px`, offset: 1 },
          ],
          {
            duration: DIVE_MS,
            easing: "cubic-bezier(0.45, 0, 0.75, 0.2)",
            fill: "forwards",
          }
        );
        setDiving(true);

        // Landing reaction (coin bounce + ring ripple) timed to arrival.
        impactTimer = window.setTimeout(() => {
          setImpactIndex(target.index);
        }, DIVE_MS - 120);
      }

      removeTimer = window.setTimeout(() => {
        setRoute(null);
        setImpactIndex(null);
        setDiving(false);
        setTrails([]);
      }, DIVE_MS + 220);
    };

    return () => {
      window.removeEventListener("resize", onResize);
      anim.cancel();
      diveAnim?.cancel();
      // Cancel the reveal animations. After a normal finish litConnectors is
      // set, so the green overlays persist (mask dropped); if interrupted the
      // popup branch sets the static target coloring before this teardown.
      greenAnims.forEach((g) => g.cancel());
      window.clearTimeout(trailStart);
      if (trailInterval) window.clearInterval(trailInterval);
      if (impactTimer) window.clearTimeout(impactTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    };
  }, [route, open]);

  // The currently open lesson (if any), resolved to its node so the popover can
  // measure the node's live position for placement.
  const openIndex = open
    ? lessons.findIndex((l) => l.lesson.id === open.id)
    : -1;
  const openItem = openIndex >= 0 ? lessons[openIndex] : null;

  return (
    <div ref={containerRef} className="relative flex flex-col">
      {lessons.map((item, index) => {
        const { lesson } = item;
        const state = nodeState(item);
        const isOpen = openId === lesson.id;
        // Connector slot `index` joins node index-1 → node index. It's within
        // the green range when it sits at or before the current lesson, grey
        // beyond. `lit` shows its green dotted overlay in full (resting state);
        // during a run the overlay is revealed progressively via its mask.
        const connectorGreen = index <= targetNodeIndex;
        const isCurrent = index === targetNodeIndex;

        return (
          <div key={lesson.id}>
            {index > 0 && (
              <Connector
                green={connectorGreen}
                lit={litConnectors.includes(index)}
                armed={runStarted}
                fromLean={leanFor(index - 1)}
                toLean={leanFor(index)}
                divRef={(el) => {
                  connectorRefs.current[index] = el;
                }}
                revealRef={(el) => {
                  revealRefs.current[index] = el;
                }}
                geomRef={(el) => {
                  geomRefs.current[index] = el;
                }}
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
                  impact={impactIndex === index}
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

      {/* Fading dashed "speed lines" dropped behind the running ninja. */}
      {trails.map((t) => (
        <span
          key={t.id}
          aria-hidden
          className="ninja-trail-mark pointer-events-none absolute z-30"
          style={{ top: t.y, left: t.x }}
        >
          <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
            <line x1="16" y1="4" x2="27" y2="4" stroke="#9aa1ab" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="13" y1="8" x2="26" y2="8" stroke="#9aa1ab" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="17" y1="12" x2="25" y2="12" stroke="#9aa1ab" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
          </svg>
        </span>
      ))}

      {/* The running ninja figure: an absolutely-positioned overlay the WAAPI
          controller drives along the measured route, then dives into the node. */}
      {route && route.length > 0 && (
        <div
          ref={ninjaRef}
          aria-hidden
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2"
          style={{ top: route[0].y, left: route[0].x }}
        >
          <span
            ref={figureRef}
            className={`block drop-shadow-md ${
              diving ? "animate-ninja-dive" : "animate-ninja-bob"
            }`}
          >
            <RunningNinja />
          </span>
        </div>
      )}

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
  /** True briefly as the ninja dives in (coin bounce + ring ripple). */
  impact?: boolean;
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
  impact,
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
        className={`absolute inset-0 rounded-full transition-colors ${backdrop} ${
          impact ? "animate-node-impact" : ""
        }`}
      />
      {impact && (
        <span
          aria-hidden
          className="animate-node-ripple pointer-events-none absolute inset-0 rounded-full ring-4 ring-primary/50"
        />
      )}
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
  /** Within the green range (index <= target): gets a green dotted overlay. */
  green?: boolean;
  /** Show the green dotted overlay in FULL (resting/persisted; mask dropped). */
  lit?: boolean;
  /** The run has started: fade the overlay in (opacity 0 -> 1) behind its mask. */
  armed?: boolean;
  divRef?: (el: HTMLDivElement | null) => void;
  /** The mask's reveal path; the controller drives its strokeDashoffset 1 -> 0. */
  revealRef?: (el: SVGPathElement | null) => void;
  /** The always-rendered base path; the controller measures geometry off it. */
  geomRef?: (el: SVGPathElement | null) => void;
}

function Connector({
  fromLean,
  toLean,
  green,
  lit,
  armed,
  divRef,
  revealRef,
  geomRef,
}: ConnectorProps) {
  const midY = 50;
  const d = `M ${fromLean} 0 C ${fromLean} ${midY}, ${toLean} ${midY}, ${toLean} 100`;
  // Stable, render-safe mask id per connector instance.
  const maskId = `conn-reveal-${useId().replace(/[:]/g, "")}`;

  // The green dotted overlay is hidden until the run arms it (opacity 0 -> 1),
  // which also prevents an initial green flash before the masked reveal starts.
  const overlayOpacity = lit || armed ? 1 : 0;

  return (
    <div ref={divRef} className="h-12 w-full" aria-hidden>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {green && (
          <defs>
            {/* Mask whose white region grows ALONG the path: the reveal path's
                strokeDashoffset is driven 1 -> 0 in lock-step with the ninja.
                The green dotted overlay is painted only where this mask is
                white; a wide white stroke fully covers the dot thickness so the
                revealed dots read as fully green. */}
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x="-20"
              y="-20"
              width="140"
              height="140"
            >
              <path
                ref={revealRef}
                d={d}
                fill="none"
                stroke="#fff"
                strokeWidth="14"
                strokeLinecap="round"
                pathLength={1}
                vectorEffect="non-scaling-stroke"
                style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
              />
            </mask>
          </defs>
        )}

        {/* Base GREY dotted connector. ALWAYS grey; the green comes from the
            overlay above so traversed segments can illuminate progressively.
            This is the always-rendered path the controller measures geometry
            off (getTotalLength/getPointAtLength). */}
        <path
          ref={geomRef}
          d={d}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 7"
          vectorEffect="non-scaling-stroke"
        />

        {/* GREEN dotted overlay - IDENTICAL dot pattern, only the colour
            differs. Revealed progressively through the mask as the ninja
            passes; once `lit` the mask is dropped so the whole connector stays
            green dotted (the resting / fallback coloring). Beyond-target
            connectors omit this entirely and read plain grey. */}
        {green && (
          <path
            d={d}
            fill="none"
            stroke="var(--color-accent-green)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 7"
            vectorEffect="non-scaling-stroke"
            style={{ opacity: overlayOpacity }}
            mask={lit ? undefined : `url(#${maskId})`}
          />
        )}
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
