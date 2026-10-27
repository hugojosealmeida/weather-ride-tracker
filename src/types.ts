export type Profile = "car" | "bike" | "foot";

export type LngLat = [number, number];

export interface Waypoint {
  id: string;
  lngLat: LngLat;
  name?: string;
}

export interface RouteLeg {
  distance: number;
  duration: number;
}

export interface RouteResult {
  coordinates: LngLat[];
  distance: number;
  duration: number;
  legs: RouteLeg[];
}

export interface RouteSample {
  coordinate: LngLat;
  distance: number;
  fraction: number;
  bearing: number;
}

export interface HourlyForecast {
  time: number;
  temperature: number;
  feelsLike: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  isDay: boolean;
}

export interface SampleForecast {
  sample: RouteSample;
  hourly: HourlyForecast[];
}

export interface SegmentForecast {
  key: string;
  label: string;
  shortLabel: string;
  sample: RouteSample;
  eta: number;
  weather: HourlyForecast;
  score: number;
  windRelation: WindRelation;
}

export type WindRelation =
  | { type: "headwind"; angle: number }
  | { type: "tailwind"; angle: number }
  | { type: "crosswind"; angle: number };

export interface DepartureSlot {
  time: number;
  score: number;
  complete: boolean;
}

export interface DeparturePlan {
  slots: DepartureSlot[];
  best: DepartureSlot | null;
  now: DepartureSlot | null;
  selected: DepartureSlot | null;
}

export interface Place {
  id: string;
  name: string;
  detail: string;
  lngLat: LngLat;
}
