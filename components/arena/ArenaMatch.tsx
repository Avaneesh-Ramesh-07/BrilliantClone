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
import { FightScene } from "@/components/arena/FightScene";
import { renderWithFractions } from "@/lib/math/fractions";
import {
  applyAnswer,
  patchForOutcome,
  type CombatState,
} from "@/lib/arena/combat";
import { randomMove, type MoveId } from "@/lib/arena/moves";
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
// How long a fighter's strike/recoil plays before returning to the idle bob.
const ATTACK_ANIM_MS = 800;

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

  // The fight-scene strike currently playing. `attacker` is an ArenaRole so the
  // same move is shown identically on both clients (each maps it to self/opponent
  // by comparing against its own `role`). The move is chosen by the attacker and
  // broadcast over the existing Realtime channel.
  const [attack, setAttack] = useState<{
    attacker: ArenaRole;
    move: MoveId;
    id: number;
  } | null>(null);
  const attackIdRef = useRef(0);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guaranteed defender-recoil trigger: bumped whenever MY hp drops via realtime,
  // so the local fighter staggers even if the attacker's move broadcast was lost.
  const [selfRecoilId, setSelfRecoilId] = useState(0);

  // Explicit "Leave duel" (forfeit) flow.
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Set once THIS client has run its own leave path, so the tab-close/unmount
  // handler below doesn't fire a second (redundant) termination write.
  const leftRef = useRef(false);

  // Pre-match RULES gate (Feature A): once the match is active, BOTH players must
  // click "I understand" before either advances to the versus intro + live play.
  // Readiness is exchanged over the EXISTING presence channel (a `ready` flag in
  // each player's presence meta), so it survives sync/late-join/refresh without a
  // schema change.
  const [iUnderstand, setIUnderstand] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const iUnderstandRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Match-start "versus" intro: shown once, after the rules gate clears.
  const [showVersus, setShowVersus] = useState(false);
  // Latches true the moment the rules gate clears so the rules overlay never
  // reappears after the versus intro / during live play.
  const [versusStarted, setVersusStarted] = useState(false);

  // Edge-of-screen damage flash + per-answer card outline (Feature B).
  const [edgeFlash, setEdgeFlash] = useState<{
    color: "green" | "red";
    id: number;
  } | null>(null);
  const edgeFlashIdRef = useRef(0);
  const edgeFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [answerOutline, setAnswerOutline] = useState<"correct" | "wrong" | null>(
    null
  );
  const answerOutlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

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

  const bothReady = iUnderstand && opponentReady;

  // Trigger the match-start versus intro exactly once, but only AFTER the rules
  // gate clears (both players confirmed "I understand"). Setting both flags in a
  // single commit means the rules overlay is replaced directly by the versus
  // intro with no flash of the live board in between. It then auto-dismisses.
  useEffect(() => {
    if (session.status === "active" && bothReady && !versusStarted) {
      setVersusStarted(true);
      setShowVersus(true);
    }
  }, [session.status, bothReady, versusStarted]);

  // Brief green/red vignette around the viewport edges. Keyed by an incrementing
  // id so repeated flashes of the same color restart the animation; cleared by a
  // JS timer (so it also disappears under prefers-reduced-motion, where the CSS
  // animation is suppressed in favor of a static tint).
  const triggerEdgeFlash = useCallback((color: "green" | "red") => {
    edgeFlashIdRef.current += 1;
    setEdgeFlash({ color, id: edgeFlashIdRef.current });
    if (edgeFlashTimerRef.current) clearTimeout(edgeFlashTimerRef.current);
    edgeFlashTimerRef.current = setTimeout(() => setEdgeFlash(null), 750);
  }, []);

  // Briefly outline the problem card green/red after the local player answers.
  const flashAnswerOutline = useCallback((kind: "correct" | "wrong") => {
    setAnswerOutline(kind);
    if (answerOutlineTimerRef.current) clearTimeout(answerOutlineTimerRef.current);
    answerOutlineTimerRef.current = setTimeout(() => setAnswerOutline(null), 700);
  }, []);

  // Play a fight-scene strike (and auto-return to idle). The incrementing id
  // restarts the CSS animation even when the same move repeats.
  const playAttack = useCallback((attacker: ArenaRole, move: MoveId) => {
    attackIdRef.current += 1;
    setAttack({ attacker, move, id: attackIdRef.current });
    if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    attackTimerRef.current = setTimeout(() => setAttack(null), ATTACK_ANIM_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (edgeFlashTimerRef.current) clearTimeout(edgeFlashTimerRef.current);
      if (answerOutlineTimerRef.current)
        clearTimeout(answerOutlineTimerRef.current);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, []);

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
    channelRef.current = channel;

    const handlePresence = () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ ready?: boolean }>
      >;
      const oppMetas = state[opponentRole];
      const opponentPresent = Array.isArray(oppMetas) && oppMetas.length > 0;
      opponentPresentRef.current = opponentPresent;

      // Rules-gate readiness BACKSTOP (primary signal is the `ready` broadcast
      // below). Scan ALL of the opponent's metas; a second track() call appends
      // a new meta rather than replacing, so the ready flag may not be at [0].
      // Readiness is monotonic within a match and we only ever flip it ON here,
      // so a stale meta can never reset a `ready` we already learned by broadcast.
      if (opponentPresent && oppMetas.some((m) => m?.ready)) {
        setOpponentReady(true);
      }

      // If I've already confirmed and the opponent has just (re)appeared, re-emit
      // my ready broadcast so a late-joining / refreshed opponent reliably hears
      // it (the original broadcast may have fired before they subscribed).
      if (opponentPresent && iUnderstandRef.current) {
        void channel.send({
          type: "broadcast",
          event: "ready",
          payload: { role },
        });
      }

      if (opponentPresent) {
        opponentEverSeenRef.current = true;
        // Opponent (re)connected within the debounce; cancel the pending
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
      // the forfeit win; there is no visible countdown.
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
      // Primary rules-gate signal: when the OTHER role announces "ready", mark
      // them ready. Sticky (only ever set true) so a later presence sync can't
      // undo it. We never need to hear our own broadcast; the local click
      // counts immediately via `setIUnderstand(true)` in handleUnderstand.
      .on("broadcast", { event: "ready" }, ({ payload }) => {
        if ((payload as { role?: ArenaRole } | null)?.role === opponentRole) {
          setOpponentReady(true);
        }
      })
      // The opponent landed a blow and broadcast the move they performed. Play
      // it on this client so both screens show the identical strike (the local
      // recoil is also driven by the HP-drop backstop below).
      .on("broadcast", { event: "attack" }, ({ payload }) => {
        const data = payload as { role?: ArenaRole; move?: MoveId } | null;
        if (data?.role === opponentRole && data.move) {
          playAttack(opponentRole, data.move);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Include the current readiness so a re-subscribe (e.g. after a flap)
          // re-publishes that this player already clicked "I understand".
          await channel.track({
            role,
            ready: iUnderstandRef.current,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // session.status is read inside but we intentionally keep the subscription
    // stable for the life of the match; presence handler reads the latest via
    // closure refresh on re-subscribe is not needed because status only moves
    // forward (waiting -> active -> complete).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, role, opponentRole, supabase]);

  // Detect a blow received: my HP dropped since the last render from realtime.
  // From MY perspective this is taking damage → flash the screen edges RED.
  useEffect(() => {
    if (myHp < prevMyHpRef.current) {
      setSelfHit(true);
      triggerEdgeFlash("red");
      // Backstop recoil for the fight scene: guarantees the local fighter
      // staggers even if the attacker's move broadcast was dropped.
      setSelfRecoilId((n) => n + 1);
      const t = setTimeout(() => setSelfHit(false), HIT_ANIM_MS);
      prevMyHpRef.current = myHp;
      return () => clearTimeout(t);
    }
    prevMyHpRef.current = myHp;
  }, [myHp, triggerEdgeFlash]);

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
  // When a player deliberately quits a live match, they forfeit: the opponent,
  // if still present, is awarded the win and the leaver is recorded as the
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

    // We are the one leaving; cancel any pending "opponent disconnected" timer.
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    if (statusRef.current === "active") {
      // Live match → record the forfeit, then STAY on the result screen. We
      // optimistically flip the local session to complete so the game-over
      // overlay ("You forfeited. You Lose") shows immediately without waiting
      // for the realtime round-trip; the matching DB update arrives right after
      // and is identical. The user dismisses via the "Back to home" button;
      // there is intentionally NO auto-navigation here.
      if (opponentPresentRef.current) {
        await insertEvent(supabase, sessionId, role, "disconnect");
        await insertEvent(supabase, sessionId, opponentRole, "win");
        await endSession(supabase, sessionId, opponentRole);
        setSession((s) => ({ ...s, status: "complete", winner: opponentRole }));
      } else {
        await abandonSession(supabase, sessionId);
        setSession((s) => ({ ...s, status: "complete", winner: "draw" }));
      }
      setLeaving(false);
      setConfirmLeave(false);
      return;
    }

    // Not in a live match (e.g. still waiting in the lobby) → nothing to
    // forfeit, so just leave the room. Soft client-side navigation to /home
    // (matches the "Back to home" button; /arena would bounce a guest to login).
    router.push("/home");
  }, [supabase, sessionId, role, opponentRole, router]);

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

      // Per-answer card outline (Feature B): green on correct, red on wrong.
      flashAnswerOutline(correct ? "correct" : "wrong");

      if (outcome.blow) {
        setEnemyHit(true);
        // I just dealt damage to my opponent → flash MY screen edges GREEN.
        triggerEdgeFlash("green");
        setTimeout(() => setEnemyHit(false), HIT_ANIM_MS);
        // Pick a random move, play it locally (MY fighter strikes), and
        // broadcast it so the opponent's client shows the identical move.
        const move = randomMove();
        playAttack(role, move);
        void channelRef.current?.send({
          type: "broadcast",
          event: "attack",
          payload: { role, move },
        });
        setFeedback(
          outcome.buffActive
            ? `Critical blow! −${outcome.damage} HP (1.5x)`
            : `Blow landed! −${outcome.damage} HP`
        );
      } else if (correct) {
        setFeedback("Correct!");
      } else {
        setFeedback("Wrong! Streak reset.");
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
    [
      problem,
      isActive,
      input,
      session,
      role,
      supabase,
      sessionId,
      advance,
      flashAnswerOutline,
      triggerEdgeFlash,
      playAttack,
    ]
  );

  // Rules gate: this player confirms they understand. Publishes readiness via
  // presence so the opponent's client sees it on the next sync; the local flag
  // mirror keeps the re-subscribe track payload correct after a flap.
  const handleUnderstand = useCallback(() => {
    if (iUnderstandRef.current) return;
    iUnderstandRef.current = true;
    setIUnderstand(true); // local side counts immediately; never relies on echo
    const channel = channelRef.current;
    if (!channel) return;
    // Primary cross-client signal: a broadcast (reliable; presence-meta updates
    // via a 2nd track() are not a dependable way to notify the other client).
    void channel.send({ type: "broadcast", event: "ready", payload: { role } });
    // Backstop for a late-join / refresh: keep the flag in presence meta too, so
    // an opponent who subscribes afterward still discovers it on sync.
    void channel.track({
      role,
      ready: true,
      online_at: new Date().toISOString(),
    });
  }, [role]);

  // ----- Render helpers -----
  // Start with the relative path so SSR and the first client render match, then
  // upgrade to the absolute URL after mount (avoids a hydration mismatch).
  const [challengeLink, setChallengeLink] = useState(`/arena/${sessionId}`);
  useEffect(() => {
    setChallengeLink(`${window.location.origin}/arena/${sessionId}`);
  }, [sessionId]);

  // A forfeit (explicit leave or disconnect) ends the match with a winner while
  // the loser still has HP left; a normal end always drives the loser to 0 HP.
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
        ? "Opponent forfeited. You Win!"
        : "You Win!";
    }
    return byForfeit ? "You forfeited. You Lose" : "You Lose";
  })();

  return (
    <main className="flex min-h-screen flex-col py-6">
      {/* ===== Screen-edge damage flash (green = dealt, red = taken) ===== */}
      {edgeFlash && (
        <div
          key={edgeFlash.id}
          aria-hidden
          className={`af-edge ${
            edgeFlash.color === "green" ? "af-edge-green" : "af-edge-red"
          }`}
        />
      )}

      {/* ===== Match-start versus intro (overlay, auto-dismisses) ===== */}
      {showVersus && (
        <DuelStartVersus
          me={{ username: selfName, wins: myWins }}
          opponent={{ username: enemyDisplay, wins: enemyWins }}
          onDone={() => setShowVersus(false)}
        />
      )}

      {/* ===== Pre-match RULES gate: both players must confirm before play ===== */}
      {isActive && !isComplete && !versusStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-app rounded-2xl border border-border bg-surface p-6 text-center shadow-lg">
            <h2 className="font-heading text-heading-lg text-text">How to Duel</h2>
            <ol className="mt-5 flex flex-col gap-3 text-left">
              <li className="flex gap-3 text-body text-text">
                <span className="font-heading text-primary">1.</span>
                Solve math problems quickly!
              </li>
              <li className="flex gap-3 text-body text-text">
                <span className="font-heading text-primary">2.</span>
                Getting 2 problems correct inflicts damage to your opponent.
              </li>
              <li className="flex gap-3 text-body text-text">
                <span className="font-heading text-primary">3.</span>
                Keep a streak going for multipliers!
              </li>
            </ol>

            {iUnderstand ? (
              <p
                className="mt-6 text-body text-muted"
                role="status"
                aria-live="polite"
              >
                Waiting for your opponent…
              </p>
            ) : (
              <>
                <Button
                  fullWidth
                  className="mt-6 min-h-[48px]"
                  onClick={handleUnderstand}
                >
                  I understand
                </Button>
                {opponentReady && (
                  <p
                    className="mt-3 text-label text-muted"
                    role="status"
                    aria-live="polite"
                  >
                    Your opponent is ready.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
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
            className={`${selfHit ? "af-hit" : ""} ${buffActive ? "af-buffed" : ""}`}
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
            className={enemyHit ? "af-hit" : ""}
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

      {/* ===== Middle: fight scene ===== */}
      <div className="flex flex-1 flex-col items-stretch justify-center py-4">
        {isWaiting ? (
          <div className="text-center">
            <p className="text-body text-muted">Waiting for your opponent…</p>
            <p className="mt-2 break-all text-label text-muted">{challengeLink}</p>
          </div>
        ) : (
          <FightScene
            attack={
              attack
                ? {
                    attacker: attack.attacker === role ? "self" : "opponent",
                    move: attack.move,
                    id: attack.id,
                  }
                : null
            }
            selfRecoilId={selfRecoilId}
            isComplete={isComplete}
            selfDefeated={session.winner === opponentRole}
          />
        )}
      </div>

      {/* ===== Bottom: current problem + answer input ===== */}
      {isActive && (
        <div className="flex flex-col gap-3">
          {problem && (
            <div
              className={`rounded-xl border-2 px-5 py-4 transition-colors duration-200 ${
                answerOutline === "correct"
                  ? "border-success"
                  : answerOutline === "wrong"
                    ? "border-error"
                    : "border-border"
              }`}
            >
              <p
                className="px-2 text-center font-equation text-text"
                style={{ fontSize: 20, lineHeight: 1.4 }}
              >
                {renderWithFractions(
                  problem.prompt,
                  "arena-prompt",
                  undefined,
                  "mx-0.5"
                )}
              </p>
            </div>
          )}

          {poolExhausted && (
            <p className="text-center text-body text-muted">
              You&apos;ve cleared every problem in your pool. Hold the line!
            </p>
          )}

          {feedback && (
            <p className="text-center text-feedback text-muted">{feedback}</p>
          )}

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
        </div>
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
            {/* Programmatic client-side navigation (not <Link>): a fresh soft
                navigation preserves the App Router context (so the earlier
                usePathname/useContext crash from a full reload does NOT return).
                Goes to /home, the reliable destination for both authed players
                and guests (a guest has no /arena lobby). */}
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white active:scale-95"
            >
              Back to home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
