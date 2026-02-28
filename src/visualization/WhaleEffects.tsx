import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';
import { drainWhaleEvents } from './whaleEvents';
import { WHALE_CONFIG } from '../config/whaleConfig';
import { whaleGlowVertexShader, whaleGlowFragmentShader } from './shaders';
import { particlePoolRef } from './ParticleField';

const MAX_AURAS = WHALE_CONFIG.maxSimultaneousWhales;

interface AuraState {
  active: boolean;
  poolIndex: number;
  value: number;
  r: number;
  g: number;
  b: number;
}

export function WhaleEffects() {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const materials = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const auras = useRef<AuraState[]>(
    Array.from({ length: MAX_AURAS }, () => ({
      active: false,
      poolIndex: -1,
      value: 0,
      r: 1, g: 1, b: 1,
    })),
  );

  const circleGeo = useMemo(() => new THREE.CircleGeometry(0.5, 64), []);

  useFrame((state) => {
    const pool = particlePoolRef.current;
    const time = state.clock.elapsedTime;

    // Drain new whale events
    const events = drainWhaleEvents();
    for (const ev of events) {
      const slot = auras.current.find((a) => !a.active);
      if (slot) {
        slot.active = true;
        slot.poolIndex = ev.poolIndex;
        slot.value = ev.value;
        slot.r = ev.color[0];
        slot.g = ev.color[1];
        slot.b = ev.color[2];
      }
    }

    // Update aura positions and materials
    auras.current.forEach((a, i) => {
      const group = groupRefs.current[i];
      const mat = materials.current[i];
      if (!group || !mat) return;

      if (!a.active) {
        group.visible = false;
        return;
      }

      // Check if the whale particle is still alive
      if (!pool || a.poolIndex < 0 || !pool.particles[a.poolIndex].active ||
          !pool.particles[a.poolIndex].isWhale) {
        a.active = false;
        group.visible = false;
        return;
      }

      const p = pool.particles[a.poolIndex];
      group.visible = true;

      // Position follows whale particle
      group.position.set(p.x, p.y, p.z);

      // Scale based on config and whale value
      const radius = WHALE_CONFIG.glowBaseRadius * (1 + a.value * 0.5);
      group.scale.setScalar(radius);

      // Update shader uniforms
      mat.uniforms.uColor.value.set(a.r, a.g, a.b);
      mat.uniforms.uIntensity.value = WHALE_CONFIG.glowMaxIntensity * p.whaleGlowIntensity;
      mat.uniforms.uTime.value = time;
    });
  });

  return (
    <>
      {Array.from({ length: MAX_AURAS }, (_, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
          visible={false}
        >
          <Billboard>
            <mesh geometry={circleGeo}>
              <shaderMaterial
                ref={(el) => { materials.current[i] = el; }}
                vertexShader={whaleGlowVertexShader}
                fragmentShader={whaleGlowFragmentShader}
                uniforms={{
                  uColor: { value: new THREE.Color(1, 1, 1) },
                  uIntensity: { value: 0 },
                  uTime: { value: 0 },
                }}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
          </Billboard>
        </group>
      ))}
    </>
  );
}
