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

/** Gnomes trickle in over about 22 seconds, mowers follow from second 6. */
function night(hpMult: number, gnomes: number, mowers: number, dirs: Dir[]): NightDef {
  const groups: WaveGroup[] = [{ kind: 'gnome', count: gnomes, dirs, start: 1, interval: 22 / gnomes }];
  if (mowers > 0) groups.push({ kind: 'mower', count: mowers, dirs, start: 6, interval: 18 / mowers });
  return { groups, hpMult, reward: 0 };
}

const ALL: Dir[] = ['N', 'E', 'S', 'W'];

export const NIGHTS: NightDef[] = [
  night(1.0, 10, 0, ['N']),
  night(1.1, 16, 0, ['N', 'E']),
  night(1.2, 20, 4, ['W', 'S']),
  night(1.3, 26, 6, ['N', 'E', 'S']),
  night(1.45, 32, 9, ALL),
  night(1.6, 38, 12, ['E', 'W']),
  night(1.8, 44, 15, ['N', 'S', 'W']),
  night(2.0, 50, 18, ALL),
  night(2.2, 56, 21, ALL),
  night(2.4, 64, 25, ALL),
];
NIGHTS.forEach((n, i) => (n.reward = i === NIGHTS.length - 1 ? 0 : 60 + 15 * i));

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
