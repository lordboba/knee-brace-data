import { describe, expect, it } from "vitest";
import {
  buildHeatMapSeries,
  getImuMotionIntensity,
  rgbIntensityForSelectedHeatChannels,
  sampleHeatAtElapsedMs,
} from "./heatMap";
import type { ParsedSession, SensorFrame } from "./types";

const frame = (overrides: Partial<SensorFrame>): SensorFrame => ({
  tMs: 0,
  imu1: {
    acc: { x: 0, y: 0, z: 0 },
    gyr: { x: 0, y: 0, z: 0 },
  },
  imu2: {
    acc: { x: 0, y: 0, z: 0 },
    gyr: { x: 0, y: 0, z: 0 },
  },
  emgEnv: 0,
  tempC: 20,
  ...overrides,
});

const sessionFrom = (frames: SensorFrame[]): ParsedSession => ({
  id: "test-session",
  name: "Test session",
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

describe("heat map computation", () => {
  it("computes IMU motion intensity from both accelerometer and gyroscope magnitudes", () => {
    const intensity = getImuMotionIntensity(
      frame({
        imu1: {
          acc: { x: 3, y: 4, z: 0 },
          gyr: { x: 0, y: 0, z: 12 },
        },
        imu2: {
          acc: { x: 0, y: 0, z: 8 },
          gyr: { x: 6, y: 8, z: 0 },
        },
      }),
    );

    expect(intensity).toBe(17.5);
  });

  it("normalizes temperature, EMG, and IMU into RGB channels", () => {
    const low = frame({ tMs: 1000, emgEnv: 10, tempC: 20 });
    const high = frame({
      tMs: 2000,
      emgEnv: 110,
      tempC: 30,
      imu1: {
        acc: { x: 0, y: 0, z: 10 },
        gyr: { x: 0, y: 0, z: 10 },
      },
      imu2: {
        acc: { x: 0, y: 0, z: 10 },
        gyr: { x: 0, y: 0, z: 10 },
      },
    });

    const series = buildHeatMapSeries(sessionFrom([low, high]));

    expect(series[0].rgb).toEqual({ r: 0, g: 0, b: 0 });
    expect(series[1].rgb).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("interpolates heat values smoothly between adjacent frames", () => {
    const low = frame({ tMs: 1000, emgEnv: 0, tempC: 20 });
    const high = frame({
      tMs: 2000,
      emgEnv: 100,
      tempC: 30,
      imu1: {
        acc: { x: 0, y: 0, z: 10 },
        gyr: { x: 0, y: 0, z: 10 },
      },
      imu2: {
        acc: { x: 0, y: 0, z: 10 },
        gyr: { x: 0, y: 0, z: 10 },
      },
    });

    const sample = sampleHeatAtElapsedMs(sessionFrom([low, high]), 500);

    expect(sample.rgb.r).toBeCloseTo(0.5);
    expect(sample.rgb.g).toBeCloseTo(0.5);
    expect(sample.rgb.b).toBeCloseTo(0.5);
  });

  it("filters RGB heat map output to selected channels", () => {
    const metrics = { temperature: 0.2, emg: 0.6, imu: 0.9 };

    expect(
      rgbIntensityForSelectedHeatChannels(metrics, [
        "temperature",
        "emg",
        "imu",
      ]),
    ).toEqual({
      r: 0.2,
      g: 0.6,
      b: 0.9,
    });
    expect(
      rgbIntensityForSelectedHeatChannels(metrics, ["temperature", "imu"]),
    ).toEqual({
      r: 0.2,
      g: 0,
      b: 0.9,
    });
    expect(rgbIntensityForSelectedHeatChannels(metrics, ["emg"])).toEqual({
      r: 0,
      g: 0.6,
      b: 0,
    });
    expect(rgbIntensityForSelectedHeatChannels(metrics, [])).toEqual({
      r: 0,
      g: 0,
      b: 0,
    });
  });
});
