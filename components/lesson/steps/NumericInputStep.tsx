"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import type { NumericInputProblem } from "@/types/lesson";

interface NumericInputStepProps {
  problem: NumericInputProblem;
  onSubmit: (value: number) => void;
  disabled?: boolean;
}

export function NumericInputStep({
  problem,
  onSubmit,
  disabled,
}: NumericInputStepProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      onSubmit(parsed);
    }
  }

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>
      <div className="mt-4 flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="x = ?"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          aria-label="Answer for x"
        />
      </div>
    </div>
  );
}

export function useNumericSubmit(
  problem: NumericInputProblem,
  onSubmit: (value: number) => void,
  disabled?: boolean
) {
  return { problem, onSubmit, disabled };
}
