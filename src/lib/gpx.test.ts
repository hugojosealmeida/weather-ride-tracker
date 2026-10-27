import { describe, expect, it } from "vitest";
import type { RouteResult, Waypoint } from "../types";
import { buildGpx, gpxFileName } from "./gpx";

const route: RouteResult = {
  coordinates: [
    [0, 0],
    [1, 1],
  ],
  distance: 1000,
  duration: 600,
  legs: [],
};

const waypoints: Waypoint[] = [
  { id: "a", lngLat: [0, 0], name: "Start" },
  { id: "b", lngLat: [1, 1] },
];

describe("buildGpx", () => {
  it("includes the gpx declaration and metadata", () => {
    const xml = buildGpx(route, waypoints);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<gpx");
    expect(xml).toContain("<metadata>");
  });

  it("emits a trkpt for each coordinate", () => {
    const xml = buildGpx(route, waypoints);
    const matches = xml.match(/<trkpt /g) ?? [];
    expect(matches.length).toBe(route.coordinates.length);
  });

  it("emits a wpt for each waypoint with escaped names", () => {
    const xml = buildGpx(route, [
      { id: "x", lngLat: [0, 0], name: "A & B <stop>" },
    ]);
    expect(xml).toContain("<wpt");
    expect(xml).toContain("A &amp; B &lt;stop&gt;");
  });

  it("uses a default name for unnamed waypoints", () => {
    const xml = buildGpx(route, [{ id: "x", lngLat: [0, 0] }]);
    expect(xml).toContain("<name>Stop</name>");
  });

  it("handles an empty coordinate list", () => {
    const emptyRoute: RouteResult = { ...route, coordinates: [] };
    const xml = buildGpx(emptyRoute, []);
    expect(xml).toContain("<trkseg>");
    expect(xml).not.toContain("<trkpt");
  });

  it("honours a custom name", () => {
    const xml = buildGpx(route, [], "My Ride");
    expect(xml).toContain("<name>My Ride</name>");
  });
});

describe("gpxFileName", () => {
  it("formats a date into a ridecast filename", () => {
    const name = gpxFileName(new Date("2024-03-05T07:09:00"));
    expect(name).toBe("ridecast-2024-03-05-0709.gpx");
  });
});
