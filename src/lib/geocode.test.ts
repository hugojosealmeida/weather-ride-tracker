import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveDetail } from "./geocode";

describe("deriveDetail", () => {
  it("strips primary when it is the exact leading token", () => {
    expect(deriveDetail("Paris, Île-de-France, France", "Paris")).toBe("Île-de-France, France");
  });

  it("falls back to full display name when primary is not a prefix", () => {
    const detail = deriveDetail("London, United Kingdom", "Paris");
    expect(detail).toBe("London, United Kingdom");
    expect(detail.startsWith("Paris")).toBe(false);
  });

  it("handles display_name shorter than primary without crashing", () => {
    expect(() => deriveDetail("Hi", "Paris")).not.toThrow();
    const detail = deriveDetail("Hi", "Paris");
    expect(detail.startsWith("Paris")).toBe(false);
  });

  it("never starts with the same text as name for equal strings", () => {
    const detail = deriveDetail("Paris", "Paris");
    expect(detail.startsWith("Paris")).toBe(false);
  });

  it("is case-insensitive for leading token", () => {
    expect(deriveDetail("paris, France", "Paris")).toBe("France");
  });
});

describe("searchPlaces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("maps results and derives detail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 1,
          display_name: "Paris, Île-de-France, France",
          name: "Paris",
          lat: "48.8566",
          lon: "2.3522",
        },
        {
          place_id: 2,
          display_name: "London, United Kingdom",
          name: "London",
          lat: "51.5074",
          lon: "-0.1278",
          address: { city: "London" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchPlaces } = await import("./geocode");
    const places = await searchPlaces("paris-z");
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ name: "Paris", detail: "Île-de-France, France" });
    expect(places[1]).toMatchObject({ name: "London", detail: "United Kingdom" });
    for (const p of places) {
      expect(p.detail.startsWith(p.name)).toBe(false);
    }
  });

  it("handles primary differing from leading token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 3,
          display_name: "City of London, United Kingdom",
          address: { city: "London" },
          lat: "51.5074",
          lon: "-0.1278",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchPlaces } = await import("./geocode");
    const places = await searchPlaces("london-city-z");
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe("London");
    expect(places[0].detail.startsWith("London")).toBe(false);
  });

  it("does not crash when display_name is shorter than primary", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 4,
          display_name: "Hi",
          name: "Paris",
          lat: "0",
          lon: "0",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchPlaces } = await import("./geocode");
    const places = await searchPlaces("hi-z");
    expect(places).toHaveLength(1);
    expect(places[0].detail.startsWith("Paris")).toBe(false);
  });
});
