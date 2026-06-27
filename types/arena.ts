export type ArenaStatus = "waiting" | "active" | "complete";

/** "user1" is always the session creator; "user2" is always the joiner (auth user or guest). */
export type ArenaRole = "user1" | "user2";

export type ArenaWinner = "user1" | "user2" | "draw" | null;

/** A single arena_sessions row. */
export interface ArenaSession {
  id: string;
  /** Short, human-friendly join-by-code (6 chars, unambiguous uppercase). */
  code: string;
  created_by: string | null;
  joined_by: string | null;
  guest_name: string | null;
  /** The creator's (user1's) display name, denormalized onto the row at creation. */
  creator_name: string | null;
  /** An authenticated joiner's (user2's) display name, set on join. */
  joiner_name: string | null;
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

/** The algebra topics the arena can generate problems for. */
export type ArenaTopic = "equations" | "graphing" | "quadratics";

export const ARENA_TOPICS: ArenaTopic[] = [
  "equations",
  "graphing",
  "quadratics",
];

/** A single numeric-answer arena problem (guest bank or derived from a lesson). */
export interface ArenaProblem {
  id: string;
  prompt: string;
  answer: number;
  /** The algebra topic this problem was generated for (used for per-answer stats). */
  topic: ArenaTopic;
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
