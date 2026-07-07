/**
 * fracture-engine.js — Organic Fracture Path Generator
 *
 * What it does:
 *   Takes a cursor path and converts it into an organic fracture line
 *   with optional branches. Draws the raw crack onto the fracture canvas.
 *
 * Key design for branch blending:
 *   Branches do NOT render as separate lines. Instead, at each branch point,
 *   we "inflate" the main crack by widening it into a teardrop shape that
 *   extends outward along the branch direction. This makes the branch appear
 *   as if it emerged from the main crack rather than being a separate line.
 *
 *   The technique:
 *     1. Draw the main crack normally.
 *     2. At each branch junction, draw a widened taper (cone) that expands
 *        from the main crack width to the branch width over the first
 *        few segments of the branch path. This cone is filled (not stroked)
 *        so it creates a seamless colour bridge between main crack and branch.
 *     3. Draw the branch as a very thin stroke from the cone's narrow end
 *        outward, with fading opacity.
 */

const FractureEngine = (() => {

  let _fractures = [];

  // ── Public API ────────────────────────────────────────────────────────

  function generate(cursorPath, pressure, ctx, surface) {
    const cfg = pressure.crackConfig;

    // Step 1: Smooth the raw cursor path
    const smoothed = smoothPath(cursorPath, 3);

    // Step 2: Resample into equal-length segments
    const resampled = resamplePath(smoothed, cfg.segmentLength);

    // Step 3: Apply organic jitter (reduced for smoother cracks)
    const mainPath = jitterPath(resampled, cfg.jitter);

    // Step 4: Generate branch cracks
    const branches = generateBranches(mainPath, cfg, 0);

    // Step 5: Draw the complete crack with blended branches
    drawCrack(mainPath, branches, pressure, ctx, surface);

    // Step 6: Store the record
    const record = { mainPath, branches, pressure };
    _fractures.push(record);

    return record;
  }

  function drawCrater(x, y, radius, ctx, surface) {
    const cfg = CONFIG.crater;

    ctx.save();

    // Outer rim
    const rimGrad = ctx.createRadialGradient(x, y, radius * 0.6, x, y, radius);
    rimGrad.addColorStop(0, cfg.voidColor);
    rimGrad.addColorStop(0.7, cfg.rimColor);
    rimGrad.addColorStop(1, surface.crackColor);

    // Draw hexagonal shape instead of circle
    drawHexagon(ctx, x, y, radius, rimGrad, true);

    // Dark void centre
    const voidGrad = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.65);
    voidGrad.addColorStop(0, cfg.voidColor);
    voidGrad.addColorStop(1, "rgba(0,0,0,0)");

    drawHexagon(ctx, x, y, radius * 0.65, voidGrad, true);

    // Crack lines radiating from the crater
    const numRays = 5 + Math.floor(radius / 10);
    for (let i = 0; i < numRays; i++) {
      const angle  = (i / numRays) * Math.PI * 2 + Math.random() * 0.4;
      const length = radius * (1.2 + Math.random() * 0.8);
      const rayPath = buildRay(x, y, angle, length, 4);
      drawSingleCrack(rayPath, surface.crackColor, surface.crackShadow, 1.5, ctx);
    }

    ctx.restore();
  }

  function redrawAll(ctx, surface) {
    _fractures.forEach(record => {
      drawCrack(record.mainPath, record.branches, record.pressure, ctx, surface);
    });
  }

  function clearAll() {
    _fractures = [];
  }

  function getFractureCount() {
    return _fractures.length;
  }

  // ── Private: Path Manipulation ────────────────────────────────────────

  function smoothPath(path, windowSize) {
    if (path.length < 2) return path;
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

  function resamplePath(path, targetSpacing) {
    if (path.length < 2) return path;

    const result = [path[0]];
    let accumulated = 0;

    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      accumulated += segLen;

      while (accumulated >= targetSpacing) {
        accumulated -= targetSpacing;
        const t = 1 - accumulated / segLen;
        result.push({ x: prev.x + dx * t, y: prev.y + dy * t });
      }
    }

    const last = path[path.length - 1];
    const prev = result[result.length - 1];
    if (Math.abs(last.x - prev.x) > 0.5 || Math.abs(last.y - prev.y) > 0.5) {
      result.push(last);
    }

    return result;
  }

  function jitterPath(path, maxJitter) {
    if (path.length < 2) return path;

    return path.map((pt, i) => {
      const prev = path[Math.max(0, i - 1)];
      const next = path[Math.min(path.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      const nx = -dy / len;
      const ny =  dx / len;

      // Reduced jitter for smoother cracks
      const offset = (Math.random() - 0.5) * maxJitter * 0.6;

      return {
        x: pt.x + nx * offset,
        y: pt.y + ny * offset,
      };
    });
  }

  // ── Private: Branch Generation ────────────────────────────────────────

  function generateBranches(parentPath, cfg, depth) {
    if (depth >= cfg.branchDepth || cfg.branchProbability <= 0) return [];

    const branches = [];

    const start = Math.floor(parentPath.length * 0.25);
    const end   = Math.floor(parentPath.length * 0.75);

    for (let i = start; i < end; i++) {
      if (Math.random() > cfg.branchProbability) continue;

      const prev = parentPath[Math.max(0, i - 1)];
      const curr = parentPath[i];
      const next = parentPath[Math.min(parentPath.length - 1, i + 1)];

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      // Branch angle: narrower range
      const branchAngle = (0.4 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1);
      const cos = Math.cos(branchAngle);
      const sin = Math.sin(branchAngle);

      const bDx = (dx / len) * cos - (dy / len) * sin;
      const bDy = (dx / len) * sin + (dy / len) * cos;

      const branchLength = parentPath.length * cfg.segmentLength * (0.15 + Math.random() * 0.2);
      const numSteps     = Math.max(3, Math.floor(branchLength / cfg.segmentLength));

      const branchPath = [{ x: curr.x, y: curr.y }];
      let bx = curr.x, by = curr.y;

      for (let s = 0; s < numSteps; s++) {
        const taper = 1 - s / numSteps;
        const jx = (Math.random() - 0.5) * cfg.jitter * taper * 0.6;
        const jy = (Math.random() - 0.5) * cfg.jitter * taper * 0.6;
        bx += bDx * cfg.segmentLength + jx;
        by += bDy * cfg.segmentLength + jy;
        branchPath.push({ x: bx, y: by });
      }

      branches.push(branchPath);
    }

    return branches;
  }

  // ── Private: Drawing ──────────────────────────────────────────────────

  /**
   * Draws the complete crack with seamlessly blended branches.
   *
   * The key technique is the "teardrop taper": at each branch junction,
   * we draw a filled shape that widens from the main crack width to the
   * branch width, creating a smooth colour bridge. This is drawn BEFORE
   * the branch stroke, so the branch appears to emerge from the main crack.
   */
  function drawCrack(mainPath, branches, pressure, ctx, surface) {
    const cfg = pressure.crackConfig;
    const mainWidth = cfg.lineWidth;
    const branchWidth = cfg.lineWidth * 0.35;

    ctx.save();

    // Pass 1: Draw shadow layers
    drawShadowLayer(mainPath, branches, mainWidth, branchWidth, ctx, surface);

    // Pass 2: Draw the main crack
    drawSingleCrack(mainPath, surface.crackColor, 1, mainWidth, ctx);

    // Pass 3: Draw branches with teardrop taper blending
    branches.forEach(branch => {
      drawBlendedBranch(branch, mainWidth, branchWidth, surface.crackColor, surface.crackShadow, ctx);
    });

    ctx.restore();
  }

  /**
   * Draws a branch that blends seamlessly into the main crack.
   *
   * Technique:
   *   1. Draw a filled teardrop/cone shape at the junction that widens
   *      from the main crack width to the branch width over the first
   *      few segments. This creates a seamless colour bridge.
   *   2. Draw the rest of the branch as a thin stroke with gradually
   *      increasing opacity.
   */
  function drawBlendedBranch(branch, mainWidth, branchWidth, color, shadowColor, ctx) {
    if (branch.length < 2) return;

    // Calculate the perpendicular direction at the junction point
    // We need the main crack direction to determine which side the branch is on
    const p0 = branch[0];
    const p1 = branch[1];
    const p2 = branch.length > 2 ? branch[2] : p1;

    // Direction of the branch leaving the main crack
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const bLen = Math.sqrt(dx * dx + dy * dy) || 1;
    const bx = dx / bLen;
    const by = dy / bLen;

    // Perpendicular to the branch direction
    const px = -by;
    const py = bx;

    // ── Teardrop taper: the transition zone ──
    // This is a filled polygon that bridges the main crack width to the branch width.
    // It widens smoothly over the first few points.
    const taperSegments = Math.min(6, branch.length - 1);

    ctx.save();

    // Draw the taper as a filled shape with the branch colour
    // This creates the "cone" that widens from the main crack
    ctx.beginPath();

    // Build the left edge of the taper (from main crack width to branch width)
    for (let i = 0; i < taperSegments; i++) {
      const t = i / Math.max(1, taperSegments - 1);
      // Width smoothly transitions from mainWidth to branchWidth
      const halfW = mainWidth * 0.5 * (1 - t) + branchWidth * 0.5 * t;
      // Also account for slight widening to match the branch body
      const adjustedHalfW = halfW + (branchWidth * 0.5 - halfW) * Math.pow(t, 1.5);

      const pt = branch[i];
      const px1 = pt.x + px * adjustedHalfW;
      const py1 = pt.y + py * adjustedHalfW;

      if (i === 0) {
        ctx.moveTo(px1, py1);
      } else {
        ctx.lineTo(px1, py1);
      }
    }

    // Connect to the right edge
    for (let i = taperSegments - 1; i >= 0; i--) {
      const t = i / Math.max(1, taperSegments - 1);
      const halfW = mainWidth * 0.5 * (1 - t) + branchWidth * 0.5 * t;
      const adjustedHalfW = halfW + (branchWidth * 0.5 - halfW) * Math.pow(t, 1.5);

      const pt = branch[i];
      const px2 = pt.x - px * adjustedHalfW;
      const py2 = pt.y - py * adjustedHalfW;

      ctx.lineTo(px2, py2);
    }

    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Draw shadow for the taper
    ctx.beginPath();
    const shadowOffset = 0.5;
    for (let i = 0; i < taperSegments; i++) {
      const t = i / Math.max(1, taperSegments - 1);
      const halfW = mainWidth * 0.5 * (1 - t) + branchWidth * 0.5 * t;
      const adjustedHalfW = halfW + (branchWidth * 0.5 - halfW) * Math.pow(t, 1.5);

      const pt = branch[i];
      const px1 = pt.x + px * adjustedHalfW + shadowOffset;
      const py1 = pt.y + py * adjustedHalfW + shadowOffset;

      if (i === 0) {
        ctx.moveTo(px1, py1);
      } else {
        ctx.lineTo(px1, py1);
      }
    }
    for (let i = taperSegments - 1; i >= 0; i--) {
      const t = i / Math.max(1, taperSegments - 1);
      const halfW = mainWidth * 0.5 * (1 - t) + branchWidth * 0.5 * t;
      const adjustedHalfW = halfW + (branchWidth * 0.5 - halfW) * Math.pow(t, 1.5);

      const pt = branch[i];
      const px2 = pt.x - px * adjustedHalfW + shadowOffset;
      const py2 = pt.y - py * adjustedHalfW + shadowOffset;

      ctx.lineTo(px2, py2);
    }
    ctx.closePath();
    ctx.fillStyle = shadowColor;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── The branch body: draw as individual segments with gradient opacity ──
    for (let i = taperSegments; i < branch.length - 1; i++) {
      const pt = branch[i];
      const next = branch[i + 1];

      // Progress along the branch (0 at junction, 1 at tip)
      const progress = i / Math.max(1, branch.length - 1);

      // Width tapers slightly toward the end
      const segWidth = branchWidth * (1 - progress * 0.4);

      // Opacity fades in near the junction, then stays steady
      const opacity = 0.5 + 0.3 * Math.min(1, (i - taperSegments) / 3);

      // Shadow pass
      ctx.beginPath();
      ctx.moveTo(pt.x + 0.5, pt.y + 0.5);
      ctx.lineTo(next.x + 0.5, next.y + 0.5);
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = segWidth + 1;
      ctx.lineCap = "round";
      ctx.globalAlpha = opacity * 0.45;
      ctx.stroke();

      // Colour pass
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(next.x, next.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = segWidth;
      ctx.lineCap = "round";
      ctx.globalAlpha = opacity * 0.7;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draws the shadow layer for the main crack and all branches.
   */
  function drawShadowLayer(mainPath, branches, mainWidth, branchWidth, ctx, surface) {
    // Main crack shadow
    drawShadowPass(mainPath, mainWidth, surface.crackShadow, ctx);

    // Branch shadows
    branches.forEach(branch => {
      for (let i = 0; i < branch.length - 1; i++) {
        const progress = i / Math.max(1, branch.length - 1);
        const segWidth = branchWidth * (1 - progress * 0.4);
        drawShadowPassSegment(branch[i], branch[i + 1], segWidth, surface.crackShadow, ctx);
      }
    });
  }

  function drawShadowPass(path, lineWidth, shadowColor, ctx) {
    if (path.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(path[0].x + 0.5, path[0].y + 0.5);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x + 0.5, path[i].y + 0.5);
    }
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = lineWidth + 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawShadowPassSegment(from, to, lineWidth, shadowColor, ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(from.x + 0.5, from.y + 0.5);
    ctx.lineTo(to.x + 0.5, to.y + 0.5);
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = lineWidth + 1;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws a single crack path.
   */
  function drawSingleCrack(path, color, opacity, lineWidth, ctx) {
    if (path.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth   = lineWidth;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.globalAlpha = opacity;
    ctx.stroke();
  }

  /**
   * Draws a hexagonal shape.
   */
  function drawHexagon(ctx, cx, cy, radius, fillStyle, isGradient) {
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
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function buildRay(x, y, angle, length, jitter) {
    const path = [{ x, y }];
    const steps = Math.max(3, Math.floor(length / 8));
    const stepLen = length / steps;
    let cx = x, cy = y;
    let currentAngle = angle;

    for (let i = 0; i < steps; i++) {
      currentAngle += (Math.random() - 0.5) * 0.3;
      cx += Math.cos(currentAngle) * stepLen + (Math.random() - 0.5) * jitter;
      cy += Math.sin(currentAngle) * stepLen + (Math.random() - 0.5) * jitter;
      path.push({ x: cx, y: cy });
    }

    return path;
  }

  // ── Expose ────────────────────────────────────────────────────────────
  return {
    generate,
    drawCrater,
    redrawAll,
    clearAll,
    getFractureCount,
  };

})();
