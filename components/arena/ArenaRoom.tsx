"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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

  // --- Auth resolution (fixes the self-play race) ---------------------------
  // The server-rendered `viewerId` is authoritative WHEN PRESENT, but a freshly
  // opened tab can server-render with a null `viewerId` before the auth token is
  // readable server-side — even though the browser actually holds a live session
  // and "auto-logs-in" on the client a moment later. If we trusted that transient
  // null we'd show the GUEST join, letting a signed-in creator seat THEMSELVES as
  // a guest user2 and duel themselves (verified: such rows have joined_by = a
  // random guest id + a guest_name, with the same created_by). So whenever the
  // server says "no viewer", we confirm against the client auth state before
  // deciding guest-vs-authed and before claiming any seat.
  const [clientUserId, setClientUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (viewerId) {
      // Server already resolved the viewer; trust it, skip the client probe.
      setAuthChecked(true);
      return;
    }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setClientUserId(data.user?.id ?? null);
      setAuthChecked(true);
    });
    return () => {
      active = false;
    };
  }, [supabase, viewerId]);

  // The effective identity: prefer the server value, fall back to the client one
  // the server missed. `authResolved` gates every seating decision so we never
  // act while the viewer's identity is still unknown.
  const effectiveViewerId = viewerId ?? clientUserId;
  const authResolved = viewerId != null || authChecked;

  // If the client found a signed-in user the server missed AND it's someone
  // OTHER than the creator (a genuine joiner whose authed pool/canPlay must come
  // from the server), re-run the server component once so it re-renders with the
  // now-valid session instead of the stale "logged-out" props. The creator needs
  // no refresh — they're blocked below from the client identity directly. One
  // shot only (ref-guarded) so a persistently-null server can't cause a loop.
  useEffect(() => {
    if (refreshedRef.current) return;
    if (
      viewerId == null &&
      authChecked &&
      clientUserId != null &&
      session != null &&
      clientUserId !== session.created_by
    ) {
      refreshedRef.current = true;
      router.refresh();
    }
  }, [viewerId, authChecked, clientUserId, session, router]);

  // Member detection: the creator and an authenticated joiner are matched by
  // their Supabase id (now via the resolved `effectiveViewerId`). Guests are
  // matched only within the same render via `joinedRole` after they join
  // (below) — there is intentionally NO cross-load re-identification, so a
  // player who leaves does not rejoin.
  const existingRole = session ? roleForUser(session, effectiveViewerId) : null;

  // Logged-in prospective joiner: claim the open session automatically (once).
  useEffect(() => {
    if (autoJoinRef.current) return;
    if (!session) return;
    if (!authResolved) return; // don't claim a seat until we know who the viewer is
    // Never self-join your own room — checked against the RESOLVED identity so
    // the auth-loading race can't let the creator slip through as a guest.
    if (effectiveViewerId && effectiveViewerId === session.created_by) return;
    // Only claim a seat once the SERVER has resolved the viewer, so the authed
    // problem pool / canPlay / name are correct. If the client found a user the
    // server missed, `router.refresh()` (above) re-renders with a real `viewerId`
    // and this effect re-runs with the proper data. We therefore join AS THE
    // AUTH USER (never silently as a guest), so the server's
    // `.neq("created_by", userId)` guard applies and a self-join is rejected.
    if (!viewerId) return;
    if (existingRole) return; // already a member (the creator lands here as user1)
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
    authResolved,
    effectiveViewerId,
    viewerId,
    existingRole,
    canPlay,
    supabase,
    sessionId,
    authedPool,
    viewerName,
  ]);

  async function handleGuestJoin() {
    // Hard safety net: a signed-in viewer must NEVER take a seat as a guest —
    // that is exactly how the self-play bug happened (the creator's second tab
    // guest-joined its own room). The guest UI isn't shown to an authed viewer,
    // but guard here too so no code path can seat an authed user as a guest.
    if (effectiveViewerId) {
      setJoinError("You're already signed in.");
      return;
    }
    const name = guestName.trim();
    if (!name) {
      setJoinError("Please enter a display name.");
      return;
    }
    setJoinError(null);
    setJoining(true);
    // A throwaway per-join guest id for the row's joined_by. It is NOT persisted
    // anywhere — guests cannot rejoin once they leave (by design).
    const guestId = newGuestId();
    const joined = await joinAsGuest(supabase, sessionId, name, guestId);
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

  // ----- 2. Resolving auth: never decide seating while identity is unknown -----
  // Only ever shown when the server didn't resolve a viewer (a fresh tab whose
  // session hasn't surfaced server-side yet); resolves within one client auth
  // round-trip. Keeping it here means we never flash the guest join to a user
  // who is actually signed in. Server and first client render agree (both have
  // viewerId null + authChecked false), so there's no hydration mismatch.
  if (!authResolved) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-body text-muted">Loading…</p>
      </main>
    );
  }

  // ----- 3. Self-join block: you can't duel yourself -----
  // The signed-in creator opening their OWN link (e.g. in a second tab) must
  // never be offered a seat in their own room. We check the RESOLVED identity
  // (so the auth-loading race can't slip them through as a guest) before the
  // member/active render below. Their real lobby + play happen on /arena; this
  // private link is meant for an opponent. A different authed user (joined_by)
  // and true guests are unaffected (their id != created_by / no id).
  if (effectiveViewerId && session.created_by === effectiveViewerId) {
    return (
      <Message
        title="You can't duel yourself"
        body="Share this link with someone else to start the match."
      />
    );
  }

  // ----- 4. Already a member (authed joiner), or just joined -----
  // A guest only reaches here via `joinedRole` (a fresh join in this same
  // render); they are never re-identified across a page load.
  const activeRole = joinedRole ?? existingRole;
  if (activeRole) {
    const isCreator = activeRole === "user1";
    const pool = joinedPool ?? authedPool;
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

  // ----- 5. Non-participant opening a finished room -----
  // (e.g. a guest who left and reopened the link after the duel resolved.)
  // Participants are handled above and see the live result overlay; everyone
  // else just gets a simple "ended" state rather than a misleading "Arena full".
  if (session.status === "complete") {
    return (
      <Message
        title="This duel has ended"
        body="The match is already over."
      />
    );
  }

  // ----- 6. Prospective joiner: expiry / full checks -----
  // Reached only when the viewer is NOT a seated participant, so a genuinely
  // occupied (or expired) room is rejected here. A player who left does not
  // rejoin — they fall through to "Arena full" for an active occupied room.
  if (isExpired(session)) {
    return <Message title="This challenge has expired" />;
  }
  if (isFull(session)) {
    return <Message title="This arena is already full" />;
  }

  // ----- 7. Gate: authenticated viewer with no completed lesson -----
  // (Existing members are already handled above; guests have no resolved id and
  // skip this entirely.)
  if (effectiveViewerId && !canPlay) {
    return (
      <Message
        title="Complete a lesson first"
        body="You need to finish at least one lesson before you can battle in the Arena."
        href="/home"
        cta="Go to Home"
      />
    );
  }

  // ----- 8. Logged-in joiner mid-claim -----
  if (effectiveViewerId) {
    return (
      <Message
        title={joining ? "Joining the arena…" : "Joining…"}
        body={joinError ?? undefined}
      />
    );
  }

  // ----- 9. Not logged in: Log In | Sign Up | Continue as Guest -----
  // Both the "Log in" and "Sign up" links carry a `next` target so the auth flow
  // returns the visitor to THIS challenge afterward (login + signup both honor
  // `next`, validated to relative same-origin paths).
  const next = encodeURIComponent(`/arena/${sessionId}`);
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
            href={`/login?next=${next}`}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white active:scale-95"
          >
            Log In
          </a>
          <a
            href={`/signup?next=${next}`}
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
