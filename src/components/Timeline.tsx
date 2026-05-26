import { formatElapsedTime } from "./time";

type TimelineProps = {
  durationMs: number;
  elapsedMs: number;
  onChange: (elapsedMs: number) => void;
};

export function Timeline({ durationMs, elapsedMs, onChange }: TimelineProps) {
  return (
    <section className="timeline" aria-label="Playback timeline">
      <span>{formatElapsedTime(elapsedMs)}</span>
      <input
        aria-label="Playback position"
        max={Math.max(1, durationMs)}
        min={0}
        step={1}
        type="range"
        value={Math.min(elapsedMs, durationMs)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span>{formatElapsedTime(durationMs)}</span>
    </section>
  );
}
