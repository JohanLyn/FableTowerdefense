import { BUILDINGS, type BuildingDef, type BuildingKind } from '../data/buildings';
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
import {
  COMBO_TUNING,
  comboOf,
  HONEY_LINK_MULT,
  ROW_RANGE_MULT,
  SPICY_BURN,
  STATUS_TIME,
  STICKY_SLOW,
  type Combo,
  type Status,
} from '../data/statuses';
import { NIGHTS, type Dir } from '../data/waves';
import { computeField, diagonalBlocked, enterCost, NEIGHBORS } from './pathing';
import { nextRandom } from './rng';
import type { Building, Enemy, Game, Link, Projectile } from './types';

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
    zones: [],
    links: [],
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
  stepZones(g);
  for (const e of g.enemies) stepEnemy(g, e);
  if (g.phase !== 'night') return;
  for (const b of g.buildings.values()) stepTower(g, b);
  stepProjectiles(g);
  if (g.enemies.some((e) => e.dead)) g.enemies = g.enemies.filter((e) => !e.dead);

  if (g.spawnQueue.length === 0 && g.enemies.length === 0) endNight(g);
}

function endNight(g: Game): void {
  g.projectiles.length = 0;
  g.zones.length = 0;
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
    targetId: 0,
    soak: false,
    honey: false,
    wired: false,
    row: false,
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
  refreshLinks(g);
}

/** Works out adjacency bonuses. Buildings link when they share a tile edge. */
function refreshLinks(g: Game): void {
  g.links = [];
  for (const b of g.buildings.values()) b.soak = b.honey = b.wired = b.row = false;

  const centre = (b: Building): [number, number] => [b.x + b.size / 2, b.y + b.size / 2];
  const link = (kind: Link['kind'], a: Building, b: Building): void => {
    const [ax, ay] = centre(a);
    const [bx, by] = centre(b);
    g.links.push({ kind, ax, ay, bx, by });
  };
  /** If the pair is (giver, taker) in either order, returns the taker. */
  const match = (a: Building, b: Building, giver: BuildingKind, taker: (k: BuildingKind) => boolean): Building | null => {
    if (a.kind === giver && a.staffed && taker(b.kind)) return b;
    if (b.kind === giver && b.staffed && taker(a.kind)) return a;
    return null;
  };

  for (const a of g.buildings.values()) {
    if (a.size !== 1) continue;
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      const b = buildingAt(g, a.x + dx, a.y + dy);
      if (!b || b.size !== 1) continue;
      let taker = match(a, b, 'sprinkler', (k) => k === 'tesla');
      if (taker) {
        taker.soak = true;
        link('soak', a, b);
      }
      taker = match(a, b, 'honey', (k) => k === 'beehive');
      if (taker) {
        taker.honey = true;
        link('honey', a, b);
      }
      taker = match(a, b, 'wheel', (k) => BUILDINGS[k].draw !== undefined);
      if (taker) {
        taker.wired = true;
        link('wired', a, b);
      }
      // Three or more of the same tower in a line.
      if (a.kind === b.kind && BUILDINGS[a.kind].attack) {
        let run = 2;
        for (let i = 1; buildingAt(g, a.x - dx * i, a.y - dy * i)?.kind === a.kind; i++) run++;
        for (let i = 2; buildingAt(g, a.x + dx * i, a.y + dy * i)?.kind === a.kind; i++) run++;
        if (run >= 3) {
          a.row = b.row = true;
          link('row', a, b);
        }
      }
    }
  }
}

export function towerRange(b: Building): number {
  return (BUILDINGS[b.kind].range ?? 0) * (b.row ? ROW_RANGE_MULT : 1);
}

function refreshFields(g: Game): void {
  for (const kind of Object.keys(ENEMIES) as EnemyKind[]) g.fields[kind] = computeField(g, kind);
  g.fieldsDirty = false;
}

function stepTower(g: Game, b: Building): void {
  const def = BUILDINGS[b.kind];
  if (!def.attack || !b.staffed) return;
  if (b.cooldown > 0) b.cooldown -= DT;
  const cx = b.x + b.size / 2;
  const cy = b.y + b.size / 2;
  const range = towerRange(b);
  if (def.attack === 'swarm') return stepSwarm(g, b, def, cx, cy, range);
  if (b.cooldown > 0) return;
  const target = nearestEnemy(g, cx, cy, range, null, def.minRange ?? 0);
  if (!target) return;
  const brownedOut = def.draw !== undefined && g.brownout && !b.wired;
  b.cooldown = def.cooldown! * (brownedOut ? 2 : 1);
  b.aim = Math.atan2(target.y - cy, target.x - cx);

  switch (def.attack) {
    case 'bolt':
      g.projectiles.push({ ...blankProjectile(g, cx, cy), kind: 'carrot', targetId: target.id, damage: def.damage! });
      break;
    case 'chain':
      fireChain(g, b, def, cx, cy, target);
      break;
    case 'mortar': {
      const dist = Math.hypot(target.x - cx, target.y - cy);
      g.projectiles.push({
        ...blankProjectile(g, cx, cy),
        kind: 'shell',
        damage: def.damage!,
        tx: target.x,
        ty: target.y,
        dur: 0.4 + dist * 0.06,
        splash: def.splash!,
      });
      break;
    }
    case 'pulse':
      for (const e of g.enemies) {
        if (e.dead || (e.x - cx) ** 2 + (e.y - cy) ** 2 > range * range) continue;
        strike(g, e, def);
      }
      g.events.push({ type: 'pulse', x: cx, y: cy, r: range, kind: b.kind });
      break;
    case 'cone':
      for (const e of g.enemies) {
        if (e.dead || (e.x - cx) ** 2 + (e.y - cy) ** 2 > range * range) continue;
        const off = Math.atan2(e.y - cy, e.x - cx) - b.aim;
        if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > def.coneAngle!) continue;
        strike(g, e, def);
      }
      g.events.push({ type: 'flame', x: cx, y: cy, angle: b.aim, range, spread: def.coneAngle! });
      break;
  }
}

/** Damage, stun and status from one tower hit, in that order. */
function strike(g: Game, e: Enemy, def: BuildingDef): void {
  if (def.damage) damageEnemy(g, e, def.damage);
  if (def.stun) e.stun = Math.max(e.stun, def.stun);
  if (def.applies) applyStatus(g, e, def.applies);
}

/** Chain lightning: each jump goes to the nearest enemy not yet hit. */
function fireChain(g: Game, b: Building, def: BuildingDef, cx: number, cy: number, target: Enemy): void {
  const hit = new Set<number>();
  const points: [number, number][] = [[cx, cy]];
  let current: Enemy | null = target;
  let damage = def.damage!;
  let jumps = def.chains!;
  let boosted = false;
  while (current) {
    hit.add(current.id);
    points.push([current.x, current.y]);
    // A Wet enemy, or the first hit of a Tesla Hutch beside a Sprinkler, conducts.
    const wet = current.status === 'wet';
    if (wet || (hit.size === 1 && b.soak)) {
      if (wet) clearStatus(current);
      if (!boosted) jumps += COMBO_TUNING.conductedChains;
      boosted = true;
      g.events.push({ type: 'combo', x: current.x, y: current.y, combo: 'conducted' });
      damageEnemy(g, current, damage * COMBO_TUNING.conductedMult);
    } else {
      damageEnemy(g, current, damage);
      applyStatus(g, current, def.applies!);
    }
    damage *= 0.8;
    if (hit.size > jumps) break;
    current = nearestEnemy(g, current.x, current.y, def.chainRange!, hit);
  }
  g.events.push({ type: 'zap', points });
}

/** Bees stay on one enemy until it dies or leaves, then take a moment to find another. */
function stepSwarm(g: Game, b: Building, def: BuildingDef, cx: number, cy: number, range: number): void {
  let target = b.targetId ? g.enemies.find((e) => e.id === b.targetId && !e.dead) : undefined;
  if (target && (target.x - cx) ** 2 + (target.y - cy) ** 2 > (range * 1.2) ** 2) target = undefined;
  if (!target) {
    const sticky = b.honey ? nearestEnemy(g, cx, cy, range, null, 0, 'sticky') : null;
    const next = sticky ?? nearestEnemy(g, cx, cy, range, null);
    b.targetId = next?.id ?? 0;
    if (next) b.cooldown = 0.5;
    return;
  }
  b.aim = Math.atan2(target.y - cy, target.x - cx);
  if (b.cooldown > 0) return;
  b.cooldown = def.cooldown!;
  damageEnemy(g, target, def.damage! * (b.honey && target.status === 'sticky' ? HONEY_LINK_MULT : 1));
}

function nearestEnemy(
  g: Game,
  x: number,
  y: number,
  range: number,
  exclude: Set<number> | null,
  minRange = 0,
  status: Status | null = null,
): Enemy | null {
  let best: Enemy | null = null;
  let bestD = range * range;
  for (const e of g.enemies) {
    if (e.dead || exclude?.has(e.id) || (status && e.status !== status)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d <= bestD && d >= minRange * minRange) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function blankProjectile(g: Game, x: number, y: number): Projectile {
  return { id: g.nextId++, kind: 'carrot', x, y, px: x, py: y, targetId: 0, damage: 0, sx: x, sy: y, tx: x, ty: y, t: 0, dur: 0, splash: 0 };
}

function stepProjectiles(g: Game): void {
  let kept = 0;
  for (const p of g.projectiles) {
    p.px = p.x;
    p.py = p.y;
    if (p.kind === 'shell') {
      p.t += DT;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k;
      if (k < 1) {
        g.projectiles[kept++] = p;
        continue;
      }
      for (const e of g.enemies) {
        if ((e.x - p.tx) ** 2 + (e.y - p.ty) ** 2 <= p.splash * p.splash) damageEnemy(g, e, p.damage);
      }
      g.events.push({ type: 'boom', x: p.tx, y: p.ty, r: p.splash });
      continue;
    }
    const target = g.enemies.find((e) => e.id === p.targetId);
    if (!target || target.dead) continue;
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

// ---------------------------------------------------------------- statuses

function clearStatus(e: Enemy): void {
  e.status = null;
  e.statusTime = 0;
}

/**
 * Puts a status on an enemy. The same status refreshes its timer; a
 * different one uses both up and fires their combo.
 */
export function applyStatus(g: Game, e: Enemy, status: Status): void {
  if (e.dead) return;
  if (e.status === null || e.status === status) {
    e.status = status;
    e.statusTime = STATUS_TIME[status];
    return;
  }
  const combo = comboOf(e.status, status);
  clearStatus(e);
  triggerCombo(g, e, combo);
}

function triggerCombo(g: Game, e: Enemy, combo: Combo): void {
  const T = COMBO_TUNING;
  g.events.push({ type: 'combo', x: e.x, y: e.y, combo });
  switch (combo) {
    case 'conducted':
      damageEnemy(g, e, T.conductedJolt);
      break;
    case 'caramelized':
      e.vulnerable = T.caramelizedTime;
      break;
    case 'steamed':
      for (const other of g.enemies) {
        if ((other.x - e.x) ** 2 + (other.y - e.y) ** 2 <= T.steamedRadius ** 2) damageEnemy(g, other, T.steamedDamage);
      }
      break;
    case 'cling':
      for (const other of g.enemies) {
        if (other.dead) continue;
        const dx = e.x - other.x;
        const dy = e.y - other.y;
        const d = Math.hypot(dx, dy);
        if (d > T.clingRadius) continue;
        other.stun = Math.max(other.stun, T.clingStun);
        const pull = Math.min(T.clingPull, d - 0.3);
        if (pull <= 0) continue;
        const nx = other.x + (dx / d) * pull;
        const ny = other.y + (dy / d) * pull;
        // Never drag anyone into a building.
        if (buildingAt(g, Math.floor(nx), Math.floor(ny))) continue;
        other.x = nx;
        other.y = ny;
      }
      break;
    case 'slick':
      g.zones.push({ x: e.x, y: e.y, r: T.slickRadius, time: T.slickTime });
      break;
    case 'fried':
      damageEnemy(g, e, T.friedBase + (e.maxHp - e.hp) * T.friedMissing);
      break;
  }
}

function stepZones(g: Game): void {
  if (g.zones.length === 0) return;
  for (const z of g.zones) z.time -= DT;
  g.zones = g.zones.filter((z) => z.time > 0);
}

// ----------------------------------------------------------------- enemies

function spawn(g: Game, kind: EnemyKind, dir: Dir): void {
  const along = 1 + nextRandom(g) * (N - 2);
  const x = dir === 'W' ? 0.5 : dir === 'E' ? N - 0.5 : along;
  const y = dir === 'N' ? 0.5 : dir === 'S' ? N - 0.5 : along;
  spawnAt(g, kind, x, y);
}

/** Adds an enemy at an exact position. Waves use it, and so do tests. */
export function spawnAt(g: Game, kind: EnemyKind, x: number, y: number): Enemy {
  const def = ENEMIES[kind];
  const hp = Math.round(def.hp * NIGHTS[g.night - 1].hpMult);
  const e: Enemy = {
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
    status: null,
    statusTime: 0,
    stun: 0,
    vulnerable: 0,
  };
  g.enemies.push(e);
  return e;
}

function stepEnemy(g: Game, e: Enemy): void {
  e.px = e.x;
  e.py = e.y;
  if (e.dead) return;
  const def = ENEMIES[e.kind];
  if (e.cooldown > 0) e.cooldown -= DT;
  if (e.vulnerable > 0) e.vulnerable -= DT;
  if (e.status) {
    if (e.status === 'spicy') damageEnemy(g, e, SPICY_BURN * DT);
    e.statusTime -= DT;
    if (e.statusTime <= 0) clearStatus(e);
    if (e.dead) return;
  }
  if (e.stun > 0) {
    e.stun -= DT;
    return;
  }
  let speed = def.speed;
  if (e.status === 'sticky' || g.zones.some((z) => (z.x - e.x) ** 2 + (z.y - e.y) ** 2 <= z.r * z.r)) speed *= STICKY_SLOW;

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
    moveToward(e, bx + 0.5 + e.ox, by + 0.5 + e.oy, speed * DT);
    return;
  }
  const cx = bx + 0.5;
  const cy = by + 0.5;
  const d = Math.hypot(cx - e.x, cy - e.y);
  if (d > ATTACK_STANDOFF) moveToward(e, cx, cy, Math.min(speed * DT, d - ATTACK_STANDOFF));
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
  e.hp -= amount * (e.vulnerable > 0 ? COMBO_TUNING.caramelizedMult : 1);
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
