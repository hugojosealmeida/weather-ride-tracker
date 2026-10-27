import type {
  DeparturePlan,
  DepartureSlot,
  HourlyForecast,
  RouteSample,
  SampleForecast,
  WindRelation,
} from "../types";
import { bearingDelta } from "./geo";
import { startOfHour } from "./format";
import { weatherInfo } from "./weatherCodes";

/**
 * Open-Meteo forecast API. No API key is required for non-commercial use;
 * check https://open-meteo.com/en/terms before shipping a paid app.
 */
const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

const HOURLY_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "is_day",
] as const;

interface RawHourly {
  time?: string[];
  temperature_2m: Array<number | null>;
  apparent_temperature: Array<number | null>;
  precipitation_probability: Array<number | null>;
  precipitation: Array<number | null>;
  weather_code: Array<number | null>;
  wind_speed_10m: Array<number | null>;
  wind_gusts_10m: Array<number | null>;
  wind_direction_10m: Array<number | null>;
  is_day: Array<number | null>;
}

interface RawForecast {
  latitude: number;
  longitude: number;
  hourly?: RawHourly;
}

function parseHour(time: string): number {
  return Date.parse(`${time}:00Z`);
}

export function normalizeHourly(raw: unknown): HourlyForecast[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Open-Meteo returned an incomplete forecast.");
  }

  const candidate = raw as Partial<RawHourly>;
  if (!Array.isArray(candidate.time)) {
    throw new Error("Open-Meteo returned an incomplete forecast.");
  }

  const rawHourly = candidate as RawHourly & { time: string[] };
  const hourly: HourlyForecast[] = [];

  for (let index = 0; index < rawHourly.time.length; index += 1) {
    const temperature = rawHourly.temperature_2m?.[index];
    if (temperature === null || temperature === undefined) continue;

    const time = parseHour(rawHourly.time[index]);
    if (!Number.isFinite(time)) continue;

    hourly.push({
      time,
      temperature,
      feelsLike: rawHourly.apparent_temperature?.[index] ?? temperature,
      precipitationProbability: rawHourly.precipitation_probability?.[index] ?? 0,
      precipitation: rawHourly.precipitation?.[index] ?? 0,
      weatherCode: rawHourly.weather_code?.[index] ?? 3,
      windSpeed: rawHourly.wind_speed_10m?.[index] ?? 0,
      windGust: rawHourly.wind_gusts_10m?.[index] ?? 0,
      windDirection: rawHourly.wind_direction_10m?.[index] ?? 0,
      isDay: (rawHourly.is_day?.[index] ?? 1) === 1,
    });
  }

  return hourly;
}

export async function fetchForecasts(
  samples: RouteSample[],
  signal?: AbortSignal,
): Promise<SampleForecast[]> {
  if (samples.length === 0) return [];

  const url = new URL(FORECAST_API);
  url.searchParams.set("latitude", samples.map((point) => point.coordinate[1].toFixed(4)).join(","));
  url.searchParams.set("longitude", samples.map((point) => point.coordinate[0].toFixed(4)).join(","));
  url.searchParams.set("hourly", HOURLY_VARIABLES.join(","));
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("precipitation_unit", "mm");
  url.searchParams.set("cell_selection", "nearest");

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Couldn't load the forecast. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Open-Meteo is rate-limiting requests. Try again in a minute."
        : `Forecast request failed (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json()) as RawForecast | RawForecast[];
  const results = Array.isArray(payload) ? payload : [payload];

  if (results.length < samples.length) {
    throw new Error("Open-Meteo returned an incomplete forecast.");
  }

  return samples.map((sample, index) => {
    const forecast = results[index];
    if (!forecast || !Array.isArray(forecast.hourly?.time)) {
      throw new Error("Open-Meteo returned an incomplete forecast.");
    }
    return {
      sample,
      hourly: normalizeHourly(forecast.hourly),
    };
  });
}

function nearestHour(hourly: HourlyForecast[], timestamp: number): HourlyForecast | null {
  if (hourly.length === 0) return null;

  let nearest = hourly[0];
  let smallest = Math.abs(nearest.time - timestamp);
  for (const hour of hourly) {
    const delta = Math.abs(hour.time - timestamp);
    if (delta < smallest) {
      nearest = hour;
      smallest = delta;
    }
  }

  // An hour of slack: forecasts are hourly, ETAs are not.
  return smallest <= 3_600_000 ? nearest : null;
}

export function forecastAt(hourly: HourlyForecast[], timestamp: number): HourlyForecast | null {
  return nearestHour(hourly, timestamp);
}

/**
 * Turns an hour of weather into a 0–100 comfort score. Higher is better:
 * 100 is dry, calm and mild, 0 is a washout. Weighted for people spending
 * hours outside: rain first, then wind, then unpleasant temperatures.
 */
export function scoreHour(hour: HourlyForecast): number {
  const info = weatherInfo(hour.weatherCode);
  let risk = 0;

  risk += hour.precipitationProbability * 0.45;
  risk += Math.min(hour.precipitation, 8) * 6;
  risk += info.severity * 0.7;

  if (hour.windGust > 30) risk += (hour.windGust - 30) * 1.4;
  else if (hour.windGust > 20) risk += (hour.windGust - 20) * 0.6;
  if (hour.windSpeed > 22) risk += (hour.windSpeed - 22) * 0.8;

  if (hour.feelsLike < 6) risk += (6 - hour.feelsLike) * 3;
  if (hour.feelsLike > 28) risk += (hour.feelsLike - 28) * 3;

  return Math.round(Math.max(0, Math.min(100, 100 - risk)));
}

export interface ConditionSummary {
  label: string;
  detail: string;
  tone: "good" | "ok" | "warn" | "bad";
}

export function summarizeScore(score: number): ConditionSummary {
  if (score >= 85) {
    return { label: "Clear window", detail: "Dry, calm and comfortable.", tone: "good" };
  }
  if (score >= 68) {
    return { label: "Good to go", detail: "A few clouds, nothing that should slow you down.", tone: "good" };
  }
  if (score >= 50) {
    return { label: "Watch the sky", detail: "Changeable — pack a layer and keep an eye out.", tone: "ok" };
  }
  if (score >= 30) {
    return { label: "Rain likely", detail: "Waterproofs recommended for at least part of the route.", tone: "warn" };
  }
  return { label: "Rough out there", detail: "Heavy rain or strong wind is likely. Consider another time.", tone: "bad" };
}

export function scoreColor(score: number): string {
  if (score >= 85) return "#34d399";
  if (score >= 68) return "#a3e635";
  if (score >= 50) return "#fbbf24";
  if (score >= 30) return "#fb923c";
  return "#f43f5e";
}

export function windRelation(windFrom: number, travelBearing: number): WindRelation {
  const delta = bearingDelta(windFrom, travelBearing);
  const absolute = Math.abs(delta);
  if (absolute <= 45) return { type: "headwind", angle: delta };
  if (absolute >= 135) return { type: "tailwind", angle: delta };
  return { type: "crosswind", angle: delta };
}

function scoreDeparture(
  forecasts: SampleForecast[],
  timestamp: number,
  durationSeconds: number,
): number | null {
  if (forecasts.length === 0) return null;

  let total = 0;
  let count = 0;

  for (const forecast of forecasts) {
    const eta = timestamp + forecast.sample.fraction * durationSeconds * 1000;
    const hour = nearestHour(forecast.hourly, eta);
    if (!hour) continue;
    total += scoreHour(hour);
    count += 1;
  }

  return count === 0 ? null : Math.round(total / count);
}

export function buildDeparturePlan(
  forecasts: SampleForecast[],
  durationSeconds: number,
  now: number,
  horizonHours = 24,
  selectedTime = now,
): DeparturePlan {
  const base = startOfHour(now);
  // Start the grid on a whole hour that is not in the past: keep the current
  // hour only when `now` is exactly on the hour, otherwise advance to the
  // next whole hour so no offered slot has already passed.
  const start = base < now ? base + 3_600_000 : base;
  const slots: DepartureSlot[] = [];

  for (let index = 0; index < horizonHours; index += 1) {
    const time = start + index * 3_600_000;
    const score = scoreDeparture(forecasts, time, durationSeconds);
    slots.push({ time, score: score ?? Number.NaN, complete: score !== null });
  }

  const usable = slots.filter((slot) => Number.isFinite(slot.score));
  let best: DepartureSlot | null = null;
  for (const slot of usable) {
    if (!best || slot.score > best.score) best = slot;
  }

  const nowScore = scoreDeparture(forecasts, now, durationSeconds);
  const nowSlot: DepartureSlot | null =
    nowScore === null ? null : { time: now, score: nowScore, complete: true };

  const selectedScore = scoreDeparture(forecasts, selectedTime, durationSeconds);
  const selected: DepartureSlot | null =
    selectedScore === null
      ? null
      : { time: selectedTime, score: selectedScore, complete: true };

  return { slots, best, now: nowSlot, selected };
}
