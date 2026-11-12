import { BUILDINGS, type BuildingKind } from '../data/buildings';
import {
  BUILD_MARGIN,
  DAY_SECONDS,
  DT,
  EARLY_BONUS_PER_SECOND,
  MAP_SIZE,
  NIGHT_BUILD_MULT,
  SELL_REFUND,
  START_BUNNIES,
  START_CARROTS,
  TICK_RATE,
} from '../data/config';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { NIGHTS, type Dir } from '../data/waves';
import { computeField, diagonalBlocked, enterCost, NEIGHBORS } from './pathing';
import { nextRandom } from './rng';
import type { Building, Enemy, Game } from './types';

const N = MAP_SIZE;
const PROJECTILE_SPEED = 14;
/** Enemies stop this far from the centre of the tile they are attacking. */
const ATTACK_STANDOFF = 0.9;
const ATTACK_REACH = 1.3;

export function createGame(seed: number): Game {
  const g: Game = {
    rngState: seed | 0,
    tick: 0,
    phase: 'day',
    night: 1,
    dayTimer: 0,
    carrots: START_CARROTS,
    kills: 0,
    bunnies: START_BUNNIES,
    housing: 0,
    crewUsed: 0,
    voltSupply: 0,
    voltDraw: 0,
    brownout: false,
    grid: new Int32Array(N * N),
    buildings: new Map(),
    carrotId: 0,
    enemies: [],
    projectiles: [],
    spawnQueue: [],
    fields: { gnome: new Float64Array(0), mower: new Float64Array(0) },
    fieldsDirty: true,
    nextId: 1,
    events: [],
  };
  g.carrotId = place(g, 'carrot', N / 2 - 1, N / 2 - 1).id;
  refreshFields(g);
  return g;
}

// ---------------------------------------------------------------- commands

export function buildCost(g: Game, kind: BuildingKind): number {
  const base = BUILDINGS[kind].cost;
  return g.phase === 'night' ? Math.ceil(base * NIGHT_BUILD_MULT) : base;
}

/** Whether the footprint is legal, ignoring cost. */
export function canPlace(g: Game, kind: BuildingKind, x: number, y: number): boolean {
  if (g.phase !== 'day' && g.phase !== 'night') return false;
  const size = BUILDINGS[kind].size;
  if (x < BUILD_MARGIN || y < BUILD_MARGIN || x + size > N - BUILD_MARGIN || y + size > N - BUILD_MARGIN) return false;
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (g.grid[(y + dy) * N + x + dx]) return false;
    }
  }
  for (const e of g.enemies) {
    if (e.x >= x && e.x < x + size && e.y >= y && e.y < y + size) return false;
  }
  return true;
}

export function freeBunnies(g: Game): number {
  return g.bunnies - g.crewUsed;
}

/** Whether the player has the carrots and the spare bunnies for it. */
export function canAfford(g: Game, kind: BuildingKind): boolean {
  return g.carrots >= buildCost(g, kind) && freeBunnies(g) >= (BUILDINGS[kind].crew ?? 0);
}

export function build(g: Game, kind: BuildingKind, x: number, y: number): boolean {
  if (kind === 'carrot') return false;
  if (!canAfford(g, kind) || !canPlace(g, kind, x, y)) return false;
  g.carrots -= buildCost(g, kind);
  place(g, kind, x, y);
  return true;
}

export function buildingAt(g: Game, x: number, y: number): Building | undefined {
  if (x < 0 || y < 0 || x >= N || y >= N) return undefined;
  const id = g.grid[y * N + x];
  return id ? g.buildings.get(id) : undefined;
}

export function sellValue(b: Building): number {
  return Math.floor(BUILDINGS[b.kind].cost * SELL_REFUND * (b.hp / b.maxHp));
}

export function sell(g: Game, x: number, y: number): boolean {
  if (g.phase !== 'day' && g.phase !== 'night') return false;
  const b = buildingAt(g, x, y);
  if (!b || b.kind === 'carrot') return false;
  g.carrots += sellValue(b);
  remove(g, b);
  return true;
}

/** Carrots the player gets for ending the current day now. */
export function earlyBonus(g: Game): number {
  return g.phase === 'day' && g.night > 1 ? Math.floor(g.dayTimer * EARLY_BONUS_PER_SECOND) : 0;
}

export function startNight(g: Game): boolean {
  if (g.phase !== 'day') return false;
  const bonus = earlyBonus(g);
  g.carrots += bonus;
  g.phase = 'night';
  g.dayTimer = 0;
  const def = NIGHTS[g.night - 1];
  for (const group of def.groups) {
    for (let i = 0; i < group.count; i++) {
      g.spawnQueue.push({
        tick: g.tick + Math.round((group.start + i * group.interval) * TICK_RATE),
        kind: group.kind,
        dir: group.dirs[i % group.dirs.length],
      });
    }
  }
  g.spawnQueue.sort((a, b) => a.tick - b.tick);
  g.events.push({ type: 'nightfall', bonus });
  return true;
}

// -------------------------------------------------------------------- tick

/** Advance the simulation by one fixed tick. */
export function step(g: Game): void {
  if (g.phase === 'won' || g.phase === 'lost') return;
  g.tick++;
  if (g.fieldsDirty) refreshFields(g);

  if (g.phase === 'day') {
    if (g.night > 1) {
      g.dayTimer -= DT;
      if (g.dayTimer <= 0) startNight(g);
    }
    return;
  }

  while (g.spawnQueue.length > 0 && g.spawnQueue[0].tick <= g.tick) {
    const s = g.spawnQueue.shift()!;
    spawn(g, s.kind, s.dir);
  }
  for (const e of g.enemies) stepEnemy(g, e);
  if (g.phase !== 'night') return;
  for (const b of g.buildings.values()) stepTower(g, b);
  stepProjectiles(g);
  if (g.enemies.some((e) => e.dead)) g.enemies = g.enemies.filter((e) => !e.dead);

  if (g.spawnQueue.length === 0 && g.enemies.length === 0) endNight(g);
}

function endNight(g: Game): void {
  g.projectiles.length = 0;
  if (g.night >= NIGHTS.length) {
    g.phase = 'won';
    return;
  }
  const reward = NIGHTS[g.night - 1].reward;
  g.carrots += reward;
  g.night++;
  g.phase = 'day';
  g.dayTimer = DAY_SECONDS;
  let hutches = 0;
  for (const b of g.buildings.values()) {
    b.hp = b.maxHp;
    const def = BUILDINGS[b.kind];
    if (b.kind === 'hutch') hutches++;
    if (def.income && b.staffed) {
      g.carrots += def.income;
      g.events.push({ type: 'income', x: b.x + b.size / 2, y: b.y + b.size / 2, amount: def.income });
    }
  }
  // Bunnies multiply: every Hutch adds one, and so does every five bunnies.
  const born = Math.min(g.housing - g.bunnies, hutches + Math.floor(g.bunnies / 5));
  if (born > 0) {
    g.bunnies += born;
    g.events.push({ type: 'born', x: N / 2, y: N / 2, count: born });
  }
  refreshEconomy(g);
  g.fieldsDirty = true;
  g.events.push({ type: 'dawn', reward });
}

// --------------------------------------------------------------- buildings

function place(g: Game, kind: BuildingKind, x: number, y: number): Building {
  const def = BUILDINGS[kind];
  const b: Building = {
    id: g.nextId++,
    kind,
    x,
    y,
    size: def.size,
    hp: def.hp,
    maxHp: def.hp,
    cooldown: 0,
    aim: -Math.PI / 2,
    staffed: false,
  };
  g.buildings.set(b.id, b);
  for (let dy = 0; dy < b.size; dy++) {
    for (let dx = 0; dx < b.size; dx++) g.grid[(y + dy) * N + x + dx] = b.id;
  }
  g.bunnies += def.newcomers ?? 0;
  refreshEconomy(g);
  g.fieldsDirty = true;
  return b;
}

function remove(g: Game, b: Building): void {
  g.buildings.delete(b.id);
  for (let dy = 0; dy < b.size; dy++) {
    for (let dx = 0; dx < b.size; dx++) g.grid[(b.y + dy) * N + b.x + dx] = 0;
  }
  refreshEconomy(g);
  g.fieldsDirty = true;
}

/**
 * Recomputes housing, staffing and power from the buildings that exist.
 * Bunnies without a home leave, and crews are handed out oldest building
 * first, so losing a Hutch switches off the newest buildings.
 */
function refreshEconomy(g: Game): void {
  let housing = 0;
  for (const b of g.buildings.values()) housing += BUILDINGS[b.kind].housing ?? 0;
  g.housing = housing;
  g.bunnies = Math.min(g.bunnies, housing);

  let free = g.bunnies;
  let supply = 0;
  let draw = 0;
  for (const b of g.buildings.values()) {
    const def = BUILDINGS[b.kind];
    const crew = def.crew ?? 0;
    b.staffed = crew <= free;
    if (!b.staffed) continue;
    free -= crew;
    supply += def.volts ?? 0;
    draw += def.draw ?? 0;
  }
  g.crewUsed = g.bunnies - free;
  g.voltSupply = supply;
  g.voltDraw = draw;
  g.brownout = draw > supply;
}

function refreshFields(g: Game): void {
  for (const kind of Object.keys(ENEMIES) as EnemyKind[]) g.fields[kind] = computeField(g, kind);
  g.fieldsDirty = false;
}

function stepTower(g: Game, b: Building): void {
  const def = BUILDINGS[b.kind];
  if (def.range === undefined || !b.staffed) return;
  if (b.cooldown > 0) b.cooldown -= DT;
  if (b.cooldown > 0) return;
  const cx = b.x + b.size / 2;
  const cy = b.y + b.size / 2;
  const target = nearestEnemy(g, cx, cy, def.range, null);
  if (!target) return;
  b.cooldown = def.cooldown! * (def.draw && g.brownout ? 2 : 1);
  b.aim = Math.atan2(target.y - cy, target.x - cx);

  if (def.chains === undefined) {
    g.projectiles.push({ id: g.nextId++, x: cx, y: cy, px: cx, py: cy, targetId: target.id, damage: def.damage! });
    return;
  }
  // Chain lightning: each jump goes to the nearest enemy not yet hit.
  const hit = new Set<number>();
  const points: [number, number][] = [[cx, cy]];
  let current: Enemy | null = target;
  let damage = def.damage!;
  while (current) {
    hit.add(current.id);
    points.push([current.x, current.y]);
    damageEnemy(g, current, damage);
    damage *= 0.8;
    if (hit.size > def.chains) break;
    current = nearestEnemy(g, current.x, current.y, def.chainRange!, hit);
  }
  g.events.push({ type: 'zap', points });
}

function nearestEnemy(g: Game, x: number, y: number, range: number, exclude: Set<number> | null): Enemy | null {
  let best: Enemy | null = null;
  let bestD = range * range;
  for (const e of g.enemies) {
    if (e.dead || exclude?.has(e.id)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d <= bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function stepProjectiles(g: Game): void {
  let kept = 0;
  for (const p of g.projectiles) {
    const target = g.enemies.find((e) => e.id === p.targetId);
    if (!target || target.dead) continue;
    p.px = p.x;
    p.py = p.y;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    const move = PROJECTILE_SPEED * DT;
    if (d <= move) {
      damageEnemy(g, target, p.damage);
      g.events.push({ type: 'hit', x: target.x, y: target.y });
      continue;
    }
    p.x += (dx / d) * move;
    p.y += (dy / d) * move;
    g.projectiles[kept++] = p;
  }
  g.projectiles.length = kept;
}

// ----------------------------------------------------------------- enemies

function spawn(g: Game, kind: EnemyKind, dir: Dir): void {
  const def = ENEMIES[kind];
  const along = 1 + nextRandom(g) * (N - 2);
  const x = dir === 'W' ? 0.5 : dir === 'E' ? N - 0.5 : along;
  const y = dir === 'N' ? 0.5 : dir === 'S' ? N - 0.5 : along;
  const hp = Math.round(def.hp * NIGHTS[g.night - 1].hpMult);
  g.enemies.push({
    id: g.nextId++,
    kind,
    x,
    y,
    px: x,
    py: y,
    hp,
    maxHp: hp,
    cooldown: 0,
    ox: (nextRandom(g) - 0.5) * 0.5,
    oy: (nextRandom(g) - 0.5) * 0.5,
    facing: 0,
    dead: false,
  });
}

function stepEnemy(g: Game, e: Enemy): void {
  e.px = e.x;
  e.py = e.y;
  if (e.dead) return;
  const def = ENEMIES[e.kind];
  if (e.cooldown > 0) e.cooldown -= DT;

  // Pick the neighbouring tile with the cheapest total route to the target.
  const field = g.fields[e.kind];
  const tx = Math.min(N - 1, Math.max(0, Math.floor(e.x)));
  const ty = Math.min(N - 1, Math.max(0, Math.floor(e.y)));
  let best = Infinity;
  let bx = -1;
  let by = -1;
  for (const [dx, dy, len] of NEIGHBORS) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
    if (dx !== 0 && dy !== 0 && diagonalBlocked(g, tx, ty, nx, ny)) continue;
    const idx = ny * N + nx;
    const cost = len + enterCost(g, e.kind, idx) + field[idx];
    if (cost < best) {
      best = cost;
      bx = nx;
      by = ny;
    }
  }
  if (bx < 0) return;

  const blocker = buildingAt(g, bx, by);
  if (!blocker) {
    moveToward(e, bx + 0.5 + e.ox, by + 0.5 + e.oy, def.speed * DT);
    return;
  }
  const cx = bx + 0.5;
  const cy = by + 0.5;
  const d = Math.hypot(cx - e.x, cy - e.y);
  if (d > ATTACK_STANDOFF) moveToward(e, cx, cy, Math.min(def.speed * DT, d - ATTACK_STANDOFF));
  if (d <= ATTACK_REACH && e.cooldown <= 0) {
    e.cooldown = def.attackCooldown;
    e.facing = Math.atan2(cy - e.y, cx - e.x);
    damageBuilding(g, blocker, def.damage * (blocker.kind === 'hedge' ? def.hedgeMult : 1));
    g.events.push({ type: 'bite', x: cx, y: cy });
  }
}

function moveToward(e: Enemy, x: number, y: number, dist: number): void {
  const dx = x - e.x;
  const dy = y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  const m = Math.min(dist, d);
  e.x += (dx / d) * m;
  e.y += (dy / d) * m;
  e.facing = Math.atan2(dy, dx);
}

function damageEnemy(g: Game, e: Enemy, amount: number): void {
  if (e.dead) return;
  e.hp -= amount;
  if (e.hp > 0) return;
  e.dead = true;
  const bounty = ENEMIES[e.kind].bounty;
  g.carrots += bounty;
  g.kills++;
  g.events.push({ type: 'death', x: e.x, y: e.y, kind: e.kind, bounty });
}

function damageBuilding(g: Game, b: Building, amount: number): void {
  b.hp -= amount;
  if (b.hp > 0) return;
  g.events.push({ type: 'destroyed', x: b.x + b.size / 2, y: b.y + b.size / 2, kind: b.kind });
  remove(g, b);
  if (b.id === g.carrotId) g.phase = 'lost';
}
