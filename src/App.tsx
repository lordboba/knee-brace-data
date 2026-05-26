import { Activity, LineChart, Pause, Play, Upload } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Timeline } from "./components/Timeline";
import { WarningsPanel } from "./components/WarningsPanel";
import { ControlOverlay } from "./components/ControlOverlay";
import { IntensityLegend } from "./components/IntensityLegend";
import { TimeSeriesGraphsPage } from "./components/TimeSeriesGraphsPage";
import { loadBuiltInSessions, syntheticSession } from "./data/sampleSessions";
import {
  buildHeatMapSeries,
  sampleHeatSeriesAtElapsedMs,
} from "./domain/heatMap";
import { parseSensorCsv } from "./domain/sensorParser";
import type {
  HeatMapChannel,
  ParsedSession,
  SimulationMode,
} from "./domain/types";

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
const DEFAULT_HEAT_CHANNELS = [
  "temperature",
  "emg",
  "imu",
] as const satisfies readonly HeatMapChannel[];
const SensorScene = lazy(() =>
  import("./components/SensorScene").then((module) => ({
    default: module.SensorScene,
  })),
);

type AppPage = "threeD" | "eeg2d";

export default function App() {
  const [page, setPage] = useState<AppPage>("threeD");
  const [mode, setMode] = useState<SimulationMode>("recorded");
  const [recordedSessions, setRecordedSessions] = useState<ParsedSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedHeatChannels, setSelectedHeatChannels] = useState<
    HeatMapChannel[]
  >([...DEFAULT_HEAT_CHANNELS]);
  const [speed, setSpeed] = useState<number>(1);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const selectedRecordedSession =
    recordedSessions.find((session) => session.id === selectedSessionId) ??
    recordedSessions[0];
  const activeSession =
    mode === "synthetic" || !selectedRecordedSession
      ? syntheticSession
      : selectedRecordedSession;
  const heatSeries = useMemo(
    () => buildHeatMapSeries(activeSession),
    [activeSession],
  );
  const heatSample = useMemo(
    () => sampleHeatSeriesAtElapsedMs(heatSeries, playbackMs),
    [heatSeries, playbackMs],
  );

  useEffect(() => {
    let isCancelled = false;

    void loadBuiltInSessions().then((sessions) => {
      if (isCancelled) {
        return;
      }

      setRecordedSessions(sessions);
      setSelectedSessionId(sessions[0]?.id ?? "");
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    setPlaybackMs(0);
  }, [activeSession.id]);

  useEffect(() => {
    setPlaybackMs((current) => Math.min(current, activeSession.durationMs));
  }, [activeSession.durationMs]);

  useEffect(() => {
    if (!isPlaying || activeSession.durationMs <= 0) {
      return;
    }

    let previousTimestamp = performance.now();

    const tick = (timestamp: number) => {
      const deltaMs = (timestamp - previousTimestamp) * speed;
      previousTimestamp = timestamp;

      setPlaybackMs((current) => {
        const next = current + deltaMs;
        return next > activeSession.durationMs
          ? next % activeSession.durationMs
          : next;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [activeSession.durationMs, isPlaying, speed]);

  const handleUpload = async (file: File) => {
    setUploadError(null);
    const text = await file.text();
    const parsed = parseSensorCsv(text, {
      id: `uploaded-${file.name}-${file.lastModified}`,
      name: file.name,
    });

    if (parsed.frames.length === 0) {
      setUploadError("Uploaded file has no valid sensor rows.");
      return;
    }

    setRecordedSessions((sessions) => [parsed, ...sessions]);
    setSelectedSessionId(parsed.id);
    setMode("recorded");
    setIsPlaying(false);
    setPlaybackMs(0);
  };

  const handleToggleHeatChannel = (channel: HeatMapChannel) => {
    setSelectedHeatChannels((current) => {
      const next = current.includes(channel)
        ? current.filter((selectedChannel) => selectedChannel !== channel)
        : [...current, channel];

      return DEFAULT_HEAT_CHANNELS.filter((candidate) =>
        next.includes(candidate),
      );
    });
  };

  if (page === "eeg2d") {
    return (
      <TimeSeriesGraphsPage
        recordedSessions={recordedSessions}
        onBackTo3d={() => setPage("threeD")}
      />
    );
  }

  return (
    <main className="app-shell">
      <Suspense
        fallback={
          <div
            aria-label="Loading 3D scene"
            className="scene-shell scene-fallback"
            role="status"
          />
        }
      >
        <SensorScene
          heatSample={heatSample}
          isPlaying={isPlaying}
          selectedHeatChannels={selectedHeatChannels}
        />
      </Suspense>

      <section className="top-bar" aria-label="Simulator status">
        <div>
          <p className="eyebrow">Immersive sensor playback</p>
          <h1>Knee Brace Sensor Simulator</h1>
        </div>
        <div className="top-actions">
          <button
            aria-label="Open 2D data graphs"
            className="page-switch-button"
            type="button"
            onClick={() => setPage("eeg2d")}
          >
            <LineChart aria-hidden="true" size={16} />
            <span>2D Data</span>
          </button>
          <div className="status-chip">
            <Activity aria-hidden="true" size={16} />
            <span>
              {Math.round(heatSample.motionIntensity).toLocaleString()} IMU
            </span>
          </div>
        </div>
      </section>

      <ControlOverlay
        activeSession={activeSession}
        mode={mode}
        onModeChange={setMode}
        onSelectSession={setSelectedSessionId}
        onSpeedChange={setSpeed}
        onToggleHeatChannel={handleToggleHeatChannel}
        onUpload={handleUpload}
        playbackSpeeds={PLAYBACK_SPEEDS}
        recordedSessions={recordedSessions}
        selectedHeatChannels={selectedHeatChannels}
        selectedSessionId={selectedSessionId}
        speed={speed}
        uploadError={uploadError}
      />

      <IntensityLegend selectedHeatChannels={selectedHeatChannels} />

      <button
        className="play-button"
        type="button"
        aria-label={isPlaying ? "Pause playback" : "Play playback"}
        onClick={() => setIsPlaying((current) => !current)}
      >
        {isPlaying ? (
          <Pause aria-hidden="true" size={22} />
        ) : (
          <Play aria-hidden="true" size={22} />
        )}
      </button>

      <WarningsPanel warnings={activeSession.warnings} />

      <Timeline
        durationMs={activeSession.durationMs}
        elapsedMs={playbackMs}
        onChange={setPlaybackMs}
      />

      <label className="upload-fab" title="Upload CSV or TXT session">
        <Upload aria-hidden="true" size={20} />
        <input
          accept=".csv,.txt,text/csv,text/plain"
          type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              void handleUpload(file);
            }
            event.currentTarget.value = "";
          }}
        />
      </label>
    </main>
  );
}
