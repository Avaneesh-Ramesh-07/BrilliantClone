"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FindMistakeQuestion } from "@/components/practice/FindMistakeQuestion";
import { OrderStepsQuestion } from "@/components/practice/OrderStepsQuestion";
import { OddOneOutQuestion } from "@/components/practice/OddOneOutQuestion";
import { PracticeSummary } from "@/components/practice/PracticeSummary";
import { WorkUpload } from "@/components/practice/WorkUpload";
import { firstQuestion, nextQuestion, RecentEntry } from "@/lib/practice/generators";
import {
  fallbackCoach,
  heuristicDifficulty,
  summarizeTopic,
} from "@/lib/practice/skill";
import { serializeProblem } from "@/lib/practice/context";
import { hintForQuestion } from "@/lib/practice/hints";
import {
  ComfortLevel,
  Difficulty,
  DIFFICULTY_LABELS,
  PracticeAttempt,
  PracticeQuestion,
  PracticeTopic,
  QUESTION_TYPE_LABELS,
  SummaryRequest,
  TOPIC_LABELS,
  TopicPerformance,
} from "@/types/practice";

interface Stats {
  answered: number;
  correct: number;
  streak: number;
  best: number;
}

const INITIAL_STATS: Stats = { answered: 0, correct: 0, streak: 0, best: 0 };

type DiffMap = Partial<Record<PracticeTopic, Difficulty>>;
type RationaleMap = Partial<Record<PracticeTopic, string>>;
type AttemptMap = Partial<Record<PracticeTopic, PracticeAttempt[]>>;
type TopicComfortMap = Partial<
  Record<PracticeTopic, { level: ComfortLevel; score: number }>
>;

/** Comfort level → the difficulty band a topic STARTS at in the session. */
const COMFORT_DIFFICULTY: Record<ComfortLevel, Difficulty> = {
  "not-started": "medium",
  "needs-practice": "easy",
  developing: "easy",
  comfortable: "medium",
  "very-comfortable": "hard",
};

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Recent history (prior recent + the just-shown question), capped at 6. */
function projectedRecent(
  recent: RecentEntry[],
  q: PracticeQuestion
): RecentEntry[] {
  return [...recent, { topic: q.topic, type: q.type }].slice(-6);
}

interface PracticeSessionProps {
  /** Topics unlocked by completing the matching lesson at least once. */
  allowedTopics: PracticeTopic[];
  /** Per-topic comfort from the lessons; seeds each topic's starting difficulty. */
  topicComfort?: TopicComfortMap;
}

export function PracticeSession({
  allowedTopics,
  topicComfort,
}: PracticeSessionProps) {
  const router = useRouter();
  const [question, setQuestion] = useState<PracticeQuestion | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [answered, setAnswered] = useState(false);
  // Whether the last answer was correct (null until the current question is
  // answered). Drives the "upload a photo of your work" feedback affordance.
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  // Consecutive-wrong gating, mirroring the lesson UX (see StepPlayer):
  //   1st wrong attempt → show ONLY a hint, never the answer.
  //   2nd consecutive wrong attempt → reveal/highlight the correct answer.
  // Reset on a correct answer or when moving to a new question. `reveal` drives
  // the child question components; `hintShown` shows the conceptual nudge.
  const [reveal, setReveal] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  // Wrong-attempt counter for the CURRENT question, in a ref so the child's
  // synchronous onAnswer callback always reads the latest value.
  const attemptCountRef = useRef(0);
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [phase, setPhase] = useState<"playing" | "summary">("playing");

  // Difficulty per topic (drives generation). Mirrored in a ref so async coach
  // callbacks and the generator always read the latest value.
  const [difficulty, setDifficulty] = useState<DiffMap>({});
  const difficultyRef = useRef<DiffMap>({});
  const [rationale, setRationale] = useState<RationaleMap>({});
  const rationaleRef = useRef<RationaleMap>({});

  // Raw attempt log (per topic). Kept in a ref, needed for metrics, not render.
  const attemptsRef = useRef<AttemptMap>({});
  const questionStartRef = useRef(0);

  const startedRef = useRef(false);

  const hasTopics = allowedTopics.length > 0;

  const applyDifficulty = useCallback((next: DiffMap) => {
    difficultyRef.current = next;
    setDifficulty(next);
  }, []);

  const applyRationale = useCallback((next: RationaleMap) => {
    rationaleRef.current = next;
    setRationale(next);
  }, []);

  const buildPerformance = useCallback((): TopicPerformance[] => {
    const out: TopicPerformance[] = [];
    for (const topic of allowedTopics) {
      const attempts = attemptsRef.current[topic] ?? [];
      if (attempts.length === 0) continue;
      out.push(
        summarizeTopic(topic, attempts, difficultyRef.current[topic] ?? "medium")
      );
    }
    return out;
  }, [allowedTopics]);

  // Load the next question INSTANTLY from the local/heuristic generators (no
  // network, no spinner). Interleaving + per-topic difficulty are handled by
  // nextQuestion via the latest difficulty map.
  const loadNext = useCallback(
    (history: RecentEntry[]) => {
      setQuestion(nextQuestion(history, allowedTopics, difficultyRef.current));
      setAnswered(false);
      setLastCorrect(null);
      setReveal(false);
      setHintShown(false);
      attemptCountRef.current = 0;
      questionStartRef.current = nowMs();
    },
    [allowedTopics]
  );

  // First question loads on the client only, the generators use Math.random,
  // which would otherwise cause a server/client hydration mismatch. We also seed
  // each topic's starting difficulty from its lesson comfort here.
  useEffect(() => {
    if (!hasTopics || startedRef.current) return;
    startedRef.current = true;

    const seed: DiffMap = {};
    for (const t of allowedTopics) {
      const level = topicComfort?.[t]?.level;
      seed[t] = level ? COMFORT_DIFFICULTY[level] : "medium";
    }
    applyDifficulty(seed);

    // The very first problem is deterministic (same every time); subsequent
    // questions use the randomized generator via loadNext.
    setQuestion(firstQuestion(allowedTopics));
    setAnswered(false);
    setLastCorrect(null);
    setReveal(false);
    setHintShown(false);
    attemptCountRef.current = 0;
    questionStartRef.current = nowMs();
  }, [hasTopics, allowedTopics, topicComfort, applyDifficulty]);

  // Finalize the current question: record the outcome, update stats/difficulty,
  // and reveal the answer. Called once per question, when it reaches a terminal
  // state (a correct answer, or a second consecutive miss). `correct` reflects
  // first-attempt knowledge: a second-try success still records the first miss.
  const finalize = useCallback(
    (correct: boolean) => {
      if (!question) return;
      setAnswered(true);
      setLastCorrect(correct);
      setReveal(true);

      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const timeMs = Math.max(0, now - questionStartRef.current);
      const topic = question.topic;
      const list = attemptsRef.current[topic] ?? [];
      list.push({
        correct,
        timeMs,
        expectedMs: question.expectedMs,
        difficulty: question.difficulty,
      });
      attemptsRef.current[topic] = list;

      // Deterministic difficulty adjustment from the local heuristic (success
      // rate + solve-time ratio). No AI/network is involved.
      const current = difficultyRef.current[topic] ?? "medium";
      const perf = summarizeTopic(topic, list, current);
      const hd = heuristicDifficulty(perf);
      if (hd !== difficultyRef.current[topic]) {
        applyDifficulty({ ...difficultyRef.current, [topic]: hd });
      }

      // Matching learner-facing rationale, also computed locally (no AI).
      const rationale = fallbackCoach({ topics: [perf] }).perTopic[0]?.rationale;
      if (rationale) {
        applyRationale({ ...rationaleRef.current, [topic]: rationale });
      }

      setStats((s) => {
        const streak = correct ? s.streak + 1 : 0;
        return {
          answered: s.answered + 1,
          correct: s.correct + (correct ? 1 : 0),
          streak,
          best: Math.max(s.best, streak),
        };
      });
    },
    [question, applyDifficulty, applyRationale]
  );

  // Called by the question component on EVERY check. Implements the gating:
  //   - correct (any attempt): finalize as correct, reveal.
  //   - 1st wrong attempt: show ONLY the hint; keep the question open for a retry.
  //   - 2nd consecutive wrong attempt: finalize as a miss and reveal the answer.
  const handleCheck = useCallback(
    (correct: boolean) => {
      if (!question || answered) return;
      const attempt = attemptCountRef.current + 1;

      if (correct) {
        finalize(true);
        return;
      }

      attemptCountRef.current = attempt;
      if (attempt >= 2) {
        finalize(false);
      } else {
        // First miss: reveal the hint only and let them try again.
        setHintShown(true);
      }
    },
    [question, answered, finalize]
  );

  const handleNext = useCallback(() => {
    if (!question) return;
    const updated = projectedRecent(recent, question);
    setRecent(updated);
    loadNext(updated);
  }, [question, recent, loadNext]);

  const handleExit = useCallback(() => {
    if (stats.answered === 0) {
      router.push("/home");
      return;
    }
    setPhase("summary");
  }, [stats.answered, router]);

  if (phase === "summary") {
    const request: SummaryRequest = {
      topics: buildPerformance(),
      longestStreak: stats.best,
      totalAnswered: stats.answered,
    };
    return (
      <main className="py-8">
        <PracticeSummary request={request} onDone={() => router.push("/home")} />
      </main>
    );
  }

  const activeDifficulty: Difficulty | undefined = question
    ? difficulty[question.topic] ?? question.difficulty
    : undefined;
  const activeRationale = question ? rationale[question.topic] : undefined;

  return (
    <main className="py-8">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-label text-muted">Endless practice</p>
            <h1 className="font-heading text-heading-lg text-text">
              Endless Practice
            </h1>
          </div>
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex min-h-[36px] items-center rounded-lg border border-border bg-surface px-3 text-label text-muted transition-colors hover:text-text"
          >
            {stats.answered > 0 ? "Exit & review" : "Exit"}
          </button>
        </div>
        <p className="mt-2 text-body text-muted">
          {hasTopics
            ? "Endless mixed practice that adapts to you. Difficulty shifts with your pace and accuracy. Nothing here is graded."
            : "Practice draws on lessons you've finished."}
        </p>
      </header>

      {!hasTopics ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
          <p className="text-body font-medium text-text">
            No topics unlocked yet
          </p>
          <p className="mt-2 text-body text-muted">
            Finish a lesson at least once and its topic will show up here for
            endless mixed practice.
          </p>
          <Link
            href="/home"
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-4 text-body font-medium text-white transition-opacity hover:opacity-90"
          >
            Go to lessons
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatCard label="Answered" value={stats.answered} />
            <StatCard
              label="Accuracy"
              value={
                stats.answered === 0
                  ? "-"
                  : `${Math.round((stats.correct / stats.answered) * 100)}%`
              }
            />
            <StatCard
              label="Streak"
              value={stats.streak}
              hint={stats.best > 0 ? `best ${stats.best}` : undefined}
            />
          </div>

          {question ? (
            <section>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge>{TOPIC_LABELS[question.topic]}</Badge>
                <Badge muted>{QUESTION_TYPE_LABELS[question.type]}</Badge>
                {activeDifficulty && (
                  <DifficultyBadge difficulty={activeDifficulty} />
                )}
              </div>
              {activeRationale && (
                <p className="mb-3 flex items-center gap-1.5 text-label text-muted">
                  <GaugeIcon />
                  {activeRationale}
                </p>
              )}

              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <QuestionView
                  key={question.id}
                  question={question}
                  onAnswer={handleCheck}
                  disabled={answered}
                  reveal={reveal}
                />
              </div>

              {hintShown && !reveal && (
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                    aria-hidden
                  >
                    <path
                      d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.6.45 1 1.15 1.1 1.95h5c.1-.8.5-1.5 1.1-1.95A6 6 0 0012 3z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <p className="text-label font-semibold text-amber-700">Hint</p>
                    <p className="text-body text-amber-700/90">
                      {hintForQuestion(question)}
                    </p>
                  </div>
                </div>
              )}

              {answered && lastCorrect === false && (
                <WorkUpload
                  key={question.id}
                  context={serializeProblem(question)}
                />
              )}

              {answered && (
                <div className="mt-5">
                  <Button onClick={handleNext} fullWidth>
                    Next question
                  </Button>
                </div>
              )}
            </section>
          ) : (
            <p className="text-body text-muted">Loading your first question…</p>
          )}
        </>
      )}
    </main>
  );
}

function QuestionView({
  question,
  onAnswer,
  disabled,
  reveal,
}: {
  question: PracticeQuestion;
  onAnswer: (correct: boolean) => void;
  disabled: boolean;
  reveal: boolean;
}) {
  switch (question.type) {
    case "find-mistake":
      return (
        <FindMistakeQuestion
          question={question}
          onAnswer={onAnswer}
          disabled={disabled}
          reveal={reveal}
        />
      );
    case "order-steps":
      return (
        <OrderStepsQuestion
          question={question}
          onAnswer={onAnswer}
          disabled={disabled}
          reveal={reveal}
        />
      );
    case "odd-one-out":
      return (
        <OddOneOutQuestion
          question={question}
          onAnswer={onAnswer}
          disabled={disabled}
          reveal={reveal}
        />
      );
    default:
      return null;
  }
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center shadow-sm">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 font-heading text-heading-md text-text">{value}</p>
      {hint && <p className="text-label text-muted">{hint}</p>}
    </div>
  );
}

function Badge({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-label ${
        muted
          ? "border-border bg-surface text-muted"
          : "border-primary/30 bg-primary-light text-primary"
      }`}
    >
      {children}
    </span>
  );
}

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  easy: "border-success/30 bg-success/10 text-success",
  medium: "border-amber-300 bg-amber-50 text-amber-700",
  hard: "border-error/30 bg-error/10 text-error",
};

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-label font-medium ${DIFFICULTY_STYLES[difficulty]}`}
      title="Adapts to your recent pace and accuracy"
    >
      <GaugeIcon />
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

function GaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M12 13a2 2 0 1 0 2 2M12 13l4-4M4 18a8 8 0 1 1 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

