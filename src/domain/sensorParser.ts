import { parseCsvLine, type CsvLineResult } from "./csv";
import type { ParsedSession, ParserWarning, SensorFrame } from "./types";

export const CSV_COLUMNS = [
  "t_ms",
  "imu1_acc_x",
  "imu1_acc_y",
  "imu1_acc_z",
  "imu1_gyr_x",
  "imu1_gyr_y",
  "imu1_gyr_z",
  "imu2_acc_x",
  "imu2_acc_y",
  "imu2_acc_z",
  "imu2_gyr_x",
  "imu2_gyr_y",
  "imu2_gyr_z",
  "emg_env",
  "temp_c"
] as const;

type ParseSensorCsvOptions = {
  id: string;
  name: string;
};

export function parseSensorCsv(text: string, options: ParseSensorCsvOptions): ParsedSession {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const warnings: ParserWarning[] = [];
  const frames: SensorFrame[] = [];
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);
  const hasHeader =
    firstContentLineIndex >= 0 &&
    matchesDocumentedHeader(parseCsvLine(lines[firstContentLineIndex]));

  let rowCount = 0;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const raw = rawLine.replace(/\r$/, "");

    if (raw.trim().length === 0) {
      return;
    }

    if (hasHeader && index === firstContentLineIndex) {
      return;
    }

    rowCount += 1;
    const parsed = parseCsvLine(raw);

    if (!parsed.ok) {
      warnings.push({ lineNumber, reason: parsed.reason, raw });
      return;
    }

    if (parsed.columns.length !== CSV_COLUMNS.length) {
      warnings.push({
        lineNumber,
        reason: `Expected 15 columns but found ${parsed.columns.length}`,
        raw
      });
      return;
    }

    const numericValues = parsed.columns.map(parseFiniteNumber);
    const invalidColumnIndex = numericValues.findIndex((value) => value === null);

    if (invalidColumnIndex !== -1) {
      warnings.push({
        lineNumber,
        reason: `Column ${CSV_COLUMNS[invalidColumnIndex]} is not a finite number`,
        raw
      });
      return;
    }

    frames.push(frameFromValues(numericValues as number[]));
  });

  frames.sort((a, b) => a.tMs - b.tMs);

  return {
    id: options.id,
    name: options.name,
    frames,
    durationMs: frames.length > 1 ? frames[frames.length - 1].tMs - frames[0].tMs : 0,
    source: {
      name: options.name,
      rowCount,
      validRowCount: frames.length,
      hasHeader
    },
    warnings
  };
}

function matchesDocumentedHeader(parsed: CsvLineResult): boolean {
  if (!parsed.ok || parsed.columns.length !== CSV_COLUMNS.length) {
    return false;
  }

  return parsed.columns.every(
    (column, index) => column.trim().toLowerCase() === CSV_COLUMNS[index]
  );
}

function parseFiniteNumber(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function frameFromValues(values: number[]): SensorFrame {
  return {
    tMs: values[0],
    imu1: {
      acc: { x: values[1], y: values[2], z: values[3] },
      gyr: { x: values[4], y: values[5], z: values[6] }
    },
    imu2: {
      acc: { x: values[7], y: values[8], z: values[9] },
      gyr: { x: values[10], y: values[11], z: values[12] }
    },
    emgEnv: values[13],
    tempC: values[14]
  };
}
