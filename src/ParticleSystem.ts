import { Particle } from './Particle';
import type { Gesture } from './HandTracker';

interface Vec2 {
  x: number;
  y: number;
}

// ─── Pixel-font bitmaps for "I LOVE YOU" (5-wide × 7-tall) ───────────────────
const FONT: Record<string, [number, number][]> = {
  'I': [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2],[3,2],[4,2],[5,2],[6,0],[6,1],[6,2],[6,3],[6,4]],
  'L': [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
  'O': [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
  'V': [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,1],[4,3],[5,1],[5,3],[6,2]],
  'E': [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
  'Y': [[0,0],[0,4],[1,0],[1,4],[2,1],[2,3],[3,2],[4,2],[5,2],[6,2]],
  'U': [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
};

// Neon color palettes for Starry Night
const STAR_PALETTES = [
  { h: 200, s: 100, l: 70 }, // Neon Cyan / Blue
  { h: 140, s: 100, l: 60 }, // Emerald
  { h: 320, s: 100, l: 72 }, // Hot Pink
  { h:  45, s: 100, l: 65 }, // Gold Amber
  { h: 180, s: 100, l: 65 }, // Electric Turquoise
  { h: 275, s: 100, l: 75 }, // Violet Glow
];

export class ParticleSystem {
  public particles: Particle[] = [];
  public count: number;
  private width: number;
  private height: number;
  private ctx: CanvasRenderingContext2D;

  // Offsets for Heart and Love Letter formations
  private _heartOffsets: Vec2[] = [];
  private _loveLetterOffsets: Vec2[] = [];

  // Starry Night distribution arrays
  private _starPositions: Vec2[] | null = null;
  private _starPalettes: Uint8Array | null = null;
  private _starTwinkle: Float32Array | null = null;
  private _starTwinkleSpd: Float32Array | null = null;

  // Saturn parameters
  private _saturnAngle: Float32Array;
  private _saturnRadius: Float32Array;
  private _saturnThickY: Float32Array;
  private _saturnIsCore: Uint8Array;

  // Galaxy idle wander parameters
  private _galaxyAngle: Float32Array;
  private _galaxyRadius: Float32Array;
  private _galaxyOffsetY: Float32Array;
  private _galaxyIsCore: Uint8Array;

  // Spatial reference anchors
  private _canvasCenter: Vec2 = { x: 0, y: 0 };
  private _palmCenter: Vec2 = { x: 0, y: 0 };

  // Hue bucket renderer (36 bins × 10° each)
  private _hueTime = 0;
  private _heartBeatTime = 0;
  private _buckets: Int32Array[];
  private _bucketLen: Int32Array;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number, count = 2500) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.count = count;

    this._canvasCenter.x = width * 0.5;
    this._canvasCenter.y = height * 0.5;
    this._palmCenter.x = this._canvasCenter.x;
    this._palmCenter.y = this._canvasCenter.y;

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

    this._initParticles(count);
    this.resize(width, height, true);
  }

  public resize(width: number, height: number, reinitStars = true) {
    this.width = width;
    this.height = height;
    this._canvasCenter.x = width * 0.5;
    this._canvasCenter.y = height * 0.5;

    this._heartOffsets = this._genHeartOffsets(this.count);
    this._loveLetterOffsets = this._genLoveLetterOffsets(this.count);

    if (reinitStars || !this._starPositions) {
      this._buildStarPositions();
    }
  }

  private _genHeartOffsets(count: number): Vec2[] {
    const scale = Math.min(this.width, this.height) * 0.0165;
    const offs: Vec2[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      const r = 0.55 + Math.random() * 0.45;
      offs.push({ x: hx * scale * r, y: hy * scale * r });
    }
    return offs;
  }

  private _genLoveLetterOffsets(count: number): Vec2[] {
    const text = ['I', ' ', 'L', 'O', 'V', 'E', ' ', 'Y', 'O', 'U'];
    const colW = 5, rowH = 7, gap = 2;
    const totalCols = text.length * (colW + gap) - gap;
    const scale = Math.max(9, Math.min(24, (this.width * 0.72) / totalCols));
    const totalW = totalCols * scale;
    const totalH = rowH * scale;

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
      offs.push({
        x: r.x + (Math.random() - 0.5) * scale * 0.75,
        y: r.y + (Math.random() - 0.5) * scale * 0.75,
      });
    }
    return offs;
  }

  private _buildStarPositions() {
    const count = this.count;
    const pos = new Array<Vec2>(count);
    const pal = new Uint8Array(count);
    const twk = new Float32Array(count);
    const twkSpd = new Float32Array(count);

    const cols = Math.max(1, Math.ceil(Math.sqrt(count * (this.width / Math.max(1, this.height)))));
    const rows = Math.max(1, Math.ceil(count / cols));
    const cellW = this.width / cols;
    const cellH = this.height / rows;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      pos[i] = {
        x: (col + 0.1 + Math.random() * 0.8) * cellW,
        y: (row + 0.1 + Math.random() * 0.8) * cellH,
      };
      pal[i] = Math.floor(Math.random() * STAR_PALETTES.length);
      twk[i] = Math.random() * Math.PI * 2;
      twkSpd[i] = 0.02 + Math.random() * 0.05;
    }

    this._starPositions = pos;
    this._starPalettes = pal;
    this._starTwinkle = twk;
    this._starTwinkleSpd = twkSpd;
  }

  private _initParticles(count: number) {
    const shortSide = Math.min(this.width, this.height);
    this.particles = [];

    for (let i = 0; i < count; i++) {
      const part = new Particle(Math.random() * this.width, Math.random() * this.height);
      this.particles.push(part);

      const isSaturnCore = Math.random() < 0.22;
      this._saturnIsCore[i] = isSaturnCore ? 1 : 0;
      this._saturnAngle[i] = Math.random() * Math.PI * 2;

      if (isSaturnCore) {
        this._saturnRadius[i] = Math.random() * shortSide * 0.07;
        this._saturnThickY[i] = (Math.random() - 0.5) * shortSide * 0.08;
      } else {
        this._saturnRadius[i] = shortSide * (0.12 + Math.random() * 0.18);
        this._saturnThickY[i] = (Math.random() - 0.5) * shortSide * 0.035;
      }

      const core = Math.random() < 0.15;
      this._galaxyIsCore[i] = core ? 1 : 0;
      this._galaxyAngle[i] = Math.random() * Math.PI * 2;
      this._galaxyRadius[i] = core ? Math.random() * 40 : 60 + Math.random() * 240;
      this._galaxyOffsetY[i] = core ? (Math.random() - 0.5) * 60 : (Math.random() - 0.5) * 30;
    }
  }

  public update(
    landmarks: { x: number; y: number; z: number }[] | null,
    gesture: Gesture,
    pointerFallback?: { x: number; y: number } | null
  ) {
    const count = this.count;
    this._hueTime += 0.4;
    this._heartBeatTime += 0.04;

    let hasHand = false;
    let mode = gesture;

    if (landmarks && landmarks.length >= 21) {
      hasHand = true;
      const rawPalm = landmarks[9]; // Middle MCP is reliable palm anchor
      if (rawPalm && !isNaN(rawPalm.x) && !isNaN(rawPalm.y)) {
        this._palmCenter.x = (1 - rawPalm.x) * this.width;
        this._palmCenter.y = rawPalm.y * this.height;
      }
    } else if (pointerFallback && !isNaN(pointerFallback.x) && !isNaN(pointerFallback.y)) {
      hasHand = true;
      this._palmCenter.x = pointerFallback.x;
      this._palmCenter.y = pointerFallback.y;
    }

    if (mode === 'None') {
      mode = hasHand ? 'Saturn' : 'StarryNight';
    }

    const baseX = hasHand ? this._palmCenter.x : this._canvasCenter.x;
    const baseY = hasHand ? this._palmCenter.y : this._canvasCenter.y;

    // Heart beat rhythmic pulsation
    const heartPulse = mode === 'Heart'
      ? 1 + 0.085 * Math.sin(this._heartBeatTime * 7) + 0.04 * Math.sin(this._heartBeatTime * 14)
      : 1;

    // Physics Update pass (with complete index safety)
    for (let i = 0; i < count; i++) {
      const par = this.particles[i];
      if (!par) continue;

      if (mode === 'Saturn') {
        if (this._saturnIsCore[i]) {
          const coreX = baseX + this._saturnRadius[i] * Math.cos(this._saturnAngle[i]) * 0.55;
          const coreY = baseY + this._saturnThickY[i];
          par.arrive(coreX, coreY, 26, 5.5);
        } else {
          this._saturnAngle[i] += 0.007 + par.maxSpeed * 0.0007;
          const angle = this._saturnAngle[i];
          const r = this._saturnRadius[i];
          const thick = this._saturnThickY[i];
          const rx = r * Math.cos(angle);
          const ry = r * Math.sin(angle) * 0.28 + thick;
          par.arrive(baseX + rx, baseY + ry * 0.98 + rx * 0.21, 24, 5.0);
        }
      } else if (mode === 'LoveLetter') {
        const offset = this._loveLetterOffsets[i] || { x: 0, y: 0 };
        const floatWave = Math.sin(this._heartBeatTime * 4 + i * 0.01) * 3.5;
        par.arrive(baseX + offset.x, baseY + offset.y + floatWave, 32, 5.0);
      } else if (mode === 'Heart') {
        const offset = this._heartOffsets[i] || { x: 0, y: 0 };
        const hx = offset.x * heartPulse;
        const hy = offset.y * heartPulse;
        par.arrive(baseX + hx, baseY + hy, 28, 5.8);
      } else if (mode === 'StarryNight' && this._starPositions && this._starPositions[i]) {
        par.arrive(this._starPositions[i].x, this._starPositions[i].y, 65, 4.5);
      } else {
        // Idle Galaxy wander
        this._galaxyAngle[i] += 0.006 + par.maxSpeed * 0.0008;
        const ang = this._galaxyAngle[i];
        const rad = this._galaxyRadius[i];
        const oy = this._galaxyOffsetY[i];
        const tx = this._canvasCenter.x + Math.cos(ang) * rad;
        const ty = this._canvasCenter.y + (this._galaxyIsCore[i] ? oy : Math.sin(ang) * (rad * 0.3) + oy);
        par.arrive(tx, ty, 100);
      }

      par.update();
    }

    this._render(mode);
  }

  private _render(mode: Gesture) {
    const ctx = this.ctx;
    const count = this.count;
    const ht = this._hueTime;

    ctx.globalCompositeOperation = 'screen';

    // ── Mode: Starry Night (Batched 24 draw calls instead of 2500) ───────────
    if (mode === 'StarryNight' && this._starPositions && this._starPalettes && this._starTwinkle && this._starTwinkleSpd) {
      for (let i = 0; i < count; i++) {
        this._starTwinkle[i] += this._starTwinkleSpd[i];
      }

      // Outer glow halo
      ctx.fillStyle = 'rgba(70, 160, 255, 0.022)';
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        if (this.particles[i]) this.particles[i].addGlowToPath(ctx);
      }
      ctx.fill();

      // Bucket stars by palette and alpha level
      const NUM_PALS = STAR_PALETTES.length;
      const ALPHA_BINS = 4;
      const starBuckets: number[][] = Array.from({ length: NUM_PALS * ALPHA_BINS }, () => []);

      for (let i = 0; i < count; i++) {
        const palIdx: number = (this._starPalettes[i] || 0) % NUM_PALS;
        const normTwinkle = 0.5 + 0.5 * Math.sin(this._starTwinkle[i]);
        const alphaBin = Math.max(0, Math.min(ALPHA_BINS - 1, Math.floor(normTwinkle * ALPHA_BINS)));
        const targetIndex = palIdx * ALPHA_BINS + alphaBin;
        if (starBuckets[targetIndex]) {
          starBuckets[targetIndex].push(i);
        }
      }

      for (let p = 0; p < NUM_PALS; p++) {
        const pal = STAR_PALETTES[p];
        for (let a = 0; a < ALPHA_BINS; a++) {
          const list = starBuckets[p * ALPHA_BINS + a];
          if (!list || !list.length) continue;
          const alpha = 0.35 + ((a + 0.5) / ALPHA_BINS) * 0.65;
          ctx.fillStyle = `hsla(${pal.h}, ${pal.s}%, ${pal.l}%, ${alpha.toFixed(2)})`;
          ctx.beginPath();
          for (let k = 0; k < list.length; k++) {
            const par = this.particles[list[k]];
            if (par) par.addArcToPath(ctx);
          }
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      return;
    }

    // ── All other modes: Glowing Rainbow / Theme Batched ─────────────────────
    // Pass 1: Soft Ambient Glow
    ctx.fillStyle = `hsla(${(ht * 0.35) % 360}, 100%, 60%, 0.035)`;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      if (this.particles[i]) this.particles[i].addGlowToPath(ctx);
    }
    ctx.fill();

    // Pass 2: 36 Hue buckets
    const NB = 36, BD = 10;
    for (let b = 0; b < NB; b++) this._bucketLen[b] = 0;

    for (let i = 0; i < count; i++) {
      const par = this.particles[i];
      if (!par) continue;
      const hue = Math.abs(ht + par.hueOffset) % 360;
      const bucket = Math.floor(hue / BD) % NB;
      const currentLen = this._bucketLen[bucket];
      if (currentLen < this._buckets[bucket].length) {
        this._buckets[bucket][currentLen] = i;
        this._bucketLen[bucket]++;
      }
    }

    let lightness = 64, alpha = 0.90;
    if (mode === 'Heart')      { lightness = 72; alpha = 0.95; }
    if (mode === 'LoveLetter') { lightness = 74; alpha = 0.94; }
    if (mode === 'Saturn')     { lightness = 68; alpha = 0.92; }

    for (let b = 0; b < NB; b++) {
      const len = this._bucketLen[b];
      if (!len) continue;
      const hue = b * BD + BD * 0.5;
      ctx.fillStyle = `hsla(${hue | 0}, 100%, ${lightness}%, ${alpha})`;
      ctx.beginPath();
      const arr = this._buckets[b];
      for (let j = 0; j < len; j++) {
        const par = this.particles[arr[j]];
        if (par) par.addArcToPath(ctx);
      }
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}
