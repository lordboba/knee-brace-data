import { describe, expect, it } from "vitest";
import dataTxt from "../../data.txt?raw";
import sessionCsv from "../../2026-03-04_knee_session1.csv?raw";
import { CSV_COLUMNS, parseSensorCsv } from "./sensorParser";

describe("parseSensorCsv", () => {
  it("parses headerless rows using the documented sensor schema", () => {
    const session = parseSensorCsv(
      [
        "100,1,2,3,4,5,6,7,8,9,10,11,12,13,21.5",
        "120,2,3,4,5,6,7,8,9,10,11,12,13,14,21.6"
      ].join("\n"),
      { id: "headerless", name: "Headerless sample" }
    );

    expect(session.frames).toHaveLength(2);
    expect(session.durationMs).toBe(20);
    expect(session.warnings).toEqual([]);
    expect(session.frames[0]).toMatchObject({
      tMs: 100,
      imu1: {
        acc: { x: 1, y: 2, z: 3 },
        gyr: { x: 4, y: 5, z: 6 }
      },
      imu2: {
        acc: { x: 7, y: 8, z: 9 },
        gyr: { x: 10, y: 11, z: 12 }
      },
      emgEnv: 13,
      tempC: 21.5
    });
  });

  it("parses headered rows with the PDF column names", () => {
    const session = parseSensorCsv(
      [
        CSV_COLUMNS.join(","),
        "200,10,20,30,40,50,60,70,80,90,100,110,120,130,31.7"
      ].join("\n"),
      { id: "headered", name: "Headered sample" }
    );

    expect(session.frames).toHaveLength(1);
    expect(session.source.hasHeader).toBe(true);
    expect(session.frames[0].imu2.gyr.z).toBe(120);
    expect(session.frames[0].emgEnv).toBe(130);
    expect(session.frames[0].tempC).toBe(31.7);
  });

  it("reports malformed rows with line numbers and keeps valid rows", () => {
    const session = parseSensorCsv(
      [
        "16.211,-0.649,-0.687,-0.183,43,31.67",
        "418841,-986.328,113.770,-58.105,0.786,-1.832,0.802,-76.172,-1009.277,-125.000,-0.664,-0.443,0.221,43,31.67"
      ].join("\n"),
      { id: "malformed", name: "Malformed first row" }
    );

    expect(session.frames).toHaveLength(1);
    expect(session.warnings).toHaveLength(1);
    expect(session.warnings[0]).toMatchObject({
      lineNumber: 1,
      reason: "Expected 15 columns but found 6"
    });
  });

  it("loads the checked-in sample files while warning about their partial first rows", () => {
    const dataSession = parseSensorCsv(dataTxt, { id: "data", name: "data.txt" });
    const csvSession = parseSensorCsv(sessionCsv, {
      id: "session1",
      name: "2026-03-04_knee_session1.csv"
    });

    expect(dataSession.frames.length).toBeGreaterThan(2000);
    expect(csvSession.frames.length).toBeGreaterThan(2600);
    expect(dataSession.warnings[0]).toMatchObject({ lineNumber: 1 });
    expect(csvSession.warnings[0]).toMatchObject({ lineNumber: 1 });
  });
});
