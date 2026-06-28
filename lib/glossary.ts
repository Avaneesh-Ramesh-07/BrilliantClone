/**
 * Beginner-friendly definitions for the math terms that show up throughout the
 * lessons. Keys are the canonical (lowercase) term; values are a single short,
 * plain-language sentence. These power the tappable glossary terms rendered by
 * {@link components/lesson/GlossaryTerm} via {@link components/lesson/MathText}.
 *
 * Keep definitions to one sentence and free of jargon, they're a quick
 * confidence boost mid-problem, not a textbook entry.
 */
export const GLOSSARY: Record<string, string> = {
  parabola: "The U-shaped curve you get when you graph a quadratic equation.",
  coefficient: "The number multiplied by a variable (the 3 in 3x).",
  "concave up": "A curve that opens upward, like a right-side-up U.",
  "concave down": "A curve that opens downward, like an upside-down U.",
  maximum: "The highest point on a graph.",
  minimum: "The lowest point on a graph.",
  vertex: "The turning point of a parabola: its lowest or highest point.",
  slope: "How steep a line is: how much y changes for each step in x.",
  "y-intercept": "Where a line or curve crosses the y-axis (where x = 0).",
  "x-intercept": "Where a line or curve crosses the x-axis (where y = 0).",
  quadratic: "An equation whose highest power of x is 2; it graphs as a parabola.",
  linear: "An equation that graphs as a straight line.",
  variable: "A letter that stands for an unknown number, like x.",
  constant: "A fixed number that doesn't change (the +5 in x + 5).",
  factor: "One of the parts multiplied together to build an expression.",
  solution: "An x-value that makes the equation true, where the parabola crosses the x-axis. Same thing as a root or a zero.",
  root: "An x-value where the parabola crosses the x-axis (y = 0). Same thing as a solution or a zero.",
  zero: "An x-value where the graph crosses the x-axis (y = 0). Same thing as a root or a solution.",
};

/** A single piece of glossary-tokenized text. */
export interface GlossarySegment {
  /** The raw text of this segment (the matched word/phrase for term segments). */
  text: string;
  /** Canonical glossary key when this segment is a defined term. */
  term?: string;
  /** The short definition, present when {@link term} is set. */
  definition?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Longest phrases first so "concave up" wins over any shorter overlap.
const SORTED_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

// One combined matcher. We deliberately avoid look-behind for broader browser
// support and instead verify the left boundary manually during tokenization.
// A trailing optional plural ("s"/"es") lets "factors"/"y-intercepts" match
// while a following word boundary keeps "factoring" from matching.
const TERM_PATTERN = new RegExp(
  `(${SORTED_TERMS.map(escapeRegExp).join("|")})(?:es|s)?\\b`,
  "gi"
);

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

/**
 * Splits a plain-text run into glossary-aware segments. Plain text segments have
 * no `term`; matched terms carry their canonical key and definition so the
 * renderer can wrap them. Matching is case-insensitive, respects whole-word /
 * phrase boundaries (so it never matches inside another word), and prefers the
 * longest phrase. Callers must only pass text that is NOT inside backtick math
 * spans (MathText handles that split first) to avoid double-wrapping.
 */
export function splitGlossary(text: string): GlossarySegment[] {
  if (!text) return [{ text }];

  const segments: GlossarySegment[] = [];
  let lastIndex = 0;
  TERM_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TERM_PATTERN.exec(text)) !== null) {
    const start = match.index;
    // Guard the left boundary: skip matches that begin in the middle of a word
    // or are immediately preceded by a hyphen (e.g. don't match "intercept"
    // inside a longer hyphenated token we don't define).
    const prevChar = start > 0 ? text[start - 1] : undefined;
    if (isWordChar(prevChar) || prevChar === "-") {
      continue;
    }

    const canonical = match[1].toLowerCase();
    const definition = GLOSSARY[canonical];
    if (!definition) continue;

    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start) });
    }
    segments.push({
      text: match[0],
      term: canonical,
      definition,
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}
