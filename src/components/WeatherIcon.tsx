import {
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";
import { weatherInfo } from "../lib/weatherCodes";

interface WeatherIconProps {
  code: number;
  isDay: boolean;
  size?: number;
  className?: string;
}

const TONE_CLASS: Record<string, string> = {
  clear: "is-clear",
  cloudy: "is-cloudy",
  fog: "is-fog",
  drizzle: "is-drizzle",
  rain: "is-rain",
  snow: "is-snow",
  storm: "is-storm",
};

export function WeatherIcon({ code, isDay, size = 22, className = "" }: WeatherIconProps) {
  const { tone, label } = weatherInfo(code);
  const Icon = (() => {
    switch (tone) {
      case "clear":
        return isDay ? Sun : Moon;
      case "fog":
        return CloudFog;
      case "drizzle":
        return CloudDrizzle;
      case "rain":
        return CloudRain;
      case "snow":
        return CloudSnow;
      case "storm":
        return CloudLightning;
      default:
        return isDay ? CloudSun : CloudMoon;
    }
  })();

  return (
    <Icon
      size={size}
      strokeWidth={1.8}
      role="img"
      aria-label={label}
      className={`weather-icon ${TONE_CLASS[tone] ?? ""} ${className}`.trim()}
    />
  );
}
