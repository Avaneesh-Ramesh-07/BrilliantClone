import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_COLUMNS, healStaleSessionsForUser } from "@/lib/arena/session";
import { ARENA_TOPICS } from "@/types/arena";
import type { ArenaRole, ArenaSession, ArenaTopic } from "@/types/arena";

/**
 * Server-side duel history + aggregate stats for the "Duel history" dashboard
 * (app/arena/history/page.tsx). Everything is derived from the completed
 * arena_sessions the user belongs to and their arena_events. No realtime — this
 * is a read-only summary computed on each page load.
 */

export type DuelResult = "win" | "loss" | "draw";

/** A single past duel, from the logged-in user's point of view. */
export interface DuelSummary {
  id: string;
  /** ISO timestamp the duel was created. */
  date: string;
  opponentName: string;
  result: DuelResult;
  yourHp: number;
  opponentHp: number;
}

export interface DuelStats {
  totalDuels: number;
  /** Mean gap between the player's consecutive answers, ms (null if no data). */
  avgAnswerMs: number | null;
  /** Topic with the highest correctness rate (null if not enough data). */
  mostComfortableTopic: ArenaTopic | null;
  /** Topic with the lowest correctness rate (null unless ≥2 topics qualify). */
  leastComfortableTopic: ArenaTopic | null;
  /** Damage dealt per second of active match time (null if no data). */
  damagePerSecond: number | null;
}

export interface DuelHistory {
  duels: DuelSummary[];
  stats: DuelStats;
}

/** Answer event types (a 'blow' is a correct answer that landed a hit). */
const ANSWER_EVENTS = new Set(["correct", "wrong", "blow"]);
/** Minimum answers on a topic before its comfort rate is trustworthy. */
const MIN_TOPIC_SAMPLE = 4;

interface ArenaEventRow {
  session_id: string;
  actor: string;
  event_type: string;
  damage: number | null;
  topic: string | null;
  created_at: string;
}

/** The user's role in a session: creator => user1, otherwise the joiner => user2. */
function roleFor(session: ArenaSession, userId: string): ArenaRole {
  return session.created_by === userId ? "user1" : "user2";
}

function resultFor(session: ArenaSession, role: ArenaRole): DuelResult {
  if (session.winner == null || session.winner === "draw") return "draw";
  return session.winner === role ? "win" : "loss";
}

function opponentNameFor(session: ArenaSession, role: ArenaRole): string {
  const name =
    role === "user1"
      ? session.guest_name ?? session.joiner_name
      : session.creator_name;
  return name ?? "Challenger";
}

function emptyStats(): DuelStats {
  return {
    totalDuels: 0,
    avgAnswerMs: null,
    mostComfortableTopic: null,
    leastComfortableTopic: null,
    damagePerSecond: null,
  };
}

/**
 * Loads the user's completed duels and aggregate stats. First self-heals any of
 * the user's abandoned ('active' but stale) rooms so they appear as finished
 * duels (CHANGE 2 backstop), then reads the completed sessions and their events.
 */
export async function getDuelHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<DuelHistory> {
  await healStaleSessionsForUser(supabase, userId);

  const { data: sessionRows } = await supabase
    .from("arena_sessions")
    .select(SESSION_COLUMNS)
    .or(`created_by.eq.${userId},joined_by.eq.${userId}`)
    .eq("status", "complete")
    .order("created_at", { ascending: false });

  const sessions = (sessionRows as ArenaSession[] | null) ?? [];
  if (sessions.length === 0) {
    return { duels: [], stats: emptyStats() };
  }

  const roleById = new Map<string, ArenaRole>();
  const duels: DuelSummary[] = sessions.map((s) => {
    const role = roleFor(s, userId);
    roleById.set(s.id, role);
    return {
      id: s.id,
      date: s.created_at,
      opponentName: opponentNameFor(s, role),
      result: resultFor(s, role),
      yourHp: role === "user1" ? s.user1_hp : s.user2_hp,
      opponentHp: role === "user1" ? s.user2_hp : s.user1_hp,
    };
  });

  const { data: eventRows } = await supabase
    .from("arena_events")
    .select("session_id, actor, event_type, damage, topic, created_at")
    .in(
      "session_id",
      sessions.map((s) => s.id)
    )
    .order("created_at", { ascending: true });

  const events = (eventRows as ArenaEventRow[] | null) ?? [];

  return {
    duels,
    stats: computeStats(events, roleById),
  };
}

/**
 * Computes the four aggregate stats from a session's events.
 *
 * `roleById` maps each session id to the *player's* role so we only count the
 * player's own answers; duration uses BOTH players' events (the wall-clock span
 * of the match).
 */
function computeStats(
  events: ArenaEventRow[],
  roleById: Map<string, ArenaRole>
): DuelStats {
  // Per-session buckets.
  const bySession = new Map<
    string,
    { mine: ArenaEventRow[]; all: ArenaEventRow[] }
  >();
  for (const e of events) {
    const bucket =
      bySession.get(e.session_id) ?? { mine: [], all: [] };
    bucket.all.push(e);
    if (e.actor === roleById.get(e.session_id)) bucket.mine.push(e);
    bySession.set(e.session_id, bucket);
  }

  // --- Avg time to answer ---
  // We don't store a per-question start time, so we approximate "time to answer"
  // as the gap between the player's consecutive answer submissions within a
  // duel (created_at deltas), pooled across all duels. The very first answer of
  // a duel has no preceding answer, so it contributes no delta.
  let deltaSumMs = 0;
  let deltaCount = 0;

  // --- Comfort by topic ---
  // correctness rate per topic = (correct + blow) / (correct + wrong + blow).
  const topicCorrect: Record<string, number> = {};
  const topicTotal: Record<string, number> = {};

  // --- Damage per second ---
  // total damage the player dealt (sum of damage on their 'blow' events) over
  // the total active match time (sum of each duel's last−first event span).
  let totalDamage = 0;
  let totalDurationMs = 0;

  bySession.forEach(({ mine, all }) => {
    const myAnswers = mine
      .filter((e) => ANSWER_EVENTS.has(e.event_type))
      .map((e) => new Date(e.created_at).getTime())
      .sort((a, b) => a - b);
    for (let i = 1; i < myAnswers.length; i++) {
      deltaSumMs += myAnswers[i] - myAnswers[i - 1];
      deltaCount += 1;
    }

    for (const e of mine) {
      if (!ANSWER_EVENTS.has(e.event_type)) continue;
      if (e.topic == null) continue;
      topicTotal[e.topic] = (topicTotal[e.topic] ?? 0) + 1;
      if (e.event_type !== "wrong") {
        topicCorrect[e.topic] = (topicCorrect[e.topic] ?? 0) + 1;
      }
    }

    for (const e of mine) {
      if (e.event_type === "blow") totalDamage += e.damage ?? 0;
    }

    if (all.length >= 2) {
      const times = all.map((e) => new Date(e.created_at).getTime());
      totalDurationMs += Math.max(...times) - Math.min(...times);
    }
  });

  const avgAnswerMs = deltaCount > 0 ? deltaSumMs / deltaCount : null;

  const ranked = ARENA_TOPICS.map((topic) => ({
    topic,
    total: topicTotal[topic] ?? 0,
    rate:
      (topicTotal[topic] ?? 0) > 0
        ? (topicCorrect[topic] ?? 0) / (topicTotal[topic] as number)
        : 0,
  }))
    .filter((t) => t.total >= MIN_TOPIC_SAMPLE)
    .sort((a, b) => b.rate - a.rate);

  const mostComfortableTopic = ranked.length >= 1 ? ranked[0].topic : null;
  // Only rank a "least comfortable" once there are at least two qualifying
  // topics to compare; otherwise it's not a meaningful comparison.
  const leastComfortableTopic =
    ranked.length >= 2 ? ranked[ranked.length - 1].topic : null;

  const damagePerSecond =
    totalDurationMs > 0 ? totalDamage / (totalDurationMs / 1000) : null;

  return {
    totalDuels: roleById.size,
    avgAnswerMs,
    mostComfortableTopic,
    leastComfortableTopic,
    damagePerSecond,
  };
}

const TOPIC_LABELS: Record<ArenaTopic, string> = {
  equations: "Equations",
  graphing: "Graphing lines",
  quadratics: "Quadratics",
};

/** Human-friendly label for a topic. */
export function topicLabel(topic: ArenaTopic): string {
  return TOPIC_LABELS[topic];
}
