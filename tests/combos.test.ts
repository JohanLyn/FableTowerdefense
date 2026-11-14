import { describe, expect, it } from 'vitest';
import { COMBO_TUNING, STATUS_TIME } from '../src/data/statuses';
import { TICK_RATE } from '../src/data/config';
import { applyStatus, build, buildingAt, createGame, spawnAt, startNight, step, towerRange } from '../src/sim/game';
import type { Game, GameEvent } from '../src/sim/types';

/** A night-time game with unlimited carrots and bunnies and no wave of its own. */
function sandbox(): Game {
  const g = createGame(1);
  g.carrots = 100_000;
  for (let i = 0; i < 5; i++) build(g, 'hutch', 3 + i, 20);
  g.bunnies = g.housing;
  startNight(g);
  g.spawnQueue.length = 0;
  return g;
}

function run(g: Game, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * TICK_RATE; i++) {
    // Keep the night alive even if every enemy dies.
    g.spawnQueue.push({ tick: Number.MAX_SAFE_INTEGER, kind: 'gnome', dir: 'N' });
    step(g);
    g.spawnQueue.length = 0;
    events.push(...g.events);
    g.events.length = 0;
  }
  return events;
}

const combos = (events: GameEvent[]): string[] => events.flatMap((e) => (e.type === 'combo' ? [e.combo] : []));

describe('statuses', () => {
  it('refreshes the same status and expires it', () => {
    const g = sandbox();
    const e = spawnAt(g, 'gnome', 3, 3);
    applyStatus(g, e, 'wet');
    run(g, 1);
    applyStatus(g, e, 'wet');
    expect(e.statusTime).toBe(STATUS_TIME.wet);
    run(g, STATUS_TIME.wet + 0.1);
    expect(e.status).toBeNull();
  });

  it('slows Sticky enemies and burns Spicy ones', () => {
    const g = sandbox();
    const plain = spawnAt(g, 'gnome', 2, 3);
    const sticky = spawnAt(g, 'gnome', 2, 5);
    const spicy = spawnAt(g, 'gnome', 2, 7);
    applyStatus(g, sticky, 'sticky');
    applyStatus(g, spicy, 'spicy');
    run(g, 1);
    const walked = (e: typeof plain, y: number): number => Math.hypot(e.x - 2, e.y - y);
    expect(walked(sticky, 5)).toBeLessThan(walked(plain, 3) * 0.6);
    expect(spicy.hp).toBeCloseTo(spicy.maxHp - 5, 0);
  });
});

describe('combos', () => {
  it('uses up both statuses', () => {
    const g = sandbox();
    const e = spawnAt(g, 'gnome', 3, 3);
    applyStatus(g, e, 'sticky');
    applyStatus(g, e, 'spicy');
    expect(e.status).toBeNull();
    expect(combos(g.events)).toEqual(['caramelized']);
  });

  it('Caramelized: takes 50% more damage', () => {
    const g = sandbox();
    const e = spawnAt(g, 'mower', 3, 3);
    applyStatus(g, e, 'sticky');
    applyStatus(g, e, 'spicy');
    applyStatus(g, e, 'wet');
    applyStatus(g, e, 'zapped'); // jolt of 14, caramelized to 21
    expect(e.hp).toBe(e.maxHp - COMBO_TUNING.conductedJolt * 1.5);
  });

  it('Steamed: hurts neighbours', () => {
    const g = sandbox();
    const e = spawnAt(g, 'mower', 3, 3);
    const near = spawnAt(g, 'mower', 4, 3);
    const far = spawnAt(g, 'mower', 8, 3);
    applyStatus(g, e, 'wet');
    applyStatus(g, e, 'spicy');
    expect(near.hp).toBe(near.maxHp - COMBO_TUNING.steamedDamage);
    expect(far.hp).toBe(far.maxHp);
  });

  it('Static Cling: pulls neighbours in and stuns them', () => {
    const g = sandbox();
    const e = spawnAt(g, 'gnome', 4, 4);
    const other = spawnAt(g, 'gnome', 6, 4);
    applyStatus(g, e, 'sticky');
    applyStatus(g, e, 'zapped');
    expect(other.x).toBeCloseTo(6 - COMBO_TUNING.clingPull);
    expect(other.stun).toBeGreaterThan(0);
  });

  it('Syrup Slick: leaves a slowing puddle', () => {
    const g = sandbox();
    const e = spawnAt(g, 'gnome', 3, 3);
    applyStatus(g, e, 'wet');
    applyStatus(g, e, 'sticky');
    expect(g.zones).toHaveLength(1);
    const plain = spawnAt(g, 'gnome', 3, 9);
    run(g, 1);
    expect(Math.hypot(e.x - 3, e.y - 3)).toBeLessThan(Math.hypot(plain.x - 3, plain.y - 9) * 0.6);
    run(g, COMBO_TUNING.slickTime);
    expect(g.zones).toHaveLength(0);
  });

  it('Flash Fried: hits harder the more hurt the enemy is', () => {
    const g = sandbox();
    const fresh = spawnAt(g, 'mower', 3, 3);
    const hurt = spawnAt(g, 'mower', 3, 6);
    hurt.hp = 40;
    for (const e of [fresh, hurt]) {
      applyStatus(g, e, 'zapped');
      applyStatus(g, e, 'spicy');
    }
    expect(fresh.maxHp - fresh.hp).toBe(COMBO_TUNING.friedBase);
    expect(40 - hurt.hp).toBeCloseTo(COMBO_TUNING.friedBase + (hurt.maxHp - 40) * COMBO_TUNING.friedMissing);
  });

  it('Conducted: lightning doubles on Wet enemies', () => {
    const g = sandbox();
    build(g, 'wheel', 5, 6);
    build(g, 'tesla', 5, 8);
    const dry = spawnAt(g, 'mower', 5.5, 10.5);
    dry.stun = 99;
    const events = run(g, 0.1);
    expect(dry.maxHp - dry.hp).toBe(9);
    expect(combos(events)).toEqual([]);

    const wet = spawnAt(g, 'mower', 5.5, 9.6);
    wet.stun = 99;
    applyStatus(g, wet, 'wet');
    expect(combos(run(g, 1.1))).toContain('conducted');
    expect(wet.maxHp - wet.hp).toBe(18);
  });
});

describe('towers', () => {
  it('Sprinkler wets, Honey Pot sticks, Chili Flamer spices', () => {
    for (const [kind, status] of [
      ['sprinkler', 'wet'],
      ['honey', 'sticky'],
      ['flamer', 'spicy'],
    ] as const) {
      const g = sandbox();
      build(g, kind, 5, 8);
      const e = spawnAt(g, 'mower', 5.5, 10);
      e.stun = 99;
      run(g, 0.2);
      expect(e.status).toBe(status);
    }
  });

  it('Thumper stuns everything around it', () => {
    const g = sandbox();
    build(g, 'thumper', 5, 8);
    const a = spawnAt(g, 'mower', 5.5, 10);
    const b = spawnAt(g, 'mower', 4, 8.5);
    run(g, 0.1);
    expect(a.stun).toBeGreaterThan(1);
    expect(b.stun).toBeGreaterThan(1);
  });

  it('Cabbage Mortar splashes far targets and ignores close ones', () => {
    const g = sandbox();
    build(g, 'mortar', 5, 8);
    const close = spawnAt(g, 'mower', 5.5, 10);
    close.stun = 99;
    run(g, 3);
    expect(close.hp).toBe(close.maxHp);
    const a = spawnAt(g, 'mower', 5.5, 14);
    const b = spawnAt(g, 'mower', 6.3, 14);
    a.stun = b.stun = 99;
    run(g, 2);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('Beehive needs no bunny and stays on one target', () => {
    const g = sandbox();
    const free = g.bunnies - g.crewUsed;
    build(g, 'beehive', 5, 8);
    expect(g.bunnies - g.crewUsed).toBe(free);
    const near = spawnAt(g, 'mower', 5.5, 10);
    const other = spawnAt(g, 'mower', 7.5, 9);
    near.stun = other.stun = 99;
    run(g, 3);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(other.hp).toBe(other.maxHp);
  });
});

describe('adjacency links', () => {
  it('Sprinkler beside a Tesla Hutch makes its first hit conduct', () => {
    const g = sandbox();
    build(g, 'wheel', 5, 6);
    build(g, 'tesla', 5, 8);
    build(g, 'sprinkler', 4, 8);
    expect(buildingAt(g, 5, 8)!.soak).toBe(true);
    expect(g.links.map((l) => l.kind)).toContain('soak');
  });

  it('Hamster Wheel beside a Tesla Hutch shrugs off brown-outs', () => {
    const g = sandbox();
    build(g, 'tesla', 5, 8);
    build(g, 'tesla', 9, 8);
    build(g, 'tesla', 12, 5);
    build(g, 'wheel', 5, 9);
    expect(g.brownout).toBe(true);
    expect(buildingAt(g, 5, 8)!.wired).toBe(true);
    expect(buildingAt(g, 9, 8)!.wired).toBe(false);
  });

  it('Honey Pot beside a Beehive sends the bees after Sticky enemies', () => {
    const g = sandbox();
    build(g, 'beehive', 5, 8);
    build(g, 'honey', 5, 7);
    expect(buildingAt(g, 5, 8)!.honey).toBe(true);
    const near = spawnAt(g, 'mower', 5.5, 10);
    const sticky = spawnAt(g, 'mower', 8.5, 10.5);
    near.stun = sticky.stun = 99;
    applyStatus(g, sticky, 'sticky');
    run(g, 1.5);
    expect(near.hp).toBe(near.maxHp);
    expect(sticky.hp).toBeLessThan(sticky.maxHp);
  });

  it('three of the same tower in a row get more range', () => {
    const g = sandbox();
    build(g, 'launcher', 5, 8);
    build(g, 'launcher', 6, 8);
    expect(buildingAt(g, 5, 8)!.row).toBe(false);
    build(g, 'launcher', 7, 8);
    for (const x of [5, 6, 7]) expect(towerRange(buildingAt(g, x, 8)!)).toBeCloseTo(5.5 * 1.15);
  });
});
