import type { Profile, Waypoint } from "../types";

const STORAGE_KEY = "ridecast:workspace:v1";

interface PersistedWorkspace {
  waypoints: Waypoint[];
  profile: Profile;
}

const PROFILES: Profile[] = ["car", "bike", "foot"];

function isLngLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry)) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}

export function loadWorkspace(): PersistedWorkspace | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedWorkspace>;
    const waypoints = Array.isArray(parsed.waypoints)
      ? parsed.waypoints
          .filter(
            (point): point is Waypoint =>
              !!point &&
              typeof point === "object" &&
              typeof point.id === "string" &&
              isLngLat(point.lngLat),
          )
          .slice(0, 12)
      : [];

    const profile = PROFILES.includes(parsed.profile as Profile)
      ? (parsed.profile as Profile)
      : "bike";

    return { waypoints, profile };
  } catch {
    return null;
  }
}

export function saveWorkspace(workspace: PersistedWorkspace): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works.
  }
}
