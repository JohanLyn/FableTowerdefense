import { BUILDINGS, type BuildingKind } from '../data/buildings';
import { BUILD_MARGIN, MAP_SIZE } from '../data/config';
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
  | { type: 'text'; age: number; life: number; x: number; y: number; text: string; color: string };

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

    for (const b of g.buildings.values()) this.drawBuilding(g, b);
    for (const e of g.enemies) this.drawEnemy(e, alpha);

    ctx.fillStyle = '#ff8c1a';
    for (const p of g.projectiles) {
      const x = p.px + (p.x - p.px) * alpha;
      const y = p.py + (p.y - p.py) * alpha;
      ctx.beginPath();
      ctx.arc(x, y, 0.11, 0, TAU);
      ctx.fill();
    }

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
        return this.drawGoldenCarrot(cx, cy);
      case 'hedge':
        return this.drawHedge(g, b);
      case 'launcher':
        return this.drawLauncher(b, cx, cy);
      case 'tesla':
        return this.drawTesla(b, cx, cy);
    }
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
    const joins = (dx: number, dy: number): boolean => {
      const id = g.grid[(b.y + dy) * N + b.x + dx];
      return id !== 0 && g.buildings.get(id)?.kind === 'hedge';
    };
    ctx.fillStyle = '#2f7d32';
    roundRect(ctx, b.x + 0.08, b.y + 0.08, 0.84, 0.84, 0.28);
    ctx.fill();
    // Bridge the gap to neighbouring hedges so a row reads as one wall.
    if (joins(1, 0)) ctx.fillRect(b.x + 0.6, b.y + 0.14, 0.8, 0.72);
    if (joins(0, 1)) ctx.fillRect(b.x + 0.14, b.y + 0.6, 0.72, 0.8);
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

  private drawTesla(b: Building, cx: number, cy: number): void {
    const ctx = this.ctx;
    const firing = b.cooldown > BUILDINGS.tesla.cooldown! - 0.2;
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
    this.drawRabbit(cx, cy + 0.03, 0.19, firing ? '#e8fbff' : '#b9e6f5');
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
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
