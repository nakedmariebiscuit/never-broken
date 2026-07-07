/**
 * gold-fill-engine.js — Molten Gold Fill & Shimmer Animator
 *
 * What it does:
 *   Animates liquid gold flowing through a fracture path after the user
 *   releases the mouse. The gold fills progressively from start to end,
 *   then briefly glows and shimmers before settling into a permanent seam.
 *
 * How it works:
 *   1. When fillFracture() is called, it receives the fracture record
 *      (main path + branches) and the pressure snapshot.
 *   2. A fill animation runs: gold is drawn progressively along the path
 *      using requestAnimationFrame, revealing more of the seam each frame.
 *   3. After the fill completes, a shimmer/glow animation plays.
 *   4. The final gold seam is drawn permanently onto the fracture canvas.
 *
 * Why it exists:
 *   Separating gold animation from crack generation means you can change
 *   the gold look and feel without touching the fracture logic.
 *
 * What you can customise:
 *   - Gold colours:       CONFIG.gold.color / highlight / shadow / glowColor
 *   - Glow intensity:     CONFIG.gold.glowBlur
 *   - Fill speed:         CONFIG.gold.fillDuration
 *   - Shimmer duration:   CONFIG.gold.shimmerDuration
 */

const GoldFillEngine = (() => {

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Starts the gold fill animation for a completed fracture.
   *
   * @param {FractureRecord}           fracture    - From FractureEngine.generate()
   * @param {CanvasRenderingContext2D}  fxCtx       - FX canvas (for animation)
   * @param {CanvasRenderingContext2D}  fractureCtx - Fracture canvas (for permanent seam)
   * @param {Function}                 onComplete  - Called when animation finishes
   */
  function fillFracture(fracture, fxCtx, fractureCtx, onComplete) {
    const { mainPath, branches, pressure } = fracture;
    const cfg = pressure.crackConfig;

    // Gold seam width scales with crack width
    const goldWidth = cfg.lineWidth * 0.85;

    // Fill duration scales with pressure level
    const fillDuration = CONFIG.gold.fillDuration * (
      pressure.level === "hairline" ? 0.6 :
      pressure.level === "medium"   ? 1.0 : 1.5
    );

    const shimmerDuration = CONFIG.gold.shimmerDuration;
    const startTime = performance.now();

    // ── Phase 1: Fill animation ──────────────────────────────────────
    function animateFill(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(1, elapsed / fillDuration);

      // Easing: ease-out cubic for a natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      // Clear the FX canvas and redraw the gold fill up to `eased` progress
      fxCtx.clearRect(0, 0, fxCtx.canvas.width, fxCtx.canvas.height);
      drawGoldPath(mainPath, eased, goldWidth, pressure, fxCtx);
      branches.forEach(branch => {
        drawGoldPath(branch, eased, goldWidth * 0.6, pressure, fxCtx);
      });

      if (progress < 1) {
        requestAnimationFrame(animateFill);
      } else {
        // Fill complete — draw permanent seam on fracture canvas
        drawGoldPath(mainPath, 1, goldWidth, pressure, fractureCtx);
        branches.forEach(branch => {
          drawGoldPath(branch, 1, goldWidth * 0.6, pressure, fractureCtx);
        });

        // Start shimmer phase
        const shimmerStart = performance.now();
        requestAnimationFrame(t => animateShimmer(t, shimmerStart, shimmerDuration, mainPath, branches, goldWidth, pressure, fxCtx, onComplete));
      }
    }

    requestAnimationFrame(animateFill);
  }

  /**
   * Fills a crater with molten gold.
   *
   * @param {number}                   x           - Centre X
   * @param {number}                   y           - Centre Y
   * @param {number}                   radius      - Crater radius
   * @param {CanvasRenderingContext2D}  fxCtx       - FX canvas
   * @param {CanvasRenderingContext2D}  fractureCtx - Fracture canvas
   * @param {Function}                 onComplete
   */
  function fillCrater(x, y, radius, fxCtx, fractureCtx, onComplete) {
    const startTime    = performance.now();
    const fillDuration = CONFIG.gold.fillDuration * 2.2;

    function animateCraterFill(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(1, elapsed / fillDuration);
      const eased    = 1 - Math.pow(1 - progress, 3);

      fxCtx.clearRect(0, 0, fxCtx.canvas.width, fxCtx.canvas.height);
      drawGoldCrater(x, y, radius * eased, eased, fxCtx);

      if (progress < 1) {
        requestAnimationFrame(animateCraterFill);
      } else {
        // Permanent gold crater on fracture canvas
        drawGoldCrater(x, y, radius, 1, fractureCtx);
        fxCtx.clearRect(0, 0, fxCtx.canvas.width, fxCtx.canvas.height);
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(animateCraterFill);
  }

  // ── Private: Gold Path Drawing ────────────────────────────────────────

  /**
   * Draws the gold seam along a path up to a given progress (0–1).
   * Uses a three-layer approach for a luminous, metallic appearance:
   *   Layer 1: Wide glow bloom (blurred, semi-transparent)
   *   Layer 2: Gold body (gradient from shadow to highlight to shadow)
   *   Layer 3: Bright centre highlight
   *
   * @param {Array<{x,y}>}            path
   * @param {number}                  progress  - 0 (nothing) to 1 (full)
   * @param {number}                  width     - Seam width in pixels
   * @param {PressureSnapshot}        pressure
   * @param {CanvasRenderingContext2D} ctx
   */
  function drawGoldPath(path, progress, width, pressure, ctx) {
    if (path.length < 2) return;

    // How many points to draw based on progress
    const endIndex = Math.max(1, Math.floor(path.length * progress));
    const subPath  = path.slice(0, endIndex + 1);

    if (subPath.length < 2) return;

    // Glow intensity scales with pressure level
    const glowScale = pressure.level === "hairline" ? 0.5 :
                      pressure.level === "medium"   ? 0.8 : 1.2;

    ctx.save();

    // ── Layer 1: Outer glow bloom ──────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(subPath[0].x, subPath[0].y);
    for (let i = 1; i < subPath.length; i++) {
      ctx.lineTo(subPath[i].x, subPath[i].y);
    }
    ctx.strokeStyle = CONFIG.gold.glowColor;
    ctx.lineWidth   = width * 3.5 * glowScale;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.shadowColor = CONFIG.gold.glowColor;
    ctx.shadowBlur  = CONFIG.gold.glowBlur * glowScale;
    ctx.globalAlpha = 0.45;
    ctx.stroke();

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // ── Layer 2: Gold body ─────────────────────────────────────────
    // Build a linear gradient along the path for a metallic sheen
    const gradStart = subPath[0];
    const gradEnd   = subPath[subPath.length - 1];
    let goldGrad;

    try {
      goldGrad = ctx.createLinearGradient(gradStart.x, gradStart.y, gradEnd.x, gradEnd.y);
      goldGrad.addColorStop(0,    CONFIG.gold.shadow);
      goldGrad.addColorStop(0.3,  CONFIG.gold.color);
      goldGrad.addColorStop(0.5,  CONFIG.gold.highlight);
      goldGrad.addColorStop(0.7,  CONFIG.gold.color);
      goldGrad.addColorStop(1,    CONFIG.gold.shadow);
    } catch (e) {
      // Fallback if gradient creation fails (e.g. zero-length path)
      goldGrad = CONFIG.gold.color;
    }

    ctx.beginPath();
    ctx.moveTo(subPath[0].x, subPath[0].y);
    for (let i = 1; i < subPath.length; i++) {
      ctx.lineTo(subPath[i].x, subPath[i].y);
    }
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth   = width;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();

    // ── Layer 3: Bright centre highlight ──────────────────────────
    ctx.beginPath();
    ctx.moveTo(subPath[0].x, subPath[0].y);
    for (let i = 1; i < subPath.length; i++) {
      ctx.lineTo(subPath[i].x, subPath[i].y);
    }
    ctx.strokeStyle = "rgba(255, 245, 180, 0.55)";
    ctx.lineWidth   = width * 0.3;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draws a gold-filled hexagonal crater.
   *
   * @param {number}                   x        - Centre X
   * @param {number}                   y        - Centre Y
   * @param {number}                   radius   - Current (animated) radius
   * @param {number}                   progress - 0–1
   * @param {CanvasRenderingContext2D}  ctx
   */
  function drawGoldCrater(x, y, radius, progress, ctx) {
    if (radius <= 0) return;

    ctx.save();

    // Glow bloom (keep circular for soft glow effect)
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2);
    ctx.fillStyle   = CONFIG.gold.glowColor;
    ctx.globalAlpha = 0.35 * progress;
    ctx.shadowColor = CONFIG.gold.glowColor;
    ctx.shadowBlur  = CONFIG.gold.glowBlur * 1.5;
    ctx.fill();

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // Gold fill — hexagonal shape
    const grad = ctx.createRadialGradient(x - radius * 0.2, y - radius * 0.2, 0, x, y, radius);
    grad.addColorStop(0,   CONFIG.gold.highlight);
    grad.addColorStop(0.5, CONFIG.gold.color);
    grad.addColorStop(1,   CONFIG.gold.shadow);

    ctx.beginPath();
    drawHexPath(ctx, x, y, radius);
    ctx.fillStyle   = grad;
    ctx.globalAlpha = progress;
    ctx.fill();

    // Bright specular highlight — hexagonal
    ctx.beginPath();
    drawHexPath(ctx, x - radius * 0.25, y - radius * 0.25, radius * 0.25);
    ctx.fillStyle   = "rgba(255, 250, 200, 0.5)";
    ctx.globalAlpha = progress * 0.6;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draws a hexagonal path on the given context.
   */
  function drawHexPath(ctx, cx, cy, radius) {
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
  }

  // ── Private: Shimmer Animation ────────────────────────────────────────

  /**
   * Plays a brief shimmer/glow pulse after the gold fill completes.
   * The shimmer fades in and out, then clears the FX canvas.
   *
   * @param {number}                   now
   * @param {number}                   startTime
   * @param {number}                   duration
   * @param {Array<{x,y}>}             mainPath
   * @param {Array<Array<{x,y}>>}      branches
   * @param {number}                   goldWidth
   * @param {PressureSnapshot}         pressure
   * @param {CanvasRenderingContext2D}  fxCtx
   * @param {Function}                 onComplete
   */
  function animateShimmer(now, startTime, duration, mainPath, branches, goldWidth, pressure, fxCtx, onComplete) {
    const elapsed  = now - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Shimmer envelope: rises quickly, holds, then fades
    // 0–0.3: fade in, 0.3–0.7: hold, 0.7–1.0: fade out
    let shimmerAlpha;
    if (progress < 0.3) {
      shimmerAlpha = progress / 0.3;
    } else if (progress < 0.7) {
      shimmerAlpha = 1;
    } else {
      shimmerAlpha = 1 - (progress - 0.7) / 0.3;
    }

    // Add a gentle oscillation to the shimmer
    const oscillation = Math.sin(elapsed * 0.018) * 0.2 + 0.8;
    shimmerAlpha *= oscillation;

    fxCtx.clearRect(0, 0, fxCtx.canvas.width, fxCtx.canvas.height);

    // Draw shimmer glow on FX canvas
    fxCtx.save();
    fxCtx.globalAlpha = shimmerAlpha * 0.7;

    const glowScale = pressure.level === "hairline" ? 0.5 :
                      pressure.level === "medium"   ? 0.8 : 1.2;

    function drawShimmerPath(path, w) {
      if (path.length < 2) return;
      fxCtx.beginPath();
      fxCtx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        fxCtx.lineTo(path[i].x, path[i].y);
      }
      fxCtx.strokeStyle = CONFIG.gold.highlight;
      fxCtx.lineWidth   = w * 2.5;
      fxCtx.lineCap     = "round";
      fxCtx.lineJoin    = "round";
      fxCtx.shadowColor = CONFIG.gold.glowColor;
      fxCtx.shadowBlur  = CONFIG.gold.glowBlur * glowScale * 1.5;
      fxCtx.stroke();
    }

    drawShimmerPath(mainPath, goldWidth);
    branches.forEach(b => drawShimmerPath(b, goldWidth * 0.6));

    fxCtx.restore();

    if (progress < 1) {
      requestAnimationFrame(t => animateShimmer(t, startTime, duration, mainPath, branches, goldWidth, pressure, fxCtx, onComplete));
    } else {
      // Shimmer complete — clear FX canvas
      fxCtx.clearRect(0, 0, fxCtx.canvas.width, fxCtx.canvas.height);
      if (onComplete) onComplete();
    }
  }

  // ── Expose public methods ─────────────────────────────────────────────
  return {
    fillFracture,
    fillCrater,
  };

})();
