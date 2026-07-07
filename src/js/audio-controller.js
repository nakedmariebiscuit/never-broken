/**
 * audio-controller.js — Sound System
 *
 * What it does:
 *   Manages audio for the app: tension hum, crack sound, and ambient loop.
 *   Each layer can be toggled on/off with independent volume control.
 *
 * Changes made:
 *   - Removed goldFill and shimmer audio layers entirely.
 *   - Replaced the harsh white-noise crack with a realistic ceramic cracking
 *     sound using layered noise bursts with resonant frequency decay.
 *   - The crack sound now has multiple micro-cracks (like real ceramic
 *     fracturing) with a sharp initial snap followed by a subtle resonance.
 *   - playGoldFill and playShimmer are now no-ops (kept for API compatibility).
 */

const AudioController = (() => {

  let _ctx = null;
  let _masterGain = null;
  let _masterMuted = false;
  const _layers = {};
  let _tensionNode = null;
  let _tensionGain = null;
  let _ambientNode = null;

  // ── Public API ────────────────────────────────────────────────────────

  function init() {
    if (_ctx) return;

    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Never Broken: Web Audio API not available.", e);
      return;
    }

    _masterGain = _ctx.createGain();
    _masterGain.gain.value = 1;
    _masterGain.connect(_ctx.destination);

    Object.entries(CONFIG.audio).forEach(([key, cfg]) => {
      const layerGain = _ctx.createGain();
      layerGain.gain.value = cfg.defaultVolume;
      layerGain.connect(_masterGain);

      _layers[key] = {
        gain:       layerGain,
        buffer:     null,
        enabled:    cfg.defaultEnabled,
        volume:     cfg.defaultVolume,
        activeNode: null,
      };

      if (!cfg.usePlaceholder) {
        loadAudioFile(key, cfg.src);
      }
    });

    startAmbient();
  }

  function playTension(tensionLevel) {
    if (!_ctx || !_layers.tension?.enabled) return;

    if (!_tensionNode) {
      _tensionNode = synthesiseTension(_ctx);
      _tensionGain = _ctx.createGain();
      _tensionGain.gain.value = 0;
      _tensionNode.connect(_tensionGain);
      _tensionGain.connect(_layers.tension.gain);
      _tensionNode.start();
    }

    const targetGain = tensionLevel * _layers.tension.volume;
    _tensionGain.gain.setTargetAtTime(targetGain, _ctx.currentTime, 0.1);
  }

  function stopTension() {
    if (!_tensionGain || !_ctx) return;
    _tensionGain.gain.setTargetAtTime(0, _ctx.currentTime, 0.08);
    setTimeout(() => {
      if (_tensionNode) {
        try { _tensionNode.stop(); } catch (e) {}
        _tensionNode = null;
        _tensionGain = null;
      }
    }, 300);
  }

  /**
   * Plays the crack sound.
   * The synthesised version now produces a realistic ceramic cracking sound
   * with multiple micro-crack events layered together.
   */
  function playCrack(pressureLevel) {
    if (!_ctx || !_layers.crack?.enabled) return;
    const layer = _layers.crack;

    if (layer.buffer) {
      playBuffer(layer.buffer, layer.gain, false);
    } else {
      synthesiseCrack(_ctx, layer.gain, pressureLevel);
    }
  }

  /**
   * No-op — goldFill layer has been removed.
   * Kept for API compatibility.
   */
  function playGoldFill(pressureLevel) {
    // Removed — no longer needed
  }

  /**
   * No-op — shimmer layer has been removed.
   * Kept for API compatibility.
   */
  function playShimmer() {
    // Removed — no longer needed
  }

  function setLayerVolume(layerKey, volume) {
    if (!_layers[layerKey] || !_ctx) return;
    _layers[layerKey].volume = volume;
    _layers[layerKey].gain.gain.setTargetAtTime(volume, _ctx.currentTime, 0.05);
  }

  function setLayerEnabled(layerKey, enabled) {
    if (!_layers[layerKey]) return;
    _layers[layerKey].enabled = enabled;

    if (layerKey === "ambient" && !enabled && _ambientNode) {
      try { _ambientNode.stop(); } catch (e) {}
      _ambientNode = null;
    }

    if (layerKey === "ambient" && enabled) {
      startAmbient();
    }
  }

  function setMasterVolume(volume) {
    if (!_masterGain || !_ctx) return;
    _masterGain.gain.setTargetAtTime(volume, _ctx.currentTime, 0.05);
  }

  function setMasterMuted(muted) {
    _masterMuted = muted;
    if (!_masterGain || !_ctx) return;
    _masterGain.gain.setTargetAtTime(muted ? 0 : 1, _ctx.currentTime, 0.05);
  }

  function isLayerEnabled(layerKey) {
    return _layers[layerKey]?.enabled ?? false;
  }

  // ── Private: Audio File Loading ───────────────────────────────────────

  function loadAudioFile(layerKey, src) {
    if (!_ctx) return;

    fetch(src)
      .then(r => r.arrayBuffer())
      .then(data => _ctx.decodeAudioData(data))
      .then(buffer => {
        if (_layers[layerKey]) {
          _layers[layerKey].buffer = buffer;
          if (layerKey === "ambient") startAmbient();
        }
      })
      .catch(() => {
        console.info(`Never Broken: Audio file "${src}" not found. Using placeholder.`);
      });
  }

  function playBuffer(buffer, destination, loop) {
    if (!_ctx) return null;
    const source = _ctx.createBufferSource();
    source.buffer = buffer;
    source.loop   = loop;
    source.connect(destination);
    source.start();
    return source;
  }

  // ── Private: Ambient Loop ─────────────────────────────────────────────

  function startAmbient() {
    if (!_ctx || !_layers.ambient?.enabled) return;
    if (_ambientNode) return;

    const layer = _layers.ambient;

    if (layer.buffer) {
      _ambientNode = playBuffer(layer.buffer, layer.gain, true);
    } else {
      _ambientNode = synthesiseAmbient(_ctx, layer.gain);
    }
  }

  // ── Private: Placeholder Sound Synthesis ─────────────────────────────

  function synthesiseTension(audioCtx) {
    const osc = audioCtx.createOscillator();
    osc.type            = "sine";
    osc.frequency.value = 55;

    const lfo = audioCtx.createOscillator();
    lfo.type            = "sine";
    lfo.frequency.value = 0.4;

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 3;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();

    return osc;
  }

  /**
   * Synthesises a realistic ceramic cracking sound.
   *
   * Real ceramic cracks have a distinctive character:
   *   - A very sharp initial "snap" (high-frequency broadband burst)
   *   - Followed by a rapid cascade of micro-cracks (smaller bursts
   *     with slightly different pitches)
   *   - A brief resonant "ping" as the ceramic material vibrates
   *   - The sound is dry and sharp — not rumbling or bassy
   *
   * This replaces the old white-noise burst which sounded too digital/harsh.
   */
  function synthesiseCrack(audioCtx, destination, pressureLevel) {
    const now = audioCtx.currentTime;

    // Parameters scale with pressure level
    const numMicroCracks = pressureLevel === "hairline" ? 1 :
                           pressureLevel === "medium"   ? 3 : 6;
    const burstDuration  = pressureLevel === "hairline" ? 0.06 :
                           pressureLevel === "medium"   ? 0.10 : 0.15;
    const overallVol     = pressureLevel === "hairline" ? 0.5 :
                           pressureLevel === "medium"   ? 0.75 : 1.0;
    const resonanceFreq  = pressureLevel === "hairline" ? 4200 :
                           pressureLevel === "medium"   ? 3200 : 2400;

    // ── 1. Main crack burst: sharp broadband noise with fast decay ──
    const mainBufSize = Math.floor(audioCtx.sampleRate * burstDuration);
    const mainBuffer  = audioCtx.createBuffer(1, mainBufSize, audioCtx.sampleRate);
    const mainData    = mainBuffer.getChannelData(0);

    for (let i = 0; i < mainBufSize; i++) {
      // Very fast exponential decay for a sharp snap
      const envelope = Math.exp(-i / (mainBufSize * 0.04));
      mainData[i] = (Math.random() * 2 - 1) * envelope;
    }

    const mainSource = audioCtx.createBufferSource();
    mainSource.buffer = mainBuffer;

    // Bandpass filter — ceramic cracks are mid-to-high frequency
    const mainFilter = audioCtx.createBiquadFilter();
    mainFilter.type            = "bandpass";
    mainFilter.frequency.value = 2800;
    mainFilter.Q.value         = 1.2;

    const mainGain = audioCtx.createGain();
    mainGain.gain.value = overallVol;

    mainSource.connect(mainFilter);
    mainFilter.connect(mainGain);
    mainGain.connect(destination);
    mainSource.start(now);

    // ── 2. Resonant "ping" — the ceramic material ringing ──
    const pingOsc = audioCtx.createOscillator();
    pingOsc.type            = "sine";
    pingOsc.frequency.value = resonanceFreq;

    const pingGain = audioCtx.createGain();
    pingGain.gain.setValueAtTime(0, now + 0.003);
    pingGain.gain.linearRampToValueAtTime(overallVol * 0.35, now + 0.008);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    pingOsc.connect(pingGain);
    pingGain.connect(destination);
    pingOsc.start(now + 0.003);
    pingOsc.stop(now + 0.2);

    // Second harmonic ping for more realistic ceramic tone
    const pingOsc2 = audioCtx.createOscillator();
    pingOsc2.type            = "sine";
    pingOsc2.frequency.value = resonanceFreq * 1.5;

    const pingGain2 = audioCtx.createGain();
    pingGain2.gain.setValueAtTime(0, now + 0.005);
    pingGain2.gain.linearRampToValueAtTime(overallVol * 0.15, now + 0.01);
    pingGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    pingOsc2.connect(pingGain2);
    pingGain2.connect(destination);
    pingOsc2.start(now + 0.005);
    pingOsc2.stop(now + 0.15);

    // ── 3. Micro-cracks: smaller crack bursts staggered after the main ──
    for (let m = 0; m < numMicroCracks; m++) {
      const delay = 0.012 + Math.random() * 0.06;

      const microBufSize = Math.floor(audioCtx.sampleRate * (burstDuration * 0.6));
      const microBuffer  = audioCtx.createBuffer(1, microBufSize, audioCtx.sampleRate);
      const microData    = microBuffer.getChannelData(0);

      for (let i = 0; i < microBufSize; i++) {
        const envelope = Math.exp(-i / (microBufSize * 0.06));
        microData[i] = (Math.random() * 2 - 1) * envelope;
      }

      const microSource = audioCtx.createBufferSource();
      microSource.buffer = microBuffer;

      const microFilter = audioCtx.createBiquadFilter();
      microFilter.type            = "highpass";
      microFilter.frequency.value = 3500 + Math.random() * 2500;

      const microGain = audioCtx.createGain();
      microGain.gain.value = overallVol * (0.25 + Math.random() * 0.35);

      microSource.connect(microFilter);
      microFilter.connect(microGain);
      microGain.connect(destination);
      microSource.start(now + delay);
    }
  }

  function synthesiseAmbient(audioCtx, destination) {
    const osc = audioCtx.createOscillator();
    osc.type            = "sine";
    osc.frequency.value = 110;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.12;

    const lfo     = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type            = "sine";
    lfo.frequency.value = 0.12;
    lfoGain.gain.value  = 0.06;

    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    osc.connect(gainNode);
    gainNode.connect(destination);

    lfo.start();
    osc.start();

    return osc;
  }

  // ── Expose public methods ─────────────────────────────────────────────
  return {
    init,
    playTension,
    stopTension,
    playCrack,
    playGoldFill,  // kept for API compatibility (no-op)
    playShimmer,   // kept for API compatibility (no-op)
    setLayerVolume,
    setLayerEnabled,
    setMasterVolume,
    setMasterMuted,
    isLayerEnabled,
  };

})();
