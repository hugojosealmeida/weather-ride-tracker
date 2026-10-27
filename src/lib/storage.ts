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

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const obj = parsed as Partial<PersistedWorkspace>;
    const waypoints = Array.isArray(obj.waypoints)
      ? obj.waypoints
          .filter((point): point is Waypoint => {
            if (!point || typeof point !== "object" || Array.isArray(point)) {
              return false;
            }
            const candidate = point as {
              id?: unknown;
              lngLat?: unknown;
              name?: unknown;
            };
            if (typeof candidate.id !== "string") return false;
            if (!isLngLat(candidate.lngLat)) return false;
            if (candidate.name !== undefined && typeof candidate.name !== "string") {
              return false;
            }
            return true;
          })
          .slice(0, 12)
      : [];

    const profile = PROFILES.includes(obj.profile as Profile)
      ? (obj.profile as Profile)
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
