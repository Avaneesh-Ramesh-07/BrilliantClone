import { Fragment } from "react";
import { splitGlossary } from "@/lib/glossary";
import { GlossaryTerm } from "./GlossaryTerm";
import { Fraction } from "./Fraction";
import { renderWithFractions } from "@/lib/math/fractions";

interface MathTextProps {
  text: string;
  /**
   * When false, glossary terms are not auto-detected/linkified (only the
   * backtick math styling is applied). Defaults to true.
   */
  glossary?: boolean;
}

/** Matches a LaTeX-style fraction token, e.g. `\frac{-b}{2a}`. */
const FRACTION_RE = /\\frac\{([^{}]*)\}\{([^{}]*)\}/g;

/**
 * Matches a caret-exponent token: a `^` followed by one of
 *  - `{...}`  LaTeX-style braces (e.g. `x^{10}`),
 *  - `(...)`  a parenthesized exponent (e.g. `2^(n+1)`),
 *  - `[+-]?\d+`  a run of digits with an optional sign (e.g. `x^2`, `x^-3`),
 *  - a single variable letter (e.g. `x^n`).
 * A stray `^` with no following token (or `^` at end of string) never matches,
 * so it's left untouched rather than producing an empty superscript.
 */
const EXPONENT_RE = /\^(\{[^{}]*\}|\([^()]*\)|[+-]?\d+|[A-Za-z])/g;

/** Strips the surrounding braces/parens from a captured exponent token. */
function stripGrouping(token: string): string {
  if (
    (token.startsWith("{") && token.endsWith("}")) ||
    (token.startsWith("(") && token.endsWith(")"))
  ) {
    return token.slice(1, -1);
  }
  return token;
}

/**
 * Converts caret-exponent notation in a plain string into real superscripts,
 * rendering the base text as-is and each exponent inside a small raised
 * `<sup>`. Multiple exponents in one string are all converted. Pre-existing
 * Unicode superscripts (e.g. ², ³) contain no `^` and are left untouched.
 */
function renderSuperscripts(text: string, keyBase: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  EXPONENT_RE.lastIndex = 0;
  while ((match = EXPONENT_RE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      <sup
        key={`${keyBase}-sup-${k++}`}
        className="align-super text-[0.7em] leading-none"
      >
        {stripGrouping(match[1])}
      </sup>
    );
    last = match.index + match[0].length;
  }
  if (out.length === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/**
 * Renders a plain-text leaf with two enrichments: bare math fractions written
 * with a slash (e.g. `3/4`, `b/(2a)`) become real stacked fractions, and
 * caret-exponent notation inside the remaining text becomes superscripts.
 * Fraction detection runs first and is conservative (see
 * {@link renderWithFractions}), so prose slashes are never touched.
 */
function renderLeaf(text: string, keyBase: string): React.ReactNode {
  return renderWithFractions(text, keyBase, (value, key) =>
    renderSuperscripts(value, key)
  );
}

/**
 * Renders an inline string with three layers of enrichment (no fractions here):
 *  1. math variables wrapped in backticks are shown in the "math" face;
 *  2. recognized glossary terms in the plain text become tappable definitions;
 *  3. caret-exponent notation (`x^2`, `x^{10}`, `2^(n+1)`, `x^n`) is rendered
 *     as a true superscript so a literal `^` is never shown to the learner.
 *
 * Superscript conversion runs only on the plain-text/math leaves (after the
 * backtick and glossary splits), so nothing is double-processed.
 */
function renderInline(text: string, glossary: boolean) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <span key={i} className="font-math">
          {renderLeaf(part.slice(1, -1), `bt-${i}`)}
        </span>
      );
    }
    if (!glossary) {
      return <Fragment key={i}>{renderLeaf(part, `pl-${i}`)}</Fragment>;
    }
    const segments = splitGlossary(part);
    return (
      <Fragment key={i}>
        {segments.map((seg, j) =>
          seg.term && seg.definition ? (
            <GlossaryTerm key={j} term={seg.text} definition={seg.definition} />
          ) : (
            <Fragment key={j}>{renderLeaf(seg.text, `g-${i}-${j}`)}</Fragment>
          )
        )}
      </Fragment>
    );
  });
}

/**
 * Renders a prompt string with three layers of enrichment:
 *  1. `\frac{a}{b}` tokens render as a true stacked fraction (so equations use a
 *     fraction bar rather than a "/" slash);
 *  2. math variables wrapped in backticks (e.g. `` `a` ``) are shown in the
 *     "math" face so they stand out from the sentence;
 *  3. recognized glossary terms in the plain text become bold, tappable
 *     {@link GlossaryTerm}s that reveal a short definition.
 *
 * Backtick/glossary detection runs only on the non-fraction, non-math segments,
 * so nothing is double-wrapped.
 */
export function MathText({ text, glossary = true }: MathTextProps) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  FRACTION_RE.lastIndex = 0;
  let key = 0;

  while ((match = FRACTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={key++}>
          {renderInline(text.slice(lastIndex, match.index), glossary)}
        </Fragment>
      );
    }
    nodes.push(
      <Fraction
        key={key++}
        className="font-math mx-0.5"
        numerator={renderInline(match[1], false)}
        denominator={renderInline(match[2], false)}
      />
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={key++}>
        {renderInline(text.slice(lastIndex), glossary)}
      </Fragment>
    );
  }

  return <>{nodes}</>;
}
