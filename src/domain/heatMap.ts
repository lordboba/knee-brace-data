import type {
  HeatMapChannel,
  HeatMapMetrics,
  ParsedSession,
  RgbIntensity,
  SensorFrame,
  Vector3Sample,
} from "./types";

export type HeatMapSample = {
  tMs: number;
  elapsedMs: number;
  frame: SensorFrame;
  motionIntensity: number;
  metrics: HeatMapMetrics;
  rgb: RgbIntensity;
};

type NumericRange = {
  min: number;
  max: number;
};

export function getImuMotionIntensity(frame: SensorFrame): number {
  const imu1Intensity =
    vectorMagnitude(frame.imu1.acc) + vectorMagnitude(frame.imu1.gyr);
  const imu2Intensity =
    vectorMagnitude(frame.imu2.acc) + vectorMagnitude(frame.imu2.gyr);
  return (imu1Intensity + imu2Intensity) / 2;
}

export function buildHeatMapSeries(session: ParsedSession): HeatMapSample[] {
  if (session.frames.length === 0) {
    return [];
  }

  const firstTMs = session.frames[0].tMs;
  const motionValues = session.frames.map(getImuMotionIntensity);
  const ranges = {
    temperature: rangeFor(session.frames.map((frame) => frame.tempC)),
    emg: rangeFor(session.frames.map((frame) => frame.emgEnv)),
    imu: rangeFor(motionValues),
  };

  return session.frames.map((frame, index) => {
    const metrics = {
      temperature: normalize(frame.tempC, ranges.temperature),
      emg: normalize(frame.emgEnv, ranges.emg),
      imu: normalize(motionValues[index], ranges.imu),
    };

    return {
      tMs: frame.tMs,
      elapsedMs: frame.tMs - firstTMs,
      frame,
      motionIntensity: motionValues[index],
      metrics,
      rgb: {
        r: metrics.temperature,
        g: metrics.emg,
        b: metrics.imu,
      },
    };
  });
}

export function sampleHeatAtElapsedMs(
  session: ParsedSession,
  elapsedMs: number,
): HeatMapSample {
  return sampleHeatSeriesAtElapsedMs(buildHeatMapSeries(session), elapsedMs);
}

export function sampleHeatSeriesAtElapsedMs(
  series: HeatMapSample[],
  elapsedMs: number,
): HeatMapSample {
  if (series.length === 0) {
    throw new Error("Cannot sample heat map from an empty session");
  }

  if (series.length === 1 || elapsedMs <= series[0].elapsedMs) {
    return series[0];
  }

  const lastSample = series[series.length - 1];

  if (elapsedMs >= lastSample.elapsedMs) {
    return lastSample;
  }

  let low = 0;
  let high = series.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const middleSample = series[middle];

    if (middleSample.elapsedMs === elapsedMs) {
      return middleSample;
    }

    if (middleSample.elapsedMs < elapsedMs) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  const previous = series[Math.max(0, low - 1)];
  const next = series[low];
  const span = next.elapsedMs - previous.elapsedMs;
  const amount = span === 0 ? 0 : (elapsedMs - previous.elapsedMs) / span;

  return {
    tMs: interpolate(previous.tMs, next.tMs, amount),
    elapsedMs,
    frame: amount < 0.5 ? previous.frame : next.frame,
    motionIntensity: interpolate(
      previous.motionIntensity,
      next.motionIntensity,
      amount,
    ),
    metrics: {
      temperature: interpolate(
        previous.metrics.temperature,
        next.metrics.temperature,
        amount,
      ),
      emg: interpolate(previous.metrics.emg, next.metrics.emg, amount),
      imu: interpolate(previous.metrics.imu, next.metrics.imu, amount),
    },
    rgb: {
      r: interpolate(previous.rgb.r, next.rgb.r, amount),
      g: interpolate(previous.rgb.g, next.rgb.g, amount),
      b: interpolate(previous.rgb.b, next.rgb.b, amount),
    },
  };
}

export function rgbIntensityToCss(rgb: RgbIntensity): string {
  const channel = (value: number) =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

export function rgbIntensityForSelectedHeatChannels(
  metrics: HeatMapMetrics,
  selectedChannels: readonly HeatMapChannel[],
): RgbIntensity {
  const channels = new Set(selectedChannels);

  return {
    r: channels.has("temperature") ? metrics.temperature : 0,
    g: channels.has("emg") ? metrics.emg : 0,
    b: channels.has("imu") ? metrics.imu : 0,
  };
}

function vectorMagnitude(vector: Vector3Sample): number {
  return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

function rangeFor(values: number[]): NumericRange {
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function normalize(value: number, range: NumericRange): number {
  if (range.max === range.min) {
    return 0;
  }

  return clamp01((value - range.min) / (range.max - range.min));
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp01(amount);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
