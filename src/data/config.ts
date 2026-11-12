/** Global tuning constants. All numbers are first-pass and expected to change. */
export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

export const MAP_SIZE = 24;
/** Outer ring of tiles where enemies spawn and nothing can be built. */
export const BUILD_MARGIN = 2;

export const START_CARROTS = 200;
export const DAY_SECONDS = 45;
/** Carrots per second of day skipped. */
export const EARLY_BONUS_PER_SECOND = 0.5;
/** Building at night costs this much more. */
export const NIGHT_BUILD_MULT = 1.5;
export const SELL_REFUND = 0.5;
