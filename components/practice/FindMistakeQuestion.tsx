"use client";

import { useState } from "react";
import type { FindMistakeQuestion as FindMistakeQuestionData } from "@/types/practice";
import { Button } from "@/components/ui/Button";

interface FindMistakeQuestionProps {
  question: FindMistakeQuestionData;
  /** Called on EVERY check; the parent counts attempts and gates the reveal. */
  onAnswer: (correct: boolean) => void;
  disabled?: boolean;
  /**
   * When true, reveal/highlight the correct answer (green) and show the
   * explanation. The parent flips this once the question is solved or missed
   * twice in a row - a single miss never reveals the answer.
   */
  reveal?: boolean;
}

const NO_MISTAKE = -1;

export function FindMistakeQuestion({
  question,
  onAnswer,
  disabled,
  reveal = false,
}: FindMistakeQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  // A check has been submitted for the current selection (marks the pick). On a
  // first miss this shows the pick as neutral; the answer stays hidden.
  const [showResult, setShowResult] = useState(false);

  const frozen = reveal || !!disabled;

  const pickedIndex = selected === NO_MISTAKE ? null : selected;
  const isCorrect = pickedIndex === question.mistakeIndex;

  function handlePick(value: number) {
    if (frozen) return;
    setSelected(value);
    setShowResult(false);
  }

  function handleCheck() {
    if (frozen || selected === null) return;
    setShowResult(true);
    onAnswer(pickedIndex === question.mistakeIndex);
  }

  function optionClasses(value: number): string {
    const base =
      "min-h-[44px] rounded-lg border px-4 py-3 text-left text-body transition-colors";
    const isSelected = selected === value;

    if (reveal) {
      const isCorrectChoice =
        (value === NO_MISTAKE && question.mistakeIndex === null) ||
        (value !== NO_MISTAKE && value === question.mistakeIndex);

      // The correct answer is always shown in green once revealed, whether the
      // learner picked it or not. Their own incorrect pick is shown neutral
      // (never red).
      if (isCorrectChoice) {
        return `${base} border-success bg-success/10 text-success`;
      }
      if (isSelected) {
        return `${base} border-border bg-surface text-muted`;
      }
      return `${base} border-border bg-surface text-text`;
    }

    // A submitted (first-miss) pick is marked neutral - "not it" - without
    // revealing which step is actually wrong, so the learner can try again.
    if (showResult && isSelected) {
      return `${base} border-border bg-surface text-muted`;
    }

    if (isSelected) {
      return `${base} border-primary bg-primary-light text-text`;
    }
    return `${base} border-border bg-surface text-text hover:border-primary`;
  }

  return (
    <div>
      <p className="text-body text-text">{question.prompt}</p>

      <p className="mt-3 font-equation text-equation text-primary">
        {question.problemLabel}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {question.steps.map((step, index) => (
          <button
            key={index}
            type="button"
            disabled={frozen}
            onClick={() => handlePick(index)}
            className={optionClasses(index)}
          >
            <span className="text-label text-muted">Step {index + 1}</span>
            <span className="mt-1 block font-equation text-equation">
              {step}
            </span>
          </button>
        ))}

        <button
          type="button"
          disabled={frozen}
          onClick={() => handlePick(NO_MISTAKE)}
          className={optionClasses(NO_MISTAKE)}
        >
          The work is correct, no mistake.
        </button>
      </div>

      {!reveal && (
        <div className="mt-4">
          <Button
            type="button"
            onClick={handleCheck}
            disabled={frozen || selected === null}
            variant="primary"
            fullWidth
          >
            {showResult ? "Check again" : "Check"}
          </Button>
        </div>
      )}

      {reveal && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 ${
            isCorrect
              ? "border-success/40 bg-success/10"
              : "border-border bg-surface"
          }`}
        >
          <p
            className={`text-body ${isCorrect ? "text-success" : "text-error"}`}
          >
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
