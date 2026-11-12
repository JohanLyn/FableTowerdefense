export type EnemyKind = 'gnome' | 'mower';

export interface EnemyDef {
  name: string;
  hp: number;
  /** Tiles per second. */
  speed: number;
  damage: number;
  /** Seconds between attacks. */
  attackCooldown: number;
  /** Damage multiplier against hedges. */
  hedgeMult: number;
  bounty: number;
  /**
   * What it walks toward. 'buildings' means the nearest non-wall building,
   * 'carrot' means straight for the Golden Carrot.
   */
  targets: 'buildings' | 'carrot';
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  gnome: {
    name: 'Garden Gnome',
    hp: 30,
    speed: 1.2,
    damage: 5,
    attackCooldown: 1,
    hedgeMult: 1,
    bounty: 5,
    targets: 'buildings',
  },
  mower: {
    name: 'Robo-Mower',
    hp: 70,
    speed: 2.4,
    damage: 8,
    attackCooldown: 1,
    hedgeMult: 5,
    bounty: 12,
    targets: 'carrot',
  },
};
