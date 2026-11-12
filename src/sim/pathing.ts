import { BUILDINGS, type BuildingKind } from '../data/buildings';
import { MAP_SIZE } from '../data/config';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import type { Game } from './types';

const N = MAP_SIZE;

export const NEIGHBORS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export function isTarget(kind: EnemyKind, building: BuildingKind): boolean {
  if (ENEMIES[kind].targets === 'homes') return building === 'carrot' || building === 'hutch';
  return !BUILDINGS[building].wall;
}

/**
 * Extra travel cost for an enemy to get through a tile. Buildings in the way
 * are not impassable: they cost as much as the distance the enemy could have
 * walked in the time it takes to chew through. So enemies break a wall when
 * the detour is longer than that, and a full wall-off never traps them.
 */
export function enterCost(g: Game, kind: EnemyKind, idx: number): number {
  const id = g.grid[idx];
  if (!id) return 0;
  const b = g.buildings.get(id)!;
  if (isTarget(kind, b.kind)) return 0;
  const def = ENEMIES[kind];
  const dps = (def.damage * (b.kind === 'hedge' ? def.hedgeMult : 1)) / def.attackCooldown;
  return (b.hp / dps) * def.speed;
}

/** A diagonal step is only allowed between open tiles with both corners open. */
export function diagonalBlocked(g: Game, x: number, y: number, nx: number, ny: number): boolean {
  return g.grid[y * N + x] !== 0 || g.grid[ny * N + nx] !== 0 || g.grid[y * N + nx] !== 0 || g.grid[ny * N + x] !== 0;
}

/** Dijkstra outward from every target tile of the given enemy kind. */
export function computeField(g: Game, kind: EnemyKind): Float64Array {
  const dist = new Float64Array(N * N).fill(Infinity);
  const heap = new MinHeap();
  for (const b of g.buildings.values()) {
    if (!isTarget(kind, b.kind)) continue;
    for (let dy = 0; dy < b.size; dy++) {
      for (let dx = 0; dx < b.size; dx++) {
        const idx = (b.y + dy) * N + b.x + dx;
        dist[idx] = 0;
        heap.push(0, idx);
      }
    }
  }
  while (heap.size > 0) {
    const d = heap.topKey();
    const idx = heap.pop();
    if (d > dist[idx]) continue;
    const x = idx % N;
    const y = (idx - x) / N;
    const through = d + enterCost(g, kind, idx);
    for (const [dx, dy, len] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      if (dx !== 0 && dy !== 0 && diagonalBlocked(g, x, y, nx, ny)) continue;
      const nIdx = ny * N + nx;
      const nd = through + len;
      if (nd < dist[nIdx]) {
        dist[nIdx] = nd;
        heap.push(nd, nIdx);
      }
    }
  }
  return dist;
}

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  topKey(): number {
    return this.keys[0];
  }

  push(key: number, val: number): void {
    const { keys, vals } = this;
    let i = keys.length;
    keys.push(key);
    vals.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = key;
    vals[i] = val;
  }

  pop(): number {
    const { keys, vals } = this;
    const top = vals[0];
    const key = keys.pop()!;
    const val = vals.pop()!;
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = key;
      vals[i] = val;
    }
    return top;
  }
}
