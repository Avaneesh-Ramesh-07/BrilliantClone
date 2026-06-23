import type { ReactNode } from "react";

interface FractionGlyphProps {
  numerator: ReactNode;
  denominator: ReactNode;
}

/** Renders a stacked fraction (numerator over a bar over denominator). */
export function FractionGlyph({ numerator, denominator }: FractionGlyphProps) {
  return (
    <span className="inline-flex flex-col items-center justify-center leading-none align-middle">
      <span className="px-1 pb-0.5">{numerator}</span>
      <span className="h-px w-full bg-current" />
      <span className="px-1 pt-0.5">{denominator}</span>
    </span>
  );
}

const DIVISION_TILE = /^[÷/](\d+(?:\.\d+)?)$/;

/** Parses a division tile like "÷2" and returns its divisor, or null. */
export function parseDivisorTile(tile: string): number | null {
  const match = DIVISION_TILE.exec(tile);
  return match ? parseFloat(match[1]) : null;
}

const NUMERIC_TILE = /^-?\d+(?:\.\d+)?$/;

export function isNumericTile(tile: string): boolean {
  return NUMERIC_TILE.test(tile);
}
