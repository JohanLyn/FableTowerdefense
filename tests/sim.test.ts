import { describe, expect, it } from 'vitest';
import { MAP_SIZE, TICK_RATE } from '../src/data/config';
import { NIGHTS } from '../src/data/waves';
import { build, canPlace, createGame, sell, startNight, step } from '../src/sim/game';
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

  it('is usually won by a plain farm-and-tower build with no walls', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const wins = seeds.filter((seed) => playPlan(seed).phase === 'won').length;
    // Balance guard: beatable without walls, but not a walkover.
    expect(wins).toBeGreaterThanOrEqual(6);
    expect(NIGHTS.length).toBe(10);
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

  it('needs a spare bunny for every crewed building', () => {
    const g = createGame(1);
    g.carrots = 10_000;
    for (let i = 0; i < 4; i++) expect(build(g, 'launcher', 4 + i, 4)).toBe(true);
    expect(build(g, 'launcher', 8, 4)).toBe(false); // all four bunnies are busy
    expect(build(g, 'hutch', 4, 6)).toBe(true); // arrives with a pair
    expect(g.bunnies).toBe(6);
    expect(build(g, 'launcher', 8, 4)).toBe(true);
  });

  it('grows bunnies and carrots at dawn', () => {
    const g = createGame(1);
    g.carrots = 10_000;
    build(g, 'hutch', C - 3, C);
    build(g, 'patch', C + 3, C);
    for (let i = 0; i < 6; i++) build(g, 'launcher', C - 3 + i, C - 3);
    expect(g.bunnies).toBe(6);
    const before = g.carrots;
    runNight(g);
    expect(g.phase).toBe('day');
    // One Hutch plus one for the first five bunnies.
    expect(g.bunnies).toBe(8);
    const kills = NIGHTS[0].groups[0].count * 4;
    expect(g.carrots).toBe(before + NIGHTS[0].reward + kills + 20);
  });

  it('browns out when Tesla Hutches outdraw the Hamster Wheels', () => {
    const g = createGame(1);
    g.carrots = 10_000;
    build(g, 'tesla', 5, 5);
    expect(g.brownout).toBe(true);
    build(g, 'wheel', 6, 5);
    expect(g.brownout).toBe(false);
    expect([g.voltDraw, g.voltSupply]).toEqual([5, 10]);
  });

  it('switches off the newest buildings when a Hutch is lost', () => {
    const g = createGame(1);
    g.carrots = 10_000;
    for (let i = 0; i < 4; i++) build(g, 'launcher', 4 + i, 4);
    build(g, 'hutch', 4, 6);
    build(g, 'launcher', 8, 4);
    build(g, 'launcher', 9, 4);
    sell(g, 4, 6);
    expect(g.bunnies).toBe(4);
    const staffed = [...g.buildings.values()].filter((b) => b.kind === 'launcher').map((b) => b.staffed);
    expect(staffed).toEqual([true, true, true, true, false, false]);
  });
});
