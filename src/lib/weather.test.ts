import { describe, expect, it } from "vitest";
import type { HourlyForecast } from "../types";
import { scoreHour, windRelation } from "./weather";

function makeHour(overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time: 0,
    temperature: 20,
    feelsLike: 20,
    precipitationProbability: 0,
    precipitation: 0,
    weatherCode: 0,
    windSpeed: 0,
    windGust: 0,
    windDirection: 0,
    isDay: true,
    ...overrides,
  };
}

describe("scoreHour", () => {
  it("returns 100 for ideal conditions", () => {
    expect(scoreHour(makeHour())).toBe(100);
  });

  it("decreases with rain probability", () => {
    const dry = scoreHour(makeHour({ precipitationProbability: 0 }));
    const wet = scoreHour(makeHour({ precipitationProbability: 100 }));
    expect(wet).toBeLessThan(dry);
  });

  it("is bounded between 0 and 100", () => {
    const extreme = scoreHour(
      makeHour({
        precipitationProbability: 100,
        precipitation: 8,
        weatherCode: 99,
        windGust: 80,
        windSpeed: 60,
        feelsLike: -10,
      }),
    );
    expect(extreme).toBeGreaterThanOrEqual(0);
    expect(extreme).toBeLessThanOrEqual(100);
    expect(extreme).toBe(0);
  });

  it("penalises strong gusts and heat", () => {
    const base = scoreHour(makeHour());
    const gusty = scoreHour(makeHour({ windGust: 40 }));
    const hot = scoreHour(makeHour({ feelsLike: 35 }));
    expect(gusty).toBeLessThan(base);
    expect(hot).toBeLessThan(base);
  });
});

describe("windRelation", () => {
  it("classifies a headwind when wind comes from the travel direction", () => {
    const result = windRelation(90, 90);
    expect(result.type).toBe("headwind");
    expect(result.angle).toBe(0);
  });

  it("classifies a tailwind when wind comes from behind", () => {
    const result = windRelation(270, 90);
    expect(result.type).toBe("tailwind");
    expect(result.angle).toBe(-180);
  });

  it("classifies a crosswind at 90 degrees", () => {
    const result = windRelation(180, 90);
    expect(result.type).toBe("crosswind");
  });

  it("keeps the signed angle", () => {
    const result = windRelation(45, 90);
    expect(result.angle).toBe(-45);
  });
});
