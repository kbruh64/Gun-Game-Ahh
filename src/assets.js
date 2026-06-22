/**
 * assets.js
 * -----------------------------------------------------------------------------
 * Dynamic glTF/GLB loading from external URLs (Sketchfab exports, your own
 * Vercel-hosted models, etc.). This is the file you edit to swap in real art.
 *
 * HOW TO ADD YOUR OWN MODELS
 *   1. Host a .glb (or .gltf + bins/textures) somewhere CORS-friendly:
 *        - put it in this project's /public folder (served same-origin), OR
 *        - upload to a CDN / Sketchfab download / your Vercel deployment.
 *   2. Paste the URL into MODELS below.
 *   3. Optionally tweak scale/offset/rotation so it sits right.
 *
 * NOTE ON CORS: browsers block cross-origin model fetches unless the host sends
 * `Access-Control-Allow-Origin`. Sketchfab "auto-converted" embed URLs usually
 * do NOT allow this — download the .glb and self-host it (e.g. in /public) for
 * reliability. Same-origin files always work.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { restyleModel } from './materials.js';

// Scratch objects reused by the auto-fit helpers (avoid per-call allocation).
const _box = new THREE.Box3();
const _size = new THREE.Vector3();

/** Uniformly scale so the model's tallest axis (Y) equals `targetHeight`. */
function fitToHeight(object, targetHeight) {
  _box.setFromObject(object).getSize(_size);
  if (_size.y > 1e-6 && Number.isFinite(_size.y)) {
    object.scale.multiplyScalar(targetHeight / _size.y);
  }
}

/** Uniformly scale so the model's longest dimension equals `target`. */
function fitToMaxDimension(object, target) {
  _box.setFromObject(object).getSize(_size);
  const maxDim = Math.max(_size.x, _size.y, _size.z);
  if (maxDim > 1e-6 && Number.isFinite(maxDim)) {
    object.scale.multiplyScalar(target / maxDim);
  }
}

/** Shift the model vertically so its lowest point rests at world height `y`. */
function groundTo(object, y) {
  _box.setFromObject(object);
  if (Number.isFinite(_box.min.y)) object.position.y += y - _box.min.y;
}

/* ============================================================================
 * SWAP YOUR MODEL URLS HERE
 * Leave `url` as null to use the built-in procedural placeholder instead.
 * ==========================================================================*/
/*
 * Sizing note: instead of guessing a `scale` (models come in wildly different
 * units), each entry below uses AUTO-FIT — the loader measures the model's real
 * bounding box and scales it to a target size, then drops it onto the floor.
 *   - `fit`        : scale the LONGEST dimension to N units (good for weapons)
 *   - `fitHeight`  : scale so the model is N units TALL, feet grounded (props/chars)
 *   - `scale`      : fall back to an explicit multiplier if you prefer manual control
 * `position`/`rotation` are applied on top for fine nudging.
 */
export const MODELS = {
  // First-person weapon (viewmodel) attached to the camera.
  // CC0 "Pistol" by Quaternius (via poly.pizza), self-hosted for reliability.
  gun: {
    url: './public/models/pistol.glb',
    fit: 0.42, // longest dimension ≈ 0.42 units — a hand-held viewmodel size
    // Position relative to the camera (right, down, forward). Nudge so the
    // muzzle sits at screen-bottom-right like a typical FPS viewmodel.
    position: [0.3, -0.28, -0.5],
    rotation: [0, Math.PI, 0], // face away from the camera (flip if it points back)
  },

  // Character model used for enemies/targets.
  // CC0 "SWAT" by Quaternius (via poly.pizza).
  character: {
    url: './public/models/swat.glb',
    fitHeight: 1.8, // ≈ 1.8 m tall, automatically grounded at the feet
    position: [0, 0, 0],
    rotation: [0, Math.PI, 0], // face roughly toward the player's spawn
  },

  // Cover prop scattered around the arena.
  // CC0 "Sci Fi Crate" by Dipper98 (via poly.pizza).
  crate: {
    url: './public/models/crate.glb',
    fitHeight: 1.5, // chest-high cover, automatically grounded
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
};

export class AssetLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();

    // DRACO support for compressed meshes (many Sketchfab/optimized models use
    // it). Decoder is pulled from a CDN; harmless if your models aren't draco.
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(draco);
  }

  /**
   * Load a glTF/GLB and return its root Object3D, restyled to match the game's
   * art direction (see materials.restyleModel).
   *
   * @param {string} url
   * @param {(pct:number)=>void} [onProgress]
   * @returns {Promise<THREE.Group>}
   */
  loadModel(url, onProgress) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(restyleModel(gltf.scene)),
        (evt) => {
          if (onProgress && evt.total) onProgress(evt.loaded / evt.total);
        },
        (err) => reject(err)
      );
    });
  }

  /**
   * Get the gun viewmodel. Loads MODELS.gun.url if set, otherwise returns a
   * clean procedural placeholder so the game is playable out of the box.
   * The returned group is meant to be parented to the camera.
   */
  async getGunViewmodel() {
    const cfg = MODELS.gun;
    let model;
    if (cfg.url) {
      try {
        model = await this.loadModel(cfg.url);
      } catch (e) {
        console.warn('[assets] gun model failed to load, using placeholder:', e);
      }
    }
    if (!model) model = createPlaceholderGun();

    if (cfg.fit) fitToMaxDimension(model, cfg.fit);
    else if (cfg.scale) model.scale.setScalar(cfg.scale);
    model.position.set(...cfg.position);
    model.rotation.set(...cfg.rotation);
    // Viewmodel should never be occluded by world geometry / fog.
    model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.material) o.material.fog = false;
      }
    });
    return model;
  }

  /**
   * Spawn a character at a world position. Loads MODELS.character.url if set,
   * otherwise returns a stand-in capsule. Returns the Object3D (already added by
   * the caller).
   */
  async spawnCharacter(position = [0, 0, 0]) {
    const cfg = MODELS.character;
    let model;
    if (cfg.url) {
      try {
        model = await this.loadModel(cfg.url);
      } catch (e) {
        console.warn('[assets] character model failed to load, using placeholder:', e);
      }
    }
    if (!model) model = createPlaceholderCharacter();

    model.rotation.set(...cfg.rotation);
    model.position.set(position[0] + cfg.position[0], position[1] + cfg.position[1], position[2] + cfg.position[2]);
    if (cfg.fitHeight) fitToHeight(model, cfg.fitHeight);
    else if (cfg.scale) model.scale.setScalar(cfg.scale);
    groundTo(model, position[1] + cfg.position[1]); // stand on the floor
    return model;
  }

  /**
   * Load a generic prop (e.g. the crate) at a world position using a MODELS
   * entry for its url/scale/rotation. Falls back to a placeholder box.
   */
  async loadProp(cfg, position = [0, 0, 0]) {
    let model;
    if (cfg.url) {
      try {
        model = await this.loadModel(cfg.url);
      } catch (e) {
        console.warn('[assets] prop model failed to load, using placeholder:', e);
      }
    }
    if (!model) model = createPlaceholderCrate();

    model.rotation.set(...cfg.rotation);
    model.position.set(
      position[0] + cfg.position[0],
      position[1] + cfg.position[1],
      position[2] + cfg.position[2]
    );
    if (cfg.fitHeight) fitToHeight(model, cfg.fitHeight);
    else if (cfg.scale) model.scale.setScalar(cfg.scale);
    groundTo(model, position[1] + cfg.position[1]); // rest on the floor
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return model;
  }
}

/* ----------------------------------------------------------------------------
 * PROCEDURAL PLACEHOLDERS
 * These let you run/playtest immediately with no external assets. Delete or
 * ignore once real models are wired in.
 * --------------------------------------------------------------------------*/

function createPlaceholderGun() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshToonMaterial({ color: 0x2b2f3a });
  const accentMat = new THREE.MeshToonMaterial({ color: 0x39c0ff, emissive: 0x39c0ff, emissiveIntensity: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.55), bodyMat);
  body.position.z = -0.1;
  group.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), bodyMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.4);
  group.add(barrel);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.12), accentMat);
  sight.position.set(0, 0.12, -0.05);
  group.add(sight);

  group.name = 'PlaceholderGun';
  return group;
}

function createPlaceholderCharacter() {
  const group = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: 0xff5470 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 8, 16), mat);
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);
  group.name = 'PlaceholderCharacter';
  return group;
}

function createPlaceholderCrate() {
  const group = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: 0x4a5066, emissive: 0x39c0ff, emissiveIntensity: 0.15 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  box.position.y = 0.5;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);
  group.name = 'PlaceholderCrate';
  return group;
}
