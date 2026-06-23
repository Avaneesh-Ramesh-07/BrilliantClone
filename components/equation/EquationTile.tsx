"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { FractionGlyph, parseDivisorTile } from "./FractionGlyph";

interface EquationTileProps {
  id: string;
  label: string;
  disabled?: boolean;
  state?: "default" | "dragging" | "correct" | "error";
  animating?: boolean;
}

export function EquationTile({
  id,
  label,
  disabled,
  state = "default",
  animating,
}: EquationTileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      disabled,
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const divisor = parseDivisorTile(label);

  const stateClasses = {
    default: "border-border bg-surface",
    dragging: "border-primary border-2 bg-primary-light z-10",
    correct: "border-success bg-success/5 animate-tile-snap",
    error: "border-error animate-tile-shake",
  };

  const cursor = disabled
    ? "cursor-default"
    : "cursor-grab active:cursor-grabbing";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(disabled ? {} : listeners)}
      {...attributes}
      className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border px-3 py-2 font-equation text-equation touch-none select-none ${cursor} ${stateClasses[isDragging ? "dragging" : state]} ${animating ? "animate-sign-flip" : ""}`}
      aria-label={divisor !== null ? `one over ${divisor}` : label}
    >
      {divisor !== null ? (
        <FractionGlyph numerator="1" denominator={divisor} />
      ) : (
        label
      )}
    </div>
  );
}
