import type { ParsedSession, SensorFrame } from "./types";

type GenerateSyntheticSessionOptions = {
  id: string;
  name: string;
  durationMs?: number;
  sampleRateHz?: number;
};

export function generateSyntheticSession({
  id,
  name,
  durationMs = 120_000,
  sampleRateHz = 50
}: GenerateSyntheticSessionOptions): ParsedSession {
  if (durationMs < 0) {
    throw new Error("durationMs must be greater than or equal to 0");
  }

  if (sampleRateHz <= 0) {
    throw new Error("sampleRateHz must be greater than 0");
  }

  const intervalMs = 1_000 / sampleRateHz;
  const sampleCount = Math.floor(durationMs / intervalMs) + 1;
  const frames = Array.from({ length: sampleCount }, (_, index) =>
    createSyntheticFrame(Math.round(index * intervalMs), durationMs)
  );

  return {
    id,
    name,
    frames,
    durationMs: frames.length > 1 ? frames[frames.length - 1].tMs - frames[0].tMs : 0,
    source: {
      name,
      rowCount: frames.length,
      validRowCount: frames.length,
      hasHeader: true
    },
    warnings: []
  };
}

function createSyntheticFrame(tMs: number, durationMs: number): SensorFrame {
  const elapsedSeconds = tMs / 1_000;
  const durationSeconds = Math.max(1, durationMs / 1_000);
  const gaitPhase = elapsedSeconds * Math.PI * 1.35;
  const flexion = Math.sin(gaitPhase);
  const extension = Math.cos(gaitPhase);
  const burst = Math.max(0, Math.sin(gaitPhase - Math.PI / 5)) ** 3;
  const fatigueRamp = tMs / durationMs;

  return {
    tMs,
    imu1: {
      acc: {
        x: roundSensor(120 * flexion),
        y: roundSensor(-980 + 36 * extension),
        z: roundSensor(42 * Math.sin(gaitPhase * 0.5))
      },
      gyr: {
        x: roundSensor(7 * extension),
        y: roundSensor(14 * Math.sin(gaitPhase * 0.75)),
        z: roundSensor(28 * flexion)
      }
    },
    imu2: {
      acc: {
        x: roundSensor(210 * flexion),
        y: roundSensor(-945 + 90 * extension),
        z: roundSensor(84 * Math.sin(gaitPhase + Math.PI / 8))
      },
      gyr: {
        x: roundSensor(18 * Math.sin(gaitPhase * 0.7)),
        y: roundSensor(24 * flexion),
        z: roundSensor(80 * extension)
      }
    },
    emgEnv: Math.round(180 + 1_850 * burst + 280 * Math.abs(flexion)),
    tempC: roundSensor(31.2 + 0.42 * (tMs / durationMs) + 0.05 * Math.sin(elapsedSeconds / durationSeconds))
  };
}

function roundSensor(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
