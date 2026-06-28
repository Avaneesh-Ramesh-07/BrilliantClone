import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { FeedbackRequest, FeedbackResponse } from "@/types/practice";
import {
  SANDBOX_MODEL,
  buildFeedbackPrompt,
  feedbackSchema,
} from "@/lib/ai/sandbox";
import { sanitizeFeedback } from "@/lib/practice/sanitizeFeedback";
import {
  computeGroundTruth,
  contradictsGroundTruth,
  safeGroundedFeedback,
} from "@/lib/practice/groundTruth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE: FeedbackResponse = {
  feedback: null,
  error: "AI feedback is unavailable right now.",
};

const ERRORED: FeedbackResponse = {
  feedback: null,
  error: "Couldn't analyze that image. Try again.",
};

/** Split a base64 data URL into its raw base64 payload + media type. */
function parseImage(
  image: string,
  fallbackMime: string
): { base64: string; mediaType: string } {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(image);
  if (match) return { mediaType: match[1], base64: match[2] };
  return { mediaType: fallbackMime || "image/jpeg", base64: image };
}

export async function POST(
  request: Request
): Promise<NextResponse<FeedbackResponse>> {
  const body = (await request.json()) as FeedbackRequest;
  const { image, mimeType, problem } = body ?? {};

  if (!process.env.OPENAI_API_KEY || !image || !problem) {
    return NextResponse.json(UNAVAILABLE);
  }

  // Compute the correct solution DETERMINISTICALLY first, server-side. This is
  // the ground truth the model is told to compare the photo against, and the
  // yardstick we use to reject contradicting feedback below.
  const groundTruth = computeGroundTruth(problem);

  try {
    const { base64, mediaType } = parseImage(image, mimeType);

    const { object } = await generateObject({
      model: openai(SANDBOX_MODEL),
      schema: feedbackSchema,
      // Image analysis is slower and user-initiated (not the hot path), so a
      // longer timeout is fine, but still fail fast to a graceful error.
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20000),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildFeedbackPrompt(problem) },
            { type: "file", data: base64, mediaType },
          ],
        },
      ],
    });

    const readBack = object.readBack?.trim() ? object.readBack.trim() : null;
    const studentAnswer = object.studentAnswer?.trim()
      ? object.studentAnswer.trim()
      : null;

    // VALIDATION: if the model's stated correct answer disagrees with our
    // deterministic answer, suppress its (misleading) feedback and fall back to
    // a safe, corrected message built from the verified solution. Otherwise the
    // model's feedback is grounded - sanitize and show it.
    const contradicts = contradictsGroundTruth(groundTruth, object.correctAnswer);
    const grounded = !contradicts;

    const rawFeedback = contradicts
      ? safeGroundedFeedback(groundTruth)
      : object.feedback;
    const feedback = sanitizeFeedback(rawFeedback);
    if (!feedback) return NextResponse.json(ERRORED);

    return NextResponse.json({
      feedback,
      error: null,
      readBack,
      studentAnswer,
      correctAnswer: groundTruth.answer,
      workedSteps: groundTruth.workedSteps.length > 0 ? groundTruth.workedSteps : null,
      grounded,
    });
  } catch (err) {
    // Surface the real cause in the server logs; keep the user-facing message
    // friendly. A 429 means the OpenAI API key is out of quota (e.g. the
    // account has no remaining credits), call that out specifically.
    console.error("[sandbox/feedback] generateObject failed:", err);
    const status = (err as { statusCode?: number } | null)?.statusCode;
    const error =
      status === 429
        ? "The AI is over its current quota. Try again shortly. If it keeps happening, the OpenAI API key's plan or billing needs attention."
        : ERRORED.error;
    return NextResponse.json({ feedback: null, error });
  }
}
