/**
 * config.js
 * -----------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH FOR THE "LOOK" AND FEEL OF THE GAME.
 *
 * This is the file you will edit most often to dial in the art direction.
 * Everything that affects color, lighting, bloom, and movement feel lives here
 * so you never have to hunt through the engine code to retune the vibe.
 *
 * Quick art-direction recipe (Valorant / Rivals style):
 *   - Keep `materials.mode` on 'toon' for cel-shaded banding, or 'unlit' for the
 *     flattest, most graphic look (no lighting response at all).
 *   - Push `bloom.strength` up for that glowy, punchy highlight look.
 *   - Use a small number of SATURATED accent colors against muted neutral walls.
 *   - Strong single key light + soft fill = clean readable silhouettes.
 * -----------------------------------------------------------------------------
 */

export const CONFIG = {
  /* ----------------------------------------------------------------------- */
  /* RENDERER                                                                */
  /* ----------------------------------------------------------------------- */
  renderer: {
    // Background / sky color. A flat mid-tone reads as "stylized" more than a
    // photographic gradient. Try a desaturated teal or warm grey.
    clearColor: 0x10131a,
    // Tone mapping exposure. Lower = flatter/more graphic, higher = punchier.
    exposure: 1.1,
    antialias: true,
    // pixelRatio cap keeps high-DPI screens fast. Raise toward window.devicePixelRatio
    // for crisper edges at the cost of performance.
    maxPixelRatio: 2,
  },

  /* ----------------------------------------------------------------------- */
  /* FOG  — cheap way to add depth + hide the far clip. Stylize by matching   */
  /* the fog color to your clear color, or contrast it for a "haze" pop.      */
  /* ----------------------------------------------------------------------- */
  fog: {
    enabled: true,
    color: 0x10131a,
    near: 25,
    far: 140,
  },

  /* ----------------------------------------------------------------------- */
  /* LIGHTING  — for a toon look you want CLEAR light direction so the cel    */
  /* bands land in a readable place. Don't over-light; let shadows define     */
  /* the silhouette.                                                          */
  /* ----------------------------------------------------------------------- */
  lights: {
    // Hemisphere = soft sky/ground ambient. Drives the overall color mood.
    hemisphere: {
      skyColor: 0x9bb8ff, // cool light from above
      groundColor: 0x2a2230, // warm-ish bounce from below
      intensity: 0.55,
    },
    // The KEY light. This is the one that creates your toon banding. Move its
    // position to change where highlights/shadows fall.
    key: {
      color: 0xfff1d6, // slightly warm sun
      intensity: 2.4,
      position: [30, 50, 20],
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: -0.0005,
    },
    // A subtle rim/fill from the opposite side keeps shadows from going pure
    // black and adds that "studio" stylized edge light.
    rim: {
      color: 0x4f7bff,
      intensity: 0.8,
      position: [-25, 20, -30],
    },
    // Flat base ambient so nothing is ever fully black. Keep this LOW for toon.
    ambientIntensity: 0.15,
  },

  /* ----------------------------------------------------------------------- */
  /* POST-PROCESSING / BLOOM                                                  */
  /* threshold: only pixels brighter than this bloom. Lower = more blooms.    */
  /* strength : how intense the glow is.                                      */
  /* radius   : how far the glow spreads.                                     */
  /* ----------------------------------------------------------------------- */
  bloom: {
    enabled: true,
    strength: 0.55,
    radius: 0.6,
    threshold: 0.85,
  },

  /* ----------------------------------------------------------------------- */
  /* MATERIALS  — how the environment is shaded.                              */
  /*   'toon'  -> MeshToonMaterial with a stepped gradient ramp (cel shading) */
  /*   'unlit' -> MeshBasicMaterial, totally flat, ignores lights entirely    */
  /* ----------------------------------------------------------------------- */
  materials: {
    mode: 'toon', // 'toon' | 'unlit'
    // Number of bands in the toon ramp. 2-4 reads as classic cel shading.
    toonSteps: 3,
    // If true, models loaded via glTF get their materials re-skinned to match
    // the stylized look. Turn OFF if you want to keep an asset's original PBR.
    restyleLoadedModels: true,
  },

  /* ----------------------------------------------------------------------- */
  /* PALETTE  — the stylized color story. Few colors, high contrast.         */
  /* Neutrals for big surfaces, saturated accents for gameplay-relevant bits. */
  /* ----------------------------------------------------------------------- */
  palette: {
    floor: 0x2b2f3a,
    grid: 0x3d4456,
    wall: 0x4a5066,
    coverA: 0xff5470, // hot pink accent (attacker-ish)
    coverB: 0x2de1c2, // teal accent (defender-ish)
    target: 0xffd166, // golden hittable targets
    targetHit: 0xff3b3b,
    // Emissive accents are what actually "bloom". Push these bright.
    emissiveAccent: 0x39c0ff,
  },

  /* ----------------------------------------------------------------------- */
  /* PLAYER / FIRST-PERSON CONTROLLER                                         */
  /* ----------------------------------------------------------------------- */
  player: {
    eyeHeight: 1.7, // camera height above the ground (meters)
    radius: 0.4, // collision capsule radius
    moveSpeed: 7.0, // base walk speed (m/s)
    sprintMultiplier: 1.6, // hold Shift
    acceleration: 60, // how snappy movement feels (higher = snappier)
    damping: 10, // ground friction (higher = stops faster)
    jumpForce: 7.0,
    gravity: -22.0,
    mouseSensitivity: 0.0022, // radians per pixel of mouse movement
    spawn: [0, 1.7, 8],
  },

  /* ----------------------------------------------------------------------- */
  /* SHOOTING                                                                 */
  /* ----------------------------------------------------------------------- */
  shooting: {
    automatic: false, // true = hold to fire, false = click per shot
    fireRate: 8, // shots per second (used when automatic)
    range: 200, // max raycast distance (meters)
    recoilKick: 0.012, // upward camera kick per shot (radians)
    muzzleFlash: true,
    damage: 25,
  },
};
