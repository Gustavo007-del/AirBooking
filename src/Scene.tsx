import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Cloud, Clouds, Line, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { CatmullRomCurve3, Group, Mesh, Vector3, SRGBColorSpace } from "three";

import { Cabin, Coast, Runway } from "./scenes/Environments";

import {
  chapterProgress,
  AIRCRAFT_URL,
  EARTH_URL,
  CLOUD_URL,
  type SceneMode,
} from "./cinematic";
type Position = [number, number, number];
interface Shot {
  trigger: string;
  positions: Position[];
  targets: Position[];
  fov: number;
}
// Each chapter has its own spatial story. This controller alone writes camera state.
const shots: Record<SceneMode, Shot> = {
  hero: {
    trigger: "#hero",
    positions: [
      [-20, 8, 28],
      [-15, 10, 29],
      [-10, 11, 26],
    ],
    targets: [
      [0, 0, 0],
      [0, 0.3, 0],
      [1, 0, 0],
    ],
    fov: 40,
  },
  take: {
    trigger: "#take-flight",
    positions: [
      [-10, 5, 17],
      [-15, 6, 15],
      [-22, 9, 13],
    ],
    targets: [
      [2, 0, 0],
      [-4, 2, 0],
      [-13, 6, 0],
    ],
    fov: 46,
  },
  globe: {
    trigger: "#explore",
    positions: [
      [0, 1, 15],
      [1.5, 1.8, 15],
      [3, 2, 14.5],
    ],
    targets: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    fov: 40,
  },
  cabin: {
    trigger: "#experience",
    positions: [
      [7, 3.5, 10],
      [4, 2.6, 10],
      [1.8, 2.2, 9],
    ],
    targets: [
      [0, 0.2, -0.6],
      [0, 0.35, -1],
      [0, 0.6, -1.5],
    ],
    fov: 43,
  },
  final: {
    trigger: "#final-flight",
    positions: [
      [15, 18, 20],
      [11, 16, 17],
      [5, 14, 15],
    ],
    targets: [
      [0, 0, -2],
      [0, 0, -2],
      [0, 0, -3],
    ],
    fov: 46,
  },
};
type Progress = RefObject<{ value: number }>;
function Camera({
  mode,
  motion,
  progress,
}: {
  mode: SceneMode;
  motion: boolean;
  progress: Progress;
}) {
  const { camera } = useThree();
  const paths = useMemo(
    () => ({
      position: new CatmullRomCurve3(
        shots[mode].positions.map((p) => new Vector3(...p)),
      ),
      target: new CatmullRomCurve3(
        shots[mode].targets.map((p) => new Vector3(...p)),
      ),
    }),
    [mode],
  );
  useFrame(() => {
    const value = motion ? Math.max(0, Math.min(1, progress.current.value)) : 0;
    camera.position.copy(paths.position.getPoint(value));
    camera.lookAt(paths.target.getPoint(value));
  }, -1);
  return null;
}
function Aircraft({
  mode,
  motion,
  progress,
}: {
  mode: "hero" | "take";
  motion: boolean;
  progress: Progress;
}) {
  const gltf = useGLTF(AIRCRAFT_URL);
  const object = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (mode === "take") {
      const t = progress.current.value;
      ref.current.position.set(5 - t * 20, 0.9 + Math.pow(t, 1.5) * 7, 0);
      ref.current.rotation.set(0, 0, -0.04 - t * 0.09);
    } else if (motion) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.2) * 0.1;
      ref.current.rotation.z =
        -0.025 + Math.sin(clock.elapsedTime * 0.14) * 0.008;
    }
  });
  return (
    <group
      ref={ref}
      scale={mode === "take" ? 0.32 : 1}
      position={mode === "take" ? [5, 0.9, 0] : [0, 0, 0]}
    >
      <primitive object={object} dispose={null} />
    </group>
  );
}
function Atmosphere({ motion }: { motion: boolean }) {
  return (
    <Clouds texture={CLOUD_URL} limit={32}>
      <Cloud
        seed={8}
        segments={innerWidth < 650 ? 8 : 16}
        bounds={[25, 3, 10]}
        volume={30}
        position={[0, -6, -13]}
        color="#9ab3c0"
        opacity={0.28}
        speed={motion ? 0.035 : 0}
      />
      <Cloud
        seed={21}
        segments={innerWidth < 650 ? 6 : 10}
        bounds={[24, 2, 8]}
        volume={20}
        position={[-16, -5, 8]}
        color="#ced9df"
        opacity={0.18}
        speed={motion ? 0.03 : 0}
      />
    </Clouds>
  );
}
function RouteTraveller({
  points,
  motion,
  offset,
}: {
  points: Vector3[];
  motion: boolean;
  offset: number;
}) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current && motion) {
      const t = (clock.elapsedTime * 0.045 + offset) % 1;
      const index = t * (points.length - 1);
      const i = Math.floor(index);
      ref.current.position
        .copy(points[i])
        .lerp(points[Math.min(i + 1, points.length - 1)], index - i);
    }
  });
  return (
    <mesh ref={ref} position={points[0]}>
      <sphereGeometry args={[0.055, 12, 8]} />
      <meshBasicMaterial color="#f5ce94" />
    </mesh>
  );
}
function Earth({ motion, progress }: { motion: boolean; progress: Progress }) {
  const map = useTexture(EARTH_URL);
  map.colorSpace = SRGBColorSpace;
  const ref = useRef<Group>(null);
  const { gl, invalidate } = useThree();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const rotation = useRef({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.cursor = dragging ? "grabbing" : hovered ? "grab" : "auto";
    return () => {
      canvas.style.cursor = "auto";
    };
  }, [gl, hovered, dragging]);
  useEffect(() => {
    const canvas = gl.domElement;
    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.id) return;
      rotation.current.y += (event.clientX - current.x) * 0.008;
      if (event.pointerType !== "touch") {
        rotation.current.x = Math.max(
          -0.65,
          Math.min(
            0.65,
            rotation.current.x + (event.clientY - current.y) * 0.006,
          ),
        );
      }
      current.x = event.clientX;
      current.y = event.clientY;
      invalidate();
    };
    const end = (event: PointerEvent) => {
      if (drag.current?.id !== event.pointerId) return;
      drag.current = null;
      setDragging(false);
      setHovered(false);
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", end);
      canvas.removeEventListener("pointercancel", end);
      canvas.removeEventListener("lostpointercapture", end);
      const current = drag.current;
      if (current && canvas.hasPointerCapture(current.id))
        canvas.releasePointerCapture(current.id);
      drag.current = null;
    };
  }, [gl, invalidate]);
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y =
        -1.05 + progress.current.value * 0.5 + rotation.current.y;
      ref.current.rotation.x = rotation.current.x;
    }
  });
  const routes = useMemo(
    () =>
      [
        [
          [0.7, 2.3, 3.1],
          [3, 4, 3],
          [3.6, 0.5, 0.9],
        ],
        [
          [-2, 2, 2.8],
          [0, 4.8, 4],
          [3.6, 0.5, 0.9],
        ],
        [
          [3.6, 0.5, 0.9],
          [4, -1, 3],
          [1.2, -2, 3.1],
        ],
      ].map((points) => {
        const [a, b, c] = points.map((p) => new Vector3(...p));
        return Array.from({ length: 65 }, (_, i) => {
          const t = i / 64;
          return a
            .clone()
            .multiplyScalar((1 - t) ** 2)
            .add(b.clone().multiplyScalar(2 * (1 - t) * t))
            .add(c.clone().multiplyScalar(t * t));
        });
      }),
    [],
  );
  return (
    <group ref={ref} rotation={[0, -1.05, 0]}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={(event) => {
          if (event.button !== 0 || drag.current) return;
          event.stopPropagation();
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          gl.domElement.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
      >
        <sphereGeometry args={[3.8, 64, 48]} />
        <meshStandardMaterial
          map={map}
          roughness={hovered || dragging ? 0.65 : 0.9}
          color="#d0d9dc"
          emissive="#70a8bc"
          emissiveIntensity={hovered || dragging ? 0.12 : 0}
        />
      </mesh>
      {routes.map((p, i) => (
        <group key={i}>
          <Line points={p} color="#cda879" lineWidth={1.2} />
          <RouteTraveller points={p} motion={motion} offset={i / 3} />
          {[p[0], p[p.length - 1]].map((pos, j) => (
            <mesh key={j} position={pos}>
              <sphereGeometry args={[0.038, 12, 8]} />
              <meshBasicMaterial color="#ffe6c5" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
function Chapter({
  mode,
  motion,
  onReady,
}: {
  mode: SceneMode;
  motion: boolean;
  onReady: () => void;
}) {
  const progress = useMemo(() => ({ current: chapterProgress[mode] }), [mode]);
  return (
    <>
      <Camera mode={mode} motion={motion} progress={progress} />
      <ambientLight intensity={mode === "cabin" ? 1.4 : 1.25} />
      <directionalLight
        position={[-10, 14, 10]}
        intensity={2.5}
        color={mode === "take" ? "#ffce94" : "#fff2dc"}
      />
      <directionalLight
        position={[10, 4, -10]}
        intensity={0.9}
        color="#b8d3e1"
      />
      <Suspense fallback={null}>
        {mode === "hero" && (
          <>
            <Aircraft mode="hero" motion={motion} progress={progress} />
            <Suspense fallback={null}>
              <OptionalClouds>
                <Atmosphere motion={motion} />
              </OptionalClouds>
            </Suspense>
          </>
        )}
        {mode === "take" && (
          <>
            <fog attach="fog" args={["#b4b4a5", 30, 125]} />
            <Runway />
            <Aircraft mode="take" motion={motion} progress={progress} />
            <mesh position={[-36, 10, -42]}>
              <sphereGeometry args={[4, 32, 24]} />
              <meshBasicMaterial color="#f6d7a4" />
            </mesh>
          </>
        )}
        {mode === "globe" && <Earth motion={motion} progress={progress} />}
        {mode === "cabin" && <Cabin />}
        {mode === "final" && (
          <>
            <fog attach="fog" args={["#b3c6c4", 45, 100]} />
            <Coast reduced={!motion} />
          </>
        )}
        <Ready onReady={onReady} />
      </Suspense>
      {motion && innerWidth > 900 && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={2.3} intensity={0.035} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}
export default function Scene({
  mode = "hero",
  motion = true,
  active = true,
  onReady,
  onFailure,
}: {
  mode?: SceneMode;
  motion?: boolean;
  active?: boolean;
  onReady: () => void;
  onFailure: () => void;
}) {
  const animate =
    motion && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: shots[mode].positions[0], fov: shots[mode].fov }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={active && animate ? "always" : "demand"}
      fallback={<div className={`webgl-fallback fallback-${mode}`} />}
    >
      <ContextHealth onFailure={onFailure} />
      <Chapter mode={mode} motion={animate} onReady={onReady} />
    </Canvas>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const invalidate = useThree((state) => state.invalidate);
  const frames = useRef(0);
  useEffect(() => {
    frames.current = 0;
    invalidate();
  }, [onReady, invalidate]);
  // Count a completed render before dismissing the placeholder. Demand-mode
  // canvases also get this warm-up, including shader compilation and uploads.
  useFrame(() => {
    if (frames.current >= 2) return;
    frames.current += 1;
    if (frames.current === 2) onReady();
    else invalidate();
  });
  return null;
}
class OptionalClouds extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function ContextHealth({ onFailure }: { onFailure: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  return null;
}
export function resetSceneAssets() {
  useGLTF.clear(AIRCRAFT_URL);
  useTexture.clear(EARTH_URL);
  useTexture.clear(CLOUD_URL);
}
useGLTF.preload(AIRCRAFT_URL);
useTexture.preload(EARTH_URL);
useTexture.preload(CLOUD_URL);
