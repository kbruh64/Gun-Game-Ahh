/**
 * input.js
 * -----------------------------------------------------------------------------
 * Centralized input state. Keeps a snapshot of which movement keys are held and
 * exposes mouse-button state. Mouse-look deltas are consumed by controls.js via
 * the pointer-lock movement events.
 *
 * Keeping this separate means controls.js and shooting.js just READ booleans —
 * they don't each wire up their own listeners, which keeps things modular.
 * -----------------------------------------------------------------------------
 */

export class Input {
  constructor() {
    // Movement intent flags (set by keydown/keyup).
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.jump = false;
    this.sprint = false;

    // Fire intent (set by mouse buttons). shooting.js reads this each frame.
    this.firing = false;
    this.firePressedThisFrame = false; // edge: true only on the frame of press

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  connect() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.forward = true; break;
      case 'KeyS': case 'ArrowDown': this.backward = true; break;
      case 'KeyA': case 'ArrowLeft': this.left = true; break;
      case 'KeyD': case 'ArrowRight': this.right = true; break;
      case 'Space': this.jump = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.sprint = true; break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': this.forward = false; break;
      case 'KeyS': case 'ArrowDown': this.backward = false; break;
      case 'KeyA': case 'ArrowLeft': this.left = false; break;
      case 'KeyD': case 'ArrowRight': this.right = false; break;
      case 'Space': this.jump = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.sprint = false; break;
    }
  }

  _onMouseDown(e) {
    if (e.button === 0) {
      this.firing = true;
      this.firePressedThisFrame = true;
    }
  }

  _onMouseUp(e) {
    if (e.button === 0) this.firing = false;
  }

  /** Call at the END of each frame to clear one-shot edge flags. */
  endFrame() {
    this.firePressedThisFrame = false;
  }
}
