/**
 * One Euro Filter for real-time low-latency, jitter-free signal smoothing.
 * Based on Géry Casiez, Nicolas Roussel, Daniel Vogel (CHI 2012).
 * 
 * Dynamically adjusts cutoff frequency:
 * - Low speed: heavy smoothing to completely eliminate jitter.
 * - High speed: minimal filtering to reduce latency to near zero.
 */

class LowPassFilter {
  private y: number;
  private s: number;
  private initialized: boolean = false;
  private a: number = 0;

  constructor(alpha: number = 0, initval: number = 0) {
    this.y = initval;
    this.s = initval;
    this.setAlpha(alpha);
  }

  setAlpha(alpha: number): void {
    this.a = Math.max(0, Math.min(1, alpha));
  }

  filter(value: number): number {
    if (this.initialized) {
      this.s = this.a * value + (1.0 - this.a) * this.s;
    } else {
      this.s = value;
      this.initialized = true;
    }
    this.y = value;
    return this.s;
  }

  hasLastRawValue(): boolean {
    return this.initialized;
  }

  lastRawValue(): number {
    return this.y;
  }

  reset(): void {
    this.initialized = false;
  }
}

export class OneEuroFilter {
  private freq: number;
  private minCutOff: number;
  private beta: number;
  private xFilter: LowPassFilter;
  private dxFilter: LowPassFilter;
  private lastTime: number | null = null;

  /**
   * @param freq Assumed sampling frequency in Hz (typically 60)
   * @param minCutOff Min cutoff frequency in Hz (lower = smoother when still; ~1.0 is ideal)
   * @param beta Speed coefficient (higher = less lag on fast swipes; ~0.04-0.08)
   * @param dCutOff Cutoff frequency for derivative filtering
   */
  constructor(freq: number = 60, minCutOff: number = 1.0, beta: number = 0.05, dCutOff: number = 1.0) {
    this.freq = freq;
    this.minCutOff = minCutOff;
    this.beta = beta;
    this.xFilter = new LowPassFilter(this.calculateAlpha(minCutOff));
    this.dxFilter = new LowPassFilter(this.calculateAlpha(dCutOff));
  }

  private calculateAlpha(cutoff: number): number {
    const te = 1.0 / Math.max(1e-4, this.freq);
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestampMs?: number): number {
    if (this.lastTime !== null && timestampMs !== undefined) {
      const dt = (timestampMs - this.lastTime) / 1000.0;
      if (dt > 1e-4) {
        this.freq = 1.0 / dt;
      }
    }
    if (timestampMs !== undefined) {
      this.lastTime = timestampMs;
    }

    const prevRaw = this.xFilter.hasLastRawValue() ? this.xFilter.lastRawValue() : value;
    const dx = (value - prevRaw) * this.freq;
    const filteredDx = this.dxFilter.filter(dx);

    const cutoff = this.minCutOff + this.beta * Math.abs(filteredDx);
    this.xFilter.setAlpha(this.calculateAlpha(cutoff));

    return this.xFilter.filter(value);
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}
