import type { EquationState } from "@/types/lesson";

export function flipTileSign(tile: string): string {
  if (tile.startsWith("+")) {
    return "-" + tile.slice(1);
  }
  if (tile.startsWith("−") || tile.startsWith("-")) {
    const num = tile.slice(1);
    return "+" + num;
  }
  if (tile.startsWith("÷") || tile.startsWith("×")) {
    return tile;
  }
  if (tile === "x" || tile.endsWith("x")) {
    return tile;
  }
  return tile;
}

export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

export function equationMatches(
  current: EquationState,
  target: EquationState
): boolean {
  return (
    arraysEqual(current.left, target.left) &&
    arraysEqual(current.right, target.right)
  );
}

export function isVariableTile(tile: string): boolean {
  return tile === "x" || tile.endsWith("x");
}

export function simplifyRightSide(tiles: string[]): number | null {
  const numbers: number[] = [];
  let divisor: number | null = null;

  for (const tile of tiles) {
    if (tile.startsWith("÷")) {
      divisor = parseFloat(tile.slice(1));
    } else if (tile.startsWith("+")) {
      numbers.push(parseFloat(tile.slice(1)));
    } else if (tile.startsWith("−") || tile.startsWith("-")) {
      numbers.push(-parseFloat(tile.slice(1)));
    } else {
      const n = parseFloat(tile);
      if (!isNaN(n)) numbers.push(n);
    }
  }

  if (numbers.length === 0) return null;

  let result = numbers.reduce((a, b) => a + b, 0);
  if (divisor !== null && divisor !== 0) {
    result = result / divisor;
  }
  return result;
}

export function simplifyEquationAnswer(
  left: string[],
  right: string[]
): number | null {
  if (left.length === 1 && left[0] === "x") {
    return simplifyRightSide(right);
  }
  return null;
}

export function resolveMoveEquation(
  equation: EquationState,
  fromSide: "left" | "right",
  tile: string
): EquationState {
  const left = [...equation.left];
  const right = [...equation.right];
  const from = fromSide === "left" ? left : right;
  const to = fromSide === "left" ? right : left;

  const idx = from.indexOf(tile);
  if (idx === -1) return equation;

  from.splice(idx, 1);
  to.push(flipTileSign(tile));

  return { left, right };
}

export function applyDivisionToCoefficient(
  equation: EquationState
): EquationState {
  const left = equation.left.map((tile) => {
    if (/^\d+x$/.test(tile)) {
      return "x";
    }
    return tile;
  });
  return { ...equation, left };
}
