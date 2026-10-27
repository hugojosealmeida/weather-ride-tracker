import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeparturePlan,
  LngLat,
  Profile,
  RouteResult,
  SampleForecast,
  SegmentForecast,
  Waypoint,
} from "../types";
import { fetchRoute } from "../lib/routing";
import {
  buildDeparturePlan,
  fetchForecasts,
  forecastAt,
  scoreHour,
  summarizeScore,
  windRelation,
} from "../lib/weather";
import { sampleRoute } from "../lib/geo";
import { loadWorkspace, saveWorkspace } from "../lib/storage";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface AsyncState {
  status: LoadStatus;
  error?: string;
}

const MAX_WAYPOINTS = 12;

function createWaypoint(lngLat: LngLat, name?: string): Waypoint {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `wp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    lngLat,
    name,
  };
}

function sampleCount(distance: number): number {
  return Math.min(8, Math.max(3, Math.round(distance / 15_000) + 3));
}

function segmentLabel(fraction: number, index: number, count: number): { label: string; short: string } {
  if (index === 0) return { label: "Start", short: "Start" };
  if (index === count - 1) return { label: "Finish", short: "Finish" };

  const percent = Math.round(fraction * 100);
  if (percent === 50) return { label: "Halfway", short: "50%" };
  if (percent === 25) return { label: "Quarter way", short: "25%" };
  if (percent === 75) return { label: "Three-quarter way", short: "75%" };
  return { label: `${percent}% along`, short: `${percent}%` };
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

export function useRidePlanner() {
  const initial = useMemo(() => loadWorkspace(), []);
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initial?.waypoints ?? []);
  const [profile, setProfile] = useState<Profile>(initial?.profile ?? "bike");

  const now = useNow(60_000);
  const [departureMode, setDepartureMode] = useState<"now" | "custom">("now");
  const [customDeparture, setCustomDeparture] = useState(() => Date.now());

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeState, setRouteState] = useState<AsyncState>({ status: "idle" });
  const [forecasts, setForecasts] = useState<SampleForecast[] | null>(null);
  const [weatherState, setWeatherState] = useState<AsyncState>({ status: "idle" });

  const [routeRetry, setRouteRetry] = useState(0);
  const [weatherRetry, setWeatherRetry] = useState(0);

  const departAt = departureMode === "now" ? now : customDeparture;

  const setDeparture = useCallback(
    (timestamp: number) => {
      if (Math.abs(timestamp - Date.now()) < 60_000) {
        setDepartureMode("now");
      } else {
        setCustomDeparture(timestamp);
        setDepartureMode("custom");
      }
    },
    [],
  );

  const useCurrentDeparture = useCallback(() => {
    setDepartureMode("now");
  }, []);

  useEffect(() => {
    saveWorkspace({ waypoints, profile });
  }, [waypoints, profile]);

  // Route: debounce small edits (e.g. dragging a marker) into one request.
  useEffect(() => {
    if (waypoints.length < 2) {
      setRoute(null);
      setRouteState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setRouteState({ status: "loading" });
    const timer = window.setTimeout(() => {
      fetchRoute(
        waypoints.map((waypoint) => waypoint.lngLat),
        profile,
        controller.signal,
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          setRoute(result);
          setRouteState({ status: "ready" });
        })
        .catch((error: Error) => {
          if (controller.signal.aborted) return;
          setRoute(null);
          setRouteState({ status: "error", error: error.message });
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [waypoints, profile, routeRetry]);

  // Forecasts for a handful of points spread along the route.
  useEffect(() => {
    if (!route) {
      setForecasts(null);
      setWeatherState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setWeatherState({ status: "loading" });
    const samples = sampleRoute(route.coordinates, sampleCount(route.distance));

    fetchForecasts(samples, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setForecasts(result);
        setWeatherState({ status: "ready" });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setForecasts(null);
        setWeatherState({ status: "error", error: error.message });
      });

    return () => controller.abort();
  }, [route, weatherRetry]);

  const segments = useMemo<SegmentForecast[]>(() => {
    if (!route || !forecasts) return [];

    return forecasts.flatMap((forecast, index) => {
      const eta = departAt + route.duration * forecast.sample.fraction * 1000;
      const weather = forecastAt(forecast.hourly, eta);
      if (!weather) return [];

      const { label, short } = segmentLabel(forecast.sample.fraction, index, forecasts.length);

      return [
        {
          key: `${index}-${Math.round(forecast.sample.fraction * 1000)}`,
          label,
          shortLabel: short,
          sample: forecast.sample,
          eta,
          weather,
          score: scoreHour(weather),
          windRelation: windRelation(weather.windDirection, forecast.sample.bearing),
        },
      ];
    });
  }, [route, forecasts, departAt]);

  const worstSegment = useMemo<SegmentForecast | null>(() => {
    if (segments.length === 0) return null;
    return segments.reduce((worst, segment) => (segment.score < worst.score ? segment : worst));
  }, [segments]);

  const averageScore = useMemo(() => {
    if (segments.length === 0) return 0;
    return Math.round(segments.reduce((sum, segment) => sum + segment.score, 0) / segments.length);
  }, [segments]);

  const summary = useMemo(() => summarizeScore(worstSegment?.score ?? averageScore), [
    worstSegment,
    averageScore,
  ]);

  const departurePlan = useMemo<DeparturePlan | null>(() => {
    if (!route || !forecasts || forecasts.length === 0) return null;
    return buildDeparturePlan(forecasts, route.duration, now, 24, departAt);
  }, [route, forecasts, now, departAt]);

  const addWaypoint = useCallback((lngLat: LngLat, name?: string) => {
    setWaypoints((current) => {
      if (current.length >= MAX_WAYPOINTS) return current;
      return [...current, createWaypoint(lngLat, name)];
    });
  }, []);

  const moveWaypoint = useCallback((id: string, lngLat: LngLat) => {
    setWaypoints((current) =>
      current.map((waypoint) => (waypoint.id === id ? { ...waypoint, lngLat } : waypoint)),
    );
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWaypoints((current) => current.filter((waypoint) => waypoint.id !== id));
  }, []);

  const clearWaypoints = useCallback(() => setWaypoints([]), []);

  const reverseWaypoints = useCallback(() => {
    setWaypoints((current) => [...current].reverse());
  }, []);

  const replaceWaypoints = useCallback((next: Array<{ lngLat: LngLat; name?: string }>) => {
    setWaypoints(next.slice(0, MAX_WAYPOINTS).map((point) => createWaypoint(point.lngLat, point.name)));
  }, []);

  const retryRoute = useCallback(() => setRouteRetry((value) => value + 1), []);
  const retryWeather = useCallback(() => setWeatherRetry((value) => value + 1), []);

  return {
    waypoints,
    profile,
    setProfile,
    departAt,
    departureMode,
    setDeparture,
    useCurrentDeparture,
    now,

    route,
    routeState,
    retryRoute,
    forecasts,
    weatherState,
    retryWeather,

    segments,
    worstSegment,
    averageScore,
    summary,
    departurePlan,

    addWaypoint,
    moveWaypoint,
    removeWaypoint,
    clearWaypoints,
    reverseWaypoints,
    replaceWaypoints,
    maxWaypoints: MAX_WAYPOINTS,
  };
}
