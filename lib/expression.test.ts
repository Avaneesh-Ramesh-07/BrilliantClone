import { describe, it, expect } from "vitest";
import { evalExpression } from "@/lib/expression";

describe("evalExpression", () => {
  it("evaluates a constant", () => {
    expect(evalExpression("7", 0)).toBe(7);
  });

  it("substitutes the variable x", () => {
    expect(evalExpression("x", 4)).toBe(4);
  });

  it("respects operator precedence", () => {
    expect(evalExpression("2 * x + 3", 5)).toBe(13);
  });

  it("handles parentheses", () => {
    expect(evalExpression("2 * (x + 3)", 5)).toBe(16);
  });

  it("handles unary minus", () => {
    expect(evalExpression("-x + 1", 4)).toBe(-3);
  });

  it("handles division and decimals", () => {
    expect(evalExpression("x / 4", 2)).toBe(0.5);
  });

  it("ignores whitespace", () => {
    expect(evalExpression("  x   -   4 ", 10)).toBe(6);
  });

  it("returns 0 for non-finite results", () => {
    expect(evalExpression("x / 0", 1)).toBe(0);
  });
});
