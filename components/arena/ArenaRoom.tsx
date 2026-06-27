"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArenaMatch } from "@/components/arena/ArenaMatch";
import { buildAuthedPool, buildGuestPool } from "@/lib/arena/problems";
import {
  isExpired,
  isFull,
  joinAsGuest,
  joinAsUser,
  newGuestId,
  roleForUser,
} from "@/lib/arena/session";
import { createClient } from "@/lib/supabase/client";
import type { ArenaRole, ArenaSession, ProblemPool } from "@/types/arena";

interface ArenaRoomProps {
  sessionId: string;
  initialSession: ArenaSession | null;
  viewerId: string | null;
  viewerName: string | null;
  creatorName: string | null;
  /** Completed lesson ids for the viewer (empty for guests/anon). */
  completedLessonIds: string[];
  /**
   * Whether this viewer is allowed to play. True for guests always; for an
   * authenticated viewer, true only when they've completed ≥1 lesson.
   */
  canPlay: boolean;
}

function Message({
  title,
  body,
  href = "/arena",
  cta = "Go to Arena",
}: {
  title: string;
  body?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="font-heading text-heading-lg text-text">{title}</h1>
      {body && <p className="mt-3 text-body text-muted">{body}</p>}
      <a
        href={href}
        className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-primary px-6 font-semibold text-white active:scale-95"
      >
        {cta}
      </a>
    </main>
  );
}

export function ArenaRoom({
  sessionId,
  initialSession,
  viewerId,
  viewerName,
  creatorName,
  completedLessonIds,
  canPlay,
}: ArenaRoomProps) {
  const supabase = useMemo(() => createClient(), []);
  const authedPool = useMemo(
    () => buildAuthedPool(completedLessonIds),
    [completedLessonIds]
  );

  const [session, setSession] = useState<ArenaSession | null>(initialSession);
  // Once we (auth or guest) successfully join, we hold the active session and a role.
  const [joinedRole, setJoinedRole] = useState<ArenaRole | null>(null);
  const [joinedPool, setJoinedPool] = useState<ProblemPool | null>(null);
  const [joinedSelfName, setJoinedSelfName] = useState<string>("Player");
  const [guestName, setGuestName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const autoJoinRef = useRef(false);

  const existingRole = session ? roleForUser(session, viewerId) : null;

  // Logged-in prospective joiner: claim the open session automatically (once).
  useEffect(() => {
    if (autoJoinRef.current) return;
    if (!session || !viewerId) return;
    if (existingRole) return; // already a member
    if (!canPlay) return; // authed viewer without a completed lesson is gated
    if (isExpired(session) || isFull(session)) return;

    autoJoinRef.current = true;
    setJoining(true);
    void (async () => {
      const joined = await joinAsUser(supabase, sessionId, viewerId, viewerName);
      setJoining(false);
      if (!joined) {
        setJoinError("Could not join — this arena may already be full.");
        return;
      }
      setSession(joined);
      setJoinedRole("user2");
      setJoinedPool(authedPool);
      setJoinedSelfName(viewerName ?? "You");
    })();
  }, [
    session,
    viewerId,
    existingRole,
    canPlay,
    supabase,
    sessionId,
    authedPool,
    viewerName,
  ]);

  async function handleGuestJoin() {
    const name = guestName.trim();
    if (!name) {
      setJoinError("Please enter a display name.");
      return;
    }
    setJoinError(null);
    setJoining(true);
    const joined = await joinAsGuest(supabase, sessionId, name, newGuestId());
    setJoining(false);
    if (!joined) {
      setJoinError("Could not join — this arena may already be full.");
      return;
    }
    setSession(joined);
    setJoinedRole("user2");
    setJoinedPool(buildGuestPool());
    setJoinedSelfName(name);
  }

  // ----- 1. Invalid link -----
  if (!session) {
    return <Message title="This challenge link is invalid or has expired" />;
  }

  // ----- 2. Already a member (creator or joined auth user), or just joined -----
  const activeRole = joinedRole ?? existingRole;
  if (activeRole) {
    const isCreator = activeRole === "user1";
    const pool =
      joinedPool ?? authedPool; // members are always authenticated users
    const selfName =
      joinedRole != null
        ? joinedSelfName
        : isCreator
          ? creatorName ?? viewerName ?? "You"
          : viewerName ?? "You";
    // Names are denormalized onto the (publicly readable) session row, so both
    // sides resolve the real opponent name: the creator sees the guest/joiner
    // name, the joiner sees the creator name. `creatorName` (from the viewer's
    // own profile read) is only a fallback for the creator viewing their room.
    const enemyName = isCreator
      ? session.guest_name ?? session.joiner_name
      : session.creator_name ?? creatorName;
    return (
      <ArenaMatch
        sessionId={sessionId}
        initialSession={session}
        role={activeRole}
        pool={pool}
        selfName={selfName}
        enemyName={enemyName}
      />
    );
  }

  // ----- 3. Prospective joiner: expiry / full checks -----
  if (isExpired(session)) {
    return <Message title="This challenge has expired" />;
  }
  if (isFull(session)) {
    return <Message title="This arena is already full" />;
  }

  // ----- 4. Gate: authenticated viewer with no completed lesson -----
  // (Existing members are already handled above; guests have viewerId == null
  // and skip this entirely.)
  if (viewerId && !canPlay) {
    return (
      <Message
        title="Complete a lesson first"
        body="You need to finish at least one lesson before you can battle in the Arena."
        href="/home"
        cta="Go to Home"
      />
    );
  }

  // ----- 5. Logged-in joiner mid-claim -----
  if (viewerId) {
    return (
      <Message
        title={joining ? "Joining the arena…" : "Joining…"}
        body={joinError ?? undefined}
      />
    );
  }

  // ----- 6. Not logged in: Log In | Sign Up | Continue as Guest -----
  const redirect = encodeURIComponent(`/arena/${sessionId}`);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-app rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-heading text-heading-lg text-text">
          You&apos;ve been challenged!
        </h1>
        <p className="mt-2 text-body text-muted">
          {creatorName ? `${creatorName} wants` : "Someone wants"} to duel you in
          the Algebra Arena. Join to play.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <a
            href={`/login?redirect=${redirect}&next=${redirect}`}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white active:scale-95"
          >
            Log In
          </a>
          <a
            href={`/signup?redirect=${redirect}&next=${redirect}`}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg border border-border bg-surface px-4 font-semibold text-text active:scale-95"
          >
            Sign Up
          </a>

          <div className="mt-2 border-t border-border pt-4">
            <label htmlFor="guest-name" className="text-label text-muted">
              Or continue as guest
            </label>
            <Input
              id="guest-name"
              type="text"
              value={guestName}
              maxLength={24}
              placeholder="Your display name"
              onChange={(e) => {
                setGuestName(e.target.value);
                if (joinError) setJoinError(null);
              }}
              className="mt-1"
            />
            {joinError && (
              <p className="mt-2 text-feedback text-error" role="alert">
                {joinError}
              </p>
            )}
            <Button
              type="button"
              fullWidth
              className="mt-3 min-h-[48px]"
              disabled={joining}
              onClick={handleGuestJoin}
            >
              {joining ? "Joining…" : "Continue as Guest"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
