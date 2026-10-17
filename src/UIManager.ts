import type { Gesture } from './HandTracker';

export class UIManager {
  private cameraStatus: HTMLSpanElement;
  private gestureStatus: HTMLSpanElement;

  constructor() {
    this.cameraStatus  = document.getElementById('camera-status')  as HTMLSpanElement;
    this.gestureStatus = document.getElementById('gesture-status') as HTMLSpanElement;
  }

  public updateCameraStatus(isReady: boolean) {
    if (isReady) {
      this.cameraStatus.textContent = '● Camera Ready';
      this.cameraStatus.className = 'ready';
    } else {
      this.cameraStatus.textContent = '○ Initializing Camera...';
      this.cameraStatus.className = '';
    }
  }

  public updateGestureStatus(gesture: Gesture) {
    const labels: Record<Gesture, string> = {
      Saturn:      '🪐 Saturn',
      LoveLetter:  '💌 Love Letter',
      StarryNight: '✨ Starry Night',
      Heart:       '❤️  Heart',
      None:        'Gesture: None',
    };
    this.gestureStatus.textContent = labels[gesture] ?? `Gesture: ${gesture}`;
  }

  // Kept for API compat — no-ops since controls are removed
  public onColorChange?:   (hex: string) => void;
  public onPatternChange?: (pattern: string) => void;
}
