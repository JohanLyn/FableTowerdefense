import { describe, expect, it } from 'vitest';
import { MAP_SIZE, TICK_RATE } from '../src/data/config';
import { NIGHTS } from '../src/data/waves';
import { build, canPlace, createGame, startNight, step } from '../src/sim/game';
import type { Game } from '../src/sim/types';
import { buyFromPlan } from './plan';

const C = MAP_SIZE / 2;

/** Runs until the game ends or the next day begins. */
function runNight(g: Game): void {
  startNight(g);
  for (let i = 0; i < TICK_RATE * 600 && g.phase === 'night'; i++) step(g);
}

function snapshot(g: Game): string {
  return JSON.stringify({
    tick: g.tick,
    phase: g.phase,
    night: g.night,
    carrots: g.carrots,
    kills: g.kills,
    buildings: [...g.buildings.values()].map((b) => [b.kind, b.x, b.y, b.hp]),
  });
}

function playPlan(seed: number): Game {
  const g = createGame(seed);
  while (g.phase === 'day') {
    buyFromPlan(g);
    runNight(g);
  }
  return g;
}

describe('simulation', () => {
  it('is deterministic for a given seed', () => {
    expect(snapshot(playPlan(7))).toBe(snapshot(playPlan(7)));
  });

  it('is lost without any defences', () => {
    const g = createGame(1);
    while (g.phase === 'day') runNight(g);
    expect(g.phase).toBe('lost');
    expect(g.night).toBeLessThanOrEqual(3);
  });

  it('is usually won by a plain tower ring with no walls', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const wins = seeds.filter((seed) => playPlan(seed).phase === 'won').length;
    // Balance guard: beatable without walls, but not a walkover.
    expect(wins).toBeGreaterThanOrEqual(6);
    expect(NIGHTS.length).toBe(5);
  });

  it('lets enemies chew through a complete wall', () => {
    const g = createGame(3);
    g.carrots = 10_000;
    for (let i = -3; i <= 4; i++) {
      for (const [x, y] of [
        [C + i, C - 4],
        [C + i, C + 5],
        [C - 4, C + i],
        [C + 5, C + i],
      ]) {
        if (canPlace(g, 'hedge', x, y)) build(g, 'hedge', x, y);
      }
    }
    const carrot = g.buildings.get(g.carrotId)!;
    startNight(g);
    for (let i = 0; i < TICK_RATE * 300 && g.phase === 'night' && carrot.hp === carrot.maxHp; i++) step(g);
    expect(carrot.hp).toBeLessThan(carrot.maxHp);
  });

  it('refuses illegal builds', () => {
    const g = createGame(1);
    expect(build(g, 'launcher', 0, 0)).toBe(false); // spawn margin
    expect(build(g, 'launcher', C, C)).toBe(false); // on the Carrot
    g.carrots = 0;
    expect(build(g, 'hedge', 5, 5)).toBe(false); // cannot afford
  });
});
