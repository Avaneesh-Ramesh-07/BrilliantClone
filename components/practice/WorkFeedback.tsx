"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeFeedback } from "@/lib/practice/sanitizeFeedback";
import type {
  FeedbackRequest,
  FeedbackResponse,
  PracticeProblemContext,
} from "@/types/practice";

/**
 * Downscale + compress an image file entirely client-side: draw it to a canvas,
 * scale the longest side to `maxSide` px, and export as a JPEG data URL. Keeps
 * the upload small/fast for the AI feedback round-trip.
 */
function downscaleImage(
  file: File,
  maxSide: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const longest = Math.max(img.width, img.height) || 1;
      const scale = Math.min(1, maxSide / longest);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unsupported"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/**
 * Shared "upload a photo of your work" feedback affordance. Lets the learner
 * upload a photo of their handwritten work and get specific, AI-generated tutor
 * feedback (OpenAI multimodal) grounded in the verified solution. Both endless
 * practice and the practice-test runner reuse it; each passes a
 * {@link PracticeProblemContext} describing what was being solved, and remounts
 * it (via a React `key`) per question so all of its state resets.
 */
export function WorkFeedback({ context }: { context: PracticeProblemContext }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const requestFeedback = useCallback(
    async (dataUrl: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), 22000);
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await fetch("/api/sandbox/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            image: dataUrl,
            mimeType: "image/jpeg",
            problem: context,
          } satisfies FeedbackRequest),
          signal: controller.signal,
        });
        const data = (await res.json()) as FeedbackResponse;
        if (data.feedback) setResult(data);
        else setError(data.error ?? "Couldn't analyze that image. Try again.");
      } catch {
        setError("Couldn't analyze that image. Try again.");
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    },
    [context]
  );

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Allow re-selecting the same file later.
      e.target.value = "";
      if (!file) return;
      setError(null);
      setResult(null);
      try {
        const dataUrl = await downscaleImage(file, 1024, 0.7);
        setPreview(dataUrl);
        await requestFeedback(dataUrl);
      } catch {
        setError("Couldn't read that image. Try again.");
      }
    },
    [requestFeedback]
  );

  return (
    <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex items-start gap-2">
        <SparkIcon />
        <div>
          <p className="text-body font-medium text-violet-800">
            Stuck? Upload a photo of your work for AI feedback
          </p>
          <p className="mt-0.5 text-label text-violet-700/80">
            A tutor will look at your handwritten steps and point out where to
            focus.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-lg border border-violet-300 bg-white px-4 text-label font-medium text-violet-700 transition-colors hover:bg-violet-100">
          {preview ? "Upload a different photo" : "Choose photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFile}
            disabled={loading}
          />
        </label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Your uploaded work"
            className="h-16 w-16 rounded-lg border border-violet-200 object-cover"
          />
        )}
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-body text-violet-700">
          <Spinner />
          Analyzing your work…
        </div>
      )}

      {result?.feedback && !loading && (
        <div className="mt-3 space-y-3">
          {result.readBack && (
            <div className="rounded-lg border border-violet-200 bg-white p-4">
              <p className="text-label font-semibold text-violet-800">
                Here&apos;s what we read from your photo
              </p>
              <p className="mt-1 whitespace-pre-line font-equation text-body text-text">
                {result.readBack}
              </p>
              {result.studentAnswer && (
                <p className="mt-2 text-label text-muted">
                  Your answer, as we read it:{" "}
                  <span className="font-medium text-text">
                    {result.studentAnswer}
                  </span>
                </p>
              )}
              {result.correctAnswer && (
                <p className="mt-1 text-label text-muted">
                  Verified correct answer:{" "}
                  <span className="font-medium text-success">
                    {result.correctAnswer}
                  </span>
                </p>
              )}
              <p className="mt-2 text-label text-violet-700/70">
                If that&apos;s not what you wrote, retake the photo so the
                feedback matches your actual work.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-violet-200 bg-white p-4">
            <FeedbackText text={result.feedback} />
            {result.grounded === false && (
              <p className="mt-2 text-label text-muted">
                We double-checked this against the verified solution and
                corrected the guidance to match.
              </p>
            )}
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="mt-3 rounded-lg border border-error/40 bg-error/5 p-3">
          <p className="text-body text-error">{error}</p>
          {preview && (
            <button
              type="button"
              onClick={() => requestFeedback(preview)}
              className="mt-2 inline-flex min-h-[36px] items-center rounded-lg border border-border bg-surface px-3 text-label font-medium text-text transition-colors hover:border-primary"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders sanitized AI feedback as a tidy report: one paragraph per line, with
 * any "Label: rest" line showing the label in a stronger weight. The raw string
 * is run through `sanitizeFeedback` first so stray markdown/LaTeX never shows.
 */
function FeedbackText({ text }: { text: string }) {
  const clean = sanitizeFeedback(text);
  const lines = clean.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        // Match a short leading label like "Where it went wrong:".
        const match = /^([^:]{1,40}):\s*(.*)$/.exec(line.trim());
        if (match && match[2]) {
          return (
            <p key={i} className="text-body text-text">
              <span className="font-medium">{match[1]}:</span> {match[2]}
            </p>
          );
        }
        return (
          <p key={i} className="text-body text-text">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4 animate-spin text-primary"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M12 3v4M12 17v4M5 12H1M23 12h-4M6.3 6.3 3.5 3.5M20.5 20.5l-2.8-2.8M17.7 6.3l2.8-2.8M3.5 20.5l2.8-2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
