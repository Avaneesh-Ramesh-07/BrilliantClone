export type ArenaStatus = "waiting" | "active" | "complete";

/** "user1" is always the session creator; "user2" is always the joiner (auth user or guest). */
export type ArenaRole = "user1" | "user2";

export type ArenaWinner = "user1" | "user2" | "draw" | null;

/** A single arena_sessions row. */
export interface ArenaSession {
  id: string;
  created_by: string | null;
  joined_by: string | null;
  guest_name: string | null;
  status: ArenaStatus;
  user1_hp: number;
  user2_hp: number;
  user1_streak: number;
  user2_streak: number;
  user1_correct_this_blow: number;
  user2_correct_this_blow: number;
  winner: ArenaWinner;
  created_at: string;
}

/** A single numeric-answer arena problem (guest bank or derived from a lesson). */
export interface ArenaProblem {
  id: string;
  prompt: string;
  answer: number;
}

/**
 * A per-player problem pool, ordered easy -> hard by tier. Authenticated users
 * get one tier per lesson step (advancing every 4 correct answers); guests get
 * a single tier that is consumed sequentially through the easy -> hard bank.
 */
export interface ProblemPool {
  tiers: ArenaProblem[][];
}

export type ArenaEventType =
  | "correct"
  | "wrong"
  | "blow"
  | "disconnect"
  | "win";
