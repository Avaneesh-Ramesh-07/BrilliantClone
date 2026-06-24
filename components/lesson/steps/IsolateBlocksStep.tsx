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
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { IsolateBlocksProblem } from "@/types/lesson";

interface IsolateBlocksStepProps {
  problem: IsolateBlocksProblem;
  onCorrect: (feedback: string) => void;
  disabled?: boolean;
}

type Phase = "idle" | "animating" | "wrong" | "done";
type MoveType = "subtract" | "divide";
type WrongReason = "add" | "delete";

const TRASH_ID = "trash";
const DRAG_ID = "drag-source";
const REMOVING = "translate-y-10 scale-50 opacity-0";

function Unit({ tone }: { tone: "constant" | "value" | "added" }) {
  const palette =
    tone === "added"
      ? "border-sky-400 bg-sky-200"
      : tone === "constant"
        ? "border-amber-500 bg-amber-200"
        : "border-emerald-400 bg-emerald-200";
  return <div className={`h-6 w-6 rounded-md border ${palette}`} />;
}

function XChip({ label }: { label: string }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-primary bg-primary-light font-equation text-equation text-primary">
      {label}
    </div>
  );
}

function UnitRow({
  count,
  addedFrom,
  removeFrom,
}: {
  count: number;
  addedFrom?: number;
  removeFrom?: number;
}) {
  return (
    <div className="flex max-w-[150px] flex-wrap items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`transition-all duration-700 ${
            removeFrom !== undefined && i >= removeFrom ? REMOVING : ""
          }`}
        >
          <Unit tone={addedFrom !== undefined && i >= addedFrom ? "added" : "value"} />
        </div>
      ))}
    </div>
  );
}

/** Plain row of variable chips (not draggable) — used for the subtract stage. */
function XRow({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <XChip key={i} label={label} />
      ))}
    </div>
  );
}

/** Boxed variable group (dashed) — used as the draggable in the divide stage. */
function XGroup({
  count,
  label,
  removeFrom,
}: {
  count: number;
  label: string;
  removeFrom?: number;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border-2 border-dashed border-primary/40 bg-primary-light px-2 py-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`transition-all duration-700 ${
            removeFrom !== undefined && i >= removeFrom ? REMOVING : ""
          }`}
        >
          <XChip label={label} />
        </div>
      ))}
    </div>
  );
}

function ConstantGroup({
  count,
  added,
  removing,
}: {
  count: number;
  added?: number;
  removing?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded-lg border-2 border-dashed border-amber-500 bg-amber-100 px-2 py-1 transition-all duration-700 ${
        removing ? REMOVING : ""
      }`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Unit
          key={i}
          tone={added !== undefined && i >= count - added ? "added" : "constant"}
        />
      ))}
    </div>
  );
}

function Draggable({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: DRAG_ID, disabled });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${
        disabled ? "" : "cursor-grab touch-none active:cursor-grabbing"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      {children}
    </div>
  );
}

function TrashZone({ disabled }: { disabled?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ID, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
        isOver ? "border-error bg-error/10" : "border-border bg-surface"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-muted" aria-hidden>
        <path
          d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7M10 11v6M14 11v6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-label text-muted">Drag here to remove</span>
    </div>
  );
}

export function IsolateBlocksStep({
  problem,
  onCorrect,
  disabled,
}: IsolateBlocksStepProps) {
  const { variable, constant, rightValue } = problem;
  const coefficient = problem.coefficient ?? 1;

  const moves: MoveType[] = [];
  if (constant !== 0) moves.push("subtract");
  if (coefficient !== 1) moves.push("divide");

  const [moveIndex, setMoveIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [wrongReason, setWrongReason] = useState<WrongReason | null>(null);
  const [removeTriggered, setRemoveTriggered] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  // Equation state (coefficient c, constant k, right value r) after `i` moves.
  function stateAfter(i: number) {
    let c = coefficient;
    let k = constant;
    let r = rightValue;
    for (const m of moves.slice(0, i)) {
      if (m === "subtract") {
        r -= k;
        k = 0;
      } else {
        r = r / coefficient;
        c = 1;
      }
    }
    return { c, k, r };
  }

  const cur = stateAfter(moveIndex);
  const next = stateAfter(moveIndex + 1);
  const final = stateAfter(moves.length);
  const move = moves[moveIndex];
  const answer = final.r;

  useEffect(() => {
    if (phase !== "animating") return;
    const raf = requestAnimationFrame(() => setRemoveTriggered(true));
    const timer = setTimeout(() => {
      setRemoveTriggered(false);
      const nextIndex = moveIndex + 1;
      if (nextIndex >= moves.length) {
        setPhase("done");
        onCorrect(problem.feedback.correct);
      } else {
        setMoveIndex(nextIndex);
        setPhase("idle");
      }
    }, 850);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [phase, moveIndex, moves.length, onCorrect, problem.feedback.correct]);

  const interactive = !disabled && phase === "idle";

  function handleDragEnd(event: DragEndEvent) {
    if (!interactive) return;
    if (event.over?.id !== TRASH_ID) return;
    if (move === "subtract") {
      setPhase("animating");
    } else {
      setWrongReason("delete");
      setPhase("wrong");
    }
  }

  function handleButton() {
    if (!interactive) return;
    if (move === "divide") {
      setPhase("animating");
    } else {
      setWrongReason("add");
      setPhase("wrong");
    }
  }

  function handleTryAgain() {
    setWrongReason(null);
    setRemoveTriggered(false);
    setPhase("idle");
  }

  function eqLabel(s: { c: number; k: number; r: number }) {
    const left =
      (s.c === 1 ? "" : s.c) + variable + (s.k !== 0 ? ` + ${s.k}` : "");
    return `${left} = ${s.r}`;
  }

  const questionText =
    moveIndex === 0
      ? problem.question
      : `Now the equation is ${eqLabel(cur)}. ${
          move === "divide"
            ? `${variable} is multiplied by ${coefficient} — how do we undo that to get one ${variable} alone?`
            : "What's the next move?"
        }`;

  const buttonLabel =
    move === "divide"
      ? `Divide both sides by ${coefficient}`
      : `＋ Add ${cur.k} to both sides`;

  const wrongMessage =
    wrongReason === "add"
      ? `Adding ${cur.k} to both sides only makes the left side bigger — the variable still isn't alone. Undo the +${cur.k} by removing it instead.`
      : `You can't just throw away the ${variable}'s — that loses the variable you're solving for. To undo multiplying by ${coefficient}, divide both sides by ${coefficient}.`;

  // --- Equation rendering -------------------------------------------------
  let leftSide: ReactNode;
  let rightSide: ReactNode;

  if (phase === "wrong" && wrongReason === "add") {
    leftSide = (
      <div className="flex items-center gap-2">
        <XRow count={cur.c} label={variable} />
        <span className="font-equation text-equation text-muted">+</span>
        <ConstantGroup count={cur.k + cur.k} added={cur.k} />
      </div>
    );
    rightSide = <UnitRow count={cur.r + cur.k} addedFrom={cur.r} />;
  } else if (phase === "wrong" && wrongReason === "delete") {
    leftSide = (
      <div className="flex items-center gap-2">
        <div className="flex h-9 items-center rounded-md border-2 border-dashed border-error/50 px-3 text-label text-error">
          no {variable} left
        </div>
      </div>
    );
    rightSide = <UnitRow count={cur.r} />;
  } else if (phase === "done") {
    leftSide = <XRow count={final.c} label={variable} />;
    rightSide = <UnitRow count={final.r} />;
  } else {
    // idle or animating
    const animating = phase === "animating" && removeTriggered;
    const xPart =
      move === "divide" ? (
        phase === "idle" ? (
          <Draggable disabled={!interactive}>
            <XGroup count={cur.c} label={variable} />
          </Draggable>
        ) : (
          <XGroup count={cur.c} label={variable} removeFrom={animating ? 1 : undefined} />
        )
      ) : (
        <XRow count={cur.c} label={variable} />
      );

    leftSide = (
      <div className="flex items-center gap-2">
        {xPart}
        {cur.k !== 0 && (
          <>
            <span className="font-equation text-equation text-muted">+</span>
            {move === "subtract" && phase === "idle" ? (
              <Draggable disabled={!interactive}>
                <ConstantGroup count={cur.k} />
              </Draggable>
            ) : (
              <ConstantGroup
                count={cur.k}
                removing={move === "subtract" && animating}
              />
            )}
          </>
        )}
      </div>
    );
    rightSide = (
      <UnitRow count={cur.r} removeFrom={animating ? next.r : undefined} />
    );
  }

  const showControls = phase === "idle" || phase === "animating";

  return (
    <div>
      <div className="rounded-xl border border-primary/30 bg-primary-light px-4 py-3">
        <p className="text-label font-semibold text-primary">Goal</p>
        <p className="mt-0.5 text-body text-text">{problem.prompt}</p>
      </div>

      <p className="mt-5 text-body text-text">{questionText}</p>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="mt-6 rounded-xl border border-border bg-bg/60 p-5">
          <div className="flex items-center justify-center gap-4">
            {leftSide}
            <span className="font-equation text-equation text-text">=</span>
            {rightSide}
          </div>

          {phase === "done" && (
            <p className="mt-4 text-center font-equation text-equation text-text">
              {variable} = {answer}
            </p>
          )}

          {showControls && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <TrashZone disabled={!interactive} />
              <div className="flex items-center gap-2 text-label text-muted">
                <span className="h-px w-8 bg-border" />
                or
                <span className="h-px w-8 bg-border" />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleButton}
                disabled={!interactive}
              >
                {buttonLabel}
              </Button>
            </div>
          )}
        </div>
      </DndContext>

      {phase === "wrong" && (
        <div className="mt-4 rounded-lg border border-error/40 bg-error/5 px-4 py-3">
          <p className="text-body text-error">{wrongMessage}</p>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={handleTryAgain}>
              Try Again
            </Button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mt-4 rounded-lg border border-success/40 bg-success/10 px-4 py-3">
          <p className="text-body text-success">{problem.feedback.correct}</p>
        </div>
      )}
    </div>
  );
}
