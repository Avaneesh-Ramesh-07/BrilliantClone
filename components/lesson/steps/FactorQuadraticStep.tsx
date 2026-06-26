"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FactorQuadraticProblem } from "@/types/lesson";

interface FactorQuadraticStepProps {
  problem: FactorQuadraticProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

function formatRoot(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `${n}`;
}

function FactorTile({
  id,
  label,
  disabled,
  highlight,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id, disabled });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled });

  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 10 }
    : undefined;

  const stateClasses = isDragging
    ? "border-primary border-2 bg-primary-light"
    : isOver || highlight
      ? "border-primary border-2 bg-primary-light/50"
      : "border-border bg-surface";

  const cursor = disabled
    ? "cursor-default"
    : "cursor-grab active:cursor-grabbing";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : listeners)}
      {...attributes}
      className={`flex min-h-[52px] min-w-[44px] touch-none select-none items-center justify-center rounded-lg border px-4 py-2 font-equation text-equation text-text ${cursor} ${stateClasses}`}
    >
      {label}
    </div>
  );
}

export function FactorQuadraticStep({
  problem,
  onCorrect,
  disabled,
}: FactorQuadraticStepProps) {
  const [factored, setFactored] = useState(false);
  const [hasFactored, setHasFactored] = useState(false);
  const [hasRecombined, setHasRecombined] = useState(false);
  const notifiedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const solved = hasFactored && hasRecombined;

  useEffect(() => {
    if (solved && !notifiedRef.current) {
      notifiedRef.current = true;
      onCorrect(problem.feedback.correct);
    }
  }, [solved, onCorrect, problem.feedback.correct]);

  function handleFactor() {
    if (disabled) return;
    setFactored(true);
    setHasFactored(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (disabled || !factored) return;
    const { active, over } = event;
    if (!over || over.id === active.id) return;
    // Dropping one factor tile onto the other recombines them.
    setFactored(false);
    setHasRecombined(true);
  }

  const zerosCaption = `Zeros: ${problem.roots
    .map((r) => `x = ${formatRoot(r)}`)
    .join(", ")}`;

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>

      <div className="mt-4 flex justify-center">
        {factored ? (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <FactorTile
                id="factor-0"
                label={problem.factors[0]}
                disabled={disabled}
              />
              <FactorTile
                id="factor-1"
                label={problem.factors[1]}
                disabled={disabled}
              />
            </div>
          </DndContext>
        ) : (
          <div className="flex min-h-[52px] items-center justify-center rounded-lg border border-border bg-surface px-5 py-3 font-equation text-equation text-text">
            {problem.equationLabel}
          </div>
        )}
      </div>

      {factored && (
        <p className="mt-3 text-center text-label text-muted">
          {zerosCaption}
        </p>
      )}

      {!solved && (
        <div className="mt-4 flex items-center justify-center gap-3">
          {!factored && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleFactor}
              disabled={disabled}
            >
              Factor
            </Button>
          )}
          {factored && (
            <p className="text-label text-muted">
              Drag one factor onto the other to multiply them back together.
            </p>
          )}
        </div>
      )}

      {hasRecombined && !solved && (
        <p className="mt-3 text-center text-body text-text">
          Multiplying the factors back gives the original quadratic.
        </p>
      )}

      {solved && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{problem.feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
