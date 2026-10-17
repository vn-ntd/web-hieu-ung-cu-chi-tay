import p5 from 'p5';
import { ParticleSystem } from './ParticleSystem';
import { HandTracker } from './HandTracker';
import { UIManager } from './UIManager';

const sketch = (p: p5) => {
  let particleSystem: ParticleSystem;
  let handTracker:    HandTracker;
  let uiManager:      UIManager;

  p.setup = () => {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
    canvas.parent(container);
    p.frameRate(60);
    p.colorMode(p.RGB, 255, 255, 255, 255);

    particleSystem = new ParticleSystem(p, 2500);
    uiManager      = new UIManager();
    handTracker    = new HandTracker('webcam');

    handTracker.onReady = () => {
      uiManager.updateCameraStatus(true);
    };
    handTracker.onGestureChange = (gesture) => {
      uiManager.updateGestureStatus(gesture);
    };
  };

  p.windowResized = () => {
    p.resizeCanvas(window.innerWidth, window.innerHeight);
  };

  p.draw = () => {
    // Motion blur fade — semi-transparent black overlay each frame
    p.push();
    p.noStroke();
    p.fill(0, 0, 0, 25);
    p.rect(0, 0, p.width, p.height);
    p.pop();

    if (handTracker)    handTracker.predict();
    if (particleSystem && handTracker) {
      particleSystem.update(handTracker.smoothLandmarks, handTracker.currentGesture);
    }
  };
};

new p5(sketch);
