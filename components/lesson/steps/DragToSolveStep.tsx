"use client";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  EquationBoard,
  parseTileId,
} from "@/components/equation/EquationBoard";
import { parseDivisorTile } from "@/components/equation/FractionGlyph";
import { GridPlotVisual } from "@/components/equation/GridPlotVisual";
import {
  applyDivisionToCoefficient,
  equationMatches,
  isVariableTile,
  resolveMoveEquation,
  simplifyEquationAnswer,
} from "@/lib/equation";
import type { DragMove, DragToSolveProblem, EquationState } from "@/types/lesson";

interface DragToSolveStepProps {
  problem: DragToSolveProblem;
  onCorrect: (feedback: string) => void;
  onIncorrect: (feedback: string) => void;
  onReset?: () => void;
  disabled?: boolean;
}

function getMoveTarget(move: DragMove) {
  return {
    targetTile: move.targetTile,
    targetSide: move.targetSide,
    expected: { left: move.resultLeft, right: move.resultRight },
  };
}

function sumNumericTiles(tiles: string[]): string {
  const total = tiles.reduce((sum, tile) => {
    if (tile.startsWith("+")) return sum + parseFloat(tile.slice(1));
    if (tile.startsWith("−") || tile.startsWith("-"))
      return sum - parseFloat(tile.slice(1));
    const n = parseFloat(tile);
    return isNaN(n) ? sum : sum + n;
  }, 0);
  return String(total);
}

function prepareNextEquation(
  current: EquationState,
  nextMove: DragMove
): EquationState {
  const numericRight = sumNumericTiles(current.right);
  const left = current.left.filter((t) => t.endsWith("x"));
  if (!left.includes(nextMove.targetTile)) {
    left.push(nextMove.targetTile);
  }
  return { left, right: [numericRight] };
}

export function DragToSolveStep({
  problem,
  onCorrect,
  onIncorrect,
  onReset,
  disabled,
}: DragToSolveStepProps) {
  const moves = problem.moves ?? [];
  const isMultiMove = moves.length > 0;

  const [equation, setEquation] = useState<EquationState>(problem.equation);
  const [moveIndex, setMoveIndex] = useState(0);
  const [animatingTile, setAnimatingTile] = useState<string | null>(null);
  const [errorTileId, setErrorTileId] = useState<string | null>(null);
  const [awaitingSimplify, setAwaitingSimplify] = useState(false);
  const [simplified, setSimplified] = useState(false);
  const [showVisual, setShowVisual] = useState(false);
  const [intermediateLabel, setIntermediateLabel] = useState<string | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    })
  );

  const flashError = (tileId: string) => {
    setErrorTileId(tileId);
    setTimeout(() => setErrorTileId(null), 400);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (disabled || simplified || awaitingSimplify) return;

      const { active, over } = event;
      if (!over) return;

      const { side: fromSide, tile } = parseTileId(active.id as string);
      const toSide = over.id as "left" | "right";
      if (fromSide === toSide) return;

      const target = isMultiMove
        ? getMoveTarget(moves[moveIndex])
        : {
            targetTile: problem.targetTile!,
            targetSide: problem.targetSide!,
            expected: problem.solution!,
          };

      if (isMultiMove && moveIndex === 0 && moves.length > 1) {
        const secondMove = moves[1];
        if (
          tile === secondMove.targetTile &&
          secondMove.bounceBackOnEarlyAttempt
        ) {
          onIncorrect(
            problem.feedback.incorrect_wrong_order ??
              "Undo addition and subtraction first."
          );
          flashError(active.id as string);
          return;
        }
      }

      if (isVariableTile(tile)) {
        onIncorrect(
          problem.feedback.incorrect_moved_x ??
            "Move the constant, not the variable."
        );
        flashError(active.id as string);
        return;
      }

      if (fromSide === "right" && toSide === "left") {
        onIncorrect(
          problem.feedback.incorrect_moved_right ??
            "Drag the term from the other side."
        );
        flashError(active.id as string);
        return;
      }

      if (tile !== target.targetTile || toSide !== target.targetSide) {
        onIncorrect(
          problem.feedback.incorrect_wrong_tile ?? "Drag the correct tile across."
        );
        flashError(active.id as string);
        return;
      }

      setAnimatingTile(active.id as string);
      setTimeout(() => setAnimatingTile(null), 200);

      let newEquation = resolveMoveEquation(equation, fromSide, tile);

      if (tile.startsWith("÷")) {
        newEquation = applyDivisionToCoefficient(newEquation);
      }

      if (!equationMatches(newEquation, target.expected)) {
        onIncorrect(problem.feedback.incorrect_wrong_tile ?? "Try again.");
        return;
      }

      setEquation(newEquation);

      if (isMultiMove && moveIndex < moves.length - 1) {
        setIntermediateLabel(moves[moveIndex].intermediateLabel ?? null);
        const nextMove = moves[moveIndex + 1];
        setEquation(prepareNextEquation(newEquation, nextMove));
        setMoveIndex((i) => i + 1);
        return;
      }

      setAwaitingSimplify(true);
    },
    [
      disabled,
      simplified,
      awaitingSimplify,
      equation,
      isMultiMove,
      moves,
      moveIndex,
      problem,
      onIncorrect,
    ]
  );

  const currentTargetTile = isMultiMove
    ? moves[moveIndex]?.targetTile
    : problem.targetTile;
  const divisionDivisor = currentTargetTile
    ? parseDivisorTile(currentTargetTile)
    : null;
  const isDivisionMove =
    divisionDivisor !== null && !awaitingSimplify && !simplified;

  const applyDivision = useCallback(() => {
    if (disabled || divisionDivisor === null || !currentTargetTile) return;

    const target = isMultiMove
      ? getMoveTarget(moves[moveIndex])
      : {
          targetTile: problem.targetTile!,
          targetSide: problem.targetSide!,
          expected: problem.solution!,
        };

    let newEquation = resolveMoveEquation(equation, "left", currentTargetTile);
    newEquation = applyDivisionToCoefficient(newEquation);

    if (!equationMatches(newEquation, target.expected)) {
      onIncorrect(problem.feedback.incorrect_wrong_tile ?? "Try again.");
      return;
    }

    setEquation(newEquation);

    if (isMultiMove && moveIndex < moves.length - 1) {
      setIntermediateLabel(moves[moveIndex].intermediateLabel ?? null);
      const nextMove = moves[moveIndex + 1];
      setEquation(prepareNextEquation(newEquation, nextMove));
      setMoveIndex((i) => i + 1);
      return;
    }

    setAwaitingSimplify(true);
  }, [
    disabled,
    divisionDivisor,
    currentTargetTile,
    equation,
    isMultiMove,
    moves,
    moveIndex,
    problem,
    onIncorrect,
  ]);

  function handleSimplify() {
    const answer = simplifyEquationAnswer(equation.left, equation.right);
    if (answer === problem.answer) {
      setSimplified(true);
      setShowVisual(true);
      setAwaitingSimplify(false);
      onCorrect(problem.feedback.correct);
    } else {
      onIncorrect("Simplify the right side to find x.");
    }
  }

  function resetBoard() {
    setEquation(problem.equation);
    setMoveIndex(0);
    setAnimatingTile(null);
    setErrorTileId(null);
    setAwaitingSimplify(false);
    setSimplified(false);
    setShowVisual(false);
    setIntermediateLabel(null);
    onReset?.();
  }

  const canReset =
    !simplified &&
    (moveIndex > 0 ||
      awaitingSimplify ||
      equation.left.join() !== problem.equation.left.join() ||
      equation.right.join() !== problem.equation.right.join());

  return (
    <div>
      <p className="text-body text-text">{problem.prompt}</p>

      {intermediateLabel && (
        <p className="mt-2 font-equation text-equation text-primary">
          {intermediateLabel}
        </p>
      )}

      <div className="mt-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <EquationBoard
            left={
              isDivisionMove
                ? equation.left.filter((t) => parseDivisorTile(t) === null)
                : equation.left
            }
            right={equation.right}
            animatingTile={animatingTile}
            interactive={!isDivisionMove}
            tileStates={errorTileId ? { [errorTileId]: "error" } : undefined}
          />
        </DndContext>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {isDivisionMove && !disabled && (
          <Button type="button" onClick={applyDivision} variant="secondary">
            Divide both sides by {divisionDivisor}
          </Button>
        )}
        {awaitingSimplify && !simplified && (
          <Button type="button" onClick={handleSimplify} variant="secondary">
            Simplify
          </Button>
        )}
        {canReset && !disabled && (
          <Button
            type="button"
            onClick={resetBoard}
            variant="ghost"
            className="border border-border"
          >
            Reset
          </Button>
        )}
      </div>

      {simplified && (
        <p className="mt-3 font-equation text-equation text-success">
          x = {problem.answer}
        </p>
      )}

      {showVisual && problem.visual && (
        <GridPlotVisual visual={problem.visual} animation={problem.animation} />
      )}
    </div>
  );
}
