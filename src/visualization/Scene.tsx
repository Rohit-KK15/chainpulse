import { Suspense, useState, useCallback, useSyncExternalStore } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ParticleField } from './ParticleField';
import { WhaleEffects } from './WhaleEffects';
import { BlockPulse } from './BlockPulse';
import { AmbientField } from './AmbientField';

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
}

export function Scene() {
  const [contextLost, setContextLost] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      setContextLost(false);
    });
  }, []);

  return (
    <>
      {contextLost && (
        <div className="scene-error">
          <div className="scene-error-icon">◉</div>
          <h2>WebGL Context Lost</h2>
          <p>The GPU context was lost. Waiting for restoration...</p>
        </div>
      )}
      <Canvas
        camera={{ position: [0, 0, 22], fov: 60, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        onCreated={handleCreated}
      >
        <color attach="background" args={['#030308']} />

        <Suspense fallback={null}>
          <AmbientField />
          <ParticleField />
          <WhaleEffects />
          <BlockPulse />

          <EffectComposer>
            <Bloom
              intensity={1.5}
              luminanceThreshold={0.12}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.2}
          minDistance={10}
          maxDistance={45}
        />
      </Canvas>
    </>
  );
}
