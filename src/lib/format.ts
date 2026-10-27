const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km < 100 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

export function formatClock(timestamp: number): string {
  return timeFormatter.format(new Date(timestamp));
}

export function formatDay(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const today = new Date(now);
  const tomorrow = new Date(now + 86_400_000);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return dayFormatter.format(date);
}

export function formatDateTime(timestamp: number, now = Date.now()): string {
  return `${formatDay(timestamp, now)} ${formatClock(timestamp)}`;
}

export function formatTemperature(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

export function formatWindSpeed(kph: number): string {
  return `${Math.round(kph)} km/h`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatCoordinate([lng, lat]: [number, number]): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function formatDecimal(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

export function startOfHour(timestamp: number): number {
  return timestamp - (timestamp % 3_600_000);
}

export function toDateTimeInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
