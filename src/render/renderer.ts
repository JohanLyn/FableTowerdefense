import { BUILDINGS, type BuildingKind } from '../data/buildings';
import { BUILD_MARGIN, MAP_SIZE } from '../data/config';
import { COMBOS, LINKS, STATUS_INFO } from '../data/statuses';
import { nightPreview, type Dir } from '../data/waves';
import type { Building, Enemy, Game, GameEvent } from '../sim/types';

const N = MAP_SIZE;
const TAU = Math.PI * 2;

export type Tool = BuildingKind | 'sell' | null;

export interface ViewState {
  hover: { x: number; y: number } | null;
  tool: Tool;
  /** Whether the hovered tile is a legal, affordable placement for the tool. */
  valid: boolean;
}

type Fx =
  | { type: 'zap'; age: number; life: number; points: [number, number][] }
  | { type: 'puff'; age: number; life: number; x: number; y: number; color: string; size: number }
  | { type: 'text'; age: number; life: number; x: number; y: number; text: string; color: string }
  | { type: 'ring'; age: number; life: number; x: number; y: number; r: number; color: string }
  | { type: 'flame'; age: number; life: number; x: number; y: number; angle: number; range: number; spread: number };

/** Colour of the expanding ring each pulse tower gives off. */
const PULSE_COLORS: Partial<Record<BuildingKind, string>> = {
  sprinkler: STATUS_INFO.wet.color,
  honey: STATUS_INFO.sticky.color,
  thumper: '#ffffff',
};

/** Draws the game in tile units. Holds only visual state, never game state. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private fx: Fx[] = [];
  private nightAmount = 0;
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Sets the on-screen size of the square canvas in CSS pixels. */
  resize(cssSize: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = this.canvas.style.height = `${cssSize}px`;
    this.canvas.width = this.canvas.height = Math.round(cssSize * dpr);
  }

  reset(): void {
    this.fx.length = 0;
  }

  addEvents(events: GameEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'zap':
          this.fx.push({ type: 'zap', age: 0, life: 0.18, points: ev.points });
          break;
        case 'hit':
          this.fx.push({ type: 'puff', age: 0, life: 0.2, x: ev.x, y: ev.y, color: '#ff9a2e', size: 0.25 });
          break;
        case 'bite':
          this.fx.push({ type: 'puff', age: 0, life: 0.2, x: ev.x, y: ev.y, color: '#ffffff', size: 0.3 });
          break;
        case 'death':
          this.fx.push({ type: 'puff', age: 0, life: 0.35, x: ev.x, y: ev.y, color: '#fff3c4', size: 0.6 });
          this.fx.push({ type: 'text', age: 0, life: 0.8, x: ev.x, y: ev.y, text: `+${ev.bounty}`, color: '#ffb347' });
          break;
        case 'combo': {
          const def = COMBOS[ev.combo];
          this.fx.push({ type: 'ring', age: 0, life: 0.45, x: ev.x, y: ev.y, r: 1.1, color: def.color });
          this.fx.push({ type: 'text', age: 0, life: 1.1, x: ev.x, y: ev.y - 0.3, text: `${def.name}!`, color: def.color });
          break;
        }
        case 'pulse':
          this.fx.push({ type: 'ring', age: 0, life: 0.4, x: ev.x, y: ev.y, r: ev.r, color: PULSE_COLORS[ev.kind] ?? '#ffffff' });
          break;
        case 'boom':
          this.fx.push({ type: 'puff', age: 0, life: 0.35, x: ev.x, y: ev.y, color: '#b7e4a0', size: ev.r });
          this.fx.push({ type: 'ring', age: 0, life: 0.35, x: ev.x, y: ev.y, r: ev.r, color: '#e9f7df' });
          break;
        case 'flame':
          this.fx.push({ type: 'flame', age: 0, life: 0.3, x: ev.x, y: ev.y, angle: ev.angle, range: ev.range, spread: ev.spread });
          break;
        case 'income':
          this.fx.push({ type: 'text', age: 0, life: 1.4, x: ev.x, y: ev.y, text: `+${ev.amount}`, color: '#ffb347' });
          break;
        case 'born':
          this.fx.push({
            type: 'text',
            age: 0,
            life: 2,
            x: ev.x,
            y: ev.y - 1,
            text: `+${ev.count} ${ev.count === 1 ? 'bunny' : 'bunnies'}`,
            color: '#ffd6e0',
          });
          break;
        case 'destroyed':
          this.fx.push({ type: 'puff', age: 0, life: 0.5, x: ev.x, y: ev.y, color: '#6b4a2b', size: 1.1 });
          break;
      }
    }
  }

  draw(g: Game, alpha: number, dt: number, view: ViewState): void {
    const ctx = this.ctx;
    this.time += dt;
    const scale = this.canvas.width / N;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineJoin = ctx.lineCap = 'round';

    this.drawGround();
    if (g.phase === 'day') this.drawThreats(nightPreview(g.night).dirs);

    this.drawZones(g);
    this.drawLinks(g);
    for (const b of g.buildings.values()) this.drawBuilding(g, b);
    for (const e of g.enemies) this.drawEnemy(e, alpha);

    for (const p of g.projectiles) {
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      if (p.kind === 'shell') {
        // A cabbage on a lob: it swells and lifts at the top of its arc.
        const arc = Math.sin(Math.PI * Math.min(1, p.t / p.dur));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y, 0.16, 0.08, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#8fd16a';
        ctx.strokeStyle = '#4c8f2f';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.arc(x, y - arc * 1.2, 0.16 + arc * 0.1, 0, TAU);
        ctx.fill();
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#ff8c1a';
      ctx.beginPath();
      ctx.arc(x, y, 0.11, 0, TAU);
      ctx.fill();
    }
    this.drawBees(g, alpha);

    // Night falls as a blue wash under the effects, so lightning stays bright.
    const wantNight = g.phase === 'night' ? 1 : 0;
    this.nightAmount += (wantNight - this.nightAmount) * Math.min(1, dt * 3);
    if (this.nightAmount > 0.01) {
      ctx.fillStyle = `rgba(14, 18, 70, ${0.4 * this.nightAmount})`;
      ctx.fillRect(0, 0, N, N);
    }

    for (const b of g.buildings.values()) this.drawHealth(b.x + b.size / 2, b.y - 0.08, b.size * 0.8, b.hp / b.maxHp);
    for (const e of g.enemies) {
      const x = e.px + (e.x - e.px) * alpha;
      const y = e.py + (e.y - e.py) * alpha;
      this.drawHealth(x, y - 0.55, 0.6, e.hp / e.maxHp);
    }

    this.drawFx(dt);
    this.drawHover(g, view);
  }

  // ------------------------------------------------------------- terrain

  private drawGround(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#7cc463';
    ctx.fillRect(0, 0, N, N);
    ctx.fillStyle = '#74bb5c';
    for (let y = 0; y < N; y++) {
      for (let x = (y & 1) ^ 1; x < N; x += 2) ctx.fillRect(x, y, 1, 1);
    }
    // The spawn ring where nothing can be built.
    ctx.fillStyle = 'rgba(60, 90, 40, 0.28)';
    const m = BUILD_MARGIN;
    ctx.fillRect(0, 0, N, m);
    ctx.fillRect(0, N - m, N, m);
    ctx.fillRect(0, m, m, N - 2 * m);
    ctx.fillRect(N - m, m, m, N - 2 * m);
  }

  private drawThreats(dirs: Dir[]): void {
    const ctx = this.ctx;
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 4);
    ctx.strokeStyle = `rgba(214, 40, 40, ${0.5 + 0.5 * pulse})`;
    ctx.lineWidth = 0.28;
    for (const dir of dirs) {
      ctx.save();
      ctx.translate(N / 2, N / 2);
      ctx.rotate({ N: 0, E: Math.PI / 2, S: Math.PI, W: -Math.PI / 2 }[dir]);
      for (let i = 0; i < 3; i++) {
        const y = -N / 2 + 0.5 + i * 0.6 + pulse * 0.25;
        ctx.globalAlpha = 1 - i * 0.28;
        ctx.beginPath();
        ctx.moveTo(-1.2, y);
        ctx.lineTo(0, y + 0.7);
        ctx.lineTo(1.2, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ----------------------------------------------------------- buildings

  private drawBuilding(g: Game, b: Building): void {
    const cx = b.x + b.size / 2;
    const cy = b.y + b.size / 2;
    switch (b.kind) {
      case 'carrot':
        this.drawGoldenCarrot(cx, cy);
        break;
      case 'hedge':
        this.drawHedge(g, b);
        break;
      case 'fence':
        this.drawFence(g, b);
        break;
      case 'launcher':
        this.drawLauncher(b, cx, cy);
        break;
      case 'tesla':
        this.drawTesla(b, cx, cy, g.brownout && !b.wired);
        break;
      case 'mortar':
        this.drawMortar(b, cx, cy);
        break;
      case 'sprinkler':
        this.drawSprinkler(b, cx, cy);
        break;
      case 'honey':
        this.drawHoneyPot(b, cx, cy);
        break;
      case 'flamer':
        this.drawFlamer(b, cx, cy);
        break;
      case 'beehive':
        this.drawBeehive(cx, cy);
        break;
      case 'thumper':
        this.drawThumper(b, cx, cy);
        break;
      case 'patch':
        this.drawPatch(b);
        break;
      case 'hutch':
        this.drawHutch(b, cx, cy);
        break;
      case 'wheel':
        this.drawWheel(b, cx, cy);
        break;
    }
    if (!b.staffed && BUILDINGS[b.kind].crew) this.drawUnstaffed(cx, cy);
  }

  private drawZones(g: Game): void {
    const ctx = this.ctx;
    for (const z of g.zones) {
      ctx.globalAlpha = Math.min(1, z.time) * 0.5;
      ctx.fillStyle = STATUS_INFO.sticky.color;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Glowing connectors between buildings that are boosting each other. */
  private drawLinks(g: Game): void {
    const ctx = this.ctx;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 3);
    for (const l of g.links) {
      ctx.strokeStyle = LINKS[l.kind].color;
      ctx.globalAlpha = (l.kind === 'row' ? 0.45 : 0.85) * pulse;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(l.ax, l.ay);
      ctx.lineTo(l.bx, l.by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawBees(g: Game, alpha: number): void {
    const ctx = this.ctx;
    for (const b of g.buildings.values()) {
      if (b.kind !== 'beehive') continue;
      const target = b.targetId ? g.enemies.find((e) => e.id === b.targetId) : undefined;
      const cx = target ? target.px + (target.x - target.px) * alpha : b.x + 0.5;
      const cy = target ? target.py + (target.y - target.py) * alpha : b.y + 0.5;
      const spread = target ? 0.3 : 0.5;
      for (let i = 0; i < 5; i++) {
        const a = this.time * (5 + i) + i * 1.3 + b.id;
        const x = cx + Math.cos(a) * spread;
        const y = cy - 0.1 + Math.sin(a * 1.3) * spread * 0.7;
        ctx.fillStyle = '#ffd43b';
        ctx.beginPath();
        ctx.arc(x, y, 0.055, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(x - 0.015, y - 0.05, 0.03, 0.1);
      }
    }
  }

  private base(b: Building, fill: string, stroke: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(b.x + 0.5, b.y + 0.5, 0.42, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  private drawMortar(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    this.base(b, '#6f7d5a', '#3d4a2c');
    const recoil = Math.max(0, b.cooldown - (BUILDINGS.mortar.cooldown! - 0.2)) * 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(b.aim);
    ctx.fillStyle = '#39424e';
    roundRect(ctx, -0.1 - recoil, -0.17, 0.55, 0.34, 0.08);
    ctx.fill();
    ctx.fillStyle = '#8fd16a';
    ctx.beginPath();
    ctx.arc(0.42 - recoil, 0, 0.12, 0, TAU);
    ctx.fill();
    ctx.restore();
    this.drawRabbit(cx - Math.cos(b.aim) * 0.16, cy - Math.sin(b.aim) * 0.16 + 0.05, 0.15, '#e6ddcf');
  }

  private drawSprinkler(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    this.base(b, '#3f7fbf', '#234a73');
    const spin = b.staffed ? this.time * (b.cooldown > 0 ? 7 : 1.5) : 0;
    ctx.strokeStyle = '#cfe8ff';
    ctx.lineWidth = 0.08;
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * TAU) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 0.36, cy + Math.sin(a) * 0.36);
      ctx.stroke();
      if (b.cooldown > 0) {
        ctx.fillStyle = STATUS_INFO.wet.color;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a + 0.3) * 0.6, cy + Math.sin(a + 0.3) * 0.6, 0.06, 0, TAU);
        ctx.fill();
      }
    }
    this.drawRabbit(cx, cy + 0.03, 0.13, '#eaf6ff');
  }

  private drawHoneyPot(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#c77d1a';
    ctx.strokeStyle = '#7a4a0c';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.08, 0.38, 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.16, 0.26, 0.1, 0, 0, TAU);
    ctx.fill();
    // A drip that grows and falls.
    const drip = (this.time * 0.6 + b.id * 0.37) % 1;
    ctx.beginPath();
    ctx.ellipse(cx + 0.2, cy - 0.1 + drip * 0.3, 0.05, 0.05 + drip * 0.06, 0, 0, TAU);
    ctx.fill();
    this.drawRabbit(cx - 0.04, cy - 0.2, 0.11, '#fff4d6');
  }

  private drawFlamer(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    this.base(b, '#8c2f1b', '#4f170b');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(b.aim);
    // A chili pepper for a nozzle.
    ctx.fillStyle = '#e03131';
    ctx.beginPath();
    ctx.moveTo(0, -0.12);
    ctx.quadraticCurveTo(0.45, -0.16, 0.6, 0.04);
    ctx.quadraticCurveTo(0.35, 0.12, 0, 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f9e44';
    ctx.fillRect(-0.06, -0.07, 0.1, 0.14);
    ctx.restore();
    this.drawRabbit(cx - Math.cos(b.aim) * 0.14, cy - Math.sin(b.aim) * 0.14 + 0.04, 0.15, '#ffe3d6');
  }

  private drawBeehive(cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#8a5a00';
    ctx.lineWidth = 0.04;
    for (const [dy, w] of [
      [0.24, 0.4],
      [0.06, 0.36],
      [-0.12, 0.28],
      [-0.27, 0.17],
    ]) {
      ctx.fillStyle = dy === 0.06 || dy === -0.27 ? '#f2b21b' : '#ffd43b';
      ctx.beginPath();
      ctx.ellipse(cx, cy + dy, w, 0.12, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#3b2412';
    ctx.beginPath();
    ctx.arc(cx, cy + 0.22, 0.07, 0, TAU);
    ctx.fill();
  }

  private drawThumper(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    const def = BUILDINGS.thumper;
    // The drum skin flexes just after a thump and the rabbit lands on it.
    const sinceThump = def.cooldown! - b.cooldown;
    const flex = b.cooldown > 0 && sinceThump < 0.3 ? 1 - sinceThump / 0.3 : 0;
    const windUp = b.cooldown > 0 && b.cooldown < 0.5 ? 1 - b.cooldown / 0.5 : 0;
    ctx.fillStyle = '#a23e48';
    ctx.strokeStyle = '#5c1f26';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.43, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f3e3c3';
    ctx.beginPath();
    ctx.arc(cx, cy, 0.33 + flex * 0.04, 0, TAU);
    ctx.fill();
    this.drawRabbit(cx, cy + 0.04 - windUp * 0.25, 0.17 + windUp * 0.03, '#f4f1ea');
  }

  private joins(g: Game, b: Building, dx: number, dy: number): boolean {
    const id = g.grid[(b.y + dy) * N + b.x + dx];
    return id !== 0 && g.buildings.get(id)?.kind === b.kind;
  }

  private drawFence(g: Game, b: Building): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#f1e9d8';
    ctx.strokeStyle = '#9c8f76';
    ctx.lineWidth = 0.04;
    // Rails run toward neighbouring fence tiles.
    if (this.joins(g, b, 1, 0)) ctx.fillRect(b.x + 0.5, b.y + 0.42, 1, 0.16);
    if (this.joins(g, b, 0, 1)) ctx.fillRect(b.x + 0.42, b.y + 0.5, 0.16, 1);
    for (const [px, py] of [
      [0.3, 0.3],
      [0.7, 0.3],
      [0.3, 0.7],
      [0.7, 0.7],
    ]) {
      ctx.beginPath();
      ctx.moveTo(b.x + px, b.y + py - 0.2);
      ctx.lineTo(b.x + px + 0.13, b.y + py - 0.05);
      ctx.lineTo(b.x + px + 0.13, b.y + py + 0.17);
      ctx.lineTo(b.x + px - 0.13, b.y + py + 0.17);
      ctx.lineTo(b.x + px - 0.13, b.y + py - 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawPatch(b: Building): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#7a4f2a';
    roundRect(ctx, b.x + 0.06, b.y + 0.06, 0.88, 0.88, 0.12);
    ctx.fill();
    ctx.strokeStyle = '#5e3a1c';
    ctx.lineWidth = 0.04;
    for (const y of [0.36, 0.64]) {
      ctx.beginPath();
      ctx.moveTo(b.x + 0.14, b.y + y + 0.14);
      ctx.lineTo(b.x + 0.86, b.y + y + 0.14);
      ctx.stroke();
    }
    for (const y of [0.3, 0.58]) {
      for (const x of [0.26, 0.5, 0.74]) {
        const sway = b.staffed ? Math.sin(this.time * 2 + x * 9 + y * 5) * 0.03 : 0;
        ctx.fillStyle = '#ff8c1a';
        ctx.beginPath();
        ctx.arc(b.x + x, b.y + y + 0.1, 0.07, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = b.staffed ? '#4caf50' : '#8a9a6a';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(b.x + x, b.y + y + 0.06);
        ctx.lineTo(b.x + x + sway, b.y + y - 0.1);
        ctx.stroke();
      }
    }
  }

  private drawHutch(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#c98f55';
    ctx.strokeStyle = '#6e4420';
    ctx.lineWidth = 0.05;
    roundRect(ctx, b.x + 0.14, b.y + 0.4, 0.72, 0.5, 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b5432e';
    ctx.beginPath();
    ctx.moveTo(b.x + 0.04, b.y + 0.46);
    ctx.lineTo(cx, b.y + 0.06);
    ctx.lineTo(b.x + 0.96, b.y + 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2412';
    ctx.beginPath();
    ctx.arc(cx, cy + 0.26, 0.15, Math.PI, 0);
    ctx.lineTo(cx + 0.15, cy + 0.4);
    ctx.lineTo(cx - 0.15, cy + 0.4);
    ctx.closePath();
    ctx.fill();
    // Somebody is always peeking out.
    this.drawRabbit(cx, cy + 0.3, 0.1, '#f4f1ea');
  }

  private drawWheel(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#44505e';
    roundRect(ctx, b.x + 0.1, b.y + 0.78, 0.8, 0.14, 0.05);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy - 0.04, 0.36, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 0.035;
    const spin = b.staffed ? this.time * 6 : 0.4;
    for (let i = 0; i < 4; i++) {
      const a = spin + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 0.36, cy - 0.04 + Math.sin(a) * 0.36);
      ctx.lineTo(cx - Math.cos(a) * 0.36, cy - 0.04 - Math.sin(a) * 0.36);
      ctx.stroke();
    }
    if (b.staffed) {
      const bounce = Math.abs(Math.sin(this.time * 12)) * 0.04;
      this.drawRabbit(cx, cy + 0.1 - bounce, 0.14, '#f4f1ea');
    }
  }

  /** A sleepy marker over buildings that have no bunny to run them. */
  private drawUnstaffed(cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(20, 20, 30, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, 0.46, 0, TAU);
    ctx.fill();
    ctx.font = 'bold 0.42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Zz', cx, cy + 0.14 + Math.sin(this.time * 2) * 0.04);
  }

  private drawGoldenCarrot(cx: number, cy: number): void {
    const ctx = this.ctx;
    const glow = ctx.createRadialGradient(cx, cy, 0.2, cx, cy, 2.1);
    glow.addColorStop(0, 'rgba(255, 226, 110, 0.75)');
    glow.addColorStop(1, 'rgba(255, 226, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 2.2, cy - 2.2, 4.4, 4.4);

    const bob = Math.sin(this.time * 2) * 0.04;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.fillStyle = '#3f9b3a';
    for (const a of [-0.5, 0, 0.5]) {
      ctx.save();
      ctx.translate(0, -0.55);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -0.35, 0.14, 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffb91f';
    ctx.strokeStyle = '#b36b00';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(-0.6, -0.5);
    ctx.quadraticCurveTo(0, -0.85, 0.6, -0.5);
    ctx.quadraticCurveTo(0.35, 0.5, 0, 0.95);
    ctx.quadraticCurveTo(-0.35, 0.5, -0.6, -0.5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(179, 107, 0, 0.6)';
    ctx.lineWidth = 0.05;
    for (const [x, y, w] of [
      [-0.3, -0.3, 0.3],
      [0.05, -0.05, 0.3],
      [-0.2, 0.25, 0.2],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + 0.04);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHedge(g: Game, b: Building): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#2f7d32';
    roundRect(ctx, b.x + 0.08, b.y + 0.08, 0.84, 0.84, 0.28);
    ctx.fill();
    // Bridge the gap to neighbouring hedges so a row reads as one wall.
    if (this.joins(g, b, 1, 0)) ctx.fillRect(b.x + 0.6, b.y + 0.14, 0.8, 0.72);
    if (this.joins(g, b, 0, 1)) ctx.fillRect(b.x + 0.14, b.y + 0.6, 0.72, 0.8);
    ctx.fillStyle = '#4caf50';
    for (const [x, y] of [
      [0.32, 0.34],
      [0.64, 0.42],
      [0.42, 0.68],
    ]) {
      ctx.beginPath();
      ctx.arc(b.x + x, b.y + y, 0.1, 0, TAU);
      ctx.fill();
    }
  }

  private drawLauncher(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#9b6b3d';
    ctx.strokeStyle = '#5e3d1f';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, 0.42, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Carrot barrel, kicking back just after a shot.
    const recoil = Math.max(0, b.cooldown - (BUILDINGS.launcher.cooldown! - 0.12)) * 1.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(b.aim);
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.moveTo(0.05 - recoil, -0.13);
    ctx.lineTo(0.62 - recoil, 0);
    ctx.lineTo(0.05 - recoil, 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this.drawRabbit(cx, cy + 0.04, 0.2, '#f4f1ea');
  }

  private drawTesla(b: Building, cx: number, cy: number, brownout: boolean): void {
    const ctx = this.ctx;
    const firing = b.cooldown > BUILDINGS.tesla.cooldown! * (brownout ? 2 : 1) - 0.2;
    ctx.fillStyle = '#5b6470';
    ctx.strokeStyle = '#333a44';
    ctx.lineWidth = 0.06;
    roundRect(ctx, b.x + 0.08, b.y + 0.08, 0.84, 0.84, 0.16);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#d98a3a';
    ctx.lineWidth = 0.07;
    for (const r of [0.34, 0.26]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
    }
    if (firing) {
      const glow = ctx.createRadialGradient(cx, cy, 0.1, cx, cy, 0.9);
      glow.addColorStop(0, 'rgba(160, 230, 255, 0.9)');
      glow.addColorStop(1, 'rgba(160, 230, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 0.9, cy - 0.9, 1.8, 1.8);
    }
    // The rabbit wears the coil's dome as a helmet.
    this.drawRabbit(cx, cy + 0.03, 0.19, firing ? '#e8fbff' : brownout ? '#b8a78a' : '#b9e6f5');
  }

  private drawRabbit(x: number, y: number, r: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 0.035;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(x + s * r * 0.5, y - r * 0.9);
      ctx.rotate(s * 0.22);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.7, r * 0.3, r * 0.9, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f7a8b8';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.65, r * 0.13, r * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#222';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * r * 0.4, y - r * 0.1, r * 0.14, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f08aa0';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.3, r * 0.12, 0, TAU);
    ctx.fill();
  }

  // ------------------------------------------------------------- enemies

  private drawEnemy(e: Enemy, alpha: number): void {
    const ctx = this.ctx;
    const x = e.px + (e.x - e.px) * alpha;
    const y = e.py + (e.y - e.py) * alpha;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 0.3, 0.28, 0.1, 0, 0, TAU);
    ctx.fill();
    if (e.status) {
      // A coloured halo at its feet shows the status it carries.
      ctx.strokeStyle = STATUS_INFO[e.status].color;
      ctx.lineWidth = 0.09;
      ctx.beginPath();
      ctx.ellipse(x, y + 0.3, 0.36, 0.15, 0, 0, TAU);
      ctx.stroke();
    }
    if (e.vulnerable > 0) {
      ctx.strokeStyle = COMBOS.caramelized.color;
      ctx.lineWidth = 0.05;
      ctx.setLineDash([0.1, 0.08]);
      ctx.beginPath();
      ctx.arc(x, y, 0.45, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.stun > 0) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        const a = this.time * 6 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 0.22, y - 0.6 + Math.sin(a) * 0.07, 0.05, 0, TAU);
        ctx.fill();
      }
    }

    if (e.kind === 'gnome') {
      const hop = Math.abs(Math.sin(this.time * 9 + e.id)) * 0.08;
      const gy = y - hop;
      ctx.fillStyle = '#3d6fd6';
      ctx.beginPath();
      ctx.arc(x, gy + 0.14, 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, gy + 0.02, 0.17, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f6c9a0';
      ctx.beginPath();
      ctx.arc(x, gy - 0.08, 0.14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d62828';
      ctx.beginPath();
      ctx.moveTo(x - 0.19, gy - 0.14);
      ctx.lineTo(x + 0.03, gy - 0.62);
      ctx.lineTo(x + 0.19, gy - 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#222';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + s * 0.06, gy - 0.08, 0.025, 0, TAU);
        ctx.fill();
      }
      return;
    }

    // Robo-Mower
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.facing);
    ctx.fillStyle = '#222';
    for (const [wx, wy] of [
      [-0.24, -0.3],
      [0.2, -0.3],
      [-0.24, 0.3],
      [0.2, 0.3],
    ]) {
      roundRect(ctx, wx - 0.1, wy - 0.07, 0.2, 0.14, 0.05);
      ctx.fill();
    }
    ctx.fillStyle = '#e03131';
    ctx.strokeStyle = '#7d1414';
    ctx.lineWidth = 0.05;
    roundRect(ctx, -0.38, -0.27, 0.76, 0.54, 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9ced6';
    ctx.beginPath();
    ctx.arc(0.02, 0, 0.16, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.05;
    const spin = this.time * 25 + e.id;
    ctx.beginPath();
    ctx.moveTo(0.02 + Math.cos(spin) * 0.13, Math.sin(spin) * 0.13);
    ctx.lineTo(0.02 - Math.cos(spin) * 0.13, -Math.sin(spin) * 0.13);
    ctx.stroke();
    // Angry headlights
    ctx.fillStyle = '#ffe066';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(0.33, s * 0.15, 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------- overlay

  private drawHealth(x: number, y: number, w: number, frac: number): void {
    if (frac >= 1 || frac <= 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x - w / 2, y, w, 0.1);
    ctx.fillStyle = frac > 0.5 ? '#6ee06e' : frac > 0.25 ? '#ffd43b' : '#ff5252';
    ctx.fillRect(x - w / 2, y, w * frac, 0.1);
  }

  private drawFx(dt: number): void {
    const ctx = this.ctx;
    let kept = 0;
    for (const f of this.fx) {
      f.age += dt;
      if (f.age >= f.life) continue;
      this.fx[kept++] = f;
      const t = f.age / f.life;
      if (f.type === 'zap') {
        ctx.globalAlpha = 1 - t;
        for (const [color, width] of [
          ['#6fd3ff', 0.2],
          ['#ffffff', 0.07],
        ] as const) {
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(f.points[0][0], f.points[0][1]);
          for (let i = 1; i < f.points.length; i++) {
            const [ax, ay] = f.points[i - 1];
            const [bx, by] = f.points[i];
            for (let s = 1; s <= 4; s++) {
              const k = s / 4;
              const jitter = s < 4 ? 0.22 : 0;
              ctx.lineTo(
                ax + (bx - ax) * k + (Math.random() - 0.5) * jitter,
                ay + (by - ay) * k + (Math.random() - 0.5) * jitter,
              );
            }
          }
          ctx.stroke();
        }
      } else if (f.type === 'ring') {
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.25 + 0.75 * t), 0, TAU);
        ctx.stroke();
      } else if (f.type === 'flame') {
        ctx.globalAlpha = (1 - t) * 0.75;
        const reach = f.range * (0.5 + 0.5 * t);
        for (const [color, k] of [
          ['#ff922b', 1],
          ['#ffe066', 0.6],
        ] as const) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.arc(f.x, f.y, reach * k, f.angle - f.spread * k, f.angle + f.spread * k);
          ctx.closePath();
          ctx.fill();
        }
      } else if (f.type === 'puff') {
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * (0.4 + 0.6 * t), 0, TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = 1 - t * t;
        ctx.font = 'bold 0.5px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 0.09;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.strokeText(f.text, f.x, f.y - 0.4 - t * 0.8);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - 0.4 - t * 0.8);
      }
      ctx.globalAlpha = 1;
    }
    this.fx.length = kept;
  }

  private drawHover(g: Game, view: ViewState): void {
    const { hover, tool } = view;
    if (!hover || !tool || (g.phase !== 'day' && g.phase !== 'night')) return;
    const ctx = this.ctx;
    if (tool === 'sell') {
      const id = g.grid[hover.y * N + hover.x];
      const b = id ? g.buildings.get(id) : undefined;
      if (!b || b.kind === 'carrot') return;
      ctx.strokeStyle = '#ff5252';
      ctx.lineWidth = 0.1;
      ctx.strokeRect(b.x + 0.05, b.y + 0.05, b.size - 0.1, b.size - 0.1);
      return;
    }
    const def = BUILDINGS[tool];
    ctx.fillStyle = view.valid ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 60, 60, 0.45)';
    ctx.fillRect(hover.x, hover.y, def.size, def.size);
    if (def.range !== undefined) {
      ctx.strokeStyle = view.valid ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 60, 60, 0.7)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.arc(hover.x + def.size / 2, hover.y + def.size / 2, def.range, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (def.minRange) {
        // The dead zone a mortar cannot reach.
        ctx.setLineDash([0.2, 0.15]);
        ctx.beginPath();
        ctx.arc(hover.x + def.size / 2, hover.y + def.size / 2, def.minRange, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  /** Paints one building, as it looks when idle, to fill a small canvas. */
  drawIcon(kind: BuildingKind, icon: HTMLCanvasElement): void {
    const game = ICON_GAME;
    const b: Building = {
      id: 1,
      kind,
      x: 0,
      y: 0,
      size: 1,
      hp: 1,
      maxHp: 1,
      cooldown: 0,
      aim: -Math.PI / 4,
      staffed: true,
      targetId: 0,
      soak: false,
      honey: false,
      wired: false,
      row: false,
    };
    const main = this.ctx;
    const ctx = icon.getContext('2d')!;
    this.ctx = ctx;
    ctx.setTransform(icon.width * 0.84, 0, 0, icon.width * 0.84, icon.width * 0.08, icon.width * 0.08);
    ctx.lineJoin = ctx.lineCap = 'round';
    this.drawBuilding(game, b);
    this.ctx = main;
  }
}

/** Just enough of a game for drawBuilding to paint a lone building. */
const ICON_GAME = { grid: new Int32Array(N * N), buildings: new Map(), brownout: false } as unknown as Game;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
