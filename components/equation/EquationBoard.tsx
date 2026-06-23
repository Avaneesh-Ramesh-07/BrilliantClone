"use client";

import { useDroppable } from "@dnd-kit/core";
import { EquationTile } from "./EquationTile";
import {
  FractionGlyph,
  isNumericTile,
  parseDivisorTile,
} from "./FractionGlyph";

interface EquationBoardProps {
  left: string[];
  right: string[];
  tileStates?: Record<string, "default" | "correct" | "error">;
  animatingTile?: string | null;
  disabledTiles?: Set<string>;
  interactive?: boolean;
}

function DropZone({
  id,
  tiles,
  tileStates,
  animatingTile,
  disabledTiles,
  interactive = true,
}: {
  id: "left" | "right";
  tiles: string[];
  tileStates?: Record<string, "default" | "correct" | "error">;
  animatingTile?: string | null;
  disabledTiles?: Set<string>;
  interactive?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  // A number followed by a "÷N" tile is shown as a single fraction (e.g. 10/2)
  // so division reads as a fraction rather than a confusing "divides by" tile.
  const divisor = tiles.length === 2 ? parseDivisorTile(tiles[1]) : null;
  const asFraction = divisor !== null && isNumericTile(tiles[0]);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[52px] flex-1 flex-wrap items-center justify-center gap-2 rounded-lg border-2 border-dashed p-2 transition-colors ${
        isOver ? "border-primary bg-primary-light/50" : "border-transparent"
      }`}
    >
      {asFraction ? (
        <div className="flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-surface px-3 py-2 font-equation text-equation text-text">
          <FractionGlyph numerator={tiles[0]} denominator={divisor} />
        </div>
      ) : (
        tiles.map((tile, i) => {
          const tileId = `${id}-${tile}-${i}`;
          return (
            <EquationTile
              key={tileId}
              id={tileId}
              label={tile}
              disabled={!interactive || disabledTiles?.has(tileId)}
              state={tileStates?.[tileId] ?? "default"}
              animating={animatingTile === tileId}
            />
          );
        })
      )}
    </div>
  );
}

export function EquationBoard({
  left,
  right,
  tileStates,
  animatingTile,
  disabledTiles,
  interactive = true,
}: EquationBoardProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <DropZone
        id="left"
        tiles={left}
        tileStates={tileStates}
        animatingTile={animatingTile}
        disabledTiles={disabledTiles}
        interactive={interactive}
      />
      <span className="px-1 font-equation text-[22px] font-medium text-text">
        =
      </span>
      <DropZone
        id="right"
        tiles={right}
        tileStates={tileStates}
        animatingTile={animatingTile}
        disabledTiles={disabledTiles}
        interactive={interactive}
      />
    </div>
  );
}

export function parseTileId(tileId: string): {
  side: "left" | "right";
  tile: string;
  index: number;
} {
  const [side, ...rest] = tileId.split("-");
  const index = parseInt(rest[rest.length - 1], 10);
  const tile = rest.slice(0, -1).join("-");
  return {
    side: side as "left" | "right",
    tile,
    index,
  };
}

export function buildTileId(
  side: "left" | "right",
  tile: string,
  index: number
): string {
  return `${side}-${tile}-${index}`;
}
