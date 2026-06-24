import { describe, it, expect } from "vitest";
import {
  flipTileSign,
  arraysEqual,
  equationMatches,
  isVariableTile,
  simplifyRightSide,
  simplifyEquationAnswer,
  resolveMoveEquation,
  applyDivisionToCoefficient,
} from "@/lib/equation";

describe("flipTileSign", () => {
  it("flips a positive tile to negative", () => {
    expect(flipTileSign("+3")).toBe("-3");
  });

  it("flips an ASCII-minus tile to positive", () => {
    expect(flipTileSign("-3")).toBe("+3");
  });

  it("flips a unicode-minus tile to positive", () => {
    expect(flipTileSign("\u22125")).toBe("+5");
  });

  it("leaves division and multiplication tiles unchanged", () => {
    expect(flipTileSign("\u00f72")).toBe("\u00f72");
    expect(flipTileSign("\u00d72")).toBe("\u00d72");
  });

  it("leaves variable tiles unchanged", () => {
    expect(flipTileSign("x")).toBe("x");
    expect(flipTileSign("2x")).toBe("2x");
  });
});

describe("arraysEqual", () => {
  it("returns true for identical arrays", () => {
    expect(arraysEqual(["x", "+3"], ["x", "+3"])).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(arraysEqual(["x"], ["x", "+3"])).toBe(false);
  });

  it("returns false when order differs", () => {
    expect(arraysEqual(["x", "+3"], ["+3", "x"])).toBe(false);
  });
});

describe("equationMatches", () => {
  it("matches when both sides are equal", () => {
    const a = { left: ["x"], right: ["5"] };
    const b = { left: ["x"], right: ["5"] };
    expect(equationMatches(a, b)).toBe(true);
  });

  it("does not match when a side differs", () => {
    const a = { left: ["x"], right: ["5"] };
    const b = { left: ["x"], right: ["6"] };
    expect(equationMatches(a, b)).toBe(false);
  });
});

describe("isVariableTile", () => {
  it("recognizes plain and coefficient variables", () => {
    expect(isVariableTile("x")).toBe(true);
    expect(isVariableTile("3x")).toBe(true);
  });

  it("rejects constants", () => {
    expect(isVariableTile("+3")).toBe(false);
  });
});

describe("simplifyRightSide", () => {
  it("sums signed constants", () => {
    expect(simplifyRightSide(["+5", "\u22122"])).toBe(3);
  });

  it("applies a divisor", () => {
    expect(simplifyRightSide(["6", "\u00f72"])).toBe(3);
  });

  it("ignores a zero divisor", () => {
    expect(simplifyRightSide(["6", "\u00f70"])).toBe(6);
  });

  it("returns null when there are no numbers", () => {
    expect(simplifyRightSide([])).toBeNull();
  });
});

describe("simplifyEquationAnswer", () => {
  it("solves when the left side is isolated x", () => {
    expect(simplifyEquationAnswer(["x"], ["+5", "\u22122"])).toBe(3);
  });

  it("returns null when x is not isolated", () => {
    expect(simplifyEquationAnswer(["2x"], ["6"])).toBeNull();
  });
});

describe("resolveMoveEquation", () => {
  it("moves a tile across sides and flips its sign", () => {
    const result = resolveMoveEquation(
      { left: ["x", "+3"], right: ["5"] },
      "left",
      "+3"
    );
    expect(result).toEqual({ left: ["x"], right: ["5", "-3"] });
  });

  it("returns the original equation when the tile is absent", () => {
    const eq = { left: ["x"], right: ["5"] };
    expect(resolveMoveEquation(eq, "left", "+9")).toBe(eq);
  });
});

describe("applyDivisionToCoefficient", () => {
  it("reduces a coefficient term to bare x", () => {
    expect(applyDivisionToCoefficient({ left: ["3x"], right: ["6"] })).toEqual({
      left: ["x"],
      right: ["6"],
    });
  });

  it("leaves bare x and constants untouched", () => {
    expect(applyDivisionToCoefficient({ left: ["x"], right: ["5"] })).toEqual({
      left: ["x"],
      right: ["5"],
    });
  });
});
