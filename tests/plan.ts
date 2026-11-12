import type { BuildingKind } from '../src/data/buildings';
import { MAP_SIZE } from '../src/data/config';
import { build, buildingAt } from '../src/sim/game';
import type { Game } from '../src/sim/types';

const C = MAP_SIZE / 2;

/** A plain but sensible player: towers in rings round the Carrot, no walls. */
export const PLAN: [BuildingKind, number, number][] = [
  ['launcher', C - 1, C - 3],
  ['launcher', C + 2, C],
  ['tesla', C - 3, C - 1],
  ['launcher', C, C + 2],
  ['tesla', C + 2, C - 3],
  ['tesla', C - 3, C + 2],
  ['tesla', C + 2, C + 2],
  ['launcher', C - 3, C - 3],
  ['tesla', C, C - 4],
  ['tesla', C + 3, C - 1],
  ['tesla', C - 1, C + 3],
  ['tesla', C - 4, C],
  ['launcher', C + 4, C + 4],
  ['launcher', C - 5, C + 4],
  ['tesla', C + 4, C - 4],
  ['tesla', C - 5, C - 5],
  ['tesla', C - 1, C - 6],
  ['tesla', C + 5, C],
  ['tesla', C, C + 5],
  ['tesla', C - 6, C - 1],
  ['launcher', C + 1, C - 2],
  ['launcher', C - 2, C + 1],
];

/** Spends as far down the plan as the bank allows, rebuilding anything lost. */
export function buyFromPlan(g: Game): void {
  for (const [kind, x, y] of PLAN) {
    if (!buildingAt(g, x, y) && !build(g, kind, x, y)) return;
  }
}
