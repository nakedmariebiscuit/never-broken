/**
 * config.js — Central Configuration for "Never Broken"
 *
 * This file is the single source of truth for all visual, behavioural,
 * and audio settings in the app. If you want to tweak how the app looks
 * or feels, start here.
 *
 * How to use:
 *   - Change a value in this file and save.
 *   - Reload the app in your browser to see the effect.
 *   - No other files need to be touched for most visual/audio changes.
 */

const CONFIG = {

  // ─────────────────────────────────────────────────────────────────────────
  // SURFACE PRESETS
  // Each preset defines a ceramic surface. Add new entries here to expand
  // the surface selector without touching any other file.
  //
  // Changes made:
  //   - Brown surfaces darkened for better crack visibility
  //   - All six surfaces including Blue & White China retained
  //   - crackColor on brown surfaces darkened for stronger contrast
  // ─────────────────────────────────────────────────────────────────────────
  surfaces: [
    {
      id: "warm-beige",
      label: "Warm Beige",
      // Base fill colour of the ceramic surface
      baseColor: "#E5D4B8",
      // Subtle secondary colour used for ceramic texture grain
      grainColor: "#D0BF9E",
      // Colour of the raw crack line before gold fills it
      crackColor: "#7A5B30",
      // Very faint shadow/depth colour inside the crack
      crackShadow: "rgba(50, 30, 10, 0.5)",
      // Texture noise intensity (0 = flat, 1 = heavy grain)
      textureIntensity: 0.4,
    },
    {
      id: "soft-tan",
      label: "Soft Tan",
      baseColor: "#C09E76",
      grainColor: "#AC8A60",
      crackColor: "#5A3818",
      crackShadow: "rgba(40, 20, 5, 0.55)",
      textureIntensity: 0.45,
    },
    {
      id: "medium-clay",
      label: "Medium Clay",
      baseColor: "#9A6E4A",
      grainColor: "#885C38",
      crackColor: "#442410",
      crackShadow: "rgba(25, 12, 3, 0.6)",
      textureIntensity: 0.5,
    },
    {
      id: "deep-brown",
      label: "Deep Brown",
      baseColor: "#6B4420",
      grainColor: "#5A3515",
      crackColor: "#2E1405",
      crackShadow: "rgba(15, 6, 0, 0.65)",
      textureIntensity: 0.55,
    },
    {
      id: "rich-dark-brown",
      label: "Rich Dark Brown",
      baseColor: "#3E220C",
      grainColor: "#2E1808",
      crackColor: "#140800",
      crackShadow: "rgba(8, 3, 0, 0.7)",
      textureIntensity: 0.6,
    },
    {
      id: "blue-white-china",
      label: "Blue & White China",
      baseColor: "#EEF3F9",
      grainColor: "#D8E4F0",
      crackColor: "#3A5F8A",
      crackShadow: "rgba(30, 50, 90, 0.35)",
      textureIntensity: 0.28,
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // GOLD FILL SETTINGS
  // Controls how the molten gold looks and animates.
  // ─────────────────────────────────────────────────────────────────────────
  gold: {
    // Core gold colour
    color: "#D4A017",
    // Bright highlight at the centre of the seam
    highlight: "#FFD966",
    // Deep shadow at the edges of the seam
    shadow: "#A07010",
    // Glow colour (used for the luminous bloom effect)
    glowColor: "rgba(255, 210, 50, 0.6)",
    // How wide the glow spreads (in pixels)
    glowBlur: 18,
    // Duration of the shimmer/chime animation (milliseconds)
    // Kept for visual shimmer, but sound is disabled below
    shimmerDuration: 1200,
    // Duration of the gold fill flowing animation (milliseconds)
    fillDuration: 600,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRACK / FRACTURE SETTINGS
  // Controls the visual properties of cracks at each pressure level.
  //
  // Changes made:
  //   - Branch probability reduced significantly
  //   - Branches are thinner (0.35× main instead of 0.55×)
  //   - Fewer branches overall
  // ─────────────────────────────────────────────────────────────────────────
  crack: {
    // Hairline crack (short tap, 0–300ms)
    hairline: {
      lineWidth: 1.2,
      branchProbability: 0,    // 0 = no branching
      branchDepth: 0,
      jitter: 3,               // pixels of organic randomness per segment
      segmentLength: 8,        // length of each crack segment (pixels)
    },
    // Medium crack (300ms–1s)
    medium: {
      lineWidth: 2.5,
      branchProbability: 0.06, // reduced from 0.18 — far fewer branches
      branchDepth: 1,
      jitter: 5,
      segmentLength: 10,
    },
    // Deep crack (1s+)
    deep: {
      lineWidth: 4.5,
      branchProbability: 0.10, // reduced from 0.32 — fewer branches
      branchDepth: 1,
      jitter: 8,
      segmentLength: 12,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRATER / HOLE SETTINGS
  // When the user holds still for a long time, a crater forms.
  //
  // Changes made:
  //   - triggerDuration reduced from 2000ms to 700ms for faster feedback
  //   - growthRate increased so the crater grows noticeably
  // ─────────────────────────────────────────────────────────────────────────
  crater: {
    // How long (ms) the user must hold still before a crater begins forming
    // Reduced from 2000 to 700 for snappier feedback
    triggerDuration: 700,
    // Maximum radius of the crater (pixels)
    maxRadius: 45,
    // How quickly the crater grows (pixels per ms) — increased for visibility
    growthRate: 0.025,
    // Colour of the crater void
    voidColor: "#1A0F05",
    // Colour of the crater rim
    rimColor: "#3D2810",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TENSION / HOLD VISUALS
  // Subtle effects that build while the user is holding the mouse button.
  // ─────────────────────────────────────────────────────────────────────────
  tension: {
    // Amplitude of the surface tremble (pixels)
    trembleAmplitude: 1.5,
    // Speed of the tremble oscillation (Hz)
    trembleFrequency: 12,
    // Opacity of faint stress lines that appear under the surface
    stressLineOpacity: 0.12,
    // How quickly tension builds (0–1 scale per ms)
    buildRate: 0.0008,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RESET MECHANIC
  // ─────────────────────────────────────────────────────────────────────────
  reset: {
    // Number of completed fracture strokes before an auto-reset is triggered
    autoResetAfterStrokes: 40,
    // Duration of the fade-out/fade-in transition (milliseconds)
    fadeDuration: 1800,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUDIO SETTINGS
  // Sound file paths and volume defaults.
  // To replace a placeholder with a real audio file:
  //   1. Drop the file into assets/audio/
  //   2. Update the `src` path below.
  //   3. Set `usePlaceholder` to false.
  //
  // Changes made:
  //   - goldFill removed (not wanted)
  //   - shimmer removed (not wanted)
  //   - tension and crack remain
  //   - ambient remains
  // ─────────────────────────────────────────────────────────────────────────
  audio: {
    tension: {
      // Sound that plays while the user is holding the mouse button
      src: "assets/audio/tension.mp3",   // ← SWAP: replace with your file path
      usePlaceholder: true,
      defaultVolume: 0.4,
      defaultEnabled: true,
    },
    crack: {
      // Sound that plays when the crack forms
      src: "assets/audio/crack.mp3",     // ← SWAP: replace with your file path
      usePlaceholder: true,
      defaultVolume: 0.6,
      defaultEnabled: true,
    },
    ambient: {
      // Looping background ambient sound
      src: "assets/audio/ambient.mp3",   // ← SWAP: replace with your file path
      usePlaceholder: true,
      defaultVolume: 0.25,
      defaultEnabled: true,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UI / TYPOGRAPHY
  //
  // Changes made:
  //   - tutorialText updated to "Never broken. Always whole."
  //   - helperTexts consolidated into one line
  // ─────────────────────────────────────────────────────────────────────────
  ui: {
    fontFamily: "'Calibri Light', 'Gill Sans', 'Optima', sans-serif",
    tutorialText: "Never broken. Always whole.",
    helperTexts: [
      "Hold, drag, and release. Every fracture becomes gold.",
    ],
    // Colour of the translucent tutorial bar background
    tutorialBg: "rgba(180, 210, 230, 0.22)",
    tutorialTextColor: "#3A3028",
    controlPanelBg: "rgba(255, 252, 248, 0.88)",
  },

};

// Make CONFIG available to all other modules
// (This file is loaded first via a <script> tag in index.html)
