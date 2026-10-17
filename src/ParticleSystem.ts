import p5 from 'p5';
import { Particle } from './Particle';
import type { Gesture } from './HandTracker';

interface Vec2 { x: number; y: number; }

// ─── Pixel-font bitmaps (5-wide × 7-tall) ────────────────────────────────────
const FONT: Record<string, [number, number][]> = {
  'I': [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2],[3,2],[4,2],[5,2],[6,0],[6,1],[6,2],[6,3],[6,4]],
  'L': [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
  'O': [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
  'V': [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,1],[4,3],[5,1],[5,3],[6,2]],
  'E': [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
  'Y': [[0,0],[0,4],[1,0],[1,4],[2,1],[2,3],[3,2],[4,2],[5,2],[6,2]],
  'U': [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
};

// Starry-night star color palettes (HSL hue ranges)
const STAR_PALETTES = [
  { h: 200, s: 100, l: 70 }, // Neon Blue
  { h: 140, s: 100, l: 60 }, // Neon Green
  { h: 310, s: 100, l: 70 }, // Pink/Magenta
  { h:  45, s: 100, l: 65 }, // Gold
  { h: 180, s: 100, l: 65 }, // Cyan
  { h: 270, s: 100, l: 72 }, // Violet
];

export class ParticleSystem {
  private particles: Particle[] = [];
  private p: p5;

  // ── Relative offsets (centered at 0,0) — added to palmCenter every frame ──
  private _heartOffsets:      Vec2[];
  private _loveLetterOffsets: Vec2[];

  // ── Starry Night — fixed absolute canvas positions, computed once on first entry ──
  private _starPositions: Vec2[] | null = null;
  private _starHues:      Float32Array | null = null;    // fixed hue per star
  private _starTwinkle:   Float32Array | null = null;    // twinkle phase per star
  private _starTwinkleSpd: Float32Array | null = null;   // twinkle speed per star

  // ── Saturn typed arrays ────────────────────────────────────────────────────
  private _saturnAngle:   Float32Array;
  private _saturnRadius:  Float32Array;
  private _saturnThickY:  Float32Array;  // ring thickness / core Y jitter
  private _saturnIsCore:  Uint8Array;    // 1 = planet sphere, 0 = ring

  // ── Galaxy orbit typed arrays (idle wander) ───────────────────────────────
  private _galaxyAngle:   Float32Array;
  private _galaxyRadius:  Float32Array;
  private _galaxyOffsetY: Float32Array;
  private _galaxyIsCore:  Uint8Array;

  // ── Hand positions (plain objects — no GC churn) ──────────────────────────
  private _canvasCenter: Vec2 = { x: 0, y: 0 };
  private _palmCenter:   Vec2 = { x: 0, y: 0 };

  // ── Rendering state ───────────────────────────────────────────────────────
  private _hueTime = 0;
  // Pre-allocated hue-bucket arrays (36 buckets × 10°) — never reallocated
  private _buckets:    Int32Array[];
  private _bucketLen:  Int32Array;


  constructor(p: p5, count = 2500) {
    this.p = p;

    this._saturnAngle  = new Float32Array(count);
    this._saturnRadius = new Float32Array(count);
    this._saturnThickY = new Float32Array(count);
    this._saturnIsCore = new Uint8Array(count);

    this._galaxyAngle   = new Float32Array(count);
    this._galaxyRadius  = new Float32Array(count);
    this._galaxyOffsetY = new Float32Array(count);
    this._galaxyIsCore  = new Uint8Array(count);

    const NUM_BUCKETS = 36;
    this._buckets   = Array.from({ length: NUM_BUCKETS }, () => new Int32Array(count));
    this._bucketLen = new Int32Array(NUM_BUCKETS);

    this._heartOffsets      = this._genHeartOffsets(count);
    this._loveLetterOffsets = this._genLoveLetterOffsets(count);

    this._initParticles(count);
    this._buildStarPositions(); // build ngay từ đầu để dùng làm idle mặc định
  }

  // ─── Formation offset generators ─────────────────────────────────────────

  /** Heart — parametric, centered at (0,0). Small scale → delicate thin border. */
  private _genHeartOffsets(count: number): Vec2[] {
    const scale = Math.min(this.p.width, this.p.height) * 0.016; // smaller = thinner border
    const offs: Vec2[] = [];
    for (let i = 0; i < count; i++) {
      const t  = (i / count) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
      // 0.6–1.0 radial range → mostly border, slight fill toward center
      const r = 0.6 + Math.random() * 0.4;
      offs.push({ x: hx * scale * r, y: hy * scale * r });
    }
    return offs;
  }

  /** "I LOVE YOU" pixel-font — relative offsets centered at (0,0). */
  private _genLoveLetterOffsets(count: number): Vec2[] {
    const text       = ['I', ' ', 'L', 'O', 'V', 'E', ' ', 'Y', 'O', 'U'];
    const colW       = 5, rowH = 7, gap = 2;
    const totalCols  = text.length * (colW + gap) - gap;
    const scale      = Math.max(10, Math.min(22, (this.p.width * 0.60) / totalCols));
    const totalW     = totalCols * scale;
    const totalH     = rowH * scale;

    const raw: Vec2[] = [];
    text.forEach((ch, ci) => {
      if (ch === ' ') return;
      const ox = ci * (colW + gap) * scale - totalW / 2;
      (FONT[ch] || []).forEach(([row, col]) => {
        raw.push({ x: ox + col * scale, y: row * scale - totalH / 2 });
      });
    });

    if (!raw.length) return Array.from({ length: count }, () => ({ x: 0, y: 0 }));

    const offs: Vec2[] = [];
    for (let i = 0; i < count; i++) {
      const r = raw[i % raw.length];
      offs.push({ x: r.x + (Math.random() - 0.5) * scale * 0.7, y: r.y + (Math.random() - 0.5) * scale * 0.7 });
    }
    return offs;
  }

  /** Starry Night — distribute particles evenly across entire canvas. Called once on mode entry. */
  private _buildStarPositions() {
    const count = this.particles.length;
    const pos   = new Array<Vec2>(count);
    const hues  = new Float32Array(count);
    const twk   = new Float32Array(count);
    const twkSpd = new Float32Array(count);

    // Grid-based distribution so stars fill the entire canvas uniformly
    const cols = Math.ceil(Math.sqrt(count * (this.p.width / this.p.height)));
    const rows = Math.ceil(count / cols);
    const cellW = this.p.width  / cols;
    const cellH = this.p.height / rows;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      pos[i] = {
        x: (col + 0.1 + Math.random() * 0.8) * cellW,
        y: (row + 0.1 + Math.random() * 0.8) * cellH,
      };
      // Assign a random palette color
      const palette = STAR_PALETTES[Math.floor(Math.random() * STAR_PALETTES.length)];
      hues[i]   = palette.h + (Math.random() - 0.5) * 20; // slight variation
      twk[i]    = Math.random() * Math.PI * 2; // random twinkle start phase
      twkSpd[i] = 0.02 + Math.random() * 0.05; // how fast it twinkles
    }

    this._starPositions  = pos;
    this._starHues       = hues;
    this._starTwinkle    = twk;
    this._starTwinkleSpd = twkSpd;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  private _initParticles(count: number) {
    const p = this.p;
    for (let i = 0; i < count; i++) {
      const part = new Particle(p, p.random(p.width), p.random(p.height));
      part.size = p.random(1, 2); // Very small — delicate look
      this.particles.push(part);

      const isSaturnCore = p.random(1) < 0.22;
      this._saturnIsCore[i]  = isSaturnCore ? 1 : 0;
      this._saturnAngle[i]   = p.random(p.TWO_PI);
      const short = Math.min(p.width, p.height);
      if (isSaturnCore) {
        this._saturnRadius[i]  = p.random(short * 0.01, short * 0.07);
        this._saturnThickY[i]  = p.random(-short * 0.04, short * 0.04);
      } else {
        this._saturnRadius[i]  = p.random(short * 0.10, short * 0.26);
        this._saturnThickY[i]  = p.random(-short * 0.016, short * 0.016);
      }

      const core = p.random(1) < 0.15;
      this._galaxyIsCore[i]  = core ? 1 : 0;
      this._galaxyAngle[i]   = p.random(p.TWO_PI);
      this._galaxyRadius[i]  = core ? p.random(0, 35) : p.random(55, 260);
      this._galaxyOffsetY[i] = core ? p.random(-35, 35) : p.random(-14, 14);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public setColorFromHex(_hex: string) {}
  public setPattern(_p: string) {}

  // ─── Main update + render ─────────────────────────────────────────────────

  public update(landmarks: { x: number; y: number; z: number }[] | null, gesture: Gesture) {
    const p     = this.p;
    const count = this.particles.length;

    this._hueTime += 0.35;

    // Update spatial anchors (no allocation)
    this._canvasCenter.x = p.width  * 0.5;
    this._canvasCenter.y = p.height * 0.5;

    let hasHand = false;
    let mode    = gesture;

    if (landmarks && landmarks.length >= 21) {
      hasHand = true;
      const rawPalm = landmarks[9]; // Middle-finger MCP ≈ palm center
      this._palmCenter.x = (1 - rawPalm.x) * p.width;
      this._palmCenter.y = rawPalm.y        * p.height;
    }

    // No hand → mặc định StarryNight (màn hình sao)
    if (!hasHand || mode === 'None') mode = 'StarryNight';

    const baseX = hasHand ? this._palmCenter.x : this._canvasCenter.x;
    const baseY = hasHand ? this._palmCenter.y : this._canvasCenter.y;

    // Rebuild star positions nếu cần (chỉ khi chưa có)
    if (mode === 'StarryNight' && !this._starPositions) {
      this._buildStarPositions();
    }

    // ── Physics pass ─────────────────────────────────────────────────────────
    for (let i = 0; i < count; i++) {
      const par = this.particles[i];

      if (mode === 'Saturn') {
        // Mode 1: Saturn formation — planet sphere + tilted rotating ring, anchored to palm
        if (this._saturnIsCore[i]) {
          par.arrive(baseX + this._saturnRadius[i] * Math.cos(this._saturnAngle[i]) * 0.5,
                     baseY + this._saturnThickY[i], 25, 5.5);
        } else {
          this._saturnAngle[i] += 0.006 + par.maxSpeed * 0.0007;
          const angle = this._saturnAngle[i];
          const r     = this._saturnRadius[i];
          const thick = this._saturnThickY[i];
          const rx = r * Math.cos(angle);
          const ry = r * Math.sin(angle) * 0.28 + thick;
          par.arrive(baseX + rx, baseY + ry * 0.978 + rx * 0.208, 22, 5.0);
        }

      } else if (mode === 'LoveLetter') {
        par.arrive(baseX + this._loveLetterOffsets[i].x, baseY + this._loveLetterOffsets[i].y, 30, 5.0);

      } else if (mode === 'StarryNight' && this._starPositions) {
        par.arrive(this._starPositions[i].x, this._starPositions[i].y, 60, 4.5);

      } else if (mode === 'Heart') {
        par.arrive(baseX + this._heartOffsets[i].x, baseY + this._heartOffsets[i].y, 28, 5.5);

      } else {
        // Wander — idle galaxy orbit when no hand detected
        this._galaxyAngle[i] += 0.007 + par.maxSpeed * 0.001;
        const ang = this._galaxyAngle[i];
        const rad = this._galaxyRadius[i];
        const oy  = this._galaxyOffsetY[i];
        const tx  = this._canvasCenter.x + (this._galaxyIsCore[i]
          ? Math.cos(ang) * rad
          : Math.cos(ang) * rad);
        const ty  = this._canvasCenter.y + (this._galaxyIsCore[i]
          ? oy
          : Math.sin(ang) * (rad * 0.3) * 0.924 + oy + Math.cos(ang) * rad * 0.044);
        par.arrive(tx, ty, 100);
      }

      par.update();
    }

    this._render(mode);
  }

  // ─── Batched render ───────────────────────────────────────────────────────

  private _render(mode: Gesture) {
    const ctx   = this.p.drawingContext as CanvasRenderingContext2D;
    const count = this.particles.length;
    const ht    = this._hueTime;

    ctx.globalCompositeOperation = 'screen';
    ctx.shadowBlur = 0;

    // ── Starry Night — special render: tiny points with twinkle alpha ──────
    if (mode === 'StarryNight' && this._starPositions && this._starHues && this._starTwinkle && this._starTwinkleSpd) {
      // Advance twinkle phase
      for (let i = 0; i < count; i++) this._starTwinkle[i] += this._starTwinkleSpd[i];

      // Glow halo pass
      ctx.fillStyle = 'rgba(100,180,255,0.018)';
      ctx.beginPath();
      for (let i = 0; i < count; i++) this.particles[i].addGlowToPath(ctx);
      ctx.fill();

      // Stars: per-particle color + twinkle alpha
      // Group into color-palette buckets (6 palettes → 6 fill calls)
      const palBuckets: number[][] = [[], [], [], [], [], []];
      for (let i = 0; i < count; i++) {
        palBuckets[i % STAR_PALETTES.length].push(i);
      }
      for (let b = 0; b < STAR_PALETTES.length; b++) {
        const pal = STAR_PALETTES[b];
        for (const i of palBuckets[b]) {
          const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this._starTwinkle![i]));
          ctx.fillStyle = `hsla(${pal.h | 0},${pal.s}%,${pal.l}%,${alpha.toFixed(2)})`;
          ctx.beginPath();
          this.particles[i].addArcToPath(ctx);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      return;
    }

    // ── All other modes: hue-bucket rainbow / mode-specific colors ──────────
    // Pass 1: Glow halo — single batch
    ctx.fillStyle = `hsla(${(ht * 0.4) % 360},100%,60%,0.03)`;
    ctx.beginPath();
    for (let i = 0; i < count; i++) this.particles[i].addGlowToPath(ctx);
    ctx.fill();

    // Pass 2: 36 hue buckets (10° each) → 36 fillStyle calls max
    const NB = 36, BD = 10;
    for (let b = 0; b < NB; b++) this._bucketLen[b] = 0;

    for (let i = 0; i < count; i++) {
      const hue    = (ht + this.particles[i].hueOffset) % 360;
      const bucket = Math.floor(hue / BD) % NB;
      this._buckets[bucket][this._bucketLen[bucket]++] = i;
    }

    let l = 62, a = 0.88;
    if (mode === 'Heart')      { l = 70; a = 0.94; }
    if (mode === 'LoveLetter') { l = 72; a = 0.92; }
    if (mode === 'Saturn')     { l = 65; a = 0.90; }

    for (let b = 0; b < NB; b++) {
      if (!this._bucketLen[b]) continue;
      const hue = b * BD + BD * 0.5;
      ctx.fillStyle = `hsla(${hue | 0},100%,${l}%,${a})`;
      ctx.beginPath();
      for (let j = 0; j < this._bucketLen[b]; j++) {
        this.particles[this._buckets[b][j]].addArcToPath(ctx);
      }
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}
