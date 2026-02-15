import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';
import { drainBlockPulses } from './blockPulseEvents';
import { blockPulseVertexShader, blockPulseFragmentShader } from './shaders';

const MAX_PULSES = 6;
const PULSE_DURATION = 1.8;
const PULSE_MAX_RADIUS = 8;

interface PulseState {
  active: boolean;
  age: number;
  cx: number;
  cy: number;
  cz: number;
  r: number;
  g: number;
  b: number;
}

export function BlockPulse() {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const materials = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const pulses = useRef<PulseState[]>(
    Array.from({ length: MAX_PULSES }, () => ({
      active: false,
      age: 0,
      cx: 0, cy: 0, cz: 0,
      r: 1, g: 1, b: 1,
    })),
  );

  const planeGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useFrame((_, delta) => {
    // Drain new block pulse events
    const events = drainBlockPulses('blockPulseVisual');
    for (const ev of events) {
      const slot = pulses.current.find((p) => !p.active);
      if (slot) {
        slot.active = true;
        slot.age = 0;
        slot.cx = ev.center[0];
        slot.cy = ev.center[1];
        slot.cz = ev.center[2];
        slot.r = ev.color[0];
        slot.g = ev.color[1];
        slot.b = ev.color[2];
      }
    }

    // Update each pulse
    pulses.current.forEach((p, i) => {
      const group = groupRefs.current[i];
      const mat = materials.current[i];
      if (!group || !mat) return;

      if (!p.active) {
        group.visible = false;
        return;
      }

      p.age += delta;
      const progress = p.age / PULSE_DURATION;

      if (progress >= 1) {
        p.active = false;
        group.visible = false;
        return;
      }

      group.visible = true;
      group.position.set(p.cx, p.cy, p.cz);

      // Scale grows with ease-out
      const easeProgress = 1 - Math.pow(1 - progress, 2);
      const radius = PULSE_MAX_RADIUS * easeProgress;
      group.scale.setScalar(radius);

      // Opacity fades out with cubic ease
      const opacity = Math.pow(1 - progress, 3);

      mat.uniforms.uColor.value.set(p.r, p.g, p.b);
      mat.uniforms.uProgress.value = easeProgress;
      mat.uniforms.uOpacity.value = opacity;
    });
  });

  return (
    <>
      {Array.from({ length: MAX_PULSES }, (_, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
          visible={false}
        >
          <Billboard>
            <mesh geometry={planeGeo}>
              <shaderMaterial
                ref={(el) => { materials.current[i] = el; }}
                vertexShader={blockPulseVertexShader}
                fragmentShader={blockPulseFragmentShader}
                uniforms={{
                  uColor: { value: new THREE.Color(1, 1, 1) },
                  uProgress: { value: 0 },
                  uOpacity: { value: 0 },
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
