/**
 * controls.js
 * -----------------------------------------------------------------------------
 * First-person controller: pointer-lock mouse look + WASD movement with
 * acceleration/damping, gravity, jumping, and simple box collision against the
 * arena colliders.
 *
 * Built on top of Three's PointerLockControls for robust, cross-browser mouse
 * capture, with our own velocity-based movement layered on so the feel is
 * tunable from CONFIG.player.
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from './config.js';

export class FirstPersonController {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement  element to request pointer lock from
   * @param {Input} input             shared input state
   * @param {THREE.Mesh[]} colliders  boxes the player can't walk through
   */
  constructor(camera, domElement, input, colliders = []) {
    this.camera = camera;
    this.input = input;
    this.colliders = colliders;
    this.P = CONFIG.player;

    this.controls = new PointerLockControls(camera, domElement);
    // PointerLockControls uses its own sensitivity via pointerSpeed (newer
    // versions). We map our CONFIG sensitivity onto it relative to its default.
    if ('pointerSpeed' in this.controls) {
      this.controls.pointerSpeed = this.P.mouseSensitivity / 0.002;
    }

    this.velocity = new THREE.Vector3();
    this.onGround = true;

    // Precompute collider bounding boxes (arena is static).
    this._colliderBoxes = colliders.map((c) => new THREE.Box3().setFromObject(c));

    // Scratch objects reused each frame (avoid per-frame allocation).
    this._forwardDir = new THREE.Vector3();
    this._rightDir = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._playerBox = new THREE.Box3();
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  /**
   * Register extra solid objects as collision (e.g. crates loaded async after
   * construction). Computes each one's world-space bounding box.
   */
  addColliders(objects = []) {
    for (const o of objects) {
      o.updateWorldMatrix(true, true); // ensure transforms are baked before measuring
      this.colliders.push(o);
      this._colliderBoxes.push(new THREE.Box3().setFromObject(o));
    }
  }

  /** Hook the lock/unlock flow up to UI callbacks (show/hide overlay). */
  setupLockUI({ onLock, onUnlock } = {}) {
    this.controls.addEventListener('lock', () => onLock && onLock());
    this.controls.addEventListener('unlock', () => onUnlock && onUnlock());
  }

  lock() {
    this.controls.lock();
  }

  /** Apply a small upward recoil kick to the look pitch (called by shooting). */
  applyRecoil(radians) {
    // PointerLockControls drives the camera quaternion; nudging pitch is easiest
    // by rotating the camera around its local X a touch. It self-corrects as the
    // player moves the mouse, giving a natural recoil-recovery feel.
    this.camera.rotateX(radians);
  }

  update(dt) {
    if (!this.controls.isLocked) {
      // Still apply gravity-less damping so we don't drift when paused.
      this.velocity.x *= 0.0;
      this.velocity.z *= 0.0;
      return;
    }

    const P = this.P;

    // --- Build the desired horizontal move direction from input ------------
    this.controls.getDirection(this._forwardDir); // camera forward (normalized)
    this._forwardDir.y = 0;
    this._forwardDir.normalize();
    // Right vector = forward x up.
    this._rightDir.crossVectors(this._forwardDir, this.camera.up).normalize();

    this._wish.set(0, 0, 0);
    if (this.input.forward) this._wish.add(this._forwardDir);
    if (this.input.backward) this._wish.sub(this._forwardDir);
    if (this.input.right) this._wish.add(this._rightDir);
    if (this.input.left) this._wish.sub(this._rightDir);
    if (this._wish.lengthSq() > 0) this._wish.normalize();

    const speed = P.moveSpeed * (this.input.sprint ? P.sprintMultiplier : 1);

    // --- Horizontal velocity: accelerate toward wish, damp otherwise -------
    const accel = P.acceleration * dt;
    this.velocity.x += this._wish.x * speed * accel;
    this.velocity.z += this._wish.z * speed * accel;

    // Friction / damping when not actively pushing in that axis.
    const damp = Math.max(0, 1 - P.damping * dt);
    this.velocity.x *= damp;
    this.velocity.z *= damp;

    // Clamp horizontal speed to the target max.
    const horiz = Math.hypot(this.velocity.x, this.velocity.z);
    if (horiz > speed) {
      const s = speed / horiz;
      this.velocity.x *= s;
      this.velocity.z *= s;
    }

    // --- Vertical: gravity + jump ------------------------------------------
    if (this.input.jump && this.onGround) {
      this.velocity.y = P.jumpForce;
      this.onGround = false;
    }
    this.velocity.y += P.gravity * dt;

    // --- Integrate with per-axis collision so we slide along walls ---------
    const obj = this.controls.getObject(); // the camera holder
    this._moveAxis('x', this.velocity.x * dt, obj);
    this._moveAxis('z', this.velocity.z * dt, obj);
    this._moveVertical(this.velocity.y * dt, obj);
  }

  _playerBoxAt(position) {
    const r = this.P.radius;
    const h = this.P.eyeHeight;
    this._playerBox.min.set(position.x - r, position.y - h, position.z - r);
    this._playerBox.max.set(position.x + r, position.y + 0.2, position.z + r);
    return this._playerBox;
  }

  _moveAxis(axis, amount, obj) {
    if (amount === 0) return;
    obj.position[axis] += amount;
    const box = this._playerBoxAt(obj.position);
    for (const cb of this._colliderBoxes) {
      if (box.intersectsBox(cb)) {
        // Back out of the collision and kill velocity on this axis.
        obj.position[axis] -= amount;
        this.velocity[axis] = 0;
        return;
      }
    }
  }

  _moveVertical(amount, obj) {
    obj.position.y += amount;

    // Ground plane at y = eyeHeight (floor is y=0, eye is eyeHeight above).
    if (obj.position.y <= this.P.eyeHeight) {
      obj.position.y = this.P.eyeHeight;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Landing on top of cover boxes.
    const box = this._playerBoxAt(obj.position);
    for (const cb of this._colliderBoxes) {
      if (box.intersectsBox(cb)) {
        if (amount < 0) {
          // Falling onto something: snap to its top.
          obj.position.y = cb.max.y + this.P.eyeHeight;
          this.velocity.y = 0;
          this.onGround = true;
        } else {
          // Hit head: stop upward motion.
          obj.position.y -= amount;
          this.velocity.y = 0;
        }
        return;
      }
    }
  }
}
