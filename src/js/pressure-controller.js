/**
 * pressure-controller.js — Pressure & Tension Tracker
 *
 * What it does:
 *   Tracks how long the user has been holding the mouse button and
 *   translates that duration into a pressure level (hairline / medium / deep).
 *   It also tracks whether the cursor is moving or stationary, which
 *   determines whether a crater should form.
 *
 * How it works:
 *   - A timer starts when mousedown fires.
 *   - Every animation frame we read the elapsed time.
 *   - The elapsed time is mapped to one of three pressure levels defined
 *     in CONFIG.crack.
 *   - A separate "still" timer tracks how long the cursor hasn't moved,
 *     which triggers the crater mechanic.
 *
 * Why it exists:
 *   Separating pressure logic from drawing logic keeps each file focused
 *   on one job and makes it easy to tune the feel of the interaction.
 *
 * What you can customise:
 *   - Pressure thresholds: change the ms values in getPressureLevel().
 *   - Crater trigger: change CONFIG.crater.triggerDuration.
 *   - Tension build speed: change CONFIG.tension.buildRate.
 */

const PressureController = (() => {

  // ── Private State ─────────────────────────────────────────────────────

  /** Timestamp (ms) when the mouse button was pressed */
  let _pressStartTime = 0;

  /** Whether the mouse button is currently held down */
  let _isHolding = false;

  /** Current tension level, 0.0 → 1.0, used for visual tension effects */
  let _tension = 0;

  /** Timestamp of the last cursor movement */
  let _lastMoveTime = 0;

  /** Position of the cursor when it last moved */
  let _lastMovePos = { x: 0, y: 0 };

  /** Whether the cursor is considered "still" (for crater mechanic) */
  let _isStill = false;

  /**
   * How many pixels the cursor must move to be considered "moving".
   * Increase this if craters trigger too easily while slow-dragging.
   */
  const STILL_THRESHOLD_PX = 6;

  /**
   * How long (ms) the cursor must be stationary before we call it "still".
   * This prevents craters from forming during slow intentional drags.
   */
  const STILL_DEBOUNCE_MS = 200;

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Call this when the user presses the mouse button.
   * @param {number} x - Cursor X position
   * @param {number} y - Cursor Y position
   */
  function startPress(x, y) {
    _pressStartTime = performance.now();
    _isHolding      = true;
    _tension        = 0;
    _lastMoveTime   = _pressStartTime;
    _lastMovePos    = { x, y };
    _isStill        = false;
  }

  /**
   * Call this every animation frame while the mouse is held.
   * Updates the tension level and the "still" state.
   *
   * @param {number} x   - Current cursor X
   * @param {number} y   - Current cursor Y
   * @param {number} now - Current timestamp from performance.now()
   */
  function update(x, y, now) {
    if (!_isHolding) return;

    // ── Tension build ──────────────────────────────────────────────────
    // Tension rises from 0 to 1 as the user holds the button.
    // CONFIG.tension.buildRate controls how quickly it rises.
    const elapsed = now - _pressStartTime;
    _tension = Math.min(1, elapsed * CONFIG.tension.buildRate);

    // ── Still detection ────────────────────────────────────────────────
    // If the cursor has moved more than STILL_THRESHOLD_PX since the last
    // recorded position, reset the still timer.
    const dx = x - _lastMovePos.x;
    const dy = y - _lastMovePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > STILL_THRESHOLD_PX) {
      _lastMoveTime = now;
      _lastMovePos  = { x, y };
      _isStill      = false;
    } else {
      // Cursor hasn't moved much — check if it's been still long enough
      _isStill = (now - _lastMoveTime) > STILL_DEBOUNCE_MS;
    }
  }

  /**
   * Call this when the user releases the mouse button.
   * Returns the final pressure snapshot for the completed stroke.
   *
   * @returns {PressureSnapshot}
   */
  function endPress() {
    const duration = performance.now() - _pressStartTime;
    const snapshot = buildSnapshot(duration);
    _isHolding = false;
    _tension   = 0;
    _isStill   = false;
    return snapshot;
  }

  /**
   * Returns the current pressure level string: "hairline" | "medium" | "deep".
   * Useful for real-time crack preview while dragging.
   *
   * @returns {string}
   */
  function getPressureLevel() {
    if (!_isHolding) return "hairline";
    const elapsed = performance.now() - _pressStartTime;
    return classifyDuration(elapsed);
  }

  /**
   * Returns the current tension value (0.0 → 1.0).
   * Used by the FX canvas to draw tension trembles and stress lines.
   *
   * @returns {number}
   */
  function getTension() {
    return _tension;
  }

  /**
   * Returns true if the cursor is currently held and stationary.
   * Used to trigger the crater mechanic.
   *
   * @returns {boolean}
   */
  function isStill() {
    return _isHolding && _isStill;
  }

  /**
   * Returns true if the mouse button is currently held.
   *
   * @returns {boolean}
   */
  function isHolding() {
    return _isHolding;
  }

  /**
   * Returns how long (ms) the button has been held so far.
   * Used by the crater engine to calculate crater radius.
   *
   * @returns {number}
   */
  function getHoldDuration() {
    if (!_isHolding) return 0;
    return performance.now() - _pressStartTime;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Maps an elapsed duration (ms) to a pressure level string.
   *
   * Thresholds (customisable here):
   *   0–300ms   → "hairline"
   *   300–1000ms → "medium"
   *   1000ms+   → "deep"
   *
   * @param {number} durationMs
   * @returns {string}
   */
  function classifyDuration(durationMs) {
    if (durationMs < 300)  return "hairline";
    if (durationMs < 1000) return "medium";
    return "deep";
  }

  /**
   * Builds a complete pressure snapshot from a final duration value.
   * The snapshot is passed to the fracture engine and gold fill engine.
   *
   * @typedef {Object} PressureSnapshot
   * @property {string} level        - "hairline" | "medium" | "deep"
   * @property {number} durationMs   - Total hold duration in milliseconds
   * @property {Object} crackConfig  - The matching crack config from CONFIG.crack
   *
   * @param {number} durationMs
   * @returns {PressureSnapshot}
   */
  function buildSnapshot(durationMs) {
    const level = classifyDuration(durationMs);
    return {
      level,
      durationMs,
      crackConfig: CONFIG.crack[level],
    };
  }

  // ── Expose public methods ─────────────────────────────────────────────
  return {
    startPress,
    update,
    endPress,
    getPressureLevel,
    getTension,
    isStill,
    isHolding,
    getHoldDuration,
  };

})();
