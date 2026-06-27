"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type Ref } from "react";
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

/** Horizontal lean (in 0–100 viewBox units) used for the gentle zig-zag. */
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
 * distance, so its green overlay can be drawn in lock-step with the ninja's
 * progress. `pxLen` is the connector path's on-screen length (used for the
 * stroke-dasharray "draw line" technique).
 */
interface GreenSeg {
  index: number;
  startFrac: number;
  endFrac: number;
  pxLen: number;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<OpenState | null>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const connectorRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Refs to each connector's white mask "reveal" path. Its geometry matches the
  // visible connector path, so it's used both to sample the route and to drive
  // the progressive grey→green reveal (by animating its stroke-dashoffset).
  const revealRefs = useRef<(SVGPathElement | null)[]>([]);
  const greenSegsRef = useRef<GreenSeg[] | null>(null);
  const [route, setRoute] = useState<Point[] | null>(null);
  const ninjaRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<{ index: number; center: Point } | null>(null);
  const [impactIndex, setImpactIndex] = useState<number | null>(null);
  const [dust, setDust] = useState<Point | null>(null);
  // Connector indices whose green "traversed" overlay should persist (lit) once
  // the ninja has finished walking the route.
  const [litConnectors, setLitConnectors] = useState<number[]>([]);
  const hasRunRef = useRef(false);
  const [trails, setTrails] = useState<{ id: number; x: number; y: number }[]>(
    []
  );
  const trailIdRef = useRef(0);

  // Keep a ref mirror of the open state so the run-once-on-mount animation can
  // consult it without needing `open` in its dependency list.
  useEffect(() => {
    openRef.current = open;
  }, [open]);

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

  // Run a little ninja ALONG the drawn path (the curved connectors) from the
  // first lesson to the first uncompleted node (or the last node when
  // everything is complete) — once, on mount.
  useEffect(() => {
    if (hasRunRef.current) return;
    // Don't start the ninja run while a lesson popup is open.
    if (openRef.current) return;
    const container = containerRef.current;
    if (!container || lessons.length === 0) return;

    const firstUncompleted = lessons.findIndex(
      (l) => l.progress.completed_at == null
    );
    const targetIndex =
      firstUncompleted === -1 ? lessons.length - 1 : firstUncompleted;

    // Brand-new account / single node: target is the start, nothing to run.
    if (targetIndex <= 0) return;

    const startNode = nodeRefs.current[0];
    const endNode = nodeRefs.current[targetIndex];
    if (!startNode || !endNode) return;

    const cRect = container.getBoundingClientRect();
    const center = (el: HTMLElement): Point => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - cRect.left + r.width / 2,
        y: r.top - cRect.top + r.height / 2,
      };
    };

    // Sample connector[i]'s ACTUAL drawn SVG path (between node[i-1] and
    // node[i]) by arc length, mapping each point into container px. The SVG
    // uses viewBox 0..100 with preserveAspectRatio="none", so the 0..100 user
    // box is stretched to the div's rect:
    //   pxX = rectLeft + (userX/100)*width ; pxY = rectTop + (userY/100)*height.
    // getPointAtLength gives arc-length-uniform samples so the ninja's distance
    // and the green "draw line" stay perfectly in sync within each connector.
    const SAMPLES = 28;
    const sampleConnector = (i: number): Point[] => {
      const div = connectorRefs.current[i];
      const path = revealRefs.current[i];
      if (!div || !path) return [];
      const r = div.getBoundingClientRect();
      const left = r.left - cRect.left;
      const top = r.top - cRect.top;
      const total = path.getTotalLength();
      const pts: Point[] = [];
      for (let s = 0; s <= SAMPLES; s++) {
        const pt = path.getPointAtLength((s / SAMPLES) * total);
        pts.push({
          x: left + (pt.x / 100) * r.width,
          y: top + (pt.y / 100) * r.height,
        });
      }
      return pts;
    };

    // Concatenate the connector paths exactly: start at the FIRST point of the
    // first connector's drawn line (its `M` point, just below node[0]) and end
    // at the LAST point of the last connector's drawn line (just above the
    // target node). No node-center anchoring and no radius trims — the run maps
    // exactly onto the drawn dotted path. Consecutive connectors are joined by a
    // short straight bridge across the intermediate node circle.
    const route: Point[] = [];
    const bounds: { index: number; startIdx: number; endIdx: number }[] = [];
    for (let i = 1; i <= targetIndex; i++) {
      const pts = sampleConnector(i);
      if (pts.length < 2) continue;
      const startIdx = route.length;
      route.push(...pts);
      bounds.push({ index: i, startIdx, endIdx: route.length - 1 });
    }

    if (route.length < 2) return;

    // Cumulative on-screen distance along the whole route.
    const cum: number[] = [0];
    for (let k = 1; k < route.length; k++) {
      cum.push(
        cum[k - 1] +
          Math.hypot(route[k].x - route[k - 1].x, route[k].y - route[k - 1].y)
      );
    }
    const total = cum[route.length - 1];
    if (total < 2) return;

    // Per-connector fractions of the total run + on-screen length, so each
    // green overlay can light progressively as the ninja crosses it.
    const greenSegs: GreenSeg[] = bounds.map((b) => ({
      index: b.index,
      startFrac: cum[b.startIdx] / total,
      endFrac: cum[b.endIdx] / total,
      pxLen: cum[b.endIdx] - cum[b.startIdx],
    }));

    // Remember the ACTUAL target node center so the finale can dive from the
    // end of the dotted path straight into the circle.
    targetRef.current = { index: targetIndex, center: center(endNode) };
    greenSegsRef.current = greenSegs;

    hasRunRef.current = true;
    setRoute(route);
  }, [lessons]);

  // Physically run the ninja along the reconstructed route using the Web
  // Animations API. We sample the curved connectors into a polyline and emit a
  // multi-keyframe animation whose offsets are proportional to the cumulative
  // distance along the path, so the ninja tracks the visible zig-zag at a
  // roughly constant speed instead of cutting a straight diagonal.
  useEffect(() => {
    if (!route || route.length < 2) return;
    // A lesson popup is open: don't run/dive. Tear down the ninja + trails so
    // nothing keeps moving while the popup is up. (Run-once: it won't restart.)
    if (open) {
      setRoute(null);
      setTrails([]);
      setImpactIndex(null);
      setDust(null);
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
    // Start and target are effectively the same point: nothing to run to.
    if (total < 2) {
      const t = window.setTimeout(() => setRoute(null), 500);
      return () => window.clearTimeout(t);
    }

    const keyframes: Keyframe[] = route.map((p, i) => ({
      offset: cum[i] / total,
      top: `${p.y}px`,
      left: `${p.x}px`,
    }));

    const anim = el.animate(keyframes, {
      duration: 1500,
      delay: 300, // pause at the first lesson, then dash to the target
      easing: "cubic-bezier(0.45, 0.05, 0.3, 1)",
      fill: "forwards",
    });

    // Progressive grey→green reveal of the traversed path. Each connector has a
    // green DOTTED copy (identical dot pattern to the grey one) sitting exactly
    // on top, exposed through a white mask path. We "draw on" that mask path
    // (stroke-dashoffset L → 0) over the SAME eased timeline as the ninja, but
    // only across the window [startFrac, endFrac] where the ninja is crossing
    // that connector. Because the ninja's keyframe offsets are also distance
    // fractions of the total route, the revealed length tracks the ninja's live
    // position in lock-step. fill:"both" keeps the mask hidden during the
    // initial pause and fully revealed afterwards.
    const greenAnims: Animation[] = [];
    for (const seg of greenSegsRef.current ?? []) {
      const path = revealRefs.current[seg.index];
      if (!path) continue;
      const L = seg.pxLen;
      const frames: Keyframe[] = [
        { strokeDasharray: `${L}`, strokeDashoffset: `${L}`, offset: 0 },
      ];
      if (seg.startFrac > 0.0001) {
        frames.push({
          strokeDasharray: `${L}`,
          strokeDashoffset: `${L}`,
          offset: seg.startFrac,
        });
      }
      const litOffset = Math.min(
        1,
        Math.max(seg.endFrac, seg.startFrac + 0.0001)
      );
      frames.push({
        strokeDasharray: `${L}`,
        strokeDashoffset: `0`,
        offset: litOffset,
      });
      if (litOffset < 1) {
        frames.push({
          strokeDasharray: `${L}`,
          strokeDashoffset: `0`,
          offset: 1,
        });
      }
      greenAnims.push(
        path.animate(frames, {
          duration: 1500,
          delay: 300,
          easing: "cubic-bezier(0.45, 0.05, 0.3, 1)",
          fill: "both",
        })
      );
    }

    // Drop fading dashed "speed lines" behind the ninja as it runs. We start
    // after the initial pause and sample the ninja's live position each tick.
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
    }, 300);

    let removeTimer: number | undefined;
    let impactTimer: number | undefined;
    let diveAnim: Animation | undefined;
    let figureAnim: Animation | undefined;

    anim.onfinish = () => {
      if (trailInterval) window.clearInterval(trailInterval);

      // The ninja reached the end of the dotted path: persist the green
      // illumination declaratively so it survives later re-renders (and the
      // eventual cancellation of the draw animations).
      const litIndices = (greenSegsRef.current ?? []).map((s) => s.index);
      if (litIndices.length > 0) setLitConnectors(litIndices);

      const target = targetRef.current;
      const arrival = route[route.length - 1];
      const DIVE_MS = 620;

      // Dive INTO the target node circle: a short anticipatory hop, then a
      // plunge toward the node center while the figure shrinks + tucks.
      if (target) {
        const center = target.center;
        const apex = {
          x: (arrival.x + center.x) / 2,
          y: Math.min(arrival.y, center.y) - 26, // hop up before plunging
        };

        diveAnim = el.animate(
          [
            { top: `${arrival.y}px`, left: `${arrival.x}px`, offset: 0 },
            { top: `${apex.y}px`, left: `${apex.x}px`, offset: 0.32 },
            { top: `${center.y}px`, left: `${center.x}px`, offset: 1 },
          ],
          {
            duration: DIVE_MS,
            easing: "cubic-bezier(0.45, 0, 0.75, 0.2)",
            fill: "forwards",
          }
        );

        // The figure tucks/rotates and shrinks to nothing as it enters.
        const fig = figureRef.current;
        if (fig) {
          figureAnim = fig.animate(
            [
              { transform: "scale(1) rotate(0deg)", offset: 0 },
              { transform: "scale(1.08) rotate(-12deg)", offset: 0.32 },
              { transform: "scale(0.12) rotate(260deg)", opacity: 0.85, offset: 1 },
            ],
            {
              duration: DIVE_MS,
              easing: "cubic-bezier(0.5, 0, 0.85, 0.3)",
              fill: "forwards",
            }
          );
        }

        // Impact reaction on the node (ring ripple + coin bounce) + dust puff,
        // timed to the moment the ninja reaches the circle.
        impactTimer = window.setTimeout(() => {
          setImpactIndex(target.index);
          setDust(center);
        }, DIVE_MS - 120);
      }

      removeTimer = window.setTimeout(() => {
        setRoute(null);
        setImpactIndex(null);
        setDust(null);
        setTrails([]);
      }, DIVE_MS + 220);
    };

    return () => {
      anim.cancel();
      diveAnim?.cancel();
      figureAnim?.cancel();
      // Cancel the mask reveal animations. After a normal finish litConnectors
      // is set, so the green dotted overlays persist (mask dropped); if
      // interrupted (popup opened) litConnectors is empty, so the masks revert
      // to hidden and the connectors read grey again.
      greenAnims.forEach((g) => g.cancel());
      window.clearTimeout(trailStart);
      if (trailInterval) window.clearInterval(trailInterval);
      if (impactTimer) window.clearTimeout(impactTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    };
  }, [route, open]);

  return (
    <div ref={containerRef} className="relative flex flex-col">
      {lessons.map((item, index) => {
        const { lesson } = item;
        const state = nodeState(item);
        const isOpen = openId === lesson.id;

        return (
          <div key={lesson.id}>
            {index > 0 && (
              <Connector
                divRef={(el) => {
                  connectorRefs.current[index] = el;
                }}
                revealRef={(el) => {
                  revealRefs.current[index] = el;
                }}
                lit={litConnectors.includes(index)}
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
                  nodeRef={(el) => {
                    nodeRefs.current[index] = el;
                  }}
                  index={index}
                  item={item}
                  state={state}
                  isOpen={isOpen}
                  impact={impactIndex === index}
                  onToggle={() =>
                    setOpen((cur) =>
                      cur?.id === lesson.id && cur.sticky
                        ? null
                        : { id: lesson.id, sticky: true }
                    )
                  }
                  onHover={() =>
                    setOpen((cur) =>
                      cur?.sticky ? cur : { id: lesson.id, sticky: false }
                    )
                  }
                  onLeave={() =>
                    setOpen((cur) =>
                      cur && cur.id === lesson.id && !cur.sticky ? null : cur
                    )
                  }
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

            {isOpen && <DetailCard item={item} cardRef={popupRef} />}
          </div>
        );
      })}

      {trails.map((t) => (
        <span
          key={t.id}
          aria-hidden
          className="ninja-trail-mark pointer-events-none absolute z-10"
          style={{ top: t.y, left: t.x }}
        >
          <svg width="28" height="16" viewBox="0 0 28 16" fill="none">
            <line x1="16" y1="4" x2="27" y2="4" stroke="#9aa1ab" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="13" y1="8" x2="26" y2="8" stroke="#9aa1ab" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
            <line x1="17" y1="12" x2="25" y2="12" stroke="#9aa1ab" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
          </svg>
        </span>
      ))}

      {route && route.length > 0 && (
        <div
          ref={ninjaRef}
          aria-hidden
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ top: route[0].y, left: route[0].x }}
        >
          <span
            ref={figureRef}
            className="animate-ninja-bob block drop-shadow-md"
          >
            <RunningNinja />
          </span>
        </div>
      )}

      {dust && (
        <span
          aria-hidden
          className="ninja-dust-puff animate-ninja-dust pointer-events-none absolute z-10"
          style={{ top: dust.y, left: dust.x }}
        >
          <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
            <circle cx="12" cy="16" r="5" fill="#cfd4dc" opacity="0.8" />
            <circle cx="22" cy="12" r="6" fill="#dde1e8" opacity="0.75" />
            <circle cx="30" cy="17" r="4.5" fill="#cfd4dc" opacity="0.7" />
          </svg>
        </span>
      )}
    </div>
  );
}

interface PathNodeProps {
  index: number;
  item: LessonPathItem;
  state: NodeState;
  isOpen: boolean;
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
  impact,
  onToggle,
  onHover,
  onLeave,
  nodeRef,
}: PathNodeProps) {
  const base =
    "group relative flex h-20 w-20 items-center justify-center rounded-full transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 hover:scale-105";

  // Circular "coin" backdrop the ninja head sits on, emphasized per state.
  let backdrop: string;
  if (state === "locked") {
    backdrop = "bg-border/40 ring-1 ring-border";
  } else if (state === "complete") {
    backdrop = "bg-surface ring-2 ring-accent-green/40 shadow-md";
  } else if (state === "active") {
    backdrop = "bg-surface ring-4 ring-primary/30 shadow-md animate-pulse-dot";
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
      aria-label={`${item.lesson.title} — ${stateLabel}. Show details.`}
      aria-expanded={isOpen}
      onClick={onToggle}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`${base} ${isOpen ? "scale-105" : ""}`}
    >
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
  completed: boolean;
  /** When true, the green dotted "traversed" overlay is fully shown (persisted). */
  lit?: boolean;
  divRef?: (el: HTMLDivElement | null) => void;
  revealRef?: (el: SVGPathElement | null) => void;
}

function Connector({
  fromLean,
  toLean,
  completed,
  lit,
  divRef,
  revealRef,
}: ConnectorProps) {
  const midY = 50;
  const d = `M ${fromLean} 0 C ${fromLean} ${midY}, ${toLean} ${midY}, ${toLean} 100`;
  const maskId = `conn-reveal-${useId().replace(/[:]/g, "")}`;
  return (
    <div ref={divRef} className="h-12 w-full" aria-hidden>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          {/* Mask whose white region grows ALONG the path (the reveal path's
              stroke-dashoffset is animated in lock-step with the ninja). The
              green dotted overlay is only painted where this mask is white. A
              wide white stroke fully covers the dot thickness so revealed dots
              read as fully green. */}
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
              vectorEffect="non-scaling-stroke"
              style={{ strokeDasharray: 9999, strokeDashoffset: 9999 }}
            />
          </mask>
        </defs>

        {/* Base GREY dotted connector (the un-traversed style). */}
        <path
          d={d}
          fill="none"
          stroke={completed ? "var(--color-accent-green)" : "var(--color-border)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 7"
          vectorEffect="non-scaling-stroke"
        />

        {/* GREEN dotted overlay — IDENTICAL dot pattern, only the color differs.
            Revealed progressively through the mask as the ninja passes; once the
            run finishes `lit` drops the mask so the whole connector stays green
            dotted. On interrupt `lit` stays false and the mask reverts to hidden
            (grey). */}
        <path
          d={d}
          fill="none"
          stroke="var(--color-accent-green)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 7"
          vectorEffect="non-scaling-stroke"
          mask={lit ? undefined : `url(#${maskId})`}
        />
      </svg>
    </div>
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
    <div ref={cardRef} className="card-pop mt-4 p-5">
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

/**
 * A small running ninja. The torso + head are static; two limb "pose" groups
 * (.ninja-stride-a / .ninja-stride-b) flip-book back and forth so the legs and
 * arms pump like a running cycle while the figure travels along the path.
 */
function RunningNinja() {
  return (
    <svg viewBox="0 0 40 52" className="h-11 w-11" fill="none" aria-hidden>
      {/* bandana tails streaming back */}
      <path
        d="M13 10 L2 6 M13 13 L1 12"
        stroke="#E03131"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* limb pose A */}
      <g className="ninja-stride-a">
        <path d="M20 22 L13 27" stroke="#0f0f0f" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 22 L28 25" stroke="#1c1c1c" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 34 L13 47" stroke="#0f0f0f" strokeWidth="5" strokeLinecap="round" />
        <path d="M20 34 L29 45" stroke="#1c1c1c" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* limb pose B (swapped) */}
      <g className="ninja-stride-b">
        <path d="M20 22 L28 26" stroke="#0f0f0f" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 22 L13 24" stroke="#1c1c1c" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 34 L29 47" stroke="#0f0f0f" strokeWidth="5" strokeLinecap="round" />
        <path d="M20 34 L13 45" stroke="#1c1c1c" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* body */}
      <rect x="15" y="16" width="11" height="20" rx="5" fill="#141414" />
      {/* head */}
      <circle cx="20.5" cy="11" r="7.5" fill="#f3dcc4" />
      {/* bandana over the upper head */}
      <path
        d="M13 9 Q20.5 2 28 9 L28 11.5 Q20.5 6 13 11.5 Z"
        fill="#E03131"
      />
      {/* eye band */}
      <rect x="14" y="10.5" width="13" height="3.2" rx="1.6" fill="#141414" />
      {/* eye glint */}
      <circle cx="23" cy="12.1" r="0.9" fill="#fff" />
    </svg>
  );
}
