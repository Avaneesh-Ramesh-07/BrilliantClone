"use client";

import { useState } from "react";
import type { OddOneOutQuestion as OddOneOutQuestionData } from "@/types/practice";
import { Button } from "@/components/ui/Button";

interface OddOneOutQuestionProps {
  question: OddOneOutQuestionData;
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

export function OddOneOutQuestion({
  question,
  onAnswer,
  disabled,
  reveal = false,
}: OddOneOutQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const frozen = reveal || !!disabled;
  const isCorrect = selected === question.oddId;

  function handlePick(optionId: string) {
    if (frozen) return;
    setSelected(optionId);
    setShowResult(false);
  }

  function handleCheck() {
    if (frozen || selected === null) return;
    setShowResult(true);
    onAnswer(selected === question.oddId);
  }

  function optionClasses(optionId: string): string {
    const base =
      "min-h-[44px] rounded-lg border px-4 py-3 text-left text-body transition-colors";
    const isSelected = selected === optionId;

    if (reveal) {
      if (optionId === question.oddId) {
        return `${base} border-success bg-success/10 text-success`;
      }
      // The learner's own incorrect pick is shown neutral (never red).
      if (isSelected) {
        return `${base} border-border bg-surface text-muted`;
      }
      return `${base} border-border bg-surface text-text`;
    }

    // A submitted (first-miss) pick is marked neutral - "not it" - without
    // revealing the answer, so the learner can try again.
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

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={frozen}
            onClick={() => handlePick(option.id)}
            className={optionClasses(option.id)}
          >
            <span className="font-equation text-equation">{option.text}</span>
          </button>
        ))}
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
