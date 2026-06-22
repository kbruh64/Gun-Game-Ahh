/**
 * postprocessing.js
 * -----------------------------------------------------------------------------
 * Wraps the renderer in an EffectComposer and adds the bloom that makes the
 * stylized highlights / emissive accents "pop". This is the glow you see on the
 * targets and accent cover blocks.
 *
 * TO ADJUST THE GLOW: edit CONFIG.bloom.{strength,radius,threshold}.
 *   - threshold low  -> more of the image blooms (dreamy)
 *   - strength high  -> intense neon glow (Valorant ability vibes)
 * Set CONFIG.bloom.enabled = false to render straight (no composer overhead).
 * -----------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG } from './config.js';

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.renderer.maxPixelRatio));
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  let bloomPass = null;
  if (CONFIG.bloom.enabled) {
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      CONFIG.bloom.strength,
      CONFIG.bloom.radius,
      CONFIG.bloom.threshold
    );
    composer.addPass(bloomPass);
  }

  // OutputPass handles tone mapping + color space conversion at the end of the
  // chain so bloom is composited in the correct (linear) space.
  composer.addPass(new OutputPass());

  return { composer, bloomPass };
}
