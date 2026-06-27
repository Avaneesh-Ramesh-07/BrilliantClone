import type { ArenaRole, ArenaWinner } from "@/types/arena";

/**
 * Pure head-to-head combat rules for the Arena. No I/O, no Supabase, no React —
 * just deterministic state transitions so the logic can be reasoned about and
 * unit-tested in isolation. Both clients run the same module; each client only
 * ever applies the effect of *its own* answer (its streak/blow counters and the
 * opponent's HP), so writing the resulting patch to the shared row is conflict
 * free across the two players except for the terminal status/winner fields.
 *
 * Rules (from the spec):
 *  - Base blow = 10 HP.
 *  - A blow lands every 2 correct answers (per-blow counter `correct_this_blow`).
 *  - The 2-correct blow counter resets ONLY after a blow is delivered — never on
 *    a wrong answer.
 *  - A wrong answer resets the STREAK counter only.
 *  - Streak >= 5 correct in a row -> blows deal 15 HP. The buff persists until a
 *    wrong answer (which resets the streak), then damage returns to 10.
 *  - HP never drops below 0. The game ends the instant a player reaches 0 HP:
 *    status='complete' and the winner is set (both at 0 -> draw).
 */

export const BASE_DAMAGE = 10;
export const BUFFED_DAMAGE = 15;
export const BLOW_EVERY = 2;
export const BUFF_STREAK = 5;
export const MAX_HP = 100;

/** The combat-relevant subset of an arena_sessions row. */
export interface CombatState {
  user1_hp: number;
  user2_hp: number;
  user1_streak: number;
  user2_streak: number;
  user1_correct_this_blow: number;
  user2_correct_this_blow: number;
  status: "waiting" | "active" | "complete";
  winner: ArenaWinner;
}

export interface AnswerOutcome {
  /** The full next combat state after applying this answer. */
  state: CombatState;
  correct: boolean;
  /** Whether this answer delivered a blow to the opponent. */
  blow: boolean;
  /** HP of damage dealt to the opponent on this answer (0 when no blow). */
  damage: number;
  /** Whether the attacker's 1.5x streak buff is active after this answer. */
  buffActive: boolean;
  /** Whether this answer ended the game. */
  gameOver: boolean;
}

function other(role: ArenaRole): ArenaRole {
  return role === "user1" ? "user2" : "user1";
}

function readHp(state: CombatState, role: ArenaRole): number {
  return role === "user1" ? state.user1_hp : state.user2_hp;
}

function readStreak(state: CombatState, role: ArenaRole): number {
  return role === "user1" ? state.user1_streak : state.user2_streak;
}

function readBlowCounter(state: CombatState, role: ArenaRole): number {
  return role === "user1"
    ? state.user1_correct_this_blow
    : state.user2_correct_this_blow;
}

/** Derives the winner purely from final HP totals (both <= 0 => draw). */
export function resolveWinner(
  user1_hp: number,
  user2_hp: number
): { complete: boolean; winner: ArenaWinner } {
  const u1Down = user1_hp <= 0;
  const u2Down = user2_hp <= 0;
  if (u1Down && u2Down) return { complete: true, winner: "draw" };
  if (u1Down) return { complete: true, winner: "user2" };
  if (u2Down) return { complete: true, winner: "user1" };
  return { complete: false, winner: null };
}

/**
 * Applies a single answer by `role` to the combat state and returns the next
 * state plus a summary of what happened. The input state is never mutated.
 */
export function applyAnswer(
  state: CombatState,
  role: ArenaRole,
  correct: boolean
): AnswerOutcome {
  const next: CombatState = { ...state };

  const opponent = other(role);
  const streak = readStreak(state, role);
  const blowCounter = readBlowCounter(state, role);

  let newStreak: number;
  let newBlowCounter: number;
  let blow = false;
  let damage = 0;

  if (correct) {
    newStreak = streak + 1;
    newBlowCounter = blowCounter + 1;

    const buffActive = newStreak >= BUFF_STREAK;

    if (newBlowCounter >= BLOW_EVERY) {
      blow = true;
      damage = buffActive ? BUFFED_DAMAGE : BASE_DAMAGE;
      newBlowCounter = 0; // reset the blow counter only after a blow lands

      const opponentHp = Math.max(0, readHp(state, opponent) - damage);
      if (opponent === "user1") next.user1_hp = opponentHp;
      else next.user2_hp = opponentHp;
    }
  } else {
    // Wrong answer: reset the streak only. The blow counter is untouched.
    newStreak = 0;
    newBlowCounter = blowCounter;
  }

  if (role === "user1") {
    next.user1_streak = newStreak;
    next.user1_correct_this_blow = newBlowCounter;
  } else {
    next.user2_streak = newStreak;
    next.user2_correct_this_blow = newBlowCounter;
  }

  const { complete, winner } = resolveWinner(next.user1_hp, next.user2_hp);
  if (complete) {
    next.status = "complete";
    next.winner = winner;
  }

  return {
    state: next,
    correct,
    blow,
    damage,
    buffActive: newStreak >= BUFF_STREAK,
    gameOver: complete,
  };
}

/**
 * The minimal column patch a client should write after applying its own answer.
 * Only the attacker's own streak/blow counters, the opponent's HP, and (on game
 * end) status/winner are included — so the two players never clobber each
 * other's independent fields on the shared row.
 */
export function patchForOutcome(
  outcome: AnswerOutcome,
  role: ArenaRole
): Partial<CombatState> {
  const s = outcome.state;
  const patch: Partial<CombatState> = {};

  if (role === "user1") {
    patch.user1_streak = s.user1_streak;
    patch.user1_correct_this_blow = s.user1_correct_this_blow;
    if (outcome.blow) patch.user2_hp = s.user2_hp; // opponent took damage
  } else {
    patch.user2_streak = s.user2_streak;
    patch.user2_correct_this_blow = s.user2_correct_this_blow;
    if (outcome.blow) patch.user1_hp = s.user1_hp;
  }

  if (outcome.gameOver) {
    patch.status = "complete";
    patch.winner = s.winner;
  }

  return patch;
}
