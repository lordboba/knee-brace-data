import { parseCsvLine } from "./csv";

export type EegXAxis = "timeMs" | "sampleIndex";

export type EegWarning = {
  lineNumber: number;
  reason: string;
  raw: string;
};

export type EegSample = {
  x: number;
  values: Record<string, number>;
};

export type ParsedEegSession = {
  id: string;
  name: string;
  channels: string[];
  samples: EegSample[];
  xAxis: EegXAxis;
  durationMs: number;
  source: {
    name: string;
    rowCount: number;
    validRowCount: number;
    hasHeader: boolean;
  };
  warnings: EegWarning[];
};

type ParseEegCsvOptions = {
  id: string;
  name: string;
};

type ParsedLine = {
  lineNumber: number;
  raw: string;
  columns: string[];
};

const TIME_COLUMN_NAMES = new Set([
  "time",
  "t",
  "timestamp",
  "timestamp_ms",
  "time_ms",
  "t_ms",
  "ms",
  "milliseconds",
  "seconds",
  "secs",
  "sec",
  "s",
]);

export function parseEegCsv(
  text: string,
  options: ParseEegCsvOptions,
): ParsedEegSession {
  const warnings: EegWarning[] = [];
  const parsedLines = parseContentLines(text, warnings);
  const firstLine = parsedLines[0];

  if (!firstLine) {
    return emptySession(options, warnings);
  }

  const hasHeader = firstLine.columns.some(
    (column) => parseFiniteNumber(column) === null,
  );
  const dataLines = hasHeader ? parsedLines.slice(1) : parsedLines;
  const schema = hasHeader
    ? schemaFromHeader(firstLine.columns)
    : schemaFromRows(dataLines);

  if (schema.channelIndexes.length === 0) {
    warnings.push({
      lineNumber: firstLine.lineNumber,
      reason: "No numeric EEG channels were found",
      raw: firstLine.raw,
    });

    return emptySession(options, warnings, hasHeader, dataLines.length);
  }

  const samples: EegSample[] = [];
  let validRowCount = 0;

  dataLines.forEach((line, sampleIndex) => {
    const expectedColumns = schema.columnCount;

    if (line.columns.length !== expectedColumns) {
      warnings.push({
        lineNumber: line.lineNumber,
        reason: `Expected ${expectedColumns} columns but found ${line.columns.length}`,
        raw: line.raw,
      });
      return;
    }

    const x =
      schema.timeIndex === null
        ? sampleIndex
        : parseFiniteNumber(line.columns[schema.timeIndex]);

    if (x === null) {
      warnings.push({
        lineNumber: line.lineNumber,
        reason: "Time column is not a finite number",
        raw: line.raw,
      });
      return;
    }

    const values: Record<string, number> = {};

    for (const channel of schema.channels) {
      const value = parseFiniteNumber(line.columns[channel.index]);

      if (value === null) {
        warnings.push({
          lineNumber: line.lineNumber,
          reason: `Channel ${channel.name} is not a finite number`,
          raw: line.raw,
        });
        return;
      }

      values[channel.name] = value;
    }

    validRowCount += 1;
    samples.push({ x, values });
  });

  samples.sort((a, b) => a.x - b.x);

  const xAxis = schema.timeIndex === null ? "sampleIndex" : "timeMs";
  const durationMs =
    xAxis === "timeMs" && samples.length > 1
      ? samples[samples.length - 1].x - samples[0].x
      : 0;

  return {
    id: options.id,
    name: options.name,
    channels: schema.channels.map((channel) => channel.name),
    samples,
    xAxis,
    durationMs,
    source: {
      name: options.name,
      rowCount: dataLines.length,
      validRowCount,
      hasHeader,
    },
    warnings,
  };
}

function parseContentLines(text: string, warnings: EegWarning[]): ParsedLine[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((rawLine, index): ParsedLine | null => {
      const raw = rawLine.replace(/\r$/, "");

      if (raw.trim().length === 0) {
        return null;
      }

      const parsed = parseCsvLine(raw);

      if (!parsed.ok) {
        warnings.push({
          lineNumber: index + 1,
          reason: parsed.reason,
          raw,
        });
        return null;
      }

      return {
        lineNumber: index + 1,
        raw,
        columns: parsed.columns,
      };
    })
    .filter((line): line is ParsedLine => line !== null);
}

function schemaFromHeader(columns: string[]) {
  const timeIndex = columns.findIndex((column) =>
    TIME_COLUMN_NAMES.has(normalizeColumnName(column)),
  );
  const channelIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(({ index }) => index !== timeIndex);

  return buildSchema({
    columnCount: columns.length,
    timeIndex: timeIndex === -1 ? null : timeIndex,
    channelIndexes: channelIndexes.map(({ index }) => index),
    channelNames: channelIndexes.map(({ column, index }) =>
      normalizeChannelName(column, index),
    ),
  });
}

function schemaFromRows(dataLines: ParsedLine[]) {
  const columnCount = dataLines[0]?.columns.length ?? 0;
  const timeIndex = firstColumnLooksLikeTime(dataLines) ? 0 : null;
  const channelIndexes = Array.from(
    { length: columnCount },
    (_, index) => index,
  ).filter((index) => index !== timeIndex);

  return buildSchema({
    columnCount,
    timeIndex,
    channelIndexes,
    channelNames: channelIndexes.map((_, index) => `EEG ${index + 1}`),
  });
}

function buildSchema({
  columnCount,
  timeIndex,
  channelIndexes,
  channelNames,
}: {
  columnCount: number;
  timeIndex: number | null;
  channelIndexes: number[];
  channelNames: string[];
}) {
  return {
    columnCount,
    timeIndex,
    channelIndexes,
    channels: channelIndexes.map((index, channelIndex) => ({
      index,
      name: channelNames[channelIndex],
    })),
  };
}

function firstColumnLooksLikeTime(dataLines: ParsedLine[]): boolean {
  const firstValues = dataLines
    .slice(0, 25)
    .map((line) => parseFiniteNumber(line.columns[0]));

  if (firstValues.length < 2 || !firstValues.every(isNumber)) {
    return false;
  }

  return firstValues.every((value, index) => {
    if (index === 0) {
      return true;
    }

    return value >= firstValues[index - 1];
  });
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

function normalizeColumnName(column: string): string {
  return column
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeChannelName(column: string, index: number): string {
  const name = column.trim();
  return name.length > 0 ? name : `EEG ${index + 1}`;
}

function parseFiniteNumber(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function emptySession(
  options: ParseEegCsvOptions,
  warnings: EegWarning[],
  hasHeader = false,
  rowCount = 0,
): ParsedEegSession {
  return {
    id: options.id,
    name: options.name,
    channels: [],
    samples: [],
    xAxis: "sampleIndex",
    durationMs: 0,
    source: {
      name: options.name,
      rowCount,
      validRowCount: 0,
      hasHeader,
    },
    warnings,
  };
}
