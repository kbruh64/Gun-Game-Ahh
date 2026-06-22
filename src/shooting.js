/**
 * shooting.js
 * -----------------------------------------------------------------------------
 * Hitscan shooting via raycasting from the center of the screen (the crosshair).
 * Handles fire rate, recoil, a muzzle-flash light, and target hit feedback
 * (flash color + knockback + score callback).
 *
 * The ray is cast straight down the camera's forward axis, so it always matches
 * the crosshair regardless of where the player is looking.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class ShootingSystem {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D[]} targets      meshes that count as hits
   * @param {object} [hooks]
   * @param {(hit)=>void} [hooks.onHit]     called with { object, point, distance }
   * @param {(radians:number)=>void} [hooks.onRecoil]  apply camera kick
   */
  constructor(camera, scene, targets, hooks = {}) {
    this.camera = camera;
    this.scene = scene;
    this.targets = targets;
    this.hooks = hooks;
    this.cfg = CONFIG.shooting;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = this.cfg.range;
    this._center = new THREE.Vector2(0, 0); // screen center in NDC

    this._cooldown = 0; // seconds until next allowed shot (automatic mode)

    // Muzzle flash: a brief point light parented to the camera.
    this._muzzleLight = new THREE.PointLight(0xffe9a8, 0, 8, 2);
    this._muzzleLight.position.set(0.3, -0.25, -0.6);
    camera.add(this._muzzleLight);
    this._flashTimer = 0;

    // Pool of transient hit-marker sprites so we don't allocate on every shot.
    this._impacts = [];
  }

  /**
   * Call every frame.
   * @param {number} dt
   * @param {Input} input
   * @param {boolean} canFire  gate shooting (e.g. only when pointer is locked)
   */
  update(dt, input, canFire = true) {
    if (this._cooldown > 0) this._cooldown -= dt;

    const wantsToFire = canFire && (this.cfg.automatic
      ? input.firing
      : input.firePressedThisFrame);

    if (wantsToFire && this._cooldown <= 0) {
      this.fire();
      if (this.cfg.automatic) this._cooldown = 1 / this.cfg.fireRate;
    }

    // Decay muzzle flash.
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      this._muzzleLight.intensity = Math.max(0, (this._flashTimer / 0.05) * 6);
    }

    // Animate + expire impact markers.
    for (let i = this._impacts.length - 1; i >= 0; i--) {
      const im = this._impacts[i];
      im.life -= dt;
      im.mesh.scale.multiplyScalar(1 + dt * 4);
      im.mesh.material.opacity = Math.max(0, im.life / im.maxLife);
      if (im.life <= 0) {
        this.scene.remove(im.mesh);
        im.mesh.geometry.dispose();
        im.mesh.material.dispose();
        this._impacts.splice(i, 1);
      }
    }
  }

  fire() {
    // Muzzle flash + recoil feedback.
    if (this.cfg.muzzleFlash) {
      this._flashTimer = 0.05;
      this._muzzleLight.intensity = 6;
    }
    if (this.hooks.onRecoil) this.hooks.onRecoil(this.cfg.recoilKick);

    // Cast from screen center down the camera axis.
    this.raycaster.setFromCamera(this._center, this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, false);

    if (hits.length > 0) {
      const hit = hits[0];
      this._spawnImpact(hit.point);
      this._reactTarget(hit.object);
      if (this.hooks.onHit) {
        this.hooks.onHit({ object: hit.object, point: hit.point, distance: hit.distance });
      }
    }
  }

  /** Flash a target and give it a little pop when hit. */
  _reactTarget(obj) {
    if (!obj.material) return;
    const mat = obj.material;
    if (!obj.userData._origEmissive && mat.emissive) {
      obj.userData._origEmissive = mat.emissive.getHex();
    }
    if (mat.emissive) {
      mat.emissive.setHex(CONFIG.palette.targetHit);
      mat.emissiveIntensity = 1.5;
    } else if (mat.color) {
      mat.color.setHex(CONFIG.palette.targetHit);
    }
    obj.userData._hitFlash = 0.12;
    obj.userData.hp = (obj.userData.hp ?? 100) - this.cfg.damage;
  }

  /** Small expanding ring at the impact point (works in screen space-ish). */
  _spawnImpact(point) {
    const geo = new THREE.RingGeometry(0.05, 0.12, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(point);
    // Face the camera.
    mesh.lookAt(this.camera.position);
    this.scene.add(mesh);
    this._impacts.push({ mesh, life: 0.25, maxLife: 0.25 });
  }

  /**
   * Restore target colors after the brief hit flash. Call from the main loop so
   * targets that were hit return to their normal emissive look.
   */
  tickTargetFlashes(dt) {
    for (const t of this.targets) {
      if (t.userData._hitFlash > 0) {
        t.userData._hitFlash -= dt;
        if (t.userData._hitFlash <= 0 && t.material && t.material.emissive) {
          t.material.emissive.setHex(t.userData._origEmissive ?? CONFIG.palette.emissiveAccent);
          t.material.emissiveIntensity = 0.6;
        }
      }
    }
  }
}
