import type { LngLat, Profile, RouteResult } from "../types";

/**
 * Keyless demo routers hosted by FOSSGIS for OpenStreetMap Germany.
 * They are fine for development and personal use, but have no uptime or
 * rate-limit guarantee. Point these at your own OSRM/GraphHopper instance
 * (or add an API-key based provider) before distributing the app.
 * https://routing.openstreetmap.de/about.html
 */
const ROUTERS: Record<Profile, string> = {
  car: "https://routing.openstreetmap.de/routed-car",
  bike: "https://routing.openstreetmap.de/routed-bike",
  foot: "https://routing.openstreetmap.de/routed-foot",
};

export const PROFILE_META: Record<Profile, { label: string; hint: string }> = {
  car: { label: "Drive", hint: "Fastest roads" },
  bike: { label: "Bike", hint: "Cycle-friendly roads" },
  foot: { label: "Walk", hint: "Walking paths" },
};

interface OsrmResponse {
  code: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: LngLat[] };
    legs: Array<{ distance: number; duration: number }>;
  }>;
}

export async function fetchRoute(
  waypoints: LngLat[],
  profile: Profile,
  signal?: AbortSignal,
): Promise<RouteResult> {
  if (waypoints.length < 2) {
    throw new Error("Add at least two stops to plan a route.");
  }

  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = new URL(
    `${ROUTERS[profile]}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
  );

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Couldn't reach the routing service. Check your connection.");
  }

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "The routing service is rate-limiting requests. Try again in a moment."
        : `Routing failed (HTTP ${response.status}). Try again in a moment.`,
    );
  }

  const data = (await response.json()) as OsrmResponse;
  const route = data.routes?.[0];

  if (data.code !== "Ok" || !route) {
    throw new Error(
      data.code === "NoRoute"
        ? "No route found between these stops. Try moving a point closer to a road."
        : data.message || "No route found between these stops.",
    );
  }

  if (route.geometry.coordinates.length < 2) {
    throw new Error("The routing service returned an empty route.");
  }

  return {
    coordinates: route.geometry.coordinates,
    distance: route.distance,
    duration: route.duration,
    legs: route.legs.map((leg) => ({ distance: leg.distance, duration: leg.duration })),
  };
}
