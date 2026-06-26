"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { OrderStepsQuestion as OrderStepsQuestionData } from "@/types/practice";

interface OrderStepsQuestionProps {
  question: OrderStepsQuestionData;
  onAnswer: (correct: boolean) => void;
  disabled?: boolean;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function shuffleSteps(steps: string[]): string[] {
  if (steps.length <= 1) return [...steps];

  const shuffled = [...steps];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Never present the steps already in the correct order.
  if (arraysEqual(shuffled, steps)) {
    return [...shuffled.slice(1), shuffled[0]];
  }

  return shuffled;
}

export function OrderStepsQuestion({
  question,
  onAnswer,
  disabled,
}: OrderStepsQuestionProps) {
  const [order, setOrder] = useState<string[]>(() =>
    shuffleSteps(question.steps)
  );
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const answeredRef = useRef(false);

  const frozen = disabled || checked;

  function move(index: number, direction: -1 | 1) {
    if (frozen) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleCheck() {
    if (frozen || answeredRef.current) return;
    const correct = arraysEqual(order, question.steps);
    answeredRef.current = true;
    setIsCorrect(correct);
    setChecked(true);
    onAnswer(correct);
  }

  return (
    <div>
      <p className="text-body text-muted">{question.prompt}</p>
      <p className="mt-2 font-equation text-equation text-primary">
        {question.problemLabel}
      </p>

      <ol className="mt-4 space-y-2">
        {order.map((step, index) => {
          const showSuccess = checked && isCorrect;
          const rowClasses = showSuccess
            ? "border-success/40 bg-success/10 text-success"
            : "border-border bg-surface text-text";
          return (
            <li
              key={`${step}-${index}`}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-body ${rowClasses}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body font-medium text-primary">
                {index + 1}
              </span>
              <span className="flex-1">{step}</span>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Move step up"
                  className="h-9 min-h-[36px] w-9 min-w-[36px] px-0 py-0"
                  disabled={frozen || index === 0}
                  onClick={() => move(index, -1)}
                >
                  ▲
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Move step down"
                  className="h-9 min-h-[36px] w-9 min-w-[36px] px-0 py-0"
                  disabled={frozen || index === order.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ▼
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      {!checked && (
        <Button
          type="button"
          className="mt-4"
          disabled={disabled}
          onClick={handleCheck}
        >
          Check
        </Button>
      )}

      {checked && isCorrect && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{question.explanation}</p>
        </div>
      )}

      {checked && !isCorrect && (
        <>
          <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
            <p className="text-body text-error">{question.explanation}</p>
          </div>
          <div className="mt-4">
            <p className="text-body text-muted">Correct order:</p>
            <ol className="mt-2 space-y-2">
              {question.steps.map((step, index) => (
                <li
                  key={`correct-${step}-${index}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-body text-text"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-body font-medium text-primary">
                    {index + 1}
                  </span>
                  <span className="flex-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
