"use client";

import { useEffect, useRef, useState } from "react";
import { DuelCard } from "@/components/arena/DuelCard";

export interface DuelStartCombatant {
  username: string;
  wins: number;
}

interface DuelStartVersusProps {
  /** The LOCAL player — always rendered on the LEFT of their own screen. */
  me: DuelStartCombatant;
  /** The opponent — always rendered on the RIGHT. */
  opponent: DuelStartCombatant;
  /** Called once after the full sequence finishes so the match can be revealed. */
  onDone: () => void;
}

/** Sequence checkpoints (ms from mount). Total ≈ 2.9s. */
const T_READY = 650;
const T_SET = 1350;
const T_DUEL = 2050;
const T_CLOSE = 2550;
const T_DONE = 2880;

/** A tall, center-screen lightning bolt that splits the two sides. */
function LightningBolt() {
  return (
    <svg
      className="lightning-strike lightning-flicker h-full w-full"
      viewBox="0 0 120 1000"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="duel-bolt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0f2ff" />
          <stop offset="50%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      {/* Wide soft underlay for the glow body. */}
      <path
        d="M66 0 L40 360 L74 360 L30 660 L70 660 L34 1000"
        stroke="url(#duel-bolt)"
        strokeWidth="34"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.28"
      />
      {/* Bright core bolt. */}
      <path
        d="M66 0 L40 360 L74 360 L30 660 L70 660 L34 1000"
        stroke="url(#duel-bolt)"
        strokeWidth="10"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 12px rgba(168,220,255,0.95))" }}
      />
      {/* Inner white hot line. */}
      <path
        d="M66 0 L40 360 L74 360 L30 660 L70 660 L34 1000"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Full-screen match-start "versus" intro shown once when a match becomes active.
 * Both players' duel cards slam in from the sides of a lightning-split screen,
 * a flash fires, and a staggered "Ready… / Set… / Duel!!" sequence plays before
 * it auto-dismisses (it never permanently blocks input).
 */
export function DuelStartVersus({ me, opponent, onDone }: DuelStartVersusProps) {
  // 0 = none, 1 = Ready…, 2 = Set…, 3 = Duel!!
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setStep(1), T_READY),
      setTimeout(() => setStep(2), T_SET),
      setTimeout(() => setStep(3), T_DUEL),
      setTimeout(() => setClosing(true), T_CLOSE),
      setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }, T_DONE),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  const message =
    step === 1 ? "Ready..." : step === 2 ? "Set..." : step === 3 ? "Duel!!" : "";
  const isDuel = step === 3;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center overflow-hidden ${
        closing ? "duel-vs-overlay-out" : "duel-vs-overlay-in"
      }`}
      style={{
        background:
          "radial-gradient(120% 100% at 50% 50%, #1a1117 0%, #0a0a0f 70%, #000 100%)",
      }}
      role="presentation"
      aria-hidden
    >
      {/* Screen flash synced to the bolt. */}
      <div className="lightning-flash pointer-events-none absolute inset-0 bg-white" />

      {/* The split stage (cards + bolt), with an impact shake. */}
      <div className="duel-vs-shake relative flex w-full max-w-app items-center justify-between gap-2 px-3">
        {/* Local player — LEFT */}
        <div className="duel-vs-slam-left w-[44%] max-w-[220px]">
          <DuelCard username={me.username} wins={me.wins} side="left" />
        </div>

        {/* Center lightning split */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-full w-[120px] -translate-x-1/2"
        >
          <LightningBolt />
        </div>

        {/* Opponent — RIGHT */}
        <div className="duel-vs-slam-right w-[44%] max-w-[220px]">
          <DuelCard username={opponent.username} wins={opponent.wins} side="right" />
        </div>
      </div>

      {/* VS glyph + sequenced Ready/Set/Duel message. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex flex-col items-center gap-3">
        <span
          className="font-heading text-[44px] font-extrabold italic leading-none tracking-[0.1em] text-white"
          style={{ textShadow: "0 0 22px rgba(168,220,255,0.85)" }}
        >
          VS
        </span>
        {message && (
          <span
            key={message}
            className={`font-heading font-extrabold uppercase leading-none ${
              isDuel ? "duel-vs-text-impact" : "duel-vs-text-pop"
            }`}
            style={{
              fontSize: isDuel ? 56 : 40,
              letterSpacing: "0.14em",
              color: isDuel ? "var(--color-accent-orange)" : "#ffffff",
              textShadow: isDuel
                ? "0 0 26px rgba(249,115,22,0.85), 0 0 8px rgba(255,255,255,0.6)"
                : "0 0 18px rgba(168,220,255,0.7)",
            }}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
