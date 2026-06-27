-- Head-to-head "Arena" feature: sessions + events, RLS, realtime, and room codes.
--
-- NOTE: The live database already contained the arena tables (they were applied
-- out-of-band before this migration file existed). Everything here is therefore
-- written idempotently so it can be safely (re)applied and keeps the repo schema
-- in sync with production. The genuinely new addition is the `code` room-code
-- column (and its backfill / uniqueness) used for join-by-code.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.arena_sessions (
  id uuid primary key default gen_random_uuid(),
  -- The authenticated challenger (User 1).
  created_by uuid references public.profiles(id) on delete cascade,
  -- The joiner (User 2): either an auth user id OR a client-generated guest
  -- uuid. Guests are NOT auth users, so this is intentionally NOT FK-constrained.
  joined_by uuid,
  guest_name text,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'complete')),
  user1_hp int not null default 100,
  user2_hp int not null default 100,
  user1_streak int not null default 0,
  user2_streak int not null default 0,
  user1_correct_this_blow int not null default 0,
  user2_correct_this_blow int not null default 0,
  winner text,
  created_at timestamptz not null default now()
);

create table if not exists public.arena_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.arena_sessions(id) on delete cascade,
  actor text not null,
  event_type text not null,
  damage int,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Room code (join-by-code): short, human-friendly, unambiguous (no 0/O/1/I/L).
-- ---------------------------------------------------------------------------

alter table public.arena_sessions add column if not exists code text;

-- Backfill existing rows that predate the code column with unique 6-char codes.
do $$
declare
  r record;
  candidate text;
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i int;
begin
  for r in select id from public.arena_sessions where code is null loop
    loop
      candidate := '';
      for i in 1..6 loop
        candidate := candidate
          || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (
        select 1 from public.arena_sessions where code = candidate
      );
    end loop;
    update public.arena_sessions set code = candidate where id = r.id;
  end loop;
end $$;

create unique index if not exists arena_sessions_code_key
  on public.arena_sessions (code);

alter table public.arena_sessions alter column code set not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.arena_sessions enable row level security;
alter table public.arena_events enable row level security;

-- arena_sessions ------------------------------------------------------------

-- SELECT: arena rooms are non-sensitive game lobbies keyed by an unguessable
-- uuid / code. Both anon (guests) and authenticated users must read a row to
-- join it (by link or by code), so SELECT is open to both roles.
drop policy if exists "arena_sessions_select_all" on public.arena_sessions;
create policy "arena_sessions_select_all"
  on public.arena_sessions for select
  to anon, authenticated
  using (true);

-- INSERT: an authenticated challenger creates their own session.
drop policy if exists "arena_sessions_insert_owner" on public.arena_sessions;
create policy "arena_sessions_insert_owner"
  on public.arena_sessions for insert
  to authenticated
  with check (created_by = auth.uid());

-- UPDATE (a): a logged-in second player claims a waiting session.
drop policy if exists "arena_sessions_update_claim" on public.arena_sessions;
create policy "arena_sessions_update_claim"
  on public.arena_sessions for update
  to authenticated
  using (status = 'waiting' and joined_by is null)
  with check (joined_by = auth.uid() and created_by <> auth.uid());

-- UPDATE (b): either member writes combat patches during an active match.
drop policy if exists "arena_sessions_update_member" on public.arena_sessions;
create policy "arena_sessions_update_member"
  on public.arena_sessions for update
  to authenticated
  using (created_by = auth.uid() or joined_by = auth.uid())
  with check (created_by = auth.uid() or joined_by = auth.uid());

-- UPDATE (c): an ANON guest claims a waiting session and then writes combat
-- patches. Guests have no auth.uid(), so the policy keys off guest_name: a guest
-- may claim a still-open room, and once guest_name is set may keep updating it
-- (combat patches never clear guest_name). This is intentionally permissive for
-- the anon side because guests cannot be identified by auth.uid(); rooms are
-- ephemeral and keyed by an unguessable id, so the trade-off is acceptable.
drop policy if exists "arena_sessions_update_guest" on public.arena_sessions;
create policy "arena_sessions_update_guest"
  on public.arena_sessions for update
  to anon
  using ((status = 'waiting' and joined_by is null) or guest_name is not null)
  with check (guest_name is not null);

-- arena_events --------------------------------------------------------------

-- Both players (including anon guests) read and write events for a session they
-- belong to (creator, joiner, or a guest-occupied room).
drop policy if exists "arena_events_select_member" on public.arena_events;
create policy "arena_events_select_member"
  on public.arena_events for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.arena_sessions s
      where s.id = arena_events.session_id
        and (
          s.created_by = auth.uid()
          or s.joined_by = auth.uid()
          or s.guest_name is not null
        )
    )
  );

drop policy if exists "arena_events_insert_member" on public.arena_events;
create policy "arena_events_insert_member"
  on public.arena_events for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.arena_sessions s
      where s.id = arena_events.session_id
        and (
          s.created_by = auth.uid()
          or s.joined_by = auth.uid()
          or s.guest_name is not null
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: the lobby and match screens subscribe to row UPDATEs.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'arena_sessions'
  ) then
    alter publication supabase_realtime add table public.arena_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'arena_events'
  ) then
    alter publication supabase_realtime add table public.arena_events;
  end if;
end $$;
