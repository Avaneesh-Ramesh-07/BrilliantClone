import { Fragment } from "react";

interface MathTextProps {
  text: string;
}

/**
 * Renders a prompt string where math variables wrapped in backticks (e.g.
 * `` `a` ``, `` `A·C` ``) are shown in an italic serif "math" face so they stand
 * out from the surrounding sentence. Everything outside backticks renders as-is.
 */
export function MathText({ text }: MathTextProps) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
          return (
            <span key={i} className="font-serif italic">
              {part.slice(1, -1)}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
