import type { BuildingKind } from '../src/data/buildings';
import { build, buildCost, buildingAt } from '../src/sim/game';
import type { Game } from '../src/sim/types';

/**
 * A plain but sensible player: farms and Hutches hugging the Carrot (which
 * sits on tiles 11-12), towers in rings round them, no walls.
 */
export const PLAN: [BuildingKind, number, number][] = [
  ['launcher', 11, 9],
  ['launcher', 13, 12],
  ['patch', 10, 10],
  ['patch', 13, 10],
  ['hutch', 10, 13],
  ['launcher', 12, 14],
  ['patch', 13, 13],
  ['launcher', 9, 11],
  ['wheel', 11, 10],
  ['tesla', 9, 9],
  ['tesla', 14, 9],
  ['hutch', 12, 10],
  ['patch', 10, 12],
  ['tesla', 14, 14],
  ['wheel', 12, 13],
  ['tesla', 9, 14],
  ['hutch', 11, 13],
  ['patch', 10, 11],
  ['wheel', 13, 11],
  ['tesla', 11, 8],
  ['tesla', 15, 11],
  ['launcher', 8, 8],
  ['hutch', 14, 12],
  ['wheel', 14, 11],
  ['tesla', 12, 15],
  ['tesla', 8, 12],
  ['launcher', 15, 15],
  ['launcher', 8, 15],
  ['launcher', 15, 8],
  ['hutch', 9, 12],
  ['wheel', 9, 13],
  ['tesla', 11, 16],
  ['tesla', 16, 12],
  ['wheel', 14, 13],
  ['tesla', 7, 11],
  ['tesla', 12, 7],
  ['hutch', 14, 10],
  ['wheel', 9, 10],
  ['tesla', 16, 9],
  ['tesla', 7, 14],
  ['launcher', 16, 14],
  ['launcher', 7, 9],
  ['tesla', 9, 16],
  ['tesla', 14, 16],
  ['hutch', 10, 14],
  ['wheel', 13, 14],
  ['tesla', 10, 6],
  ['tesla', 13, 17],
  ['wheel', 10, 9],
  ['tesla', 17, 10],
  ['tesla', 6, 13],
  ['hutch', 13, 15],
  ['wheel', 13, 9],
  ['tesla', 13, 6],
  ['tesla', 10, 17],
  ['wheel', 10, 15],
  ['tesla', 17, 13],
  ['tesla', 6, 10],
];

/**
 * Buys down the plan in order, rebuilding anything lost. An item that is
 * short of bunnies is skipped so a lost Hutch can be replaced; an item that
 * is short of carrots ends the shopping.
 */
export function buyFromPlan(g: Game): void {
  for (const [kind, x, y] of PLAN) {
    if (buildingAt(g, x, y) || build(g, kind, x, y)) continue;
    if (g.carrots < buildCost(g, kind)) return;
  }
}
