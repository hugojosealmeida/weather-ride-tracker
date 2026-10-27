# RideCast

A weather-aware route planner for rides, hikes and drives, packaged as a native macOS desktop app with Tauri 2.

Drop a few stops on the map, pick Drive / Bike / Walk, and RideCast fetches road-accurate geometry plus the hourly forecast along the route. It scores each hour's comfort, tells you which way the wind is blowing relative to your direction of travel, and finds the best departure window in the next 24 hours.

## Features

- **Route editor** — click the map or drag pins to add and move stops, reorder by reversing, clear or load the bundled Lisbon demo.
- **Road/cycling/path routing** — Drive, Bike and Walk profiles via OSRM, with debounced requests, cancellation of stale ones and retryable errors.
- **Place search** — Nominatim autocomplete with debouncing and an in-memory cache.
- **Weather timeline** — Open-Meteo hourly data sampled at points along the route, adjusted to your ETA at each segment.
- **Comfort score (0–100)** — combines precipitation chance, wind, gusts and temperature into one number per hour, where **100 is perfect** and lower means rougher conditions.
- **Wind relation** — headwind, tailwind or crosswind for every segment, based on bearing and wind direction.
- **Departure planner** — 24 hourly bars plus a suggested best window for the next 24 hours.
- **Rain-along-route chart** — see where the wet patches are before you leave.
- **GPX export** — written straight to `~/Downloads` by a Rust command, with a “Show in Finder” action on macOS.
- **Workspace persistence** — route, profile and waypoints are kept in `localStorage` between launches.
- **Dark, map-first layout** — MapLibre GL with a CARTO dark basemap, gradient route line and weather-coloured segments.

## Stack

| Layer | Choice |
| --- | --- |
| Shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript 5.9 |
| Build | Vite 8 |
| Map | MapLibre GL JS 6 |
| Routing | FOSSGIS OSRM demo servers (OpenStreetMap data) |
| Forecast | Open-Meteo (no API key) |
| Geocoding | Nominatim (OpenStreetMap) |
| Icons | Lucide |

## Requirements

- macOS 11 or newer (the bundle is configured for macOS; the frontend also runs in a browser)
- Node.js 20.19+ (or 22.12+) and npm
- Rust with Cargo (`rustup`), plus the Xcode command-line tools

If Cargo was installed with rustup it may not be on the default shell `PATH`:

```sh
export PATH="$HOME/.cargo/bin:$PATH"
```

## Getting started

```sh
npm install
npm run desktop:dev    # Tauri window with Vite hot reload
```

The frontend alone runs in any browser:

```sh
npm run dev            # http://localhost:1420
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 1420 |
| `npm run build` | Type-check, then build the frontend into `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run desktop:dev` | Run the Tauri desktop app in development |
| `npm run desktop:build` | Build the release `.app` / `.dmg` bundles |
| `npx tauri build --debug --no-bundle` | Faster debug compile of the Rust side |

## Data sources and terms

These services are keyless, which makes the project easy to run, but most of them are **shared demo infrastructure**. Read their terms before distributing a commercial build.

- **Open-Meteo** — free for non-commercial use, no key required. Review [open-meteo.com/en/terms](https://open-meteo.com/en/terms) and the [licence](https://open-meteo.com/en/license) before shipping a paid product.
- **OSRM via FOSSGIS** — `routing.openstreetmap.de` is a community demo service with no uptime or rate-limit guarantee. For production, self-host OSRM or use a commercial provider. See [routing.openstreetmap.de/about.html](https://routing.openstreetmap.de/about.html).
- **Nominatim** — shared and rate-limited (about one request per second). RideCast debounces and caches queries, but a distributed app should use a paid geocoder or a self-hosted instance. See the [usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- **CARTO basemap** — `dark-matter` style tiles; attribution is shown on the map. See [CARTO basemap terms](https://carto.com/basemaps).
- **OpenStreetMap** — routing, search and basemap data © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright).

No API keys are stored in this repository.

## Project structure

```
weather-ride-tracker/
├── src/
│   ├── App.tsx                 # layout, demo route, toast + GPX wiring
│   ├── components/
│   │   ├── MapCanvas.tsx       # MapLibre init, layers, pins, popups
│   │   ├── RoutePanel.tsx      # waypoint list, profile picker, actions
│   │   ├── RideWindow.tsx      # score, verdict, 24h departure bars
│   │   ├── RouteForecast.tsx   # rain chart and per-segment cards
│   │   ├── SearchBox.tsx       # Nominatim autocomplete
│   │   ├── WeatherIcon.tsx     # WMO code → icon/label
│   │   └── Toast.tsx
│   ├── hooks/useRidePlanner.ts # routing/weather state machine + persistence
│   ├── lib/
│   │   ├── routing.ts          # OSRM endpoints and response parsing
│   │   ├── weather.ts          # Open-Meteo fetch, scoring, departure plan
│   │   ├── geocode.ts          # Nominatim search + cache
│   │   ├── geo.ts              # sampling, bearings, distance helpers
│   │   ├── gpx.ts              # GPX serialisation
│   │   ├── storage.ts          # localStorage workspace
│   │   └── tauri.ts            # save_gpx / reveal_in_finder bridge
│   └── styles.css              # dark theme, map chrome, charts
├── src-tauri/
│   ├── src/lib.rs              # save_gpx, reveal_in_finder, filename tests
│   └── tauri.conf.json         # window, CSP, bundle config
└── vite.config.ts
```

### Notes on the desktop shell

- GPX export uses a small Rust command instead of the filesystem plugin, so there are no extra capability files to maintain. Files land in `~/Downloads` with a `-2`, `-3` suffix if the name already exists.
- The CSP allows `worker-src 'self' blob:` because MapLibre spawns a web worker from the bundled `.mjs` file. No `unsafe-eval` is needed.
- The browser build falls back to a Blob download when the Tauri IPC bridge is unavailable.

## Limitations and next steps

- Routing, search and basemap are demo/shared services — swap them for production endpoints before distribution.
- Forecasts cover roughly three days; a departure window beyond that is not planned.
- Comfort scoring is heuristic and tuned for cycling; treat it as guidance, not a safety guarantee.
- Elevation, turn-by-turn directions, saved routes and multi-route comparison are not implemented yet.
- The app is unsigned, so a local build triggers Gatekeeper on other Macs. Signing/notarisation is required for distribution.

## Licence

Source code is currently unlicensed — add a licence before publishing. Data and tiles remain subject to the providers' terms listed above.
