import { Suspense, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { ParticleField } from './ParticleField';
import { WhaleEffects } from './WhaleEffects';
import { BlockPulse } from './BlockPulse';
import { AmbientField } from './AmbientField';
import { BridgeArcs } from './BridgeArcs';
import { useStore } from '../stores/useStore';

/** Expose the WebGL canvas globally so the screenshot feature can capture it */
export let sceneCanvas: HTMLCanvasElement | null = null;

function useIsTouchDevice(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  );
}

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

function CameraController({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const targetVec = useRef(new THREE.Vector3());
  const currentTarget = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const s = useStore.getState();
    targetVec.current.set(s.cameraTarget[0], s.cameraTarget[1], s.cameraTarget[2]);

    // Smooth lerp toward target
    const lerpSpeed = Math.min(delta * 3, 1);
    currentTarget.current.lerp(targetVec.current, lerpSpeed);
    controls.target.copy(currentTarget.current);

    // Smooth zoom
    const currentDist = controls.getDistance();
    const targetDist = s.cameraDistance;
    if (Math.abs(currentDist - targetDist) > 0.1) {
      const camDir = new THREE.Vector3();
      camDir.subVectors(controls.object.position, controls.target).normalize();
      const newDist = currentDist + (targetDist - currentDist) * lerpSpeed;
      controls.object.position.copy(controls.target).addScaledVector(camDir, newDist);
    }

    controls.update();
  });

  return null;
}

export function Scene() {
  const [contextLost, setContextLost] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const isTouch = useIsTouchDevice();
  const controlsRef = useRef<any>(null);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    const canvas = gl.domElement;
    sceneCanvas = canvas;
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
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        onCreated={handleCreated}
      >
        <color attach="background" args={['#030308']} />

        <Suspense fallback={null}>
          <AmbientField />
          <ParticleField />
          <WhaleEffects />
          <BlockPulse />
          <BridgeArcs />

          <EffectComposer>
            <Bloom
              intensity={1.5}
              luminanceThreshold={0.12}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>

        <CameraController controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          autoRotate={!reducedMotion && !isTouch}
          autoRotateSpeed={0.2}
          minDistance={10}
          maxDistance={45}
        />
      </Canvas>
    </>
  );
}
