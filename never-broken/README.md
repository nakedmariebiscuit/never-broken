# Never Broken

> *Nothing here is ruined; and still whole.*

**Never Broken** is a kintsugi-inspired interactive browser app. Click, hold, and drag across a ceramic surface to create organic fracture lines. When you release, liquid gold fills the crack. Every fracture becomes beautiful. Every scar, a seam of gold.

The app is inspired by the Japanese art of *kintsugi* — the practice of repairing broken pottery with gold lacquer, treating damage as part of an object's history rather than something to hide. It is designed as a calm, meditative, emotionally restorative experience.

---

## What the App Does

- **Click and drag** across the ceramic surface to draw fracture lines.
- **Hold longer** before dragging to create deeper, wider cracks with more branching.
- **Hold still** in one place to grow a crater — a symbolic missing piece — which then fills with gold.
- **Gold flows** through every crack when you release, glowing and shimmering before settling.
- **All gold seams persist** across the session, building an intricate layered history.
- **Surface presets** let you choose from six ceramic colours, from warm beige to blue-and-white china.
- **Sound layers** (tension hum, crack, gold fill, shimmer, ambient) can be toggled and adjusted.
- **Auto-reset** gently fades the surface to blank after a set number of strokes, starting the cycle again.

---

## How to Run Locally

No build tools, no server, no dependencies required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, or Safari).
3. That is all.

```
never-broken/
└── index.html   ← Open this file directly in your browser
```

> **Note:** Some browsers restrict the Web Audio API when opening files directly from the filesystem (`file://` protocol). If sounds do not play, serve the folder with a simple local server:
>
> ```bash
> # Python 3
> python3 -m http.server 8080
> # Then open: http://localhost:8080
> ```

---

## File and Folder Breakdown

```
never-broken/
├── index.html                  Main HTML entry point
├── README.md                   This file
├── src/
│   ├── css/
│   │   └── styles.css          All visual styles and layout
│   └── js/
│       ├── config.js           Central configuration (start here to customise)
│       ├── app.js              Main orchestrator — wires everything together
│       ├── fracture-engine.js  Generates organic crack paths and branches
│       ├── pressure-controller.js  Maps hold duration to crack intensity
│       ├── gold-fill-engine.js Animates molten gold flowing through cracks
│       ├── surface-controller.js   Renders ceramic textures and manages presets
│       ├── audio-controller.js Sound system with Web Audio API
│       └── ui-controller.js    Tutorial bar, sound panel, reset button
└── assets/
    ├── audio/                  Drop custom audio files here (see Sound section)
    ├── images/                 Optional decorative images
    └── textures/               Optional ceramic texture images
```

---

## How to Customise Visuals

All visual settings live in `src/js/config.js`. Open that file and look for the relevant section.

### Change surface colours

Find the `surfaces` array in `config.js`. Each entry is a preset:

```js
{
  id:               "my-surface",
  label:            "My Surface",
  baseColor:        "#D4C0A8",   // Main fill colour
  grainColor:       "#C0AA90",   // Grain texture colour
  crackColor:       "#6A4A28",   // Raw crack line colour
  crackShadow:      "rgba(40, 20, 5, 0.4)",
  textureIntensity: 0.4,         // 0 = flat, 1 = heavy grain
}
```

Add a new entry to the array and it will automatically appear as a swatch in the UI.

### Change the gold colour

Find the `gold` section in `config.js`:

```js
gold: {
  color:     "#D4A017",   // Core gold
  highlight: "#FFD966",   // Bright centre
  shadow:    "#A07010",   // Deep edge
  glowColor: "rgba(255, 210, 50, 0.6)",
  glowBlur:  18,          // Glow spread in pixels
}
```

### Change crack appearance

Find the `crack` section. Each pressure level (`hairline`, `medium`, `deep`) has its own settings:

```js
crack: {
  hairline: {
    lineWidth:         1.2,   // Crack thickness in pixels
    branchProbability: 0,     // 0 = no branches, 1 = branch at every segment
    branchDepth:       0,     // How many levels of sub-branches
    jitter:            3,     // Organic randomness (pixels)
    segmentLength:     8,     // Distance between crack points
  },
  // ... medium and deep follow the same structure
}
```

---

## How to Customise Sounds

### Using real audio files

1. Drop your audio files into `assets/audio/`.
2. Open `config.js` and find the `audio` section.
3. For the layer you want to replace, set `usePlaceholder: false` and update the `src` path:

```js
crack: {
  src:            "assets/audio/crack.mp3",  // ← Your file path here
  usePlaceholder: false,                      // ← Change to false
  defaultVolume:  0.6,
  defaultEnabled: true,
},
```

4. Reload the app. The real file will be used; if it fails to load, the placeholder synthesiser takes over automatically.

### Supported formats

Any format supported by the browser's Web Audio API: `.mp3`, `.ogg`, `.wav`, `.flac`, `.aac`.

### Adjusting default volumes

Change `defaultVolume` (0.0–1.0) for any layer in `config.js`. Users can also adjust volumes live in the sound panel.

### Disabling a layer by default

Set `defaultEnabled: false` for any layer in `config.js`.

---

## How to Change Pressure Sensitivity

Open `src/js/pressure-controller.js` and find the `classifyDuration()` function:

```js
function classifyDuration(durationMs) {
  if (durationMs < 300)  return "hairline";  // ← Change 300 to adjust threshold
  if (durationMs < 1000) return "medium";    // ← Change 1000 to adjust threshold
  return "deep";
}
```

- **Lower the first threshold** (e.g. `< 150`) to make hairline cracks harder to produce.
- **Raise the second threshold** (e.g. `< 2000`) to make deep cracks require a longer hold.

The tension build speed (how quickly the surface trembles) is controlled by `CONFIG.tension.buildRate` in `config.js`.

---

## How to Change Branching Behaviour

In `config.js`, find the `crack` section and adjust `branchProbability` and `branchDepth`:

| Setting | Effect |
|---|---|
| `branchProbability: 0` | No branches at all |
| `branchProbability: 0.5` | Branch at roughly half of all crack segments |
| `branchDepth: 0` | No sub-branches from branches |
| `branchDepth: 2` | Branches can have their own branches (two levels deep) |

Increase `jitter` to make cracks more jagged and organic. Decrease it for cleaner, more deliberate lines.

---

## How to Embed into Another Website

### Option 1 — iframe (simplest)

```html
<iframe
  src="path/to/never-broken/index.html"
  width="900"
  height="600"
  style="border: none; border-radius: 12px;"
  title="Never Broken — kintsugi interactive app"
></iframe>
```

### Option 2 — Direct embed (copy files into your project)

1. Copy the entire `never-broken/` folder into your project.
2. In your HTML, add the `<link>` and `<script>` tags from `index.html`.
3. Copy the `#app-container` div into your page.
4. Set the container's width and height via CSS to fit your layout.

### Option 3 — Draggable/resizable window

Wrap `#app-container` in a draggable widget library of your choice (e.g. interact.js, jQuery UI Draggable). The app container has no fixed positioning and will respond to any size you give it.

```html
<div id="my-draggable-window" style="width: 800px; height: 520px;">
  <!-- Paste the contents of index.html's #app-container here -->
</div>
```

### Sizing notes

- `#app-container` uses `min-width: 640px` and `min-height: 420px` as safe minimums.
- The canvas layers resize automatically when the container changes size (via the `resize` event listener in `app.js`).
- For iframe embeds, set the iframe dimensions to your desired size.

---

## How to Prepare for GitHub Upload

1. Ensure no sensitive data (API keys, passwords) is in any file — there are none by default.
2. All file paths in the code are relative (e.g. `src/js/config.js`, `assets/audio/crack.mp3`), so the project works from any directory.
3. The `assets/audio/` folder is included but empty. This is intentional — placeholder sounds are synthesised in-browser. You may add a `.gitkeep` file to preserve the folder:

```bash
touch assets/audio/.gitkeep
touch assets/images/.gitkeep
touch assets/textures/.gitkeep
```

4. Push the entire `never-broken/` folder to your repository.
5. To host on GitHub Pages: go to **Settings → Pages → Source → main branch → / (root)** and GitHub will serve `index.html` automatically.

---

## Browser Compatibility

| Browser | Status |
|---|---|
| Chrome 90+ | Fully supported |
| Edge 90+ | Fully supported |
| Firefox 88+ | Fully supported |
| Safari 14+ | Fully supported |

No polyfills required. The app uses only standard Canvas 2D API and Web Audio API features available in all modern browsers.

---

## Licence

This project is provided for personal and portfolio use. You are free to modify and embed it as you wish.

---

*Every fracture becomes gold.*
