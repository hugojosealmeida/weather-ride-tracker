import { describe, expect, it } from "vitest";
import { bearing, haversine, sampleRoute } from "./geo";
import type { LngLat } from "../types";

describe("haversine", () => {
  it("returns 0 for identical points", () => {
    const point: LngLat = [10, 20];
    expect(haversine(point, point)).toBe(0);
  });

  it("computes a known distance along the equator", () => {
    const a: LngLat = [0, 0];
    const b: LngLat = [1, 0];
    expect(haversine(a, b)).toBeCloseTo(111_194.9, 0);
  });

  it("is symmetric", () => {
    const a: LngLat = [-3, 40];
    const b: LngLat = [2, 42];
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 10);
  });
});

describe("bearing", () => {
  it("points north for a due-north segment", () => {
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("points east for a due-east segment", () => {
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(90, 6);
  });

  it("points south for a due-south segment", () => {
    expect(bearing([0, 0], [0, -1])).toBeCloseTo(180, 6);
  });

  it("returns a value in [0, 360)", () => {
    const result = bearing([-10, 5], [10, -5]);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });
});

describe("sampleRoute", () => {
  it("returns an empty array for empty input", () => {
    expect(sampleRoute([], 10)).toEqual([]);
  });

  it("returns a single sample for a single coordinate", () => {
    const coord: LngLat = [1, 2];
    expect(sampleRoute([coord], 10)).toEqual([
      { coordinate: coord, distance: 0, fraction: 0, bearing: 0 },
    ]);
  });

  it("samples the endpoints at fractions 0 and 1", () => {
    const coords: LngLat[] = [
      [0, 0],
      [1, 0],
    ];
    const samples = sampleRoute(coords, 4);
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples[0].fraction).toBe(0);
    expect(samples[samples.length - 1].fraction).toBeCloseTo(1, 10);
    expect(samples[0].distance).toBe(0);
    expect(samples[samples.length - 1].distance).toBeCloseTo(haversine(coords[0], coords[1]), 6);
  });

  it("clamps the point count to at least 2", () => {
    const coords: LngLat[] = [
      [0, 0],
      [1, 0],
    ];
    expect(sampleRoute(coords, 1).length).toBe(2);
  });
});
