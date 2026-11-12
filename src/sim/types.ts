import type { BuildingKind } from '../data/buildings';
import type { EnemyKind } from '../data/enemies';
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
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  targetId: number;
  damage: number;
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
  | { type: 'death'; x: number; y: number; kind: EnemyKind; bounty: number }
  | { type: 'destroyed'; x: number; y: number; kind: BuildingKind }
  | { type: 'bite'; x: number; y: number }
  | { type: 'dawn'; reward: number }
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
  /** Building id per tile, 0 when empty. */
  grid: Int32Array;
  buildings: Map<number, Building>;
  carrotId: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  spawnQueue: Spawn[];
  /** Flow field per enemy kind: travel cost from each tile to that kind's target. */
  fields: Record<EnemyKind, Float64Array>;
  fieldsDirty: boolean;
  nextId: number;
  events: GameEvent[];
}
