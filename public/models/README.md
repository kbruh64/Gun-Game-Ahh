# Models

Files in this folder are served **same-origin**, so they load with zero CORS
headaches (unlike most Sketchfab embed URLs).

## Included models (all CC0 — public domain, no attribution required)
These are wired into the game by default via `src/assets.js` → `MODELS`:

| File | What | Source (CC0) |
|------|------|--------------|
| `pistol.glb` | First-person weapon viewmodel | "Pistol" by Quaternius (poly.pizza) |
| `swat.glb` | Enemy / character ("Valorant-ish" tactical agent) | "SWAT" by Quaternius (poly.pizza) |
| `crate.glb` | Sci-fi cover prop scattered in the arena | "Sci Fi Crate" by Dipper98 (poly.pizza) |

CC0 requires no credit, but the authors are listed above out of courtesy.

## Swapping in your own (e.g. the Sketchfab aesthetic upgrades)
Sketchfab files can't be hotlinked — download the `.glb` (free account), drop it
in this folder, and point the matching `MODELS.*.url` in `src/assets.js` at it.

## How to use a model

1. Export or download a `.glb` (single-file glTF is easiest) and place it here,
   e.g. `public/models/rifle.glb`.
2. Open [`src/assets.js`](../../src/assets.js) and set the URL:

   ```js
   export const MODELS = {
     gun: {
       url: './public/models/rifle.glb',
       scale: 1,
       position: [0.35, -0.35, -0.6],
       rotation: [0, Math.PI, 0],
     },
     character: {
       url: './public/models/agent.glb',
       // ...
     },
   };
   ```
3. Reload. If a model is missing or fails to load, the game automatically falls
   back to a procedural placeholder, so it never crashes.

## Where to find free stylized models
- Sketchfab (filter by **Downloadable** + license; download the glTF/GLB).
- Quaternius, Kenney, Poly Pizza — great low-poly / stylized packs.

## Tips
- Prefer **`.glb`** (geometry + textures bundled in one file).
- Keep poly counts modest for the browser.
- The loader auto-restyles models to the game's toon/unlit look. To keep an
  asset's original materials, set `materials.restyleLoadedModels: false` in
  [`src/config.js`](../../src/config.js).
