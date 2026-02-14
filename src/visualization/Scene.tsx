import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { ParticleField } from './ParticleField';
import { WhaleEffects } from './WhaleEffects';
import { AmbientField } from './AmbientField';

export function Scene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 22], fov: 60, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#030308']} />

      <Suspense fallback={null}>
        <AmbientField />
        <ParticleField />
        <WhaleEffects />

        <EffectComposer>
          <Bloom
            intensity={1.5}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        autoRotate
        autoRotateSpeed={0.2}
        minDistance={10}
        maxDistance={45}
      />
    </Canvas>
  );
}
