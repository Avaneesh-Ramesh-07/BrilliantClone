import Link from "next/link";
import { redirect } from "next/navigation";
import { getDuelHistory, topicLabel } from "@/lib/arena/history";
import type { DuelResult, DuelSummary } from "@/lib/arena/history";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const RESULT_STYLES: Record<DuelResult, { label: string; className: string }> = {
  win: { label: "Win", className: "bg-success/15 text-success" },
  loss: { label: "Loss", className: "bg-error/15 text-error" },
  draw: { label: "Draw", className: "bg-border text-muted" },
};

function ResultBadge({ result }: { result: DuelResult }) {
  const { label, className } = RESULT_STYLES[result];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-label text-muted">{label}</p>
      <p className="mt-1 text-heading-md font-semibold text-text">{value}</p>
    </div>
  );
}

function DuelRow({ duel }: { duel: DuelSummary }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ResultBadge result={duel.result} />
          <p className="truncate text-body font-medium text-text">
            vs {duel.opponentName}
          </p>
        </div>
        <p className="mt-1 text-label text-muted">{formatDate(duel.date)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-body font-semibold text-text">
          ❤️ {Math.max(0, duel.yourHp)}{" "}
          <span className="text-muted">·</span>{" "}
          {Math.max(0, duel.opponentHp)} ❤️
        </p>
        <p className="text-label text-muted">You · Opponent</p>
      </div>
    </li>
  );
}

export default async function DuelHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { duels, stats } = await getDuelHistory(supabase, user.id);

  const avgAnswer =
    stats.avgAnswerMs != null
      ? `${(stats.avgAnswerMs / 1000).toFixed(1)}s`
      : "-";
  const mostComfortable = stats.mostComfortableTopic
    ? topicLabel(stats.mostComfortableTopic)
    : "Not enough data";
  const leastComfortable = stats.leastComfortableTopic
    ? topicLabel(stats.leastComfortableTopic)
    : "Not enough data";
  const dps =
    stats.damagePerSecond != null
      ? `${stats.damagePerSecond.toFixed(2)} HP/s`
      : "-";

  return (
    <main className="py-8">
      <header className="mb-6">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-label text-muted transition-colors hover:text-text"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to home
        </Link>
        <h1 className="mt-3 font-heading text-heading-lg text-text">
          Duel history
        </h1>
        <p className="mt-1 text-body text-muted">
          Your past head-to-head battles and how you&apos;ve been performing.
        </p>
      </header>

      {duels.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
          <p className="text-body text-text">No duels yet</p>
          <p className="mt-1 text-label text-muted">
            Battle someone in the Arena and your match history and stats will
            show up here.
          </p>
          <Link
            href="/arena"
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-red-600 px-5 font-semibold text-white active:scale-95"
          >
            ⚔️ Go to the Arena
          </Link>
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-label text-muted">Your stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Avg. time to answer" value={avgAnswer} />
              <StatCard label="Damage per second" value={dps} />
              <StatCard label="Most comfortable" value={mostComfortable} />
              <StatCard label="Least comfortable" value={leastComfortable} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-label text-muted">
              {duels.length} {duels.length === 1 ? "duel" : "duels"}
            </h2>
            <ul className="flex flex-col gap-3">
              {duels.map((duel) => (
                <DuelRow key={duel.id} duel={duel} />
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
