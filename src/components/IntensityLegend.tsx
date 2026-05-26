import type { CSSProperties } from "react";
import {
  rgbIntensityForSelectedHeatChannels,
  rgbIntensityToCss,
} from "../domain/heatMap";
import type { HeatMapChannel, HeatMapMetrics } from "../domain/types";

type IntensityLegendProps = {
  selectedHeatChannels: readonly HeatMapChannel[];
};

const INTENSITY_STOPS = [1, 0.75, 0.5, 0.25, 0] as const;

export function IntensityLegend({
  selectedHeatChannels,
}: IntensityLegendProps) {
  const gradientStops = INTENSITY_STOPS.map((intensity) => {
    const color = rgbIntensityToCss(
      rgbIntensityForSelectedHeatChannels(
        metricsAtIntensity(intensity),
        selectedHeatChannels,
      ),
    );
    const position = Math.round((1 - intensity) * 100);

    return `${color} ${position}%`;
  });
  const style = {
    "--intensity-gradient": `linear-gradient(to bottom, ${gradientStops.join(", ")})`,
  } as CSSProperties;

  return (
    <aside aria-label="Intensity legend" className="intensity-legend">
      <p className="eyebrow">Intensity</p>
      <div className="intensity-legend-body">
        <div aria-hidden="true" className="intensity-track" style={style} />
        <div className="intensity-ticks">
          <span>High</span>
          <span>50%</span>
          <span>Low</span>
        </div>
      </div>
    </aside>
  );
}

function metricsAtIntensity(intensity: number): HeatMapMetrics {
  return {
    temperature: intensity,
    emg: intensity,
    imu: intensity,
  };
}
