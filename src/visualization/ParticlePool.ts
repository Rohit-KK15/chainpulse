export const TRAIL_LENGTH = 8;

export interface ParticleData {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  targetSize: number;
  r: number;
  g: number;
  b: number;
  opacity: number;
  age: number;
  maxAge: number;
  isWhale: boolean;
  chainId: string;
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
  hash: string;
  from: string;
  to: string | null;
  value: number;
  gasPrice: number;
  timestamp: number;
}

const TRAIL_SAMPLE_INTERVAL = 0.06;

export class ParticlePool {
  particles: ParticleData[];
  activeCount = 0;
  private capacity: number;

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
      r: 1, g: 1, b: 1,
      opacity: 0,
      age: 0, maxAge: 1,
      isWhale: false,
      chainId: '',
      trailX: new Array(TRAIL_LENGTH).fill(0),
      trailY: new Array(TRAIL_LENGTH).fill(0),
      trailZ: new Array(TRAIL_LENGTH).fill(0),
      trailHead: 0,
      trailFill: 0,
      trailTimer: 0,
      hash: '', from: '', to: null,
      value: 0, gasPrice: 0, timestamp: 0,
    };
  }

  spawn(config: SpawnConfig): void {
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
    p.age = 0;
    p.maxAge = config.maxAge;
    p.isWhale = config.isWhale;
    p.chainId = config.chainId;
    p.hash = config.hash;
    p.from = config.from;
    p.to = config.to;
    p.value = config.value;
    p.gasPrice = config.gasPrice;
    p.timestamp = config.timestamp;

    // Initialize trail to spawn position
    for (let t = 0; t < TRAIL_LENGTH; t++) {
      p.trailX[t] = config.x;
      p.trailY[t] = config.y;
      p.trailZ[t] = config.z;
    }
    p.trailHead = 0;
    p.trailFill = 0;
    p.trailTimer = 0;
  }

  update(dt: number): void {
    this.activeCount = 0;

    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        continue;
      }

      // Sample trail before moving
      p.trailTimer += dt;
      if (p.trailTimer >= TRAIL_SAMPLE_INTERVAL) {
        p.trailTimer = 0;
        p.trailX[p.trailHead] = p.x;
        p.trailY[p.trailHead] = p.y;
        p.trailZ[p.trailHead] = p.z;
        p.trailHead = (p.trailHead + 1) % TRAIL_LENGTH;
        if (p.trailFill < TRAIL_LENGTH) p.trailFill++;
      }

      const life = p.age / p.maxAge;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      p.vx *= 0.99;
      p.vy *= 0.99;
      p.vz *= 0.99;

      if (life < 0.1) {
        p.size = p.targetSize * (life / 0.1);
      } else if (life > 0.75) {
        p.size = p.targetSize * (1 - (life - 0.75) / 0.25);
      } else {
        p.size = p.targetSize;
      }

      if (life < 0.05) {
        p.opacity = life / 0.05;
      } else if (life > 0.7) {
        p.opacity = 1 - (life - 0.7) / 0.3;
      } else {
        p.opacity = 1;
      }

      this.activeCount++;
    }
  }

  writeBuffers(
    positions: Float32Array,
    colors: Float32Array,
    sizes: Float32Array,
    opacities: Float32Array,
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
  ): number {
    let idx = 0;

    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.active || p.trailFill === 0) continue;

      for (let t = 0; t < p.trailFill; t++) {
        // Read from oldest to newest
        const bufIdx = (p.trailHead - p.trailFill + t + TRAIL_LENGTH) % TRAIL_LENGTH;
        const freshness = (t + 1) / p.trailFill; // 0→oldest, 1→newest

        const j = idx * 3;
        positions[j] = p.trailX[bufIdx];
        positions[j + 1] = p.trailY[bufIdx];
        positions[j + 2] = p.trailZ[bufIdx];
        colors[j] = p.r;
        colors[j + 1] = p.g;
        colors[j + 2] = p.b;
        sizes[idx] = p.size * freshness * 0.4;
        opacities[idx] = p.opacity * freshness * 0.35;
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
