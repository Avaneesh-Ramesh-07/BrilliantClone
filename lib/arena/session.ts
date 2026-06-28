import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArenaEventType,
  ArenaRole,
  ArenaSession,
} from "@/types/arena";
import type { CombatState } from "@/lib/arena/combat";
import { countDuelWins } from "@/lib/arena/rank";
import { getProfile } from "@/lib/progress";

/** Columns selected for an arena session everywhere in the feature. */
export const SESSION_COLUMNS =
  "id, code, created_by, joined_by, guest_name, creator_name, joiner_name, creator_wins, joiner_wins, status, user1_hp, user2_hp, user1_streak, user2_streak, user1_correct_this_blow, user2_correct_this_blow, winner, created_at";

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * A still-'active' session with no new events for this long is treated as
 * abandoned (e.g. both players closed their tabs). Loaders self-heal such rows
 * to 'complete' (winner 'draw') so they never linger as active forever. See
 * CHANGE 2, this is the robust backstop to the best-effort tab-close handler.
 */
export const STALE_ACTIVE_MS = 10 * 60 * 1000; // 10 minutes

/** Unambiguous uppercase alphabet for room codes (no 0/O/1/I/L). */
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

/** Generates a single random 6-char room code (not guaranteed unique). */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

/** Normalizes user-entered codes (trim + uppercase) for lookup. */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** A waiting session older than 24h is considered expired. */
export function isExpired(session: ArenaSession, now: number = Date.now()): boolean {
  if (session.status !== "waiting") return false;
  const created = new Date(session.created_at).getTime();
  return now - created > EXPIRY_MS;
}

/** True when the session already has a second player (auth joiner or guest). */
export function isFull(session: ArenaSession): boolean {
  return (
    session.joined_by != null ||
    session.guest_name != null ||
    session.status !== "waiting"
  );
}

/** The viewer's role, or null if they are a prospective joiner / spectator. */
export function roleForUser(
  session: ArenaSession,
  userId: string | null
): ArenaRole | null {
  if (userId && session.created_by === userId) return "user1";
  if (userId && session.joined_by === userId) return "user2";
  return null;
}

export async function fetchSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ArenaSession | null> {
  const { data } = await supabase
    .from("arena_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle();
  return (data as ArenaSession | null) ?? null;
}

/**
 * The user's most recent still-open (waiting, unjoined) session, if any. Used to
 * reuse an existing challenge instead of creating a new row on every visit.
 */
export async function getOpenSession(
  supabase: SupabaseClient,
  userId: string
): Promise<ArenaSession | null> {
  const { data } = await supabase
    .from("arena_sessions")
    .select(SESSION_COLUMNS)
    .eq("created_by", userId)
    .eq("status", "waiting")
    .is("joined_by", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ArenaSession | null) ?? null;
}

/** Reuse the user's open session if one exists (and isn't expired), else create one. */
export async function getOrCreateSession(
  supabase: SupabaseClient,
  userId: string
): Promise<ArenaSession | null> {
  const existing = await getOpenSession(supabase, userId);
  if (existing && !isExpired(existing)) return existing;
  return createSession(supabase, userId);
}

/**
 * Authenticated User 1 creates a fresh waiting session with a unique room code.
 * Generation retries on the (extremely unlikely) unique-code collision so the
 * insert is robust against the rare clash.
 */
export async function createSession(
  supabase: SupabaseClient,
  userId: string
): Promise<ArenaSession | null> {
  const MAX_ATTEMPTS = 5;
  let lastError: { message: string; code?: string } | null = null;

  // Denormalize the creator's display name onto the row so the joiner can show
  // it without reading the creator's profile (the profiles SELECT policy is
  // owner-only, and the joiner's page renders before they've even joined).
  const creatorProfile = await getProfile(supabase, userId);
  const creatorName = creatorProfile?.display_name ?? null;

  // Also denormalize the creator's total duel wins so the opponent can render
  // the creator's duel rank in the match-start versus animation (the win count
  // is otherwise only readable by the creator themselves under owner RLS).
  const creatorWins = await countDuelWins(supabase, userId);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("arena_sessions")
      .insert({
        created_by: userId,
        status: "waiting",
        code: generateRoomCode(),
        creator_name: creatorName,
        creator_wins: creatorWins,
      })
      .select(SESSION_COLUMNS)
      .single();
    if (!error) return data as ArenaSession;

    lastError = error;
    // 23505 = unique_violation: a code clash, retry with a fresh code.
    if (error.code !== "23505") break;
  }

  console.error(
    "[arena] createSession failed",
    lastError?.message ?? "unknown error"
  );
  return null;
}

/**
 * Resolves a room code to a joinable (waiting) session id, or null if no such
 * open session exists. Reads via the caller's Supabase context (works for anon
 * guests and authed users since the SELECT policy is open).
 */
export async function resolveRoomCodeToSessionId(
  supabase: SupabaseClient,
  rawCode: string
): Promise<string | null> {
  const code = normalizeRoomCode(rawCode);
  if (code.length !== ROOM_CODE_LENGTH) return null;
  const { data, error } = await supabase
    .from("arena_sessions")
    .select("id, status")
    .eq("code", code)
    .eq("status", "waiting")
    .maybeSingle();
  if (error) {
    console.error("[arena] resolveRoomCode failed", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

/** A logged-in second player claims a waiting session. */
export async function joinAsUser(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  joinerName: string | null
): Promise<ArenaSession | null> {
  // A signed-in user may never claim the SECOND seat in a room they created, // that would be dueling themselves. `.neq("created_by", userId)` makes the
  // update match no row in that case (so the claim fails and returns null);
  // it's also enforced by RLS (`created_by <> auth.uid()`). The creator's own
  // link still lands them as user1 via `roleForUser`, which never reaches here.
  const joinerWins = await countDuelWins(supabase, userId);
  const { data, error } = await supabase
    .from("arena_sessions")
    .update({
      joined_by: userId,
      status: "active",
      joiner_name: joinerName,
      joiner_wins: joinerWins,
    })
    .eq("id", sessionId)
    .eq("status", "waiting")
    .neq("created_by", userId)
    .select(SESSION_COLUMNS)
    .single();
  if (error) {
    console.error("[arena] joinAsUser failed", error.message);
    return null;
  }
  return data as ArenaSession;
}

/**
 * A guest claims a waiting session. No Supabase auth user is created, the
 * guest's own browser writes via the anon role. A client-generated guest uuid
 * is stored in joined_by so the row records who the guest is, and guest_name is
 * set (which is what the anon RLS policy keys off of).
 */
export async function joinAsGuest(
  supabase: SupabaseClient,
  sessionId: string,
  guestName: string,
  guestId: string
): Promise<ArenaSession | null> {
  // Guests are always the lowest rank (Initiate, 0 wins / 0 stars), so their
  // denormalized win count is fixed at 0.
  const { data, error } = await supabase
    .from("arena_sessions")
    .update({
      guest_name: guestName,
      joined_by: guestId,
      status: "active",
      joiner_wins: 0,
    })
    .eq("id", sessionId)
    .eq("status", "waiting")
    .select(SESSION_COLUMNS)
    .single();
  if (error) {
    console.error("[arena] joinAsGuest failed", error.message);
    return null;
  }
  return data as ArenaSession;
}

/** Persists a combat patch to the session row so the opponent sees it via realtime. */
export async function writeCombatPatch(
  supabase: SupabaseClient,
  sessionId: string,
  patch: Partial<CombatState>
): Promise<void> {
  const { error } = await supabase
    .from("arena_sessions")
    .update(patch)
    .eq("id", sessionId);
  if (error) console.error("[arena] writeCombatPatch failed", error.message);
}

/** Forces a session to complete with a winner (used by disconnect handling). */
export async function endSession(
  supabase: SupabaseClient,
  sessionId: string,
  winner: ArenaRole
): Promise<void> {
  const { error } = await supabase
    .from("arena_sessions")
    .update({ status: "complete", winner })
    .eq("id", sessionId)
    .neq("status", "complete");
  if (error) console.error("[arena] endSession failed", error.message);
}

/**
 * Completes a session with no winner ('draw'). Used when BOTH players leave the
 * match (so neither can be the disconnect winner) and by the staleness backstop.
 * Idempotent: only flips a session that isn't already complete.
 */
export async function abandonSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from("arena_sessions")
    .update({ status: "complete", winner: "draw" })
    .eq("id", sessionId)
    .neq("status", "complete");
  if (error) console.error("[arena] abandonSession failed", error.message);
}

export async function insertEvent(
  supabase: SupabaseClient,
  sessionId: string,
  actor: ArenaRole,
  eventType: ArenaEventType,
  damage?: number,
  topic?: string
): Promise<void> {
  const { error } = await supabase.from("arena_events").insert({
    session_id: sessionId,
    actor,
    event_type: eventType,
    damage: damage ?? null,
    topic: topic ?? null,
  });
  if (error) console.error("[arena] insertEvent failed", error.message);
}

/**
 * Self-heals the caller's abandoned rooms: any session they belong to that is
 * still 'active' but has had no event for > STALE_ACTIVE_MS (or, lacking any
 * event, was created that long ago) is forced to 'complete' (winner 'draw').
 * This is the robust backstop for CHANGE 2, if BOTH players closed their tabs,
 * no client remained to end the match, so the next time the owner loads a list
 * of their sessions we tidy up the stragglers. Runs with the user's own
 * Supabase context, so RLS lets them update only their own sessions.
 */
export async function healStaleSessionsForUser(
  supabase: SupabaseClient,
  userId: string,
  now: number = Date.now()
): Promise<void> {
  const { data } = await supabase
    .from("arena_sessions")
    .select("id, created_at")
    .or(`created_by.eq.${userId},joined_by.eq.${userId}`)
    .eq("status", "active");

  const active = (data as { id: string; created_at: string }[] | null) ?? [];
  if (active.length === 0) return;

  await Promise.all(
    active.map(async ({ id, created_at }) => {
      const { data: lastEvent } = await supabase
        .from("arena_events")
        .select("created_at")
        .eq("session_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastActivity = new Date(
        (lastEvent?.created_at as string | undefined) ?? created_at
      ).getTime();

      if (now - lastActivity > STALE_ACTIVE_MS) {
        await abandonSession(supabase, id);
      }
    })
  );
}

/**
 * A throwaway client-side guest id (uuid) for a single join, stored in the row's
 * `joined_by`. It is NOT persisted anywhere on the client, guests are never
 * re-identified across page loads, so a guest who leaves a match cannot rejoin.
 */
export function newGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes.
  return "guest-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
