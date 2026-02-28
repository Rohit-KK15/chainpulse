import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { drainBridgeArcs, BridgeArcEvent } from './bridgeArcEvents';

const MAX_ARCS = 10;
const ARC_LIFETIME = 3.0; // seconds
const ARC_SEGMENTS = 32;

interface ActiveArc {
  from: THREE.Vector3;
  to: THREE.Vector3;
  control: THREE.Vector3;
  color: THREE.Color;
  age: number;
  lifetime: number;
  thickness: number;
}

export function BridgeArcs() {
  const arcsRef = useRef<ActiveArc[]>([]);
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array(MAX_ARCS).fill(null));
  const geometriesRef = useRef<THREE.TubeGeometry[]>([]);

  useFrame((_, delta) => {
    // Drain new events
    const events = drainBridgeArcs();
    for (const event of events) {
      if (arcsRef.current.length >= MAX_ARCS) {
        arcsRef.current.shift();
      }

      const from = new THREE.Vector3(...event.fromCenter);
      const to = new THREE.Vector3(...event.toCenter);
      // Control point: midpoint raised above the plane
      const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
      mid.z += 3 + Math.min(event.value, 10) * 0.3;

      arcsRef.current.push({
        from,
        to,
        control: mid,
        color: new THREE.Color(event.color[0], event.color[1], event.color[2]),
        age: 0,
        lifetime: ARC_LIFETIME,
        thickness: Math.min(0.02 + event.value * 0.005, 0.08),
      });
    }

    // Update ages
    arcsRef.current = arcsRef.current.filter((arc) => {
      arc.age += delta;
      return arc.age < arc.lifetime;
    });

    // Update mesh geometries
    for (let i = 0; i < MAX_ARCS; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      const arc = arcsRef.current[i];
      if (!arc) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;
      const progress = arc.age / arc.lifetime;
      const opacity = progress < 0.1 ? progress / 0.1
        : progress > 0.7 ? (1 - progress) / 0.3
        : 1;

      // Create animated tube — draw length based on age
      const drawLength = Math.min(arc.age / 0.5, 1); // fully drawn in 0.5s
      const curve = new THREE.QuadraticBezierCurve3(arc.from, arc.control, arc.to);

      // Dispose old geometry
      if (geometriesRef.current[i]) {
        geometriesRef.current[i].dispose();
      }

      const partialCurve = {
        getPoint: (t: number) => curve.getPoint(t * drawLength),
      } as THREE.Curve<THREE.Vector3>;

      const geom = new THREE.TubeGeometry(partialCurve, ARC_SEGMENTS, arc.thickness, 6, false);
      geometriesRef.current[i] = geom;
      mesh.geometry = geom;

      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(arc.color);
      mat.opacity = opacity * 0.6;
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_ARCS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <tubeGeometry args={[new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 0.01)), 2, 0.01, 4, false]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
