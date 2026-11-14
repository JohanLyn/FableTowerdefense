import { BUILDABLE, BUILDINGS, type BuildingKind } from '../data/buildings';
import { ENEMIES, type EnemyKind } from '../data/enemies';
import { COMBOS, LINKS, STATUS_INFO, type Combo, type LinkKind, type Status } from '../data/statuses';
import { NIGHTS, nightPreview, type Dir } from '../data/waves';
import type { Tool } from '../render/renderer';
import { buildCost, canAfford, earlyBonus, freeBunnies } from '../sim/game';
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
  drawIcon(kind: BuildingKind, canvas: HTMLCanvasElement): void;
  showGuide(): void;
  startNight(): void;
  toggleSpeed(): void;
  overlayButton(): void;
}

/** Keyboard shortcut for each build bar slot, in BUILDABLE order. */
export const TOOL_KEYS = '1234567890qwe';
export const SELL_KEY = 'x';

export class Hud {
  private toolInfo = el('tool-info');
  /** Tool whose button the pointer is over, shown in the info line. */
  private peek: Tool = null;
  private toolButtons = new Map<Exclude<Tool, null>, { button: HTMLButtonElement; cost?: HTMLElement }>();
  private carrots = el('carrots');
  private bunnies = el('bunnies');
  private bunnyStat = el('bunny-stat');
  private volts = el('volts');
  private voltStat = el('volt-stat');
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
      button.className = 'tool';
      button.title = `${def.name} (${TOOL_KEYS[i].toUpperCase()})`;
      const icon = document.createElement('canvas');
      icon.width = icon.height = 96;
      handlers.drawIcon(kind, icon);
      const cost = document.createElement('small');
      button.append(icon, cost);
      this.addTool(tools, kind, button, handlers);
      this.toolButtons.set(kind, { button, cost });
      // A gap between towers, walls and economy buildings.
      const next = BUILDABLE[i + 1];
      if (next && group(next) !== group(kind)) tools.append(Object.assign(document.createElement('span'), { className: 'gap' }));
    });
    const sell = document.createElement('button');
    sell.className = 'tool';
    sell.title = `Sell (${SELL_KEY.toUpperCase()})`;
    sell.innerHTML = '<span class="glyph">✕</span><small>Sell</small>';
    tools.append(Object.assign(document.createElement('span'), { className: 'gap' }));
    this.addTool(tools, 'sell', sell, handlers);
    this.toolButtons.set('sell', { button: sell });
    el('guide').onclick = handlers.showGuide;

    this.startNight.onclick = handlers.startNight;
    this.speed.onclick = handlers.toggleSpeed;
    el('overlay-button').onclick = handlers.overlayButton;
  }

  private addTool(parent: HTMLElement, tool: Exclude<Tool, null>, button: HTMLButtonElement, handlers: HudHandlers): void {
    button.onclick = () => handlers.selectTool(tool);
    button.onpointerenter = (ev) => {
      if (ev.pointerType === 'mouse') this.peek = tool;
    };
    button.onpointerleave = () => (this.peek = null);
    parent.append(button);
  }

  update(g: Game, tool: Tool, speed: number): void {
    const info = toolInfo(g, this.peek ?? tool);
    if (this.toolInfo.innerHTML !== info) this.toolInfo.innerHTML = info;
    setText(this.carrots, String(g.carrots));
    setText(this.bunnies, `${g.crewUsed}/${g.bunnies} (${g.housing})`);
    this.bunnyStat.classList.toggle('warn', freeBunnies(g) === 0);
    setText(this.volts, `${g.voltDraw}/${g.voltSupply}`);
    this.voltStat.classList.toggle('warn', g.brownout);
    setText(this.night, `Night ${g.night}/${NIGHTS.length}`);
    setText(this.status, statusLine(g));
    const carrot = g.buildings.get(g.carrotId);
    this.carrotHp.style.width = `${carrot ? (100 * carrot.hp) / carrot.maxHp : 0}%`;

    for (const [kind, { button, cost }] of this.toolButtons) {
      button.classList.toggle('selected', kind === tool);
      if (kind === 'sell' || !cost) continue;
      setText(cost, `🥕${buildCost(g, kind as BuildingKind)}`);
      button.classList.toggle('poor', !canAfford(g, kind as BuildingKind));
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
    const power = g.brownout ? ' Brown-out: Tesla Hutches at half speed!' : '';
    return `Night: ${left} ${left === 1 ? 'enemy' : 'enemies'} left.${power}`;
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

function group(kind: BuildingKind): string {
  const def = BUILDINGS[kind];
  return def.attack ? 'tower' : def.wall ? 'wall' : 'economy';
}

/** One line describing a tool: name, shortcut, what it costs and what it does. */
function toolInfo(g: Game, tool: Tool): string {
  if (!tool) return 'Pick something to build. Right click or Esc puts the tool away.';
  if (tool === 'sell') return `<b>Sell</b> <kbd>${SELL_KEY.toUpperCase()}</kbd> Click a building to remove it for half its cost back.`;
  const def = BUILDINGS[tool];
  const key = TOOL_KEYS[BUILDABLE.indexOf(tool)].toUpperCase();
  const needs = [`🥕 ${buildCost(g, tool)}`];
  if (def.crew) needs.push(`🐇 ${def.crew}`);
  if (def.draw) needs.push(`⚡ ${def.draw}`);
  return `<b>${def.name}</b> <kbd>${key}</kbd> <span class="needs">${needs.join(' ')}</span> ${def.blurb}`;
}

/** The combo and link reference shown from the Combos button. */
export function guideHtml(): string {
  const chip = (s: Status): string => `<span class="chip" style="background:${STATUS_INFO[s].color}">${STATUS_INFO[s].name}</span>`;
  const statuses = (Object.keys(STATUS_INFO) as Status[])
    .map((s) => `<tr><td>${chip(s)}</td><td>${STATUS_INFO[s].effect}</td></tr>`)
    .join('');
  const combos = (Object.keys(COMBOS) as Combo[])
    .map((c) => {
      const def = COMBOS[c];
      return `<tr><td>${chip(def.pair[0])} + ${chip(def.pair[1])}</td><td><b>${def.name}.</b> ${def.effect}</td></tr>`;
    })
    .join('');
  const links = (Object.keys(LINKS) as LinkKind[])
    .map((l) => `<tr><td><span class="swatch" style="background:${LINKS[l].color}"></span>${LINKS[l].name}</td><td>${LINKS[l].effect}</td></tr>`)
    .join('');
  return `<p>An enemy carries one status at a time. Hit it with a second, different one and both are used up in a combo.</p>
    <table class="guide">${statuses}</table>
    <h2>Combos</h2><table class="guide">${combos}</table>
    <h2>Side by side</h2>
    <p>Buildings that share an edge can boost each other. A glowing bar joins them when it works.</p>
    <table class="guide">${links}</table>`;
}
