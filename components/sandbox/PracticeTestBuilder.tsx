"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { EligibleConcept } from "@/lib/practice-test/eligibility";

const LOADING_WORDS = [
  "Assembling…",
  "Sharpening…",
  "Calibrating…",
  "Composing…",
  "Stress-testing…",
  "Polishing…",
];

const FAMILY_LABEL: Record<string, string> = {
  equations: "Equations",
  graphing: "Graphing",
  quadratics: "Quadratics",
};

export function PracticeTestBuilder() {
  const router = useRouter();
  const [concepts, setConcepts] = useState<EligibleConcept[] | null>(null);
  const [loadingConcepts, setLoadingConcepts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/sandbox/practice-test");
        const data = (await res.json()) as {
          concepts?: EligibleConcept[];
          error?: string;
        };
        if (!active) return;
        if (!res.ok) {
          setError(data.error ?? "Couldn't load your concepts — try again.");
          setConcepts([]);
        } else {
          setConcepts(data.concepts ?? []);
        }
      } catch {
        if (active) {
          setError("Couldn't load your concepts — try again.");
          setConcepts([]);
        }
      } finally {
        if (active) setLoadingConcepts(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => {
      setWordIndex((i) => (i + 1) % LOADING_WORDS.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [generating]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/sandbox/practice-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await res.json()) as {
        lessonId?: string;
        empty?: boolean;
        error?: string;
      };
      if (data.empty) {
        setConcepts([]);
        setGenerating(false);
        return;
      }
      if (!res.ok || !data.lessonId) {
        setError(data.error ?? "Couldn't build that practice test — try again.");
        setGenerating(false);
        return;
      }
      router.push(`/sandbox/lesson/${data.lessonId}`);
    } catch {
      setError("Couldn't reach the practice-test builder — try again.");
      setGenerating(false);
    }
  }

  const hasConcepts = (concepts?.length ?? 0) > 0;

  return (
    <main className="py-8">
      <style>{`@keyframes ptFade {from {opacity:0; transform: translateY(8px);} to {opacity:1; transform: translateY(0);}}`}</style>

      <header className="mb-6">
        <p className="text-label text-muted">Sandbox</p>
        <h1 className="font-heading text-heading-lg text-text">
          Create practice test
        </h1>
        <p className="mt-2 text-body text-muted">
          A challenging test of real-world word problems, built only from
          concepts you reviewed on an earlier day — so it tests what should be
          settling into long-term memory.
        </p>
      </header>

      {generating ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-5 rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
          <div
            className="rounded-full border-4 border-purple-200 border-t-purple-600"
            style={{ width: 40, height: 40, animation: "spin 1s linear infinite" }}
            aria-hidden
          />
          <p className="font-heading text-heading-md text-purple-700">
            {LOADING_WORDS[wordIndex]}
          </p>
          <p className="max-w-xs text-label text-muted">
            Writing challenging word problems across your reviewed concepts. This
            usually takes a few seconds.
          </p>
        </div>
      ) : loadingConcepts ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
          <div
            className="rounded-full border-4 border-purple-200 border-t-purple-600"
            style={{ width: 32, height: 32, animation: "spin 1s linear infinite" }}
            aria-hidden
          />
        </div>
      ) : !hasConcepts ? (
        <section
          className="rounded-xl border border-dashed border-border bg-surface p-6 text-center shadow-sm"
          style={{ animation: "ptFade 0.3s ease" }}
        >
          <p className="text-body text-text">
            You haven&apos;t reviewed any concepts from an earlier day yet —
            revisit a lesson and come back tomorrow.
          </p>
          {error && <p className="mt-3 text-label text-error">{error}</p>}
        </section>
      ) : (
        <section
          className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          style={{ animation: "ptFade 0.3s ease" }}
        >
          <h2 className="mb-1 text-body font-medium text-text">
            Concepts on this test
          </h2>
          <p className="mb-4 text-label text-muted">
            {concepts!.length} concept{concepts!.length === 1 ? "" : "s"} you
            last reviewed on a previous day.
          </p>
          <ul className="flex flex-wrap gap-2">
            {concepts!.map((c) => (
              <li
                key={`${c.lessonId}::${c.stepId}`}
                className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1"
              >
                <span className="text-label font-medium text-purple-800">
                  {c.conceptLabel}
                </span>
                <span className="text-label text-purple-400">
                  {FAMILY_LABEL[c.topicFamily] ?? c.topicFamily}
                </span>
              </li>
            ))}
          </ul>

          {error && (
            <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
              <p className="text-body text-error">{error}</p>
            </div>
          )}

          <div className="mt-5">
            <Button
              fullWidth
              onClick={() => void handleGenerate()}
              className="bg-purple-600 text-white hover:opacity-90"
            >
              Generate Practice Test
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
