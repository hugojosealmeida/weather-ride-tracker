import type { LngLat, RouteSample } from "../types";

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function haversine(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a: LngLat, b: LngLat): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLon = toRad(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function cumulativeDistances(coordinates: LngLat[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversine(coordinates[i - 1], coordinates[i]));
  }
  return cumulative;
}

function coordinateAtDistance(
  coordinates: LngLat[],
  cumulative: number[],
  distance: number,
): LngLat {
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return coordinates[0];

  const target = Math.max(0, Math.min(distance, total));
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (cumulative[mid] <= target) low = mid;
    else high = mid;
  }

  const segmentLength = cumulative[high] - cumulative[low];
  const t = segmentLength === 0 ? 0 : (target - cumulative[low]) / segmentLength;
  const from = coordinates[low];
  const to = coordinates[high];
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

/**
 * Picks evenly spaced points along a route and reports their distance,
 * fraction of the total and travel bearing.
 */
export function sampleRoute(coordinates: LngLat[], count: number): RouteSample[] {
  if (coordinates.length === 0) return [];
  if (coordinates.length === 1) {
    return [{ coordinate: coordinates[0], distance: 0, fraction: 0, bearing: 0 }];
  }

  const cumulative = cumulativeDistances(coordinates);
  const total = cumulative[cumulative.length - 1];
  const points = Math.max(2, Math.min(count, coordinates.length * 4));

  return Array.from({ length: points }, (_, index) => {
    const fraction = index / (points - 1);
    const distance = total * fraction;
    const coordinate = coordinateAtDistance(coordinates, cumulative, distance);
    const lookAhead = coordinateAtDistance(coordinates, cumulative, distance + 120);
    const next =
      haversine(coordinate, lookAhead) > 1 ? lookAhead : coordinates[coordinates.length - 1];
    return {
      coordinate,
      distance,
      fraction,
      bearing: bearing(coordinate, next),
    };
  });
}

export function routeBounds(coordinates: LngLat[]): [LngLat, LngLat] | null {
  if (coordinates.length === 0) return null;
  let west = coordinates[0][0];
  let east = coordinates[0][0];
  let south = coordinates[0][1];
  let north = coordinates[0][1];
  for (const [lng, lat] of coordinates) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/** Smallest signed difference between two bearings, in degrees. */
export function bearingDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}
