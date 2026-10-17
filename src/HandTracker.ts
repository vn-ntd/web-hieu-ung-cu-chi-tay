import { FilesetResolver, HandLandmarker, type HandLandmarkerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision';

export type Gesture = 'Saturn' | 'LoveLetter' | 'StarryNight' | 'Heart' | 'None';

interface SmoothLandmark {
  x: number;
  y: number;
  z: number;
}

export class HandTracker {
  private videoElement: HTMLVideoElement;
  private handLandmarker: HandLandmarker | null = null;
  public isInitializing = true;
  private lastVideoTime = -1;
  private _detecting = false;

  public currentGesture: Gesture = 'None';
  public currentLandmarks: NormalizedLandmark[] | null = null;
  public smoothLandmarks: SmoothLandmark[] | null = null;
  private _targetLandmarks: SmoothLandmark[] | null = null;

  // Gesture debouncing / stabilization (require 3 consecutive frames)
  private _pendingGesture: Gesture = 'None';
  private _consecutiveFrames = 0;
  private readonly CONFIRM_FRAMES = 3;

  public onGestureChange?: (gesture: Gesture) => void;
  public onReady?: () => void;
  public onError?: (errorMessage: string) => void;

  private readonly LERP_ALPHA = 0.35;

  constructor(videoElementId: string) {
    this.videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
    this._init();
  }

  private async _init() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );

      // Attempt GPU first, fallback to CPU
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
      } catch (gpuError) {
        console.warn('GPU delegate failed, fallback to CPU delegate:', gpuError);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Webcam hoặc chưa có HTTPS');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.videoElement.addEventListener('loadeddata', () => {
        if (this.videoElement.videoWidth > 0) {
          this.isInitializing = false;
          if (this.onReady) this.onReady();
        }
      });
    } catch (err: unknown) {
      console.error('HandTracker initialization error:', err);
      this.isInitializing = false;
      const msg = err instanceof Error ? err.message : String(err);
      if (this.onError) this.onError(msg);
    }
  }

  public predict() {
    if (this.isInitializing && this.videoElement.readyState >= 2 && this.videoElement.videoWidth > 0) {
      this.isInitializing = false;
      if (this.onReady) this.onReady();
    }
    if (this.isInitializing || !this.videoElement.videoWidth || !this.handLandmarker) return;
    if (this.videoElement.paused) this.videoElement.play().catch(() => {});

    if (!this._detecting && this.lastVideoTime !== this.videoElement.currentTime) {
      this._detecting = true;
      const captureTime = performance.now();
      this.lastVideoTime = this.videoElement.currentTime;

      queueMicrotask(() => {
        try {
          if (!this.handLandmarker) return;
          const results = this.handLandmarker.detectForVideo(this.videoElement, captureTime);
          this._processResults(results);
        } catch (e) {
          console.warn('Frame detection error:', e);
        } finally {
          this._detecting = false;
        }
      });
    }

    this._lerpSmooth();
  }

  private _lerpSmooth() {
    if (!this._targetLandmarks) {
      this.smoothLandmarks = null;
      return;
    }
    const target = this._targetLandmarks;
    const alpha = this.LERP_ALPHA;

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

      const raw = this._classifyGesture(lm);
      this._stabilizeGesture(raw);
    } else {
      this.currentLandmarks = null;
      this._targetLandmarks = null;
      this._stabilizeGesture('None');
    }
  }

  private _stabilizeGesture(raw: Gesture) {
    if (raw === this._pendingGesture) {
      this._consecutiveFrames++;
      if (this._consecutiveFrames >= this.CONFIRM_FRAMES && this.currentGesture !== raw) {
        this.currentGesture = raw;
        if (this.onGestureChange) this.onGestureChange(raw);
      }
    } else {
      this._pendingGesture = raw;
      this._consecutiveFrames = 1;
    }
  }

  /**
   * Robust finger extension detection relative to wrist
   */
  private _classifyGesture(lm: NormalizedLandmark[]): Gesture {
    if (!lm || lm.length < 21) return 'None';
    const w = lm[0]; // wrist

    const d2 = (a: NormalizedLandmark, b: NormalizedLandmark) => {
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      return dx * dx + dy * dy + dz * dz;
    };

    const indexUp  = d2(w, lm[8])  > d2(w, lm[6]);
    const middleUp = d2(w, lm[12]) > d2(w, lm[10]);
    const ringUp   = d2(w, lm[16]) > d2(w, lm[14]);
    const pinkyUp  = d2(w, lm[20]) > d2(w, lm[18]);

    const extCount = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;

    // 1. Open palm (4 or 5 fingers extended) -> Saturn
    if (extCount >= 4) {
      return 'Saturn';
    }

    // 2. Three fingers (Index + Middle + Ring) -> Starry Night
    if (indexUp && middleUp && ringUp && !pinkyUp) {
      return 'StarryNight';
    }

    // 3. Peace sign / V (Index + Middle only) -> Love Letter "I Love You"
    if (indexUp && middleUp && !ringUp && !pinkyUp) {
      return 'LoveLetter';
    }

    // 4. Fist (0 or 1 finger extended) -> Heart
    if (extCount <= 1) {
      return 'Heart';
    }

    return 'Saturn';
  }
}
