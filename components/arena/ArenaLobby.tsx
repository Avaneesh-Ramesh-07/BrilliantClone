"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { ArenaMatch } from "@/components/arena/ArenaMatch";
import { JoinByCode } from "@/components/arena/JoinByCode";
import { ensureArenaSession } from "@/app/arena/actions";
import { buildAuthedPool } from "@/lib/arena/problems";
import { fetchSession } from "@/lib/arena/session";
import { createClient } from "@/lib/supabase/client";
import type { ArenaSession } from "@/types/arena";

const LOBBY_POLL_MS = 2500;

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
  const [codeCopied, setCodeCopied] = useState(false);
  const createdRef = useRef(false);

  // Reuse the user's open session, or create one — exactly once on mount.
  // NOTE: we intentionally do NOT cancel/abort on cleanup. Under React 18
  // Strict Mode the effect runs (mount → cleanup → remount); a per-run
  // "cancelled" flag would discard the result of the single request the ref
  // guard allows, leaving the lobby stuck on "Creating your challenge…".
  // getOrCreateSession is idempotent (reuses the open waiting session), and the
  // component instance survives the Strict Mode remount, so applying the result
  // unconditionally is safe.
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    void (async () => {
      try {
        const created = await ensureArenaSession();
        if (!created) {
          setError("Could not create a challenge. Please try again.");
          return;
        }
        setSession(created);
      } catch {
        setError("Could not create a challenge. Please try again.");
      }
    })();
  }, [userId]);

  // Stable primitives drive the realtime + polling effects below. Keying off the
  // session id and a plain `isWaiting` boolean (instead of the whole `session`
  // object) keeps exactly one channel and one interval alive while waiting, and
  // avoids tearing them down / recreating them on every setSession tick.
  const sessionId = session?.id ?? null;
  const isWaiting = session?.status === "waiting";

  // Fast path: while waiting, watch the session row for the opponent joining
  // (status -> active) over realtime.
  useEffect(() => {
    if (!sessionId || !isWaiting) return;
    const channel: RealtimeChannel = supabase
      .channel(`arena-lobby:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "arena_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => setSession(payload.new as ArenaSession)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, isWaiting]);

  // Backstop: a single realtime UPDATE can be dropped, or the opponent can join
  // in the gap between session creation and the channel reaching SUBSCRIBED.
  // Poll the row while waiting so the creator still advances within a few
  // seconds. Stops as soon as status flips (isWaiting -> false) or on unmount.
  useEffect(() => {
    if (!sessionId || !isWaiting) return;
    let cancelled = false;
    const interval = setInterval(() => {
      void (async () => {
        const next = await fetchSession(supabase, sessionId);
        // Only adopt the row once it has actually moved on; this prevents
        // pointless re-renders (and, since the deps are stable primitives, never
        // re-subscribes or resets the interval while still waiting).
        if (!cancelled && next && next.status !== "waiting") {
          setSession(next);
        }
      })();
    }, LOBBY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [supabase, sessionId, isWaiting]);

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

  async function copyCode() {
    if (!session?.code) return;
    try {
      await navigator.clipboard.writeText(session.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1800);
    } catch {
      setCodeCopied(false);
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
        Challenge a friend to a head-to-head algebra duel. Share your room code
        or the link below:
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        {session ? (
          <>
            <p className="text-label text-muted">Room code</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="font-heading text-heading-lg tracking-[0.35em] text-text">
                {session.code}
              </span>
              <Button
                type="button"
                variant="secondary"
                className="min-h-[44px]"
                onClick={copyCode}
              >
                {codeCopied ? "Copied!" : "Copy code"}
              </Button>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="text-label text-muted">Or share the link</p>
              <p className="mt-1 break-all text-label text-text">
                {challengeLink}
              </p>
              <Button
                type="button"
                fullWidth
                className="mt-3 min-h-[48px]"
                onClick={copyLink}
              >
                {copied ? "Copied!" : "Copy challenge link"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-body text-muted">Creating your challenge…</p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-primary" />
        <p className="text-body text-muted">Waiting for an opponent to join…</p>
      </div>

      <div className="mt-8">
        <JoinByCode title="Got a code from a friend?" />
      </div>
    </main>
  );
}
