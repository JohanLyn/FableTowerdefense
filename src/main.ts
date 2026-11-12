import './style.css';
import { BUILDABLE } from './data/buildings';
import { DT, MAP_SIZE } from './data/config';
import { NIGHTS } from './data/waves';
import { Renderer, type Tool } from './render/renderer';
import { build, buildCost, canPlace, createGame, sell, startNight, step } from './sim/game';
import type { Game } from './sim/types';
import { Hud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const stage = document.getElementById('stage')!;
const renderer = new Renderer(canvas);

let game: Game = createGame(Date.now());
let tool: Tool = 'launcher';
let hover: { x: number; y: number } | null = null;
let speed = 1;
let painting = false;
/** The simulation only runs while no overlay (intro, win, loss) is up. */
let running = false;
let announced = false;

const hud = new Hud({
  selectTool: (t) => (tool = tool === t ? null : t),
  startNight: () => startNight(game),
  toggleSpeed: () => (speed = speed === 1 ? 2 : 1),
  overlayButton: () => {
    if (game.phase === 'won' || game.phase === 'lost') {
      game = createGame(Date.now());
      renderer.reset();
      announced = false;
    }
    hud.hideOverlay();
    running = true;
  },
});

hud.showOverlay(
  'Warren Peace',
  `<p>The Farmer wants his garden back. Keep the <b>Golden Carrot</b> alive for ${NIGHTS.length} nights.</p>
   <ul>
     <li>Build by day. The red arrows show where tonight's attack comes from.</li>
     <li><b>Carrot Launchers</b> snipe one target. <b>Tesla Hutches</b> chain lightning through crowds.</li>
     <li><b>Hedges</b> are cheap walls. Drag to paint a row. Gnomes go round them, mowers go through them.</li>
     <li>Gnomes attack your towers. Mowers head straight for the Carrot.</li>
     <li>Everything is repaired at dawn. You can build at night, but it costs 50% more.</li>
   </ul>`,
  'Defend the Carrot',
);

// ------------------------------------------------------------------- input

function tileFromEvent(ev: PointerEvent): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((ev.clientX - rect.left) / rect.width) * MAP_SIZE);
  const y = Math.floor(((ev.clientY - rect.top) / rect.height) * MAP_SIZE);
  return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE ? { x, y } : null;
}

function useTool(): void {
  if (!hover || !tool || !running) return;
  if (tool === 'sell') sell(game, hover.x, hover.y);
  else build(game, tool, hover.x, hover.y);
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  hover = tileFromEvent(ev);
  painting = true;
  canvas.setPointerCapture(ev.pointerId);
  useTool();
});

canvas.addEventListener('pointermove', (ev) => {
  const next = tileFromEvent(ev);
  const moved = next?.x !== hover?.x || next?.y !== hover?.y;
  hover = next;
  // Dragging paints hedges, so a wall does not take one click per tile.
  if (painting && moved && tool === 'hedge') useTool();
});

const stopPainting = (ev: PointerEvent): void => {
  painting = false;
  if (ev.pointerType !== 'mouse') hover = null;
};
canvas.addEventListener('pointerup', stopPainting);
canvas.addEventListener('pointercancel', stopPainting);
canvas.addEventListener('pointerleave', () => {
  if (!painting) hover = null;
});
canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  tool = null;
});

window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  const digit = Number(ev.key);
  if (digit >= 1 && digit <= BUILDABLE.length) tool = BUILDABLE[digit - 1];
  else if (digit === BUILDABLE.length + 1) tool = 'sell';
  else if (ev.key === 'Escape') tool = null;
  else if (ev.key === ' ') {
    ev.preventDefault();
    if (hud.overlayVisible) return;
    startNight(game);
  }
});

// -------------------------------------------------------------------- loop

function fit(): void {
  renderer.resize(Math.floor(Math.min(stage.clientWidth, stage.clientHeight) - 8));
}
window.addEventListener('resize', fit);
fit();

let last = performance.now();
let acc = 0;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (running) {
    acc += dt * speed;
    while (acc >= DT) {
      step(game);
      acc -= DT;
    }
    renderer.addEvents(game.events);
    game.events.length = 0;
  }

  if (!announced && (game.phase === 'won' || game.phase === 'lost')) {
    announced = true;
    running = false;
    if (game.phase === 'won') {
      hud.showOverlay(
        'The Carrot stands!',
        `<p>You held the garden for ${NIGHTS.length} nights and sent ${game.kills} of the Farmer's finest packing.</p>`,
        'Play again',
      );
    } else {
      hud.showOverlay(
        'The Carrot has been eaten',
        `<p>The warren fell on night ${game.night} after ${game.kills} kills. The Farmer is insufferable about it.</p>`,
        'Try again',
      );
    }
  }

  const valid =
    !!hover && !!tool && tool !== 'sell' && canPlace(game, tool, hover.x, hover.y) && game.carrots >= buildCost(game, tool);
  renderer.draw(game, running ? acc / DT : 1, dt, { hover, tool, valid });
  hud.update(game, tool, speed);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // Handy for poking at the game from the browser console.
  Object.assign(window, { getGame: () => game });
}
