# Warren Peace (working title)

A silly base defense survival game for the browser. Rabbits in Tesla towers defend the Giant
Golden Carrot from the Farmer's Lawn Care Army.

The full design is in [docs/DESIGN.md](docs/DESIGN.md).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the address Vite prints. Other commands: `npm test` runs the headless simulation
tests, `npm run build` type-checks and makes a static build in `dist/`.

## How to play

- Build by day, defend by night. Survive 10 nights.
- Red arrows at the map edge show where tonight's attack comes from.
- **Bunnies** crew every tower, farm and wheel. Hutches house more, and bunnies multiply at
  dawn: one per Hutch plus one per five bunnies, up to your housing.
- **Carrot Patches** pay 20 carrots every dawn.
- **Tesla Hutches** draw 5 Volts each. Hamster Wheels make 10. Run short and every Tesla Hutch
  fires at half speed.
- Gnomes attack whatever building is nearest and walk round walls. Mowers hunt Hutches and the
  Carrot, and shred Hedges. Picket Fences stand up to them.
- Lose a Hutch and its bunnies leave, which switches off your newest buildings.
- Some towers leave a **status** on enemies: Wet (Sprinkler), Sticky (Honey Pot), Zapped (Tesla
  Hutch), Spicy (Chili Flamer). A second, different status on the same enemy uses both up and
  sets off a **combo**. The Combos button in the game lists all six.
- Buildings that share an edge can boost each other, shown by a glowing bar: Sprinkler + Tesla
  Hutch, Honey Pot + Beehive, Hamster Wheel + Tesla Hutch, and three of the same tower in a row.
- Keys `1` to `0` then `Q`, `W`, `E` pick a building, `X` sells, `Space` starts the night, `Esc`
  or right click puts the tool away. Drag with a wall tool to paint a row.
- Buildings are repaired at dawn. Building at night costs 50% more.

## Status

Milestones 1 to 3 of the design are playable:

- One 24 x 24 map, ten nights of Garden Gnomes and Robo-Mowers from previewed directions.
- Eight towers: Carrot Launcher, Tesla Hutch, Cabbage Mortar, Sprinkler, Honey Pot, Chili
  Flamer, Beehive, Thumper.
- Hedge, Picket Fence, Carrot Patch, Hutch, Hamster Wheel. Carrots, Bunnies and Volts.
- Four statuses, six combos and four side-by-side bonuses.

Not built yet: upgrades and the Workshop (milestone 4), the hero, Rakes and Burrow Holes (5),
more enemies and bosses (6).

All numbers are first-pass. `tests/sim.test.ts` holds a balance guard: a scripted player with
farms, Hutches and rings of Launchers and Tesla Hutches but no walls must win most seeds.
`tests/combos.test.ts` pins down every status, combo, new tower and side-by-side bonus.

## Code layout

```
src/data/     buildings, enemies, nights, statuses and combos as plain data
src/sim/      deterministic 30 Hz simulation, no DOM access
src/render/   canvas renderer and visual effects
src/ui/       HUD
src/main.ts   input and the frame loop
tests/        headless simulation tests
```
