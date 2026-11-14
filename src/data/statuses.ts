export type Status = 'wet' | 'sticky' | 'zapped' | 'spicy';
export type Combo = 'conducted' | 'caramelized' | 'steamed' | 'cling' | 'slick' | 'fried';

/** Seconds a status lasts on an enemy unless refreshed or consumed by a combo. */
export const STATUS_TIME: Record<Status, number> = { wet: 3, sticky: 2, zapped: 1.5, spicy: 3 };

export const STATUS_INFO: Record<Status, { name: string; effect: string; color: string }> = {
  wet: { name: 'Wet', effect: 'No effect alone. Sets up combos.', color: '#4dabf7' },
  sticky: { name: 'Sticky', effect: 'Moves at half speed.', color: '#f5b301' },
  zapped: { name: 'Zapped', effect: 'No effect alone. Sets up combos.', color: '#fff36b' },
  spicy: { name: 'Spicy', effect: 'Burns for 5 damage a second.', color: '#ff5a1f' },
};

export const STICKY_SLOW = 0.5;
export const SPICY_BURN = 5;

export interface ComboDef {
  name: string;
  pair: [Status, Status];
  effect: string;
  color: string;
}

/**
 * When a second, different status lands on an enemy, both are used up and
 * the combo fires. An enemy therefore carries at most one status at a time.
 */
export const COMBOS: Record<Combo, ComboDef> = {
  conducted: {
    name: 'Conducted',
    pair: ['wet', 'zapped'],
    effect: 'Lightning hits twice as hard and the bolt chains 3 further.',
    color: '#8fe3ff',
  },
  caramelized: {
    name: 'Caramelized',
    pair: ['sticky', 'spicy'],
    effect: 'Takes 50% more damage for 5 seconds.',
    color: '#e8590c',
  },
  steamed: {
    name: 'Steamed',
    pair: ['wet', 'spicy'],
    effect: 'Scalding burst that damages everything nearby.',
    color: '#f1f3f5',
  },
  cling: {
    name: 'Static Cling',
    pair: ['sticky', 'zapped'],
    effect: 'Yanks nearby enemies into a clump and stuns them.',
    color: '#ffe066',
  },
  slick: {
    name: 'Syrup Slick',
    pair: ['wet', 'sticky'],
    effect: 'Leaves a puddle that slows everyone who walks through it.',
    color: '#f5b301',
  },
  fried: {
    name: 'Flash Fried',
    pair: ['zapped', 'spicy'],
    effect: 'Instant burst, bigger the more hurt the enemy already is.',
    color: '#ff922b',
  },
};

export const COMBO_TUNING = {
  conductedMult: 2,
  conductedChains: 3,
  /** Damage when Wet and Zapped meet without a lightning bolt involved. */
  conductedJolt: 14,
  caramelizedTime: 5,
  caramelizedMult: 1.5,
  steamedDamage: 14,
  steamedRadius: 1.6,
  clingRadius: 2.5,
  clingPull: 1.5,
  clingStun: 0.8,
  slickRadius: 1.6,
  slickTime: 5,
  friedBase: 12,
  friedMissing: 0.35,
};

export function comboOf(a: Status, b: Status): Combo {
  for (const key of Object.keys(COMBOS) as Combo[]) {
    const [p, q] = COMBOS[key].pair;
    if ((p === a && q === b) || (p === b && q === a)) return key;
  }
  throw new Error(`no combo for ${a} + ${b}`);
}

export type LinkKind = 'soak' | 'honey' | 'wired' | 'row';

/** Bonuses for building things next to each other (sharing a tile edge). */
export const LINKS: Record<LinkKind, { name: string; effect: string; color: string }> = {
  soak: {
    name: 'Sprinkler + Tesla Hutch',
    effect: "The Tesla Hutch's first hit always counts as Conducted.",
    color: '#4dabf7',
  },
  honey: {
    name: 'Honey Pot + Beehive',
    effect: 'Bees go for Sticky enemies first and hurt them 50% more.',
    color: '#f5b301',
  },
  wired: {
    name: 'Hamster Wheel + Tesla Hutch',
    effect: 'That Tesla Hutch ignores brown-outs.',
    color: '#ffe066',
  },
  row: {
    name: 'Three of the same tower in a row',
    effect: 'Each gets 15% more range.',
    color: '#ffffff',
  },
};

export const ROW_RANGE_MULT = 1.15;
export const HONEY_LINK_MULT = 1.5;
