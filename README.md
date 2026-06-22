# Gun Game Ahh 🔫

A browser-based, **stylized 3D first-person shooter** built with [Three.js](https://threejs.org/).
Clean, high-contrast, cel-shaded look (Valorant / Marvel Rivals inspired) with a
bloom glow, a first-person controller, and hitscan shooting — all as plain
static files that deploy to Vercel with **no build step**.

## ✨ Features
- **Toon / Unlit art direction** with a procedural cel-shading ramp.
- **Bloom post-processing** for punchy, glowing accents.
- **First-person controller**: WASD + mouse look (pointer lock), sprint, jump,
  and box collision.
- **Hitscan shooting** via raycasting, with muzzle flash, recoil, impact markers,
  and reactive targets.
- **Dynamic glTF/GLB loading** from external URLs — swap in your own gun and
  character models in one place.
- **Fully modular** ES modules, organized by responsibility.

## 🎮 Controls
| Input | Action |
|------|--------|
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| `Shift` | Sprint |
| `Space` | Jump |
| Left click | Shoot |
| `Esc` | Release mouse |

## 🚀 Run locally
The import map needs files served over HTTP (not opened via `file://`). Use any
static server:

```bash
# Python
python -m http.server 8000

# or Node
npx serve .
```
Then open <http://localhost:8000>.

## ☁️ Deploy to Vercel
It's a static site — just import the repo in Vercel (no framework preset needed),
or:
```bash
npm i -g vercel
vercel
```
`vercel.json` is already included for clean URLs + same-origin model serving.

## 🗂️ Project structure
```
index.html            # Entry + Three.js import map (no bundler)
style.css             # HUD / crosshair / overlay styling
vercel.json           # Static hosting config
public/models/        # <- drop your .glb / .gltf models here
src/
  config.js           # * ALL the "look & feel" knobs (colors, lights, bloom, feel)
  materials.js        # Toon/unlit material factory + cel ramp + model restyling
  scene.js            # Renderer, camera, lighting rig, arena geometry
  postprocessing.js   # EffectComposer + UnrealBloom
  input.js            # Keyboard / mouse state
  controls.js         # First-person controller (look + move + collision)
  shooting.js         # Raycasting hitscan + feedback
  assets.js           # * glTF loader + MODEL URL swap points
  main.js             # Orchestrates everything + game loop
```

## 🎨 Dialing in the art direction
Almost everything visual is in [`src/config.js`](src/config.js):
- `materials.mode` — `'toon'` (cel bands) or `'unlit'` (flat graphic).
- `bloom.{strength,radius,threshold}` — the glow intensity/spread.
- `palette` — your color story. Keep neutrals big, accents few + saturated.
- `lights` — a key + rim rig tuned for readable toon banding.

## 🧩 Adding your own models
See [`public/models/README.md`](public/models/README.md). Short version: drop a
`.glb` in `public/models/`, then set its URL in
[`src/assets.js`](src/assets.js) → `MODELS`. Missing models fall back to
procedural placeholders, so the game always runs.

> **CORS note:** Most Sketchfab embed URLs block cross-origin fetches. Download
> the `.glb` and self-host it (e.g. in `public/models/`) for reliability.
