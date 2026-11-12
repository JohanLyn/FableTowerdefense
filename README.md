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

- Build by day, defend by night. Survive 5 nights.
- Red arrows at the map edge show where tonight's attack comes from.
- Keys `1` to `3` pick a building, `4` sells, `Space` starts the night, `Esc` or right click
  puts the tool away. Drag with the Hedge tool to paint a wall.
- Gnomes attack your towers and walk round hedges. Mowers go straight for the Carrot and shred
  hedges on the way.
- Buildings are repaired at dawn. Building at night costs 50% more.

## Status

Milestone 1 of the design (vertical slice) is playable:

- One 24 x 24 map, the Golden Carrot, Carrot Launcher, Tesla Hutch and Hedge.
- Garden Gnomes and Robo-Mowers over 5 nights, attacking from previewed directions.
- Carrots come from kills, dawn rewards and ending the day early. Farms, Bunnies and Volts
  arrive in milestone 2.

All numbers are first-pass. `tests/sim.test.ts` holds a balance guard: a scripted player with a
plain ring of towers and no walls must win most seeds.

## Code layout

```
src/data/     buildings, enemies, nights and tuning constants as plain data
src/sim/      deterministic 30 Hz simulation, no DOM access
src/render/   canvas renderer and visual effects
src/ui/       HUD
src/main.ts   input and the frame loop
tests/        headless simulation tests
```
