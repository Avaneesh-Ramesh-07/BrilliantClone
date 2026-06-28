/**
 * Per-topic skill estimation for the sandbox's adaptive difficulty.
 *
 * Pure, framework-agnostic functions imported by the client practice session.
 * Difficulty and the end-of-session summary are fully deterministic/heuristic
 * (no AI, no network). The model combines two signals the user asked for:
 *   1. success rate (recency-weighted), and
 *   2. the ratio of actual solve time to expected solve time.
 * These yield a 0..1 "proficiency" that maps to an easy/medium/hard band, which
 * drives both the live difficulty adjustment and the session summary.
 */

import type {
  CoachRequest,
  CoachResponse,
  Difficulty,
  PracticeAttempt,
  PracticeQuestionType,
  PracticeTopic,
  SummaryRequest,
  SummaryResponse,
  TopicPerformance,
  TopicRecommendation,
  TopicTrend,
} from "@/types/practice";
import { TOPIC_LABELS } from "@/types/practice";

// --- Expected solve times --------------------------------------------------

const BASE_MS: Record<PracticeQuestionType, number> = {
  "find-mistake": 28000,
  "order-steps": 32000,
  "odd-one-out": 22000,
};

const DIFFICULTY_TIME_MULT: Record<Difficulty, number> = {
  easy: 0.7,
  medium: 1,
  hard: 1.45,
};

export function expectedMsFor(
  type: PracticeQuestionType,
  difficulty: Difficulty
): number {
  return Math.round(BASE_MS[type] * DIFFICULTY_TIME_MULT[difficulty]);
}

// --- Helpers ---------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const RECENCY_DECAY = 0.8;

/** Exponential recency weights, oldest → newest (newest weighted most). */
function recencyWeights(n: number): number[] {
  const w: number[] = [];
  for (let i = 0; i < n; i++) {
    w.push(Math.pow(RECENCY_DECAY, n - 1 - i));
  }
  return w;
}

/** Time signal in 0..1 (1 = at or faster than expected, 0 = ≥2× expected). */
function timeScore(avgTimeRatio: number): number {
  if (avgTimeRatio <= 1) return 1;
  return clamp(1 - (avgTimeRatio - 1), 0, 1);
}

// --- Topic summary ---------------------------------------------------------

export function summarizeTopic(
  topic: PracticeTopic,
  attempts: PracticeAttempt[],
  currentDifficulty: Difficulty
): TopicPerformance {
  const n = attempts.length;
  if (n === 0) {
    return {
      topic,
      attempts: 0,
      correct: 0,
      successRate: 0,
      avgTimeRatio: 1,
      recentResults: [],
      currentDifficulty,
      proficiency: 0.5,
    };
  }

  const weights = recencyWeights(n);
  const wSum = weights.reduce((a, b) => a + b, 0);

  let wCorrect = 0;
  let wRatio = 0;
  let rawCorrect = 0;
  for (let i = 0; i < n; i++) {
    const a = attempts[i];
    if (a.correct) rawCorrect++;
    wCorrect += weights[i] * (a.correct ? 1 : 0);
    const ratio = clamp(a.timeMs / Math.max(a.expectedMs, 1), 0.1, 4);
    wRatio += weights[i] * ratio;
  }

  const successRate = wCorrect / wSum;
  const avgTimeRatio = wRatio / wSum;
  const proficiency = clamp(
    0.7 * successRate + 0.3 * timeScore(avgTimeRatio),
    0,
    1
  );

  return {
    topic,
    attempts: n,
    correct: rawCorrect,
    successRate,
    avgTimeRatio,
    recentResults: attempts.slice(-8).map((a) => a.correct),
    currentDifficulty,
    proficiency,
  };
}

// --- Heuristic difficulty (fallback + immediate signal) --------------------

const UP = 0.78;
const DOWN = 0.45;

export function heuristicDifficulty(perf: TopicPerformance): Difficulty {
  // Not enough evidence yet, hold the current band.
  if (perf.attempts < 2) return perf.currentDifficulty;
  const p = perf.proficiency;

  switch (perf.currentDifficulty) {
    case "easy":
      return p > 0.6 ? "medium" : "easy";
    case "hard":
      return p < 0.6 ? "medium" : "hard";
    case "medium":
    default:
      if (p >= UP) return "hard";
      if (p <= DOWN) return "easy";
      return "medium";
  }
}

// --- Trend + urgency (fallback summary) ------------------------------------

export function detectTrend(recentResults: boolean[]): TopicTrend {
  if (recentResults.length < 4) return "n/a";
  const mid = Math.floor(recentResults.length / 2);
  const first = recentResults.slice(0, mid);
  const second = recentResults.slice(mid);
  const avg = (arr: boolean[]) =>
    arr.reduce((a, b) => a + (b ? 1 : 0), 0) / arr.length;
  const delta = avg(second) - avg(first);
  if (delta > 0.2) return "improving";
  if (delta < -0.2) return "declining";
  return "steady";
}

function urgencyFor(perf: TopicPerformance, trend: TopicTrend): number {
  let urgency = (1 - perf.proficiency) * 100;
  // Someone who started rough but is climbing needs less attention than someone
  // stuck low; someone sliding backwards needs more.
  if (trend === "improving") urgency *= 0.6;
  else if (trend === "declining") urgency *= 1.15;
  return Math.round(clamp(urgency, 0, 100));
}

export function fallbackCoach(req: CoachRequest): CoachResponse {
  return {
    source: "fallback",
    perTopic: req.topics.map((perf) => {
      const difficulty = heuristicDifficulty(perf);
      const pct = Math.round(perf.successRate * 100);
      const rationale =
        difficulty === "hard"
          ? `Strong work (${pct}% recent, on a good pace). Stepping it up.`
          : difficulty === "easy"
            ? `Let's rebuild confidence with clearer, smaller problems (${pct}% recent).`
            : `Keeping it balanced while you find your footing (${pct}% recent).`;
      return { topic: perf.topic, difficulty, rationale };
    }),
  };
}

export function fallbackSummary(req: SummaryRequest): SummaryResponse {
  const recs: TopicRecommendation[] = req.topics.map((perf) => {
    const trend = detectTrend(perf.recentResults);
    const urgency = urgencyFor(perf, trend);
    const pct = Math.round(perf.successRate * 100);
    const label = TOPIC_LABELS[perf.topic];
    let recommendation: string;
    if (trend === "improving") {
      recommendation = `You started shaky but you're trending up in ${label} (${pct}% recently). Keep going to lock it in.`;
    } else if (urgency >= 60) {
      recommendation = `${label} needs attention: ${pct}% recent success. Revisit the lesson, then drill it here.`;
    } else if (urgency >= 30) {
      recommendation = `${label} is coming along (${pct}%). A little more practice will solidify it.`;
    } else {
      recommendation = `${label} looks solid (${pct}%). Light upkeep is enough.`;
    }
    return { topic: perf.topic, urgency, trend, recommendation };
  });

  recs.sort((a, b) => b.urgency - a.urgency);

  const top = recs[0];
  const overallMessage =
    recs.length === 0
      ? "Answer a few questions to get personalized recommendations."
      : top.urgency >= 50
        ? `Nice session! Your best next move is to focus on ${TOPIC_LABELS[top.topic]}.`
        : `Great session! You're in good shape across the board. Keep the streak going!`;

  return { source: "fallback", recommendations: recs, overallMessage };
}
