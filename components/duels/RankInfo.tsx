"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getDuelTierLadder } from "@/lib/arena/rank";

/**
 * The "i"-in-a-circle info button shown next to the player's duel rank.
 * Reveals a small popover listing every duel tier and the total wins required
 * to reach it, with the player's current tier clearly highlighted. Works on
 * hover and keyboard focus (desktop) and on tap/click (touch); dismissable via
 * Escape, an outside click/tap, or moving the pointer away. Mirrors the streak
 * card's info tooltip for visual consistency.
 */
export function RankInfo({ currentTierIndex }: { currentTierIndex: number }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const ladder = getDuelTierLadder();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative z-10 inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="How do duel ranks work?"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((cur) => !cur)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-white/55 transition-colors hover:text-accent-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-orange/60"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
          <circle
            cx="10"
            cy="10"
            r="8.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="10" cy="6.2" r="1.15" fill="currentColor" />
          <rect x="9.1" y="8.8" width="1.8" height="5.6" rx="0.9" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-3 w-64 -translate-x-1/2 rounded-xl border border-black/30 bg-[#15101a] p-3 text-left text-white shadow-2xl ring-1 ring-accent-orange/25"
        >
          {/* Caret pointing up toward the info icon, so it reads as a floating
              popover rather than inline text. */}
          <span
            aria-hidden
            className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[2px] border-l border-t border-black/30 bg-[#15101a]"
          />
          <p className="relative mb-2 text-label font-bold uppercase tracking-wide text-white/55">
            Rank ladder
          </p>
          <ul className="relative flex flex-col gap-1">
            {ladder.map((tier) => {
              const isCurrent = tier.tierIndex === currentTierIndex;
              const winsLabel =
                tier.winsRequired === 0 ? "Start" : `${tier.winsRequired} wins`;
              return (
                <li
                  key={tier.tierIndex}
                  className={[
                    "flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-body",
                    isCurrent
                      ? "bg-accent-orange/20 font-bold text-white ring-1 ring-accent-orange/50"
                      : "font-medium text-white/75",
                  ].join(" ")}
                  aria-current={isCurrent ? "true" : undefined}
                >
                  <span className="flex items-center gap-1.5">
                    {tier.tierName}
                    {isCurrent && (
                      <span className="text-label font-bold uppercase tracking-wide text-accent-orange">
                        You are here
                      </span>
                    )}
                  </span>
                  <span
                    className={
                      isCurrent ? "text-white" : "text-white/55"
                    }
                  >
                    {winsLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
