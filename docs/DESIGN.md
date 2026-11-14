# Warren Peace — Game Design Document

*Working title. A silly base defense survival game for the browser.*

## 1. Pitch

The Farmer wants his garden back. You are a warren of over-engineered rabbits sitting on the
Giant Golden Carrot, and you are not moving. By day you plant, breed and build. By night the
Farmer's Lawn Care Army (gnomes, robo-mowers, crows, moles) comes at you from every side, and
rabbits in Tesla towers fry them.

**Genre:** base defense survival with tower upgrade trees, status combos, a living economy and a
controllable hero.
**Platform:** browser, desktop and mobile, TypeScript.
**Session:** one run is 10 nights, about 12 to 15 minutes. Endless mode after that.

## 2. Design pillars

1. **Your base is your build.** There are no preset lanes or build spots. Where you put walls,
   farms and towers decides where the fight happens.
2. **Combos over raw stats.** A tower alone is fine. Two towers that set each other up are great.
   The fun is discovering that wet gnomes conduct electricity.
3. **Greed is the difficulty slider.** Every carrot spent on economy is a carrot not spent on
   defense. The player sets their own risk.
4. **Silly, but readable.** Every joke is also a clear gameplay signal. A gnome with a wheelbarrow
   is obviously armored. A rabbit on a hamster wheel is obviously a generator.

## 3. Core loop

```
DAY (45 to 60 s, can be ended early for a carrot bonus)
  harvest income -> build and upgrade -> repair -> scout tonight's attack preview
NIGHT (waves from 1 to 4 directions)
  towers fight -> hero moves and casts -> abilities on cooldown -> survive
DAWN
  night reward + pick 1 of 3 Warren Perks -> next day
```

- The **Golden Carrot** sits in the middle of the map. If it is eaten, the run ends.
- The day shows a **threat preview**: which directions and which enemy types are coming. Planning
  against the preview is the main strategic decision each day.
- Building is allowed at night too, at +50% cost, so the day phase matters without locking the
  player out of emergency fixes.

## 4. Economy and base building

Three resources, each with one job:

| Resource | Source | Spent on | Role |
|---|---|---|---|
| **Carrots** | Carrot Patches (per day), kills, ending day early | Buildings, towers, walls | Main currency |
| **Bunnies** | Hutches. Each Hutch grows your population every dawn | Every tower and work building needs a crew | Supply cap that compounds |
| **Volts** | Hamster Wheels (a bunny runs in it) | Electric towers draw Volts continuously | Power budget |

Design notes:

- **Bunnies multiply.** Every dawn the warren gains +1 bunny per Hutch and +1 more per 5
  bunnies it already has, up to total housing. Early Hutches pay off hugely later. This is the
  game's interest mechanic, and it is thematically correct. The Golden Carrot houses the first 4.
- **Losing housing hurts.** Bunnies without a home leave, and crews are assigned oldest
  building first, so a destroyed Hutch switches off the newest buildings.
- **Volts are a global budget, not a wire network.** Generation versus draw. If draw exceeds
  generation, electric towers brown out and fire at half speed. Simple to read, still forces
  planning. (A wired grid with pylons is a possible later map modifier.)
- **Economy buildings are targets.** Crows steal from Carrot Patches and mowers love Hutches, so
  a greedy sprawl has to be defended.

Buildings:

| Building | Cost | Crew | Effect |
|---|---|---|---|
| Carrot Patch | 40 | 1 | +20 carrots per day |
| Hutch | 60 | 0 | Houses 6 bunnies, arrives with 2, grows population at dawn |
| Hamster Wheel | 50 | 1 | +10 Volts |
| Workshop | 120 | 2 | Unlocks tier 3 upgrades and specializations |
| Hedge Wall | 5 | 0 | Cheap, blocks ground enemies, weak to mowers |
| Picket Fence | 12 | 0 | Tougher wall, towers can shoot over it |
| Rake | 8 | 0 | One-shot trap, stuns whoever steps on it |
| Burrow Hole | 30 | 0 | Hero respawn point and fast-travel link |

## 5. Towers

Eight towers at launch. Each has three linear tiers, then splits into **two specializations**
(needs a Workshop). Specializations change behavior, not just numbers.

| Tower | Role | Applies | Specialization A | Specialization B |
|---|---|---|---|---|
| **Carrot Launcher** | Cheap single target | none | *Gatling Carrot*: very fast, short range | *Parsnip Sniper*: map-long range, hits hardest target |
| **Tesla Hutch** (rabbit in a Tesla coil) | Chain lightning, uses Volts | Zapped | *Storm Coil*: chains to 8, weaker per hit | *Death Ray-bbit*: single continuous beam that ramps up |
| **Cabbage Mortar** | Long range splash, cannot hit close | none | *Sauerkraut Shells*: leaves a poison cloud | *Big Bertha Cabbage*: huge slow shell, knocks back |
| **Sprinkler** | No damage, soaks everything around it | Wet | *Pressure Washer*: pushes enemies backward | *Fog Machine*: enemies inside lose their targets |
| **Honey Pot** | Slows a zone | Sticky | *Tar Pit*: near-total slow, small area | *Honey Cannon*: lobs sticky globs at range |
| **Chili Flamer** | Short cone, damage over time | Spicy | *Ghost Pepper*: burning spreads between enemies | *Popcorn Maker*: kills explode |
| **Beehive** | Locks on to one enemy and stings it down, hits air, needs no bunny | none | *Killer Bees*: stacks damage on one target | *Bee-52s*: bomb runs along a line |
| **Thumper** (rabbit on a big drum) | Pulsed stun around itself | none | *Bass Drop*: bigger radius, damages walls' attackers | *Carrot FM*: no stun, buffs fire rate of adjacent towers |

## 6. Synergies

Two layers, both visible in the UI so the player can learn them without a wiki.

**Status combos.** Four statuses: Wet, Sticky, Zapped, Spicy. When two meet on one enemy, they
are consumed and trigger a combo:

| Combo | Name | Effect |
|---|---|---|
| Wet + Zapped | **Conducted** | Lightning damage doubled and chains +3 |
| Sticky + Spicy | **Caramelized** | Takes 50% more damage for 5 s (and loses armor, once armored enemies exist) |
| Wet + Spicy | **Steamed** | Small area burst (later also clears Fog and reveals moles) |
| Sticky + Zapped | **Static Cling** | Enemy pulls nearby enemies into a clump and stuns them briefly |
| Wet + Sticky | **Syrup Slick** | Leaves a puddle on the ground that slows everyone in it |
| Zapped + Spicy | **Flash Fried** | Instant burst based on missing health |

An enemy carries one status at a time, so which tower reaches it first matters: a Honey Pot in
front of a Sprinkler turns Wet into Syrup Slick before the Tesla Hutch ever sees it.

**Adjacency links.** Towers that share a tile edge form a visible link:

- Sprinkler next to Tesla Hutch: the Hutch's first hit always counts as Conducted.
- Beehive next to Honey Pot: bees prioritize Sticky enemies and deal +50% to them.
- Hamster Wheel next to any electric tower: that tower ignores brown-outs.
- Any three of the same tower in a row: +15% range (encourages batteries, costs flexibility).

## 7. Hero and active abilities

One hero per run, under direct control but deliberately low on micro, so it never competes with
building for the player's attention:

- Click or tap a spot and the hero goes there, then **guards** that spot: auto-attacks anything
  in reach and returns to it afterwards. No attack commands, no kiting required.
- Abilities fire from where the hero stands (no aiming step), so each is one key or one tap.
- Dies, then respawns at the nearest Burrow Hole after a timer that grows each night.

The hero is a mobile plug for whichever side of the base is leaking, not an action character.

| Hero | Style | Ability 1 | Ability 2 |
|---|---|---|---|
| **Sergeant Fluff** | Melee bruiser | *Thump*: area stun | *Rally*: nearby towers fire faster for 6 s |
| **Professor Ohm** | Ranged engineer | *Overclock*: one tower triples fire rate, then needs a nap | *Jumper Cables*: revives a destroyed tower at half health |
| **DJ Lop** | Support | *Drop the Beet*: enemies in an area dance in place | *Encore*: resets ability cooldowns of nearby towers |

Warren abilities (global, long cooldown, unlocked by perks):

- **Carrot Airstrike**: line of explosions anywhere on the map.
- **Binky Stampede**: every idle bunny charges across the map through enemies.
- **Emergency Burrow**: all walls fully repair instantly.

## 8. Enemies

Every enemy has a target preference, which is what makes base layout matter.

| Enemy | Trait | Prefers to attack | Answer |
|---|---|---|---|
| Garden Gnome | Basic swarm | Nearest building | Anything |
| Wheelbarrow Gnome | Front armor | Walls | Caramelized, flank fire |
| Slug | Slow, huge health, immune to Sticky | Golden Carrot | Sustained damage, Spicy |
| Crow | Flies over walls | Carrot Patches (steals carrots) | Beehive, Parsnip Sniper |
| Mole | Tunnels under walls, surfaces inside | Economy buildings | Thumper, Steamed, inner defenses |
| Robo-Mower | Fast, shreds Hedges | Hutches and the Golden Carrot | Picket Fences, stuns, Rakes |
| Scarecrow | Fear aura, towers in range fire slower | Towers | Outrange it |
| Sprinkler Bot | Heals allies, makes them Wet | Follows the pack | Use its Wet against it with Tesla |
| Leaf Blower Gnome | Pushes projectiles off course, clears Honey | Support towers | Lightning and bees ignore it |

Bosses: a mid-boss on night 5 and a final boss on night 10. The night 5 boss is drawn from
**The Ride-On** (a mower that drops gnomes), **Scarecrow King** (map-wide fear pulses) and
**The Combine** (eats walls to heal), and is shown in the threat preview from night 1 so the
player can build toward it. Night 10 is always **The Farmer** in a tractor mech, three phases.

## 9. Run structure and progression

- **Within a run:** 10 nights. After each night pick 1 of 3 **Warren Perks** (for example:
  "Hutches hold +2", "Rakes reset themselves", "Conducted also stuns"). This gives runs variety
  without making the game a full roguelike.
- **Between runs:** earn **Golden Seeds** from nights survived. Spend them to unlock towers,
  heroes, maps and starting perks. Unlocks widen options and do not add raw power, so skill
  stays the deciding factor.
- **Maps:** each has a terrain twist. *Back Garden* (open, tutorial), *Greenhouse* (narrow, glass
  walls break), *Pumpkin Patch* (pumpkins block building until cleared), *Rooftop* (air heavy).
- **Difficulty:** "Fertilizer" levels after a first win, each adding one enemy modifier.

## 10. Look, feel and audio

- Top-down view with a slight tilt, chunky flat vector shapes, thick outlines, big eyes.
- Art is drawn in code or SVG at first, so nothing blocks on assets and it scales to any screen.
- Lots of squash and stretch, floating damage numbers, screen shake on big hits (toggleable).
- Audio: springy boings, kazoo fanfare at dawn, the music gains layers as the night gets worse.

## 11. Controls and UI

- **Desktop:** mouse to build and select, right click or WASD to move the hero, Q and E for hero
  abilities, 1 to 8 for the build bar, space to end the day.
- **Mobile:** tap to build, drag to pan, pinch to zoom, hero follows a tap, ability buttons in
  the thumb corners.
- Always on screen: carrots, bunnies used and total, Volts draw and supply, night counter,
  threat preview arrows at the map edges.

## 12. Technical plan

- **Stack:** TypeScript, Vite, HTML Canvas 2D. No engine. A few hundred entities is well within
  Canvas 2D, and it keeps the build small and the code fully ours. PixiJS is the fallback if
  profiling says we need it.
- **Simulation separate from rendering.** Fixed 30 Hz deterministic simulation with a seeded
  random generator, rendering interpolated at display rate. This lets us run whole nights
  headless in tests to check balance and catch regressions.
- **Data-driven content.** Towers, enemies, waves and perks are plain typed data files. Adding
  a tower should not need engine changes.
- **Pathfinding:** one flow field per target type over the tile grid, recomputed when buildings
  change. Walls are high-cost tiles, not impassable ones, so enemies chew through a wall when
  the detour is too long. This prevents full wall-off exploits.
- **Grid:** 24 x 24 tiles for the first map with the whole map on screen, buildings are 1x1 or 2x2.
  Larger maps need a pan and zoom camera first.
- **Saves:** meta progression in localStorage. Mid-run save is a later milestone.

```
src/
  sim/        game state, systems (economy, combat, status, pathing, waves), no DOM access
  data/       towers.ts, enemies.ts, waves.ts, perks.ts, maps.ts
  render/     canvas renderer, camera, effects
  ui/         HUD, build bar, menus
  input/      mouse, keyboard, touch
  main.ts
tests/        headless simulation tests
```

## 13. Milestones

| # | Milestone | Playable result |
|---|---|---|
| 1 | **Vertical slice** | One map, Golden Carrot, Carrot Launcher, Tesla Hutch, Hedge, gnomes and mowers, day and night, 5 nights |
| 2 | **Economy** | Carrots, Bunnies, Volts, all economy buildings, threat preview |
| 3 | **Combos** | Four statuses, six combos, adjacency links, remaining towers |
| 4 | **Upgrades** | Three tiers and two specializations per tower, Workshop |
| 5 | **Hero** | Sergeant Fluff, hero abilities, Warren abilities, Burrow Holes |
| 6 | **Full run** | All enemies, four bosses, 10 nights, Warren Perks |
| 7 | **Meta and polish** | Golden Seeds, unlocks, more maps and heroes, touch controls, audio, juice |

Milestone 1 is the test of the whole idea: if building a base and watching rabbits zap gnomes is
not fun with two towers, more content will not fix it.

## 14. Decisions and open questions

Decided:

- Runs are short: 10 nights.
- The hero is directly controlled, using the low-micro guard model in section 7.

Open:

1. **Title.** "Warren Peace" is a placeholder, to be decided later.
2. **All numbers in this document are first guesses** and have not been play-tested. With 10
   nights, bunny growth and perk pacing in particular need tuning in milestone 2.
