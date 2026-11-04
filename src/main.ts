/**
 * Main Application Orchestrator
 * Connects Webcam, MediaPipe Vision, Web Audio ASMR, Fog Simulation, and HUD.
 */

import './style.css';
import { VisionEngine } from './vision/visionEngine';
import { AudioEngine } from './audio/audioEngine';
import { FogCanvas } from './canvas/fogCanvas';
import { HUD } from './ui/hud';

class FogMirrorApp {
  private video: HTMLVideoElement;
  private canvasElement: HTMLCanvasElement;
  private fingerCursors: HTMLElement[] = [];

  private vision: VisionEngine;
  private audio: AudioEngine;
  private fog: FogCanvas;
  private hud: HUD;

  private isRunning: boolean = false;
  private manualBlowActive: boolean = false;
  private isMouseDown: boolean = false;

  constructor() {
    this.video = document.getElementById('webcam') as HTMLVideoElement;
    this.canvasElement = document.getElementById('fog-canvas') as HTMLCanvasElement;
    this.fingerCursors = [
      document.getElementById('finger-0')!,
      document.getElementById('finger-1')!
    ];

    this.vision = new VisionEngine();
    this.audio = new AudioEngine();
    this.fog = new FogCanvas(this.canvasElement);

    this.hud = new HUD({
      onToggleSound: () => this.audio.toggleMute(),
      onClearFog: () => this.fog.clearAllFog(),
      onFullFog: () => this.fog.fullFog(),
      onToggleFullscreen: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      },
      onUpdateWiperWidth: (radius: number) => {
        this.fog.setBrushRadius(radius);
      },
      onUpdatePinchSensitivity: (threshold: number) => {
        this.vision.pinchThreshold = threshold;
      }
    });

    // Audio & Canvas hooks
    this.fog.onWipeMove = (dist) => {
      this.audio.playGlassSqueak(dist);
    };

    this.fog.onDropletFall = () => {
      this.audio.playWaterDrip();
    };

    this.bindWindowEvents();
    this.bindMouseAndTouchFallback();
  }

  async start(): Promise<void> {
    try {
      this.hud.setStatus('Requesting Camera & Mic...');

      // Request camera and microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

      this.video.srcObject = stream;
      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      this.hud.setStatus('Starting Audio & Models...');
      await this.audio.init(stream);

      await this.vision.init((status) => {
        this.hud.setStatus(status);
      });

      this.hud.setStatus('Active — Blow to steam, wipe to clear');
      this.isRunning = true;
      requestAnimationFrame(() => this.loop());
    } catch (err: unknown) {
      console.error('Camera or initialization error:', err);
      this.hud.setStatus('Camera blocked. Mouse wipe enabled.');

      // Allow running even without camera using fallback mouse
      this.isRunning = true;
      requestAnimationFrame(() => this.loop());
    }
  }

  private loop(): void {
    if (!this.isRunning) return;

    // 1. Audio breath detection
    const micBreath = this.audio.updateMicBreath();

    // 2. Vision frame processing
    let mouthBlow = 0;
    let mouthCenter = { x: 0.5, y: 0.65 };

    if (this.vision.ready && this.video.readyState >= 2) {
      const { breath, pointers } = this.vision.processFrame(this.video);

      if (breath.isBlowing) {
        mouthBlow = breath.opennessRatio;
      }
      if (breath.mouthCenter) {
        const mappedMouth = this.mapVideoToScreen(breath.mouthCenter.x, breath.mouthCenter.y);
        mouthCenter = { x: mappedMouth.normScreenX, y: mappedMouth.normScreenY };
      }

      // Process Hand Pointers for wiping
      this.handleVisionPointers(pointers);
    }

    // 3. Combine Vision + Mic + Spacebar manual blow
    // Gated: Ambient microphone noise alone NEVER blows steam if mouth is closed!
    let combinedBlow = 0;
    if (this.manualBlowActive) {
      combinedBlow = 0.9;
    } else if (mouthBlow > 0.12) {
      // Vision confirms open/puckered mouth: mic turbulence amplifies the breath volume
      combinedBlow = Math.max(mouthBlow, micBreath);
    }

    if (combinedBlow > 0.08) {
      this.fog.addBreathSteam(mouthCenter.x, mouthCenter.y, combinedBlow);
      this.audio.setSteamIntensity(combinedBlow);
    } else {
      this.audio.setSteamIntensity(0);
    }

    this.hud.setBreathIntensity(combinedBlow);

    // 4. Update & render fog physics
    this.fog.updateAndRender();

    requestAnimationFrame(() => this.loop());
  }

  /**
   * Map normalized camera video coordinates [0, 1] to screen coordinates,
   * accurately compensating for CSS `object-fit: cover` letterboxing/cropping.
   */
  private mapVideoToScreen(normX: number, normY: number): {
    x: number;
    y: number;
    normScreenX: number;
    normScreenY: number;
  } {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const vidW = this.video.videoWidth || 1280;
    const vidH = this.video.videoHeight || 720;

    const windowAspect = winW / winH;
    const videoAspect = vidW / vidH;

    let renderW: number;
    let renderH: number;
    let offsetX: number;
    let offsetY: number;

    if (windowAspect < videoAspect) {
      // Window is taller than video: video height fits window, left/right are cropped
      renderH = winH;
      renderW = vidW * (winH / vidH);
      offsetX = (winW - renderW) * 0.5;
      offsetY = 0;
    } else {
      // Window is wider than video: video width fits window, top/bottom are cropped
      renderW = winW;
      renderH = vidH * (winW / vidW);
      offsetX = 0;
      offsetY = (winH - renderH) * 0.5;
    }

    const screenX = offsetX + normX * renderW;
    const screenY = offsetY + normY * renderH;

    return {
      x: screenX,
      y: screenY,
      normScreenX: screenX / winW,
      normScreenY: screenY / winH
    };
  }

  private handleVisionPointers(pointers: { x: number; y: number; isPinching: boolean; isFist: boolean }[]): void {
    for (let i = 0; i < this.fingerCursors.length; i++) {
      const cursor = this.fingerCursors[i];
      const pointer = pointers[i];

      if (pointer) {
        const mapped = this.mapVideoToScreen(pointer.x, pointer.y);

        cursor.style.left = `${mapped.x}px`;
        cursor.style.top = `${mapped.y}px`;
        cursor.classList.add('active');

        const isWiping = pointer.isPinching || pointer.isFist;
        cursor.classList.toggle('pinching', pointer.isPinching);
        cursor.classList.toggle('fist', pointer.isFist);
        cursor.classList.toggle('wiping', isWiping);

        // Wipe fog only when an intentional gesture is active, passing isFist for squeegee scaling
        this.fog.wipeAt(i, mapped.normScreenX, mapped.normScreenY, isWiping, pointer.isFist);
      } else {
        cursor.classList.remove('active', 'pinching', 'fist', 'wiping');
        this.fog.resetPointer(i);
      }
    }
  }

  private bindWindowEvents(): void {
    window.addEventListener('resize', () => {
      this.fog.resize();
    });

    // Spacebar to manually blow steam
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        this.manualBlowActive = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.manualBlowActive = false;
      }
    });
  }

  private bindMouseAndTouchFallback(): void {
    const handlePointerWipe = (clientX: number, clientY: number) => {
      const normX = clientX / window.innerWidth;
      const normY = clientY / window.innerHeight;
      this.fog.wipeAt(99, normX, normY);
    };

    this.canvasElement.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      handlePointerWipe(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isMouseDown) {
        handlePointerWipe(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.fog.resetPointer(99);
    });

    // Touch support for mobile / touchscreens
    this.canvasElement.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        handlePointerWipe(t.clientX, t.clientY);
      }
    }, { passive: false });

    this.canvasElement.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        handlePointerWipe(t.clientX, t.clientY);
      }
    }, { passive: false });

    this.canvasElement.addEventListener('touchend', () => {
      this.fog.resetPointer(99);
    });
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const app = new FogMirrorApp();
  app.start();
});
