import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Cloud, Clouds, Line, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Group, Vector3, SRGBColorSpace } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
function Camera({ mode }: { mode: string }) {
  const { camera } = useThree();
  useEffect(() => {
    const state = {
      x: mode === "detail" ? -11 : -20,
      y: mode === "detail" ? 3 : 9,
      z: mode === "detail" ? 12 : mode === "final" ? 45 : 27,
      tx: 0,
      ty: 0,
      tz: 0,
    };
    const apply = () => {
      camera.position.set(state.x, state.y, state.z);
      camera.lookAt(state.tx, state.ty, state.tz);
    };
    apply();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const target =
        mode === "hero"
          ? "#hero"
          : mode === "detail"
            ? "#experience"
            : mode === "final"
              ? "#final-flight"
              : "#take-flight";
      gsap.to(state, {
        x: mode === "detail" ? -4 : -9,
        y: mode === "detail" ? 2 : 5,
        z: mode === "detail" ? 8 : mode === "final" ? 80 : 24,
        ty: mode === "detail" ? -1 : 0,
        ease: "none",
        onUpdate: apply,
        scrollTrigger: {
          trigger: target,
          start: "top top",
          end: "bottom top",
          scrub: 1.2,
        },
      });
    });
    return () => ctx.revert();
  }, [camera, mode]);
  return null;
}
function Aircraft({ mode }: { mode: string }) {
  const gltf = useGLTF("/models/aere-aircraft.glb");
  const object = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  const ref = useRef<Group>(null);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  useFrame(({ clock }) => {
    if (ref.current && !reduced) {
      ref.current.position.y = Math.sin(clock.elapsedTime * 0.23) * 0.16;
      ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.16) * 0.016;
    }
  });
  return (
    <group
      ref={ref}
      rotation={[0, mode === "take" ? 0.45 : 0, mode === "detail" ? 0 : -0.06]}
    >
      <primitive object={object} />
    </group>
  );
}
function Atmosphere({ mode }: { mode: string }) {
  return (
    <Clouds material={undefined}>
      <Cloud
        seed={8}
        segments={18}
        bounds={[25, 3, 10]}
        volume={32}
        position={[0, -6, -13]}
        color={mode === "take" ? "#d5d5ca" : "#8eabbc"}
        opacity={0.37}
        speed={0.05}
      />
      <Cloud
        seed={21}
        segments={12}
        bounds={[24, 2, 8]}
        volume={22}
        position={[-16, -4, 8]}
        color="#ced9df"
        opacity={0.26}
        speed={0.05}
      />
    </Clouds>
  );
}
function Earth() {
  const map = useTexture("/textures/earth.jpg");
  map.colorSpace = SRGBColorSpace;
  const ref = useRef<Group>(null);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  useFrame(({ clock }) => {
    if (ref.current && !reduced)
      ref.current.rotation.y = clock.elapsedTime * 0.025;
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
        const a = new Vector3(...points[0]),
          b = new Vector3(...points[1]),
          c = new Vector3(...points[2]);
        return Array.from({ length: 49 }, (_, i) => {
          const t = i / 48;
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
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[3.8, 64, 64]} />
        <meshStandardMaterial map={map} roughness={0.9} color="#b7c9cd" />
      </mesh>
      {routes.map((p, i) => (
        <Line key={i} points={p} color="#d6b18c" lineWidth={1.4} />
      ))}
      {routes.map((p, i) => (
        <mesh key={i} position={p[0]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial color="#ffe4c5" />
        </mesh>
      ))}
    </group>
  );
}
export default function Scene({ mode = "hero" }: { mode?: string }) {
  const globe = mode === "globe";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{
        position: globe ? [0, 1, 12] : [-20, 9, 27],
        fov: mode === "detail" ? 42 : 40,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={reduced ? "demand" : "always"}
      fallback={<div className="webgl-fallback">Above the ordinary.</div>}
    >
      <ambientLight intensity={1.25} />
      <directionalLight
        position={[-10, 14, 10]}
        intensity={3.2}
        color="#fff2dc"
      />
      <directionalLight
        position={[10, 3, -10]}
        intensity={2.5}
        color="#a6d3ff"
      />
      {globe ? (
        <Suspense fallback={null}>
          <Earth />
        </Suspense>
      ) : (
        <>
          <Camera mode={mode} />
          <Suspense fallback={null}>
            <Aircraft mode={mode} />
            {mode !== "detail" && <Atmosphere mode={mode} />}
          </Suspense>
        </>
      )}
      {!reduced && innerWidth > 900 && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={1.7} intensity={0.12} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}
