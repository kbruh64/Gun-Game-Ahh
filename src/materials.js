/**
 * materials.js
 * -----------------------------------------------------------------------------
 * Stylized material helpers. This is where the cel-shaded / unlit "art style"
 * is actually produced. The environment and (optionally) loaded glTF models all
 * get their surfaces created or re-skinned through here so the whole game shares
 * one consistent look defined in config.js.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

/**
 * Build a tiny 1D gradient texture used as the toon "ramp". MeshToonMaterial
 * samples this to decide how many light bands to draw. Fewer steps = chunkier,
 * more obviously cel-shaded. We bake it procedurally so there are no asset deps.
 *
 * TO ADJUST THE LOOK: change CONFIG.materials.toonSteps. You can also bias the
 * values here (e.g. make the dark band darker) for a more dramatic contrast.
 */
export function createToonGradient(steps = CONFIG.materials.toonSteps) {
  const colors = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    // Spread brightness evenly across the bands, 0..255.
    colors[i] = Math.round((i / (steps - 1)) * 255);
  }
  const texture = new THREE.DataTexture(colors, steps, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter; // hard edges between bands (no blur)
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// Cache the ramp so every material reuses the same GPU texture.
let _gradient = null;
function getGradient() {
  if (!_gradient) _gradient = createToonGradient();
  return _gradient;
}

/**
 * Create a stylized material. Honors CONFIG.materials.mode:
 *   'toon'  -> MeshToonMaterial (responds to lights with stepped bands)
 *   'unlit' -> MeshBasicMaterial (flat color, ignores lights entirely)
 *
 * @param {object} opts
 * @param {number} opts.color        base color (hex)
 * @param {number} [opts.emissive]   emissive color (hex) — this is what blooms
 * @param {number} [opts.emissiveIntensity]
 * @param {boolean}[opts.flatShading] hard faceted look (great for stylized rocks)
 */
export function makeStylizedMaterial({
  color = 0xffffff,
  emissive = 0x000000,
  emissiveIntensity = 1.0,
  flatShading = false,
} = {}) {
  if (CONFIG.materials.mode === 'unlit') {
    // Unlit can't emit/receive light, so we fold any emissive glow straight
    // into the base color so bloom still has something bright to grab.
    const c = new THREE.Color(color);
    if (emissive) c.add(new THREE.Color(emissive).multiplyScalar(emissiveIntensity));
    return new THREE.MeshBasicMaterial({ color: c });
  }

  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getGradient(),
    emissive,
    emissiveIntensity,
    // MeshToonMaterial doesn't truly support flatShading, but normals still
    // affect banding; we keep the flag for API symmetry / future swap to Phong.
  });
}

/**
 * Re-skin every mesh inside a loaded glTF scene so external models match our
 * stylized direction instead of their original (usually PBR) materials.
 * Preserves each mesh's base color/texture where possible.
 *
 * Controlled by CONFIG.materials.restyleLoadedModels — set false to keep the
 * asset's authored materials untouched.
 */
export function restyleModel(root) {
  if (!CONFIG.materials.restyleLoadedModels) return root;

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const src = obj.material;
    // Try to carry over the original albedo color and/or texture map.
    const baseColor = src && src.color ? src.color.getHex() : 0xffffff;
    const map = src && src.map ? src.map : null;

    const styled = makeStylizedMaterial({ color: baseColor });
    if (map && styled.map !== undefined) styled.map = map;
    styled.needsUpdate = true;

    obj.material = styled;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  return root;
}
