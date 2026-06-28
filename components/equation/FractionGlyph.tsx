import type { ReactNode } from "react";
import { Fraction } from "@/components/math/Fraction";

interface FractionGlyphProps {
  numerator: ReactNode;
  denominator: ReactNode;
}

/**
 * Compact stacked fraction for draggable equation tiles. Delegates to the
 * shared {@link Fraction} so every fraction in the app renders consistently,
 * using its tight spacing variant to stay inside small tiles.
 */
export function FractionGlyph({ numerator, denominator }: FractionGlyphProps) {
  return <Fraction tight numerator={numerator} denominator={denominator} />;
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
