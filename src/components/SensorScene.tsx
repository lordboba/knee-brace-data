import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Group } from "three";
import type { HeatMapSample } from "../domain/heatMap";
import {
  rgbIntensityForSelectedHeatChannels,
  rgbIntensityToCss,
} from "../domain/heatMap";
import { defaultSensorLayout } from "../domain/sensorLayout";
import type { HeatMapChannel, SensorZone } from "../domain/types";

type SensorSceneProps = {
  heatSample: HeatMapSample;
  isPlaying: boolean;
  selectedHeatChannels: readonly HeatMapChannel[];
};

export function SensorScene({
  heatSample,
  isPlaying,
  selectedHeatChannels,
}: SensorSceneProps) {
  return (
    <div className="scene-shell">
      <Canvas
        camera={{ position: [0.25, 0.28, 4.6], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#101114", 1);
        }}
      >
        <color attach="background" args={["#101114"]} />
        <ambientLight intensity={0.42} />
        <directionalLight
          color="#fff7ed"
          intensity={2.1}
          position={[2.8, 4.4, 3.8]}
        />
        <directionalLight
          color="#8ecae6"
          intensity={0.9}
          position={[-3.2, 1.2, -2.4]}
        />
        <BraceSchematic
          heatSample={heatSample}
          isPlaying={isPlaying}
          selectedHeatChannels={selectedHeatChannels}
        />
        <OrbitControls
          enableDamping
          enablePan={false}
          maxDistance={6.4}
          minDistance={3.2}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}

function BraceSchematic({
  heatSample,
  isPlaying,
  selectedHeatChannels,
}: SensorSceneProps) {
  const groupRef = useRef<Group>(null);
  const heatColor = useMemo(
    () =>
      new Color(
        rgbIntensityToCss(
          rgbIntensityForSelectedHeatChannels(
            heatSample.metrics,
            selectedHeatChannels,
          ),
        ),
      ),
    [heatSample.metrics, selectedHeatChannels],
  );
  const braceAngle = (heatSample.metrics.imu - 0.5) * 0.34;

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const breathing = isPlaying
      ? Math.sin(state.clock.elapsedTime * 0.8) * 0.018
      : 0;
    groupRef.current.rotation.y = -0.18 + breathing;
  });

  return (
    <group ref={groupRef} rotation={[0.03, -0.18, 0]}>
      <mesh position={[0, 0.03, -0.08]}>
        <sphereGeometry args={[0.42, 48, 32]} />
        <meshStandardMaterial
          color="#d6dde1"
          roughness={0.62}
          metalness={0.04}
        />
      </mesh>

      <group position={[0, 0.96, 0]} rotation={[0, 0, 0.06]}>
        <mesh>
          <cylinderGeometry args={[0.34, 0.42, 1.42, 40]} />
          <meshStandardMaterial color="#aeb8bd" roughness={0.72} />
        </mesh>
      </group>

      <group position={[0, -0.92, 0]} rotation={[0, 0, braceAngle]}>
        <mesh>
          <cylinderGeometry args={[0.32, 0.38, 1.42, 40]} />
          <meshStandardMaterial color="#9faab1" roughness={0.78} />
        </mesh>
      </group>

      <BraceBand y={0.68} heatColor={heatColor} />
      <BraceBand y={0.12} heatColor={heatColor} />
      <BraceBand y={-0.5} heatColor={heatColor} />
      <mesh position={[0, 0.02, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.64, 0.034, 16, 80]} />
        <meshStandardMaterial
          color="#f4f5f6"
          metalness={0.12}
          roughness={0.38}
        />
      </mesh>

      {defaultSensorLayout.zones.map((zone) => (
        <SensorHeatZone
          key={zone.id}
          heatColor={heatColor}
          heatSample={heatSample}
          selectedHeatChannels={selectedHeatChannels}
          zone={zone}
        />
      ))}
    </group>
  );
}

function BraceBand({ heatColor, y }: { heatColor: Color; y: number }) {
  return (
    <mesh position={[0, y, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.58, 0.036, 16, 80]} />
      <meshStandardMaterial
        color="#e8ecef"
        emissive={heatColor}
        emissiveIntensity={0.28}
        metalness={0.24}
        roughness={0.32}
      />
    </mesh>
  );
}

function SensorHeatZone({
  heatColor,
  heatSample,
  selectedHeatChannels,
  zone,
}: {
  heatColor: Color;
  heatSample: HeatMapSample;
  selectedHeatChannels: readonly HeatMapChannel[];
  zone: SensorZone;
}) {
  const intensity =
    zone.modality === "temperature"
      ? heatSample.metrics.temperature
      : zone.modality === "emg"
        ? heatSample.metrics.emg
        : heatSample.metrics.imu;
  const isVisible = selectedHeatChannels.includes(zone.modality);
  const color = isVisible ? heatColor : "#384249";

  return (
    <group position={zone.position}>
      <mesh>
        <sphereGeometry args={[zone.radius, 32, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isVisible ? 0.35 + intensity * 1.45 : 0.08}
          roughness={0.28}
          metalness={0.18}
        />
      </mesh>
      <Html center distanceFactor={7.8} position={[0, zone.radius + 0.08, 0]}>
        <span className="scene-label">{zone.label}</span>
      </Html>
    </group>
  );
}
