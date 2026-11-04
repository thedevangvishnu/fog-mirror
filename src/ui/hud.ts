/**
 * Refined HUD & Interaction Dock for Fog Mirror
 * Clean, frosted glass minimalist pill interface.
 */

export interface HUDCallbacks {
  onToggleSound: () => boolean;
  onClearFog: () => void;
  onFullFog: () => void;
  onUpdateMessage: (msg: string) => void;
  onToggleMessage: () => boolean;
  onToggleFullscreen: () => void;
}

export class HUD {
  private container: HTMLElement;
  private breathMeter: HTMLElement;
  private statusText: HTMLElement;
  private secretModal: HTMLElement;
  private messageInput: HTMLInputElement;
  private callbacks: HUDCallbacks;
  private isVisible: boolean = true;

  constructor(callbacks: HUDCallbacks) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.className = 'hud-container';

    this.container.innerHTML = `
      <div class="hud-pill">
        <div class="hud-status-badge">
          <span class="status-dot"></span>
          <span class="status-label" id="hud-status">Initializing Vision...</span>
        </div>

        <div class="breath-indicator" title="Breath Intensity">
          <div class="breath-bar" id="breath-meter"></div>
        </div>

        <div class="hud-divider"></div>

        <button class="hud-btn" id="btn-sound" title="Toggle ASMR Sound (M)">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.08"></path>
          </svg>
        </button>

        <button class="hud-btn" id="btn-secret" title="Secret Steam Message">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>

        <button class="hud-btn" id="btn-fog" title="Steam Up Glass (F)">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
          </svg>
        </button>

        <button class="hud-btn" id="btn-clear" title="Clear Glass (C)">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>

        <button class="hud-btn" id="btn-fullscreen" title="Fullscreen">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
      </div>

      <div class="hud-help-tip">
        <span>Press <b>H</b> to hide UI for clean video recording &bull; <b>Space</b> to blow steam</span>
      </div>

      <!-- Secret Message Modal -->
      <div class="secret-modal hidden" id="secret-modal">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Subconscious Steam Message</h3>
            <button class="modal-close" id="modal-close">&times;</button>
          </div>
          <p class="modal-desc">This text appears faintly inside the condensation when the glass steams up.</p>
          <input type="text" id="message-input" value="clarity is an inner state" placeholder="Write your hidden reflection..." />
          <div class="modal-actions">
            <button class="modal-btn secondary" id="modal-toggle-msg">Toggle Visible</button>
            <button class="modal-btn primary" id="modal-save-msg">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    this.breathMeter = document.getElementById('breath-meter')!;
    this.statusText = document.getElementById('hud-status')!;
    this.secretModal = document.getElementById('secret-modal')!;
    this.messageInput = document.getElementById('message-input') as HTMLInputElement;

    this.bindEvents();
  }

  private bindEvents(): void {
    const btnSound = document.getElementById('btn-sound')!;
    const btnSecret = document.getElementById('btn-secret')!;
    const btnFog = document.getElementById('btn-fog')!;
    const btnClear = document.getElementById('btn-clear')!;
    const btnFullscreen = document.getElementById('btn-fullscreen')!;
    const modalClose = document.getElementById('modal-close')!;
    const modalSave = document.getElementById('modal-save-msg')!;
    const modalToggle = document.getElementById('modal-toggle-msg')!;

    btnSound.addEventListener('click', () => {
      const isMuted = this.callbacks.onToggleSound();
      btnSound.classList.toggle('active', !isMuted);
      btnSound.title = isMuted ? 'Unmute ASMR Sound (M)' : 'Mute ASMR Sound (M)';
    });

    btnSecret.addEventListener('click', () => {
      this.secretModal.classList.remove('hidden');
      this.messageInput.focus();
    });

    modalClose.addEventListener('click', () => {
      this.secretModal.classList.add('hidden');
    });

    modalSave.addEventListener('click', () => {
      this.callbacks.onUpdateMessage(this.messageInput.value);
      this.secretModal.classList.add('hidden');
    });

    modalToggle.addEventListener('click', () => {
      const shown = this.callbacks.onToggleMessage();
      modalToggle.textContent = shown ? 'Disable Message' : 'Enable Message';
    });

    btnFog.addEventListener('click', () => this.callbacks.onFullFog());
    btnClear.addEventListener('click', () => this.callbacks.onClearFog());
    btnFullscreen.addEventListener('click', () => this.callbacks.onToggleFullscreen());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (document.activeElement === this.messageInput) return;

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

  setStatus(text: string): void {
    if (this.statusText) {
      this.statusText.textContent = text;
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
}
