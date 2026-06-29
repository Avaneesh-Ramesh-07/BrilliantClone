"use client";

import type { MoveId } from "@/lib/arena/moves";
import {
  NinjaFighter,
  type FighterAction,
} from "@/components/arena/NinjaFighter";

/**
 * The currently-playing strike. `attacker` is from the LOCAL client's point of
 * view: "self" means MY fighter (left) throws the move and the opponent recoils;
 * "opponent" means the right fighter throws it and MY fighter recoils. `id`
 * increments per attack so the animation restarts even on a repeat of the same
 * move.
 */
export interface AttackState {
  attacker: "self" | "opponent";
  move: MoveId;
  id: number;
}

interface FightSceneProps {
  attack: AttackState | null;
  /**
   * Backstop recoil id for the LOCAL fighter, bumped whenever my HP drops via
   * realtime even if the attacker's broadcast never arrived. Lets the defender
   * always stagger.
   */
  selfRecoilId: number;
  isComplete: boolean;
  /** True when the LOCAL player lost the completed duel (slumped KO pose). */
  selfDefeated: boolean;
}

/**
 * The middle-of-screen dojo arena. The LOCAL fighter always stands on the left
 * facing right; the opponent stands on the right facing left. Both clients
 * render their own player on the left, so a single broadcast move shows up
 * correctly mirrored on each screen (attacker strikes, defender recoils).
 */
export function FightScene({
  attack,
  selfRecoilId,
  isComplete,
  selfDefeated,
}: FightSceneProps) {
  // Resolve each fighter's current action + a key that restarts its animation.
  let selfAction: FighterAction = "idle";
  let selfKey = 0;
  let oppAction: FighterAction = "idle";
  let oppKey = 0;

  if (attack) {
    if (attack.attacker === "self") {
      selfAction = attack.move;
      selfKey = attack.id;
      oppAction = "recoil";
      // Offset so the opponent recoil key never collides with its own attack id.
      oppKey = attack.id + 1_000_000;
    } else {
      oppAction = attack.move;
      oppKey = attack.id;
      selfAction = "recoil";
      selfKey = attack.id + 1_000_000;
    }
  }

  // Backstop: if my HP dropped (defender) prefer the guaranteed recoil id so a
  // missed broadcast still staggers me. A larger id wins so it replays.
  if (selfRecoilId > 0 && !(attack && attack.attacker === "self")) {
    selfAction = "recoil";
    selfKey = selfRecoilId + 2_000_000;
  }

  return (
    <div className="af-stage flex flex-1 items-end justify-between">
      <div className="af-slot">
        <NinjaFighter
          tone="you"
          facing="right"
          action={selfAction}
          animKey={selfKey}
          defeated={isComplete && selfDefeated}
          className="af-svg"
        />
      </div>

      <div className="af-slot">
        <NinjaFighter
          tone="enemy"
          facing="left"
          action={oppAction}
          animKey={oppKey}
          defeated={isComplete && !selfDefeated}
          className="af-svg"
        />
      </div>
    </div>
  );
}
