/**
 * scene.js
 * -----------------------------------------------------------------------------
 * Builds the world: renderer, camera, lighting rig, and a small stylized arena.
 *
 * Returns the core objects the rest of the engine needs. Geometry that the
 * player can collide with or shoot is collected into arrays so controls.js and
 * shooting.js can do their raycasts against a small, explicit set (fast + clear).
 *
 * WHERE TO TUNE THE LOOK:
 *   - Lighting rig:  CONFIG.lights
 *   - Colors:        CONFIG.palette
 *   - Fog/sky:       CONFIG.fog / CONFIG.renderer.clearColor
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeStylizedMaterial } from './materials.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: CONFIG.renderer.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.renderer.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // ACES gives nicer highlight rolloff for the bloom to sit on top of.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.renderer.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.renderer.clearColor);
  if (CONFIG.fog.enabled) {
    scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);
  }
  return scene;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    75, // FOV — bump to ~90 for a snappier "shooter" feel
    window.innerWidth / window.innerHeight,
    0.05,
    1000
  );
  camera.position.set(...CONFIG.player.spawn);
  return camera;
}

/**
 * Studio-style 3-point-ish rig tuned for readable cel shading.
 */
export function setupLights(scene) {
  const L = CONFIG.lights;

  const hemi = new THREE.HemisphereLight(
    L.hemisphere.skyColor,
    L.hemisphere.groundColor,
    L.hemisphere.intensity
  );
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, L.ambientIntensity);
  scene.add(ambient);

  // KEY light (the one that creates your toon bands + shadows).
  const key = new THREE.DirectionalLight(L.key.color, L.key.intensity);
  key.position.set(...L.key.position);
  key.castShadow = L.key.castShadow;
  key.shadow.mapSize.set(L.key.shadowMapSize, L.key.shadowMapSize);
  key.shadow.bias = L.key.shadowBias;
  // Tighten the shadow frustum around the arena for crisp shadows.
  const d = 60;
  key.shadow.camera.left = -d;
  key.shadow.camera.right = d;
  key.shadow.camera.top = d;
  key.shadow.camera.bottom = -d;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 200;
  scene.add(key);
  scene.add(key.target);

  // RIM / fill from the opposite side — adds the stylized edge light.
  const rim = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
  rim.position.set(...L.rim.position);
  scene.add(rim);

  return { hemi, ambient, key, rim };
}

/**
 * Build a small arena. Returns:
 *   { colliders }  -> meshes the player should not walk through (walls + cover)
 *   { targets }    -> meshes that register hits when shot
 *   { all }        -> everything the shooting ray can stop on (colliders+floor+targets)
 */
export function buildEnvironment(scene) {
  const colliders = [];
  const targets = [];
  const all = [];

  const P = CONFIG.palette;

  // ---- FLOOR ----------------------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(120, 120);
  const floorMat = makeStylizedMaterial({ color: P.floor });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  all.push(floor);

  // A subtle grid overlay reads as a clean "training range" stylized surface.
  const grid = new THREE.GridHelper(120, 60, P.grid, P.grid);
  grid.position.y = 0.01;
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);

  // ---- PERIMETER WALLS ------------------------------------------------------
  const wallMat = makeStylizedMaterial({ color: P.wall });
  const wallHeight = 6;
  const half = 60;
  const wallDefs = [
    { size: [120, wallHeight, 1], pos: [0, wallHeight / 2, -half] },
    { size: [120, wallHeight, 1], pos: [0, wallHeight / 2, half] },
    { size: [1, wallHeight, 120], pos: [-half, wallHeight / 2, 0] },
    { size: [1, wallHeight, 120], pos: [half, wallHeight / 2, 0] },
  ];
  for (const def of wallDefs) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(...def.size), wallMat);
    w.position.set(...def.pos);
    w.castShadow = true;
    w.receiveShadow = true;
    scene.add(w);
    colliders.push(w);
    all.push(w);
  }

  // ---- COVER BLOCKS (gameplay geometry + accent colors) ---------------------
  const coverMatA = makeStylizedMaterial({
    color: P.coverA,
    emissive: P.coverA,
    emissiveIntensity: 0.25,
  });
  const coverMatB = makeStylizedMaterial({
    color: P.coverB,
    emissive: P.coverB,
    emissiveIntensity: 0.25,
  });
  const coverLayout = [
    { pos: [-10, 1.5, -6], size: [4, 3, 4], mat: coverMatA },
    { pos: [12, 1.5, -10], size: [4, 3, 4], mat: coverMatB },
    { pos: [0, 1, -20], size: [8, 2, 2], mat: coverMatA },
    { pos: [-18, 2, -18], size: [3, 4, 3], mat: coverMatB },
    { pos: [18, 1, 4], size: [3, 2, 6], mat: coverMatA },
  ];
  for (const c of coverLayout) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...c.size), c.mat);
    m.position.set(...c.pos);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    colliders.push(m);
    all.push(m);
  }

  // ---- SHOOTABLE TARGETS ----------------------------------------------------
  // Floating emissive spheres that flash + bloom when hit. Replace with your
  // character glTF later (see assets.js spawnCharacter).
  const targetPositions = [
    [-6, 2.5, -25],
    [0, 3.5, -30],
    [8, 2.5, -25],
    [-14, 2, -12],
    [14, 2, -14],
  ];
  for (const pos of targetPositions) {
    const mat = makeStylizedMaterial({
      color: P.target,
      emissive: P.emissiveAccent,
      emissiveIntensity: 0.6,
    });
    const t = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), mat);
    t.position.set(...pos);
    t.castShadow = true;
    t.userData.isTarget = true;
    t.userData.baseY = pos[1]; // remembered for the bobbing animation
    scene.add(t);
    targets.push(t);
    all.push(t);
  }

  return { colliders, targets, all, floor };
}
