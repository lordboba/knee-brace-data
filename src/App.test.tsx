import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/SensorScene", () => ({
  SensorScene: ({
    biomechanicsSample,
    children,
    selectedHeatChannels,
  }: {
    biomechanicsSample?: { kneeFlexionDeg: number; warnings: readonly string[] };
    children?: ReactNode;
    selectedHeatChannels?: readonly string[];
  }) => (
    <div
      data-biomechanics-warnings={biomechanicsSample?.warnings.join(",") ?? "missing"}
      data-knee-flexion={biomechanicsSample?.kneeFlexionDeg.toFixed(1) ?? "missing"}
      data-selected-heat-channels={selectedHeatChannels?.join(",") ?? "missing"}
      data-testid="sensor-canvas"
    >
      {children}
    </div>
  ),
}));

describe("App", () => {
  it("renders the immersive simulator shell with recorded sample warnings", async () => {
    render(<App />);

    expect(screen.getByText("Knee Brace Sensor Simulator")).toBeInTheDocument();
    expect(await screen.findByTestId("sensor-canvas")).toBeInTheDocument();
    expect(screen.getByText("Skin temp")).toBeInTheDocument();
    expect(screen.getByText("EMG pulse")).toBeInTheDocument();
    expect(screen.getByText("IMU axes")).toBeInTheDocument();
    expect(screen.getByLabelText("Intensity legend")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(await screen.findByText(/parser warnings/i)).toBeInTheDocument();
  });

  it("switches between recorded playback and synthetic simulation", async () => {
    render(<App />);
    await screen.findByTestId("sensor-canvas");
    await waitFor(() => {
      expect(
        screen.getAllByText("2026-03-04 knee session 1").length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /synthetic/i }));

    expect(screen.getByText("Synthetic 50 Hz gait")).toBeInTheDocument();
    expect(screen.getByText(/deterministic demo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /recorded/i }));

    expect(
      screen.getAllByText("2026-03-04 knee session 1").length,
    ).toBeGreaterThan(0);
  });

  it("collapses and expands the source controls without hiding the active source", async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        screen.getAllByText("2026-03-04 knee session 1").length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getByRole("button", { name: /collapse source panel/i }),
    );

    expect(screen.getByText("2026-03-04 knee session 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /synthetic/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Session")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /expand source panel/i }),
    );

    expect(
      screen.getByRole("button", { name: /synthetic/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Session")).toBeInTheDocument();
  });

  it("selects multiple heat map channels with checkboxes", async () => {
    render(<App />);
    const canvas = await screen.findByTestId("sensor-canvas");
    const temperature = screen.getByRole("checkbox", { name: /temperature/i });
    const emg = screen.getByRole("checkbox", { name: /emg/i });
    const imu = screen.getByRole("checkbox", { name: /imu/i });

    expect(canvas).toHaveAttribute(
      "data-selected-heat-channels",
      "temperature,emg,imu",
    );
    expect(temperature).toBeChecked();
    expect(emg).toBeChecked();
    expect(imu).toBeChecked();

    fireEvent.click(temperature);

    expect(canvas).toHaveAttribute("data-selected-heat-channels", "emg,imu");
    expect(temperature).not.toBeChecked();
    expect(emg).toBeChecked();
    expect(imu).toBeChecked();

    fireEvent.click(emg);

    expect(canvas).toHaveAttribute("data-selected-heat-channels", "imu");
    expect(temperature).not.toBeChecked();
    expect(emg).not.toBeChecked();
    expect(imu).toBeChecked();

    fireEvent.click(temperature);

    expect(canvas).toHaveAttribute(
      "data-selected-heat-channels",
      "temperature,imu",
    );
    expect(temperature).toBeChecked();
    expect(emg).not.toBeChecked();
    expect(imu).toBeChecked();
  });

  it("wires biomechanical calibration data into the controls and 3D scene", async () => {
    render(<App />);

    const canvas = await screen.findByTestId("sensor-canvas");

    expect(canvas).not.toHaveAttribute("data-knee-flexion", "missing");
    expect(canvas).toHaveAttribute(
      "data-biomechanics-warnings",
      expect.stringContaining("yaw-drift-unobservable"),
    );
    expect(screen.getByText("Biomechanics calibration")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /set neutral pose to current frame/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/yaw drift/i)).toBeInTheDocument();
  });

  it("opens the 2D data page with preloaded checked-in sensor graphs", async () => {
    render(<App />);
    await screen.findByTestId("sensor-canvas");
    await waitFor(() => {
      expect(
        screen.getAllByText("2026-03-04 knee session 1").length,
      ).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /2d data/i }));

    expect(screen.getByText("Sensor Data Graphs")).toBeInTheDocument();
    expect(
      screen.getAllByText("2026-03-04 knee session 1").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("IMU 1 acc X")).toBeInTheDocument();
    expect(screen.getByText(/cleaned row/i)).toBeInTheDocument();
  });

  it("keeps generic channel uploads available on the 2D data page", async () => {
    render(<App />);
    await screen.findByTestId("sensor-canvas");

    fireEvent.click(screen.getByRole("button", { name: /2d data/i }));

    const upload = screen
      .getByText("Upload")
      .closest("label")
      ?.querySelector("input");
    const file = new File(["time_ms,Fp1,Fp2\n0,10,11\n4,12,9"], "eeg.csv", {
      type: "text/csv",
    });

    expect(upload).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(upload!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getAllByText("eeg.csv").length).toBeGreaterThan(0);
    });
    expect(screen.getByLabelText("Fp1 sensor graph")).toBeInTheDocument();
    expect(screen.getByLabelText("Fp2 sensor graph")).toBeInTheDocument();
  });
});
