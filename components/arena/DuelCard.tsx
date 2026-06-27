import { getDuelRank, type DuelRank } from "@/lib/arena/rank";

/** A single prestige star (filled). */
function Star({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${className}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.56l-5.9 3.11 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
    </svg>
  );
}

/** Crossed-blades flourish next to the tier badge. */
function Blades({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" aria-hidden>
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

/** A masked-ninja glyph used as the card's emblem. */
function NinjaMask({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 3c-4.4 0-8 2.6-8 6 0 .7.15 1.36.43 1.98C3.55 11.3 3 12.1 3 13c0 1.9 2.3 3.4 5.5 3.85.9 1.28 2.32 2.15 3.5 2.15s2.6-.87 3.5-2.15C18.7 16.4 21 14.9 21 13c0-.9-.55-1.7-1.43-2.02.28-.62.43-1.28.43-1.98 0-3.4-3.6-6-8-6zm-3.2 8.2a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2zm6.4 0a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2z" />
    </svg>
  );
}

/**
 * Per-tier visual identity. Each tier has its own accent + glow so the four
 * ranks read as a clear progression while staying inside the dark ninja /
 * shadow-fight Duels theme.
 */
const TIER_THEME: Record<
  number,
  { accent: string; glow: string; bg: string; ring: string; label: string }
> = {
  0: {
    accent: "#94a3b8",
    glow: "rgba(148,163,184,0.45)",
    bg: "radial-gradient(120% 90% at 50% -10%, #1f2937 0%, #141821 50%, #0a0a0f 100%)",
    ring: "rgba(148,163,184,0.30)",
    label: "Initiate",
  },
  1: {
    accent: "#a78bfa",
    glow: "rgba(124,58,237,0.50)",
    bg: "radial-gradient(120% 90% at 50% -10%, #2e1065 0%, #181231 50%, #0a0a0f 100%)",
    ring: "rgba(167,139,250,0.32)",
    label: "Shadow",
  },
  2: {
    accent: "#fb7185",
    glow: "rgba(244,63,94,0.50)",
    bg: "radial-gradient(120% 90% at 50% -10%, #4c0519 0%, #2a0e15 50%, #0a0a0f 100%)",
    ring: "rgba(251,113,133,0.34)",
    label: "Assassin",
  },
  3: {
    accent: "#fbbf24",
    glow: "rgba(245,158,11,0.55)",
    bg: "radial-gradient(120% 90% at 50% -10%, #422006 0%, #2a1c0a 50%, #0a0a0f 100%)",
    ring: "rgba(251,191,36,0.40)",
    label: "Shadow Lord",
  },
};

export interface DuelCardProps {
  /** The player's display / guest name. */
  username: string;
  /** The player's total duel wins (used to derive their rank). */
  wins: number;
  /** Layout side — only affects subtle directional accents (default "left"). */
  side?: "left" | "right";
  /** Optional precomputed rank (skips the internal getDuelRank call). */
  rank?: DuelRank;
  className?: string;
}

/**
 * A polished, reusable duel "trading card" showing a player's username and duel
 * rank (tier badge + prestige stars). Used both for the signed-in user's own
 * card on the Duels screen and for BOTH combatants in the match-start versus
 * animation. Themed per-tier to match the dark shadow-fight Duels aesthetic.
 */
export function DuelCard({
  username,
  wins,
  side = "left",
  rank,
  className = "",
}: DuelCardProps) {
  const r = rank ?? getDuelRank(wins);
  const theme = TIER_THEME[r.tierIndex] ?? TIER_THEME[0];
  const initial = username.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border p-4 text-white ${className}`}
      style={{
        background: theme.bg,
        borderColor: theme.ring,
        boxShadow: `0 0 24px -6px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      {/* Tier glow accent, pinned to the player's side. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 h-28 w-28 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
          left: side === "left" ? "-1.5rem" : undefined,
          right: side === "right" ? "-1.5rem" : undefined,
        }}
      />

      <div className="relative flex items-center gap-3">
        {/* Emblem / avatar */}
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
          style={{
            borderColor: theme.ring,
            background: "rgba(255,255,255,0.05)",
            boxShadow: `0 0 16px -4px ${theme.glow}`,
          }}
        >
          <span
            className="absolute inset-0 flex items-center justify-center font-heading text-2xl font-extrabold"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {initial}
          </span>
          {/* Faint ninja-mask watermark behind the initial. */}
          <NinjaMask className="h-7 w-7 opacity-20" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="truncate font-heading text-heading-md font-extrabold tracking-wide"
            title={username}
          >
            {username}
          </p>

          <div className="mt-1 flex items-center gap-1.5" style={{ color: theme.accent }}>
            <Blades />
            <span
              className="font-heading text-label font-extrabold uppercase tracking-[0.12em]"
              style={{ textShadow: `0 0 12px ${theme.glow}` }}
            >
              {r.tierName}
            </span>
            <Blades />
          </div>

          {/* Prestige stars (Shadow Lord) — otherwise show win count chip. */}
          <div className="mt-1.5 flex items-center gap-1">
            {r.stars > 0 ? (
              <span
                className="flex items-center gap-0.5"
                style={{ color: "var(--color-accent-yellow)" }}
                aria-label={`${r.stars} prestige star${r.stars === 1 ? "" : "s"}`}
              >
                {Array.from({ length: Math.min(r.stars, 8) }).map((_, i) => (
                  <Star key={i} />
                ))}
              </span>
            ) : (
              <span className="text-label text-white/45">
                {r.wins} {r.wins === 1 ? "win" : "wins"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
