"use client";

import type { MoveId } from "@/lib/arena/moves";

export type FighterTone = "you" | "enemy";
export type FighterFacing = "left" | "right";
export type FighterAction = "idle" | MoveId | "recoil";

interface NinjaFighterProps {
  tone: FighterTone;
  /** Right-facing is the natural drawing; left-facing mirrors via scaleX(-1). */
  facing: FighterFacing;
  action: FighterAction;
  /** Changing this remounts the animated group so the CSS animation restarts. */
  animKey: number;
  /** Drawn as a slumped KO pose (used when the duel is over). */
  defeated?: boolean;
  className?: string;
}

// Map each action to a GLOBAL class (app/globals.css) on the animated root <g>.
// The class drives the relevant limb sub-groups via descendant selectors. These
// are literal global strings (NOT CSS-module classes) so Turbopack never rewrites
// the underlying `animation-name` to a hashed/missing keyframe.
const ACTION_CLASS: Record<FighterAction, string> = {
  idle: "af-idle",
  recoil: "af-recoil",
  "front-kick": "af-front-kick",
  "side-kick": "af-side-kick",
  "roundhouse-kick": "af-roundhouse-kick",
  "jump-kick": "af-jump-kick",
  "jumping-roundhouse-kick": "af-jump-roundhouse-kick",
  punch: "af-punch",
  jab: "af-jab",
  uppercut: "af-uppercut",
  sideswipe: "af-sideswipe",
  "knee-kick": "af-knee",
  "elbow-hit": "af-elbow",
};

/**
 * A hand-built SVG stick-figure ninja in a martial-arts guard stance. Limbs live
 * in their own <g> groups with transform-origins (set in the global af-* classes
 * in app/globals.css) so each move can rotate an arm or leg from the right joint.
 * Right-facing is the natural pose; a left-facing fighter is mirrored with
 * scaleX(-1) so two fighters can square off. `animKey` is used as the React key
 * on the animated group, remounting it so a repeated move replays cleanly.
 */
export function NinjaFighter({
  tone,
  facing,
  action,
  animKey,
  defeated = false,
  className,
}: NinjaFighterProps) {
  const accent = tone === "you" ? "var(--color-primary)" : "var(--color-error)";
  const body = "var(--color-text)";
  const actionClass = defeated ? "af-defeated" : ACTION_CLASS[action];

  return (
    <svg
      viewBox="0 0 120 165"
      className={className}
      role="img"
      aria-label={tone === "you" ? "Your ninja" : "Opponent ninja"}
      style={{
        transform: facing === "left" ? "scaleX(-1)" : undefined,
        overflow: "visible",
      }}
    >
      <g
        key={animKey}
        className={`af-fighter ${actionClass ?? ""}`}
        stroke={body}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Fighting guard stance, facing right: feet apart with the front foot
            forward, knees bent (low center of gravity), torso leaning forward,
            both arms up in a guard with fists near the chin. Joint coordinates
            below match the transform-origins in app/globals.css so each strike
            still pivots from the correct hip/shoulder/knee/elbow. */}

        {/* ----- Back leg (far side): planted back, knee bent ----- */}
        <g className="af-leg-back" opacity={0.8}>
          <line x1={54} y1={100} x2={48} y2={126} />
          <g className="af-leg-back-lower">
            <line x1={48} y1={126} x2={50} y2={150} />
            <line x1={40} y1={150} x2={52} y2={150} strokeWidth={5} />
          </g>
        </g>

        {/* ----- Back arm (far side): up in guard, fist near chin ----- */}
        <g className="af-arm-back" opacity={0.8}>
          <line x1={61} y1={58} x2={55} y2={72} />
          <g className="af-arm-back-lower">
            <line x1={55} y1={72} x2={60} y2={54} />
            <circle cx={60} cy={53} r={4} fill={body} stroke="none" />
          </g>
        </g>

        {/* ----- Pelvis + leaning torso + belt sash ----- */}
        <line x1={53} y1={100} x2={59} y2={100} />
        <line x1={56} y1={100} x2={63} y2={58} />
        <line
          className="af-sash"
          x1={52}
          y1={92}
          x2={64}
          y2={86}
          stroke={accent}
          strokeWidth={5}
        />

        {/* ----- Head + bandana (tone-colored), tucked forward ----- */}
        <g className="af-head">
          <circle cx={66} cy={42} r={11.5} fill="var(--color-surface)" />
          {/* Bandana band */}
          <path
            d="M55 38 H77"
            stroke={accent}
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* Bandana tails trailing back (left) */}
          <path
            d="M55 38 q-12 2 -16 12"
            stroke={accent}
            strokeWidth={4}
            fill="none"
          />
          <path
            d="M55 41 q-11 5 -13 14"
            stroke={accent}
            strokeWidth={4}
            fill="none"
          />
          {/* Eyes hint (facing right) */}
          <circle cx={72} cy={44} r={1.7} fill={body} stroke="none" />
        </g>

        {/* ----- Front leg (near side, forward foot; striking leg for kicks) ----- */}
        <g className="af-leg-front">
          <line x1={58} y1={100} x2={66} y2={124} />
          <g className="af-leg-front-lower">
            <line x1={66} y1={124} x2={64} y2={150} />
            <line x1={64} y1={150} x2={80} y2={150} strokeWidth={5} />
          </g>
        </g>

        {/* ----- Front arm (near side, up in guard; striking arm for punches) ----- */}
        <g className="af-arm-front">
          <line x1={63} y1={58} x2={69} y2={72} />
          <g className="af-arm-front-lower">
            <line x1={69} y1={72} x2={64} y2={52} />
            <circle cx={64} cy={51} r={4.5} fill={body} stroke="none" />
          </g>
        </g>
      </g>
    </svg>
  );
}
