import { BUILDABLE, BUILDINGS, type BuildingKind } from '../data/buildings';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { NIGHTS, nightPreview, type Dir } from '../data/waves';
import type { Tool } from '../render/renderer';
import { buildCost, earlyBonus } from '../sim/game';
import type { Game } from '../sim/types';

const DIR_NAMES: Record<Dir, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

/** Sets text only when it changed, so per-frame updates do not thrash the DOM. */
function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export interface HudHandlers {
  selectTool(tool: Tool): void;
  startNight(): void;
  toggleSpeed(): void;
  overlayButton(): void;
}

export class Hud {
  private toolButtons = new Map<Exclude<Tool, null>, { button: HTMLButtonElement; cost?: HTMLElement }>();
  private carrots = el('carrots');
  private night = el('night');
  private status = el('status');
  private carrotHp = el('carrot-hp');
  private startNight = el<HTMLButtonElement>('start-night');
  private speed = el<HTMLButtonElement>('speed');
  private overlay = el('overlay');

  constructor(handlers: HudHandlers) {
    const tools = el('tools');
    BUILDABLE.forEach((kind, i) => {
      const def = BUILDINGS[kind];
      const button = document.createElement('button');
      button.title = def.blurb;
      button.innerHTML = `${def.name}<kbd>${i + 1}</kbd><small></small>`;
      button.onclick = () => handlers.selectTool(kind);
      tools.append(button);
      this.toolButtons.set(kind, { button, cost: button.querySelector('small')! });
    });
    const sell = document.createElement('button');
    sell.title = 'Remove a building for half its cost back.';
    sell.innerHTML = `Sell<kbd>${BUILDABLE.length + 1}</kbd><small>50% back</small>`;
    sell.onclick = () => handlers.selectTool('sell');
    tools.append(sell);
    this.toolButtons.set('sell', { button: sell });

    this.startNight.onclick = handlers.startNight;
    this.speed.onclick = handlers.toggleSpeed;
    el('overlay-button').onclick = handlers.overlayButton;
  }

  update(g: Game, tool: Tool, speed: number): void {
    setText(this.carrots, String(g.carrots));
    setText(this.night, `Night ${g.night}/${NIGHTS.length}`);
    setText(this.status, statusLine(g));
    const carrot = g.buildings.get(g.carrotId);
    this.carrotHp.style.width = `${carrot ? (100 * carrot.hp) / carrot.maxHp : 0}%`;

    for (const [kind, { button, cost }] of this.toolButtons) {
      button.classList.toggle('selected', kind === tool);
      if (kind === 'sell' || !cost) continue;
      const price = buildCost(g, kind as BuildingKind);
      setText(cost, `🥕 ${price}`);
      button.classList.toggle('poor', g.carrots < price);
    }

    const bonus = earlyBonus(g);
    this.startNight.disabled = g.phase !== 'day';
    this.startNight.innerHTML =
      g.phase === 'day'
        ? `Start night${bonus > 0 ? ` (+${bonus} 🥕)` : ''}<kbd>Space</kbd>`
        : g.phase === 'night'
          ? 'Night in progress'
          : 'Run over';
    setText(this.speed, `${speed}×`);
  }

  showOverlay(title: string, bodyHtml: string, button: string): void {
    el('overlay-title').textContent = title;
    el('overlay-body').innerHTML = bodyHtml;
    el('overlay-button').textContent = button;
    this.overlay.hidden = false;
  }

  hideOverlay(): void {
    this.overlay.hidden = true;
  }

  get overlayVisible(): boolean {
    return !this.overlay.hidden;
  }
}

function statusLine(g: Game): string {
  if (g.phase === 'night') {
    const left = g.enemies.length + g.spawnQueue.length;
    return `Night: ${left} ${left === 1 ? 'enemy' : 'enemies'} left. Building costs 50% more.`;
  }
  if (g.phase !== 'day') return '';
  const { dirs, counts } = nightPreview(g.night);
  const who = (Object.keys(counts) as EnemyKind[]).map((k) => `${counts[k]} ${ENEMIES[k].name}s`).join(', ');
  const from = dirs.map((d) => DIR_NAMES[d]).join(', ');
  const timer = g.night > 1 ? `Day ${formatTime(g.dayTimer)}. ` : 'Day. ';
  return `${timer}Tonight: ${who} from the ${from}.`;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
