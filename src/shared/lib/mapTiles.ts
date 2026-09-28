/**
 * Tile sources for the map, and the RainViewer radar index.
 *
 * Everything here is keyless and free to use, which is the constraint the whole
 * app runs under — there is no `.env`, no account and no paid provider. Each
 * source below was checked against its live host before it was added; a tile
 * URL that needs a key does not belong in this file, and a placeholder that
 * silently serves nothing is worse than an absent layer.
 *
 * **Attribution is not optional.** OSM, OpenSeaMap and RainViewer are all used
 * under licences that require the credit to be visible, so every source carries
 * its `attribution` string and Leaflet's attribution control shows whichever
 * layers are on. Dropping the credit to tidy the corner of the map is a licence
 * breach, not a style decision.
 */

/** One slippy-map tile layer, base or overlay. */
export interface TileSource {
  id: string;
  /** Shown on the layer control. */
  name: string;
  /** Leaflet template — `{s}` `{z}` `{x}` `{y}`. */
  urlTemplate: string;
  /** Required credit. Rendered as HTML by Leaflet's attribution control. */
  attribution: string;
  maxZoom: number;
  /** Overlays only; base layers are opaque. */
  opacity?: number;
}

/**
 * The base maps. Exactly one is on at a time.
 *
 * OSM is the default because it labels places; the other two are for reading
 * terrain and coastline, which is what the mountain and marine profiles need.
 */
export const BASE_LAYERS: readonly TileSource[] = [
  {
    id: "osm",
    name: "Map",
    urlTemplate: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: "satellite",
    name: "Satellite",
    urlTemplate:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    // Note the {z}/{y}/{x} order above — Esri serves row before column, and
    // copying the {z}/{x}/{y} order from OSM gives a map of the wrong places
    // rather than a 404, which is much harder to notice.
    attribution:
      'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  {
    id: "terrain",
    name: "Terrain",
    urlTemplate: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
  },
] as const;

export const DEFAULT_BASE_LAYER_ID = "osm";

/**
 * OpenSeaMap's seamark overlay: buoys, lights, beacons, harbours, ferry routes.
 *
 * Transparent PNGs meant to sit over a base map, which is why it is an overlay
 * and not a base layer. Coverage is a volunteer effort, so an empty-looking
 * tile over a quiet stretch of coast is the data, not a failure.
 */
export const SEAMARK_LAYER: TileSource = {
  id: "seamarks",
  name: "Sea marks",
  urlTemplate: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
  attribution:
    'Sea marks &copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors',
  maxZoom: 18,
  opacity: 1,
};

/** The frame index. Public, keyless, CORS-enabled. */
export const RAINVIEWER_INDEX_URL =
  "https://api.rainviewer.com/public/weather-maps.json";

export const RAINVIEWER_ATTRIBUTION =
  'Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>';

/**
 * One radar image in time. `urlTemplate` is absolute and already carries the
 * frame's own hashed path, so a frame is switched by swapping the whole
 * template rather than by re-deriving a URL from a timestamp.
 */
export interface RadarFrame {
  /** Unix seconds, as RainViewer reports it. */
  time: number;
  /** Leaflet template — absolute, with `{z}/{x}/{y}`. */
  urlTemplate: string;
  /** `nowcast` frames are a forecast, and the UI says so. */
  kind: "past" | "forecast";
}

/**
 * Tile size, colour scheme and options, in RainViewer's path order:
 * `/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png`.
 *
 * Scheme 2 is the "Universal Blue" ramp, which stays legible over both the
 * street map and the satellite base. Smoothing on, snow shown separately.
 */
const RAINVIEWER_TILE_SUFFIX = "/256/{z}/{x}/{y}/2/1_1.png";

/**
 * Read the index into frames, in time order, tolerating anything.
 *
 * The response is third-party JSON on a free endpoint: it has been observed
 * with an empty `nowcast` array and no satellite frames at all. Nothing here
 * throws — a shape we do not recognise yields no frames, and the radar control
 * hides itself.
 */
export function parseRadarFrames(payload: unknown): RadarFrame[] {
  if (!isRecord(payload)) return [];

  const host = typeof payload.host === "string" ? payload.host : "";
  if (!host.startsWith("https://")) return [];

  const radar = isRecord(payload.radar) ? payload.radar : undefined;
  if (!radar) return [];

  const frames = [
    ...collectFrames(radar.past, host, "past"),
    ...collectFrames(radar.nowcast, host, "forecast"),
  ];

  frames.sort((a, b) => a.time - b.time);
  return frames;
}

function collectFrames(
  value: unknown,
  host: string,
  kind: RadarFrame["kind"],
): RadarFrame[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { time, path } = entry;
    if (typeof time !== "number" || !Number.isFinite(time)) return [];
    if (typeof path !== "string" || !path.startsWith("/")) return [];

    return [{ time, urlTemplate: `${host}${path}${RAINVIEWER_TILE_SUFFIX}`, kind }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Fetch the frame index. Resolves to `[]` on any failure — offline, rate
 * limited, CORS, malformed body — because the radar is an extra and the map
 * has to keep working without it.
 *
 * The `try` wraps the `fetch` call itself, not only its promise: a stubbed or
 * blocked `fetch` can throw synchronously, and a bare `.catch()` would not see
 * it. The test setup does exactly that on purpose.
 */
export async function fetchRadarFrames(
  signal?: AbortSignal,
): Promise<RadarFrame[]> {
  try {
    const response = await fetch(RAINVIEWER_INDEX_URL, { signal });
    if (!response.ok) return [];
    return parseRadarFrames(await response.json());
  } catch {
    return [];
  }
}

/** The frame's wall-clock time in the viewer's own locale and zone. */
export function frameClock(timeSeconds: number): string {
  return new Date(timeSeconds * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * How far the frame sits from now, in words: `"now"`, `"30 min ago"`,
 * `"in 20 min"`. Rounded to the nearest minute — radar frames are ten minutes
 * apart, so seconds are noise.
 */
export function frameOffsetLabel(timeSeconds: number, nowMs: number): string {
  const minutes = Math.round((timeSeconds * 1000 - nowMs) / 60000);
  if (minutes === 0) return "now";
  if (minutes < 0) return `${Math.abs(minutes)} min ago`;
  return `in ${minutes} min`;
}
