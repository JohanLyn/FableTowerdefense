import type { BuildingKind } from '../data/buildings';
import type { EnemyKind } from '../data/enemies';
import type { Combo, LinkKind, Status } from '../data/statuses';
import type { Dir } from '../data/waves';

export type Phase = 'day' | 'night' | 'won' | 'lost';

export interface Building {
  id: number;
  kind: BuildingKind;
  /** Top-left tile. */
  x: number;
  y: number;
  size: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  /** Direction of the last shot, radians. Used for drawing only. */
  aim: number;
  /** Whether it has the bunnies it needs. Unstaffed buildings do nothing. */
  staffed: boolean;
  /** Enemy a swarm tower is locked on to, 0 for none. */
  targetId: number;
  // Adjacency bonuses, derived from neighbours by refreshEconomy.
  soak: boolean;
  honey: boolean;
  wired: boolean;
  row: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  /** Position in tile units. */
  x: number;
  y: number;
  /** Position on the previous tick, for render interpolation. */
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  /** Personal offset inside a tile so crowds do not stack on one point. */
  ox: number;
  oy: number;
  facing: number;
  dead: boolean;
  /** At most one status at a time: a second, different one triggers a combo. */
  status: Status | null;
  statusTime: number;
  /** Seconds it cannot move or attack. */
  stun: number;
  /** Seconds it takes extra damage. */
  vulnerable: number;
}

export interface Projectile {
  id: number;
  /** Carrots home in on an enemy. Shells fly to a spot and burst. */
  kind: 'carrot' | 'shell';
  x: number;
  y: number;
  px: number;
  py: number;
  targetId: number;
  damage: number;
  // Shells only: flight from (sx, sy) to (tx, ty) over dur seconds.
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  splash: number;
}

/** A puddle on the ground that slows enemies inside it. */
export interface Zone {
  x: number;
  y: number;
  r: number;
  time: number;
}

/** A visible adjacency bonus between two buildings, in tile-centre coordinates. */
export interface Link {
  kind: LinkKind;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface Spawn {
  tick: number;
  kind: EnemyKind;
  dir: Dir;
}

/** One-way notifications from the simulation to the renderer and audio. */
export type GameEvent =
  | { type: 'zap'; points: [number, number][] }
  | { type: 'hit'; x: number; y: number }
  | { type: 'combo'; x: number; y: number; combo: Combo }
  | { type: 'pulse'; x: number; y: number; r: number; kind: BuildingKind }
  | { type: 'flame'; x: number; y: number; angle: number; range: number; spread: number }
  | { type: 'boom'; x: number; y: number; r: number }
  | { type: 'death'; x: number; y: number; kind: EnemyKind; bounty: number }
  | { type: 'destroyed'; x: number; y: number; kind: BuildingKind }
  | { type: 'bite'; x: number; y: number }
  | { type: 'dawn'; reward: number }
  | { type: 'income'; x: number; y: number; amount: number }
  | { type: 'born'; x: number; y: number; count: number }
  | { type: 'nightfall'; bonus: number };

export interface Game {
  rngState: number;
  tick: number;
  phase: Phase;
  /** 1-based. The night in progress, or the one coming after the current day. */
  night: number;
  /** Seconds of day left. The first day is untimed. */
  dayTimer: number;
  carrots: number;
  kills: number;
  /** Total bunny population. */
  bunnies: number;
  // Derived from buildings by refreshEconomy.
  housing: number;
  crewUsed: number;
  voltSupply: number;
  voltDraw: number;
  /** Electric towers fire at half speed while draw exceeds supply. */
  brownout: boolean;
  /** Building id per tile, 0 when empty. */
  grid: Int32Array;
  buildings: Map<number, Building>;
  carrotId: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  zones: Zone[];
  links: Link[];
  spawnQueue: Spawn[];
  /** Flow field per enemy kind: travel cost from each tile to that kind's target. */
  fields: Record<EnemyKind, Float64Array>;
  fieldsDirty: boolean;
  nextId: number;
  events: GameEvent[];
}
