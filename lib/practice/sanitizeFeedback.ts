/**
 * Defensive cleanup for AI-generated feedback strings. The model is instructed
 * to reply in plain prose (see `feedbackInstruction`), but it can still slip in
 * stray markdown or LaTeX. This strips that residue so the UI never renders raw
 * `###`, `**`, or `\(...\)` to the learner.
 */
export function sanitizeFeedback(input: string): string {
  if (!input) return "";

  const cleanedLines = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => cleanLine(line));

  return collapseBlankLines(cleanedLines).join("\n").trim();
}

function cleanLine(rawLine: string): string {
  let line = rawLine;

  // Drop leading heading markers: "### Feedback" -> "Feedback".
  line = line.replace(/^\s{0,3}#{1,6}\s*/, "");

  // Convert leading bullet markers ("- " / "* " / "+ ") to a "• " prefix.
  const bullet = /^(\s*)[-*+]\s+/.exec(line);
  if (bullet) {
    line = `${bullet[1]}• ${line.slice(bullet[0].length)}`;
  }

  // Strip emphasis markers but keep the inner text: **x**, __x__, *x*, _x_.
  line = line
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");

  // Remove any remaining stray emphasis characters.
  line = line.replace(/\*\*|__/g, "");

  // Remove LaTeX / math delimiters, keeping the math text itself.
  line = line
    .replace(/\\[()[\]]/g, "")
    .replace(/\$+/g, "");

  return line.replace(/[ \t]+$/g, "");
}

/** Collapse runs of 2+ blank lines down to a single blank line. */
function collapseBlankLines(lines: string[]): string[] {
  const out: string[] = [];
  let blank = false;
  for (const line of lines) {
    const isBlank = line.trim().length === 0;
    if (isBlank && blank) continue;
    blank = isBlank;
    out.push(line);
  }
  return out;
}
