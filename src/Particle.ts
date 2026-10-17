import p5 from 'p5';

export class Particle {
  public pos: p5.Vector;
  public vel: p5.Vector;
  public acc: p5.Vector;
  public maxSpeed: number;
  public maxForce: number;
  public size: number;
  public friction: number;

  /** Rainbow hue offset per particle (0-360) — used for HSB coloring */
  public hueOffset: number;

  // Pre-allocated scratch vectors — reused every frame to avoid GC pressure
  private _desired: p5.Vector;
  private _steer: p5.Vector;

  private p: p5;

  constructor(p: p5, x: number, y: number) {
    this.p = p;
    this.pos = p.createVector(x, y);
    this.vel = p.createVector(p.random(-1, 1), p.random(-1, 1));
    this.acc = p.createVector(0, 0);

    // Pre-allocate scratch vectors once — reused in arrive/seek/flee
    this._desired = p.createVector(0, 0);
    this._steer   = p.createVector(0, 0);

    this.maxSpeed = p.random(4, 12);
    this.maxForce = p.random(0.3, 0.8);
    this.friction = 0.92;
    this.size = p.random(2.5, 6);
    this.hueOffset = p.random(360);
  }

  public applyForce(force: p5.Vector) {
    this.acc.add(force);
  }

  /** Arrive — uses pre-allocated scratch vectors (zero heap alloc per call) */
  public arrive(tx: number, ty: number, slowdownRadius: number = 200, forceMultiplier: number = 1.0) {
    this._desired.set(tx - this.pos.x, ty - this.pos.y);
    const d = this._desired.mag();
    if (d < 1) { this.vel.mult(0.9); return; }

    let speed = this.maxSpeed;
    if (d < slowdownRadius) {
      speed = this.p.map(d, 0, slowdownRadius, 0, this.maxSpeed);
    }
    this._desired.setMag(speed);

    this._steer.set(this._desired.x - this.vel.x, this._desired.y - this.vel.y);
    const mag = this._steer.mag();
    const limit = this.maxForce * forceMultiplier;
    if (mag > limit) this._steer.mult(limit / mag);

    this.acc.add(this._steer);
  }

  /** Wander — small random nudge applied directly */
  public applyWander(rndX: number, rndY: number) {
    this._steer.set(rndX, rndY);
    this.acc.add(this._steer);
  }

  public update() {
    this.vel.add(this.acc);
    this.vel.mult(this.friction);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.x = 0;
    this.acc.y = 0;
  }

  /** Append a core arc sub-path for batched rendering. Caller handles fillStyle/beginPath. */
  public addArcToPath(ctx: CanvasRenderingContext2D) {
    const r = this.size * 0.5;
    ctx.moveTo(this.pos.x + r, this.pos.y);
    ctx.arc(this.pos.x, this.pos.y, r, 0, Math.PI * 2);
  }

  /** Append a larger glow arc sub-path (outer halo, drawn at lower alpha). */
  public addGlowToPath(ctx: CanvasRenderingContext2D) {
    const r = this.size * 1.4;
    ctx.moveTo(this.pos.x + r, this.pos.y);
    ctx.arc(this.pos.x, this.pos.y, r, 0, Math.PI * 2);
  }
}
