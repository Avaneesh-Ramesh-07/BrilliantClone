import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { FeedbackRequest, FeedbackResponse } from "@/types/practice";
import { SANDBOX_MODEL, buildFeedbackPrompt } from "@/lib/ai/sandbox";
import { sanitizeFeedback } from "@/lib/practice/sanitizeFeedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE: FeedbackResponse = {
  feedback: null,
  error: "AI feedback is unavailable right now.",
};

const ERRORED: FeedbackResponse = {
  feedback: null,
  error: "Couldn't analyze that image — try again.",
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

  try {
    const { base64, mediaType } = parseImage(image, mimeType);

    const { text } = await generateText({
      model: openai(SANDBOX_MODEL),
      // Image analysis is slower and user-initiated (not the hot path), so a
      // longer timeout is fine — but still fail fast to a graceful error.
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

    const feedback = sanitizeFeedback(text);
    if (!feedback) return NextResponse.json(ERRORED);
    return NextResponse.json({ feedback, error: null });
  } catch (err) {
    // Surface the real cause in the server logs; keep the user-facing message
    // friendly. A 429 means the OpenAI API key is out of quota (e.g. the
    // account has no remaining credits) — call that out specifically.
    console.error("[sandbox/feedback] generateText failed:", err);
    const status = (err as { statusCode?: number } | null)?.statusCode;
    const error =
      status === 429
        ? "The AI is over its current quota — try again shortly. If it keeps happening, the OpenAI API key's plan or billing needs attention."
        : ERRORED.error;
    return NextResponse.json({ feedback: null, error });
  }
}
