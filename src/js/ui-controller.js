/**
 * ui-controller.js — User Interface Manager
 *
 * What it does:
 *   Manages all UI elements outside the canvas:
 *     - Tutorial bar text
 *     - Sound panel (toggle, layer rows, volume sliders, mute buttons)
 *     - Reset button
 *     - Reset fade overlay
 *
 * How it works:
 *   - On init(), the tutorial text is populated from CONFIG.ui.
 *   - The sound panel is built dynamically from CONFIG.audio so that
 *     adding a new sound layer only requires a CONFIG change.
 *   - All button/slider events are wired here and delegate to
 *     AudioController for actual audio changes.
 *
 * Why it exists:
 *   Keeping UI wiring separate from canvas logic and audio logic means
 *   each file stays focused and readable.
 *
 * What you can customise:
 *   - Tutorial text: change CONFIG.ui.tutorialText and CONFIG.ui.helperTexts.
 *   - Sound panel labels: change the key names in CONFIG.audio.
 *   - Reset fade: change CONFIG.reset.fadeDuration.
 */

const UIController = (() => {

  // ── Private State ─────────────────────────────────────────────────────

  /** Whether the sound panel is currently visible */
  let _soundPanelOpen = false;

  /** The reset overlay element */
  let _resetOverlay = null;

  /** Callback to call when the user clicks the reset button */
  let _onResetCallback = null;

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Initialises the UI.
   * Call this after the DOM is ready.
   *
   * @param {Function} onReset - Called when the user triggers a reset
   */
  function init(onReset) {
    _onResetCallback = onReset;

    populateTutorialBar();
    buildSoundPanel();
    wireButtons();
    createResetOverlay();
  }

  /**
   * Triggers the reset fade animation.
   * Fades the surface to white, calls onComplete, then fades back in.
   *
   * @param {Function} onComplete - Called at the peak of the fade (surface is hidden)
   */
  function triggerResetFade(onComplete) {
    if (!_resetOverlay) return;

    const fadeDuration = CONFIG.reset.fadeDuration;

    // Fade in (overlay becomes opaque)
    _resetOverlay.classList.add("fading-in");

    setTimeout(() => {
      // Surface is now hidden — perform the reset
      if (onComplete) onComplete();

      // Fade out (overlay becomes transparent)
      _resetOverlay.classList.remove("fading-in");
    }, fadeDuration * 0.5);
  }

  /**
   * Updates the helper text in the tutorial bar.
   * Cycles through CONFIG.ui.helperTexts on each call.
   *
   * @param {number} index - Index into CONFIG.ui.helperTexts
   */
  function setHelperText(index) {
    const el = document.getElementById("tutorial-helper");
    if (!el) return;
    const texts = CONFIG.ui.helperTexts;
    el.textContent = texts[index % texts.length];
  }

  // ── Private: Tutorial Bar ─────────────────────────────────────────────

  /**
   * Populates the tutorial bar with text from CONFIG.ui.
   */
  function populateTutorialBar() {
    const mainEl   = document.getElementById("tutorial-main");
    const helperEl = document.getElementById("tutorial-helper");

    if (mainEl)   mainEl.textContent   = CONFIG.ui.tutorialText;
    if (helperEl) helperEl.textContent = CONFIG.ui.helperTexts[0];
  }

  // ── Private: Sound Panel ──────────────────────────────────────────────

  /**
   * Builds the sound panel layer rows dynamically from CONFIG.audio.
   * Each layer gets a label, a volume slider, and a mute toggle.
   */
  function buildSoundPanel() {
    const container = document.getElementById("sound-layers");
    if (!container) return;

    container.innerHTML = "";

    // Human-readable labels for each layer key
    const layerLabels = {
      tension: "Tension",
      crack:   "Crack",
      ambient: "Ambient",
    };

    Object.entries(CONFIG.audio).forEach(([key, cfg]) => {
      const label = layerLabels[key] || key;

      const row = document.createElement("div");
      row.className = "sound-row";

      // Label
      const labelEl = document.createElement("label");
      labelEl.className = "sound-label";
      labelEl.htmlFor   = `vol-${key}`;
      labelEl.textContent = label;

      // Volume slider
      const slider = document.createElement("input");
      slider.type      = "range";
      slider.id        = `vol-${key}`;
      slider.className = "volume-slider";
      slider.min       = "0";
      slider.max       = "1";
      slider.step      = "0.01";
      slider.value     = cfg.defaultVolume;
      slider.setAttribute("aria-label", `${label} volume`);

      // Update slider fill gradient on input
      updateSliderFill(slider);
      slider.addEventListener("input", () => {
        AudioController.setLayerVolume(key, parseFloat(slider.value));
        updateSliderFill(slider);
      });

      // Mute toggle button
      const muteBtn = document.createElement("button");
      muteBtn.className   = "mute-btn" + (cfg.defaultEnabled ? " active" : "");
      muteBtn.id          = `mute-${key}`;
      muteBtn.setAttribute("aria-label", `Toggle ${label} sound`);
      muteBtn.innerHTML   = `<span class="mute-icon">♪</span>`;

      muteBtn.addEventListener("click", () => {
        const isEnabled = AudioController.isLayerEnabled(key);
        AudioController.setLayerEnabled(key, !isEnabled);
        muteBtn.classList.toggle("active", !isEnabled);
      });

      row.appendChild(labelEl);
      row.appendChild(slider);
      row.appendChild(muteBtn);
      container.appendChild(row);
    });

    // Wire master volume slider
    const masterSlider = document.getElementById("master-volume");
    if (masterSlider) {
      updateSliderFill(masterSlider);
      masterSlider.addEventListener("input", () => {
        AudioController.setMasterVolume(parseFloat(masterSlider.value));
        updateSliderFill(masterSlider);
      });
    }

    // Wire master mute button
    const masterMuteBtn = document.getElementById("master-mute");
    if (masterMuteBtn) {
      let masterMuted = false;
      masterMuteBtn.addEventListener("click", () => {
        masterMuted = !masterMuted;
        AudioController.setMasterMuted(masterMuted);
        masterMuteBtn.classList.toggle("active", !masterMuted);
        masterMuteBtn.setAttribute("aria-label", masterMuted ? "Unmute all sounds" : "Mute all sounds");
      });
    }
  }

  /**
   * Updates the CSS gradient on a range input to show fill progress.
   * This gives the slider a filled-left / empty-right visual.
   *
   * @param {HTMLInputElement} slider
   */
  function updateSliderFill(slider) {
    const val = ((parseFloat(slider.value) - parseFloat(slider.min)) /
                 (parseFloat(slider.max)   - parseFloat(slider.min))) * 100;
    slider.style.background =
      `linear-gradient(to right, var(--gold-accent) ${val}%, #D4C4A8 ${val}%)`;
  }

  // ── Private: Button Wiring ────────────────────────────────────────────

  /**
   * Wires the sound toggle button and reset button.
   */
  function wireButtons() {
    // Sound panel toggle
    const soundBtn   = document.getElementById("sound-toggle-btn");
    const soundPanel = document.getElementById("sound-panel");

    if (soundBtn && soundPanel) {
      soundBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        _soundPanelOpen = !_soundPanelOpen;
        soundPanel.hidden = !_soundPanelOpen;
        soundBtn.setAttribute("aria-expanded", _soundPanelOpen);
      });

      // Close panel when clicking outside
      document.addEventListener("click", (e) => {
        if (_soundPanelOpen && !soundPanel.contains(e.target) && e.target !== soundBtn) {
          _soundPanelOpen = false;
          soundPanel.hidden = true;
          soundBtn.setAttribute("aria-expanded", false);
        }
      });
    }

    // Reset button
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (_onResetCallback) _onResetCallback();
      });
    }
  }

  // ── Private: Reset Overlay ────────────────────────────────────────────

  /**
   * Creates and appends the reset fade overlay element.
   */
  function createResetOverlay() {
    const container = document.getElementById("app-container");
    if (!container) return;

    _resetOverlay = document.createElement("div");
    _resetOverlay.id = "reset-overlay";
    container.appendChild(_resetOverlay);
  }

  // ── Expose public methods ─────────────────────────────────────────────
  return {
    init,
    triggerResetFade,
    setHelperText,
  };

})();
