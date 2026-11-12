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
   * 'homes' means the nearest Hutch or the Golden Carrot.
   */
  targets: 'buildings' | 'homes';
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  gnome: {
    name: 'Garden Gnome',
    hp: 30,
    speed: 1.2,
    damage: 5,
    attackCooldown: 1,
    hedgeMult: 1,
    bounty: 4,
    targets: 'buildings',
  },
  mower: {
    name: 'Robo-Mower',
    hp: 70,
    speed: 2.4,
    damage: 8,
    attackCooldown: 1,
    hedgeMult: 5,
    bounty: 8,
    targets: 'homes',
  },
};
