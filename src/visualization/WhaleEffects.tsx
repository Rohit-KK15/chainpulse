import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { drainWhaleRipples } from './whaleEvents';

const MAX_RIPPLES = 8;
const RIPPLE_DURATION = 3;
const RIPPLE_MAX_SCALE = 12;

interface RippleState {
  active: boolean;
  progress: number;
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
}

export function WhaleEffects() {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ripples = useRef<RippleState[]>(
    Array.from({ length: MAX_RIPPLES }, () => ({
      active: false,
      progress: 0,
      x: 0, y: 0, z: 0,
      r: 1, g: 1, b: 1,
    })),
  );

  useFrame((_, delta) => {
    const newRipples = drainWhaleRipples();
    for (const nr of newRipples) {
      const slot = ripples.current.find((r) => !r.active);
      if (slot) {
        slot.active = true;
        slot.progress = 0;
        slot.x = nr.position[0];
        slot.y = nr.position[1];
        slot.z = nr.position[2];
        slot.r = nr.color[0];
        slot.g = nr.color[1];
        slot.b = nr.color[2];
      }
    }

    ripples.current.forEach((r, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;

      if (!r.active) {
        mesh.visible = false;
        return;
      }

      r.progress += delta / RIPPLE_DURATION;
      if (r.progress >= 1) {
        r.active = false;
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      const scale = 1 + r.progress * RIPPLE_MAX_SCALE;
      mesh.scale.set(scale, scale, scale);
      mesh.position.set(r.x, r.y, r.z);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.setRGB(r.r, r.g, r.b);
      mat.opacity = (1 - r.progress) * 0.5;
    });
  });

  return (
    <>
      {Array.from({ length: MAX_RIPPLES }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          visible={false}
          rotation={[
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            0,
          ]}
        >
          <ringGeometry args={[0.85, 1, 64]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}
