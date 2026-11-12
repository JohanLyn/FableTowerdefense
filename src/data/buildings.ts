export type BuildingKind = 'carrot' | 'launcher' | 'tesla' | 'hedge' | 'fence' | 'patch' | 'hutch' | 'wheel';

export interface BuildingDef {
  name: string;
  blurb: string;
  cost: number;
  hp: number;
  /** Footprint in tiles (size x size). */
  size: number;
  /** Walls block movement but are not something gnomes go looking for. */
  wall?: boolean;

  // Economy
  /** Bunnies needed to run it. Without a crew it does nothing. */
  crew?: number;
  /** Bunnies it can house. */
  housing?: number;
  /** Bunnies that move in when it is built. */
  newcomers?: number;
  /** Carrots produced each dawn. */
  income?: number;
  /** Volts generated. */
  volts?: number;
  /** Volts consumed. */
  draw?: number;

  // Combat. Absent for non-combat buildings.
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
    housing: 4,
  },
  launcher: {
    name: 'Carrot Launcher',
    blurb: 'Cheap, long range, one target at a time.',
    cost: 50,
    hp: 120,
    size: 1,
    crew: 1,
    range: 5.5,
    damage: 12,
    cooldown: 0.8,
  },
  tesla: {
    name: 'Tesla Hutch',
    blurb: 'Short range lightning that chains through crowds. Needs 5 Volts or it fires at half speed.',
    cost: 80,
    hp: 140,
    size: 1,
    crew: 1,
    draw: 5,
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
    wall: true,
  },
  fence: {
    name: 'Picket Fence',
    blurb: 'Tough wall that stands up to mowers.',
    cost: 12,
    hp: 220,
    size: 1,
    wall: true,
  },
  patch: {
    name: 'Carrot Patch',
    blurb: 'Grows 20 carrots every dawn.',
    cost: 40,
    hp: 80,
    size: 1,
    crew: 1,
    income: 20,
  },
  hutch: {
    name: 'Hutch',
    blurb: 'Houses 6 bunnies and comes with a pair. Bunnies multiply every dawn. Mowers hunt Hutches.',
    cost: 60,
    hp: 150,
    size: 1,
    housing: 6,
    newcomers: 2,
  },
  wheel: {
    name: 'Hamster Wheel',
    blurb: 'A bunny runs in it to make 10 Volts.',
    cost: 50,
    hp: 90,
    size: 1,
    crew: 1,
    volts: 10,
  },
};

/** Kinds the player can place, in build bar order. */
export const BUILDABLE: BuildingKind[] = ['launcher', 'tesla', 'hedge', 'fence', 'patch', 'hutch', 'wheel'];
