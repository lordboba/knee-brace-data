import { describe, expect, it } from "vitest";
import { parseEegCsv } from "./eegParser";

describe("parseEegCsv", () => {
  it("parses headered EEG rows with a millisecond time column", () => {
    const session = parseEegCsv(
      ["time_ms,Fp1,Fp2,C3", "0,10.5,11.25,-3", "4,10.75,10.9,-2.5"].join("\n"),
      { id: "headered", name: "Headered EEG" },
    );

    expect(session.xAxis).toBe("timeMs");
    expect(session.channels).toEqual(["Fp1", "Fp2", "C3"]);
    expect(session.samples).toHaveLength(2);
    expect(session.durationMs).toBe(4);
    expect(session.samples[1].values).toMatchObject({
      Fp1: 10.75,
      Fp2: 10.9,
      C3: -2.5,
    });
  });

  it("uses sample index for headered channel-only EEG rows", () => {
    const session = parseEegCsv(["Fp1,Fp2", "10,11", "12,13"].join("\n"), {
      id: "channel-only",
      name: "Channel only EEG",
    });

    expect(session.xAxis).toBe("sampleIndex");
    expect(session.samples.map((sample) => sample.x)).toEqual([0, 1]);
    expect(session.samples[0].values).toEqual({ Fp1: 10, Fp2: 11 });
  });

  it("reports invalid EEG channel values and keeps valid rows", () => {
    const session = parseEegCsv(
      ["time_ms,Fp1,Fp2", "0,10,11", "4,bad,12", "8,13,14"].join("\n"),
      { id: "invalid", name: "Invalid EEG" },
    );

    expect(session.samples).toHaveLength(2);
    expect(session.warnings).toHaveLength(1);
    expect(session.warnings[0]).toMatchObject({
      lineNumber: 3,
      reason: "Channel Fp1 is not a finite number",
    });
  });
});
