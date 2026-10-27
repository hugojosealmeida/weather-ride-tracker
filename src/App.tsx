import { useCallback, useEffect, useState } from "react";
import { MapCanvas } from "./components/MapCanvas";
import { RoutePanel } from "./components/RoutePanel";
import { RideWindow } from "./components/RideWindow";
import { RouteForecast } from "./components/RouteForecast";
import { SearchBox } from "./components/SearchBox";
import { Toast, type ToastData } from "./components/Toast";
import { useRidePlanner } from "./hooks/useRidePlanner";
import { buildGpx, gpxFileName } from "./lib/gpx";
import { saveGpx, revealInFinder } from "./lib/tauri";
import type { LngLat, Place } from "./types";

const DEMO_ROUTE: Array<{ lngLat: LngLat; name: string }> = [
  { lngLat: [-9.1449, 38.7076], name: "Cais do Sodré" },
  { lngLat: [-9.1743, 38.7035], name: "Alcântara" },
  { lngLat: [-9.2004, 38.6975], name: "Belém" },
];

export default function App() {
  const planner = useRidePlanner();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [focus, setFocus] = useState<{ lngLat: LngLat; nonce: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((data: Omit<ToastData, "id">) => {
    setToast({ ...data, id: Date.now() });
  }, []);

  const handlePick = useCallback(
    (place: Place) => {
      planner.addWaypoint(place.lngLat, place.name);
      setFocus({ lngLat: place.lngLat, nonce: Date.now() });
    },
    [planner],
  );

  const handleDemo = useCallback(() => {
    planner.setProfile("bike");
    planner.replaceWaypoints(DEMO_ROUTE);
    setFocus({ lngLat: [-9.1743, 38.7035], nonce: Date.now() });
  }, [planner]);

  const handleExport = useCallback(async () => {
    if (!planner.route) return;

    setExporting(true);
    try {
      const filename = gpxFileName();
      const xml = buildGpx(planner.route, planner.waypoints, "RideCast route");
      const outcome = await saveGpx(filename, xml);

      if (outcome.mode === "desktop" && outcome.path) {
        const savedPath = outcome.path;
        notify({
          kind: "success",
          message: "GPX saved",
          detail: savedPath,
          action: {
            label: "Show in Finder",
            onClick: () => {
              void revealInFinder(savedPath).catch(() => undefined);
            },
          },
        });
      } else {
        notify({ kind: "success", message: "GPX downloaded", detail: filename });
      }
    } catch (cause) {
      notify({
        kind: "error",
        message: "Couldn’t export the GPX",
        detail: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setExporting(false);
    }
  }, [planner.route, planner.waypoints, notify]);

  return (
    <div className="app">
      <aside className="sidebar">
        <header className="sidebar-head">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <svg viewBox="0 0 32 32" fill="none">
                <path
                  d="M5.5 23.5c5.8 0 4.4-15 10.5-15s4.7 15 10.5 15"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="5.5" cy="23.5" r="2.8" fill="currentColor" />
                <circle cx="26.5" cy="23.5" r="2.8" fill="currentColor" />
              </svg>
            </span>
            <div className="brand-text">
              <h1>RideCast</h1>
              <p>Weather-aware ride planner</p>
            </div>
            <span className="brand-tag">Tauri 2</span>
          </div>
          <SearchBox onPick={handlePick} />
        </header>

        <div className="sidebar-body">
          <RoutePanel
            waypoints={planner.waypoints}
            maxWaypoints={planner.maxWaypoints}
            profile={planner.profile}
            onProfileChange={planner.setProfile}
            route={planner.route}
            routeState={planner.routeState}
            onRemove={planner.removeWaypoint}
            onClear={planner.clearWaypoints}
            onReverse={planner.reverseWaypoints}
            onExport={handleExport}
            onDemo={handleDemo}
            onRetry={planner.retryRoute}
            exporting={exporting}
          />

          <RideWindow
            route={planner.route}
            segments={planner.segments}
            summary={planner.summary}
            worstSegment={planner.worstSegment}
            departurePlan={planner.departurePlan}
            departAt={planner.departAt}
            departureMode={planner.departureMode}
            now={planner.now}
            weatherStatus={planner.weatherState.status}
            onSetDeparture={planner.setDeparture}
            onUseNow={planner.useCurrentDeparture}
          />

          <RouteForecast
            route={planner.route}
            segments={planner.segments}
            weatherState={planner.weatherState}
            onRetry={planner.retryWeather}
          />

          <footer className="data-note">
            <p>
              Weather by Open-Meteo · Routing by FOSSGIS OSRM · Maps © OpenStreetMap
              contributors and CARTO
            </p>
            <p className="is-muted">
              These are public demo servers. Review their terms and add your own endpoints
              before sharing the app widely.
            </p>
          </footer>
        </div>
      </aside>

      <main className="map-area">
        <MapCanvas
          waypoints={planner.waypoints}
          route={planner.route}
          segments={planner.segments}
          routing={planner.routeState.status === "loading"}
          focus={focus}
          onAddWaypoint={planner.addWaypoint}
          onMoveWaypoint={planner.moveWaypoint}
        />
      </main>

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
