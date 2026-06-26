"use server";

import { getOrCreateSession } from "@/lib/arena/session";
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
