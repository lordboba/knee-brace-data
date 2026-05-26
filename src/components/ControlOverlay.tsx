import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Database,
  Gauge,
  RotateCcw,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type {
  BiomechanicsCalibration,
  BiomechanicsWarning,
  HeatMapChannel,
  ParsedSession,
  SegmentAxisMapping,
  SimulationMode,
  SignedSensorAxis,
} from "../domain/types";
import { formatElapsedTime } from "./time";

const HEAT_CHANNEL_OPTIONS = [
  {
    value: "temperature",
    label: "Temp",
    ariaLabel: "Temperature",
    swatchClassName: "legend-red",
  },
  {
    value: "emg",
    label: "EMG",
    ariaLabel: "EMG",
    swatchClassName: "legend-green",
  },
  {
    value: "imu",
    label: "IMU",
    ariaLabel: "IMU",
    swatchClassName: "legend-blue",
  },
] as const satisfies readonly {
  value: HeatMapChannel;
  label: string;
  ariaLabel: string;
  swatchClassName: string;
}[];

const SIGNED_AXIS_OPTIONS = ["x", "-x", "y", "-y", "z", "-z"] as const satisfies
  readonly SignedSensorAxis[];

const SEGMENT_AXIS_OPTIONS = [
  { key: "segmentX", label: "Segment X" },
  { key: "segmentY", label: "Segment Y" },
  { key: "segmentZ", label: "Segment Z" },
] as const satisfies readonly {
  key: keyof SegmentAxisMapping;
  label: string;
}[];

const CALIBRATION_WARNING_LABELS: Record<BiomechanicsWarning, string> = {
  "duplicate-thigh-axis": "Thigh mapping repeats a sensor axis.",
  "duplicate-calf-axis": "Calf mapping repeats a sensor axis.",
  "neutral-frame-out-of-range": "Neutral pose is outside this session.",
  "imu1-accelerometer-saturated": "IMU 1 accelerometer includes saturated samples.",
  "imu2-accelerometer-saturated": "IMU 2 accelerometer includes saturated samples.",
  "imu1-gravity-magnitude-out-of-range":
    "IMU 1 neutral gravity magnitude is outside the expected range.",
  "imu2-gravity-magnitude-out-of-range":
    "IMU 2 neutral gravity magnitude is outside the expected range.",
  "yaw-drift-unobservable":
    "Yaw drift cannot be observed without a magnetometer.",
};

type ControlOverlayProps = {
  activeSession: ParsedSession;
  biomechanicsCalibration: BiomechanicsCalibration;
  biomechanicsWarnings: readonly BiomechanicsWarning[];
  mode: SimulationMode;
  onBiomechanicsCalibrationChange: (
    calibration: BiomechanicsCalibration,
  ) => void;
  onModeChange: (mode: SimulationMode) => void;
  onResetBiomechanicsCalibration: () => void;
  onSelectSession: (sessionId: string) => void;
  onSetNeutralPose: () => void;
  onSpeedChange: (speed: number) => void;
  onToggleHeatChannel: (channel: HeatMapChannel) => void;
  onUpload: (file: File) => Promise<void>;
  playbackSpeeds: readonly number[];
  recordedSessions: ParsedSession[];
  selectedHeatChannels: readonly HeatMapChannel[];
  selectedSessionId: string;
  speed: number;
  uploadError: string | null;
};

export function ControlOverlay({
  activeSession,
  biomechanicsCalibration,
  biomechanicsWarnings,
  mode,
  onBiomechanicsCalibrationChange,
  onModeChange,
  onResetBiomechanicsCalibration,
  onSelectSession,
  onSetNeutralPose,
  onSpeedChange,
  onToggleHeatChannel,
  onUpload,
  playbackSpeeds,
  recordedSessions,
  selectedHeatChannels,
  selectedSessionId,
  speed,
  uploadError,
}: ControlOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const controlsId = "source-panel-controls";
  const updateSegmentAxis = (
    segment: "thigh" | "calf",
    axis: keyof SegmentAxisMapping,
    value: SignedSensorAxis,
  ) => {
    onBiomechanicsCalibrationChange({
      ...biomechanicsCalibration,
      [segment]: {
        ...biomechanicsCalibration[segment],
        [axis]: value,
      },
    });
  };

  return (
    <aside
      className={`control-overlay${isCollapsed ? " is-collapsed" : ""}`}
      aria-label="Playback controls"
    >
      <div className="control-header">
        <div>
          <p className="eyebrow">Source</p>
          <strong>{activeSession.name}</strong>
        </div>
        <div className="control-header-actions">
          <span>{formatElapsedTime(activeSession.durationMs)}</span>
          <button
            aria-controls={controlsId}
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed ? "Expand source panel" : "Collapse source panel"
            }
            className="collapse-source-button"
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
          >
            {isCollapsed ? (
              <ChevronDown aria-hidden="true" size={18} />
            ) : (
              <ChevronUp aria-hidden="true" size={18} />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <div id={controlsId}>
          <div className="mode-switch" aria-label="Simulation mode">
            <button
              className={mode === "recorded" ? "is-active" : ""}
              type="button"
              onClick={() => onModeChange("recorded")}
            >
              <Database aria-hidden="true" size={16} />
              Recorded
            </button>
            <button
              className={mode === "synthetic" ? "is-active" : ""}
              type="button"
              onClick={() => onModeChange("synthetic")}
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              Synthetic
            </button>
          </div>

          {mode === "recorded" ? (
            <label className="field">
              <span>Session</span>
              <select
                disabled={recordedSessions.length === 0}
                value={selectedSessionId}
                onChange={(event) => onSelectSession(event.target.value)}
              >
                {recordedSessions.length === 0 ? (
                  <option value="">Loading recorded sessions</option>
                ) : (
                  recordedSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <div className="synthetic-note">
              <Gauge aria-hidden="true" size={16} />
              <span>deterministic demo</span>
            </div>
          )}

          <label className="field">
            <span>Speed</span>
            <select
              value={speed}
              onChange={(event) => onSpeedChange(Number(event.target.value))}
            >
              {playbackSpeeds.map((playbackSpeed) => (
                <option key={playbackSpeed} value={playbackSpeed}>
                  {playbackSpeed}x
                </option>
              ))}
            </select>
          </label>

          <fieldset className="calibration-field">
            <legend>Biomechanics calibration</legend>
            <div className="neutral-pose-row">
              <span>
                Neutral pose {formatElapsedTime(biomechanicsCalibration.neutralElapsedMs)}
              </span>
              <div>
                <button
                  aria-label="Set neutral pose to current frame"
                  className="mini-icon-button"
                  type="button"
                  onClick={onSetNeutralPose}
                >
                  <Crosshair aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label="Reset biomechanics calibration"
                  className="mini-icon-button"
                  type="button"
                  onClick={onResetBiomechanicsCalibration}
                >
                  <RotateCcw aria-hidden="true" size={16} />
                </button>
              </div>
            </div>

            <div className="axis-mapping-grid">
              <SegmentAxisControls
                label="Thigh IMU 1"
                mapping={biomechanicsCalibration.thigh}
                onChange={(axis, value) =>
                  updateSegmentAxis("thigh", axis, value)
                }
              />
              <SegmentAxisControls
                label="Calf IMU 2"
                mapping={biomechanicsCalibration.calf}
                onChange={(axis, value) =>
                  updateSegmentAxis("calf", axis, value)
                }
              />
            </div>

            {biomechanicsWarnings.length > 0 ? (
              <ul className="calibration-warning-list">
                {biomechanicsWarnings.map((warning) => (
                  <li key={warning}>
                    <AlertTriangle aria-hidden="true" size={14} />
                    <span>{CALIBRATION_WARNING_LABELS[warning]}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </fieldset>

          <fieldset className="heat-channel-field">
            <legend>Sensor layers</legend>
            <div className="heat-channel-list" aria-label="Sensor layer toggles">
              {HEAT_CHANNEL_OPTIONS.map((option) => {
                const isSelected = selectedHeatChannels.includes(option.value);

                return (
                  <label
                    className={`heat-channel-option${isSelected ? " is-active" : ""}`}
                    htmlFor={`heat-channel-${option.value}`}
                    key={option.value}
                  >
                    <input
                      aria-label={option.ariaLabel}
                      checked={isSelected}
                      id={`heat-channel-${option.value}`}
                      type="checkbox"
                      onChange={() => onToggleHeatChannel(option.value)}
                    />
                    <i className={`channel-swatch ${option.swatchClassName}`} />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="rgb-legend" aria-label="Sensor layer legend">
            <span>
              <i className="legend-red" />Skin temp
            </span>
            <span>
              <i className="legend-green" />EMG pulse
            </span>
            <span>
              <i className="legend-blue" />IMU axes
            </span>
          </div>

          <label className="upload-control">
            <Upload aria-hidden="true" size={16} />
            <span>Upload CSV/TXT</span>
            <input
              accept=".csv,.txt,text/csv,text/plain"
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void onUpload(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>

          {uploadError ? <p className="inline-error">{uploadError}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}

function SegmentAxisControls({
  label,
  mapping,
  onChange,
}: {
  label: string;
  mapping: SegmentAxisMapping;
  onChange: (axis: keyof SegmentAxisMapping, value: SignedSensorAxis) => void;
}) {
  return (
    <div className="axis-mapping-card">
      <strong>{label}</strong>
      {SEGMENT_AXIS_OPTIONS.map((option) => (
        <label className="axis-field" key={option.key}>
          <span>{option.label}</span>
          <select
            aria-label={`${label} ${option.label}`}
            value={mapping[option.key]}
            onChange={(event) =>
              onChange(option.key, event.target.value as SignedSensorAxis)
            }
          >
            {SIGNED_AXIS_OPTIONS.map((axis) => (
              <option key={axis} value={axis}>
                {axis}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
