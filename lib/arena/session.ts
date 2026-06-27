import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArenaEventType,
  ArenaRole,
  ArenaSession,
} from "@/types/arena";
import type { CombatState } from "@/lib/arena/combat";

/** Columns selected for an arena session everywhere in the feature. */
export const SESSION_COLUMNS =
  "id, code, created_by, joined_by, guest_name, status, user1_hp, user2_hp, user1_streak, user2_streak, user1_correct_this_blow, user2_correct_this_blow, winner, created_at";

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("arena_sessions")
      .insert({ created_by: userId, status: "waiting", code: generateRoomCode() })
      .select(SESSION_COLUMNS)
      .single();
    if (!error) return data as ArenaSession;

    lastError = error;
    // 23505 = unique_violation: a code clash — retry with a fresh code.
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
  userId: string
): Promise<ArenaSession | null> {
  const { data, error } = await supabase
    .from("arena_sessions")
    .update({ joined_by: userId, status: "active" })
    .eq("id", sessionId)
    .eq("status", "waiting")
    .select(SESSION_COLUMNS)
    .single();
  if (error) {
    console.error("[arena] joinAsUser failed", error.message);
    return null;
  }
  return data as ArenaSession;
}

/**
 * A guest claims a waiting session. No Supabase auth user is created — the
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
  const { data, error } = await supabase
    .from("arena_sessions")
    .update({ guest_name: guestName, joined_by: guestId, status: "active" })
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

export async function insertEvent(
  supabase: SupabaseClient,
  sessionId: string,
  actor: ArenaRole,
  eventType: ArenaEventType,
  damage?: number
): Promise<void> {
  const { error } = await supabase.from("arena_events").insert({
    session_id: sessionId,
    actor,
    event_type: eventType,
    damage: damage ?? null,
  });
  if (error) console.error("[arena] insertEvent failed", error.message);
}

/** A stable client-side guest id (uuid). Never a Supabase auth user. */
export function newGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes.
  return "guest-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
