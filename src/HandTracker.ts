import { FilesetResolver, HandLandmarker, type HandLandmarkerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision';

export type Gesture = 'Saturn' | 'LoveLetter' | 'StarryNight' | 'Heart' | 'None';

interface SmoothLandmark { x: number; y: number; z: number; }

export class HandTracker {
  private videoElement: HTMLVideoElement;
  private handLandmarker!: HandLandmarker;
  private isInitializing = true;
  private lastVideoTime  = -1;
  private _detecting     = false;

  public currentGesture:   Gesture = 'None';
  public currentLandmarks: NormalizedLandmark[] | null = null;
  public smoothLandmarks:  SmoothLandmark[] | null = null;
  private _targetLandmarks: SmoothLandmark[] | null = null;

  public onGestureChange?: (gesture: Gesture) => void;
  public onReady?: () => void;

  private readonly LERP_ALPHA = 0.3;

  constructor(videoElementId: string) {
    this.videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
    this._init();
  }

  private async _init() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.videoElement.addEventListener('loadeddata', () => {
        if (this.videoElement.videoWidth > 0) {
          this.isInitializing = false;
          if (this.onReady) this.onReady();
        }
      });
    } catch (err) {
      console.error('HandTracker init error:', err);
      alert('Camera access is required for hand tracking.');
    }
  }

  /** Called every draw() frame — fires async detection + lerps smooth landmarks. */
  public predict() {
    if (this.isInitializing && this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
      this.isInitializing = false;
      if (this.onReady) this.onReady();
    }
    if (this.isInitializing || !this.videoElement.videoWidth) return;
    if (this.videoElement.paused) this.videoElement.play();

    if (!this._detecting && this.lastVideoTime !== this.videoElement.currentTime) {
      this._detecting = true;
      const captureTime = performance.now();
      this.lastVideoTime = this.videoElement.currentTime;

      queueMicrotask(() => {
        try {
          const results = this.handLandmarker.detectForVideo(this.videoElement, captureTime);
          this._processResults(results);
        } finally {
          this._detecting = false;
        }
      });
    }

    this._lerpSmooth();
  }

  private _lerpSmooth() {
    if (!this._targetLandmarks) { this.smoothLandmarks = null; return; }
    const target = this._targetLandmarks;
    const alpha  = this.LERP_ALPHA;

    if (!this.smoothLandmarks || this.smoothLandmarks.length !== target.length) {
      this.smoothLandmarks = target.map(l => ({ x: l.x, y: l.y, z: l.z }));
      return;
    }
    const smooth = this.smoothLandmarks;
    for (let i = 0; i < target.length; i++) {
      smooth[i].x += (target[i].x - smooth[i].x) * alpha;
      smooth[i].y += (target[i].y - smooth[i].y) * alpha;
      smooth[i].z += (target[i].z - smooth[i].z) * alpha;
    }
  }

  private _processResults(results: HandLandmarkerResult) {
    if (results.landmarks && results.landmarks.length > 0) {
      const lm = results.landmarks[0];
      this.currentLandmarks = lm;
      this._targetLandmarks = lm.map(l => ({ x: l.x, y: l.y, z: l.z }));

      const next = this._classifyGesture(lm);
      if (next !== this.currentGesture) {
        this.currentGesture = next;
        if (this.onGestureChange) this.onGestureChange(next);
      }
    } else {
      this.currentLandmarks = null;
      this._targetLandmarks = null;
      if (this.currentGesture !== 'None') {
        this.currentGesture = 'None';
        if (this.onGestureChange) this.onGestureChange('None');
      }
    }
  }

  /**
   * Gesture classification via squared-distance finger extension.
   * Tip farther from wrist than its PIP → finger is "up".
   *
   *  Landmark pairs → Index:8/6 · Middle:12/10 · Ring:16/14 · Pinky:20/18
   *
   * Priority order:
   *  ≥ 4 extended    → Magnet      (open palm — attract to index tip)
   *  Index+Mid+Ring  → StarryNight (exactly 3 specific fingers)
   *  Index+Mid only  → LoveLetter  (peace/V sign)
   *  ≤ 1 extended    → Heart       (fist)
   *  Else            → Magnet      (partial open — treat as attraction)
   */
  private _classifyGesture(lm: NormalizedLandmark[]): Gesture {
    const w = lm[0]; // wrist

    const d2 = (a: NormalizedLandmark, b: NormalizedLandmark) => {
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      return dx * dx + dy * dy + dz * dz;
    };

    const indexUp  = d2(w, lm[8])  > d2(w, lm[6]);
    const middleUp = d2(w, lm[12]) > d2(w, lm[10]);
    const ringUp   = d2(w, lm[16]) > d2(w, lm[14]);
    const pinkyUp  = d2(w, lm[20]) > d2(w, lm[18]);

    const ext = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

    if (ext >= 4)                               return 'Saturn';      // 🖐 Open palm
    if (indexUp && middleUp && ringUp && !pinkyUp) return 'StarryNight'; // ☝✌💍 3-finger
    if (indexUp && middleUp && !ringUp && !pinkyUp) return 'LoveLetter'; // ✌ Peace
    if (ext <= 1)                               return 'Heart';       // ✊ Fist

    return 'Saturn'; // Transitional
  }
}
