/**
 * Minimal, dependency-free evaluator for the simple arithmetic expressions used
 * by lesson grid-plot line functions (e.g. "2 * x + 3", "x - 4", "7").
 *
 * Supports +, -, *, /, parentheses, decimals, unary minus, and the variable `x`.
 * This replaces a full `mathjs` import, which was by far the heaviest module in
 * the lesson route and dramatically slowed down dev compilation.
 *
 * Expressions come from static lesson content (not user input).
 */
export function evalExpression(expr: string, x: number): number {
  const s = expr.replace(/\s+/g, "");
  let i = 0;

  const peek = () => s[i];

  function parseExpr(): number {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const rhs = parseFactor();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseFactor(): number {
    if (peek() === "+") {
      i++;
      return parseFactor();
    }
    if (peek() === "-") {
      i++;
      return -parseFactor();
    }
    if (peek() === "(") {
      i++;
      const value = parseExpr();
      if (peek() === ")") i++;
      return value;
    }
    if (peek() === "x") {
      i++;
      return x;
    }
    let num = "";
    while (i < s.length && /[0-9.]/.test(s[i])) {
      num += s[i++];
    }
    return num === "" ? NaN : parseFloat(num);
  }

  const result = parseExpr();
  return Number.isFinite(result) ? result : 0;
}
