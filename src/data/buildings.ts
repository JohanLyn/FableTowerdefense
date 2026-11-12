export type BuildingKind = 'carrot' | 'launcher' | 'tesla' | 'hedge';

export interface BuildingDef {
  name: string;
  blurb: string;
  cost: number;
  hp: number;
  /** Footprint in tiles (size x size). */
  size: number;
  /** Attack stats. Absent for non-combat buildings. */
  range?: number;
  damage?: number;
  /** Seconds between shots. */
  cooldown?: number;
  /** Extra enemies a shot jumps to. */
  chains?: number;
  chainRange?: number;
}

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  carrot: {
    name: 'Golden Carrot',
    blurb: 'Defend it. If it is eaten, the run is over.',
    cost: 0,
    hp: 600,
    size: 2,
  },
  launcher: {
    name: 'Carrot Launcher',
    blurb: 'Cheap, long range, one target at a time.',
    cost: 50,
    hp: 120,
    size: 1,
    range: 5.5,
    damage: 12,
    cooldown: 0.8,
  },
  tesla: {
    name: 'Tesla Hutch',
    blurb: 'Short range lightning that chains through crowds.',
    cost: 90,
    hp: 140,
    size: 1,
    range: 3.2,
    damage: 9,
    cooldown: 1.0,
    chains: 4,
    chainRange: 2.2,
  },
  hedge: {
    name: 'Hedge',
    blurb: 'Cheap wall. Mowers shred it.',
    cost: 5,
    hp: 70,
    size: 1,
  },
};

/** Kinds the player can place, in build bar order. */
export const BUILDABLE: BuildingKind[] = ['launcher', 'tesla', 'hedge'];
