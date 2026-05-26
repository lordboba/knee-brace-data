import { parseSensorCsv } from "../domain/sensorParser";
import { generateSyntheticSession } from "../domain/syntheticSession";

export async function loadBuiltInSessions() {
  const [sessionCsv, dataTxt] = await Promise.all([
    import("../../2026-03-04_knee_session1.csv?raw"),
    import("../../data.txt?raw")
  ]);

  return [
    parseSensorCsv(sessionCsv.default, {
      id: "2026-03-04-knee-session-1",
      name: "2026-03-04 knee session 1"
    }),
    parseSensorCsv(dataTxt.default, {
      id: "data-txt-session",
      name: "data.txt sample"
    })
  ];
}

export const syntheticSession = generateSyntheticSession({
  id: "synthetic-50hz-gait",
  name: "Synthetic 50 Hz gait",
  durationMs: 90_000,
  sampleRateHz: 50
});
