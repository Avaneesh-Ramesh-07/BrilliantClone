"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { DuelStartVersus } from "@/components/arena/DuelStartVersus";
import {
  applyAnswer,
  patchForOutcome,
  type CombatState,
} from "@/lib/arena/combat";
import { nextProblem } from "@/lib/arena/problems";
import {
  abandonSession,
  endSession,
  insertEvent,
  writeCombatPatch,
} from "@/lib/arena/session";
import { createClient } from "@/lib/supabase/client";
import type {
  ArenaProblem,
  ArenaRole,
  ArenaSession,
  ProblemPool,
} from "@/types/arena";
import styles from "./arena.module.css";

// Short, INVISIBLE debounce before awarding a forfeit when the opponent's
// presence drops. Supabase Realtime briefly emits leave→rejoin during normal
// re-sync, so a tiny wait avoids a spurious forfeit from a momentary flap. No
// countdown is shown; a real tab-close resolves to the win in a few seconds.
const DISCONNECT_DEBOUNCE_MS = 2_500;
const HIT_ANIM_MS = 600;

interface ArenaMatchProps {
  sessionId: string;
  initialSession: ArenaSession;
  role: ArenaRole;
  pool: ProblemPool;
  selfName: string;
  /** Best-effort opponent name (creator's name for user2; may be null for user1). */
  enemyName: string | null;
}

function combatOf(s: ArenaSession): CombatState {
  return {
    user1_hp: s.user1_hp,
    user2_hp: s.user2_hp,
    user1_streak: s.user1_streak,
    user2_streak: s.user2_streak,
    user1_correct_this_blow: s.user1_correct_this_blow,
    user2_correct_this_blow: s.user2_correct_this_blow,
    status: s.status,
    winner: s.winner,
  };
}

function parseNumeric(raw: string): number | null {
  const trimmed = raw.trim().replace(/\u2212/g, "-"); // unicode minus -> ascii
  if (trimmed === "" || trimmed === "-" || trimmed === ".") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function Avatar({
  label,
  className,
  tone,
}: {
  label: string;
  className?: string;
  tone: "you" | "enemy";
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "?";
  const bg = tone === "you" ? "bg-primary" : "bg-error";
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-border text-2xl font-bold text-white ${bg} ${className ?? ""}`}
    >
      {initial}
    </div>
  );
}

function HpBar({ hp, tone }: { hp: number; tone: "you" | "enemy" }) {
  const pct = Math.max(0, Math.min(100, hp));
  const color = tone === "you" ? "bg-success" : "bg-error";
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full ${color} ${styles.hpFill}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ArenaMatch({
  sessionId,
  initialSession,
  role,
  pool,
  selfName,
  enemyName,
}: ArenaMatchProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<ArenaSession>(initialSession);

  const [problem, setProblem] = useState<ArenaProblem | null>(null);
  const [poolExhausted, setPoolExhausted] = useState(false);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [enemyHit, setEnemyHit] = useState(false);
  const [selfHit, setSelfHit] = useState(false);
  const [opponentLeft, setOpponentLeft] = useState(false);

  // Explicit "Leave duel" (forfeit) flow.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Set once THIS client has run its own leave path, so the tab-close/unmount
  // handler below doesn't fire a second (redundant) termination write.
  const leftRef = useRef(false);

  // Match-start "versus" intro: shown once, the first time this match is active.
  const [showVersus, setShowVersus] = useState(false);
  const versusShownRef = useRef(false);

  const usedIdsRef = useRef<Set<string>>(new Set());
  const correctCountRef = useRef(0);
  const prevMyHpRef = useRef<number>(
    role === "user1" ? initialSession.user1_hp : initialSession.user2_hp
  );
  const opponentEverSeenRef = useRef(false);
  const opponentPresentRef = useRef(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opponentRole: ArenaRole = role === "user1" ? "user2" : "user1";

  const myHp = role === "user1" ? session.user1_hp : session.user2_hp;
  const enemyHp = role === "user1" ? session.user2_hp : session.user1_hp;
  const myStreak = role === "user1" ? session.user1_streak : session.user2_streak;
  const buffActive = myStreak >= 5;

  const isActive = session.status === "active";
  const isComplete = session.status === "complete";
  const isWaiting = session.status === "waiting";

  // Live mirror of the status so the (intentionally stable) presence handler
  // always reads the current value rather than a stale closure.
  const statusRef = useRef(session.status);
  statusRef.current = session.status;

  // Read names off the live session row first so realtime updates (e.g. the
  // moment an authed opponent joins and their name is written) flow through even
  // if the mount-time `enemyName` prop was still null.
  const enemyDisplay =
    role === "user1"
      ? session.guest_name ?? session.joiner_name ?? enemyName ?? "Challenger"
      : session.creator_name ?? enemyName ?? "Challenger";

  // Wins for each side, read off the (denormalized) session row. The local
  // player is always user1 => creator_*, or user2 => joiner_*. Guests join with
  // joiner_wins = 0 (Initiate). Used by the versus intro's duel cards.
  const myWins = role === "user1" ? session.creator_wins : session.joiner_wins;
  const enemyWins =
    role === "user1" ? session.joiner_wins : session.creator_wins;

  // Trigger the match-start versus intro exactly once, the first time the match
  // is active (covers both the creator — whose ArenaMatch mounts on hand-off —
  // and the joiner — who lands here already active). It auto-dismisses.
  useEffect(() => {
    if (session.status === "active" && !versusShownRef.current) {
      versusShownRef.current = true;
      setShowVersus(true);
    }
  }, [session.status]);

  // Pick the first problem on mount.
  const advance = useCallback(
    (correctCount: number) => {
      const p = nextProblem(pool, usedIdsRef.current, correctCount);
      if (p) {
        usedIdsRef.current.add(p.id);
        setProblem(p);
        setPoolExhausted(false);
      } else {
        setProblem(null);
        setPoolExhausted(true);
      }
    },
    [pool]
  );

  useEffect(() => {
    advance(0);
  }, [advance]);

  // ----- Realtime: subscribe to this session row + presence on one channel. -----
  useEffect(() => {
    const channel: RealtimeChannel = supabase.channel(`arena:${sessionId}`, {
      config: { presence: { key: role } },
    });

    const handlePresence = () => {
      const state = channel.presenceState() as Record<string, unknown[]>;
      const opponentPresent = Array.isArray(state[opponentRole])
        ? state[opponentRole].length > 0
        : false;
      opponentPresentRef.current = opponentPresent;

      if (opponentPresent) {
        opponentEverSeenRef.current = true;
        // Opponent (re)connected within the debounce — cancel the pending
        // forfeit and resume the match (this also absorbs presence flaps).
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        setOpponentLeft(false);
        return;
      }

      // Opponent not present. Only treat as a disconnect if we've seen them
      // before and the match is still live. After a short INVISIBLE debounce
      // (to ride out a momentary presence flap) the remaining player is awarded
      // the forfeit win — there is no visible countdown.
      if (
        opponentEverSeenRef.current &&
        !disconnectTimerRef.current &&
        statusRef.current === "active"
      ) {
        disconnectTimerRef.current = setTimeout(() => {
          disconnectTimerRef.current = null;
          // Re-check at fire time: the match may have ended during the debounce
          // (e.g. the opponent explicitly forfeited and already wrote the
          // terminal state). If so this is a no-op so we don't double-record.
          if (statusRef.current !== "active") return;
          setOpponentLeft(true);
          void insertEvent(supabase, sessionId, opponentRole, "disconnect");
          void insertEvent(supabase, sessionId, role, "win");
          void endSession(supabase, sessionId, role);
        }, DISCONNECT_DEBOUNCE_MS);
      }
    };

    channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "arena_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          setSession(payload.new as ArenaSession);
        }
      )
      .on("presence", { event: "sync" }, handlePresence)
      .on("presence", { event: "join" }, handlePresence)
      .on("presence", { event: "leave" }, handlePresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ role, online_at: new Date().toISOString() });
        }
      });

    return () => {
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      void supabase.removeChannel(channel);
    };
    // session.status is read inside but we intentionally keep the subscription
    // stable for the life of the match; presence handler reads the latest via
    // closure refresh on re-subscribe is not needed because status only moves
    // forward (waiting -> active -> complete).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, role, opponentRole, supabase]);

  // Detect a blow received: my HP dropped since the last render from realtime.
  useEffect(() => {
    if (myHp < prevMyHpRef.current) {
      setSelfHit(true);
      const t = setTimeout(() => setSelfHit(false), HIT_ANIM_MS);
      prevMyHpRef.current = myHp;
      return () => clearTimeout(t);
    }
    prevMyHpRef.current = myHp;
  }, [myHp]);

  // ----- Implicit leave (tab close / disconnect) is INTENTIONALLY not resolved
  // here. -----
  // An implicit leave writes NO terminal result from the leaver's side. The
  // resolution is owned entirely by the REMAINING player's presence handler (see
  // the realtime effect above): after a short invisible debounce it re-reads the
  // authoritative `statusRef` and awards that player the win by forfeit. A
  // genuine both-left room (no client remains to fire the timer) is swept to a
  // draw by the `healStaleSessionsForUser` staleness backstop. The explicit
  // "Leave duel" button below is the only client-initiated immediate forfeit.

  // ----- Explicit "Leave duel" (forfeit). -----
  // When a player deliberately quits a live match, they forfeit: the opponent —
  // if still present — is awarded the win and the leaver is recorded as the
  // loser, reusing the SAME endSession termination path as a disconnect/normal
  // end (so wins/rank/history all derive consistently from session.winner). If
  // the opponent is already gone too, nobody remains to win, so the room is
  // abandoned as a draw. Unlike an implicit leave this is immediate (no grace
  // window) because the player explicitly chose to quit. Guarded by the
  // active-status check plus endSession/abandonSession's `neq('complete')`
  // idempotency, so a leave signal on an already-finished room is a no-op and
  // the result can never be double-counted.
  const handleConfirmLeave = useCallback(async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    setLeaving(true);

    // We are the one leaving — cancel any pending "opponent disconnected" timer.
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    if (statusRef.current === "active") {
      if (opponentPresentRef.current) {
        await insertEvent(supabase, sessionId, role, "disconnect");
        await insertEvent(supabase, sessionId, opponentRole, "win");
        await endSession(supabase, sessionId, opponentRole);
      } else {
        await abandonSession(supabase, sessionId);
      }
    }

    window.location.href = "/arena";
  }, [supabase, sessionId, role, opponentRole]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!problem || !isActive) return;

      const parsed = parseNumeric(input);
      if (parsed === null) {
        setInputError(true);
        return;
      }
      setInputError(false);

      const correct = parsed === problem.answer;
      const outcome = applyAnswer(combatOf(session), role, correct);
      const patch = patchForOutcome(outcome, role);

      // Optimistic local update of just the fields this player changed.
      setSession((s) => ({ ...s, ...patch }) as ArenaSession);

      if (outcome.blow) {
        setEnemyHit(true);
        setTimeout(() => setEnemyHit(false), HIT_ANIM_MS);
        setFeedback(
          outcome.buffActive
            ? `Critical blow! −${outcome.damage} HP (1.5x)`
            : `Blow landed! −${outcome.damage} HP`
        );
      } else if (correct) {
        setFeedback("Correct!");
      } else {
        setFeedback("Wrong — streak reset.");
      }

      void writeCombatPatch(supabase, sessionId, patch);
      void insertEvent(
        supabase,
        sessionId,
        role,
        correct ? (outcome.blow ? "blow" : "correct") : "wrong",
        outcome.blow ? outcome.damage : undefined,
        problem.topic
      );

      if (correct) correctCountRef.current += 1;
      advance(correctCountRef.current);
      setInput("");
    },
    [problem, isActive, input, session, role, supabase, sessionId, advance]
  );

  // ----- Render helpers -----
  // Start with the relative path so SSR and the first client render match, then
  // upgrade to the absolute URL after mount (avoids a hydration mismatch).
  const [challengeLink, setChallengeLink] = useState(`/arena/${sessionId}`);
  useEffect(() => {
    setChallengeLink(`${window.location.origin}/arena/${sessionId}`);
  }, [sessionId]);

  // A forfeit (explicit leave or disconnect) ends the match with a winner while
  // the loser still has HP left — a normal end always drives the loser to 0 HP.
  // So a positive loser-HP on a completed, non-draw match means win-by-forfeit.
  // This lets BOTH the detecting client (opponentLeft) AND the one who only
  // receives the realtime terminal update render the forfeit outcome correctly.
  const loserHp =
    session.winner === "user1"
      ? session.user2_hp
      : session.winner === "user2"
        ? session.user1_hp
        : null;
  const byForfeit =
    isComplete &&
    (session.winner === "user1" || session.winner === "user2") &&
    (loserHp ?? 0) > 0;

  const winnerText = (() => {
    if (!isComplete) return null;
    if (session.winner === "draw") return "It's a draw!";
    if (session.winner === role) {
      return opponentLeft || byForfeit
        ? "Opponent forfeited — You Win!"
        : "You Win!";
    }
    return byForfeit ? "You forfeited — You Lose" : "You Lose";
  })();

  return (
    <main className="flex min-h-screen flex-col py-6">
      {/* ===== Match-start versus intro (overlay, auto-dismisses) ===== */}
      {showVersus && (
        <DuelStartVersus
          me={{ username: selfName, wins: myWins }}
          opponent={{ username: enemyDisplay, wins: enemyWins }}
          onDone={() => setShowVersus(false)}
        />
      )}

      {/* ===== Leave duel (forfeit) affordance ===== */}
      {!isComplete && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            disabled={leaving}
            className="text-label text-muted underline-offset-2 hover:text-error hover:underline disabled:opacity-50"
          >
            Leave duel
          </button>
        </div>
      )}

      {/* ===== Combatants ===== */}
      <div className="flex items-stretch justify-between gap-3">
        <div className="flex flex-1 flex-col items-center gap-2">
          <Avatar
            label={selfName}
            tone="you"
            className={`${selfHit ? styles.hit : ""} ${buffActive ? styles.buffed : ""}`}
          />
          <p className="max-w-full truncate text-label text-text">{selfName}</p>
          <p className="text-body font-semibold text-text">❤️ {Math.max(0, myHp)}</p>
          <HpBar hp={myHp} tone="you" />
          {buffActive && (
            <span className="rounded-full bg-[rgba(245,195,55,0.18)] px-2 py-0.5 text-label text-[#a87b00]">
              🔥 x1.5
            </span>
          )}
        </div>

        <div className="flex items-center px-1 text-heading-md font-bold text-muted">
          VS
        </div>

        <div className="flex flex-1 flex-col items-center gap-2">
          <Avatar
            label={enemyDisplay}
            tone="enemy"
            className={enemyHit ? styles.hit : ""}
          />
          <p className="max-w-full truncate text-label text-text">
            {enemyDisplay}
          </p>
          <p className="text-body font-semibold text-text">
            ❤️ {Math.max(0, enemyHp)}
          </p>
          <HpBar hp={enemyHp} tone="enemy" />
        </div>
      </div>

      {/* ===== Middle: current problem ===== */}
      <div className="flex flex-1 flex-col items-center justify-center py-8">
        {isWaiting && (
          <div className="text-center">
            <p className="text-body text-muted">Waiting for your opponent…</p>
            <p className="mt-2 break-all text-label text-muted">{challengeLink}</p>
          </div>
        )}

        {isActive && problem && (
          <p
            className="px-2 text-center font-equation text-text"
            style={{ fontSize: 20, lineHeight: 1.4 }}
          >
            {problem.prompt}
          </p>
        )}

        {isActive && poolExhausted && (
          <p className="text-center text-body text-muted">
            You&apos;ve cleared every problem in your pool — hold the line!
          </p>
        )}

        {feedback && isActive && (
          <p className="mt-4 text-feedback text-muted">{feedback}</p>
        )}
      </div>

      {/* ===== Bottom: input ===== */}
      {isActive && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            inputMode="text"
            autoComplete="off"
            aria-label="Your answer"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (inputError) setInputError(false);
            }}
            placeholder="Your answer"
            className={`min-h-[48px] w-full rounded-lg border bg-surface px-4 text-equation text-text outline-none focus:ring-2 focus:ring-primary-light ${
              inputError ? "border-error" : "border-border focus:border-primary"
            }`}
          />
          <Button
            type="submit"
            fullWidth
            className="min-h-[48px]"
            disabled={!problem}
          >
            Submit
          </Button>
        </form>
      )}

      {/* ===== Leave/forfeit confirmation ===== */}
      {confirmLeave && !isComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-app rounded-2xl bg-surface p-6 text-center shadow-lg">
            <p className="font-heading text-heading-md text-text">
              Flee the duel?
            </p>
            <p className="mt-2 text-body text-muted">
              {isActive
                ? "Abandon a live duel and your opponent claims victory by forfeit."
                : "Leave this room and return to the arena."}
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                fullWidth
                className="min-h-[48px]"
                onClick={() => setConfirmLeave(false)}
                disabled={leaving}
              >
                Keep fighting
              </Button>
              <Button
                fullWidth
                className="min-h-[48px]"
                onClick={handleConfirmLeave}
                disabled={leaving}
              >
                {leaving ? "Fleeing…" : isActive ? "Forfeit" : "Leave"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Game over overlay ===== */}
      {isComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-app rounded-2xl bg-surface p-6 text-center shadow-lg">
            <p className="font-heading text-heading-lg text-text">{winnerText}</p>
            <p className="mt-2 text-body text-muted">
              {selfName} ❤️ {Math.max(0, myHp)} &nbsp;·&nbsp; {enemyDisplay} ❤️{" "}
              {Math.max(0, enemyHp)}
            </p>
            {/* Programmatic client-side navigation (not <Link>): a <Link> here
                prefetched /arena, which server-redirects guests to /login, and
                the click reused that prefetch and appeared to do nothing.
                router.push performs a fresh soft navigation, preserving the App
                Router context (so the earlier usePathname/useContext crash from
                a full reload does NOT return). /arena is the new-match lobby for
                authed players and funnels guests to /login to start one. */}
            <button
              type="button"
              onClick={() => router.push("/arena")}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white active:scale-95"
            >
              New match
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
