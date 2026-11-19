import { useMemo, useRef } from "react";
import { RoundedBox, Line } from "@react-three/drei";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Shape,
  Vector3,
} from "three";

// Scale around each object's local origin without moving its scene placement.
function HoverScale({ children, ...props }: ThreeElements["group"]) {
  const ref = useRef<Group>(null);
  const hovered = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = hovered.current ? 1.045 : 1;
    const current = ref.current.scale.x;
    const next = current + (target - current) * (1 - Math.exp(-12 * delta));
    ref.current.scale.setScalar(
      Math.abs(next - target) < 0.0001 ? target : next,
    );
    if (ref.current.scale.x !== target) invalidate();
  });
  return (
    <group {...props}>
      <group
        ref={ref}
        onPointerOver={(event) => {
          event.stopPropagation();
          hovered.current = true;
          invalidate();
        }}
        onPointerOut={() => {
          hovered.current = false;
          invalidate();
        }}
      >
        {children}
      </group>
    </group>
  );
}

// Architectural scene geometry is deterministic; it needs no network assets.
export function Runway() {
  return (
    <group position={[0, -1, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[180, 150]} />
        <meshStandardMaterial color="#7c877c" roughness={1} />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[95, 7]} />
        <meshStandardMaterial color="#424c50" roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            position={[0, 0.03, side * 3.15]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[90, 0.075]} />
            <meshBasicMaterial color="#e5e1d3" />
          </mesh>
          {Array.from({ length: 24 }, (_, i) => (
            <mesh key={i} position={[i * 3.8 - 43, 0.09, side * 3.48]}>
              <sphereGeometry args={[0.065, 8, 6]} />
              <meshBasicMaterial color="#ffe0a4" />
            </mesh>
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh
              key={i}
              position={[32, 0.04, side * (0.45 + i * 0.4)]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[4, 0.22]} />
              <meshBasicMaterial color="#e6e4dd" />
            </mesh>
          ))}
        </group>
      ))}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh
          key={i}
          position={[i * 5.5 - 42, 0.035, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2, 0.13]} />
          <meshBasicMaterial color="#f0ede1" />
        </mesh>
      ))}
      <group position={[12, 0, -17]}>
        <RoundedBox args={[32, 2.7, 5]} radius={0.18} position={[0, 1.35, 0]}>
          <meshStandardMaterial color="#99a6a7" roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 1.65, 2.52]}>
          <planeGeometry args={[30, 1.6]} />
          <meshStandardMaterial
            color="#43636c"
            metalness={0.55}
            roughness={0.24}
          />
        </mesh>
        {Array.from({ length: 20 }, (_, i) => (
          <mesh key={i} position={[i * 1.5 - 14.25, 1.6, 2.57]}>
            <boxGeometry args={[0.055, 1.75, 0.08]} />
            <meshStandardMaterial color="#d0d5cf" />
          </mesh>
        ))}
        <RoundedBox args={[34, 0.22, 6]} radius={0.06} position={[0, 2.85, 0]}>
          <meshStandardMaterial color="#d6d6c8" />
        </RoundedBox>
        <mesh position={[20, 3.6, 0]}>
          <cylinderGeometry args={[0.7, 1, 7.2, 12]} />
          <meshStandardMaterial color="#a4b1ad" />
        </mesh>
        <mesh position={[20, 7.7, 0]}>
          <cylinderGeometry args={[1.8, 1.4, 1.6, 8]} />
          <meshStandardMaterial
            color="#48666d"
            metalness={0.35}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[20, 8.55, 0]}>
          <cylinderGeometry args={[2, 2, 0.15, 8]} />
          <meshStandardMaterial color="#e0dbcd" />
        </mesh>
      </group>
    </group>
  );
}

function Seat({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <HoverScale position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.62, 0.35, 1.7]} radius={0.16} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#bcb5a5" roughness={0.9} />
      </RoundedBox>
      <RoundedBox
        args={[1.6, 2.15, 0.38]}
        radius={0.2}
        position={[0, 1.87, -0.67]}
        rotation={[-0.13, 0, 0]}
      >
        <meshStandardMaterial color="#ddd3c3" roughness={0.93} />
      </RoundedBox>
      <RoundedBox
        args={[1.1, 0.56, 0.23]}
        radius={0.12}
        position={[0, 2.65, -0.4]}
      >
        <meshStandardMaterial color="#263d49" roughness={0.9} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox
            args={[0.19, 0.24, 1.48]}
            radius={0.075}
            position={[side * 0.91, 1.24, 0.03]}
          >
            <meshStandardMaterial color="#b89b75" roughness={0.43} />
          </RoundedBox>
          <mesh position={[side * 0.87, 0.63, -0.35]}>
            <boxGeometry args={[0.12, 1.05, 0.16]} />
            <meshStandardMaterial
              color="#52606a"
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}
      <Line
        points={[
          [-0.65, 0.992, 0.65],
          [0, 0.995, 0.7],
          [0.65, 0.992, 0.65],
        ]}
        color="#a79c89"
        lineWidth={1}
      />
      <mesh position={[0, 0.98, 0.15]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <planeGeometry args={[0.09, 1.25]} />
        <meshStandardMaterial color="#52616b" roughness={1} />
      </mesh>
    </HoverScale>
  );
}

function windowShape(width: number, height: number, radius: number) {
  const s = new Shape(),
    x = -width / 2,
    y = -height / 2,
    r = radius;
  s.moveTo(x + r, y);
  s.lineTo(x + width - r, y);
  s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);
  s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function Cabin() {
  const frame = useMemo(() => {
    const shape = windowShape(2.05, 2.6, 0.65);
    const hole = windowShape(1.61, 2.16, 0.54);
    shape.holes.push(hole);
    return shape;
  }, []);
  const pane = useMemo(() => windowShape(1.62, 2.17, 0.54), []);
  return (
    <group position={[0, -1.9, 0]}>
      <RoundedBox args={[9, 0.22, 7]} radius={0.1} position={[0, -0.06, 0]}>
        <meshStandardMaterial color="#263944" roughness={1} />
      </RoundedBox>
      <mesh position={[0, 2, -2.9]}>
        <boxGeometry args={[9, 4.2, 0.2]} />
        <meshStandardMaterial color="#d6d1c7" roughness={0.82} />
      </mesh>
      {[-2.5, 0, 2.5].map((x) => (
        <HoverScale key={x} position={[x, 2.55, -2.72]}>
          <mesh>
            <extrudeGeometry
              args={[
                frame,
                {
                  depth: 0.16,
                  bevelEnabled: true,
                  bevelSize: 0.07,
                  bevelThickness: 0.06,
                  bevelSegments: 3,
                  steps: 1,
                  curveSegments: 24,
                },
              ]}
            />
            <meshStandardMaterial color="#f2e9dc" roughness={0.52} />
          </mesh>
          <mesh position={[0, 0, -0.005]}>
            <shapeGeometry args={[pane, 32]} />
            <meshBasicMaterial color="#9fc6d5" />
          </mesh>
          <mesh position={[0, -0.45, 0.006]} scale={[1, 0.18, 1]}>
            <shapeGeometry args={[pane, 32]} />
            <meshBasicMaterial color="#dbe7e8" />
          </mesh>
          <mesh position={[0.32, 0.42, 0.008]}>
            <circleGeometry args={[0.2, 32]} />
            <meshBasicMaterial color="#fff1d4" />
          </mesh>
        </HoverScale>
      ))}
      <mesh position={[0, 4.07, -2.47]}>
        <boxGeometry args={[8.7, 0.055, 0.15]} />
        <meshBasicMaterial color="#ffdfaa" />
      </mesh>
      <mesh position={[0, 0.9, -2.73]}>
        <boxGeometry args={[9, 0.08, 0.13]} />
        <meshStandardMaterial color="#aa8a63" metalness={0.4} />
      </mesh>
      <Seat position={[-1.4, 0, -0.1]} rotation={0.13} />
      <Seat position={[1.15, 0, -0.1]} rotation={0.13} />
      <HoverScale position={[0.02, 1.23, 0.15]}>
        <RoundedBox args={[0.55, 0.15, 1.5]} radius={0.07}>
          <meshStandardMaterial color="#927657" roughness={0.45} />
        </RoundedBox>
      </HoverScale>
      <HoverScale position={[0.02, 1.48, 0.4]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.09, 0.32, 32]} />
          <meshStandardMaterial color="#f0e9dd" roughness={0.4} />
        </mesh>
      </HoverScale>
      <pointLight
        position={[-2, 3, -1.3]}
        color="#ffdfb2"
        intensity={9}
        distance={8}
      />
    </group>
  );
}

function Island({
  position,
  scale,
  seed,
}: {
  position: [number, number, number];
  scale: number;
  seed: number;
}) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry(),
      positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const rings = 20,
      segments = 72;
    for (let r = 0; r <= rings; r++)
      for (let j = 0; j <= segments; j++) {
        const t = r / rings,
          a = (j / segments) * Math.PI * 2;
        const edge =
          1 + 0.15 * Math.sin(a * 3 + seed) + 0.07 * Math.cos(a * 7 - seed);
        const x = Math.cos(a) * t * edge * 4,
          z = Math.sin(a) * t * edge * 2.65;
        const peak =
          Math.max(0, 1 - t) ** 1.8 * (1.5 + 0.25 * Math.sin(a * 3 + seed));
        positions.push(x, 0.08 + peak, z);
        const color =
          t > 0.88
            ? [0.75, 0.69, 0.5]
            : t > 0.7
              ? [0.25, 0.42, 0.31]
              : [0.12 + 0.08 * t, 0.29 + 0.12 * t, 0.23 + 0.06 * t];
        colors.push(...color);
      }
    for (let r = 0; r < rings; r++)
      for (let j = 0; j < segments; j++) {
        const a = r * (segments + 1) + j,
          b = a + segments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    g.setAttribute("position", new Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [seed]);
  return (
    <HoverScale position={position} scale={scale}>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.94} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[4.6, 3.1, 1]}
        position={[0, 0.025, 0]}
      >
        <circleGeometry args={[1, 72]} />
        <meshStandardMaterial
          color="#3d9a99"
          transparent
          opacity={0.5}
          roughness={0.4}
        />
      </mesh>
    </HoverScale>
  );
}
export function Coast({ reduced }: { reduced: boolean }) {
  const glints = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (glints.current && !reduced)
      glints.current.position.x = Math.sin(clock.elapsedTime * 0.14) * 0.2;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[170, 170]} />
        <meshStandardMaterial
          color="#1a6171"
          metalness={0.25}
          roughness={0.3}
        />
      </mesh>
      <Island position={[-1, 0, -1]} scale={1.7} seed={3} />
      <Island position={[10, 0, -8]} scale={0.9} seed={8} />
      <Island position={[-12, 0, -10]} scale={0.75} seed={14} />
      <Island position={[7, 0, 5]} scale={0.45} seed={22} />
      <group ref={glints}>
        {Array.from({ length: 32 }, (_, i) => (
          <mesh
            key={i}
            position={[Math.sin(i * 2.3) * 12, 0.018, -18 + i * 1.15]}
            rotation={[-Math.PI / 2, 0, 0.1]}
          >
            <planeGeometry args={[0.2 + (i % 4) * 0.16, 0.025]} />
            <meshBasicMaterial
              color="#e7ce9f"
              transparent
              opacity={0.2 + (i % 3) * 0.08}
            />
          </mesh>
        ))}
      </group>
      <Line
        points={[
          new Vector3(3, 0.05, 10),
          new Vector3(3.6, 0.05, 8),
          new Vector3(4.8, 0.05, 6.2),
        ]}
        color="#c3e2df"
        transparent
        opacity={0.4}
        lineWidth={1}
      />
      <HoverScale position={[4.8, 0.12, 6.2]} rotation={[0, 0.5, 0]}>
        <mesh>
          <coneGeometry args={[0.12, 0.7, 4]} />
          <meshStandardMaterial color="#e8e2cf" />
        </mesh>
      </HoverScale>
    </group>
  );
}
