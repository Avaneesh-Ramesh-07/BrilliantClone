import { Fragment } from "react";
import { splitGlossary } from "@/lib/glossary";
import { GlossaryTerm } from "./GlossaryTerm";
import { Fraction } from "./Fraction";

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
 * Renders an inline string with two layers of enrichment (no fractions here):
 *  1. math variables wrapped in backticks are shown in the "math" face;
 *  2. recognized glossary terms in the plain text become tappable definitions.
 */
function renderInline(text: string, glossary: boolean) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <span key={i} className="font-math">
          {part.slice(1, -1)}
        </span>
      );
    }
    if (!glossary) {
      return <Fragment key={i}>{part}</Fragment>;
    }
    const segments = splitGlossary(part);
    return (
      <Fragment key={i}>
        {segments.map((seg, j) =>
          seg.term && seg.definition ? (
            <GlossaryTerm key={j} term={seg.text} definition={seg.definition} />
          ) : (
            <Fragment key={j}>{seg.text}</Fragment>
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
