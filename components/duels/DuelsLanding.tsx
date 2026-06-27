import Link from "next/link";
import { DUEL_TIERS } from "@/lib/arena/rank";
import type { DuelRank } from "@/lib/arena/rank";

/** A single prestige star (filled gold). */
function Star({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${className}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.56l-5.9 3.11 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
    </svg>
  );
}

/** Crossed-blades flourish next to the tier badge. */
function Blades() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 4l9 9m7-9l-9 9m-2 2l-4 4m6-4l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DuelsLanding({ rank }: { rank: DuelRank }) {
  const { tierName, tierIndex, stars, winsIntoTier, winsToNext, isMaxTier } =
    rank;

  const nextLabel = isMaxTier
    ? "the next prestige star"
    : DUEL_TIERS[tierIndex + 1];
  const progressPct = Math.round((winsIntoTier / 5) * 100);
  const winWord = winsToNext === 1 ? "win" : "wins";

  return (
    <main className="py-8">
      <div
        className="card-pop relative overflow-hidden p-6 text-white sm:p-8"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, #3b0a0a 0%, #1a1117 45%, #0a0a0f 100%)",
          borderColor: "rgba(249, 115, 22, 0.25)",
        }}
      >
        {/* Ember glow accent, pinned top-center behind the title. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(249,115,22,0.55) 0%, rgba(236,72,153,0.25) 55%, transparent 75%)",
          }}
        />

        <header className="relative text-center">
          <p
            className="text-label"
            style={{ color: "rgba(249, 168, 137, 0.85)" }}
          >
            Shadow Fight
          </p>
          <h1
            className="mt-1 font-heading text-[40px] font-extrabold leading-none tracking-[0.18em]"
            style={{ textShadow: "0 0 18px rgba(249,115,22,0.55)" }}
          >
            DUELS
          </h1>
          <p className="mx-auto mt-3 max-w-[34ch] text-body text-white/70">
            A real-time, head-to-head algebra battle. Answer fast to land blows,
            drain your opponent&apos;s HP, and be the last shadow standing.
          </p>
        </header>

        {/* RANK display */}
        <section
          className="relative mt-7 rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p className="text-label text-white/50">Your rank</p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--color-accent-orange)" }}>
                <Blades />
              </span>
              <span
                className="font-heading text-heading-lg font-extrabold tracking-wide"
                style={{ textShadow: "0 0 14px rgba(249,115,22,0.45)" }}
              >
                {tierName}
              </span>
              <span style={{ color: "var(--color-accent-orange)" }}>
                <Blades />
              </span>
            </div>

            {stars > 0 && (
              <div
                className="flex items-center gap-0.5"
                style={{ color: "var(--color-accent-yellow)" }}
                aria-label={`${stars} prestige star${stars === 1 ? "" : "s"}`}
              >
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} />
                ))}
              </div>
            )}
          </div>

          {/* Progress toward next tier / prestige star */}
          <div className="mt-4">
            <div
              className="h-2.5 w-full overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  background:
                    "linear-gradient(90deg, var(--color-accent-orange), var(--color-accent-pink))",
                  boxShadow: "0 0 12px rgba(249,115,22,0.6)",
                }}
              />
            </div>
            <p className="mt-2 text-label text-white/60">
              {winsIntoTier}/5 ·{" "}
              <span className="text-white/90">
                {winsToNext} more {winWord}
              </span>{" "}
              to {isMaxTier ? "earn" : "reach"} {nextLabel}
            </p>
          </div>
        </section>

        {/* CTAs */}
        <div className="relative mt-7 flex flex-col gap-3">
          <Link
            href="/arena"
            className="btn-pop flex min-h-[52px] items-center justify-center gap-2 px-5 text-white"
            style={{ background: "var(--color-accent-orange)" }}
          >
            <span aria-hidden>⚔️</span>
            Enter the Arena
          </Link>
          <Link
            href="/arena/history"
            className="btn-pop flex min-h-[48px] items-center justify-center gap-2 px-5 text-white"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <span aria-hidden>📜</span>
            Battle History
          </Link>
        </div>
      </div>
    </main>
  );
}
