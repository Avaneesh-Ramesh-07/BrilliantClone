"use client";

import { useState } from "react";
import type { MultipleChoiceProblem } from "@/types/lesson";

interface MultipleChoiceStepProps {
  problem: MultipleChoiceProblem;
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  showResult?: boolean;
  selectedId?: string | null;
}

export function MultipleChoiceStep({
  problem,
  onSelect,
  disabled,
  showResult,
  selectedId,
}: MultipleChoiceStepProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const active = selectedId ?? localSelected;

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>
      <div className="mt-4 flex flex-col gap-2">
        {problem.options.map((option) => {
          const isSelected = active === option.id;
          const showCorrect = showResult && option.correct;
          const showWrong = showResult && isSelected && !option.correct;

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setLocalSelected(option.id);
                onSelect(option.id);
              }}
              className={`min-h-[44px] rounded-lg border px-4 py-3 text-left text-body transition-colors ${
                showCorrect
                  ? "border-success bg-success/10 text-success"
                  : showWrong
                    ? "border-error bg-error/10 text-error"
                    : isSelected
                      ? "border-primary bg-primary-light text-text"
                      : "border-border bg-surface text-text hover:border-primary"
              }`}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
