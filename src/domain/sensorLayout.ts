import type { SensorLayout } from "./types";

export const defaultSensorLayout: SensorLayout = {
  zones: [
    {
      id: "imu1",
      label: "IMU 1",
      modality: "imu",
      position: [-0.54, 0.66, 0.2],
      radius: 0.12
    },
    {
      id: "imu2",
      label: "IMU 2",
      modality: "imu",
      position: [0.48, -0.66, 0.2],
      radius: 0.12
    },
    {
      id: "emg",
      label: "EMG",
      modality: "emg",
      position: [-0.18, -0.12, 0.28],
      radius: 0.16
    },
    {
      id: "temp",
      label: "TMP117",
      modality: "temperature",
      position: [0.22, 0.08, 0.31],
      radius: 0.14
    }
  ]
};
