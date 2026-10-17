import type { Gesture } from './HandTracker';

export class UIManager {
  private cameraStatusText: HTMLSpanElement;
  private cameraStatusBadge: HTMLElement;
  private gestureButtons: NodeListOf<HTMLButtonElement>;
  private hudElement: HTMLElement;
  private hudToggleFloating: HTMLButtonElement;
  private cameraPreviewContainer: HTMLElement;
  private toastElement: HTMLElement;
  private toastIcon: HTMLSpanElement;
  private toastText: HTMLSpanElement;
  private toastTimeout: number | null = null;

  public onManualGestureSelect?: (gesture: Gesture) => void;

  constructor() {
    this.cameraStatusText = document.querySelector('#camera-status .status-text') as HTMLSpanElement;
    this.cameraStatusBadge = document.getElementById('camera-status') as HTMLElement;
    this.gestureButtons = document.querySelectorAll('.gesture-btn');
    this.hudElement = document.getElementById('hud') as HTMLElement;
    this.hudToggleFloating = document.getElementById('hud-toggle-floating') as HTMLButtonElement;
    this.cameraPreviewContainer = document.getElementById('camera-preview-container') as HTMLElement;
    this.toastElement = document.getElementById('gesture-toast') as HTMLElement;
    this.toastIcon = document.getElementById('toast-icon') as HTMLSpanElement;
    this.toastText = document.getElementById('toast-text') as HTMLSpanElement;

    this._setupEventListeners();
  }

  private _setupEventListeners() {
    // Gesture button clicks (manual override / click to select)
    this.gestureButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gesture = btn.getAttribute('data-gesture') as Gesture;
        if (gesture && this.onManualGestureSelect) {
          this.onManualGestureSelect(gesture);
          this.updateGestureStatus(gesture);
        }
      });
    });

    // Fullscreen toggle
    const fsBtn = document.getElementById('toggle-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // Toggle camera preview in corner
    const camBtn = document.getElementById('toggle-camera-view');
    if (camBtn && this.cameraPreviewContainer) {
      camBtn.addEventListener('click', () => {
        this.cameraPreviewContainer.classList.toggle('camera-preview-visible');
        this.cameraPreviewContainer.classList.toggle('camera-preview-hidden');
      });
    }

    // HUD Collapse / Expand
    const toggleHudBtn = document.getElementById('toggle-hud');
    if (toggleHudBtn && this.hudElement && this.hudToggleFloating) {
      toggleHudBtn.addEventListener('click', () => {
        this.hudElement.style.display = 'none';
        this.hudToggleFloating.style.display = 'flex';
      });

      this.hudToggleFloating.addEventListener('click', () => {
        this.hudElement.style.display = 'flex';
        this.hudToggleFloating.style.display = 'none';
      });
    }
  }

  public updateCameraStatus(status: 'loading' | 'ready' | 'error', message?: string) {
    if (!this.cameraStatusBadge || !this.cameraStatusText) return;

    this.cameraStatusBadge.classList.remove('status-loading', 'status-ready', 'status-error');

    if (status === 'ready') {
      this.cameraStatusBadge.classList.add('status-ready');
      this.cameraStatusText.textContent = 'Camera Sẵn Sàng';
    } else if (status === 'error') {
      this.cameraStatusBadge.classList.add('status-error');
      this.cameraStatusText.textContent = message || 'Lỗi Camera (Chạm/Chuột để chơi)';
    } else {
      this.cameraStatusBadge.classList.add('status-loading');
      this.cameraStatusText.textContent = 'Đang khởi tạo Camera...';
    }
  }

  public updateGestureStatus(gesture: Gesture) {
    // 1. Highlight active button in HUD
    this.gestureButtons.forEach((btn) => {
      if (btn.getAttribute('data-gesture') === gesture) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 2. Trigger sleek center toast
    const info: Record<Gesture, { name: string; icon: string }> = {
      Saturn:      { name: 'Sao Thổ (Saturn)', icon: '🪐' },
      LoveLetter:  { name: 'I Love You', icon: '💌' },
      Heart:       { name: 'Trái Tim Đập', icon: '❤️' },
      StarryNight: { name: 'Bầu Trời Sao', icon: '✨' },
      None:        { name: 'Chế độ tự do', icon: '🌌' },
    };

    const current = info[gesture] || { name: gesture, icon: '✨' };

    if (this.toastElement && gesture !== 'None') {
      this.toastIcon.textContent = current.icon;
      this.toastText.textContent = current.name;

      this.toastElement.classList.remove('toast-hidden');
      this.toastElement.classList.add('toast-visible');

      if (this.toastTimeout) window.clearTimeout(this.toastTimeout);
      this.toastTimeout = window.setTimeout(() => {
        this.toastElement.classList.remove('toast-visible');
        this.toastElement.classList.add('toast-hidden');
      }, 1600);
    }
  }
}
