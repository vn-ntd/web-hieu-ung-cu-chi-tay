/**
 * High-performance particle using primitive arithmetic (zero vector object allocation per frame).
 */
export class Particle {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public ax: number;
  public ay: number;

  public maxSpeed: number;
  public maxForce: number;
  public friction: number;
  public size: number;
  public hueOffset: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.ax = 0;
    this.ay = 0;

    this.maxSpeed = 5 + Math.random() * 9;
    this.maxForce = 0.35 + Math.random() * 0.55;
    this.friction = 0.92;
    this.size = 1.3 + Math.random() * 2.2;
    this.hueOffset = Math.random() * 360;
  }

  /**
   * Arrive steering algorithm with pure scalar math (zero allocations)
   */
  public arrive(tx: number, ty: number, slowdownRadius: number = 180, forceMultiplier: number = 1.0) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);

    if (d < 1) {
      this.vx *= 0.88;
      this.vy *= 0.88;
      return;
    }

    let speed = this.maxSpeed;
    if (d < slowdownRadius) {
      speed = (d / slowdownRadius) * this.maxSpeed;
    }

    const invD = 1 / d;
    const desiredX = dx * invD * speed;
    const desiredY = dy * invD * speed;

    let steerX = desiredX - this.vx;
    let steerY = desiredY - this.vy;
    const steerMag = Math.hypot(steerX, steerY);
    const limit = this.maxForce * forceMultiplier;

    if (steerMag > limit) {
      const scale = limit / steerMag;
      steerX *= scale;
      steerY *= scale;
    }

    this.ax += steerX;
    this.ay += steerY;
  }

  public update() {
    this.vx += this.ax;
    this.vy += this.ay;
    this.vx *= this.friction;
    this.vy *= this.friction;

    const vMag = Math.hypot(this.vx, this.vy);
    if (vMag > this.maxSpeed) {
      const scale = this.maxSpeed / vMag;
      this.vx *= scale;
      this.vy *= scale;
    }

    this.x += this.vx;
    this.y += this.vy;
    this.ax = 0;
    this.ay = 0;
  }

  /** Append core arc for batched canvas path */
  public addArcToPath(ctx: CanvasRenderingContext2D) {
    const r = this.size * 0.55;
    ctx.moveTo(this.x + r, this.y);
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
  }

  /** Append glow arc for batched ambient halo */
  public addGlowToPath(ctx: CanvasRenderingContext2D) {
    const r = this.size * 1.55;
    ctx.moveTo(this.x + r, this.y);
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
  }
}
