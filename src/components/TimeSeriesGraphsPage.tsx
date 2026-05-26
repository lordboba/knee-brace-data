import { AlertTriangle, ArrowLeft, FileUp, LineChart } from "lucide-react";
import { useMemo, useState } from "react";
import {
  parseUploadedTimeSeries,
  timeSeriesFromSensorSession,
  type TimeSeriesSession,
} from "../domain/timeSeries";
import type { ParsedSession } from "../domain/types";

type TimeSeriesGraphsPageProps = {
  recordedSessions: readonly ParsedSession[];
  onBackTo3d: () => void;
};

const GRAPH_COLORS = [
  "#77c899",
  "#5e9bd6",
  "#df5b53",
  "#f0b85d",
  "#c084fc",
  "#6ee7d8",
  "#f472b6",
  "#a3e635",
];

export function TimeSeriesGraphsPage({
  recordedSessions,
  onBackTo3d,
}: TimeSeriesGraphsPageProps) {
  const builtInSessions = useMemo(
    () => recordedSessions.map(timeSeriesFromSensorSession),
    [recordedSessions],
  );
  const [uploadedSessions, setUploadedSessions] = useState<TimeSeriesSession[]>(
    [],
  );
  const sessions = useMemo(
    () => [...uploadedSessions, ...builtInSessions],
    [builtInSessions, uploadedSessions],
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];
  const visibleChannels = useMemo(
    () => selectedSession?.channels.slice(0, 8) ?? [],
    [selectedSession],
  );

  const handleUpload = async (file: File) => {
    setUploadError(null);
    const text = await file.text();
    const parsed = parseUploadedTimeSeries(text, {
      id: `uploaded-2d-${file.name}-${file.lastModified}`,
      name: file.name,
    });

    if (parsed.samples.length === 0) {
      setUploadError("Uploaded file has no valid graphable samples.");
      return;
    }

    setUploadedSessions((current) => [parsed, ...current]);
    setSelectedSessionId(parsed.id);
  };

  return (
    <main className="eeg-page">
      <header className="eeg-header">
        <button className="icon-text-button" type="button" onClick={onBackTo3d}>
          <ArrowLeft aria-hidden="true" size={18} />
          <span>3D</span>
        </button>
        <div>
          <p className="eyebrow">2D sensor visualization</p>
          <h1>Sensor Data Graphs</h1>
        </div>
        <label className="icon-text-button upload-eeg-button">
          <FileUp aria-hidden="true" size={18} />
          <span>Upload</span>
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
      </header>

      <section className="eeg-workspace" aria-label="Sensor graph workspace">
        {selectedSession ? (
          <>
            <aside className="eeg-summary" aria-label="Sensor data summary">
              <div>
                <p className="eyebrow">File</p>
                <strong>{selectedSession.name}</strong>
              </div>
              <label className="field">
                <span>Dataset</span>
                <select
                  value={selectedSession.id}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </label>
              <dl>
                <div>
                  <dt>Samples</dt>
                  <dd>{selectedSession.samples.length.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Channels</dt>
                  <dd>{selectedSession.channels.length.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Parser</dt>
                  <dd>{parserLabel(selectedSession.source.parser)}</dd>
                </div>
              </dl>
              {selectedSession.warnings.length > 0 ? (
                <div className="eeg-warning">
                  <AlertTriangle aria-hidden="true" size={16} />
                  <span>
                    {selectedSession.warnings.length.toLocaleString()} cleaned
                    row{selectedSession.warnings.length === 1 ? "" : "s"}
                  </span>
                </div>
              ) : null}
            </aside>

            <section className="eeg-graphs" aria-label="Sensor channel graphs">
              {visibleChannels.map((channel, index) => (
                <SensorChannelGraph
                  channel={channel}
                  color={GRAPH_COLORS[index % GRAPH_COLORS.length]}
                  key={channel}
                  session={selectedSession}
                />
              ))}
            </section>
          </>
        ) : (
          <section className="eeg-empty-state" aria-label="Upload sensor data">
            <LineChart aria-hidden="true" size={42} />
            <h2>Loading sensor data</h2>
            <p>The checked-in CSV and TXT sessions will appear here.</p>
            {uploadError ? <p className="inline-error">{uploadError}</p> : null}
          </section>
        )}
      </section>
    </main>
  );
}

function SensorChannelGraph({
  channel,
  color,
  session,
}: {
  channel: string;
  color: string;
  session: TimeSeriesSession;
}) {
  const graph = useMemo(
    () => buildGraphPath(session, channel),
    [channel, session],
  );

  return (
    <article className="eeg-graph-card">
      <div className="eeg-graph-header">
        <strong>{channel}</strong>
        <span>
          {graph.min.toFixed(2)} to {graph.max.toFixed(2)}
        </span>
      </div>
      <svg
        aria-label={`${channel} sensor graph`}
        className="eeg-graph"
        preserveAspectRatio="none"
        viewBox="0 0 640 180"
      >
        <line className="eeg-grid-line" x1="44" x2="620" y1="90" y2="90" />
        <line className="eeg-grid-line" x1="44" x2="620" y1="28" y2="28" />
        <line className="eeg-grid-line" x1="44" x2="620" y1="152" y2="152" />
        <path d={graph.path} fill="none" stroke={color} strokeWidth="2.5" />
      </svg>
    </article>
  );
}

function buildGraphPath(session: TimeSeriesSession, channel: string) {
  const width = 576;
  const height = 124;
  const left = 44;
  const top = 28;
  const values = session.samples.map((sample) => sample.values[channel]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const firstX = session.samples[0].x;
  const lastX = session.samples[session.samples.length - 1].x;
  const xSpan = lastX === firstX ? 1 : lastX - firstX;
  const ySpan = max === min ? 1 : max - min;

  const path = session.samples
    .map((sample, index) => {
      const value = sample.values[channel];
      const x = left + ((sample.x - firstX) / xSpan) * width;
      const y = top + height - ((value - min) / ySpan) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return { path, min, max };
}

function parserLabel(parser: TimeSeriesSession["source"]["parser"]): string {
  switch (parser) {
    case "knee-brace":
      return "Knee CSV";
    case "generic-channel":
      return "Generic";
  }
}
