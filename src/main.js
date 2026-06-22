/**
 * main.js
 * -----------------------------------------------------------------------------
 * Entry point. Wires every module together and runs the game loop:
 *   scene.js        -> world, lights, arena
 *   postprocessing  -> bloom
 *   controls.js     -> FPS movement + mouse look
 *   input.js        -> key/mouse state
 *   shooting.js     -> hitscan + feedback
 *   assets.js       -> glTF loading (gun viewmodel + characters)
 *
 * This file intentionally stays thin: it orchestrates, it doesn't implement.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createScene, createCamera, setupLights, buildEnvironment } from './scene.js';
import { createComposer } from './postprocessing.js';
import { Input } from './input.js';
import { FirstPersonController } from './controls.js';
import { ShootingSystem } from './shooting.js';
import { AssetLoader, MODELS } from './assets.js';

// ---- DOM handles ------------------------------------------------------------
const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const loading = document.getElementById('loading');
const scoreEl = document.getElementById('score');

// ---- Core engine objects ----------------------------------------------------
const renderer = createRenderer(canvas);
const scene = createScene();
const camera = createCamera();
setupLights(scene);
const world = buildEnvironment(scene);
const { composer } = createComposer(renderer, scene, camera);

// ---- Input + controller -----------------------------------------------------
const input = new Input();
input.connect();

const controller = new FirstPersonController(camera, document.body, input, world.colliders);
// PointerLockControls puts the camera inside an object holder; add THAT to the
// scene so movement is reflected.
scene.add(controller.controls.getObject());

controller.setupLockUI({
  onLock: () => { overlay.classList.add('hidden'); },
  onUnlock: () => { overlay.classList.remove('hidden'); },
});

// Click the overlay (or anywhere) to capture the mouse and start playing.
overlay.addEventListener('click', () => controller.lock());

// ---- Shooting ---------------------------------------------------------------
let score = 0;
const shooting = new ShootingSystem(camera, scene, world.targets, {
  onRecoil: (rad) => controller.applyRecoil(rad),
  onHit: ({ object }) => {
    score += 100;
    scoreEl.textContent = `Score: ${score}`;
    // Knock the target back a touch along the camera forward for juice.
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    object.position.addScaledVector(dir, 0.4);
  },
});

// ---- Assets: attach gun viewmodel to the camera -----------------------------
const assets = new AssetLoader();
(async () => {
  // Gun viewmodel (CC0 pistol by Quaternius) parented to the camera.
  const gun = await assets.getGunViewmodel();
  camera.add(gun);

  // Scatter sci-fi crates as cover, then register them with the controller so
  // the player collides with them (they're loaded async, after construction).
  const cratePositions = [
    [-6, 0, -10], [7, 0, -13], [0, 0, -17], [-13, 0, -7], [13, 0, -3],
  ];
  const crates = [];
  for (const p of cratePositions) {
    const crate = await assets.loadProp(MODELS.crate, p);
    scene.add(crate);
    crates.push(crate);
  }
  controller.addColliders(crates);

  // Spawn SWAT enemies (CC0 by Quaternius) as additional shootable targets.
  // world.targets is the same array the ShootingSystem holds, so pushing here
  // makes them immediately hittable.
  const enemyPositions = [
    [-7, 0, -26], [2, 0, -31], [9, 0, -24], [-15, 0, -14], [15, 0, -16],
  ];
  for (const p of enemyPositions) {
    const enemy = await assets.spawnCharacter(p);
    enemy.userData.isEnemy = true;
    scene.add(enemy);
    world.targets.push(enemy);
  }

  loading.classList.add('hidden');
})();

// ---- Resize handling --------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Game loop --------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp to avoid tunneling on lag

  controller.update(dt);
  shooting.update(dt, input, controller.isLocked);
  shooting.tickTargetFlashes(dt);

  // Idle bob on the floating sphere targets so the scene feels alive (cosmetic).
  // Skip the glTF enemies — they have no baseY and should stay grounded.
  const t = clock.elapsedTime;
  for (const target of world.targets) {
    if (!target.userData.isTarget) continue;
    target.position.y = target.userData.baseY + Math.sin(t * 1.5 + target.position.x) * 0.25;
    target.rotation.y += dt * 0.5;
  }

  input.endFrame();

  // Render through the bloom composer (falls back to plain render if disabled).
  if (CONFIG.bloom.enabled) composer.render();
  else renderer.render(scene, camera);
}

animate();
