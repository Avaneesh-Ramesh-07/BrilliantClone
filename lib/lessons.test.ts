import { describe, it, expect } from "vitest";
import { selectStepProblems } from "@/lib/lessons";
import type { Problem } from "@/types/lesson";

function bank(n: number): Problem[] {
  return Array.from(
    { length: n },
    (_, i) => ({ id: `p${i}`, type: "numeric-input" }) as Problem
  );
}

describe("selectStepProblems", () => {
  it("returns the full bank when present is omitted", () => {
    const problems = bank(4);
    expect(selectStepProblems(problems)).toBe(problems);
  });

  it("returns the full bank when present exceeds the bank size", () => {
    const problems = bank(3);
    expect(selectStepProblems(problems, 5)).toBe(problems);
  });

  it("returns only the anchor when present is 1 or less", () => {
    const problems = bank(4);
    expect(selectStepProblems(problems, 1)).toEqual([problems[0]]);
  });

  it("always keeps the anchor first and returns the requested count", () => {
    const problems = bank(6);
    const selected = selectStepProblems(problems, 3);
    expect(selected).toHaveLength(3);
    expect(selected[0]).toBe(problems[0]);
  });

  it("samples without duplicates", () => {
    const problems = bank(6);
    const selected = selectStepProblems(problems, 4);
    const ids = selected.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
