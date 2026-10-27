import { AlertTriangle, Droplets, RefreshCw, Wind } from "lucide-react";
import type { RouteResult, SegmentForecast } from "../types";
import type { AsyncState } from "../hooks/useRidePlanner";
import { scoreColor } from "../lib/weather";
import { weatherInfo } from "../lib/weatherCodes";
import {
  formatClock,
  formatDistance,
  formatPercent,
  formatTemperature,
  formatWindSpeed,
} from "../lib/format";
import { WeatherIcon } from "./WeatherIcon";

const WIND_LABEL = {
  headwind: "headwind",
  tailwind: "tailwind",
  crosswind: "crosswind",
} as const;

interface RouteForecastProps {
  route: RouteResult | null;
  segments: SegmentForecast[];
  weatherState: AsyncState;
  onRetry: () => void;
}

const PLOT_TOP = 6;
const PLOT_HEIGHT = 72;

export function RouteForecast({ route, segments, weatherState, onRetry }: RouteForecastProps) {
  if (!route) return null;

  const chartPoints = segments.map((segment) => ({
    x: segment.sample.fraction * 100,
    y: PLOT_TOP + (1 - segment.weather.precipitationProbability / 100) * PLOT_HEIGHT,
    segment,
  }));

  const line = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  const area = chartPoints.length > 0 ? `${line} L100,${PLOT_TOP + PLOT_HEIGHT} L0,${PLOT_TOP + PLOT_HEIGHT} Z` : "";

  const showChart = segments.length > 0;

  return (
    <section className="card" aria-labelledby="forecast-heading">
      <div className="card-head">
        <h2 id="forecast-heading">Along the route</h2>
        <span className="card-meta">
          {showChart ? `${segments.length} check${segments.length === 1 ? "" : "s"}` : "Forecast"}
        </span>
      </div>

      {weatherState.status === "loading" && !showChart && (
        <div className="forecast-skeleton" aria-hidden>
          <span className="skeleton-line is-wide" />
          <span className="skeleton-line" />
          <span className="skeleton-line is-wide" />
          <span className="skeleton-line" />
        </div>
      )}

      {weatherState.status === "error" && (
        <div className="inline-error" role="alert">
          <p>
            <AlertTriangle size={13} aria-hidden /> {weatherState.error}
          </p>
          <button type="button" onClick={onRetry}>
            <RefreshCw size={13} aria-hidden />
            Retry
          </button>
        </div>
      )}

      {showChart && (
        <>
          <div className="rain-chart">
            <div className="rain-axis" aria-hidden>
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <div className="rain-plot">
              <svg
                className="rain-svg"
                viewBox={`0 0 100 ${PLOT_TOP + PLOT_HEIGHT}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Chance of rain along the route"
              >
                <defs>
                  <linearGradient id="rainArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[PLOT_TOP, PLOT_TOP + PLOT_HEIGHT / 2, PLOT_TOP + PLOT_HEIGHT].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="100"
                    y1={y}
                    y2={y}
                    className="rain-grid"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {area && <path d={area} fill="url(#rainArea)" />}
                {line && (
                  <path
                    d={line}
                    fill="none"
                    className="rain-line"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {chartPoints.map(({ x, y, segment }) => (
                <span
                  key={segment.key}
                  className="rain-dot"
                  style={{
                    left: `${x}%`,
                    top: `${y}px`,
                    background: scoreColor(segment.score),
                  }}
                  title={`${segment.label} · ${formatClock(segment.eta)} · ${formatPercent(
                    segment.weather.precipitationProbability,
                  )} rain`}
                />
              ))}

              <div className="rain-caption" aria-hidden>
                <span>0 km</span>
                <span>{formatDistance(route.distance)}</span>
              </div>
            </div>
          </div>

          <p className="chart-caption">
            Rain chance by distance. Dots are coloured by overall conditions.
          </p>

          <ol className="segments">
            {segments.map((segment) => (
              <li key={segment.key} className="segment">
                <span className="segment-rail" aria-hidden>
                  <i style={{ background: scoreColor(segment.score) }} />
                </span>
                <div className="segment-body">
                  <div className="segment-top">
                    <span className="segment-label">{segment.label}</span>
                    <span className="segment-time">{formatClock(segment.eta)}</span>
                  </div>
                  <div className="segment-row">
                    <WeatherIcon
                      code={segment.weather.weatherCode}
                      isDay={segment.weather.isDay}
                      size={17}
                    />
                    <strong className="segment-temp">
                      {formatTemperature(segment.weather.temperature)}
                    </strong>
                    <span className="segment-condition" title={weatherInfo(segment.weather.weatherCode).label}>
                      {weatherInfo(segment.weather.weatherCode).label}
                    </span>
                  </div>
                  <div className="segment-meta">
                    <span title="Chance of precipitation">
                      <Droplets size={12} aria-hidden />
                      {formatPercent(segment.weather.precipitationProbability)}
                    </span>
                    <span title="Wind speed and direction relative to travel">
                      <Wind size={12} aria-hidden />
                      {formatWindSpeed(segment.weather.windSpeed)}{" "}
                      {WIND_LABEL[segment.windRelation.type]}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
