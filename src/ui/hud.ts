/**
 * Refined HUD & Interaction Dock for Fog Mirror
 * Apple Liquid Glass (visionOS / macOS) translucent white aesthetic.
 */

export interface HUDCallbacks {
  onToggleSound: () => boolean;
  onClearFog: () => void;
  onPhotoTick: (seconds: number) => void;
  onTakePhoto: () => Promise<Blob>;
  onFullFog: () => void;
  onToggleFullscreen: () => void;
  onUpdateWiperWidth: (radius: number) => void;
  onUpdatePinchSensitivity: (threshold: number) => void;
}

export class HUD {
  private container: HTMLElement;
  private breathMeter: HTMLElement;
  private statusText: HTMLElement;
  private settingsModal: HTMLElement;
  private cameraModal: HTMLElement;
  private wiperSlider: HTMLInputElement;
  private wiperValueLabel: HTMLElement;
  private pinchSlider: HTMLInputElement;
  private photoCountdown: HTMLElement;
  private photoFrame: HTMLElement;
  private photoPreview: HTMLElement;
  private photoDialog: HTMLDialogElement;
  private photoUrl: string | null = null;
  private callbacks: HUDCallbacks;
  private isVisible: boolean = true;

  constructor(callbacks: HUDCallbacks) {
    this.callbacks = callbacks;

    // 1. Bottom Control Dock
    this.container = document.createElement('div');
    this.container.className = 'hud-container';

    this.container.innerHTML = `
      <div class="hud-pill">
        <div class="hud-row hud-top-row">
          <div class="hud-status-badge">
            <span class="status-dot"></span>
            <span class="status-label" id="hud-status">Initializing Vision...</span>
          </div>

          <div class="breath-indicator" title="Breath Intensity">
            <div class="breath-bar" id="breath-meter"></div>
          </div>

          <div class="hud-divider hud-desktop-divider"></div>

          <div class="hud-slider-group" title="Air Pencil Width">
            <svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
            <input type="range" id="slider-wiper" min="3" max="30" value="6" class="hud-slider" />
            <span class="slider-badge" id="val-wiper">6px</span>
          </div>
        </div>

        <div class="hud-divider hud-desktop-divider"></div>

        <div class="hud-row hud-actions-row">
          <button class="hud-btn" id="btn-sound" aria-label="Mute sound (M)" title="Sound (M)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.08"></path>
            </svg>
          </button>

          <button class="hud-btn" id="btn-settings" aria-label="Settings" title="Settings">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>

          <button class="hud-btn" id="btn-fog" aria-label="Fog up the mirror (F)" title="Steam Up (F)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            </svg>
          </button>

          <button class="hud-btn" id="btn-clear" aria-label="Erase all fog (C)" title="Clear Glass (C)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m7 21-4-4a2 2 0 0 1 0-3l9-10a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-8 8H7Zm0-11 11 10M13 21h9"></path>
            </svg>
          </button>

          <button class="hud-btn" id="btn-photo" aria-label="Take photo" title="Take Photo">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h4l2-3h4l2 3h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>

          <button class="hud-btn" id="btn-fullscreen" aria-label="Enter fullscreen" title="Fullscreen">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="hud-help-tip">
        <span><b>Pinch</b> to write &bull; <b>Fist</b> to wipe<span class="desktop-only"> &bull; Press <b>H</b> to hide controls</span></span>
      </div>
    `;

    document.body.appendChild(this.container);

    // 2. Modals attached directly to body (avoiding CSS transform containing block bug)
    this.settingsModal = document.createElement('div');
    this.settingsModal.className = 'secret-modal hidden';
    this.settingsModal.id = 'settings-modal';
    this.settingsModal.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Settings</h3>
          <button class="hud-btn" id="settings-close" aria-label="Close settings">&times;</button>
        </div>
        
        <div class="modal-field">
          <label for="slider-pinch">Pinch gap</label>
          <input type="range" id="slider-pinch" min="0.025" max="0.070" step="0.002" value="0.040" class="modal-slider" />
          <span class="field-hint">Move left if writing starts too early or keeps going after you lift. Move right if a pinch is hard to start.</span>
        </div>

        <div class="modal-field">
          <span id="photo-delay-label">Photo timer</span>
          <div class="photo-timer-options" role="radiogroup" aria-labelledby="photo-delay-label">
            ${[0, 3, 5, 10].map(seconds => `
              <label class="hud-btn hud-btn-label">
                <input type="radio" name="photo-delay" value="${seconds}" ${seconds === 3 ? 'checked' : ''}>
                ${seconds === 0 ? 'Off' : `${seconds}s`}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="modal-actions">
          <button class="hud-btn hud-btn-label" id="settings-done" aria-label="Done with settings">Done</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.settingsModal);

    // 3. Camera Permission Card (Prompt when camera is blocked or denied)
    this.cameraModal = document.createElement('div');
    this.cameraModal.className = 'permission-modal hidden';
    this.cameraModal.id = 'camera-modal';
    this.cameraModal.innerHTML = `
      <div class="permission-card">
        <div class="permission-icon-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
            <circle cx="12" cy="13" r="3"></circle>
          </svg>
        </div>
        <h3 class="permission-title">Camera Access Required</h3>
        <p class="permission-desc">
          Fog Mirror needs your camera to turn your screen into a steamy mirror and track your air-writing gestures.
        </p>
        <div class="permission-guide">
          <div class="guide-item">
            <span class="guide-badge">1</span>
            <span>Tap the <b>camera</b> or <b>lock icon</b> in your browser address bar</span>
          </div>
          <div class="guide-item">
            <span class="guide-badge">2</span>
            <span>Set camera permissions to <b>Allow</b></span>
          </div>
        </div>
        <button class="permission-btn" id="btn-enable-camera">Enable Camera</button>
      </div>
    `;
    document.body.appendChild(this.cameraModal);

    this.breathMeter = document.getElementById('breath-meter')!;
    this.statusText = document.getElementById('hud-status')!;
    this.wiperSlider = document.getElementById('slider-wiper') as HTMLInputElement;
    this.wiperValueLabel = document.getElementById('val-wiper')!;
    this.pinchSlider = document.getElementById('slider-pinch') as HTMLInputElement;
    this.photoCountdown = document.createElement('output');
    this.photoCountdown.className = 'photo-countdown';
    this.photoCountdown.hidden = true;
    this.photoFrame = document.createElement('div');
    this.photoFrame.className = 'photo-frame';
    this.photoFrame.textContent = 'Pinch both hands';
    this.photoFrame.hidden = true;

    this.photoPreview = document.createElement('aside');
    this.photoPreview.className = 'photo-preview';
    this.photoPreview.hidden = true;
    this.photoPreview.innerHTML = `
      <button type="button" data-photo-view aria-label="Open photo preview"><img alt="Latest Fog Mirror photo"></button>
      <div class="photo-actions">
        <button type="button" class="hud-btn hud-btn-label" data-photo-view aria-label="View full photo">View</button>
        <button type="button" class="hud-btn hud-btn-label" data-photo-save aria-label="Save photo as PNG">Save</button>
        <button type="button" class="hud-btn hud-btn-label" data-photo-remove aria-label="Dismiss photo">Dismiss</button>
      </div>
    `;
    this.photoDialog = document.createElement('dialog');
    this.photoDialog.className = 'photo-dialog';
    this.photoDialog.setAttribute('aria-label', 'Fog Mirror photo');
    this.photoDialog.innerHTML = `
      <img alt="Fog Mirror photo">
      <div class="photo-actions">
        <button type="button" class="hud-btn hud-btn-label" data-photo-close aria-label="Close view">Close view</button>
        <button type="button" class="hud-btn hud-btn-label" data-photo-save aria-label="Save photo as PNG">Save</button>
        <button type="button" class="hud-btn hud-btn-label" data-photo-remove aria-label="Dismiss photo">Dismiss</button>
      </div>
    `;
    document.body.append(this.photoCountdown, this.photoFrame, this.photoPreview, this.photoDialog);

    this.photoPreview.querySelectorAll('[data-photo-view]').forEach(button =>
      button.addEventListener('click', () => this.photoDialog.showModal())
    );
    this.photoDialog.querySelector('[data-photo-close]')!.addEventListener('click', () => this.photoDialog.close());
    for (const panel of [this.photoPreview, this.photoDialog]) {
      panel.querySelector('[data-photo-remove]')!.addEventListener('click', () => this.dismissPhoto());
      panel.querySelector('[data-photo-save]')!.addEventListener('click', () => this.savePhoto());
    }

    this.bindEvents();
  }

  private bindEvents(): void {
    const btnSound = document.getElementById('btn-sound')!;
    const btnSettings = document.getElementById('btn-settings')!;
    const btnFog = document.getElementById('btn-fog')!;
    const btnClear = document.getElementById('btn-clear')!;
    const btnPhoto = document.querySelector<HTMLButtonElement>('#btn-photo')!;
    const btnFullscreen = document.getElementById('btn-fullscreen')!;
    const settingsClose = document.getElementById('settings-close')!;
    const settingsDone = document.getElementById('settings-done')!;

    // Wiper width slider
    this.wiperSlider.addEventListener('input', () => {
      const val = parseInt(this.wiperSlider.value, 10);
      this.wiperValueLabel.textContent = `${val}px`;
      this.callbacks.onUpdateWiperWidth(val);
    });

    // Pinch sensitivity slider
    this.pinchSlider.addEventListener('input', () => {
      const val = parseFloat(this.pinchSlider.value);
      this.callbacks.onUpdatePinchSensitivity(val);
    });

    btnSound.addEventListener('click', () => {
      const isMuted = this.callbacks.onToggleSound();
      btnSound.classList.toggle('active', !isMuted);
      btnSound.setAttribute('aria-label', isMuted ? 'Unmute sound (M)' : 'Mute sound (M)');
    });

    btnSettings.addEventListener('click', () => {
      this.settingsModal.classList.remove('hidden');
    });

    settingsClose.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    settingsDone.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    btnFog.addEventListener('click', () => this.callbacks.onFullFog());
    btnClear.addEventListener('click', () => this.callbacks.onClearFog());
    btnPhoto.addEventListener('click', () => void this.startPhoto());
    btnFullscreen.addEventListener('click', () => this.callbacks.onToggleFullscreen());
    document.addEventListener('fullscreenchange', () => {
      btnFullscreen.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        this.toggleVisibility();
      } else if (e.key === 'm' || e.key === 'M') {
        btnSound.click();
      } else if (e.key === 'c' || e.key === 'C') {
        this.callbacks.onClearFog();
      } else if (e.key === 'f' || e.key === 'F') {
        this.callbacks.onFullFog();
      }
    });
  }

  setPhotoFrame(corners?: { x: number; y: number }[]): void {
    this.photoFrame.hidden = corners?.length !== 2 ||
      this.container.querySelector<HTMLButtonElement>('#btn-photo')!.disabled;
    if (!corners || this.photoFrame.hidden) return;
    const [a, b] = corners;
    Object.assign(this.photoFrame.style, {
      left: `${Math.min(a.x, b.x)}px`,
      top: `${Math.min(a.y, b.y)}px`,
      width: `${Math.abs(a.x - b.x)}px`,
      height: `${Math.abs(a.y - b.y)}px`
    });
  }

  async startPhoto(): Promise<void> {
    const button = this.container.querySelector<HTMLButtonElement>('#btn-photo')!;
    if (button.disabled) return;
    const delay = this.settingsModal.querySelector<HTMLInputElement>('input[name=photo-delay]:checked')!;
    button.disabled = true;
    this.photoFrame.hidden = true;
    try {
      const deadline = performance.now() + Number(delay.value) * 1000;
      let remaining = deadline - performance.now();
      let displayedSeconds = 0;
      while (remaining > 0) {
        this.photoCountdown.hidden = false;
        const seconds = Math.ceil(remaining / 1000);
        if (seconds !== displayedSeconds) {
          this.photoCountdown.textContent = String(seconds);
          this.callbacks.onPhotoTick(seconds);
          displayedSeconds = seconds;
        }
        const nextTick = remaining - (seconds - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, Math.ceil(nextTick)));
        remaining = deadline - performance.now();
      }
      this.photoCountdown.hidden = true;
      const blob = await this.callbacks.onTakePhoto();
      this.dismissPhoto();
      this.photoUrl = URL.createObjectURL(blob);
      for (const panel of [this.photoPreview, this.photoDialog]) {
        panel.querySelector('img')!.src = this.photoUrl;
      }
      await this.revealPhoto();
      this.setStatus('');
    } catch {
      this.setStatus('Photo unavailable. Check the camera.');
    } finally {
      button.disabled = false;
      this.photoCountdown.hidden = true;
    }
  }

  private async revealPhoto(): Promise<void> {
    this.photoPreview.hidden = false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const thumbnail = this.photoPreview.querySelector('img')!;
    this.photoPreview.style.visibility = 'hidden';
    const still = document.createElement('div');
    still.className = 'photo-capture-still';
    still.setAttribute('aria-hidden', 'true');
    try {
      await thumbnail.decode();
      const target = thumbnail.getBoundingClientRect();
      const image = thumbnail.cloneNode() as HTMLImageElement;
      image.alt = '';
      still.append(image, document.createElement('span'));
      document.body.appendChild(still);

      const start = still.getBoundingClientRect();
      const landing = `translate(${target.left - start.left}px, ${target.top - start.top}px)
        scale(${target.width / start.width}, ${target.height / start.height})`;
      await still.animate([
        { transform: 'none', offset: 0 },
        { transform: 'none', offset: 0.2, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)' },
        { transform: landing, offset: 1 }
      ], { duration: 520, fill: 'forwards' }).finished;
    } finally {
      still.remove();
      this.photoPreview.style.removeProperty('visibility');
    }
  }

  private dismissPhoto(): void {
    this.photoDialog.close();
    this.photoPreview.hidden = true;
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    this.photoUrl = null;
    for (const panel of [this.photoPreview, this.photoDialog]) {
      panel.querySelector('img')!.removeAttribute('src');
    }
  }

  private savePhoto(): void {
    if (!this.photoUrl) return;
    const link = document.createElement('a');
    link.href = this.photoUrl;
    link.download = `fog-mirror-${Date.now()}.png`;
    link.click();
  }

  setStatus(text: string): void {
    if (this.statusText) {
      this.statusText.textContent = text;
      this.statusText.parentElement!.hidden = !text;
    }
  }

  setBreathIntensity(intensity: number): void {
    if (this.breathMeter) {
      this.breathMeter.style.width = `${Math.min(100, Math.round(intensity * 100))}%`;
    }
  }

  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.container.style.opacity = this.isVisible ? '1' : '0';
    this.container.style.pointerEvents = this.isVisible ? 'auto' : 'none';
  }

  showCameraPermission(onRequest: () => void): void {
    this.cameraModal.classList.remove('hidden');
    const btn = document.getElementById('btn-enable-camera');
    if (btn) {
      btn.onclick = () => {
        onRequest();
      };
    }
  }

  hideCameraPermission(): void {
    this.cameraModal.classList.add('hidden');
  }
}
