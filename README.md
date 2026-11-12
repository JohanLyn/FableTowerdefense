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
- Keys `1` to `7` pick a building, `8` sells, `Space` starts the night, `Esc` or right click
  puts the tool away. Drag with a wall tool to paint a row.
- Buildings are repaired at dawn. Building at night costs 50% more.

## Status

Milestones 1 and 2 of the design are playable:

- One 24 x 24 map, ten nights of Garden Gnomes and Robo-Mowers from previewed directions.
- Carrot Launcher, Tesla Hutch, Hedge, Picket Fence, Carrot Patch, Hutch, Hamster Wheel.
- Carrots, Bunnies and Volts.

Not built yet: status combos and the other towers (milestone 3), upgrades and the Workshop (4),
the hero, Rakes and Burrow Holes (5), more enemies and bosses (6).

All numbers are first-pass. `tests/sim.test.ts` holds a balance guard: a scripted player with
farms, Hutches and rings of towers but no walls must win most seeds.

## Code layout

```
src/data/     buildings, enemies, nights and tuning constants as plain data
src/sim/      deterministic 30 Hz simulation, no DOM access
src/render/   canvas renderer and visual effects
src/ui/       HUD
src/main.ts   input and the frame loop
tests/        headless simulation tests
```
