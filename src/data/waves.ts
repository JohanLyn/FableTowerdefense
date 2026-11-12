import type { EnemyKind } from './enemies';

export type Dir = 'N' | 'E' | 'S' | 'W';

export interface WaveGroup {
  kind: EnemyKind;
  count: number;
  /** Spawns rotate through these map edges. */
  dirs: Dir[];
  /** Seconds after nightfall before the first spawn. */
  start: number;
  /** Seconds between spawns. */
  interval: number;
}

export interface NightDef {
  groups: WaveGroup[];
  /** Carrots awarded at dawn. */
  reward: number;
  /** Multiplier on enemy health. */
  hpMult: number;
}

export const NIGHTS: NightDef[] = [
  {
    reward: 80,
    hpMult: 1,
    groups: [{ kind: 'gnome', count: 10, dirs: ['N'], start: 1, interval: 1.2 }],
  },
  {
    reward: 100,
    hpMult: 1.15,
    groups: [{ kind: 'gnome', count: 18, dirs: ['N', 'E'], start: 1, interval: 0.9 }],
  },
  {
    reward: 120,
    hpMult: 1.35,
    groups: [
      { kind: 'gnome', count: 24, dirs: ['W', 'S'], start: 1, interval: 0.7 },
      { kind: 'mower', count: 6, dirs: ['W', 'S'], start: 8, interval: 2.5 },
    ],
  },
  {
    reward: 150,
    hpMult: 1.5,
    groups: [
      { kind: 'gnome', count: 36, dirs: ['N', 'E', 'S'], start: 1, interval: 0.6 },
      { kind: 'mower', count: 10, dirs: ['E', 'S'], start: 6, interval: 1.8 },
    ],
  },
  {
    reward: 0,
    hpMult: 1.8,
    groups: [
      { kind: 'gnome', count: 52, dirs: ['N', 'E', 'S', 'W'], start: 1, interval: 0.45 },
      { kind: 'mower', count: 18, dirs: ['N', 'E', 'S', 'W'], start: 5, interval: 1.3 },
    ],
  },
];

/** Enemy counts and attack directions for a night, for the day-time preview. */
export function nightPreview(night: number): { dirs: Dir[]; counts: Partial<Record<EnemyKind, number>> } {
  const def = NIGHTS[night - 1];
  const dirs = new Set<Dir>();
  const counts: Partial<Record<EnemyKind, number>> = {};
  for (const g of def?.groups ?? []) {
    g.dirs.forEach((d) => dirs.add(d));
    counts[g.kind] = (counts[g.kind] ?? 0) + g.count;
  }
  return { dirs: [...dirs], counts };
}
