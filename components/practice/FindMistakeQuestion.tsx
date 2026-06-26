"use client";

import { useRef, useState } from "react";
import type { FindMistakeQuestion as FindMistakeQuestionData } from "@/types/practice";
import { Button } from "@/components/ui/Button";

interface FindMistakeQuestionProps {
  question: FindMistakeQuestionData;
  onAnswer: (correct: boolean) => void;
  disabled?: boolean;
}

const NO_MISTAKE = -1;

export function FindMistakeQuestion({
  question,
  onAnswer,
  disabled,
}: FindMistakeQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const answeredRef = useRef(false);

  const frozen = checked || !!disabled;

  // The learner's pick maps to mistakeIndex: a step index, or null ("no mistake").
  const pickedIndex = selected === NO_MISTAKE ? null : selected;
  const isCorrect = checked && pickedIndex === question.mistakeIndex;

  function handleCheck() {
    if (frozen || selected === null) return;
    const correct = pickedIndex === question.mistakeIndex;
    setChecked(true);
    if (!answeredRef.current) {
      answeredRef.current = true;
      onAnswer(correct);
    }
  }

  function optionClasses(value: number): string {
    const base =
      "min-h-[44px] rounded-lg border px-4 py-3 text-left text-body transition-colors";
    const isSelected = selected === value;

    if (checked) {
      const isCorrectChoice =
        (value === NO_MISTAKE && question.mistakeIndex === null) ||
        (value !== NO_MISTAKE && value === question.mistakeIndex);

      // The correct answer is always shown in green — whether the learner picked
      // it (they got it right) or not (revealing what they should have chosen).
      // A green outline on a correctly-identified step signals success rather
      // than flagging that step as "the error".
      if (isCorrectChoice) {
        return `${base} border-success bg-success/10 text-success`;
      }
      // Only the learner's own incorrect pick is shown in red.
      if (isSelected) {
        return `${base} border-error bg-error/10 text-error`;
      }
      return `${base} border-border bg-surface text-text`;
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
            onClick={() => setSelected(index)}
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
          onClick={() => setSelected(NO_MISTAKE)}
          className={optionClasses(NO_MISTAKE)}
        >
          The work is correct — no mistake.
        </button>
      </div>

      {!checked && (
        <div className="mt-4">
          <Button
            type="button"
            onClick={handleCheck}
            disabled={frozen || selected === null}
            variant="primary"
            fullWidth
          >
            Check
          </Button>
        </div>
      )}

      {checked && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 ${
            isCorrect
              ? "border-success/40 bg-success/10"
              : "border-error/40 bg-error/5"
          }`}
        >
          <p
            className={`text-body ${isCorrect ? "text-success" : "text-text"}`}
          >
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
