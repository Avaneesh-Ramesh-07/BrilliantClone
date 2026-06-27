-- Arena follow-ups:
--   1. Denormalize player display names onto arena_sessions so BOTH sides can
--      show the real opponent name. The profiles SELECT policy is owner-only
--      (auth.uid() = id), so a joiner cannot read the creator's profile — and
--      the joiner's room page even renders before they've joined. Storing the
--      names on the (publicly readable) session row sidesteps both problems and
--      flows over realtime when the joiner claims the room.
--   3. Add a per-answer `topic` to arena_events so the Duel-history dashboard
--      can compute most/least comfortable topic. arena_events already allows
--      member SELECT/INSERT, and a new nullable column needs no policy change.
--
-- Idempotent so it can be (re)applied safely.

-- ---------------------------------------------------------------------------
-- arena_sessions: denormalized player names
-- ---------------------------------------------------------------------------

alter table public.arena_sessions
  add column if not exists creator_name text;

alter table public.arena_sessions
  add column if not exists joiner_name text;

-- Backfill creator_name for existing rows from the creator's profile.
update public.arena_sessions s
set creator_name = p.display_name
from public.profiles p
where s.created_by = p.id
  and s.creator_name is null;

-- ---------------------------------------------------------------------------
-- arena_events: per-answer topic (equations | graphing | quadratics)
-- ---------------------------------------------------------------------------

alter table public.arena_events
  add column if not exists topic text;
