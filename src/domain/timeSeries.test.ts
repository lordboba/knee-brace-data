import { describe, expect, it } from "vitest";
import sessionCsv from "../../2026-03-04_knee_session1.csv?raw";
import { parseUploadedTimeSeries, timeSeriesFromSensorSession } from "./timeSeries";
import { parseSensorCsv } from "./sensorParser";

describe("time series conversion", () => {
  it("converts checked-in knee-brace CSV rows into graphable channels", () => {
    const sensorSession = parseSensorCsv(sessionCsv, {
      id: "session1",
      name: "2026-03-04 knee session 1",
    });
    const timeSeries = timeSeriesFromSensorSession(sensorSession);

    expect(timeSeries.source.parser).toBe("knee-brace");
    expect(timeSeries.channels).toContain("IMU 1 acc X");
    expect(timeSeries.channels).toContain("Temperature C");
    expect(timeSeries.samples.length).toBeGreaterThan(2600);
    expect(timeSeries.warnings[0]).toMatchObject({ lineNumber: 1 });
  });

  it("falls back to generic channel parsing when uploads are not knee-brace CSVs", () => {
    const timeSeries = parseUploadedTimeSeries(
      ["time_ms,Fp1,Fp2", "0,10,11", "4,12,9"].join("\n"),
      { id: "generic", name: "generic.csv" },
    );

    expect(timeSeries.source.parser).toBe("generic-channel");
    expect(timeSeries.channels).toEqual(["Fp1", "Fp2"]);
    expect(timeSeries.samples).toHaveLength(2);
  });
});

