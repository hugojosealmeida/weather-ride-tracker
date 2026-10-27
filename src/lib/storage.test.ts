import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Waypoint } from "../types";
import { loadWorkspace, saveWorkspace } from "./storage";

const STORAGE_KEY = "ridecast:workspace:v1";

describe("loadWorkspace", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    };
    vi.stubGlobal("window", { localStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is stored", () => {
    expect(loadWorkspace()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadWorkspace()).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(42));
    expect(loadWorkspace()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2]));
    expect(loadWorkspace()).toBeNull();
  });

  it("loads a valid workspace", () => {
    const waypoints: Waypoint[] = [{ id: "1", lngLat: [1, 2], name: "Home" }];
    saveWorkspace({ waypoints, profile: "car" });
    expect(loadWorkspace()).toEqual({ waypoints, profile: "car" });
  });

  it("defaults profile to bike for unknown profiles", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ waypoints: [], profile: "rocket" }),
    );
    expect(loadWorkspace()).toEqual({ waypoints: [], profile: "bike" });
  });

  it("filters out invalid waypoints", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        waypoints: [
          { id: "ok", lngLat: [1, 2] },
          { id: 5, lngLat: [1, 2] },
          { id: "bad", lngLat: [999, 2] },
          { id: "name", lngLat: [1, 2], name: 42 },
          null,
        ],
        profile: "foot",
      }),
    );
    const result = loadWorkspace();
    expect(result?.waypoints).toEqual([{ id: "ok", lngLat: [1, 2] }]);
    expect(result?.profile).toBe("foot");
  });

  it("caps waypoints at 12", () => {
    const waypoints: Waypoint[] = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      lngLat: [0, 0],
    }));
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ waypoints, profile: "bike" }),
    );
    expect(loadWorkspace()?.waypoints).toHaveLength(12);
  });

  it("tolerates missing waypoints array", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile: "car" }));
    expect(loadWorkspace()).toEqual({ waypoints: [], profile: "car" });
  });

  it("returns null when localStorage throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("boom");
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
    vi.stubGlobal("window", { localStorage: throwing });
    expect(loadWorkspace()).toBeNull();
  });
});
