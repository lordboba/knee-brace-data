import type {
  BiomechanicsCalibration,
  BiomechanicsSample,
  BiomechanicsWarning,
  ImuSample,
  ParsedSession,
  QuaternionSample,
  SegmentAxisMapping,
  SensorFrame,
  SignedSensorAxis,
  Vector3Sample,
} from "./types";

const WORLD_GRAVITY: Vector3Sample = { x: 0, y: -1, z: 0 };
const IDENTITY_QUATERNION: QuaternionSample = { x: 0, y: 0, z: 0, w: 1 };
const DEFAULT_ACCELERATION_MAGNITUDE = 1_000;
const SATURATION_THRESHOLD = 1_999;
const MIN_GRAVITY_MAGNITUDE = 0.35 * DEFAULT_ACCELERATION_MAGNITUDE;
const MAX_GRAVITY_MAGNITUDE = 1.65 * DEFAULT_ACCELERATION_MAGNITUDE;
const ACCELEROMETER_CORRECTION_GAIN = 0.025;

export function createDefaultBiomechanicsCalibration(
  session: ParsedSession,
  neutralElapsedMs = 0,
): BiomechanicsCalibration {
  return {
    neutralElapsedMs: clamp(neutralElapsedMs, 0, session.durationMs),
    thigh: identityAxisMapping(),
    calf: identityAxisMapping(),
    gyroUnits: "deg/s",
  };
}

export function validateBiomechanicsCalibration(
  session: ParsedSession,
  calibration: BiomechanicsCalibration,
): BiomechanicsWarning[] {
  const warnings = new Set<BiomechanicsWarning>(["yaw-drift-unobservable"]);

  if (
    calibration.neutralElapsedMs < 0 ||
    calibration.neutralElapsedMs > session.durationMs
  ) {
    warnings.add("neutral-frame-out-of-range");
  }

  if (hasDuplicateAxes(calibration.thigh)) {
    warnings.add("duplicate-thigh-axis");
  }

  if (hasDuplicateAxes(calibration.calf)) {
    warnings.add("duplicate-calf-axis");
  }

  if (session.frames.some((frame) => hasSaturatedAxis(frame.imu1.acc))) {
    warnings.add("imu1-accelerometer-saturated");
  }

  if (session.frames.some((frame) => hasSaturatedAxis(frame.imu2.acc))) {
    warnings.add("imu2-accelerometer-saturated");
  }

  const neutralFrame = frameClosestToElapsedMs(session, calibration.neutralElapsedMs);

  if (neutralFrame) {
    if (!isPlausibleGravityMagnitude(neutralFrame.imu1.acc)) {
      warnings.add("imu1-gravity-magnitude-out-of-range");
    }

    if (!isPlausibleGravityMagnitude(neutralFrame.imu2.acc)) {
      warnings.add("imu2-gravity-magnitude-out-of-range");
    }
  }

  return [...warnings];
}

export function buildBiomechanicsSeries(
  session: ParsedSession,
  calibration: BiomechanicsCalibration,
): BiomechanicsSample[] {
  if (session.frames.length === 0) {
    return [];
  }

  const warnings = validateBiomechanicsCalibration(session, calibration);
  const firstTMs = session.frames[0].tMs;
  const thighSeries = buildSegmentOrientationSeries(
    session.frames,
    (frame) => frame.imu1,
    calibration.thigh,
    calibration,
  );
  const calfSeries = buildSegmentOrientationSeries(
    session.frames,
    (frame) => frame.imu2,
    calibration.calf,
    calibration,
  );
  const neutralIndex = indexClosestToElapsedMs(session, calibration.neutralElapsedMs);
  const neutralThigh = thighSeries[neutralIndex] ?? thighSeries[0];
  const neutralCalf = calfSeries[neutralIndex] ?? calfSeries[0];

  return session.frames.map((frame, index) => {
    const thighOrientation = multiplyQuaternions(
      invertQuaternion(neutralThigh),
      thighSeries[index],
    );
    const calfOrientation = multiplyQuaternions(
      invertQuaternion(neutralCalf),
      calfSeries[index],
    );
    const kneeOrientation = multiplyQuaternions(
      invertQuaternion(thighOrientation),
      calfOrientation,
    );

    return {
      tMs: frame.tMs,
      elapsedMs: frame.tMs - firstTMs,
      frame,
      thighOrientation,
      calfOrientation,
      kneeOrientation,
      kneeFlexionDeg: relativeFlexionDegrees(thighOrientation, calfOrientation),
      warnings,
    };
  });
}

export function sampleBiomechanicsSeriesAtElapsedMs(
  series: readonly BiomechanicsSample[],
  elapsedMs: number,
): BiomechanicsSample {
  if (series.length === 0) {
    throw new Error("Cannot sample biomechanics from an empty session");
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
  const thighOrientation = slerpQuaternions(
    previous.thighOrientation,
    next.thighOrientation,
    amount,
  );
  const calfOrientation = slerpQuaternions(
    previous.calfOrientation,
    next.calfOrientation,
    amount,
  );
  const kneeOrientation = multiplyQuaternions(
    invertQuaternion(thighOrientation),
    calfOrientation,
  );

  return {
    tMs: interpolate(previous.tMs, next.tMs, amount),
    elapsedMs,
    frame: amount < 0.5 ? previous.frame : next.frame,
    thighOrientation,
    calfOrientation,
    kneeOrientation,
    kneeFlexionDeg: relativeFlexionDegrees(thighOrientation, calfOrientation),
    warnings: previous.warnings,
  };
}

export function relativeFlexionDegrees(
  thighOrientation: QuaternionSample,
  calfOrientation: QuaternionSample,
): number {
  const relative = multiplyQuaternions(
    invertQuaternion(thighOrientation),
    calfOrientation,
  );
  const flexionRadians = 2 * Math.atan2(relative.x, relative.w);

  return normalizeDegrees((flexionRadians * 180) / Math.PI);
}

function buildSegmentOrientationSeries(
  frames: readonly SensorFrame[],
  readImu: (frame: SensorFrame) => ImuSample,
  axisMapping: SegmentAxisMapping,
  calibration: BiomechanicsCalibration,
): QuaternionSample[] {
  if (hasDuplicateAxes(axisMapping)) {
    return frames.map(() => IDENTITY_QUATERNION);
  }

  const firstImu = readImu(frames[0]);
  const firstAcceleration = mapVectorToSegment(firstImu.acc, axisMapping);
  const orientations: QuaternionSample[] = [
    orientationFromGravity(firstAcceleration),
  ];

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    const dtSeconds = Math.max(0, (current.tMs - previous.tMs) / 1_000);
    const currentImu = readImu(current);
    const gyro = mapVectorToSegment(currentImu.gyr, axisMapping);
    const acceleration = mapVectorToSegment(currentImu.acc, axisMapping);
    const previousOrientation = orientations[index - 1];
    const gyroOrientation = integrateGyroscope(
      previousOrientation,
      gyro,
      dtSeconds,
      calibration.gyroUnits,
    );
    orientations.push(correctTiltWithAccelerometer(gyroOrientation, acceleration));
  }

  return orientations;
}

function integrateGyroscope(
  orientation: QuaternionSample,
  gyro: Vector3Sample,
  dtSeconds: number,
  gyroUnits: BiomechanicsCalibration["gyroUnits"],
): QuaternionSample {
  const radiansPerSecond =
    gyroUnits === "deg/s"
      ? {
          x: (gyro.x * Math.PI) / 180,
          y: (gyro.y * Math.PI) / 180,
          z: (gyro.z * Math.PI) / 180,
        }
      : gyro;
  const angularSpeed = vectorMagnitude(radiansPerSecond);

  if (angularSpeed === 0 || dtSeconds === 0) {
    return orientation;
  }

  const delta = quaternionFromAxisAngle(
    scaleVector(radiansPerSecond, 1 / angularSpeed),
    angularSpeed * dtSeconds,
  );

  return normalizeQuaternion(multiplyQuaternions(orientation, delta));
}

function correctTiltWithAccelerometer(
  orientation: QuaternionSample,
  acceleration: Vector3Sample,
): QuaternionSample {
  const measuredGravity = normalizeVector(acceleration);

  if (!measuredGravity) {
    return orientation;
  }

  const expectedGravity = rotateVector(invertQuaternion(orientation), WORLD_GRAVITY);
  const correction = quaternionFromUnitVectors(measuredGravity, expectedGravity);
  const dampedCorrection = slerpQuaternions(
    IDENTITY_QUATERNION,
    correction,
    ACCELEROMETER_CORRECTION_GAIN,
  );

  return normalizeQuaternion(multiplyQuaternions(orientation, dampedCorrection));
}

function orientationFromGravity(acceleration: Vector3Sample): QuaternionSample {
  const gravity = normalizeVector(acceleration);

  if (!gravity) {
    return IDENTITY_QUATERNION;
  }

  return quaternionFromUnitVectors(gravity, WORLD_GRAVITY);
}

function mapVectorToSegment(
  vector: Vector3Sample,
  axisMapping: SegmentAxisMapping,
): Vector3Sample {
  return {
    x: valueForSignedAxis(vector, axisMapping.segmentX),
    y: valueForSignedAxis(vector, axisMapping.segmentY),
    z: valueForSignedAxis(vector, axisMapping.segmentZ),
  };
}

function identityAxisMapping(): SegmentAxisMapping {
  return {
    segmentX: "x",
    segmentY: "y",
    segmentZ: "z",
  };
}

function valueForSignedAxis(
  vector: Vector3Sample,
  signedAxis: SignedSensorAxis,
): number {
  const sign = signedAxis.startsWith("-") ? -1 : 1;
  const axis = signedAxis.replace("-", "") as keyof Vector3Sample;

  return vector[axis] * sign;
}

function hasDuplicateAxes(axisMapping: SegmentAxisMapping): boolean {
  const axes = [
    unsignedAxis(axisMapping.segmentX),
    unsignedAxis(axisMapping.segmentY),
    unsignedAxis(axisMapping.segmentZ),
  ];

  return new Set(axes).size !== axes.length;
}

function unsignedAxis(axis: SignedSensorAxis): string {
  return axis.replace("-", "");
}

function hasSaturatedAxis(vector: Vector3Sample): boolean {
  return (
    Math.abs(vector.x) >= SATURATION_THRESHOLD ||
    Math.abs(vector.y) >= SATURATION_THRESHOLD ||
    Math.abs(vector.z) >= SATURATION_THRESHOLD
  );
}

function isPlausibleGravityMagnitude(vector: Vector3Sample): boolean {
  const magnitude = vectorMagnitude(vector);
  return (
    magnitude >= MIN_GRAVITY_MAGNITUDE && magnitude <= MAX_GRAVITY_MAGNITUDE
  );
}

function frameClosestToElapsedMs(
  session: ParsedSession,
  elapsedMs: number,
): SensorFrame | null {
  if (session.frames.length === 0) {
    return null;
  }

  return session.frames[indexClosestToElapsedMs(session, elapsedMs)] ?? null;
}

function indexClosestToElapsedMs(
  session: ParsedSession,
  elapsedMs: number,
): number {
  if (session.frames.length === 0) {
    return 0;
  }

  const firstTMs = session.frames[0].tMs;
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  session.frames.forEach((frame, index) => {
    const distance = Math.abs(frame.tMs - firstTMs - elapsedMs);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

function quaternionFromAxisAngle(
  axis: Vector3Sample,
  radians: number,
): QuaternionSample {
  const halfAngle = radians / 2;
  const scale = Math.sin(halfAngle);

  return normalizeQuaternion({
    x: axis.x * scale,
    y: axis.y * scale,
    z: axis.z * scale,
    w: Math.cos(halfAngle),
  });
}

function quaternionFromUnitVectors(
  from: Vector3Sample,
  to: Vector3Sample,
): QuaternionSample {
  const dot = dotVectors(from, to);

  if (dot < -0.999999) {
    const fallbackAxis = normalizeVector(crossVectors({ x: 1, y: 0, z: 0 }, from));
    const axis =
      fallbackAxis ?? normalizeVector(crossVectors({ x: 0, y: 0, z: 1 }, from));

    return quaternionFromAxisAngle(axis ?? { x: 0, y: 1, z: 0 }, Math.PI);
  }

  const cross = crossVectors(from, to);

  return normalizeQuaternion({
    x: cross.x,
    y: cross.y,
    z: cross.z,
    w: 1 + dot,
  });
}

function multiplyQuaternions(
  a: QuaternionSample,
  b: QuaternionSample,
): QuaternionSample {
  return normalizeQuaternion({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });
}

function invertQuaternion(quaternion: QuaternionSample): QuaternionSample {
  return {
    x: -quaternion.x,
    y: -quaternion.y,
    z: -quaternion.z,
    w: quaternion.w,
  };
}

function normalizeQuaternion(quaternion: QuaternionSample): QuaternionSample {
  const magnitude = Math.sqrt(
    quaternion.x ** 2 +
      quaternion.y ** 2 +
      quaternion.z ** 2 +
      quaternion.w ** 2,
  );

  if (magnitude === 0) {
    return IDENTITY_QUATERNION;
  }

  return {
    x: quaternion.x / magnitude,
    y: quaternion.y / magnitude,
    z: quaternion.z / magnitude,
    w: quaternion.w / magnitude,
  };
}

function slerpQuaternions(
  start: QuaternionSample,
  end: QuaternionSample,
  amount: number,
): QuaternionSample {
  const t = clamp(amount, 0, 1);
  let target = end;
  let cosHalfTheta = dotQuaternion(start, target);

  if (cosHalfTheta < 0) {
    target = {
      x: -target.x,
      y: -target.y,
      z: -target.z,
      w: -target.w,
    };
    cosHalfTheta = -cosHalfTheta;
  }

  if (cosHalfTheta >= 0.9995) {
    return normalizeQuaternion({
      x: interpolate(start.x, target.x, t),
      y: interpolate(start.y, target.y, t),
      z: interpolate(start.z, target.z, t),
      w: interpolate(start.w, target.w, t),
    });
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  return normalizeQuaternion({
    x: start.x * ratioA + target.x * ratioB,
    y: start.y * ratioA + target.y * ratioB,
    z: start.z * ratioA + target.z * ratioB,
    w: start.w * ratioA + target.w * ratioB,
  });
}

function rotateVector(
  quaternion: QuaternionSample,
  vector: Vector3Sample,
): Vector3Sample {
  const vectorQuaternion: QuaternionSample = {
    x: vector.x,
    y: vector.y,
    z: vector.z,
    w: 0,
  };
  const rotated = multiplyRawQuaternions(
    multiplyRawQuaternions(quaternion, vectorQuaternion),
    invertQuaternion(quaternion),
  );

  return { x: rotated.x, y: rotated.y, z: rotated.z };
}

function multiplyRawQuaternions(
  a: QuaternionSample,
  b: QuaternionSample,
): QuaternionSample {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function normalizeVector(vector: Vector3Sample): Vector3Sample | null {
  const magnitude = vectorMagnitude(vector);

  if (magnitude === 0) {
    return null;
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

function vectorMagnitude(vector: Vector3Sample): number {
  return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

function scaleVector(vector: Vector3Sample, scale: number): Vector3Sample {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  };
}

function crossVectors(a: Vector3Sample, b: Vector3Sample): Vector3Sample {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dotVectors(a: Vector3Sample, b: Vector3Sample): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function dotQuaternion(a: QuaternionSample, b: QuaternionSample): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

function normalizeDegrees(degrees: number): number {
  let normalized = degrees;

  while (normalized > 180) {
    normalized -= 360;
  }

  while (normalized < -180) {
    normalized += 360;
  }

  return normalized;
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * clamp(amount, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
