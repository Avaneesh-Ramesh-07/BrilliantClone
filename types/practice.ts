/**
 * Types for the endless Practice / Sandbox mode. These questions are generated
 * procedurally (see lib/practice/generators.ts) and are intentionally a
 * DIFFERENT format than the lesson questions: spot-the-mistake, order-the-steps,
 * and odd-one-out. Nothing here is persisted — the sandbox is session-only.
 */

export type PracticeTopic = "equations" | "graphing" | "quadratics";

export const PRACTICE_TOPICS: PracticeTopic[] = [
  "equations",
  "graphing",
  "quadratics",
];

export const TOPIC_LABELS: Record<PracticeTopic, string> = {
  equations: "Linear Equations",
  graphing: "Graphing Lines",
  quadratics: "Quadratics",
};

/**
 * Maps a lesson id to the practice topic it unlocks. The sandbox only generates
 * questions for topics whose lesson has been completed at least once.
 */
export const LESSON_TOPIC: Record<string, PracticeTopic> = {
  "lesson-equations": "equations",
  "lesson-graphing-lines": "graphing",
  "lesson-quadratics": "quadratics",
};

/**
 * Adaptive difficulty band for a generated question. Driven by the AI coach
 * (with a deterministic fallback): harder = multi-step, bigger numbers, trickier
 * distractors; easier = single-step, smaller numbers, clearer choices.
 */
export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easier",
  medium: "Medium",
  hard: "Harder",
};

/**
 * A learner's comfort with a topic, derived from how their completed lesson
 * compares to the lesson's expected time (see lib/comfort.ts). Declared here so
 * both `lib/comfort.ts` and the sandbox contracts share one canonical union
 * without a circular import.
 */
export type ComfortLevel =
  | "not-started"
  | "needs-practice"
  | "developing"
  | "comfortable"
  | "very-comfortable";

export type PracticeQuestionType =
  | "find-mistake"
  | "order-steps"
  | "odd-one-out";

export const QUESTION_TYPE_LABELS: Record<PracticeQuestionType, string> = {
  "find-mistake": "Spot the mistake",
  "order-steps": "Order the steps",
  "odd-one-out": "Odd one out",
};

interface PracticeBase {
  /** Unique per generated instance (used as a React remount key). */
  id: string;
  topic: PracticeTopic;
  type: PracticeQuestionType;
  /** Difficulty band this instance was generated at. */
  difficulty: Difficulty;
  /** Expected solve time (ms) for this question, used for the time-ratio metric. */
  expectedMs: number;
  /** Instruction shown to the learner. */
  prompt: string;
  /** Shown after the learner answers, explaining the correct answer. */
  explanation: string;
  /** Whether the AI produced this question, or the local generator did. */
  source?: "ai" | "heuristic";
}

/**
 * Spot-the-mistake: a worked solution is shown line by line. The learner picks
 * the first incorrect step, or declares the work correct. `mistakeIndex` is the
 * index into `steps` of the first wrong line, or null when the work is correct.
 */
export interface FindMistakeQuestion extends PracticeBase {
  type: "find-mistake";
  /** The problem being solved, e.g. "Solve: 2x + 3 = 11". */
  problemLabel: string;
  /** Worked solution lines, e.g. ["2x = 11 − 3", "2x = 8", "x = 4"]. */
  steps: string[];
  /** Index of the first wrong step, or null if the work has no mistake. */
  mistakeIndex: number | null;
}

/**
 * Order-the-steps: the learner arranges shuffled solution steps into the correct
 * sequence. `steps` is given in the CORRECT order; the component shuffles them
 * for display and compares the learner's ordering against this array.
 */
export interface OrderStepsQuestion extends PracticeBase {
  type: "order-steps";
  /** The problem being solved/graphed, e.g. "Solve: 3x − 5 = 7". */
  problemLabel: string;
  /** Steps in the correct order. */
  steps: string[];
}

export interface OddOneOutOption {
  id: string;
  text: string;
}

/**
 * Odd-one-out: four options are shown; three share a property and one does not.
 * `oddId` is the option that doesn't belong.
 */
export interface OddOneOutQuestion extends PracticeBase {
  type: "odd-one-out";
  options: OddOneOutOption[];
  oddId: string;
}

export type PracticeQuestion =
  | FindMistakeQuestion
  | OrderStepsQuestion
  | OddOneOutQuestion;

// ===========================================================================
// Adaptive skill tracking + AI contracts (session-only)
// ===========================================================================

/** A single answered question's outcome, used to estimate topic skill. */
export interface PracticeAttempt {
  correct: boolean;
  /** Actual solve time in ms. */
  timeMs: number;
  /** Expected solve time in ms for the question that was shown. */
  expectedMs: number;
  difficulty: Difficulty;
}

/**
 * A compact, recency-aware summary of how a learner is doing in one topic.
 * Produced on the client and sent to the AI coach / summary endpoints, so the
 * model has everything it needs to reason about difficulty and urgency.
 */
export interface TopicPerformance {
  topic: PracticeTopic;
  attempts: number;
  correct: number;
  /** Recency-weighted success rate, 0..1. */
  successRate: number;
  /** Recency-weighted mean of (actualTime / expectedTime); ~1 = on pace. */
  avgTimeRatio: number;
  /** Chronological correctness of recent attempts (oldest → newest). */
  recentResults: boolean[];
  /** The difficulty currently being served for this topic. */
  currentDifficulty: Difficulty;
  /** Heuristic proficiency estimate, 0..1 (fallback signal for the model). */
  proficiency: number;
}

// --- /api/sandbox/coach ----------------------------------------------------

export interface CoachRequest {
  topics: TopicPerformance[];
}

export interface TopicDifficulty {
  topic: PracticeTopic;
  difficulty: Difficulty;
  /** Short, learner-facing reason for the chosen difficulty. */
  rationale: string;
}

export interface CoachResponse {
  perTopic: TopicDifficulty[];
  /** Whether the AI produced this, or the deterministic fallback did. */
  source: "ai" | "fallback";
}

// --- /api/sandbox/summary --------------------------------------------------

export interface SummaryRequest {
  topics: TopicPerformance[];
  longestStreak: number;
  totalAnswered: number;
}

export type TopicTrend = "improving" | "steady" | "declining" | "n/a";

export interface TopicRecommendation {
  topic: PracticeTopic;
  /** 0..100; weaker/again-and-again-struggling topics score higher. */
  urgency: number;
  trend: TopicTrend;
  /** 1–2 sentence, nuance-aware recommendation. */
  recommendation: string;
}

export interface SummaryResponse {
  overallMessage: string;
  /** Ordered by suggested review order (most important first). */
  recommendations: TopicRecommendation[];
  source: "ai" | "fallback";
}

// --- /api/sandbox/feedback -------------------------------------------------

/**
 * A small, serializable description of a sandbox question, sent to the AI photo
 * feedback route so the tutor model knows what the student was solving and what
 * the correct reasoning is. Type-specific fields are optional.
 */
export interface PracticeProblemContext {
  topicLabel: string;
  typeLabel: string;
  /** The instruction shown to the learner. */
  prompt: string;
  /** find-mistake / order-steps: the problem being solved. */
  problemLabel?: string;
  /** find-mistake: worked steps shown; order-steps: steps in CORRECT order. */
  steps?: string[];
  /** find-mistake: index of the first wrong step, or null if it's all correct. */
  mistakeIndex?: number | null;
  /** odd-one-out: the four option texts. */
  options?: string[];
  /** odd-one-out: the text of the correct (odd-one-out) option. */
  oddAnswer?: string;
  /** The correct-answer explanation. */
  explanation: string;
}

export interface FeedbackRequest {
  /** Base64 data URL of the (downscaled) photo of the student's work. */
  image: string;
  mimeType: string;
  problem: PracticeProblemContext;
}

export interface FeedbackResponse {
  /** The tutor feedback, or null when unavailable / on error. */
  feedback: string | null;
  /** A user-facing error message when feedback is null, else null. */
  error: string | null;
}
