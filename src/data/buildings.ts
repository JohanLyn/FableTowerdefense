import type { Status } from './statuses';

export type BuildingKind =
  | 'carrot'
  | 'launcher'
  | 'tesla'
  | 'mortar'
  | 'sprinkler'
  | 'honey'
  | 'flamer'
  | 'beehive'
  | 'thumper'
  | 'hedge'
  | 'fence'
  | 'patch'
  | 'hutch'
  | 'wheel';

/**
 * How a tower attacks.
 * bolt: homing shot at one enemy. chain: lightning that jumps between enemies.
 * mortar: lobbed shell with splash and a minimum range. pulse: hits everything
 * in range at once. cone: hits everything in a wedge toward the target.
 * swarm: locks on to one enemy and keeps stinging it.
 */
export type AttackKind = 'bolt' | 'chain' | 'mortar' | 'pulse' | 'cone' | 'swarm';

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
  attack?: AttackKind;
  range?: number;
  /** Mortars cannot hit closer than this. */
  minRange?: number;
  damage?: number;
  /** Status put on every enemy it hits. */
  applies?: Status;
  /** Seconds enemies are stunned. */
  stun?: number;
  /** Blast radius of a mortar shell. */
  splash?: number;
  /** Half-angle of a cone attack, radians. */
  coneAngle?: number;
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
    attack: 'bolt',
    range: 5.5,
    damage: 12,
    cooldown: 0.8,
  },
  tesla: {
    name: 'Tesla Hutch',
    blurb: 'Lightning that chains through crowds and leaves enemies Zapped. Needs 5 Volts or fires at half speed.',
    cost: 80,
    hp: 140,
    size: 1,
    crew: 1,
    draw: 5,
    attack: 'chain',
    applies: 'zapped',
    range: 3.2,
    damage: 9,
    cooldown: 1.0,
    chains: 4,
    chainRange: 2.2,
  },
  mortar: {
    name: 'Cabbage Mortar',
    blurb: 'Lobs cabbages a long way for splash damage. Cannot hit anything close to it.',
    cost: 100,
    hp: 120,
    size: 1,
    crew: 1,
    attack: 'mortar',
    range: 8,
    minRange: 2.5,
    damage: 26,
    splash: 1.4,
    cooldown: 2.5,
  },
  sprinkler: {
    name: 'Sprinkler',
    blurb: 'No damage. Makes everything in range Wet, which doubles lightning.',
    cost: 45,
    hp: 100,
    size: 1,
    crew: 1,
    attack: 'pulse',
    applies: 'wet',
    range: 3,
    damage: 0,
    cooldown: 1,
  },
  honey: {
    name: 'Honey Pot',
    blurb: 'No damage. Makes everything in range Sticky, so it moves at half speed.',
    cost: 55,
    hp: 100,
    size: 1,
    crew: 1,
    attack: 'pulse',
    applies: 'sticky',
    range: 2.3,
    damage: 0,
    cooldown: 1,
  },
  flamer: {
    name: 'Chili Flamer',
    blurb: 'Short cone of fire. Leaves enemies Spicy, so they keep burning.',
    cost: 75,
    hp: 130,
    size: 1,
    crew: 1,
    attack: 'cone',
    applies: 'spicy',
    range: 2.6,
    coneAngle: 0.6,
    damage: 5,
    cooldown: 0.5,
  },
  beehive: {
    name: 'Beehive',
    blurb: 'Bees pick one enemy and sting it until it drops. Needs no bunny.',
    cost: 70,
    hp: 90,
    size: 1,
    attack: 'swarm',
    range: 4.5,
    damage: 2.5,
    cooldown: 0.25,
  },
  thumper: {
    name: 'Thumper',
    blurb: 'A rabbit on a big drum. Every few seconds it stuns everything around it.',
    cost: 85,
    hp: 160,
    size: 1,
    crew: 1,
    attack: 'pulse',
    range: 2.2,
    damage: 5,
    stun: 1.2,
    cooldown: 4,
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
export const BUILDABLE: BuildingKind[] = [
  'launcher',
  'tesla',
  'mortar',
  'sprinkler',
  'honey',
  'flamer',
  'beehive',
  'thumper',
  'hedge',
  'fence',
  'patch',
  'hutch',
  'wheel',
];
