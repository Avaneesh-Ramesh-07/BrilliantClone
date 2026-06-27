-- Arena follow-up: denormalize each player's total duel WINS onto the session
-- row so BOTH clients can render the opponent's duel RANK in the match-start
-- "versus" animation.
--
-- A player's duel wins are derived from the completed sessions/events they
-- belong to, which are protected by owner-scoped RLS — so the opponent cannot
-- compute the other player's wins client-side (countDuelWins only works for the
-- current user). Storing each player's win count on the (publicly readable)
-- session row — exactly like creator_name / joiner_name in 007 — sidesteps this
-- and flows over realtime when the joiner claims the room.
--
-- Guests are always the lowest rank (Initiate, 0 wins / 0 stars), so their
-- joiner_wins stays at the default 0.
--
-- Idempotent so it can be (re)applied safely.

-- ---------------------------------------------------------------------------
-- arena_sessions: denormalized per-player win counts
-- ---------------------------------------------------------------------------

alter table public.arena_sessions
  add column if not exists creator_wins int not null default 0;

alter table public.arena_sessions
  add column if not exists joiner_wins int not null default 0;
