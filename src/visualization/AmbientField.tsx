import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ambientVertexShader, ambientFragmentShader } from './shaders';
import { useStore } from '../stores/useStore';
import { CHAINS } from '../config/chains';
import { hexToRgb } from '../utils/color';

const STAR_COUNT = 1200;

export function AmbientField() {
  const { gl } = useThree();

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 20;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.5 + Math.random() * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: ambientVertexShader,
      fragmentShader: ambientFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uColor: { value: new THREE.Color(0.25, 0.25, 0.35) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, [gl]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;

    const focused = useStore.getState().focusedChain;
    const c = material.uniforms.uColor.value as THREE.Color;

    if (focused) {
      const config = CHAINS[focused];
      if (config) {
        const rgb = hexToRgb(config.color.primary);
        c.r += (rgb[0] * 0.3 - c.r) * 0.02;
        c.g += (rgb[1] * 0.3 - c.g) * 0.02;
        c.b += (rgb[2] * 0.3 - c.b) * 0.02;
      }
    } else {
      c.r += (0.2 - c.r) * 0.02;
      c.g += (0.2 - c.g) * 0.02;
      c.b += (0.28 - c.b) * 0.02;
    }
  });

  return <points geometry={geometry} material={material} />;
}
