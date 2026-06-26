/**
 * Helpers for the multimodal photo-feedback route (`/api/sandbox/feedback`) —
 * the only place in the app that calls an LLM. Adaptive difficulty and the
 * end-of-session summary are fully deterministic/heuristic (see
 * `lib/practice/skill.ts`) and do not use AI.
 */

import type { PracticeProblemContext } from "@/types/practice";

/** OpenAI model used for the multimodal photo-feedback call. */
export const SANDBOX_MODEL = "gpt-4o-mini" as const;

// --- Photo feedback -------------------------------------------------------

/** System-style instruction for the multimodal "feedback on handwritten work" call. */
export const feedbackInstruction =
  "You are a supportive, precise math tutor. A student attempted the problem " +
  "below and got it WRONG. You are given the EXACT problem they were asked to " +
  "solve, the correct reasoning, then a photo of the student's handwritten work. " +
  "Look at their actual work in the image and give constructive, SPECIFIC " +
  "feedback grounded in what you actually see; don't just restate the solution.\n\n" +
  "CHECK THE SETUP FIRST (this is the most important step):\n" +
  "Before you judge any algebra, read the FIRST line the student wrote down and " +
  "compare it carefully to the exact problem they were asked to solve. If their " +
  "starting equation or expression does NOT match the actual problem — a " +
  "miscopied number, a flipped or wrong sign, a dropped or altered term, or they " +
  "are otherwise solving a different equation — then THAT is the primary error: " +
  "they solved the wrong problem. In that case:\n" +
  "- Do NOT praise their algebra as correct, even if every later step is " +
  "internally consistent; the work does not count because it started from the " +
  "wrong equation.\n" +
  "- In 'Where it went wrong', state plainly that their first line does not match " +
  "the original problem, quoting what they wrote versus what the problem actually " +
  "is, and explain that this is why their answer is wrong.\n" +
  "- In 'Next step', tell them to recopy the original problem exactly and redo it.\n" +
  "Only if the starting line genuinely matches the actual problem should you then " +
  "look for the first algebra mistake in their steps.\n\n" +
  "FORMAT RULES (follow exactly):\n" +
  "Respond in plain, professional prose. Do NOT use markdown. No headings " +
  "(no #, ##, or ###), no bold or italic markers (no **, __, *, or _), and no " +
  "bullet characters (no leading - or *). Do NOT use LaTeX or math delimiters " +
  "(no \\(, \\), \\[, \\], or $). Write all math inline in plain text " +
  "(for example: y = mx + b, slope (m)).\n\n" +
  "Keep the feedback concise: about 4-6 short lines total. Structure it as a " +
  "few short labeled lines, each on its own line, where the label is plain " +
  "text followed by a colon. Use exactly these labels, each as a short " +
  "paragraph on its own line:\n" +
  "What you did well: ...\n" +
  "Where it went wrong: ...\n" +
  "The misconception: ...\n" +
  "Next step: ...\n" +
  "Keep 'What you did well' honest: if the setup is wrong (they started from the " +
  "wrong equation), do NOT claim their equation or setup was correct — note their " +
  "correct intent or neat work instead, briefly. " +
  "Reference the first place their work goes wrong. Avoid closing pep-talk " +
  "fluff unless it is brief.";

/** Builds the text part: the instruction followed by the serialized problem. */
export function buildFeedbackPrompt(p: PracticeProblemContext): string {
  const exactProblem = p.problemLabel ?? p.prompt;
  const lines: string[] = [
    feedbackInstruction,
    "",
    "PROBLEM CONTEXT",
    `- Topic: ${p.topicLabel}`,
    `- Activity: ${p.typeLabel}`,
    `- THE EXACT PROBLEM THE STUDENT WAS ASKED TO SOLVE (their written work MUST start from this): ${exactProblem}`,
    `- Instruction shown to the student: ${p.prompt}`,
  ];

  if (p.problemLabel) lines.push(`- Problem: ${p.problemLabel}`);

  if (p.steps && p.steps.length > 0) {
    lines.push(`- Steps shown: ${JSON.stringify(p.steps)}`);
    if (typeof p.mistakeIndex !== "undefined") {
      lines.push(
        p.mistakeIndex === null
          ? "- Correct answer: the worked solution has NO mistake."
          : `- Correct answer: the FIRST mistake is at step index ${p.mistakeIndex} (0-based) — "${p.steps[p.mistakeIndex] ?? ""}".`
      );
    } else {
      lines.push("- Correct answer: the steps above are listed in the correct order.");
    }
  }

  if (p.options && p.options.length > 0) {
    lines.push(`- Options: ${JSON.stringify(p.options)}`);
    if (p.oddAnswer) {
      lines.push(`- Correct answer (the odd one out): "${p.oddAnswer}"`);
    }
  }

  lines.push(`- Explanation of the correct reasoning: ${p.explanation}`);
  return lines.join("\n");
}
