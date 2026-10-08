import { Canvas } from "@react-three/fiber";
import { Edges, Grid, OrbitControls, Text } from "@react-three/drei";
import { useMemo } from "react";
import { scene3d } from "@/lib/led/scene3d";
import { allPanels, useStore } from "@/lib/led/store";

/** Vista 3D esquemática de todas las pantallas (curvas, arcos y cilindros incluidos). */
export default function Scene3D({ selected, dark }: { selected?: string; dark: boolean }) {
  const st = useStore();
  const panels = allPanels(st);
  const cabs = useMemo(() => scene3d(st.project, (id) => panels.find((p) => p.id === id)), [st.project, panels.length]);
  const bounds = useMemo(() => {
    if (!cabs.length) return { cx: 0, cz: 0, size: 6, top: 2 };
    const xs = cabs.map((c) => c.x), zs = cabs.map((c) => c.z), ys = cabs.map((c) => c.y + c.h / 2);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(maxX - minX, maxZ - minZ, Math.max(...ys), 3), top: Math.max(...ys) };
  }, [cabs]);
  const labels = st.project.screens.map((s) => {
    const mine = cabs.filter((c) => c.screenId === s.id);
    if (!mine.length) return null;
    return { id: s.id, name: s.name, x: mine.reduce((a, c) => a + c.x, 0) / mine.length, z: mine.reduce((a, c) => a + c.z, 0) / mine.length, y: Math.max(...mine.map((c) => c.y + c.h / 2)) + 0.35 };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const d = bounds.size * 1.3;
  // Objetivo estable: solo cambia si cambian los límites, así los re-render no reinician la órbita/zoom.
  const target = useMemo<[number, number, number]>(() => [bounds.cx, bounds.top / 2, bounds.cz], [bounds.cx, bounds.top, bounds.cz]);
  const bg = dark ? "#0b1622" : "#eef3f8";

  return (
    <Canvas key={st.project.screens.length} dpr={[1, 2]} camera={{ position: [bounds.cx + d * 0.35, bounds.top * 0.8 + d * 0.35, bounds.cz + d], fov: 45, near: 0.05, far: 1000 }}>
      <color attach="background" args={[bg]} />
      <hemisphereLight args={["#ffffff", "#6b7c8f", 0.9]} />
      <directionalLight position={[5, 10, 8]} intensity={1.1} />
      <Grid position={[bounds.cx, 0, bounds.cz]} args={[200, 200]} cellSize={0.5} sectionSize={1} cellColor={dark ? "#24384d" : "#c9d5e1"} sectionColor={dark ? "#36577a" : "#9fb3c8"} fadeDistance={d * 4} infiniteGrid />
      {cabs.map((c) => (
        <group key={c.id} position={[c.x, c.y, c.z]} rotation={[0, c.rotY, c.tilt ? -c.tilt : 0]}>
          <mesh>
            <boxGeometry args={[c.w * 0.985, c.h * 0.985, 0.08]} />
            <meshStandardMaterial color={c.color} roughness={0.55} metalness={0.1} emissive={c.color} emissiveIntensity={c.screenId === selected ? 0.35 : 0.12} />
            <Edges color={c.screenId === selected ? "#F5A524" : "#0B1B2B"} />
          </mesh>
        </group>
      ))}
      {labels.map((l) => (
        <Text key={l.id} position={[l.x, l.y, l.z]} fontSize={Math.max(0.18, bounds.size / 40)} color={dark ? "#E8F1FA" : "#0B1B2B"} anchorX="center" anchorY="bottom">{l.name}</Text>
      ))}
      <OrbitControls makeDefault target={target} enableDamping dampingFactor={0.12} zoomSpeed={0.5} rotateSpeed={0.6} panSpeed={0.7} minDistance={Math.max(0.5, bounds.size * 0.15)} maxDistance={bounds.size * 8} maxPolarAngle={Math.PI / 2 - 0.02} />
    </Canvas>
  );
}
