import type { CSSProperties } from "react";

/**
 * Traditional karate belt order, easiest → hardest. Lesson difficulty is
 * encoded by indexing this array with the lesson's order (lesson 1 = white,
 * lesson 2 = yellow, …), so adding more lessons naturally extends through
 * blue/red/silver/black with no code changes.
 */
export const BELT_ORDER = [
  "white",
  "yellow",
  "green",
  "blue",
  "red",
  "silver",
  "black",
] as const;

export type BeltColor = (typeof BELT_ORDER)[number];

/** Resolve a lesson's bandana color from its order index (clamped to black). */
export function beltForIndex(index: number): BeltColor {
  return BELT_ORDER[Math.min(index, BELT_ORDER.length - 1)];
}

interface BeltStyle {
  fill: string;
  /** Outline so light bandanas (white/silver) stay visible on the page. */
  stroke: string;
}

const BELT_STYLES: Record<BeltColor, BeltStyle> = {
  white: { fill: "#ffffff", stroke: "#cbd5e1" },
  yellow: { fill: "var(--color-accent-yellow)", stroke: "rgba(0,0,0,0.12)" },
  green: { fill: "var(--color-accent-green)", stroke: "rgba(0,0,0,0.12)" },
  blue: { fill: "#2563eb", stroke: "rgba(0,0,0,0.12)" },
  red: { fill: "var(--color-error)", stroke: "rgba(0,0,0,0.12)" },
  silver: { fill: "#c4c9d4", stroke: "#9aa1ad" },
  black: { fill: "#1b1f2a", stroke: "rgba(255,255,255,0.18)" },
};

const LOCKED_BELT: BeltStyle = { fill: "#d7dbe2", stroke: "#b3b9c4" };

export type NinjaHeadState = "locked" | "active" | "complete" | "open";

interface NinjaHeadProps {
  belt: BeltColor;
  state?: NinjaHeadState;
  className?: string;
  style?: CSSProperties;
}

/**
 * A small ninja head: dark face mask, a colored bandana (encoding difficulty)
 * with knot + tails, and two eyes peeking through. Optional state overlays a
 * lock (locked) or a check badge (complete) and greys the art when locked.
 */
export function NinjaHead({ belt, state = "open", className, style }: NinjaHeadProps) {
  const locked = state === "locked";
  const beltStyle = locked ? LOCKED_BELT : BELT_STYLES[belt];
  const maskFill = locked ? "#aab0bd" : "#2b3245";
  const eyeFill = locked ? "#e9ebef" : "#ffffff";

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" fill="none">
        {/* Face mask / hood */}
        <rect x="14" y="13" width="36" height="40" rx="17" fill={maskFill} />

        {/* Bandana tails flying off the right side (drawn behind the band) */}
        <path
          d="M49 25 L63 20 L60 30 Z"
          fill={beltStyle.fill}
          stroke={beltStyle.stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path
          d="M49 29 L62 33 L57 39 Z"
          fill={beltStyle.fill}
          stroke={beltStyle.stroke}
          strokeWidth="1"
          strokeLinejoin="round"
        />

        {/* Bandana band across the forehead */}
        <rect
          x="10"
          y="22"
          width="44"
          height="9"
          rx="2.5"
          fill={beltStyle.fill}
          stroke={beltStyle.stroke}
          strokeWidth="1"
        />

        {/* Knot where the band ties off */}
        <circle
          cx="50"
          cy="26.5"
          r="3.6"
          fill={beltStyle.fill}
          stroke={beltStyle.stroke}
          strokeWidth="1"
        />

        {/* Eyes peeking through the mask slit */}
        <g transform="rotate(-6 33 39)">
          <rect x="22" y="36" width="9" height="5.5" rx="2.75" fill={eyeFill} />
          <rect x="35" y="36" width="9" height="5.5" rx="2.75" fill={eyeFill} />
        </g>
      </svg>

      {state === "complete" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-green text-white shadow ring-2 ring-surface">
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}

      {locked && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-white shadow ring-2 ring-surface">
          <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
            <rect
              x="5"
              y="11"
              width="14"
              height="9"
              rx="2"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <path
              d="M8 11V8a4 4 0 018 0v3"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
    </span>
  );
}
