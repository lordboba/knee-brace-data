import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Group, Quaternion } from "three";
import type { HeatMapSample } from "../domain/heatMap";
import { defaultSensorLayout } from "../domain/sensorLayout";
import type {
  BiomechanicsSample,
  HeatMapChannel,
  QuaternionSample,
} from "../domain/types";

type SensorSceneProps = {
  biomechanicsSample: BiomechanicsSample;
  heatSample: HeatMapSample;
  isPlaying: boolean;
  selectedHeatChannels: readonly HeatMapChannel[];
};

export function SensorScene({
  biomechanicsSample,
  heatSample,
  isPlaying,
  selectedHeatChannels,
}: SensorSceneProps) {
  return (
    <div className="scene-shell">
      <Canvas
        camera={{ position: [0.35, 0.32, 4.7], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#101114", 1);
        }}
      >
        <color attach="background" args={["#101114"]} />
        <ambientLight intensity={0.46} />
        <directionalLight
          color="#fff7ed"
          intensity={2.2}
          position={[2.8, 4.4, 3.8]}
        />
        <directionalLight
          color="#8ecae6"
          intensity={0.86}
          position={[-3.2, 1.2, -2.4]}
        />
        <BiomechanicsSchematic
          biomechanicsSample={biomechanicsSample}
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

function BiomechanicsSchematic({
  biomechanicsSample,
  heatSample,
  isPlaying,
  selectedHeatChannels,
}: SensorSceneProps) {
  const groupRef = useRef<Group>(null);
  const kneeQuaternion = useMemo(
    () => quaternionFromSample(biomechanicsSample.kneeOrientation),
    [biomechanicsSample.kneeOrientation],
  );
  const temperatureColor = useMemo(
    () =>
      new Color("#f0b85d").lerp(
        new Color("#df5b53"),
        heatSample.metrics.temperature,
      ),
    [heatSample.metrics.temperature],
  );
  const isTemperatureVisible = selectedHeatChannels.includes("temperature");
  const isEmgVisible = selectedHeatChannels.includes("emg");
  const isImuVisible = selectedHeatChannels.includes("imu");

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const breathing = isPlaying
      ? Math.sin(state.clock.elapsedTime * 0.7) * 0.012
      : 0;
    groupRef.current.rotation.y = -0.2 + breathing;
  });

  return (
    <group
      ref={groupRef}
      position={[0.42, -0.1, 0]}
      rotation={[0.04, -0.2, 0]}
      scale={0.86}
    >
      <group position={[0, 0.78, 0]}>
        <LimbSegment
          bottomRadius={0.3}
          color="#c7d0d4"
          length={1.48}
          topRadius={0.38}
        />
        {isEmgVisible ? (
          <EmgPulseLayer
            elapsedMs={heatSample.elapsedMs}
            intensity={heatSample.metrics.emg}
          />
        ) : null}
        {isImuVisible ? <ImuMarker label="IMU 1" position={[-0.38, -0.2, 0.29]} /> : null}
        <BraceBand y={-0.54} />
      </group>

      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.28, 48, 28]} />
        <meshStandardMaterial
          color="#d9e0e3"
          metalness={0.04}
          roughness={0.66}
        />
      </mesh>
      <mesh position={[0, 0.02, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.46, 0.026, 16, 80]} />
        <meshStandardMaterial
          color="#f4f5f6"
          metalness={0.14}
          roughness={0.38}
        />
      </mesh>

      <group quaternion={kneeQuaternion}>
        <group position={[0, -0.78, 0]}>
          <LimbSegment
            bottomRadius={0.22}
            color="#aeb9bf"
            length={1.5}
            topRadius={0.31}
          />
          {isTemperatureVisible ? (
            <TemperatureSkinShell
              color={temperatureColor}
              intensity={heatSample.metrics.temperature}
              tempC={heatSample.frame.tempC}
            />
          ) : null}
          <BraceBand y={0.38} />
          <BraceBand y={-0.24} />
          {isImuVisible ? (
            <ImuMarker label="IMU 2" position={[0.35, 0.1, 0.28]} />
          ) : null}
        </group>
      </group>

      <Html center distanceFactor={7.5} position={[0, -1.74, 0.45]}>
        <span className="scene-label">
          {biomechanicsSample.kneeFlexionDeg.toFixed(0)} deg knee flexion
        </span>
      </Html>
    </group>
  );
}

function LimbSegment({
  bottomRadius,
  color,
  length,
  topRadius,
}: {
  bottomRadius: number;
  color: string;
  length: number;
  topRadius: number;
}) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[topRadius, bottomRadius, length, 52]} />
        <meshStandardMaterial color={color} roughness={0.74} />
      </mesh>
      <mesh position={[0, length / 2, 0]}>
        <sphereGeometry args={[topRadius, 36, 22]} />
        <meshStandardMaterial color={color} roughness={0.74} />
      </mesh>
      <mesh position={[0, -length / 2, 0]}>
        <sphereGeometry args={[bottomRadius, 36, 22]} />
        <meshStandardMaterial color={color} roughness={0.74} />
      </mesh>
    </group>
  );
}

function TemperatureSkinShell({
  color,
  intensity,
  tempC,
}: {
  color: Color;
  intensity: number;
  tempC: number;
}) {
  const opacity = 0.2 + intensity * 0.34;
  const emissiveIntensity = 0.18 + intensity * 0.65;

  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.345, 0.255, 1.54, 64]} />
        <meshStandardMaterial
          color={color}
          depthWrite={false}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          opacity={opacity}
          roughness={0.42}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.77, 0]}>
        <sphereGeometry args={[0.345, 40, 22]} />
        <meshStandardMaterial
          color={color}
          depthWrite={false}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          opacity={opacity * 0.86}
          roughness={0.42}
          transparent
        />
      </mesh>
      <mesh position={[0, -0.77, 0]}>
        <sphereGeometry args={[0.255, 40, 22]} />
        <meshStandardMaterial
          color={color}
          depthWrite={false}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          opacity={opacity * 0.86}
          roughness={0.42}
          transparent
        />
      </mesh>
      <Html center distanceFactor={7.2} position={[0.44, 0.25, 0.3]}>
        <span className="scene-label">{tempC.toFixed(2)} C skin</span>
      </Html>
    </group>
  );
}

function EmgPulseLayer({
  elapsedMs,
  intensity,
}: {
  elapsedMs: number;
  intensity: number;
}) {
  const pulseNodes = Array.from({ length: 9 }, (_, index) => {
    const y = 0.56 - index * 0.14;
    const phase = elapsedMs / 140 + index * 0.72;
    const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(phase));
    return {
      emissiveIntensity: 0.25 + intensity * pulse * 2.4,
      opacity: 0.28 + intensity * pulse * 0.58,
      radius: 0.024 + intensity * pulse * 0.028,
      y,
    };
  });

  return (
    <group position={[-0.08, 0.08, 0.32]}>
      <mesh rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.055, 1.18, 0.018]} />
        <meshStandardMaterial
          color="#1f6b5f"
          emissive="#77c899"
          emissiveIntensity={0.18 + intensity * 0.7}
          opacity={0.18 + intensity * 0.28}
          roughness={0.2}
          transparent
        />
      </mesh>
      {pulseNodes.map((node, index) => (
        <mesh key={index} position={[0, node.y, 0.02]}>
          <sphereGeometry args={[node.radius, 20, 14]} />
          <meshStandardMaterial
            color="#6ee7d8"
            emissive="#77c899"
            emissiveIntensity={node.emissiveIntensity}
            opacity={node.opacity}
            roughness={0.16}
            transparent
          />
        </mesh>
      ))}
      <Html center distanceFactor={7.4} position={[-0.22, 0.18, 0.14]}>
        <span className="scene-label">Rectus femoris EMG</span>
      </Html>
    </group>
  );
}

function BraceBand({ y }: { y: number }) {
  return (
    <mesh position={[0, y, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.48, 0.034, 16, 80]} />
      <meshStandardMaterial
        color="#e8ecef"
        metalness={0.24}
        roughness={0.34}
      />
    </mesh>
  );
}

function ImuMarker({
  label,
  position,
}: {
  label: string;
  position: [number, number, number];
}) {
  const layoutZone = defaultSensorLayout.zones.find(
    (zone) => zone.label === label,
  );
  const radius = layoutZone?.radius ?? 0.11;

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[radius, 32, 20]} />
        <meshStandardMaterial
          color="#5e9bd6"
          emissive="#5e9bd6"
          emissiveIntensity={0.82}
          metalness={0.14}
          roughness={0.24}
        />
      </mesh>
      <axesHelper args={[0.28]} />
      <Html center distanceFactor={7.8} position={[0, radius + 0.08, 0]}>
        <span className="scene-label">{label}</span>
      </Html>
    </group>
  );
}

function quaternionFromSample(sample: QuaternionSample): Quaternion {
  return new Quaternion(sample.x, sample.y, sample.z, sample.w).normalize();
}
