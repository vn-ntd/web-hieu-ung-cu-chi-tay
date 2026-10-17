import { ParticleSystem } from './ParticleSystem';
import { HandTracker, type Gesture } from './HandTracker';
import { UIManager } from './UIManager';

class App {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particleSystem: ParticleSystem;
  private handTracker: HandTracker;
  private uiManager: UIManager;

  // Mouse / Touch fallback support
  private pointer: { x: number; y: number } | null = null;
  private isPointerDown = false;
  private manualGesture: Gesture | null = null;
  private manualGestureTimeout: number | null = null;

  constructor() {
    const container = document.getElementById('canvas-container');
    if (!container) throw new Error('Canvas container not found');

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    container.appendChild(this.canvas);

    this._handleResize();
    window.addEventListener('resize', () => this._handleResize());

    // Initialize systems
    this.particleSystem = new ParticleSystem(this.ctx, this.canvas.width, this.canvas.height, 2600);
    this.uiManager = new UIManager();
    this.handTracker = new HandTracker('webcam');

    this._setupTrackerCallbacks();
    this._setupPointerInteractions();
    this._setupManualOverrides();

    // Start native high-performance render loop
    requestAnimationFrame((t) => this._loop(t));
  }

  private _handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.particleSystem) {
      this.particleSystem.resize(this.canvas.width, this.canvas.height);
    }
  }

  private _setupTrackerCallbacks() {
    this.handTracker.onReady = () => {
      this.uiManager.updateCameraStatus('ready');
    };

    this.handTracker.onError = (msg) => {
      this.uiManager.updateCameraStatus('error', msg);
    };

    this.handTracker.onGestureChange = (gesture) => {
      // If user hasn't locked a manual gesture recently, apply AI gesture
      if (!this.manualGesture) {
        this.uiManager.updateGestureStatus(gesture);
      }
    };
  }

  private _setupPointerInteractions() {
    const onMove = (clientX: number, clientY: number) => {
      this.pointer = { x: clientX, y: clientY };
    };

    window.addEventListener('mousemove', (e) => {
      onMove(e.clientX, e.clientY);
    });

    window.addEventListener('mousedown', () => {
      this.isPointerDown = true;
    });

    window.addEventListener('mouseup', () => {
      this.isPointerDown = false;
    });

    // Touch support for mobile devices
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        this.isPointerDown = true;
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isPointerDown = false;
    });
  }

  private _setupManualOverrides() {
    this.uiManager.onManualGestureSelect = (gesture: Gesture) => {
      this.manualGesture = gesture;
      if (this.manualGestureTimeout) window.clearTimeout(this.manualGestureTimeout);
      // Reset manual lock after 12 seconds of inactivity so camera AI resumes
      this.manualGestureTimeout = window.setTimeout(() => {
        this.manualGesture = null;
      }, 12000);
    };
  }

  private _loop(_time: number) {
    // 1. Motion blur fade pass (pure 2D context)
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Predict camera landmarks
    this.handTracker.predict();

    // 3. Determine active gesture
    const activeGesture = this.manualGesture ?? this.handTracker.currentGesture;

    // 4. Update & render particle simulation
    this.particleSystem.update(
      this.handTracker.smoothLandmarks,
      activeGesture,
      this.isPointerDown || !this.handTracker.smoothLandmarks ? this.pointer : null
    );

    requestAnimationFrame((t) => this._loop(t));
  }
}

// Bootstrap application on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
