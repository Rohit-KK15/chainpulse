import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { InspectedTx } from '../stores/useStore';
import { ParticlePool, TRAIL_LENGTH } from './ParticlePool';
import { txQueue } from '../processing/TransactionQueue';
import { queueWhaleEvent } from './whaleEvents';
import { useStore } from '../stores/useStore';
import { CHAINS } from '../config/chains';
import { getPersonality } from '../config/chainPersonalities';
import { activityMonitor } from '../processing/ActivityMonitor';
import { drainBlockPulses } from './blockPulseEvents';
import { particleVertexShader, particleFragmentShader } from './shaders';

// Reduce particle count on low-end / mobile devices
const IS_LOW_END = typeof navigator !== 'undefined' && (
  navigator.hardwareConcurrency <= 4 || ('ontouchstart' in window && window.innerWidth < 768)
);
const MAX_PARTICLES = IS_LOW_END ? 300 : 600;
const MAX_TRAIL_POINTS = MAX_PARTICLES * TRAIL_LENGTH;
const SPREAD_WINDOW = 0.5;   // drain any queue buildup over ~0.5 seconds
const MIN_DRAIN_RATE = 2.0;  // floor prevents zero-spawn gaps between ticks
const MAX_PER_FRAME = IS_LOW_END ? 8 : 12;  // cap to prevent frame drops
const SPAWN_RADIUS = 3.5;
const PULSE_NUDGE_RADIUS = 5;
const PULSE_NUDGE_STRENGTH = 0.1;
const PULSE_NUDGE_DURATION = 2.0;
const TOUCH_TAP_THRESHOLD = 10; // px — touch moves within this are taps, not drags

interface ActivePulse {
  cx: number; cy: number; cz: number;
  age: number;
}

// Module-level ref so WhaleEffects can read pool data
export const particlePoolRef: { current: ParticlePool | null } = { current: null };

export function ParticleField() {
  const poolRef = useRef(new ParticlePool(MAX_PARTICLES));
  const indexMapRef = useRef<number[]>([]);
  const activePulses = useRef<ActivePulse[]>([]);
  const pulsesToRemoveRef = useRef<number[]>([]);
  const { gl, camera } = useThree();
  const transitionOpacity = useRef(1);

  // Expose pool ref at module level
  useEffect(() => {
    particlePoolRef.current = poolRef.current;
    return () => { particlePoolRef.current = null; };
  }, []);

  // Main particle geometry + material
  const { mainGeo, mainMat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
    geo.setAttribute('aEnergy', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
    geo.setAttribute('aIsWhale', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uPixelRatio: { value: gl.getPixelRatio() },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    return { mainGeo: geo, mainMat: mat };
  }, [gl]);

  // Trail geometry + material (same shader, rendered behind)
  const { trailGeo, trailMat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS), 1));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS), 1));
    geo.setAttribute('aEnergy', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS), 1));
    geo.setAttribute('aIsWhale', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS), 1));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      uniforms: {
        uPixelRatio: { value: gl.getPixelRatio() },
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    return { trailGeo: geo, trailMat: mat };
  }, [gl]);

  // Dispose GPU resources on unmount
  useEffect(() => {
    return () => {
      mainGeo.dispose();
      mainMat.dispose();
      trailGeo.dispose();
      trailMat.dispose();
    };
  }, [mainGeo, mainMat, trailGeo, trailMat]);

  // ── DOM-based pointer events (R3F events don't fire on <points> without threshold config) ──
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseVec = useRef(new THREE.Vector2());
  const tmpVec = useRef(new THREE.Vector3());

  useEffect(() => {
    const canvas = gl.domElement;
    let lastMoveTime = 0;
    let pointerDownPos: { x: number; y: number } | null = null;

    function findNearest(clientX: number, clientY: number): InspectedTx | null {
      const pool = poolRef.current;
      const map = indexMapRef.current;
      if (map.length === 0) return null;

      const rect = canvas.getBoundingClientRect();
      mouseVec.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycasterRef.current.setFromCamera(mouseVec.current, camera);
      const ray = raycasterRef.current.ray;

      const camDist = camera.position.length();
      const hitThreshold = 0.5 + camDist * 0.04;
      let closestDist = hitThreshold;
      let closestIdx = -1;

      for (let i = 0; i < map.length; i++) {
        const p = pool.particles[map[i]];
        if (!p.active) continue;
        tmpVec.current.set(p.x, p.y, p.z);
        const dist = ray.distanceToPoint(tmpVec.current);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx < 0) return null;
      const p = pool.particles[map[closestIdx]];
      return {
        hash: p.hash,
        from: p.from,
        to: p.to,
        value: p.value,
        gasPrice: p.gasPrice,
        chainId: p.chainId,
        timestamp: p.timestamp,
        blockNumber: p.blockNumber,
        screenX: clientX,
        screenY: clientY,
        tokenSymbol: p.tokenSymbol || undefined,
        isStablecoin: p.isStablecoin || undefined,
      };
    }

    function onPointerDown(e: PointerEvent) {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    }

    function onPointerUp(e: PointerEvent) {
      // Only treat as click if pointer didn't move much (distinguishes from orbit drag)
      if (pointerDownPos) {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        if (dx * dx + dy * dy < TOUCH_TAP_THRESHOLD * TOUCH_TAP_THRESHOLD) {
          const hit = findNearest(e.clientX, e.clientY);
          useStore.getState().setInspectedTx(hit);
        }
      }
      pointerDownPos = null;
    }

    function onPointerMove(e: PointerEvent) {
      // Skip hover on touch devices
      if (e.pointerType === 'touch') return;

      const now = performance.now();
      if (now - lastMoveTime < 50) return;
      lastMoveTime = now;

      // Don't show tooltip when full panel is open
      if (useStore.getState().inspectedTx) return;

      const hit = findNearest(e.clientX, e.clientY);
      useStore.getState().setHoveredTx(hit);
      canvas.style.cursor = hit ? 'pointer' : '';
    }

    function onPointerLeave() {
      useStore.getState().setHoveredTx(null);
      canvas.style.cursor = '';
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [gl, camera]);

  useFrame((state, delta) => {
    const pool = poolRef.current;
    const focusedChain = useStore.getState().focusedChain;
    const isTransitioning = useStore.getState().transitioning;

    // Smooth transition opacity (#7)
    const targetOpacity = isTransitioning ? 0 : 1;
    transitionOpacity.current += (targetOpacity - transitionOpacity.current) * Math.min(delta * 5, 1);

    // Read filter state once per frame
    const enabledChains = useStore.getState().enabledChains;
    const enabledTokens = useStore.getState().enabledTokens;

    // Drain queued transactions and spawn particles at chain cluster positions
    const queueSize = txQueue.size;
    const targetRate = Math.max(queueSize / SPREAD_WINDOW, MIN_DRAIN_RATE);
    const spawnsThisFrame = Math.min(Math.ceil(targetRate * delta), MAX_PER_FRAME);
    const batch = txQueue.drain(spawnsThisFrame);
    for (const tx of batch) {
      // Filter by enabled chains
      if (!enabledChains.has(tx.chainId)) continue;
      // Filter by enabled tokens
      const symbol = tx.tokenInfo?.symbol ?? CHAINS[tx.chainId]?.nativeCurrency;
      if (symbol && !enabledTokens.has(symbol)) continue;
      const chainCenter = CHAINS[tx.chainId]?.center ?? [0, 0, 0];
      const personality = getPersonality(tx.chainId);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = (1 + Math.random() * SPAWN_RADIUS) * personality.spawnSpread;

      const x = chainCenter[0] + r * Math.sin(phi) * Math.cos(theta);
      const y = chainCenter[1] + r * Math.sin(phi) * Math.sin(theta);
      const z = chainCenter[2] + r * Math.cos(phi);

      const baseSpeed = tx.isWhale ? 0.1 : 0.2;
      // Activity dynamics: high activity boosts speed up to 30%, low activity calms it
      const activity = activityMonitor.getActivityLevel(tx.chainId);
      const activityBoost = 0.7 + Math.min(activity, 2) * 0.3;
      const speed = baseSpeed * personality.speedMultiplier * activityBoost;
      // Smoothness reduces jitter: lerp velocity toward 0 by motionSmoothness
      const jitter = 1 - personality.motionSmoothness * 0.5;
      const vx = (Math.random() - 0.5) * speed * jitter;
      const vy = (Math.random() - 0.5) * speed * jitter;
      const vz = (Math.random() - 0.5) * speed * jitter;

      const baseSize = tx.isWhale
        ? 2.0 + tx.visual.size * 3.0
        : 0.3 + tx.visual.size * 1.2;
      const maxAge = tx.isWhale
        ? 8 + Math.random() * 4
        : 3 + Math.random() * 3;

      // Normalize whale value for scaling effects (0-1 range)
      const whaleValue = tx.isWhale ? Math.min(tx.visual.size, 1) : 0;

      const poolIndex = pool.spawn({
        x, y, z, vx, vy, vz,
        size: baseSize * personality.glowIntensity,
        r: tx.visual.color[0],
        g: tx.visual.color[1],
        b: tx.visual.color[2],
        maxAge,
        isWhale: tx.isWhale,
        chainId: tx.chainId,
        dampingMult: personality.dampingMultiplier,
        energyHalfLifeMult: personality.energyHalfLifeMult,
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        whaleValue,
        gasPrice: tx.gasPrice,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        tokenSymbol: tx.tokenInfo?.symbol ?? '',
        isStablecoin: tx.tokenInfo?.isStablecoin ?? false,
      });

      // Value spectrum: modulate initial energy by transaction intensity
      if (poolIndex >= 0) {
        const p = pool.particles[poolIndex];
        p.energy = tx.isWhale ? 1.5 : (0.6 + tx.visual.intensity * 0.4);
      }

      if (tx.isWhale) {
        queueWhaleEvent({
          position: [x, y, z],
          color: tx.visual.color,
          poolIndex,
          value: whaleValue,
        });
      }
    }

    pool.update(delta);

    // ── Block pulse particle nudge ──────────────
    for (const ev of drainBlockPulses('particleNudge')) {
      activePulses.current.push({
        cx: ev.center[0], cy: ev.center[1], cz: ev.center[2],
        age: 0,
      });
    }

    // Update and apply active pulse nudges
    const pulsesToRemove = pulsesToRemoveRef.current;
    pulsesToRemove.length = 0;
    for (let pi = 0; pi < activePulses.current.length; pi++) {
      const pulse = activePulses.current[pi];
      pulse.age += delta;
      if (pulse.age >= PULSE_NUDGE_DURATION) {
        pulsesToRemove.push(pi);
        continue;
      }

      const pulseStrength = PULSE_NUDGE_STRENGTH * Math.pow(1 - pulse.age / PULSE_NUDGE_DURATION, 2);
      const pulseRadius = PULSE_NUDGE_RADIUS * (pulse.age / PULSE_NUDGE_DURATION);
      const radiusSq = PULSE_NUDGE_RADIUS * PULSE_NUDGE_RADIUS;

      for (let i = 0; i < pool.capacity; i++) {
        const p = pool.particles[i];
        if (!p.active) continue;

        const dx = p.x - pulse.cx;
        const dy = p.y - pulse.cy;
        const dz = p.z - pulse.cz;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > radiusSq || distSq < 0.01) continue;

        const dist = Math.sqrt(distSq);
        // Particles near the expanding wavefront get the most nudge
        const waveDist = Math.abs(dist - pulseRadius);
        const waveInfluence = Math.exp(-waveDist * waveDist * 2);

        const force = pulseStrength * waveInfluence * delta;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        p.vx += nx * force;
        p.vy += ny * force;
        p.vz += nz * force;
      }
    }
    // Remove expired pulses (iterate backwards)
    for (let i = pulsesToRemove.length - 1; i >= 0; i--) {
      activePulses.current.splice(pulsesToRemove[i], 1);
    }

    // Write main particle buffers
    const positions = mainGeo.attributes.position.array as Float32Array;
    const colors = mainGeo.attributes.color.array as Float32Array;
    const sizes = mainGeo.attributes.aSize.array as Float32Array;
    const opacities = mainGeo.attributes.aOpacity.array as Float32Array;
    const energies = mainGeo.attributes.aEnergy.array as Float32Array;
    const isWhaleArr = mainGeo.attributes.aIsWhale.array as Float32Array;

    const count = pool.writeBuffers(positions, colors, sizes, opacities, energies, isWhaleArr, indexMapRef.current);

    // Apply focus dimming and transition opacity
    const tOp = transitionOpacity.current;
    if (focusedChain || tOp < 0.99) {
      const map = indexMapRef.current;
      for (let i = 0; i < count; i++) {
        const p = pool.particles[map[i]];
        if (focusedChain && p.chainId !== focusedChain) {
          opacities[i] *= 0.15;
          sizes[i] *= 0.6;
        }
        opacities[i] *= tOp;
      }
    }

    mainGeo.attributes.position.needsUpdate = true;
    mainGeo.attributes.color.needsUpdate = true;
    (mainGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (mainGeo.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
    (mainGeo.attributes.aEnergy as THREE.BufferAttribute).needsUpdate = true;
    (mainGeo.attributes.aIsWhale as THREE.BufferAttribute).needsUpdate = true;
    mainGeo.setDrawRange(0, count);

    // Write trail buffers
    const tPos = trailGeo.attributes.position.array as Float32Array;
    const tCol = trailGeo.attributes.color.array as Float32Array;
    const tSiz = trailGeo.attributes.aSize.array as Float32Array;
    const tOpa = trailGeo.attributes.aOpacity.array as Float32Array;
    const tIsWhale = trailGeo.attributes.aIsWhale.array as Float32Array;

    const trailCount = pool.writeTrailBuffers(tPos, tCol, tSiz, tOpa, tIsWhale);

    // Apply transition opacity to trails
    if (tOp < 0.99) {
      for (let i = 0; i < trailCount; i++) {
        tOpa[i] *= tOp;
      }
    }

    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
    (trailGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (trailGeo.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
    (trailGeo.attributes.aIsWhale as THREE.BufferAttribute).needsUpdate = true;
    trailGeo.setDrawRange(0, trailCount);

    // Uniforms
    const t = state.clock.elapsedTime;
    mainMat.uniforms.uTime.value = t;
    trailMat.uniforms.uTime.value = t;
  });

  return (
    <>
      <points geometry={trailGeo} material={trailMat} />
      <points geometry={mainGeo} material={mainMat} />
    </>
  );
}
