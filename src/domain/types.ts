export type SimulationMode = "recorded" | "synthetic";

export type SensorId = "imu1" | "imu2" | "emg" | "temp";

export type SensorModality = "imu" | "emg" | "temperature";

export type HeatMapChannel = SensorModality;

export type Vector3Sample = {
  x: number;
  y: number;
  z: number;
};

export type ImuSample = {
  acc: Vector3Sample;
  gyr: Vector3Sample;
};

export type SensorFrame = {
  tMs: number;
  imu1: ImuSample;
  imu2: ImuSample;
  emgEnv: number;
  tempC: number;
};

export type ParserWarning = {
  lineNumber: number;
  reason: string;
  raw: string;
};

export type ParsedSessionSource = {
  name: string;
  rowCount: number;
  validRowCount: number;
  hasHeader: boolean;
};

export type ParsedSession = {
  id: string;
  name: string;
  frames: SensorFrame[];
  durationMs: number;
  source: ParsedSessionSource;
  warnings: ParserWarning[];
};

export type SensorZone = {
  id: SensorId;
  label: string;
  modality: SensorModality;
  position: [number, number, number];
  radius: number;
};

export type SensorLayout = {
  zones: SensorZone[];
};

export type RgbIntensity = {
  r: number;
  g: number;
  b: number;
};

export type HeatMapMetrics = {
  temperature: number;
  emg: number;
  imu: number;
};
