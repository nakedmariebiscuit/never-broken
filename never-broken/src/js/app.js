/**
 * app.js — Main Application Orchestrator
 *
 * What it does:
 *   1. Sets up the three canvas layers and keeps them sized correctly.
 *   2. Initialises all modules (Surface, Pressure, Fracture, Gold, Audio, UI).
 *   3. Listens for mouse events and routes them to the appropriate modules.
 *   4. On mouseup, generates the full crack path at once and fills it with gold.
 *   5. During hold, shows tension effects and crater preview.
 *   6. Manages the reset mechanic.
 *
 * Key design:
 *   Cracks are generated after the user releases the mouse button.
 *   While holding, the user sees a faint preview line tracking their cursor
 *   direction — this is the "preemptive crack" that darkens during hold.
 */

document.addEventListener("DOMContentLoaded", () => {

  // ── Canvas Setup ───────────────────────────────────────────────────────────

  const surfaceCanvas  = document.getElementById("surface-canvas");
  const fractureCanvas = document.getElementById("fracture-canvas");
  const fxCanvas       = document.getElementById("fx-canvas");

  const surfaceCtx  = surfaceCanvas.getContext("2d");
  const fractureCtx = fractureCanvas.getContext("2d");
  const fxCtx       = fxCanvas.getContext("2d");

  function resizeCanvases() {
    const wrapper = document.getElementById("canvas-wrapper");
    const rect    = wrapper.getBoundingClientRect();
    const dpr     = window.devicePixelRatio || 1;
    const w       = Math.floor(rect.width);
    const h       = Math.floor(rect.height);

    [surfaceCanvas, fractureCanvas, fxCanvas].forEach(canvas => {
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = w + "px";
      canvas.style.height = h + "px";
      canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  // ── Interaction State ──────────────────────────────────────────────────────

  let isPointerDown = false;
  let currentPath = [];
  let craterPos = { x: 0, y: 0 };
  let craterRadius = 0;
  let craterCommitted = false;
  let lastFrameTime = 0;
  let isFilling = false;

  // Preemptive crack preview state
  let previewPath = [];

  // ── Initialisation ─────────────────────────────────────────────────────────

  function init() {
    resizeCanvases();
    SurfaceController.init(surfaceCtx);
    UIController.init(handleReset);

    document.addEventListener("surfaceChanged", () => {
      SurfaceController.redraw();
      fractureCtx.clearRect(0, 0, fractureCanvas.width, fractureCanvas.height);
      FractureEngine.redrawAll(fractureCtx, SurfaceController.getActiveSurface());
    });

    fxCanvas.addEventListener("mousedown",  onPointerDown);
    fxCanvas.addEventListener("mousemove",  onPointerMove);
    fxCanvas.addEventListener("mouseup",    onPointerUp);
    fxCanvas.addEventListener("mouseleave", onPointerLeave);
    fxCanvas.addEventListener("contextmenu", e => e.preventDefault());

    window.addEventListener("resize", () => {
      resizeCanvases();
      SurfaceController.redraw();
      fractureCtx.clearRect(0, 0, fractureCanvas.width, fractureCanvas.height);
      FractureEngine.redrawAll(fractureCtx, SurfaceController.getActiveSurface());
    });
  }

  // ── Mouse / Pointer Events ─────────────────────────────────────────────────

  function getCanvasPos(e) {
    const rect = fxCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;

    AudioController.init();

    const pos = getCanvasPos(e);

    isPointerDown   = true;
    currentPath     = [pos];
    previewPath     = [pos];
    craterPos       = { ...pos };
    craterRadius    = 0;
    craterCommitted = false;
    isFilling       = false;

    PressureController.startPress(pos.x, pos.y);

    lastFrameTime = performance.now();
    requestAnimationFrame(animationLoop);

    UIController.setHelperText(0);
  }

  function onPointerMove(e) {
    if (!isPointerDown) return;

    const pos = getCanvasPos(e);
    currentPath.push(pos);
    previewPath.push(pos);

    PressureController.update(pos.x, pos.y, performance.now());
  }

  function onPointerUp(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    const pressure = PressureController.endPress();
    AudioController.stopTension();

    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    // ── Crater commit ──────────────────────────────────────────────────
    if (craterRadius >= 4 && !craterCommitted) {
      commitCrater(craterPos.x, craterPos.y, craterRadius);
      currentPath = [];
      return;
    }

    // ── Fracture commit ────────────────────────────────────────────────
    // Even a single tap creates a short crack
    if (currentPath.length < 2) {
      const pos = currentPath[0] || getCanvasPos(e);
      currentPath = [
        pos,
        { x: pos.x + 8 + Math.random() * 10, y: pos.y + (Math.random() - 0.5) * 8 },
      ];
    }

    commitStroke(pressure);
    currentPath = [];
    previewPath = [];
  }

  function onPointerLeave(e) {
    if (isPointerDown) {
      onPointerUp(e);
    }
  }

  // ── Stroke Completion ──────────────────────────────────────────────────────

  function commitStroke(pressure) {
    if (isFilling) return;
    isFilling = true;

    const surface  = SurfaceController.getActiveSurface();
    const fracture = FractureEngine.generate(currentPath, pressure, fractureCtx, surface);

    // Play crack sound
    AudioController.playCrack(pressure.level);

    // Start gold fill animation
    GoldFillEngine.fillFracture(fracture, fxCtx, fractureCtx, () => {
      isFilling = false;
      UIController.setHelperText(1);
      checkAutoReset();
    });
  }

  function commitCrater(x, y, radius) {
    craterCommitted = true;
    const surface = SurfaceController.getActiveSurface();

    FractureEngine.drawCrater(x, y, radius, fractureCtx, surface);

    AudioController.playCrack("deep");

    GoldFillEngine.fillCrater(x, y, radius, fxCtx, fractureCtx, () => {
      checkAutoReset();
    });
  }

  // ── Animation Loop ─────────────────────────────────────────────────────────

  function animationLoop(now) {
    if (!isPointerDown) return;

    lastFrameTime = now;

    const lastPos = currentPath[currentPath.length - 1] || { x: 0, y: 0 };
    PressureController.update(lastPos.x, lastPos.y, now);

    const tension = PressureController.getTension();

    AudioController.playTension(tension);

    // Clear FX canvas for this frame
    fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    // Draw preemptive crack preview — a faint line following the cursor path
    drawPreviewCrack();

    // Draw tension effects
    if (tension > 0.05) {
      drawTensionFX(tension, now);
    }

    // Crater growth
    if (PressureController.isStill() && !craterCommitted) {
      const holdDuration = PressureController.getHoldDuration();
      const craterCfg    = CONFIG.crater;

      if (holdDuration > craterCfg.triggerDuration) {
        const growthTime = holdDuration - craterCfg.triggerDuration;
        craterRadius = Math.min(craterCfg.maxRadius, growthTime * craterCfg.growthRate);
        drawCraterPreview(craterPos.x, craterPos.y, craterRadius);
      }
    } else if (!PressureController.isStill() && currentPath.length > 0) {
      craterPos    = currentPath[currentPath.length - 1];
      craterRadius = 0;
    }

    requestAnimationFrame(animationLoop);
  }

  /**
   * Draws the preemptive crack preview — a faint dark line that shows
   * the user where the crack will form. Darkens as tension builds.
   */
  function drawPreviewCrack() {
    if (previewPath.length < 2) return;

    const surface = SurfaceController.getActiveSurface();
    const tension = PressureController.getTension();

    fxCtx.save();

    // The preview darkens with tension (from very faint to clearly visible)
    const baseAlpha = 0.12;
    const tensionAlpha = 0.08 + tension * 0.35;
    fxCtx.globalAlpha = Math.min(0.6, baseAlpha + tensionAlpha);

    // Use a slightly wider, smoother line for the preview
    fxCtx.strokeStyle = surface.crackColor;
    fxCtx.lineWidth   = 1.5;
    fxCtx.lineCap     = "round";
    fxCtx.lineJoin    = "round";

    // Smooth the preview path for a cleaner look
    const smoothed = smoothPreviewPath(previewPath, 2);

    fxCtx.beginPath();
    fxCtx.moveTo(smoothed[0].x, smoothed[0].y);
    for (let i = 1; i < smoothed.length; i++) {
      fxCtx.lineTo(smoothed[i].x, smoothed[i].y);
    }
    fxCtx.stroke();

    fxCtx.restore();
  }

  /**
   * Lightweight smoothing for the preview path — just a simple moving average.
   */
  function smoothPreviewPath(path, windowSize) {
    if (path.length < 3) return path;
    const half = Math.floor(windowSize / 2);
    return path.map((pt, i) => {
      let sx = 0, sy = 0, count = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(path.length - 1, i + half); j++) {
        sx += path[j].x;
        sy += path[j].y;
        count++;
      }
      return { x: sx / count, y: sy / count };
    });
  }

  // ── Tension Visual Effects ─────────────────────────────────────────────────

  function drawTensionFX(tension, now) {
    const cfg    = CONFIG.tension;
    const origin = currentPath[currentPath.length - 1];
    if (!origin) return;

    // Tremble
    const trembleX = Math.sin(now * cfg.trembleFrequency * 0.01) * cfg.trembleAmplitude * tension;
    const trembleY = Math.cos(now * cfg.trembleFrequency * 0.013) * cfg.trembleAmplitude * tension;

    fxCtx.save();
    fxCtx.translate(trembleX, trembleY);

    // Stress lines
    if (tension > 0.3) {
      const numLines = Math.floor(tension * 5);

      fxCtx.save();
      fxCtx.globalAlpha = cfg.stressLineOpacity * tension;
      fxCtx.strokeStyle = SurfaceController.getActiveSurface().crackColor;
      fxCtx.lineWidth   = 0.5;
      fxCtx.lineCap     = "round";

      for (let i = 0; i < numLines; i++) {
        const angle  = (i / numLines) * Math.PI * 2 + now * 0.0005;
        const length = 15 + tension * 30 + Math.random() * 20;
        const endX   = origin.x + Math.cos(angle) * length;
        const endY   = origin.y + Math.sin(angle) * length;

        fxCtx.beginPath();
        fxCtx.moveTo(origin.x, origin.y);
        const midX = (origin.x + endX) / 2 + (Math.random() - 0.5) * 8;
        const midY = (origin.y + endY) / 2 + (Math.random() - 0.5) * 8;
        fxCtx.quadraticCurveTo(midX, midY, endX, endY);
        fxCtx.stroke();
      }

      fxCtx.restore();
    }

    fxCtx.restore();
  }

  function drawCraterPreview(x, y, radius) {
    if (radius <= 0) return;

    const cfg = CONFIG.crater;

    fxCtx.save();

    // Pulsing glow ring
    const glowGrad = fxCtx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 1.5);
    glowGrad.addColorStop(0, "rgba(180, 120, 40, 0.35)");
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");

    fxCtx.beginPath();
    fxCtx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
    fxCtx.fillStyle   = glowGrad;
    fxCtx.globalAlpha = 0.7;
    fxCtx.fill();

    // Dark void centre — hexagonal shape
    drawHexagon(fxCtx, x, y, radius, 1, cfg.voidColor);

    fxCtx.restore();
  }

  /**
   * Draws a hexagonal shape on the given context.
   */
  function drawHexagon(ctx, cx, cy, radius, opacity, color) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.fill();
  }

  // ── Reset Mechanic ─────────────────────────────────────────────────────────

  function checkAutoReset() {
    if (FractureEngine.getFractureCount() >= CONFIG.reset.autoResetAfterStrokes) {
      setTimeout(handleReset, 1400);
    }
  }

  function handleReset() {
    UIController.triggerResetFade(() => {
      FractureEngine.clearAll();
      fractureCtx.clearRect(0, 0, fractureCanvas.width, fractureCanvas.height);
      SurfaceController.redraw();
      UIController.setHelperText(0);
    });
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  init();

});
