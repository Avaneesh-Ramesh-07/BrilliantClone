"use server";

import {
  getOrCreateSession,
  resolveRoomCodeToSessionId,
} from "@/lib/arena/session";
import { createClient } from "@/lib/supabase/server";
import type { ArenaSession } from "@/types/arena";

/**
 * Get-or-create the current user's open challenge session, executed on the
 * server (reliable/fast here, unlike direct browser→Supabase calls) and invoked
 * exactly once from the lobby, so no duplicate sessions are created.
 */
export async function ensureArenaSession(): Promise<ArenaSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getOrCreateSession(supabase, user.id);
}

/**
 * Resolves a typed room code to a joinable session id (or null when the code is
 * unknown / the room is no longer waiting). Runs in the caller's Supabase
 * context, which works for both authed users and anon guests because the
 * arena_sessions SELECT policy is open.
 */
export async function resolveRoomCode(code: string): Promise<string | null> {
  const supabase = await createClient();
  return resolveRoomCodeToSessionId(supabase, code);
}
