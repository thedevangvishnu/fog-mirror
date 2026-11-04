/**
 * Fog & Condensation Canvas Simulation
 * Handles:
 * 1. Offscreen fog density & alpha mask
 * 2. Radial steam blooms from mouth breath
 * 3. Smooth interpolated stroke wiping with destination-out
 * 4. Condensation moisture beads & gravity drip particles
 * 5. Hidden steam quote / message reveal
 */

interface Droplet {
  x: number;
  y: number;
  radius: number;
  speed: number;
  trail: { x: number; y: number }[];
}

export class FogCanvas {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  private noisePattern: CanvasPattern | null = null;
  private width: number = window.innerWidth;
  private height: number = window.innerHeight;

  // Simulation physics
  public evaporationRate: number = 0.0006; // Slow natural drying
  public wipeBrushRadius: number = 38;
  public secretMessage: string = "clarity is an inner state";
  public showSecretMessage: boolean = true;

  // Droplet particle physics
  private droplets: Droplet[] = [];
  private lastWipePositions: Map<number, { x: number; y: number }> = new Map();

  // Callbacks
  public onWipeMove?: (velocity: number) => void;
  public onDropletFall?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: false })!;

    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: false })!;

    this.resize();
    this.createNoisePattern();
    this.initInitialFog(0.45); // Start with an inviting light steam
  }

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.offscreenCanvas.width = this.width;
    this.offscreenCanvas.height = this.height;

    this.createNoisePattern();
  }

  private createNoisePattern(): void {
    const patternCanvas = document.createElement('canvas');
    const pSize = 128;
    patternCanvas.width = pSize;
    patternCanvas.height = pSize;
    const pCtx = patternCanvas.getContext('2d')!;

    const imgData = pCtx.createImageData(pSize, pSize);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Sub-pixel frosted noise texture with slight cool blue-gray hue
      const n = (Math.random() * 45) | 0;
      data[i] = 230 + n;     // R
      data[i + 1] = 238 + n; // G
      data[i + 2] = 245 + n; // B
      data[i + 3] = 210 + (Math.random() * 45) | 0; // Alpha
    }

    pCtx.putImageData(imgData, 0, 0);
    this.noisePattern = this.offscreenCtx.createPattern(patternCanvas, 'repeat');
  }

  initInitialFog(density: number = 0.5): void {
    this.offscreenCtx.clearRect(0, 0, this.width, this.height);
    this.offscreenCtx.fillStyle = 'rgba(235, 242, 250, ' + density + ')';
    this.offscreenCtx.fillRect(0, 0, this.width, this.height);

    if (this.noisePattern) {
      this.offscreenCtx.fillStyle = this.noisePattern;
      this.offscreenCtx.globalAlpha = density * 0.7;
      this.offscreenCtx.fillRect(0, 0, this.width, this.height);
      this.offscreenCtx.globalAlpha = 1.0;
    }
  }

  /**
   * Add steam condensation blooming out from mouth position
   */
  addBreathSteam(mouthX: number, mouthY: number, intensity: number): void {
    const screenX = mouthX * this.width;
    const screenY = mouthY * this.height;

    // Steam plume blossoms outward and slightly upward
    const plumeRadius = Math.min(this.width, this.height) * (0.28 + intensity * 0.15);

    this.offscreenCtx.save();
    this.offscreenCtx.globalCompositeOperation = 'source-over';

    const grad = this.offscreenCtx.createRadialGradient(
      screenX,
      screenY,
      10,
      screenX,
      screenY - 20,
      plumeRadius
    );

    const alpha = Math.min(0.28, intensity * 0.22);
    grad.addColorStop(0, `rgba(240, 245, 255, ${alpha})`);
    grad.addColorStop(0.5, `rgba(235, 242, 250, ${alpha * 0.7})`);
    grad.addColorStop(0.85, `rgba(230, 238, 246, ${alpha * 0.3})`);
    grad.addColorStop(1, 'rgba(230, 238, 246, 0)');

    this.offscreenCtx.fillStyle = grad;
    this.offscreenCtx.beginPath();
    this.offscreenCtx.arc(screenX, screenY - 20, plumeRadius, 0, Math.PI * 2);
    this.offscreenCtx.fill();

    // Occasional condensation droplet spawn in thick steam regions
    if (Math.random() < 0.08 * intensity && this.droplets.length < 24) {
      this.droplets.push({
        x: screenX + (Math.random() - 0.5) * plumeRadius * 0.8,
        y: screenY + (Math.random() - 0.5) * plumeRadius * 0.5,
        radius: 2 + Math.random() * 2.5,
        speed: 0.6 + Math.random() * 1.4,
        trail: []
      });
    }

    this.offscreenCtx.restore();
  }

  /**
   * Wipe away steam at specific mirrored coordinates using destination-out
   */
  wipeAt(pointerId: number, normX: number, normY: number): void {
    const x = normX * this.width;
    const y = normY * this.height;

    const lastPos = this.lastWipePositions.get(pointerId) || { x, y };
    const dx = x - lastPos.x;
    const dy = y - lastPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2) {
      this.onWipeMove?.(dist);
    }

    this.offscreenCtx.save();
    this.offscreenCtx.globalCompositeOperation = 'destination-out';

    // Interpolate steps along stroke to avoid broken bead lines on fast finger swipes
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 0; i <= steps; i++) {
      const curX = lastPos.x + (dx * i) / steps;
      const curY = lastPos.y + (dy * i) / steps;

      const grad = this.offscreenCtx.createRadialGradient(
        curX,
        curY,
        this.wipeBrushRadius * 0.25,
        curX,
        curY,
        this.wipeBrushRadius
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
      grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.85)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.offscreenCtx.fillStyle = grad;
      this.offscreenCtx.beginPath();
      this.offscreenCtx.arc(curX, curY, this.wipeBrushRadius, 0, Math.PI * 2);
      this.offscreenCtx.fill();
    }

    this.offscreenCtx.restore();
    this.lastWipePositions.set(pointerId, { x, y });
  }

  resetPointer(pointerId: number): void {
    this.lastWipePositions.delete(pointerId);
  }

  /**
   * Physics step: natural evaporation, water droplet gravity crawl, and composite rendering
   */
  updateAndRender(): void {
    // 1. Natural Evaporation (fog slowly fades away if untouched)
    if (this.evaporationRate > 0) {
      this.offscreenCtx.save();
      this.offscreenCtx.globalCompositeOperation = 'destination-out';
      this.offscreenCtx.fillStyle = `rgba(0, 0, 0, ${this.evaporationRate})`;
      this.offscreenCtx.fillRect(0, 0, this.width, this.height);
      this.offscreenCtx.restore();
    }

    // 2. Condensation Water Droplets (sliding down the glass under gravity)
    this.updateDroplets();

    // 3. Clear main display canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // 4. Render the Secret Steam Message behind/inside the fog layer
    if (this.showSecretMessage && this.secretMessage) {
      this.renderSecretMessage();
    }

    // 5. Blit offscreen fog mask onto main canvas with soft frosted overlay
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  private updateDroplets(): void {
    this.offscreenCtx.save();
    this.offscreenCtx.globalCompositeOperation = 'destination-out';

    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const drop = this.droplets[i];
      drop.trail.push({ x: drop.x, y: drop.y });
      if (drop.trail.length > 15) drop.trail.shift();

      // Gravity slide with tiny organic jitter
      drop.y += drop.speed;
      drop.x += (Math.random() - 0.5) * 0.4;

      // Clear a thin trail behind the droplet
      const grad = this.offscreenCtx.createRadialGradient(
        drop.x,
        drop.y,
        0,
        drop.x,
        drop.y,
        drop.radius * 1.5
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.offscreenCtx.fillStyle = grad;
      this.offscreenCtx.beginPath();
      this.offscreenCtx.arc(drop.x, drop.y, drop.radius * 1.5, 0, Math.PI * 2);
      this.offscreenCtx.fill();

      // Droplet fell off the bottom
      if (drop.y > this.height) {
        this.droplets.splice(i, 1);
        this.onDropletFall?.();
      }
    }

    this.offscreenCtx.restore();
  }

  private renderSecretMessage(): void {
    this.ctx.save();
    this.ctx.font = '300 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.letterSpacing = '4px';

    // Soft glow
    this.ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
    this.ctx.shadowBlur = 12;

    this.ctx.fillText(this.secretMessage, this.width * 0.5, this.height * 0.38);
    this.ctx.restore();
  }

  clearAllFog(): void {
    this.offscreenCtx.clearRect(0, 0, this.width, this.height);
    this.droplets = [];
  }

  fullFog(): void {
    this.initInitialFog(0.85);
  }
}
