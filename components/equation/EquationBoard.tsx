"use client";

import { useDroppable } from "@dnd-kit/core";
import { EquationTile } from "./EquationTile";

interface EquationBoardProps {
  left: string[];
  right: string[];
  tileStates?: Record<string, "default" | "correct" | "error">;
  animatingTile?: string | null;
  disabledTiles?: Set<string>;
}

function DropZone({
  id,
  tiles,
  tileStates,
  animatingTile,
  disabledTiles,
}: {
  id: "left" | "right";
  tiles: string[];
  tileStates?: Record<string, "default" | "correct" | "error">;
  animatingTile?: string | null;
  disabledTiles?: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[52px] flex-1 flex-wrap items-center justify-center gap-2 rounded-lg border-2 border-dashed p-2 transition-colors ${
        isOver ? "border-primary bg-primary-light/50" : "border-transparent"
      }`}
    >
      {tiles.map((tile, i) => {
        const tileId = `${id}-${tile}-${i}`;
        return (
          <EquationTile
            key={tileId}
            id={tileId}
            label={tile}
            disabled={disabledTiles?.has(tileId)}
            state={tileStates?.[tileId] ?? "default"}
            animating={animatingTile === tileId}
          />
        );
      })}
    </div>
  );
}

export function EquationBoard({
  left,
  right,
  tileStates,
  animatingTile,
  disabledTiles,
}: EquationBoardProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <DropZone
        id="left"
        tiles={left}
        tileStates={tileStates}
        animatingTile={animatingTile}
        disabledTiles={disabledTiles}
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
