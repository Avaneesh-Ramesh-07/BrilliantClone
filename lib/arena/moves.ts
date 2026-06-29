// Pure, framework-free catalog of the martial-arts moves a fighter can perform
// when they land a blow. Imported by both the attacker (to pick + broadcast a
// move) and by the fight scene components (to map a move id to a CSS class).
// Kept dependency-free so it is safe to import from any client component.

export type MoveId =
  | "front-kick"
  | "side-kick"
  | "roundhouse-kick"
  | "jump-kick"
  | "jumping-roundhouse-kick"
  | "punch"
  | "jab"
  | "uppercut"
  | "sideswipe"
  | "knee-kick"
  | "elbow-hit";

export const MOVES: MoveId[] = [
  "front-kick",
  "side-kick",
  "roundhouse-kick",
  "jump-kick",
  "jumping-roundhouse-kick",
  "punch",
  "jab",
  "uppercut",
  "sideswipe",
  "knee-kick",
  "elbow-hit",
];

/** Pick a uniformly-random move for an attacker who just landed a blow. */
export function randomMove(): MoveId {
  return MOVES[Math.floor(Math.random() * MOVES.length)];
}
