import type { SupabaseClient } from "@supabase/supabase-js";
import { getDuelHistory } from "@/lib/arena/history";

/**
 * Duel ranking. A purely derived progression system: a player climbs one tier
 * every 5 wins, and once they reach the top tier they begin earning prestige
 * "stars" (one per additional 5 wins). All of this is a pure function of the
 * player's total duel wins so it can be computed on each page load with no extra
 * state.
 */

/** The four duel tiers, ordered from lowest to highest. */
export const DUEL_TIERS = [
  "Initiate",
  "Shadow",
  "Assassin",
  "Shadow Lord",
] as const;

export type DuelTierName = (typeof DUEL_TIERS)[number];

/** The highest tier index (Shadow Lord). */
const MAX_TIER_INDEX = DUEL_TIERS.length - 1;
/** Wins required to advance a tier (and, at the top, to earn a prestige star). */
const WINS_PER_TIER = 5;

export interface DuelRank {
  /** Total duel wins the rank was computed from. */
  wins: number;
  /** 0-based tier index, clamped to the top tier. */
  tierIndex: number;
  /** The tier's display name. */
  tierName: DuelTierName;
  /** Prestige stars earned (only accrue at the top tier). */
  stars: number;
  /** Wins accumulated within the current 5-win block (0-4). */
  winsIntoTier: number;
  /** Wins remaining to the next tier or next prestige star (1-5). */
  winsToNext: number;
  /** Whether the player is at the top tier (Shadow Lord). */
  isMaxTier: boolean;
}

/**
 * Computes a player's duel rank from their total wins. Pure and robust to
 * `wins = 0` (Initiate, 0 stars, 0/5 progress).
 */
export function getDuelRank(wins: number): DuelRank {
  const safeWins = Math.max(0, Math.floor(wins));
  const tierIndex = Math.min(Math.floor(safeWins / WINS_PER_TIER), MAX_TIER_INDEX);
  const isMaxTier = tierIndex === MAX_TIER_INDEX;

  return {
    wins: safeWins,
    tierIndex,
    tierName: DUEL_TIERS[tierIndex],
    stars: isMaxTier
      ? Math.max(0, Math.floor(safeWins / WINS_PER_TIER) - MAX_TIER_INDEX)
      : 0,
    winsIntoTier: safeWins % WINS_PER_TIER,
    winsToNext: WINS_PER_TIER - (safeWins % WINS_PER_TIER),
    isMaxTier,
  };
}

/**
 * Counts the player's total duel wins. Reuses `getDuelHistory` so win-resolution
 * logic lives in exactly one place, then tallies entries whose result is "win".
 */
export async function countDuelWins(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { duels } = await getDuelHistory(supabase, userId);
  return duels.filter((duel) => duel.result === "win").length;
}
