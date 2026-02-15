// Tunable parameters for the particle lifecycle system.
// All decay/damping values are per-second rates used with frame-rate-independent math.

export const LIFECYCLE = {
  // ── Velocity damping ──────────────────────────
  // Per-second decay factor. Effective per-frame: Math.pow(dampingRate, dt)
  // 0.05 → loses ~95% of velocity per second (gentle coast to stop)
  velocityDampingRate: 0.05,

  // ── Spawn phase (birth → full presence) ───────
  // Duration (seconds) over which particles ease into full size/opacity/energy
  spawnDuration: 0.4,
  // Easing exponent for spawn ramp (>1 = ease-out feel)
  spawnEaseExponent: 3.0,

  // ── Energy / intensity ────────────────────────
  // Initial energy at spawn (1.0 = full brightness)
  initialEnergy: 1.0,
  // Exponential decay half-life in seconds (energy halves every N seconds)
  energyHalfLife: 1.8,

  // ── Opacity ───────────────────────────────────
  // Exponential decay half-life in seconds
  opacityHalfLife: 2.5,
  // Smoothstep fade-out: opacity starts dropping toward 0 at this lifeProgress
  opacityFadeStart: 0.55,

  // ── Size ──────────────────────────────────────
  // Easing exponent for size shrink (quadratic = 2, cubic = 3)
  sizeShrinkExponent: 2.0,
  // lifeProgress at which size begins decaying
  sizeFadeStart: 0.6,

  // ── Early death thresholds ────────────────────
  // Kill particle when any of these drop below threshold
  minOpacity: 0.008,
  minEnergy: 0.01,
  minSize: 0.01,

  // ── Trail ─────────────────────────────────────
  trailSampleInterval: 0.06,
};
