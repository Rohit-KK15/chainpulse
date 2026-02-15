import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ambientVertexShader, ambientFragmentShader } from './shaders';
import { useStore } from '../stores/useStore';
import { CHAINS } from '../config/chains';
import { hexToRgb } from '../utils/color';

const STAR_COUNT = 1200;

export function AmbientField() {
  const { gl } = useThree();
  const dimRef = useRef(1);

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    // Store original chain-region association per star for focus dimming
    const chainDists = new Float32Array(STAR_COUNT);

    const chainCenters = Object.values(CHAINS).map((c) => c.center);

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5 + Math.random() * 20;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sizes[i] = 0.5 + Math.random() * 2;

      // Find closest chain center
      let minDist = Infinity;
      for (const center of chainCenters) {
        const dx = x - center[0];
        const dy = y - center[1];
        const dz = z - center[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < minDist) minDist = d;
      }
      chainDists[i] = minDist;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    // We'll store chain distances as custom data for JS-side dimming
    (geo as any)._chainDists = chainDists;

    const mat = new THREE.ShaderMaterial({
      vertexShader: ambientVertexShader,
      fragmentShader: ambientFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uColor: { value: new THREE.Color(0.25, 0.25, 0.35) },
        uDim: { value: 1.0 },
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
    const transitioning = useStore.getState().transitioning;
    const c = material.uniforms.uColor.value as THREE.Color;

    if (focused) {
      const config = CHAINS[focused];
      if (config) {
        const rgb = hexToRgb(config.color.primary);
        c.r += (rgb[0] * 0.3 - c.r) * 0.02;
        c.g += (rgb[1] * 0.3 - c.g) * 0.02;
        c.b += (rgb[2] * 0.3 - c.b) * 0.02;
      }
      // Dim ambient stars when a chain is focused
      dimRef.current += (0.3 - dimRef.current) * 0.04;
    } else {
      c.r += (0.2 - c.r) * 0.02;
      c.g += (0.2 - c.g) * 0.02;
      c.b += (0.28 - c.b) * 0.02;
      dimRef.current += (1 - dimRef.current) * 0.04;
    }

    // Transition fade
    const targetDim = transitioning ? 0 : dimRef.current;
    const currentDim = material.uniforms.uDim.value as number;
    material.uniforms.uDim.value = currentDim + (targetDim - currentDim) * 0.08;
  });

  return <points geometry={geometry} material={material} />;
}
