import { parseEegCsv } from "./eegParser";
import { parseSensorCsv } from "./sensorParser";
import type { ParsedSession, ParserWarning } from "./types";

export type TimeSeriesWarning = {
  lineNumber: number;
  reason: string;
  raw: string;
};

export type TimeSeriesSample = {
  x: number;
  values: Record<string, number>;
};

export type TimeSeriesSession = {
  id: string;
  name: string;
  channels: string[];
  samples: TimeSeriesSample[];
  xAxis: "timeMs" | "sampleIndex";
  durationMs: number;
  source: {
    name: string;
    rowCount: number;
    validRowCount: number;
    hasHeader: boolean;
    parser: "knee-brace" | "generic-channel";
  };
  warnings: TimeSeriesWarning[];
};

type ParseUploadedTimeSeriesOptions = {
  id: string;
  name: string;
};

export const SENSOR_TIME_SERIES_CHANNELS = [
  "IMU 1 acc X",
  "IMU 1 acc Y",
  "IMU 1 acc Z",
  "IMU 1 gyr X",
  "IMU 1 gyr Y",
  "IMU 1 gyr Z",
  "IMU 2 acc X",
  "IMU 2 acc Y",
  "IMU 2 acc Z",
  "IMU 2 gyr X",
  "IMU 2 gyr Y",
  "IMU 2 gyr Z",
  "EMG envelope",
  "Temperature C",
] as const;

export function timeSeriesFromSensorSession(
  session: ParsedSession,
): TimeSeriesSession {
  return {
    id: session.id,
    name: session.name,
    channels: [...SENSOR_TIME_SERIES_CHANNELS],
    samples: session.frames.map((frame) => ({
      x: frame.tMs,
      values: {
        "IMU 1 acc X": frame.imu1.acc.x,
        "IMU 1 acc Y": frame.imu1.acc.y,
        "IMU 1 acc Z": frame.imu1.acc.z,
        "IMU 1 gyr X": frame.imu1.gyr.x,
        "IMU 1 gyr Y": frame.imu1.gyr.y,
        "IMU 1 gyr Z": frame.imu1.gyr.z,
        "IMU 2 acc X": frame.imu2.acc.x,
        "IMU 2 acc Y": frame.imu2.acc.y,
        "IMU 2 acc Z": frame.imu2.acc.z,
        "IMU 2 gyr X": frame.imu2.gyr.x,
        "IMU 2 gyr Y": frame.imu2.gyr.y,
        "IMU 2 gyr Z": frame.imu2.gyr.z,
        "EMG envelope": frame.emgEnv,
        "Temperature C": frame.tempC,
      },
    })),
    xAxis: "timeMs",
    durationMs: session.durationMs,
    source: {
      ...session.source,
      parser: "knee-brace",
    },
    warnings: warningsFromSensorWarnings(session.warnings),
  };
}

export function parseUploadedTimeSeries(
  text: string,
  options: ParseUploadedTimeSeriesOptions,
): TimeSeriesSession {
  const sensorSession = parseSensorCsv(text, options);

  if (sensorSession.frames.length > 0) {
    return timeSeriesFromSensorSession(sensorSession);
  }

  const genericSession = parseEegCsv(text, options);

  return {
    id: genericSession.id,
    name: genericSession.name,
    channels: genericSession.channels,
    samples: genericSession.samples,
    xAxis: genericSession.xAxis,
    durationMs: genericSession.durationMs,
    source: {
      ...genericSession.source,
      parser: "generic-channel",
    },
    warnings: genericSession.warnings,
  };
}

function warningsFromSensorWarnings(
  warnings: readonly ParserWarning[],
): TimeSeriesWarning[] {
  return warnings.map((warning) => ({
    lineNumber: warning.lineNumber,
    reason: warning.reason,
    raw: warning.raw,
  }));
}
