"use client";

import { useMemo } from "react";
import { fallbackSummary } from "@/lib/practice/skill";
import {
  TOPIC_LABELS,
  type SummaryRequest,
  type TopicPerformance,
  type TopicRecommendation,
  type TopicTrend,
} from "@/types/practice";

interface PracticeSummaryProps {
  request: SummaryRequest;
  onDone: () => void;
}

export function PracticeSummary({ request, onDone }: PracticeSummaryProps) {
  // The summary is fully deterministic/heuristic now — computed locally with no
  // network call, so it renders synchronously.
  const response = useMemo(() => fallbackSummary(request), [request]);

  const practicedTopics = request.topics.filter((t) => t.attempts > 0);

  return (
    <main className="py-8">
      <header className="mb-6">
        <p className="text-label text-muted">Sandbox</p>
        <h1 className="font-heading text-heading-lg text-text">
          Session summary
        </h1>
        <p className="mt-2 text-body text-muted">{response.overallMessage}</p>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="Longest streak" value={request.longestStreak} />
        <StatCard label="Questions" value={request.totalAnswered} />
        <StatCard label="Topics practiced" value={practicedTopics.length} />
      </div>

      {practicedTopics.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-heading text-heading-md text-text">
            How each topic went
          </h2>
          <div className="space-y-3">
            {practicedTopics.map((topic) => (
              <TopicRow key={topic.topic} topic={topic} />
            ))}
          </div>
        </section>
      )}

      {response.recommendations.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-heading text-heading-md text-text">
            Suggested review order
          </h2>
          <div className="space-y-3">
            {response.recommendations.map((rec, index) => (
              <RecommendationCard
                key={rec.topic}
                rank={index + 1}
                rec={rec}
              />
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={onDone}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 text-body font-medium text-white hover:opacity-90"
      >
        Back to home
      </button>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-3 text-center shadow-sm">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 font-heading text-heading-md text-text">{value}</p>
    </div>
  );
}

function TopicRow({ topic }: { topic: TopicPerformance }) {
  const pct = Math.round(topic.successRate * 100);
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-body font-medium text-text">
          {TOPIC_LABELS[topic.topic]}
        </p>
        <p className="text-label text-muted">
          {topic.attempts} {topic.attempts === 1 ? "question" : "questions"}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 text-right text-label font-medium text-text">
          {pct}%
        </span>
      </div>
    </div>
  );
}

function RecommendationCard({
  rank,
  rec,
}: {
  rank: number;
  rec: TopicRecommendation;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-label font-medium text-primary">
          {rank}
        </span>
        <p className="text-body font-medium text-text">
          {TOPIC_LABELS[rec.topic]}
        </p>
        <UrgencyBadge urgency={rec.urgency} />
        <TrendChip trend={rec.trend} />
      </div>
      <p className="mt-3 text-body text-muted">{rec.recommendation}</p>
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: number }) {
  const tone =
    urgency >= 60
      ? "border-error/30 bg-error/10 text-error"
      : urgency >= 30
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-success/30 bg-success/10 text-success";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-label font-medium ${tone}`}
    >
      Urgency {urgency}
    </span>
  );
}

const TREND_LABELS: Record<TopicTrend, string> = {
  improving: "improving",
  steady: "steady",
  declining: "declining",
  "n/a": "n/a",
};

function TrendChip({ trend }: { trend: TopicTrend }) {
  const tone =
    trend === "improving"
      ? "border-success/30 bg-success/10 text-success"
      : trend === "declining"
        ? "border-error/30 bg-error/10 text-error"
        : "border-border bg-surface text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-label ${tone}`}
    >
      {TREND_LABELS[trend]}
    </span>
  );
}
