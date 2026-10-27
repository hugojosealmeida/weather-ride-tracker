import type { Place } from "../types";

/**
 * Nominatim (OpenStreetMap) place search. It is a shared, rate-limited
 * service: keep queries debounced and cache results. For a distributed app,
 * use a paid geocoder or host your own.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const SEARCH_API = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

const cache = new Map<string, Place[]>();

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const key = trimmed.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const url = new URL(SEARCH_API);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Place search is unavailable right now.");
  }

  const results = (await response.json()) as NominatimResult[];
  const places = results
    .map((result) => {
      const lat = Number(result.lat);
      const lng = Number(result.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const primary =
        result.name ||
        result.address?.city ||
        result.address?.town ||
        result.address?.village ||
        result.display_name.split(",")[0];

      const detail = result.display_name.replace(`${primary}, `, "");

      return {
        id: String(result.place_id),
        name: primary,
        detail,
        lngLat: [lng, lat] as [number, number],
      } satisfies Place;
    })
    .filter((place): place is Place => place !== null);

  cache.set(key, places);
  return places;
}
