import { describe, it, expect } from "vitest";
import { computeComfort, formatDuration } from "@/lib/comfort";

describe("computeComfort", () => {
  it("reads as not-started without a recorded time", () => {
    expect(computeComfort(null, 10)).toEqual({
      level: "not-started",
      score: 0,
      totalMs: null,
    });
  });

  it("scores a fast completion as very-comfortable", () => {
    // 10 min estimate, finished in 2 min (ratio 0.2, below FAST_RATIO).
    const result = computeComfort(2 * 60 * 1000, 10);
    expect(result.score).toBe(100);
    expect(result.level).toBe("very-comfortable");
  });

  it("scores a slow completion as needs-practice", () => {
    // 10 min estimate, took 20 min (ratio 2.0, above SLOW_RATIO).
    const result = computeComfort(20 * 60 * 1000, 10);
    expect(result.score).toBe(0);
    expect(result.level).toBe("needs-practice");
  });
});

describe("formatDuration", () => {
  it("formats sub-minute durations as seconds", () => {
    expect(formatDuration(47_000)).toBe("47s");
  });

  it("formats minute durations with zero-padded seconds", () => {
    expect(formatDuration(4 * 60_000 + 12_000)).toBe("4m 12s");
  });

  it("clamps negative input to 0s", () => {
    expect(formatDuration(-5000)).toBe("0s");
  });
});
