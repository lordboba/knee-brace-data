import { describe, expect, it } from "vitest";
import { generateSyntheticSession } from "./syntheticSession";

describe("generateSyntheticSession", () => {
  it("generates deterministic 50 Hz sample timing", () => {
    const first = generateSyntheticSession({
      id: "synthetic",
      name: "Synthetic",
      durationMs: 100,
      sampleRateHz: 50
    });
    const second = generateSyntheticSession({
      id: "synthetic",
      name: "Synthetic",
      durationMs: 100,
      sampleRateHz: 50
    });

    expect(first.frames.map((sample) => sample.tMs)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(first).toEqual(second);
  });

  it("includes movement, EMG bursts, and gradual temperature drift", () => {
    const session = generateSyntheticSession({
      id: "synthetic",
      name: "Synthetic",
      durationMs: 2_000,
      sampleRateHz: 50
    });

    const emgValues = session.frames.map((sample) => sample.emgEnv);
    const tempValues = session.frames.map((sample) => sample.tempC);
    const gyroValues = session.frames.map((sample) => sample.imu2.gyr.z);

    expect(Math.max(...emgValues)).toBeGreaterThan(Math.min(...emgValues) + 500);
    expect(tempValues[tempValues.length - 1]).toBeGreaterThan(tempValues[0]);
    expect(Math.max(...gyroValues)).toBeGreaterThan(20);
  });
});
