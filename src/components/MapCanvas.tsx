import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { Loader2, Maximize2, MousePointerClick } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLat, RouteResult, SegmentForecast, Waypoint } from "../types";
import { routeBounds } from "../lib/geo";
import { scoreColor } from "../lib/weather";
import { weatherInfo } from "../lib/weatherCodes";
import {
  formatClock,
  formatPercent,
  formatTemperature,
  formatWindSpeed,
} from "../lib/format";

// Vite's `?url` import copies the worker into the production bundle. Without
// this, MapLibre's relative worker lookup only resolves while Vite serves the
// package from node_modules and the built app silently fails to render tiles.
setWorkerUrl(workerUrl);

const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const DEFAULT_COLOR = "#5eead4";
const EMPTY_LINE: Feature<LineString> = {
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: [] },
};
const EMPTY_POINTS: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

interface MapCanvasProps {
  waypoints: Waypoint[];
  route: RouteResult | null;
  segments: SegmentForecast[];
  routing: boolean;
  focus: { lngLat: LngLat; nonce: number } | null;
  onAddWaypoint: (lngLat: LngLat) => void;
  onMoveWaypoint: (id: string, lngLat: LngLat) => void;
}

const WIND_LABEL = {
  headwind: "headwind",
  tailwind: "tailwind",
  crosswind: "crosswind",
} as const;

function buildGradient(segments: SegmentForecast[]): unknown[] {
  const expression: unknown[] = ["interpolate", ["linear"], ["line-progress"]];

  if (segments.length === 0) {
    return [...expression, 0, DEFAULT_COLOR, 1, DEFAULT_COLOR];
  }

  const sorted = [...segments].sort((a, b) => a.sample.fraction - b.sample.fraction);
  const stops = new Map<number, string>();

  if (sorted[0].sample.fraction > 0) stops.set(0, scoreColor(sorted[0].score));
  for (const segment of sorted) {
    stops.set(Number(segment.sample.fraction.toFixed(4)), scoreColor(segment.score));
  }
  if (sorted[sorted.length - 1].sample.fraction < 1) {
    stops.set(1, scoreColor(sorted[sorted.length - 1].score));
  }

  for (const [fraction, color] of stops) {
    expression.push(fraction, color);
  }
  return expression;
}

function decoratePin(element: HTMLElement, index: number, total: number) {
  const kind = index === 0 ? "start" : index === total - 1 ? "end" : "mid";
  element.classList.add("map-pin");
  element.classList.toggle("is-start", kind === "start");
  element.classList.toggle("is-mid", kind === "mid");
  element.classList.toggle("is-end", kind === "end");
  element.textContent = String.fromCharCode(65 + index);
}

const activeSamplePopups = new WeakMap<MapLibreMap, Popup>();

export function showSamplePopup(map: MapLibreMap, feature: MapGeoJSONFeature) {
  const properties = feature.properties ?? {};
  const coordinates = (feature.geometry as Point).coordinates as [number, number];

  // Only one sample popup may be visible at a time: close any previous one
  // before creating the next.
  const previous = activeSamplePopups.get(map);
  if (previous) {
    try {
      previous.remove();
    } catch {
      // Ignore removal errors from already-removed popups.
    }
    activeSamplePopups.delete(map);
  }

  // Ensure no stale sample popup containers remain in the DOM.
  if (typeof document !== "undefined") {
    document.querySelectorAll(".ride-popup").forEach((node) => node.remove());
  }

  const popup = document.createElement("div");
  popup.className = "popup-card";

  const head = document.createElement("div");
  head.className = "popup-head";
  const title = document.createElement("strong");
  title.textContent = String(properties.label ?? "");
  const time = document.createElement("span");
  time.textContent = String(properties.time ?? "");
  head.append(title, time);

  const body = document.createElement("div");
  body.className = "popup-body";
  body.textContent = `${properties.temp} · ${properties.condition} · ${properties.rain} rain`;

  const meta = document.createElement("div");
  meta.className = "popup-meta";
  meta.textContent = `Wind ${properties.wind}`;

  popup.append(head, body, meta);

  const instance = new Popup({ offset: 14, closeButton: false, className: "ride-popup" })
    .setLngLat(coordinates)
    .setDOMContent(popup)
    .addTo(map);

  activeSamplePopups.set(map, instance);

  const handleClose = () => {
    if (activeSamplePopups.get(map) === instance) {
      activeSamplePopups.delete(map);
    }
  };
  try {
    instance.on("close", handleClose);
  } catch {
    // Some (test) doubles do not support events; tracking still works.
  }

  return instance;
}

export function MapCanvas({
  waypoints,
  route,
  segments,
  routing,
  focus,
  onAddWaypoint,
  onMoveWaypoint,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const addHandlerRef = useRef(onAddWaypoint);
  const moveHandlerRef = useRef(onMoveWaypoint);
  const lastRouteRef = useRef<RouteResult | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    addHandlerRef.current = onAddWaypoint;
  }, [onAddWaypoint]);

  useEffect(() => {
    moveHandlerRef.current = onMoveWaypoint;
  }, [onMoveWaypoint]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    setReady(false);
    const map = new MapLibreMap({
      container,
      style: STYLE_URL,
      center: [-9.1425, 38.712],
      zoom: 12.2,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric", maxWidth: 80 }), "bottom-left");

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: EMPTY_LINE,
        lineMetrics: true,
      });
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#2dd4bf",
          "line-width": 18,
          "line-blur": 16,
          "line-opacity": 0.25,
        },
      });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#03080d",
          "line-width": 9,
          "line-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": DEFAULT_COLOR,
          "line-width": 4.5,
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "route-conditions",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": 5,
          "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, DEFAULT_COLOR, 1, DEFAULT_COLOR],
        },
      });

      map.addSource("samples", { type: "geojson", data: EMPTY_POINTS });
      map.addLayer({
        id: "sample-halo",
        type: "circle",
        source: "samples",
        paint: {
          "circle-radius": 8,
          "circle-color": "#04090f",
          "circle-opacity": 0.8,
        },
      });
      map.addLayer({
        id: "sample-dot",
        type: "circle",
        source: "samples",
        paint: {
          "circle-radius": 4.5,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#04090f",
          "circle-stroke-width": 1.5,
        },
      });

      map.on("mouseenter", "sample-dot", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "sample-dot", () => {
        map.getCanvas().style.cursor = "";
      });

      setReady(true);
    });

    map.on("click", (event) => {
      if (map.isStyleLoaded() && map.getLayer("sample-dot")) {
        const features = map.queryRenderedFeatures(event.point, { layers: ["sample-dot"] });
        if (features.length > 0) {
          showSamplePopup(map, features[0]);
          return;
        }
      }
      addHandlerRef.current([event.lngLat.lng, event.lngLat.lat]);
    });

    return () => {
      const activePopup = activeSamplePopups.get(map);
      if (activePopup) {
        try {
          activePopup.remove();
        } catch {
          // Ignore.
        }
        activeSamplePopups.delete(map);
      }
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Waypoint pins: created/updated imperatively so dragging stays smooth.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const liveIds = new Set(waypoints.map((waypoint) => waypoint.id));

    for (const [id, marker] of markers) {
      if (!liveIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    waypoints.forEach((waypoint, index) => {
      const existing = markers.get(waypoint.id);

      if (existing) {
        existing.setLngLat(waypoint.lngLat);
        decoratePin(existing.getElement(), index, waypoints.length);
        existing.getElement().title = waypoint.name
          ? `${waypoint.name} — drag to move`
          : "Drag to move this pin";
        return;
      }

      const element = document.createElement("div");
      decoratePin(element, index, waypoints.length);
      element.title = waypoint.name ? `${waypoint.name} — drag to move` : "Drag to move this pin";
      element.addEventListener("click", (event) => event.stopPropagation());

      const marker = new Marker({ element, draggable: true, anchor: "center" })
        .setLngLat(waypoint.lngLat)
        .addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLngLat();
        moveHandlerRef.current(waypoint.id, [position.lng, position.lat]);
      });

      markers.set(waypoint.id, marker);
    });
  }, [waypoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource("route") as GeoJSONSource | undefined;
    if (!source) return;

    if (!route) {
      source.setData(EMPTY_LINE);
    } else {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: route.coordinates },
      });
    }

    map.setPaintProperty("route-conditions", "line-gradient", buildGradient(segments) as never);
  }, [route, segments, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource("samples") as GeoJSONSource | undefined;
    if (!source) return;

    const collection: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: segments.map((segment) => ({
        type: "Feature",
        properties: {
          label: segment.label,
          time: formatClock(segment.eta),
          temp: formatTemperature(segment.weather.temperature),
          condition: weatherInfo(segment.weather.weatherCode).label,
          rain: formatPercent(segment.weather.precipitationProbability),
          wind: `${formatWindSpeed(segment.weather.windSpeed)} ${
            WIND_LABEL[segment.windRelation.type]
          }`,
          color: scoreColor(segment.score),
        },
        geometry: { type: "Point", coordinates: segment.sample.coordinate },
      })),
    };

    source.setData(collection);
  }, [segments, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !route) return;
    if (lastRouteRef.current === route) return;

    const bounds = routeBounds(route.coordinates);
    if (!bounds) return;

    lastRouteRef.current = route;
    map.fitBounds(bounds, {
      padding: { top: 90, right: 90, bottom: 90, left: 110 },
      maxZoom: 14.5,
      duration: 900,
    });
  }, [route, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo({
      center: focus.lngLat,
      zoom: Math.max(map.getZoom(), 13),
      duration: 800,
    });
  }, [focus]);

  return (
    <div className="map-shell">
      <div ref={containerRef} className="map-canvas" />

      {segments.length > 0 && (
        <div className="map-legend" aria-hidden>
          <span className="legend-title">Conditions</span>
          <span className="legend-bar" />
          <span className="legend-scale">
            <span>Dry</span>
            <span>Wet</span>
          </span>
        </div>
      )}

      {routing && (
        <div className="map-status" role="status">
          <Loader2 size={13} className="spin" aria-hidden />
          Updating route…
        </div>
      )}

      <div className="map-actions">
        <button
          type="button"
          title="Fit route to the map"
          aria-label="Fit route to the map"
          disabled={!route}
          onClick={() => {
            const map = mapRef.current;
            const bounds = route ? routeBounds(route.coordinates) : null;
            if (!map || !bounds) return;
            map.fitBounds(bounds, {
              padding: { top: 90, right: 90, bottom: 90, left: 110 },
              maxZoom: 14.5,
              duration: 700,
            });
          }}
        >
          <Maximize2 size={16} />
        </button>
      </div>

      <div className="map-hint" aria-hidden>
        <MousePointerClick size={13} />
        {waypoints.length === 0 ? "Click the map to set a start point" : "Click to add another stop"}
      </div>
    </div>
  );
}
