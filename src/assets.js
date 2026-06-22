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

/* ============================================================================
 * SWAP YOUR MODEL URLS HERE
 * Leave `url` as null to use the built-in procedural placeholder instead.
 * ==========================================================================*/
export const MODELS = {
  // First-person weapon (viewmodel) attached to the camera.
  gun: {
    url: null, // e.g. './public/models/rifle.glb'
    scale: 1,
    // Position relative to the camera (right, down, forward-ish). Tweak so the
    // muzzle sits at screen-bottom-right like a typical FPS viewmodel.
    position: [0.35, -0.35, -0.6],
    rotation: [0, Math.PI, 0], // face away from the camera
  },

  // Character model used for enemies/targets.
  character: {
    url: null, // e.g. './public/models/agent.glb'
    scale: 1,
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

    model.scale.setScalar(cfg.scale);
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

    model.scale.setScalar(cfg.scale);
    model.position.set(position[0] + cfg.position[0], position[1] + cfg.position[1], position[2] + cfg.position[2]);
    model.rotation.set(...cfg.rotation);
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
