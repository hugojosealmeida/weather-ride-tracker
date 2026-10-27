import {
  ArrowDownUp,
  Bike,
  CarFront,
  Download,
  Footprints,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Profile, RouteResult, Waypoint } from "../types";
import type { AsyncState } from "../hooks/useRidePlanner";
import { PROFILE_META } from "../lib/routing";
import { formatCoordinate } from "../lib/format";

const PROFILE_ICONS = {
  car: CarFront,
  bike: Bike,
  foot: Footprints,
} as const;

interface RoutePanelProps {
  waypoints: Waypoint[];
  maxWaypoints: number;
  profile: Profile;
  onProfileChange: (profile: Profile) => void;
  route: RouteResult | null;
  routeState: AsyncState;
  onRemove: (id: string) => void;
  onClear: () => void;
  onReverse: () => void;
  onExport: () => void;
  onDemo: () => void;
  onRetry: () => void;
  exporting: boolean;
}

export function RoutePanel({
  waypoints,
  maxWaypoints,
  profile,
  onProfileChange,
  route,
  routeState,
  onRemove,
  onClear,
  onReverse,
  onExport,
  onDemo,
  onRetry,
  exporting,
}: RoutePanelProps) {
  return (
    <section className="card" aria-labelledby="route-heading">
      <div className="card-head">
        <h2 id="route-heading">Route</h2>
        <span className="card-meta">
          {waypoints.length}/{maxWaypoints} stops
        </span>
      </div>

      <div className="segmented" role="group" aria-label="Travel mode">
        {(Object.keys(PROFILE_META) as Profile[]).map((key) => {
          const Icon = PROFILE_ICONS[key];
          return (
            <button
              key={key}
              type="button"
              className={`segment ${profile === key ? "is-active" : ""}`}
              aria-pressed={profile === key}
              title={PROFILE_META[key].hint}
              onClick={() => onProfileChange(key)}
            >
              <Icon size={15} aria-hidden />
              {PROFILE_META[key].label}
            </button>
          );
        })}
      </div>

      {waypoints.length === 0 ? (
        <div className="empty-route">
          <div className="empty-route-icon">
            <MapPin size={20} aria-hidden />
          </div>
          <p>
            Click anywhere on the map to drop a start pin, or search for a place above.
          </p>
          <button type="button" className="text-button" onClick={onDemo}>
            <Sparkles size={14} aria-hidden />
            Try a demo ride
          </button>
        </div>
      ) : (
        <ol className="waypoint-list">
          {waypoints.map((waypoint, index) => {
            const kind =
              index === 0 ? "start" : index === waypoints.length - 1 ? "end" : "mid";
            return (
              <li key={waypoint.id} className="waypoint">
                <span className={`waypoint-badge is-${kind}`} aria-hidden>
                  {String.fromCharCode(65 + index)}
                </span>
                <div className="waypoint-text">
                  <strong>{waypoint.name || `Stop ${index + 1}`}</strong>
                  <span>{formatCoordinate(waypoint.lngLat)}</span>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove ${waypoint.name || `stop ${index + 1}`}`}
                  onClick={() => onRemove(waypoint.id)}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {routeState.status === "loading" && (
        <p className="route-status">
          <Loader2 size={13} className="spin" aria-hidden />
          Finding the best route…
        </p>
      )}

      {routeState.status === "error" && (
        <div className="inline-error" role="alert">
          <p>{routeState.error}</p>
          <button type="button" onClick={onRetry}>
            <RefreshCw size={13} aria-hidden />
            Retry
          </button>
        </div>
      )}

      <div className="card-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={onReverse}
          disabled={waypoints.length < 2}
        >
          <ArrowDownUp size={14} aria-hidden />
          Reverse
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={onClear}
          disabled={waypoints.length === 0}
        >
          <Trash2 size={14} aria-hidden />
          Clear
        </button>
        <button
          type="button"
          className="ghost-button push"
          onClick={onExport}
          disabled={!route || exporting}
          title="Save this route as a GPX file"
        >
          {exporting ? (
            <Loader2 size={14} className="spin" aria-hidden />
          ) : (
            <Download size={14} aria-hidden />
          )}
          GPX
        </button>
      </div>
    </section>
  );
}
