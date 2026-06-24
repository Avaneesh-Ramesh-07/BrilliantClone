import { describe, it, expect } from "vitest";
import { computeMastery, isMasteryImpossible } from "@/lib/mastery";
import type { Problem, Step } from "@/types/lesson";

function problem(id: string, extra: Partial<Problem> = {}): Problem {
  return { id, type: "numeric-input", ...extra } as Problem;
}

function step(overrides: Partial<Step> = {}): Step {
  return {
    id: "step-1",
    title: "Step",
    concept: "",
    conceptFraming: "",
    masteryThreshold: 0.8,
    fallbackStepId: "step-0",
    fallbackMessage: "Let's review.",
    hints: [],
    completionAction: { buttonLabel: "Next" },
    problems: [problem("p1"), problem("p2"), problem("p3"), problem("p4")],
    ...overrides,
  } as Step;
}

describe("computeMastery", () => {
  it("passes when first-attempt rate meets the threshold", () => {
    const result = computeMastery(step({ masteryThreshold: 0.75 }), {
      p1: true,
      p2: true,
      p3: true,
      p4: false,
    });
    expect(result.passed).toBe(true);
    expect(result.rate).toBe(0.75);
  });

  it("fails and surfaces fallback details below the threshold", () => {
    const result = computeMastery(step({ masteryThreshold: 0.8 }), {
      p1: true,
      p2: false,
      p3: false,
      p4: false,
    });
    expect(result.passed).toBe(false);
    expect(result.fallbackStepId).toBe("step-0");
    expect(result.fallbackMessage).toBe("Let's review.");
  });

  it("auto-passes when the mastery gate is skipped", () => {
    expect(computeMastery(step({ skipMasteryGate: true }), {})).toEqual({
      passed: true,
      rate: 1,
    });
  });

  it("includes a partial-mastery message when passing imperfectly", () => {
    const result = computeMastery(
      step({ masteryThreshold: 0.5, partialMasteryMessage: "Nice progress!" }),
      { p1: true, p2: true, p3: false, p4: false }
    );
    expect(result.passed).toBe(true);
    expect(result.partialMasteryMessage).toBe("Nice progress!");
  });

  it("excludes demo drag-to-solve problems from scoring", () => {
    const s = step({
      masteryThreshold: 1,
      problems: [
        problem("demo", { type: "drag-to-solve", demo: true } as Partial<Problem>),
        problem("g1"),
        problem("g2"),
      ],
    });
    const result = computeMastery(s, { g1: true, g2: true });
    expect(result.rate).toBe(1);
    expect(result.passed).toBe(true);
  });
});

describe("isMasteryImpossible", () => {
  it("returns true once the threshold can no longer be reached", () => {
    const s = step({ masteryThreshold: 0.8 });
    expect(isMasteryImpossible(s, { p1: false, p2: false })).toBe(true);
  });

  it("returns false while the threshold is still reachable", () => {
    const s = step({ masteryThreshold: 0.8 });
    expect(isMasteryImpossible(s, { p1: true })).toBe(false);
  });

  it("returns false when the gate is skipped", () => {
    expect(isMasteryImpossible(step({ skipMasteryGate: true }), {})).toBe(false);
  });
});
