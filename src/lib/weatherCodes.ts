export type WeatherTone =
  | "clear"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

interface WeatherCodeInfo {
  label: string;
  tone: WeatherTone;
  severity: number;
}

const FALLBACK: WeatherCodeInfo = { label: "Unknown", tone: "cloudy", severity: 0 };

const CODES: Record<number, WeatherCodeInfo> = {
  0: { label: "Clear sky", tone: "clear", severity: 0 },
  1: { label: "Mainly clear", tone: "clear", severity: 0 },
  2: { label: "Partly cloudy", tone: "cloudy", severity: 1 },
  3: { label: "Overcast", tone: "cloudy", severity: 3 },
  45: { label: "Fog", tone: "fog", severity: 10 },
  48: { label: "Freezing fog", tone: "fog", severity: 14 },
  51: { label: "Light drizzle", tone: "drizzle", severity: 5 },
  53: { label: "Drizzle", tone: "drizzle", severity: 8 },
  55: { label: "Heavy drizzle", tone: "drizzle", severity: 12 },
  56: { label: "Freezing drizzle", tone: "drizzle", severity: 18 },
  57: { label: "Heavy freezing drizzle", tone: "drizzle", severity: 22 },
  61: { label: "Light rain", tone: "rain", severity: 8 },
  63: { label: "Rain", tone: "rain", severity: 16 },
  65: { label: "Heavy rain", tone: "rain", severity: 26 },
  66: { label: "Freezing rain", tone: "rain", severity: 28 },
  67: { label: "Heavy freezing rain", tone: "rain", severity: 32 },
  71: { label: "Light snow", tone: "snow", severity: 10 },
  73: { label: "Snow", tone: "snow", severity: 18 },
  75: { label: "Heavy snow", tone: "snow", severity: 28 },
  77: { label: "Snow grains", tone: "snow", severity: 12 },
  80: { label: "Light showers", tone: "rain", severity: 8 },
  81: { label: "Showers", tone: "rain", severity: 14 },
  82: { label: "Violent showers", tone: "rain", severity: 24 },
  85: { label: "Snow showers", tone: "snow", severity: 16 },
  86: { label: "Heavy snow showers", tone: "snow", severity: 26 },
  95: { label: "Thunderstorm", tone: "storm", severity: 34 },
  96: { label: "Thunderstorm with hail", tone: "storm", severity: 40 },
  99: { label: "Severe thunderstorm", tone: "storm", severity: 44 },
};

export function weatherInfo(code: number): WeatherCodeInfo {
  return CODES[code] ?? FALLBACK;
}
