/**
 * surface-controller.js — Ceramic Surface Renderer & Preset Manager
 *
 * What it does:
 *   Renders the ceramic surface texture onto the surface canvas.
 *   Manages which surface preset is currently active.
 *   Generates the surface selector swatches in the UI.
 *
 * How it works:
 *   Each surface preset has a specific texture algorithm:
 *     - Earth-tone surfaces (Beige, Tan, Clay, Deep Brown, Rich Dark Brown):
 *       Procedural grain with fine speckles, clay streaks, and a warm vignette.
 *     - Blue & White China:
 *       White porcelain base with procedural blue floral/vine patterns,
 *       glaze speckles, and a glossy ceramic finish.
 *
 * Why it exists:
 *   Keeping surface rendering separate means you can add new texture
 *   algorithms without touching the interaction or gold fill code.
 */

const SurfaceController = (() => {

  let _activeSurfaceIndex = 0;
  let _ctx = null;

  // ── Public API ────────────────────────────────────────────────────────

  function init(ctx) {
    _ctx = ctx;
    buildSwatches();
    drawSurface();
  }

  function setSurface(index) {
    _activeSurfaceIndex = Math.max(0, Math.min(index, CONFIG.surfaces.length - 1));
    document.querySelectorAll(".surface-swatch").forEach((el, i) => {
      el.classList.toggle("active", i === _activeSurfaceIndex);
    });
    drawSurface();
  }

  function getActiveSurface() {
    return CONFIG.surfaces[_activeSurfaceIndex];
  }

  function redraw() {
    drawSurface();
  }

  // ── Private: Surface Drawing ──────────────────────────────────────────

  function drawSurface() {
    if (!_ctx) return;

    const canvas  = _ctx.canvas;
    const w       = canvas.width;
    const h       = canvas.height;
    const surface = getActiveSurface();

    _ctx.clearRect(0, 0, w, h);

    // Layer 1: Base colour fill
    _ctx.fillStyle = surface.baseColor;
    _ctx.fillRect(0, 0, w, h);

    // Layer 2: Surface-specific texture
    if (surface.id === "blue-white-china") {
      drawChinaTexture(_ctx, w, h, surface);
    } else {
      drawEarthenTexture(_ctx, w, h, surface);
    }

    // Layer 3: Vignette
    drawVignette(_ctx, w, h, surface);
  }

  // ── Private: Earth-Tone Ceramic Textures ──────────────────────────────

  /**
   * Draws a realistic earthen ceramic texture with grain, clay streaks,
   * and a warm glaze finish.
   */
  function drawEarthenTexture(ctx, w, h, surface) {
    // Parse the hex colours for the grain system
    const baseRGB = hexToRGB(surface.baseColor);
    const grainRGB = hexToRGB(surface.grainColor);

    // Subtle noise/grain layer — ceramic particles
    const numDots = Math.floor(w * h * surface.textureIntensity * 0.015);

    ctx.save();
    for (let i = 0; i < numDots; i++) {
      const x    = Math.random() * w;
      const y    = Math.random() * h;
      const size = 0.4 + Math.random() * 2.0;

      const isLight = Math.random() > 0.5;
      ctx.fillStyle = isLight
        ? `rgba(${baseRGB.r + 30}, ${baseRGB.g + 25}, ${baseRGB.b + 15}, ${0.06 + Math.random() * 0.09})`
        : `rgba(${grainRGB.r - 20}, ${grainRGB.g - 20}, ${grainRGB.b - 15}, ${0.04 + Math.random() * 0.07})`;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add occasional small white speckles (glaze imperfections)
    const numSpeckles = Math.floor(w * h * 0.0008);
    for (let i = 0; i < numSpeckles; i++) {
      const x    = Math.random() * w;
      const y    = Math.random() * h;
      const size = 0.3 + Math.random() * 1.2;
      ctx.fillStyle = `rgba(255, 250, 240, ${0.06 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle horizontal clay streaks (kiln layering effect)
    const numStreaks = Math.floor(h / 22);
    for (let i = 0; i < numStreaks; i++) {
      const y       = Math.random() * h;
      const opacity = 0.01 + Math.random() * 0.03;
      const grad    = ctx.createLinearGradient(0, y, w, y);
      grad.addColorStop(0,   "rgba(0,0,0,0)");
      grad.addColorStop(0.2 + Math.random() * 0.3, `rgba(${baseRGB.r + 20}, ${baseRGB.g + 15}, ${baseRGB.b + 10}, ${opacity})`);
      grad.addColorStop(0.5, `rgba(${grainRGB.r}, ${grainRGB.g}, ${grainRGB.b}, ${opacity * 0.7})`);
      grad.addColorStop(1,   "rgba(0,0,0,0)");

      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 0.5, w, 1 + Math.random() * 2);
    }

    // Very faint glaze sheen — a few broad soft highlights
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 3; i++) {
      const x  = Math.random() * w * 0.6 + w * 0.1;
      const y  = Math.random() * h * 0.6 + h * 0.1;
      const r  = w * 0.15 + Math.random() * w * 0.1;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.5)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ── Private: Blue & White China Texture ───────────────────────────────

  /**
   * Draws a Blue & White China (porcelain) texture with:
   *   - White porcelain base
   *   - Procedural blue floral/vine patterns in the corners and edges
   *   - Blue speckles (cobalt pigment bleeding through glaze)
   *   - A subtle glaze gloss effect
   *
   * This mimics traditional Chinese blue-and-white porcelain with its
   * characteristic cobalt-blue patterns on a white ground.
   */
  function drawChinaTexture(ctx, w, h, surface) {
    // Parse colours
    const baseRGB = hexToRGB(surface.baseColor);

    // ── 1. Blue speckles — cobalt pigment spots ──
    ctx.save();
    const numSpeckles = Math.floor(w * h * 0.0006);
    for (let i = 0; i < numSpeckles; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 0.3 + Math.random() * 2.0;
      ctx.fillStyle = `rgba(60, 90, 160, ${0.04 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 2. Subtle white glaze imperfections (pinholes) ──
    const numPinholes = Math.floor(w * h * 0.0006);
    for (let i = 0; i < numPinholes; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const size = 0.3 + Math.random() * 1.0;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 3. Floral/vine patterns — decorative Chinese-style motifs ──
    // Draw delicate vine/branch patterns radiating from corners
    drawChinaFloral(ctx, w, h);

    // ── 4. Glaze gloss — broad soft highlights for porcelain shine ──
    ctx.globalAlpha = 0.05;
    // Large highlight in upper-left area (like light reflecting off porcelain)
    const hlGrad = ctx.createRadialGradient(w * 0.3, h * 0.25, 0, w * 0.3, h * 0.25, w * 0.25);
    hlGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    hlGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.3)");
    hlGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hlGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /**
   * Draws delicate blue floral and vine patterns in the corners
   * to mimic traditional Chinese porcelain decoration.
   */
  function drawChinaFloral(ctx, w, h) {
    const patternAlpha = 0.18;
    ctx.save();
    ctx.globalAlpha = patternAlpha;
    ctx.strokeStyle = "#4A7AB5";
    ctx.lineWidth = 0.8;
    ctx.lineCap = "round";

    // Draw decorative corner motifs (simplified floral/vine patterns)
    drawCornerMotif(ctx, w, h, "top-left");
    drawCornerMotif(ctx, w, h, "top-right");
    drawCornerMotif(ctx, w, h, "bottom-left");
    drawCornerMotif(ctx, w, h, "bottom-right");

    // Draw a few scattered small flower clusters
    const numFlowers = Math.floor(w * h / 45000);
    for (let i = 0; i < numFlowers; i++) {
      const x = 80 + Math.random() * (w - 160);
      const y = 80 + Math.random() * (h - 160);
      const size = 4 + Math.random() * 6;
      drawSmallFlower(ctx, x, y, size);
    }

    // Draw a couple of delicate vine tendrils across the surface
    ctx.globalAlpha = patternAlpha * 0.5;
    for (let i = 0; i < 2; i++) {
      const startY = Math.random() * h;
      drawVineTendril(ctx, 0, startY, w, startY + (Math.random() - 0.5) * 100);
    }

    ctx.restore();
  }

  /**
   * Draws a corner floral motif — a small cluster of leaves and petals.
   */
  function drawCornerMotif(ctx, w, h, corner) {
    let originX, originY, scaleX, scaleY;

    switch (corner) {
      case "top-left":
        originX = w * 0.12; originY = h * 0.1;
        scaleX = 1; scaleY = 1;
        break;
      case "top-right":
        originX = w * 0.88; originY = h * 0.1;
        scaleX = -1; scaleY = 1;
        break;
      case "bottom-left":
        originX = w * 0.12; originY = h * 0.9;
        scaleX = 1; scaleY = -1;
        break;
      case "bottom-right":
        originX = w * 0.88; originY = h * 0.9;
        scaleX = -1; scaleY = -1;
        break;
    }

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scaleX, scaleY);

    // Central stem
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(15, -20, 35, -10);
    ctx.stroke();

    // Small leaves along the stem
    for (let j = 0; j < 3; j++) {
      const t = (j + 1) / 4;
      const lx = t * 30;
      const ly = Math.sin(t * Math.PI) * -12;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 8, 3, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Small flower at the end
    drawSmallFlower(ctx, 35, -10, 5);

    // A curling tendril
    ctx.beginPath();
    ctx.moveTo(20, -5);
    ctx.bezierCurveTo(25, -25, 10, -35, 5, -28);
    ctx.stroke();

    // Small decorative dots (cobalt pigment marks)
    for (let k = 0; k < 4; k++) {
      const dx = 2 + Math.random() * 30;
      const dy = 5 + Math.random() * 15;
      ctx.beginPath();
      ctx.arc(dx, dy, 1 + Math.random(), 0, Math.PI * 2);
      ctx.fillStyle = "#4A7AB5";
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.globalAlpha = 0.12;
    }

    ctx.restore();
  }

  /**
   * Draws a small decorative flower (chrysanthemum-style with simple petals).
   */
  function drawSmallFlower(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);

    // 5 petals
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(size * 0.5, 0, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#4A7AB5";
    ctx.globalAlpha = 0.2;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draws a delicate vine tendril with small leaves.
   */
  function drawVineTendril(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 60;

    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    // Small leaves along the vine
    const numLeaves = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numLeaves; i++) {
      const t = (i + 1) / (numLeaves + 1);
      const lx = x1 + (x2 - x1) * t;
      const ly = y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * (midY - (y1 + y2) / 2);
      ctx.beginPath();
      ctx.ellipse(lx, ly - 4, 6, 2, Math.PI * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── Private: Vignette (shared) ──────────────────────────────────────

  function drawVignette(ctx, w, h, surface) {
    const cx = w / 2;
    const cy = h / 2;
    const r  = Math.sqrt(cx * cx + cy * cy) * 1.1;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    grad.addColorStop(0,   "rgba(0,0,0,0)");
    grad.addColorStop(0.7, "rgba(0,0,0,0)");
    grad.addColorStop(1,   surface.id === "blue-white-china" ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.18)");

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ── Private: Utility ──────────────────────────────────────────────────

  /**
   * Converts a hex colour string to an RGB object.
   */
  function hexToRGB(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 128, g: 128, b: 128 };
  }

  // ── Private: UI Swatches ──────────────────────────────────────────────

  function buildSwatches() {
    const container = document.getElementById("surface-swatches");
    if (!container) return;

    container.innerHTML = "";

    CONFIG.surfaces.forEach((surface, index) => {
      const btn = document.createElement("button");
      btn.className    = "surface-swatch" + (index === _activeSurfaceIndex ? " active" : "");
      btn.style.background = surface.baseColor;
      btn.dataset.label    = surface.label;
      btn.dataset.index    = index;
      btn.setAttribute("aria-label", `Select ${surface.label} surface`);
      btn.setAttribute("title", surface.label);

      btn.addEventListener("click", () => {
        setSurface(index);
        document.dispatchEvent(new CustomEvent("surfaceChanged", { detail: { index } }));
      });

      container.appendChild(btn);
    });
  }

  // ── Expose ────────────────────────────────────────────────────────────
  return {
    init,
    setSurface,
    getActiveSurface,
    redraw,
  };

})();
