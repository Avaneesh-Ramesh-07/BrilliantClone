"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { ArenaMatch } from "@/components/arena/ArenaMatch";
import { ensureArenaSession } from "@/app/arena/actions";
import { buildAuthedPool } from "@/lib/arena/problems";
import { createClient } from "@/lib/supabase/client";
import type { ArenaSession } from "@/types/arena";

interface ArenaLobbyProps {
  userId: string;
  displayName: string;
  completedLessonIds: string[];
}

export function ArenaLobby({
  userId,
  displayName,
  completedLessonIds,
}: ArenaLobbyProps) {
  const supabase = useMemo(() => createClient(), []);
  const pool = useMemo(
    () => buildAuthedPool(completedLessonIds),
    [completedLessonIds]
  );

  const [session, setSession] = useState<ArenaSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createdRef = useRef(false);

  // Reuse the user's open session, or create one — exactly once on mount.
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    let cancelled = false;
    void (async () => {
      const created = await ensureArenaSession();
      if (cancelled) return;
      if (!created) {
        setError("Could not create a challenge. Please try again.");
        return;
      }
      setSession(created);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // While waiting, watch the session row for the opponent joining (status -> active).
  useEffect(() => {
    if (!session || session.status !== "waiting") return;
    const channel: RealtimeChannel = supabase
      .channel(`arena-lobby:${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "arena_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => setSession(payload.new as ArenaSession)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, session]);

  const challengeLink =
    session && typeof window !== "undefined"
      ? `${window.location.origin}/arena/${session.id}`
      : "";

  async function copyLink() {
    if (!challengeLink) return;
    try {
      await navigator.clipboard.writeText(challengeLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col justify-center py-12">
        <p className="text-body text-error">{error}</p>
        <a
          href="/arena"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white active:scale-95"
        >
          Try again
        </a>
      </main>
    );
  }

  // Opponent joined — hand off to the shared live match screen.
  if (session && session.status !== "waiting") {
    return (
      <ArenaMatch
        sessionId={session.id}
        initialSession={session}
        role="user1"
        pool={pool}
        selfName={displayName}
        enemyName={session.guest_name}
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-center py-12">
      <h1 className="font-heading text-heading-lg text-text">⚔️ Arena</h1>
      <p className="mt-2 text-body text-muted">
        Challenge a friend to a head-to-head algebra duel. Share this link:
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        {session ? (
          <>
            <p className="break-all text-label text-text">{challengeLink}</p>
            <Button
              type="button"
              fullWidth
              className="mt-4 min-h-[48px]"
              onClick={copyLink}
            >
              {copied ? "Copied!" : "Copy challenge link"}
            </Button>
          </>
        ) : (
          <p className="text-body text-muted">Creating your challenge…</p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
        <p className="text-body text-muted">Waiting for an opponent to join…</p>
      </div>
    </main>
  );
}
