import { useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticlePool, TRAIL_LENGTH } from './ParticlePool';
import { txQueue } from '../processing/TransactionQueue';
import { queueWhaleRipple } from './whaleEvents';
import { useStore } from '../stores/useStore';
import { CHAINS } from '../config/chains';
import { particleVertexShader, particleFragmentShader } from './shaders';

const MAX_PARTICLES = 600;
const MAX_TRAIL_POINTS = MAX_PARTICLES * TRAIL_LENGTH;
const DRAIN_PER_FRAME = 6;
const SPAWN_RADIUS = 3.5;

export function ParticleField() {
  const poolRef = useRef(new ParticlePool(MAX_PARTICLES));
  const indexMapRef = useRef<number[]>([]);
  const { gl, camera } = useThree();

  // Main particle geometry + material
  const { mainGeo, mainMat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1));
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

  // Click handler for particle inspection
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const pool = poolRef.current;
      const map = indexMapRef.current;

      // Use the intersection index from R3F raycasting
      if (event.index !== undefined && event.index < map.length) {
        const poolIdx = map[event.index];
        const p = pool.particles[poolIdx];
        if (p.active) {
          useStore.getState().setInspectedTx({
            hash: p.hash,
            from: p.from,
            to: p.to,
            value: p.value,
            gasPrice: p.gasPrice,
            chainId: p.chainId,
            timestamp: p.timestamp,
            screenX: event.clientX,
            screenY: event.clientY,
          });
          event.stopPropagation();
          return;
        }
      }

      // Fallback: manual proximity check against camera ray
      const ray = event.ray;
      const tmpVec = new THREE.Vector3();
      let closestDist = 1.5;
      let closestIdx = -1;

      for (let i = 0; i < map.length; i++) {
        const p = pool.particles[map[i]];
        if (!p.active) continue;
        tmpVec.set(p.x, p.y, p.z);
        const dist = ray.distanceToPoint(tmpVec);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }

      if (closestIdx >= 0) {
        const p = pool.particles[map[closestIdx]];
        useStore.getState().setInspectedTx({
          hash: p.hash,
          from: p.from,
          to: p.to,
          value: p.value,
          gasPrice: p.gasPrice,
          chainId: p.chainId,
          timestamp: p.timestamp,
          screenX: event.clientX,
          screenY: event.clientY,
        });
      } else {
        useStore.getState().setInspectedTx(null);
      }
    },
    [],
  );

  useFrame((state, delta) => {
    const pool = poolRef.current;
    const focusedChain = useStore.getState().focusedChain;

    // Drain queued transactions and spawn particles at chain cluster positions
    const batch = txQueue.drain(DRAIN_PER_FRAME);
    for (const tx of batch) {
      const chainCenter = CHAINS[tx.chainId]?.center ?? [0, 0, 0];

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1 + Math.random() * SPAWN_RADIUS;

      const x = chainCenter[0] + r * Math.sin(phi) * Math.cos(theta);
      const y = chainCenter[1] + r * Math.sin(phi) * Math.sin(theta);
      const z = chainCenter[2] + r * Math.cos(phi);

      const speed = tx.isWhale ? 0.1 : 0.2;
      const vx = (Math.random() - 0.5) * speed;
      const vy = (Math.random() - 0.5) * speed;
      const vz = (Math.random() - 0.5) * speed;

      const baseSize = tx.isWhale
        ? 2.0 + tx.visual.size * 3.0
        : 0.3 + tx.visual.size * 1.2;
      const maxAge = tx.isWhale
        ? 8 + Math.random() * 4
        : 3 + Math.random() * 3;

      pool.spawn({
        x, y, z, vx, vy, vz,
        size: baseSize,
        r: tx.visual.color[0],
        g: tx.visual.color[1],
        b: tx.visual.color[2],
        maxAge,
        isWhale: tx.isWhale,
        chainId: tx.chainId,
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gasPrice: tx.gasPrice,
        timestamp: tx.timestamp,
      });

      if (tx.isWhale) {
        queueWhaleRipple({
          position: [x, y, z],
          color: tx.visual.color,
        });
      }
    }

    pool.update(delta);

    // Write main particle buffers
    const positions = mainGeo.attributes.position.array as Float32Array;
    const colors = mainGeo.attributes.color.array as Float32Array;
    const sizes = mainGeo.attributes.aSize.array as Float32Array;
    const opacities = mainGeo.attributes.aOpacity.array as Float32Array;

    const count = pool.writeBuffers(positions, colors, sizes, opacities, indexMapRef.current);

    // Apply focus dimming
    if (focusedChain) {
      const map = indexMapRef.current;
      for (let i = 0; i < count; i++) {
        const p = pool.particles[map[i]];
        if (p.chainId !== focusedChain) {
          opacities[i] *= 0.15;
          sizes[i] *= 0.6;
        }
      }
    }

    mainGeo.attributes.position.needsUpdate = true;
    mainGeo.attributes.color.needsUpdate = true;
    (mainGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (mainGeo.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
    mainGeo.setDrawRange(0, count);

    // Write trail buffers
    const tPos = trailGeo.attributes.position.array as Float32Array;
    const tCol = trailGeo.attributes.color.array as Float32Array;
    const tSiz = trailGeo.attributes.aSize.array as Float32Array;
    const tOpa = trailGeo.attributes.aOpacity.array as Float32Array;

    const trailCount = pool.writeTrailBuffers(tPos, tCol, tSiz, tOpa);

    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
    (trailGeo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (trailGeo.attributes.aOpacity as THREE.BufferAttribute).needsUpdate = true;
    trailGeo.setDrawRange(0, trailCount);

    // Uniforms
    const t = state.clock.elapsedTime;
    mainMat.uniforms.uTime.value = t;
    trailMat.uniforms.uTime.value = t;
  });

  return (
    <>
      <points geometry={trailGeo} material={trailMat} />
      <points
        geometry={mainGeo}
        material={mainMat}
        onClick={handleClick}
      />
    </>
  );
}
