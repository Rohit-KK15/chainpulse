// Per-chain motion and visual personality parameters.
// These multiply against base lifecycle/spawn values to give each chain a distinct feel.

export interface ChainPersonality {
  speedMultiplier: number;       // Initial velocity scale (higher = faster particles)
  dampingMultiplier: number;     // Velocity damping modifier (higher = faster stop)
  glowIntensity: number;         // Energy/bloom boost factor
  spawnSpread: number;           // Spawn radius multiplier
  motionSmoothness: number;      // Jitter reduction (0 = raw, 1 = fully smoothed)
  energyHalfLifeMult: number;    // Energy half-life multiplier (higher = longer glow)
}

export const CHAIN_PERSONALITIES: Record<string, ChainPersonality> = {
  // Ethereum: slow, majestic, high glow, smooth motion
  ethereum: {
    speedMultiplier: 0.7,
    dampingMultiplier: 0.8,
    glowIntensity: 1.2,
    spawnSpread: 1.0,
    motionSmoothness: 0.8,
    energyHalfLifeMult: 1.3,
  },

  // Polygon: fast, energetic, moderate glow
  polygon: {
    speedMultiplier: 1.3,
    dampingMultiplier: 1.2,
    glowIntensity: 0.9,
    spawnSpread: 1.1,
    motionSmoothness: 0.5,
    energyHalfLifeMult: 0.9,
  },

  // Arbitrum: very fast, light, crisp particles
  arbitrum: {
    speedMultiplier: 1.5,
    dampingMultiplier: 1.4,
    glowIntensity: 0.85,
    spawnSpread: 1.2,
    motionSmoothness: 0.3,
    energyHalfLifeMult: 0.8,
  },
};

const DEFAULT_PERSONALITY: ChainPersonality = {
  speedMultiplier: 1.0,
  dampingMultiplier: 1.0,
  glowIntensity: 1.0,
  spawnSpread: 1.0,
  motionSmoothness: 0.5,
  energyHalfLifeMult: 1.0,
};

export function getPersonality(chainId: string): ChainPersonality {
  return CHAIN_PERSONALITIES[chainId] ?? DEFAULT_PERSONALITY;
}
