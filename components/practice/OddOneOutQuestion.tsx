"use client";

import { useRef, useState } from "react";
import type { OddOneOutQuestion as OddOneOutQuestionData } from "@/types/practice";
import { Button } from "@/components/ui/Button";

interface OddOneOutQuestionProps {
  question: OddOneOutQuestionData;
  onAnswer: (correct: boolean) => void;
  disabled?: boolean;
}

export function OddOneOutQuestion({
  question,
  onAnswer,
  disabled,
}: OddOneOutQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const answeredRef = useRef(false);

  const frozen = checked || !!disabled;
  const isCorrect = checked && selected === question.oddId;

  function handleCheck() {
    if (frozen || selected === null) return;
    const correct = selected === question.oddId;
    setChecked(true);
    if (!answeredRef.current) {
      answeredRef.current = true;
      onAnswer(correct);
    }
  }

  function optionClasses(optionId: string): string {
    const base =
      "min-h-[44px] rounded-lg border px-4 py-3 text-left text-body transition-colors";
    const isSelected = selected === optionId;

    if (checked) {
      if (optionId === question.oddId) {
        return `${base} border-success bg-success/10 text-success`;
      }
      // The learner's own incorrect pick is shown neutral (never red).
      if (isSelected) {
        return `${base} border-border bg-surface text-muted`;
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

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={frozen}
            onClick={() => setSelected(option.id)}
            className={optionClasses(option.id)}
          >
            <span className="font-equation text-equation">{option.text}</span>
          </button>
        ))}
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
