import { describe, expect, it } from "vitest";
import {
  buildBiomechanicsSeries,
  createDefaultBiomechanicsCalibration,
  relativeFlexionDegrees,
  validateBiomechanicsCalibration,
} from "./orientation";
import type {
  BiomechanicsCalibration,
  ParsedSession,
  QuaternionSample,
  SensorFrame,
} from "./types";

const gravityMagnitude = 1_000;

const identityQuaternion: QuaternionSample = { x: 0, y: 0, z: 0, w: 1 };

const frame = (overrides: Partial<SensorFrame>): SensorFrame => ({
  tMs: 0,
  imu1: {
    acc: { x: 0, y: -gravityMagnitude, z: 0 },
    gyr: { x: 0, y: 0, z: 0 },
  },
  imu2: {
    acc: { x: 0, y: -gravityMagnitude, z: 0 },
    gyr: { x: 0, y: 0, z: 0 },
  },
  emgEnv: 0,
  tempC: 31,
  ...overrides,
});

const sessionFrom = (frames: SensorFrame[]): ParsedSession => ({
  id: "orientation-test",
  name: "Orientation test",
  frames,
  durationMs: frames[frames.length - 1].tMs - frames[0].tMs,
  source: {
    name: "inline",
    rowCount: frames.length,
    validRowCount: frames.length,
    hasHeader: false,
  },
  warnings: [],
});

describe("biomechanical orientation", () => {
  it("integrates calibrated calf rotation from IMU2 relative to the thigh", () => {
    const session = sessionFrom([
      frame({ tMs: 0 }),
      frame({
        tMs: 500,
        imu2: {
          acc: { x: 0, y: -707.107, z: 707.107 },
          gyr: { x: 90, y: 0, z: 0 },
        },
      }),
      frame({
        tMs: 1_000,
        imu2: {
          acc: { x: 0, y: 0, z: 1_000 },
          gyr: { x: 90, y: 0, z: 0 },
        },
      }),
    ]);
    const calibration = createDefaultBiomechanicsCalibration(session, 0);

    const series = buildBiomechanicsSeries(session, calibration);

    expect(series[series.length - 1].kneeFlexionDeg).toBeCloseTo(90, 0);
    expect(series[series.length - 1].warnings).toContain("yaw-drift-unobservable");
  });

  it("computes flexion from calf orientation relative to thigh orientation", () => {
    const thigh = quaternionFromXRotation(35);
    const calf = quaternionFromXRotation(82);

    expect(relativeFlexionDegrees(thigh, calf)).toBeCloseTo(47, 1);
  });

  it("surfaces calibration quality warnings instead of hiding bad assumptions", () => {
    const session = sessionFrom([
      frame({
        tMs: 0,
        imu1: {
          acc: { x: 0, y: -2_000, z: 0 },
          gyr: { x: 0, y: 0, z: 0 },
        },
      }),
    ]);
    const invalidCalibration: BiomechanicsCalibration = {
      neutralElapsedMs: 0,
      thigh: {
        segmentX: "x",
        segmentY: "x",
        segmentZ: "z",
      },
      calf: {
        segmentX: "x",
        segmentY: "y",
        segmentZ: "z",
      },
      gyroUnits: "deg/s",
    };

    expect(
      validateBiomechanicsCalibration(session, invalidCalibration),
    ).toEqual(
      expect.arrayContaining([
        "duplicate-thigh-axis",
        "imu1-accelerometer-saturated",
        "yaw-drift-unobservable",
      ]),
    );
  });
});

function quaternionFromXRotation(degrees: number): QuaternionSample {
  const radians = (degrees * Math.PI) / 180;

  return {
    x: Math.sin(radians / 2),
    y: 0,
    z: 0,
    w: Math.cos(radians / 2),
  };
}
