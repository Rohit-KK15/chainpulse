import { WHALE_CONFIG } from '../config/whaleConfig';
import { LIFECYCLE } from '../config/lifecycleConfig';

export const TRAIL_LENGTH = 8;

// Precomputed constant for exponential decay: ln(2)
const LN2 = Math.LN2;

export interface ParticleData {
  active: boolean;
  // Position
  x: number;
  y: number;
  z: number;
  // Velocity
  vx: number;
  vy: number;
  vz: number;
  // Visual state (computed each frame from lifecycle)
  size: number;
  targetSize: number;
  opacity: number;
  energy: number;
  // Color
  r: number;
  g: number;
  b: number;
  // Lifecycle timing
  age: number;
  maxAge: number;
  // Classification
  isWhale: boolean;
  chainId: string;
  // Chain personality modifiers (set at spawn)
  dampingMult: number;
  energyHalfLifeMult: number;
  // Whale-specific fields
  whaleGlowIntensity: number;
  whaleValue: number;
  // Trail ring buffer
  trailX: number[];
  trailY: number[];
  trailZ: number[];
  trailHead: number;
  trailFill: number;
  trailTimer: number;
  // Tx metadata for inspection
  hash: string;
  from: string;
  to: string | null;
  value: number;
  gasPrice: number;
  timestamp: number;
  tokenSymbol: string;
}

export interface SpawnConfig {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  r: number;
  g: number;
  b: number;
  maxAge: number;
  isWhale: boolean;
  chainId: string;
  dampingMult: number;
  energyHalfLifeMult: number;
  hash: string;
  from: string;
  to: string | null;
  value: number;
  whaleValue: number;
  gasPrice: number;
  timestamp: number;
  tokenSymbol: string;
}

export class ParticlePool {
  particles: ParticleData[];
  activeCount = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.particles = [];
    for (let i = 0; i < capacity; i++) {
      this.particles.push(this.createEmpty());
    }
  }

  private createEmpty(): ParticleData {
    return {
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      size: 0, targetSize: 0,
      opacity: 0,
      energy: 0,
      r: 1, g: 1, b: 1,
      age: 0, maxAge: 1,
      isWhale: false,
      chainId: '',
      dampingMult: 1,
      energyHalfLifeMult: 1,
      whaleGlowIntensity: 0,
      whaleValue: 0,
      trailX: new Array(TRAIL_LENGTH).fill(0),
      trailY: new Array(TRAIL_LENGTH).fill(0),
      trailZ: new Array(TRAIL_LENGTH).fill(0),
      trailHead: 0,
      trailFill: 0,
      trailTimer: 0,
      hash: '', from: '', to: null,
      value: 0, gasPrice: 0, timestamp: 0,
      tokenSymbol: '',
    };
  }

  spawn(config: SpawnConfig): number {
    let idx = -1;

    for (let i = 0; i < this.capacity; i++) {
      if (!this.particles[i].active) {
        idx = i;
        break;
      }
    }

    if (idx === -1) {
      let maxRatio = -1;
      for (let i = 0; i < this.capacity; i++) {
        const p = this.particles[i];
        if (p.isWhale && !config.isWhale) continue;
        const ratio = p.age / p.maxAge;
        if (ratio > maxRatio) {
          maxRatio = ratio;
          idx = i;
        }
      }
      if (idx === -1) idx = 0;
    }

    const p = this.particles[idx];
    p.active = true;
    p.x = config.x; p.y = config.y; p.z = config.z;
    p.vx = config.vx; p.vy = config.vy; p.vz = config.vz;
    p.targetSize = config.size;
    p.size = 0;
    p.r = config.r; p.g = config.g; p.b = config.b;
    p.opacity = 0;
    p.energy = LIFECYCLE.initialEnergy;
    p.age = 0;
    p.maxAge = config.maxAge;
    p.isWhale = config.isWhale;
    p.chainId = config.chainId;
    p.dampingMult = config.dampingMult;
    p.energyHalfLifeMult = config.energyHalfLifeMult;
    p.whaleGlowIntensity = 0;
    p.whaleValue = config.whaleValue;
    p.hash = config.hash;
    p.from = config.from;
    p.to = config.to;
    p.value = config.value;
    p.gasPrice = config.gasPrice;
    p.timestamp = config.timestamp;
    p.tokenSymbol = config.tokenSymbol;

    for (let t = 0; t < TRAIL_LENGTH; t++) {
      p.trailX[t] = config.x;
      p.trailY[t] = config.y;
      p.trailZ[t] = config.z;
    }
    p.trailHead = 0;
    p.trailFill = 0;
    p.trailTimer = 0;

    return idx;
  }

  update(dt: number): void {
    this.activeCount = 0;

    // Collect active whale particles for attraction pass
    const whales: ParticleData[] = [];

    // Base damping/decay values — per-particle multipliers applied in the loop
    const baseDampLog = Math.log(LIFECYCLE.velocityDampingRate);
    const baseEnergyRate = LN2 / LIFECYCLE.energyHalfLife;
    const opacityDecay = Math.exp(-dt * LN2 / LIFECYCLE.opacityHalfLife);

    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      // ── Advance age ───────────────────────────
      p.age += dt;
      const life = p.age / p.maxAge;

      // ── Primary death: lifetime exceeded ──────
      if (p.age >= p.maxAge) {
        p.active = false;
        continue;
      }

      // ── Trail sampling (before position update) ──
      p.trailTimer += dt;
      if (p.trailTimer >= LIFECYCLE.trailSampleInterval) {
        p.trailTimer = 0;
        p.trailX[p.trailHead] = p.x;
        p.trailY[p.trailHead] = p.y;
        p.trailZ[p.trailHead] = p.z;
        p.trailHead = (p.trailHead + 1) % TRAIL_LENGTH;
        if (p.trailFill < TRAIL_LENGTH) p.trailFill++;
      }

      // ── Position update ───────────────────────
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // ── Frame-rate-independent velocity damping (per-particle personality) ──
      const velDamp = Math.exp(baseDampLog * p.dampingMult * dt);
      p.vx *= velDamp;
      p.vy *= velDamp;
      p.vz *= velDamp;

      // ── Spawn envelope ────────────────────────
      // Cubic ease-out ramp: fast rise, gentle settle
      const spawnT = Math.min(p.age / LIFECYCLE.spawnDuration, 1);
      const spawnEnv = 1 - Math.pow(1 - spawnT, LIFECYCLE.spawnEaseExponent);

      // Per-particle energy decay using personality multiplier
      const energyDecay = Math.exp(-dt * baseEnergyRate / p.energyHalfLifeMult);

      if (p.isWhale) {
        // ── Whale lifecycle ─────────────────────
        const whaleSpawnT = Math.min(p.age / WHALE_CONFIG.spawnEaseDuration, 1);
        const whaleSpawnEase = 1 - Math.pow(1 - whaleSpawnT, 3);

        const timeLeft = p.maxAge - p.age;
        const decayT = timeLeft < WHALE_CONFIG.glowFallTime
          ? timeLeft / WHALE_CONFIG.glowFallTime
          : 1;
        const decayEase = decayT * decayT * decayT;

        const riseT = Math.min(p.age / WHALE_CONFIG.glowRiseTime, 1);
        const riseEase = 1 - Math.pow(1 - riseT, 3);

        p.whaleGlowIntensity = riseEase * decayEase;

        // Energy decays exponentially even for whales
        p.energy *= energyDecay;

        p.size = p.targetSize * whaleSpawnEase * decayEase;
        p.opacity = whaleSpawnEase * decayEase;

        if (whales.length < WHALE_CONFIG.maxSimultaneousWhales) {
          whales.push(p);
        }
      } else {
        // ── Standard particle lifecycle ─────────

        // Energy: pure exponential decay
        p.energy *= energyDecay;

        // Size: spawn envelope → sustain → eased shrink
        if (life < LIFECYCLE.sizeFadeStart) {
          p.size = p.targetSize * spawnEnv;
        } else {
          // Smooth shrink: quadratic/cubic ease-in toward 0
          const shrinkProgress = (life - LIFECYCLE.sizeFadeStart) / (1 - LIFECYCLE.sizeFadeStart);
          const shrinkFactor = 1 - Math.pow(shrinkProgress, LIFECYCLE.sizeShrinkExponent);
          p.size = p.targetSize * shrinkFactor;
        }

        // Opacity: spawn envelope → sustain → exponential fade with smoothstep onset
        if (life < LIFECYCLE.opacityFadeStart) {
          // In the sustain window, just apply spawn envelope
          p.opacity = spawnEnv;
        } else {
          // Smoothstep transition into exponential decay zone
          const fadeProgress = (life - LIFECYCLE.opacityFadeStart) / (1 - LIFECYCLE.opacityFadeStart);
          // smoothstep: 3t² - 2t³
          const smoothFade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
          // Blend from full opacity toward exponential-decayed value
          p.opacity = spawnEnv * (1 - smoothFade) + (spawnEnv * p.energy) * smoothFade;
        }

        // Modulate opacity by energy for natural intensity coupling
        p.opacity *= (0.3 + 0.7 * p.energy);
      }

      // ── Early death: below visibility thresholds ──
      if (p.opacity < LIFECYCLE.minOpacity ||
          p.energy < LIFECYCLE.minEnergy ||
          p.size < LIFECYCLE.minSize) {
        p.active = false;
        continue;
      }

      this.activeCount++;
    }

    // ── Gravitational attraction pass ───────────
    if (whales.length > 0) {
      const aRadius = WHALE_CONFIG.attractionRadius;
      const aRadiusSq = aRadius * aRadius;
      const aStrength = WHALE_CONFIG.attractionStrength;
      const swirl = WHALE_CONFIG.swirlFactor;

      for (let i = 0; i < this.capacity; i++) {
        const p = this.particles[i];
        if (!p.active || p.isWhale) continue;

        for (const w of whales) {
          const dx = w.x - p.x;
          const dy = w.y - p.y;
          const dz = w.z - p.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq > aRadiusSq || distSq < 0.01) continue;

          const dist = Math.sqrt(distSq);
          const normDist = dist / aRadius;
          const edge = 1 - normDist * normDist * (3 - 2 * normDist);
          const forceMag = aStrength * edge * w.whaleGlowIntensity / (1 + distSq);

          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          // Tangential: cross(n, up) where up = (0, 0, 1) → (ny, -nx, 0)
          let tx = ny;
          let ty = -nx;
          let tz = 0;
          const tLen = Math.sqrt(tx * tx + ty * ty);
          if (tLen > 0.001) {
            tx /= tLen;
            ty /= tLen;
          }

          const radial = forceMag * (1 - swirl);
          const tangential = forceMag * swirl;

          p.vx += (nx * radial + tx * tangential) * dt;
          p.vy += (ny * radial + ty * tangential) * dt;
          p.vz += (nz * radial + tz * tangential) * dt;
        }
      }
    }
  }

  writeBuffers(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
    opacities: Float32Array,
    energies: Float32Array,
    isWhaleArr: Float32Array,
    indexMap: number[],
  ): number {
    let idx = 0;
    indexMap.length = 0;

    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      const j = idx * 3;
      positions[j] = p.x;
      positions[j + 1] = p.y;
      positions[j + 2] = p.z;
      colors[j] = p.r;
      colors[j + 1] = p.g;
      colors[j + 2] = p.b;
      sizes[idx] = p.size;
      opacities[idx] = p.opacity;
      energies[idx] = p.energy;
      isWhaleArr[idx] = p.isWhale ? 1 : 0;
      indexMap.push(i);
      idx++;
    }
    return idx;
  }

  writeTrailBuffers(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
    opacities: Float32Array,
    isWhaleArr: Float32Array,
  ): number {
    let idx = 0;

    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.active || p.trailFill === 0) continue;

      const whaleFlag = p.isWhale ? 1 : 0;

      // Velocity-scaled trail: faster particles get more visible trails
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
      const speedFactor = Math.min(speed / 0.3, 1); // normalize: 0.3 units/s = full trail
      const trailVisibility = 0.3 + speedFactor * 0.7; // 30-100% visibility based on speed

      for (let t = 0; t < p.trailFill; t++) {
        const bufIdx = (p.trailHead - p.trailFill + t + TRAIL_LENGTH) % TRAIL_LENGTH;
        const linearFresh = (t + 1) / p.trailFill;
        // Cubic freshness curve: trails fade more gracefully near the tail
        const freshness = linearFresh * linearFresh * (3 - 2 * linearFresh);

        const j = idx * 3;
        positions[j] = p.trailX[bufIdx];
        positions[j + 1] = p.trailY[bufIdx];
        positions[j + 2] = p.trailZ[bufIdx];
        colors[j] = p.r;
        colors[j + 1] = p.g;
        colors[j + 2] = p.b;
        sizes[idx] = p.size * freshness * 0.45 * trailVisibility;
        // Trail opacity couples with parent energy and velocity for coherent dimming
        opacities[idx] = p.opacity * freshness * 0.4 * trailVisibility;
        isWhaleArr[idx] = whaleFlag;
        idx++;
      }
    }
    return idx;
  }

  clear(): void {
    for (const p of this.particles) {
      p.active = false;
    }
    this.activeCount = 0;
  }
}
