import type { RouteResult, Waypoint } from "../types";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildGpx(
  route: RouteResult,
  waypoints: Waypoint[],
  name = "RideCast route",
): string {
  const timestamp = new Date().toISOString();
  const points = route.coordinates
    .map(
      ([lng, lat]) =>
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"></trkpt>`,
    )
    .join("\n");

  const stops = waypoints
    .map(
      (waypoint) =>
        `  <wpt lat="${waypoint.lngLat[1].toFixed(6)}" lon="${waypoint.lngLat[0].toFixed(
          6,
        )}"><name>${escapeXml(waypoint.name || "Stop")}</name></wpt>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RideCast" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${timestamp}</time>
  </metadata>
${stops}
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>
`;
}

export function gpxFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `ridecast-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}.gpx`;
}
