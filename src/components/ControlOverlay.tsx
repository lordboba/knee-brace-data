import {
  ChevronDown,
  ChevronUp,
  Database,
  Gauge,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { useState } from "react";
import type {
  HeatMapChannel,
  ParsedSession,
  SimulationMode,
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

type ControlOverlayProps = {
  activeSession: ParsedSession;
  mode: SimulationMode;
  onModeChange: (mode: SimulationMode) => void;
  onSelectSession: (sessionId: string) => void;
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
  mode,
  onModeChange,
  onSelectSession,
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

          <fieldset className="heat-channel-field">
            <legend>Heat map</legend>
            <div className="heat-channel-list" aria-label="Heat map channels">
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

          <div className="rgb-legend" aria-label="RGB heat map legend">
            <span>
              <i className="legend-red" />R temp
            </span>
            <span>
              <i className="legend-green" />G EMG
            </span>
            <span>
              <i className="legend-blue" />B IMU
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
