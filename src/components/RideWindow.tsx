import { CalendarClock, Clock, Loader2, Sparkles } from "lucide-react";
import type { DeparturePlan, RouteResult, SegmentForecast } from "../types";
import type { ConditionSummary } from "../lib/weather";
import { scoreColor } from "../lib/weather";
import type { LoadStatus } from "../hooks/useRidePlanner";
import {
  formatClock,
  formatDateTime,
  formatDecimal,
  formatDistance,
  formatDuration,
  toDateTimeInputValue,
} from "../lib/format";
import { WeatherIcon } from "./WeatherIcon";

interface RideWindowProps {
  route: RouteResult | null;
  segments: SegmentForecast[];
  summary: ConditionSummary;
  worstSegment: SegmentForecast | null;
  departurePlan: DeparturePlan | null;
  departAt: number;
  departureMode: "now" | "custom";
  now: number;
  weatherStatus: LoadStatus;
  onSetDeparture: (timestamp: number) => void;
  onUseNow: () => void;
}

export function RideWindow({
  route,
  segments,
  summary,
  worstSegment,
  departurePlan,
  departAt,
  departureMode,
  now,
  weatherStatus,
  onSetDeparture,
  onUseNow,
}: RideWindowProps) {
  if (!route) return null;

  const speed = route.duration > 0 ? (route.distance / route.duration) * 3.6 : 0;
  const best = departurePlan?.best ?? null;
  const selected = departurePlan?.selected ?? null;
  const suggestBest = !!(best && selected && best.score >= selected.score + 6);

  const selectedIndex = departurePlan
    ? departurePlan.slots.reduce((closest, slot, index, slots) => {
        const delta = Math.abs(slot.time - departAt);
        const closestDelta = Math.abs(slots[closest].time - departAt);
        return delta < closestDelta ? index : closest;
      }, 0)
    : -1;
  const hasSelection =
    selectedIndex >= 0 &&
    departurePlan !== null &&
    Math.abs(departurePlan.slots[selectedIndex].time - departAt) < 3_600_000;

  return (
    <section className="card" aria-labelledby="window-heading">
      <div className="card-head">
        <h2 id="window-heading">Ride window</h2>
        <span className="card-meta">{formatDateTime(departAt, now)}</span>
      </div>

      <div className="metrics">
        <div className="metric">
          <span className="metric-label">Distance</span>
          <strong>{formatDistance(route.distance)}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Ride time</span>
          <strong>{formatDuration(route.duration)}</strong>
        </div>
        <div className="metric">
          <span className="metric-label">Avg. pace</span>
          <strong>
            {formatDecimal(speed)} <small>km/h</small>
          </strong>
        </div>
      </div>

      {weatherStatus === "loading" && segments.length === 0 && (
        <p className="route-status">
          <Loader2 size={13} className="spin" aria-hidden />
          Checking the forecast…
        </p>
      )}

      {segments.length > 0 && worstSegment && (
        <>
          <div className={`verdict is-${summary.tone}`}>
            <span className="verdict-icon">
              <WeatherIcon
                code={worstSegment.weather.weatherCode}
                isDay={worstSegment.weather.isDay}
                size={20}
              />
            </span>
            <div className="verdict-text">
              <strong>{summary.label}</strong>
              <span>{summary.detail}</span>
            </div>
            <span className="verdict-score" title="Worst conditions along the route">
              {worstSegment.score}
              <small>/100</small>
            </span>
          </div>

          <div className="departure">
            <div className="departure-head">
              <span className="field-label">
                <CalendarClock size={13} aria-hidden />
                Departure
              </span>
              <div className="departure-controls">
                <button
                  type="button"
                  className={`now-button ${departureMode === "now" ? "is-active" : ""}`}
                  onClick={onUseNow}
                  aria-pressed={departureMode === "now"}
                >
                  <Clock size={13} aria-hidden />
                  Now
                </button>
                <input
                  type="datetime-local"
                  className="date-input"
                  aria-label="Choose a departure time"
                  value={toDateTimeInputValue(departAt)}
                  min={toDateTimeInputValue(now)}
                  max={toDateTimeInputValue(now + 48 * 3_600_000)}
                  onChange={(event) => {
                    const next = Date.parse(event.target.value);
                    if (Number.isFinite(next)) onSetDeparture(next);
                  }}
                />
              </div>
            </div>

            {suggestBest && best && (
              <div className="best-window">
                <Sparkles size={16} aria-hidden />
                <div>
                  <strong>Better window</strong>
                  <span>
                    {formatDateTime(best.time, now)} · score {best.score}/100
                  </span>
                </div>
                <button type="button" onClick={() => onSetDeparture(best.time)}>
                  Use
                </button>
              </div>
            )}

            {departurePlan && (
              <div className="departure-chart">
                <div className="bars" role="group" aria-label="Forecast score by departure hour">
                  {departurePlan.slots.map((slot, index) => {
                    const valid = Number.isFinite(slot.score);
                    const height = valid ? Math.max(10, slot.score) : 8;
                    const isSelected = hasSelection && index === selectedIndex;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        className={`bar ${isSelected ? "is-selected" : ""} ${
                          valid ? "" : "is-empty"
                        }`}
                        style={{
                          height: `${height}%`,
                          background: valid ? scoreColor(slot.score) : undefined,
                        }}
                        disabled={!valid}
                        aria-label={`Depart ${formatDateTime(slot.time, now)}, score ${
                          valid ? slot.score : "unavailable"
                        } out of 100`}
                        aria-pressed={isSelected}
                        title={
                          valid
                            ? `${formatDateTime(slot.time, now)} · ${slot.score}/100`
                            : `${formatDateTime(slot.time, now)} · no forecast`
                        }
                        onClick={() => onSetDeparture(slot.time)}
                      />
                    );
                  })}
                </div>
                <div className="bars-scale" aria-hidden>
                  {departurePlan.slots
                    .filter((_, index) => index % 6 === 0)
                    .map((slot) => (
                      <span key={slot.time}>{formatClock(slot.time)}</span>
                    ))}
                </div>
                <p className="chart-caption">Taller and greener means a drier ride.</p>
              </div>
            )}
          </div>
        </>
      )}

      {segments.length === 0 && weatherStatus === "ready" && (
        <div className="hint-block">
          <p className="hint-text">
            This departure is outside the 3-day forecast. Pick a time closer to now to see
            conditions along the route.
          </p>
          <button type="button" className="text-button" onClick={onUseNow}>
            <Clock size={13} aria-hidden />
            Ride now instead
          </button>
        </div>
      )}
    </section>
  );
}
