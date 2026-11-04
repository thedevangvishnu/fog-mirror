import shutterUrl from './camera-shutter.wav?url';

/**
 * Audio Engine for Fog Mirror
 * Handles:
 * 1. Microphone breath/blow acoustic turbulence detection (high-pass band filtering)
 * 2. Procedural ASMR sound synthesis:
 *    - Steam / breath hiss whoosh
 *    - Glass friction wipe squeaks (velocity-sensitive)
 *    - Condensation water droplet drip pings
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micFilter: BiquadFilterNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;

  public isMuted: boolean = false;
  public breathLevel: number = 0; // 0.0 to 1.0

  // Sound generator state
  private steamGain: GainNode | null = null;
  private pencilGain: GainNode | null = null;
  private pencilFilter: BiquadFilterNode | null = null;
  private shutterBuffer: AudioBuffer | null = null;
  private lastSqueakTime: number = 0;

  async init(micStream?: MediaStream): Promise<void> {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.setupSteamSynthesizer();

    if (micStream) {
      this.attachMicrophone(micStream);
    }

    try {
      const response = await fetch(shutterUrl);
      if (response.ok) {
        this.shutterBuffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
      }
    } catch (error) {
      console.warn('Camera shutter sound could not be loaded:', error);
    }
  }

  attachMicrophone(stream: MediaStream): void {
    if (!this.ctx) return;

    try {
      const source = this.ctx.createMediaStreamSource(stream);

      // Breath/blowing sound produces turbulent high-frequency white noise between 1200Hz - 4500Hz
      // whereas standard speech has dominant energy below 1000Hz.
      this.micFilter = this.ctx.createBiquadFilter();
      this.micFilter.type = 'bandpass';
      this.micFilter.frequency.setValueAtTime(2400, this.ctx.currentTime);
      this.micFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      source.connect(this.micFilter);
      this.micFilter.connect(this.analyser);

      this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    } catch (err) {
      console.warn('Microphone breath analysis initialization error:', err);
    }
  }

  /**
   * Samples mic turbulence to detect real physical blowing sound
   */
  updateMicBreath(): number {
    if (!this.analyser || !this.dataArray) {
      this.breathLevel = 0;
      return 0;
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const avg = sum / this.dataArray.length;
    // Map raw mic reading to 0..1 range with thresholding
    const normalized = Math.max(0, Math.min(1, (avg - 18) / 35));
    this.breathLevel = this.breathLevel * 0.7 + normalized * 0.3;
    return this.breathLevel;
  }

  private setupSteamSynthesizer(): void {
    if (!this.ctx) return;

    // Pink / Brown noise buffer for realistic steam hiss
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const steamFilter = this.ctx.createBiquadFilter();
    steamFilter.type = 'lowpass';
    steamFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);

    this.steamGain = this.ctx.createGain();
    this.steamGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(steamFilter);
    steamFilter.connect(this.steamGain);
    this.steamGain.connect(this.ctx.destination);

    this.pencilFilter = this.ctx.createBiquadFilter();
    this.pencilFilter.type = 'bandpass';
    this.pencilFilter.Q.value = 0.65;
    this.pencilGain = this.ctx.createGain();
    this.pencilGain.gain.value = 0;
    whiteNoise.connect(this.pencilFilter).connect(this.pencilGain).connect(this.ctx.destination);
    whiteNoise.start();
  }

  /**
   * Modulate steam sound intensity based on blowing strength
   */
  setSteamIntensity(intensity: number): void {
    if (!this.ctx || !this.steamGain || this.isMuted) return;
    const targetGain = Math.max(0, Math.min(0.25, intensity * 0.25));
    this.steamGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
  }

  playPhotoTick(seconds: number): void {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const tone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    tone.frequency.value = seconds === 1 ? 880 : 660;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    tone.connect(gain).connect(this.ctx.destination);
    tone.start(now);
    tone.stop(now + 0.1);
  }

  playPhotoShutter(): void {
    if (!this.ctx || !this.shutterBuffer || this.isMuted) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.shutterBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;
    source.connect(gain).connect(this.ctx.destination);
    source.start();
  }

  setPencilSpeed(speed: number): void {
    if (!this.ctx || !this.pencilGain || !this.pencilFilter) return;
    const movement = Math.max(0, Math.min(1, (speed - 25) / 550));
    const now = this.ctx.currentTime;
    this.pencilGain.gain.setTargetAtTime(this.isMuted ? 0 : movement * 0.16, now, 0.035);
    this.pencilFilter.frequency.setTargetAtTime(340 + movement * 460, now, 0.05);
  }

  /**
   * Plays a glass squeak sound when a finger wipes across wet condensation
   */
  playGlassSqueak(velocity: number): void {
    if (!this.ctx || this.isMuted) return;
    const now = performance.now();
    // Throttle squeaks slightly so they don't turn into a wall of sound
    if (now - this.lastSqueakTime < 110) return;
    this.lastSqueakTime = now;

    const baseFreq = 850 + Math.random() * 450;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = Math.random() > 0.4 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      baseFreq * (1.1 + Math.random() * 0.3),
      this.ctx.currentTime + 0.07
    );

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.2, this.ctx.currentTime);
    filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    const volume = Math.min(0.18, 0.04 + (velocity / 80) * 0.14);
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  /**
   * Water droplet drip sound when condensation runs down the glass
   */
  playWaterDrip(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = 1600 + Math.random() * 400;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 1.5, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.steamGain && this.ctx) {
      this.steamGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}
