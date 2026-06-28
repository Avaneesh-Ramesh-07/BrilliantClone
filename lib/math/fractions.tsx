import { Fragment, type ReactNode } from "react";
import { Fraction } from "@/components/math/Fraction";

/**
 * Conservative detector for "bare" math fractions written with a slash, e.g.
 * `3/4`, `1/2`, `x/2`, `-5/6`, `(x+1)/3`, `b/(2a)`. It deliberately AVOIDS
 * touching prose and non-fraction slashes:
 *  - it requires NO whitespace around the slash, so "Rise / Run",
 *    "roots / zeroes" and similar are left alone;
 *  - each side must be a signed number, a single variable letter, or a
 *    parenthesized group, so multi-letter words ("and/or", "up/down") never
 *    match;
 *  - at least ONE side must be numeric or parenthesized, so letter/letter units
 *    ("km/h", "m/s") and bare "x/y" are left alone.
 *
 * Anything that does not clearly read as a simple math fraction is left as
 * written so we never corrupt prose, units, dates, paths, or code.
 */
const PART = String.raw`[+\-−]?(?:\d+(?:\.\d+)?|[A-Za-z]|\([^()]*\))`;
const FRACTION_RE = new RegExp(
  String.raw`(?<![\w./−-])(${PART})/(${PART})(?![\w./−-])`,
  "g"
);

/** True when a captured side is numeric or a parenthesized group. */
function isNumericOrParen(part: string): boolean {
  const stripped = part.replace(/^[+\-−]/, "");
  return /^\d/.test(stripped) || stripped.startsWith("(");
}

/**
 * Strips a single outer pair of parentheses used purely for grouping, e.g.
 * "(2a)" -> "2a" or "(x+1)" -> "x+1". A leading sign is left alone (so
 * "−(−6)" is preserved verbatim rather than collapsed into "−−6").
 */
function unwrap(part: string): string {
  const m = /^\((.*)\)$/.exec(part);
  return m ? m[1] : part;
}

/**
 * Splits a plain string into text and detected math fractions. Returns the
 * original string verbatim (as a single text segment) when nothing matches, so
 * callers can cheaply skip wrapping.
 */
export function splitMathFractions(
  text: string
): Array<{ type: "text"; value: string } | { type: "fraction"; num: string; den: string }> {
  const out: Array<
    { type: "text"; value: string } | { type: "fraction"; num: string; den: string }
  > = [];
  let last = 0;
  let match: RegExpExecArray | null;
  FRACTION_RE.lastIndex = 0;
  while ((match = FRACTION_RE.exec(text)) !== null) {
    const [whole, rawNum, rawDen] = match;
    // Require at least one numeric/parenthesized side; otherwise it's likely a
    // unit or an ambiguous letter/letter slash, so leave it as plain text.
    if (!isNumericOrParen(rawNum) && !isNumericOrParen(rawDen)) continue;
    if (match.index > last) {
      out.push({ type: "text", value: text.slice(last, match.index) });
    }
    out.push({ type: "fraction", num: unwrap(rawNum), den: unwrap(rawDen) });
    last = match.index + whole.length;
  }
  if (out.length === 0) return [{ type: "text", value: text }];
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

/** True when the string contains at least one detectable bare math fraction. */
export function hasMathFraction(text: string): boolean {
  const segments = splitMathFractions(text);
  return segments.some((s) => s.type === "fraction");
}

/**
 * Renders a plain string with any detected bare math fractions shown as real
 * stacked {@link Fraction}s. `renderText` lets callers further enrich the
 * surrounding text leaves (e.g. superscripts/glossary in MathText); by default
 * the text is rendered verbatim.
 */
export function renderWithFractions(
  text: string,
  keyBase: string,
  renderText: (value: string, key: string) => ReactNode = (v) => v,
  fractionClassName = "font-math mx-0.5"
): ReactNode {
  const segments = splitMathFractions(text);
  if (segments.length === 1 && segments[0].type === "text") {
    return renderText(segments[0].value, `${keyBase}-t0`);
  }
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <Fragment key={`${keyBase}-t${i}`}>
            {renderText(seg.value, `${keyBase}-t${i}`)}
          </Fragment>
        ) : (
          <Fraction
            key={`${keyBase}-f${i}`}
            className={fractionClassName}
            numerator={seg.num}
            denominator={seg.den}
          />
        )
      )}
    </>
  );
}
